const JOB_TYPES = {
  core: [
    { id: 'ib_ff', name: 'Breakdown, First Fix (All Appliance Types)', minutes: 56, credits: 0.67, variable: false },
    { id: 'linked_ib', name: 'Linked Breakdown (Same appliance as Ann. Service Visit)', minutes: 56, credits: 0.67, variable: false },
    { id: 'asv_chb_cir_wh_swh', name: 'Annual Service Visit (CHB, CIR, WH, SWH)', minutes: 40, credits: 0.48, variable: false },
    { id: 'asv_fre', name: 'Annual Service Visit (FRE)', minutes: 47, credits: 0.56, variable: false },
    { id: 'fv_chb', name: 'First Visit (CHB)', minutes: 48, credits: 0.57, variable: false },
    { id: 'ld_completed', name: 'Long Duration (Completed)', minutes: 205, credits: 2.45, variable: false },
    { id: 'oca', name: 'OCA (All Appliance Types)', minutes: 56, credits: 0.67, variable: false },
    { id: 'remedial_safety', name: 'Remedial Safety (First Visit only)', minutes: 30, credits: 0.36, variable: false },
    { id: 'asv_bbf_wau_waw_aga', name: 'Annual Service Visit (BBF, WAU, WAW, AGA)', minutes: 63, credits: 0.75, variable: false },
    { id: 'fv_bbf_wau_waw', name: 'First Visit (BBF, WAU, WAW)', minutes: 71, credits: 0.85, variable: false },
    { id: 'as_inst', name: 'Annual Service - INST (Landlords Inspection)', minutes: 21, credits: 0.25, variable: false },
    { id: 'standalone_quote', name: 'Standalone Quote Job', minutes: 31, credits: 0.37, variable: false },
    { id: 'free_gas_safety', name: 'Free Gas Safety Check', minutes: 30, credits: 0.36, variable: false },
    { id: 'upgrade_work', name: 'Upgrade Work (per hour quoted)', minutes: 60, credits: 0.72, variable: true, variableType: 'hours', variablePrompt: 'Hours quoted' },
    { id: 'trace_repair', name: 'Trace & Repair', minutes: 1, credits: 0.01, variable: true, variableType: 'minutes', variablePrompt: 'Minutes on completion' },
    { id: 'install_cod', name: 'Install COD', minutes: 5, credits: 0.06, variable: false },
    { id: 'hive_install_generic', name: 'Hive Install', minutes: 90, credits: 1.08, variable: false },
    { id: 'asv_mwh_wal', name: 'Annual Service Visit (MWH, WAL)', minutes: 35, credits: 0.42, variable: false },
    { id: 'asv_hob_ckr_ovn', name: 'Annual Service Visit (HOB, CKR, OVN)', minutes: 23, credits: 0.28, variable: false }
  ],
  hive: [
    { id: 'hvi_hub', code: 'HVI-HUB', name: 'Hive Install – OpenTherm Upgrade', minutes: 40, credits: 0.48, variable: false },
    { id: 'hvi_iio', code: 'HVI-IIO', name: 'Hive Inday Install Offer', minutes: 34, credits: 0.41, variable: false },
    { id: 'hvi_min', code: 'HVI-MIN', name: 'Hive Install – Mini Thermostat', minutes: 90, credits: 1.08, variable: false },
    { id: 'hvi_imz', code: 'HVI-IMZ', name: 'Hive Install – Multizone', minutes: 30, credits: 0.36, variable: false },
    { id: 'hvi_trv', code: 'HVI-TRV', name: 'Hive Install – TRV', minutes: 30, credits: 0.36, variable: false },
    { id: 'hvi_wls', code: 'HVI-WLS', name: 'Hive Install – Wireless Thermostat', minutes: 90, credits: 1.08, variable: false },
    { id: 'hvi_wrd', code: 'HVI-WRD', name: 'Hive Install – Wired Thermostat', minutes: 60, credits: 0.72, variable: false },
    { id: 'hvr_the', code: 'HVR-THE', name: 'Hive Repair – Thermostat', minutes: 56, credits: 0.67, variable: false },
    { id: 'hvr_trv', code: 'HVR-TRV', name: 'Hive Repair – TRV', minutes: 56, credits: 0.67, variable: false },
    { id: 'hvu_the', code: 'HVU-THE', name: 'Hive Uninstall – Thermostat', minutes: 90, credits: 1.08, variable: false },
    { id: 'inshv_min', code: 'INSHV-MIN', name: 'Install Hive Mini Thermostat (Solvers)', minutes: 90, credits: 1.08, variable: false },
    { id: 'inshv_thr', code: 'INSHV-THR', name: 'Install Hive Thermostat (Solvers)', minutes: 90, credits: 1.08, variable: false },
    { id: 'inshv_trv', code: 'INSHV-TRV', name: 'Install Hive TRVs (Solvers)', minutes: 0, credits: 0, variable: true, variableType: 'minutes', variablePrompt: 'Charge time in minutes' },
    { id: 'rchv_thr', code: 'RCHV-THR', name: 'Recall Hive Thermostat', minutes: 56, credits: 0.67, variable: false },
    { id: 'rchv_trv', code: 'RCHV-TRV', name: 'Recall Hive TRVs', minutes: 56, credits: 0.67, variable: false }
  ],
  sales: [
    { id: 'hi_lead', name: 'HI Lead (Boiler Lead)', minutes: 58, credits: 0.69, variable: false }
  ],
  absent: [
    { id: 'wait_work', name: 'Wait Work', minutes: 60, credits: 0.72, variable: true, variableType: 'hours', variablePrompt: 'Time in hours' },
    { id: 'early_finish', name: 'Early Finish', minutes: 0, credits: 0, variable: true, variableType: 'minutes', variablePrompt: 'How many minutes did you finish early?', isNpt: true, confirmLabel: 'Log Early Finish', skipNameField: true },
    { id: 'mentor_full', name: 'Mentor Support (Full Day)', minutes: 0, credits: 0, variable: false, isMentorFull: true },
    { id: 'mentor_partial', name: 'Mentor Support (20% Reduction)', minutes: 0, credits: 0, variable: false, isMentorPartial: true },
    { id: 'ev_charge', name: 'EV Charging', minutes: 30, credits: 0.36, variable: false },
    { id: 'buybox_collection', name: 'Bybox Part Collection', minutes: 10, credits: 0.12, variable: false },
    { id: 'merchant_parts', name: 'Merchant Parts Collection', minutes: 10, credits: 0.12, variable: false },
    { id: 'npt_quick', name: 'Non-Productive Time', minutes: 0, credits: 0, variable: true, variableType: 'minutes', variablePrompt: 'Time in minutes', isNpt: true }
  ]
};

// credit minutes → credit hours
function minutesToCreditHours(mins) {
  return mins / 60;
}

// For variable jobs: credits = minutes / 83.58
function calcVariableCredits(mins) {
  return +(mins / 83.58).toFixed(4);
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return localDateStr(monday);
}

function getTodayKey() {
  return localDateStr(new Date());
}

function weekDays(weekKey) {
  const days = [];
  const start = new Date(weekKey + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(localDateStr(d));
  }
  return days;
}

function shiftHours(shift) {
  if (!shift || !shift.start || !shift.end) return null;
  const [sh, sm] = shift.start.split(':').map(Number);
  const [eh, em] = shift.end.split(':').map(Number);
  const gross = eh * 60 + em - sh * 60 - sm;
  const lunch = (shift.lunch !== undefined && shift.lunch !== '') ? Number(shift.lunch) : 0;
  const net = gross - lunch;
  return net > 0 ? net / 60 : null;
}

function dayIsLeave(week, dayKey) {
  var s = (week.shifts || {})[dayKey];
  return !!(s && s.leave);
}

function weekLeaveHours(state, week) {
  var total = 0;
  var shifts = week.shifts || {};
  Object.keys(shifts).forEach(function(dk) {
    var s = shifts[dk];
    if (s && s.leave) {
      var h = shiftHours(s);
      total += h !== null ? h : (state.baseHours / 5);
    }
  });
  return total;
}

function getDailyTarget(state, week, dayKey) {
  if (dayIsLeave(week, dayKey)) return 0;
  const mentor = (week.mentorDays || {})[dayKey];
  if (mentor === 'full') return 0;
  const h = shiftHours((week.shifts || {})[dayKey]);
  const base = h !== null ? h : state.baseHours / 5;
  if (mentor === 'partial') return base * 0.8;
  return base;
}

function weekMentorTargetReduction(state, week) {
  var reduction = 0;
  var mentorDays = week.mentorDays || {};
  Object.keys(mentorDays).forEach(function(dk) {
    var type = mentorDays[dk];
    var h = shiftHours((week.shifts || {})[dk]);
    var dayH = h !== null ? h : state.baseHours / 5;
    if (type === 'full') reduction += dayH;
    else if (type === 'partial') reduction += dayH * 0.2;
  });
  return reduction;
}

function cumulativeBalance(state) {
  var currentWk = getWeekKey(new Date());
  var total = state.startingBalance || 0;
  for (var wk in state.weeks) {
    if (wk < currentWk && !state.weeks[wk].excludeFromCtap) {
      var week = state.weeks[wk];
      total += weekCreditHours(week) - adjustedTargetHours(state, week);
    }
  }
  return total;
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem('jct_state') || 'null') || defaultState();
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return { baseHours: 40, weeks: {} };
}

function saveState(state) {
  localStorage.setItem('jct_state', JSON.stringify(state));
}

function getOrCreateWeek(state, weekKey) {
  if (!state.weeks[weekKey]) {
    state.weeks[weekKey] = { deductionMins: 0, days: {} };
  }
  return state.weeks[weekKey];
}

function getOrCreateDay(week, dayKey) {
  if (!week.days[dayKey]) week.days[dayKey] = [];
  return week.days[dayKey];
}

function weekTotalCreditMins(week) {
  if (!week.days) return 0;
  return Object.values(week.days).reduce((s, arr) => s + arr.reduce((a, j) => a + j.creditMins, 0), 0);
}

function weekCreditHours(week) {
  return weekTotalCreditMins(week) / 60;
}

// Rostered hours = contracted hours minus leave and mentor adjustments
// (travel is NOT deducted — it is accounted for in the configurable % target)
function rosteredHours(state, week) {
  return state.baseHours - weekLeaveHours(state, week) - weekMentorTargetReduction(state, week);
}

// Adjusted target = rostered × configured % (default 80%) minus NPT deductions
function adjustedTargetHours(state, week) {
  const rostered = rosteredHours(state, week);
  const pct = typeof state.weeklyTargetPct === 'number' ? state.weeklyTargetPct : 0.8;
  const npt = (week.deductionMins || 0) / 60;
  return Math.max(0, rostered * pct - npt);
}

// Rolling average of last 4–6 completed non-empty weeks before weekKey
// Returns { avg, n } or null when fewer than 4 qualifying weeks exist
function rollingAvgInfo(state, weekKey) {
  const cutoff = weekKey || getWeekKey(new Date());
  const qualifying = Object.keys(state.weeks)
    .filter(wk => wk < cutoff && weekCreditHours(state.weeks[wk]) > 0)
    .sort()
    .slice(-6);
  if (qualifying.length < 4) return null;
  const avg = qualifying.reduce((s, wk) => s + weekCreditHours(state.weeks[wk]), 0) / qualifying.length;
  return { avg, n: qualifying.length };
}

// Effective target for dashboard display:
//   • rolling average (scaled by roster ratio) when 4+ completed weeks exist
//   • otherwise the configured % formula
// Returns { hours, isRolling, n, displayTarget }
//   hours        = effective target after NPT deduction (used for progress %)
//   displayTarget = pre-NPT figure (shown in the Rostered | Target line)
function effectiveTargetHours(state, week, weekKey) {
  const rostered = rosteredHours(state, week);
  const npt = (week.deductionMins || 0) / 60;
  const rolling = rollingAvgInfo(state, weekKey);
  if (rolling && state.baseHours > 0) {
    const scaledAvg = rolling.avg * (rostered / state.baseHours);
    return { hours: Math.max(0, scaledAvg - npt), isRolling: true, n: rolling.n, displayTarget: Math.max(0, scaledAvg) };
  }
  const pct = typeof state.weeklyTargetPct === 'number' ? state.weeklyTargetPct : 0.8;
  const displayTarget = rostered * pct;
  return { hours: Math.max(0, displayTarget - npt), isRolling: false, n: 0, displayTarget };
}

function bonusAchieved(state, week) {
  return weekCreditHours(week) >= adjustedTargetHours(state, week);
}

function formatHM(totalMins) {
  const h = Math.floor(Math.abs(totalMins) / 60);
  const m = Math.abs(totalMins) % 60;
  const sign = totalMins < 0 ? '-' : '';
  return `${sign}${h}h ${m.toString().padStart(2,'0')}m`;
}

function formatCredits(c) {
  return c.toFixed(2);
}

function weekLabel(weekKey) {
  const d = new Date(weekKey + 'T00:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = dt => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(end)}`;
}

function dayLabel(dayKey) {
  return new Date(dayKey + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
