import { supabase } from './supabase.js';

// ── Profile ────────────────────────────────────────────────────────────────

export async function ensureProfile(user, displayName) {
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: created, error: insertErr } = await supabase
      .from('users_profile')
      .insert({ id: user.id, display_name: displayName || '' })
      .select()
      .single();
    if (insertErr) throw insertErr;
    return created;
  }
  return data;
}

export async function updateProfileField(userId, fields) {
  const { error } = await supabase
    .from('users_profile')
    .update(fields)
    .eq('id', userId);
  if (error) throw error;
}

// ── Load state from Supabase ───────────────────────────────────────────────

export async function loadStateFromSupabase(user) {
  const [profileRes, weeksRes, jobsRes] = await Promise.all([
    supabase.from('users_profile').select('*').eq('id', user.id).single(),
    supabase.from('weeks').select('*').eq('user_id', user.id),
    supabase.from('job_logs').select('*').eq('user_id', user.id).order('sort_order')
  ]);

  if (profileRes.error) throw profileRes.error;
  if (weeksRes.error) throw weeksRes.error;
  if (jobsRes.error) throw jobsRes.error;

  const profile = profileRes.data;
  const weeks = weeksRes.data || [];
  const jobs = jobsRes.data || [];

  // Reconstruct state object matching the existing app.js shape
  const state = {
    baseHours: profile.base_hours,
    weeklyTargetPct: profile.weekly_target_pct,
    startingBalance: profile.starting_balance,
    weeks: {}
  };

  // Build weeks map
  for (const wk of weeks) {
    state.weeks[wk.week_key] = {
      deductionMins: wk.deduction_mins,
      excludeFromCtap: wk.exclude_from_ctap,
      shifts: wk.shifts_json || {},
      mentorDays: wk.mentor_days_json || {},
      deductionLog: wk.deductions_json || [],
      notes: wk.notes || '',
      days: {}
    };
  }

  // Populate days with job logs
  for (const job of jobs) {
    const wk = state.weeks[job.week_key];
    if (!wk) continue;
    if (!wk.days[job.day_key]) wk.days[job.day_key] = [];
    wk.days[job.day_key].push({
      id: job.id,
      jobId: job.job_id,
      name: job.job_name,
      creditMins: job.credit_mins,
      variableValue: job.variable_value
    });
  }

  return { state, profile };
}

// ── Sync state to Supabase ─────────────────────────────────────────────────

export async function syncStateToSupabase(user, state) {
  const profileUpdate = {
    base_hours: state.baseHours,
    weekly_target_pct: typeof state.weeklyTargetPct === 'number' ? state.weeklyTargetPct : 0.8,
    starting_balance: state.startingBalance || 0
  };

  const profilePromise = supabase
    .from('users_profile')
    .update(profileUpdate)
    .eq('id', user.id);

  // Upsert all weeks
  const weekRows = Object.entries(state.weeks || {}).map(([weekKey, wk]) => ({
    user_id: user.id,
    week_key: weekKey,
    deduction_mins: wk.deductionMins || 0,
    exclude_from_ctap: wk.excludeFromCtap || false,
    shifts_json: wk.shifts || {},
    mentor_days_json: wk.mentorDays || {},
    deductions_json: wk.deductionLog || [],
    notes: wk.notes || ''
  }));

  const weeksPromise = weekRows.length > 0
    ? supabase.from('weeks').upsert(weekRows, { onConflict: 'user_id,week_key' })
    : Promise.resolve({ error: null });

  const [profileRes, weeksRes] = await Promise.all([profilePromise, weeksPromise]);
  if (profileRes.error) throw profileRes.error;
  if (weeksRes.error) throw weeksRes.error;
}

// ── Sync a single week's job logs ─────────────────────────────────────────

export async function syncWeekJobLogs(user, state, weekKey) {
  const week = state.weeks[weekKey];
  if (!week) return;

  // Delete all existing logs for this week then re-insert
  const { error: delErr } = await supabase
    .from('job_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('week_key', weekKey);
  if (delErr) throw delErr;

  const rows = [];
  let order = 0;
  for (const [dayKey, jobs] of Object.entries(week.days || {})) {
    for (const job of jobs) {
      rows.push({
        user_id: user.id,
        week_key: weekKey,
        day_key: dayKey,
        job_id: job.jobId || job.id || '',
        job_name: job.name || '',
        credit_mins: job.creditMins || 0,
        variable_value: job.variableValue ?? null,
        sort_order: order++
      });
    }
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('job_logs').insert(rows);
    if (insErr) throw insErr;
  }
}

// ── Sync week metadata only (no jobs) ─────────────────────────────────────

export async function syncWeekMeta(user, state, weekKey) {
  const week = state.weeks[weekKey];
  if (!week) return;

  const { error } = await supabase.from('weeks').upsert({
    user_id: user.id,
    week_key: weekKey,
    deduction_mins: week.deductionMins || 0,
    exclude_from_ctap: week.excludeFromCtap || false,
    shifts_json: week.shifts || {},
    mentor_days_json: week.mentorDays || {},
    deductions_json: week.deductionLog || [],
    notes: week.notes || ''
  }, { onConflict: 'user_id,week_key' });

  if (error) throw error;
}
