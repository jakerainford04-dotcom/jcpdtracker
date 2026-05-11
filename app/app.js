// ── State ──────────────────────────────────────────────────────────────────
let state = loadState();
let currentWeekKey = getWeekKey(new Date());
let activeTab = 'dashboard'; // dashboard | log | schedule | history | settings
let activeJobTab = 'core';   // core | hive | sales
let pendingJob = null;
let lastGreeting = '';
let weekSummaryKey = null;
let activeLogDay = getTodayKey();
let jobSearch = '';

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('error', function(e) {
  var app = document.getElementById('app');
  if (app) app.innerHTML = '<div style="padding:20px;color:#ef4444;background:#1e293b;margin:16px;border-radius:8px;font-family:monospace;font-size:12px"><b>JS Error</b><br>' + e.message + '<br>at line ' + e.lineno + '</div>';
});

document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem('jcpd_theme') === 'light') document.body.classList.add('light');
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  }
});

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  try {
    document.getElementById('app').innerHTML = buildApp();
    attachListeners();
  } catch(e) {
    document.getElementById('app').innerHTML = '<div style="padding:20px;color:#ef4444;background:#1e293b;margin:16px;border-radius:8px;font-family:monospace;font-size:12px"><b>Render Error</b><br>' + e.message + '<br>' + (e.stack || '') + '</div>';
  }
}

function buildApp() {
  return `
    ${buildTopBar()}
    <main class="main" id="main">${buildMain()}</main>
    ${buildBottomNav()}
    ${buildModal()}
    ${buildWeekForecastSheet()}
    ${buildWeekSummarySheet()}
    <div class="toast" id="toast"></div>
  `;
}

function buildTopBar() {
  const todayWk = getWeekKey(new Date());
  const isCurrentWeek = currentWeekKey === todayWk;
  const isFutureWeek = currentWeekKey > todayWk;
  return `
    <header class="top-bar">
      <div class="top-title">
        <div class="top-title-main">JCPD Tracker</div>
        <div class="top-title-sub">Service + Repair</div>
      </div>
      ${activeTab === 'dashboard' ? `<div class="week-nav">
        <button id="prev-week" aria-label="Previous week">&#8249;</button>
        <span>${weekLabel(currentWeekKey)}${isCurrentWeek ? '<span class="week-dot">•</span>' : ''}${isFutureWeek ? '<span class="week-future-badge">FUTURE</span>' : ''}</span>
        <button id="next-week" aria-label="Next week" ${isCurrentWeek ? 'disabled style="opacity:0.3"' : ''}>&#8250;</button>
      </div>` : ''}
    </header>
  `;
}

function buildMain() {
  switch (activeTab) {
    case 'dashboard': return buildDashboard();
    case 'log':       return buildLogJobs();
    case 'schedule':  return buildSchedule();
    case 'history':   return buildHistory();
    case 'settings':  return buildSettings();
  }
}

function buildBottomNav() {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: iconChart() },
    { id: 'log',       label: 'Log Job',   icon: iconPlus() },
    { id: 'schedule',  label: 'Schedule',  icon: iconCalendar() },
    { id: 'history',   label: 'History',   icon: iconClock() },
    { id: 'settings',  label: 'Settings',  icon: iconGear() },
  ];
  return `<nav class="bottom-nav">${tabs.map(t => `
    <button class="${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
      <span class="nav-icon">${t.icon}</span><span>${t.label}</span>
    </button>`).join('')}
  </nav>`;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function buildDashboard() {
  const week = getOrCreateWeek(state, currentWeekKey);
  const isCurrentWeek = currentWeekKey === getWeekKey(new Date());

  // ── Weekly stats ──
  const earnedHours = weekCreditHours(week);
  const targetHours = adjustedTargetHours(state, week);
  const weekPct = targetHours > 0 ? Math.min((earnedHours / targetHours) * 100, 100) : 0;
  const bonus = bonusAchieved(state, week);
  const weekColour = bonus ? 'green' : (weekPct >= 80 ? 'amber' : 'red');

  // ── Today's stats ──
  const todayKey = getTodayKey();
  const todayDedMins = (week.deductionLog || [])
    .filter(d => d.date === todayKey)
    .reduce((s, d) => s + d.mins, 0);
  const dailyTargetHours = Math.max(0, getDailyTarget(state, week, todayKey) - todayDedMins / 60);
  const todayJobs = (week.days || {})[todayKey] || [];
  const todayHours = todayJobs.reduce((s, j) => s + j.creditMins, 0) / 60;
  const dayPct = dailyTargetHours > 0 ? Math.min((todayHours / dailyTargetHours) * 100, 100) : 0;
  const dayColour = todayHours >= dailyTargetHours ? 'green' : (dayPct >= 80 ? 'amber' : 'red');

  // ── CTAP balance ──
  const bal = cumulativeBalance(state);
  const balColour = bal >= 0 ? 'green' : 'red';
  const balAbs = Math.abs(bal);
  const balSign = bal < 0 ? '-' : '+';
  const balSignColour = bal < 0 ? 'red' : 'green';
  const balIntNum = Math.floor(balAbs);
  const balDecStr = (balAbs % 1).toFixed(2).slice(1);

  // ── Deductions ──
  const allDed = week.deductionLog || [];
  const allDedIndexed = allDed.map((d, i) => ({ ...d, logIdx: i }));
  const todayDeds = allDedIndexed.filter(d => d.date === todayKey);
  const prevDeds  = allDedIndexed.filter(d => d.date !== todayKey);
  const hasAny = todayJobs.length > 0 || allDedIndexed.length > 0;
  const prevDayHours = Math.max(0, earnedHours - todayHours);
  const hasPrevDayJobs = prevDayHours > 0.001;

  // ── Week bar chart ──
  const wDays = weekDays(currentWeekKey);
  const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weekBarsHTML = wDays.map((dk, i) => {
    const dj = (week.days || {})[dk] || [];
    const dc = dj.reduce((s, j) => s + j.creditMins, 0) / 60;
    const dt = getDailyTarget(state, week, dk);
    const isToday = dk === todayKey;
    const isLeave = dayIsLeave(week, dk);
    const bp = dt > 0 ? Math.min((dc / dt) * 100, 100) : (dc > 0 ? 100 : 0);
    const cls = isLeave ? 'leave' : isToday ? 'today' : bp >= 100 ? 'done' : dc > 0 ? 'partial' : 'empty';
    return `<div class="week-bar-col${isToday ? ' today' : ''}">
        <div class="week-bar-track"><div class="week-bar-fill ${cls}" style="height:${bp.toFixed(0)}%"></div></div>
        <div class="week-bar-label">${DAY_ABBR[i]}</div>
      </div>`;
  }).join('');

  // ── Performance Factor ──
  // PF = raw output × 8.5%, capped at 40 min per day, calculated per-day then summed for week
  const PF_DAY_CAP = 40;
  const todayShiftHrs = shiftHours((week.shifts || {})[todayKey]);
  const todayShiftForPF = todayShiftHrs !== null ? todayShiftHrs : state.baseHours / 5;
  const todayRawOutput = Math.max(0, todayShiftForPF - todayDedMins / 60);
  const todayPFMins = Math.min(PF_DAY_CAP, Math.round(todayRawOutput * 0.085 * 60));
  const todayPFStr = todayPFMins >= 60
    ? `${Math.floor(todayPFMins / 60)}h ${String(todayPFMins % 60).padStart(2, '0')}m`
    : `${todayPFMins}m`;

  // Week PF: sum each working day independently (each capped at 40 min)
  const weekPFMins = wDays.reduce((sum, dk) => {
    if (dayIsLeave(week, dk)) return sum;
    const h = shiftHours((week.shifts || {})[dk]);
    const dayShiftH = h !== null ? h : state.baseHours / 5;
    const dayDedMins = (week.deductionLog || [])
      .filter(d => d.date === dk)
      .reduce((s, d) => s + d.mins, 0);
    const dayRaw = Math.max(0, dayShiftH - dayDedMins / 60);
    return sum + Math.min(PF_DAY_CAP, Math.round(dayRaw * 0.085 * 60));
  }, 0);
  const weekPFStr = weekPFMins >= 60
    ? `${Math.floor(weekPFMins / 60)}h ${String(weekPFMins % 60).padStart(2, '0')}m`
    : `${weekPFMins}m`;
  const hasPFData = todayShiftHrs !== null;

  // ── Greeting + date header ──
  const isoWeekOf = function(dateObj) {
    const d = new Date(dateObj); d.setHours(0,0,0,0);
    const dow = d.getDay();
    d.setDate(d.getDate() + 3 - (dow + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  };

  const greetHour = new Date().getHours();
  const greeting = greetHour >= 5 && greetHour < 12 ? 'Good morning'
    : greetHour >= 12 && greetHour < 17 ? 'Good afternoon'
    : greetHour >= 17 && greetHour < 22 ? 'Good evening'
    : 'Good night';
  const greetDisplay = lastGreeting === greeting ? greeting + '...' : greeting;

  let dateStr = '';
  if (isCurrentWeek) {
    const _now = new Date();
    const _dow = _now.getDay();
    const _wkDay = Math.min((((_dow + 6) % 7) + 1), 5);
    const _isoWk = isoWeekOf(_now);
    dateStr = _now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
      + ' · WK ' + _isoWk + ' · DAY ' + _wkDay + ' / 5';
  } else if (currentWeekKey < getWeekKey(new Date())) {
    const wkStart = new Date(currentWeekKey + 'T00:00:00');
    const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    dateStr = 'WK ' + isoWeekOf(wkStart) + ' · ' + fmt(wkStart) + ' – ' + fmt(wkEnd);
  }

  // ── Pace line for Today card ──
  let paceLine = '';
  if (isCurrentWeek && !dayIsLeave(week, todayKey) && dailyTargetHours > 0) {
    const _cur = new Date().getHours() * 60 + new Date().getMinutes();
    const _sh  = (week.shifts || {})[todayKey] || {};
    let _startM = 480, _endM = 990;
    if (_sh.start && _sh.end) {
      const [sh, sm] = _sh.start.split(':').map(Number);
      const [eh, em] = _sh.end.split(':').map(Number);
      _startM = sh * 60 + sm; _endM = eh * 60 + em;
    }
    const _worked  = Math.max(0, _cur - _startM);
    const _remain  = Math.max(0, _endM - _cur);
    const _remStr  = _remain >= 60
      ? `${Math.floor(_remain / 60)}h ${String(_remain % 60).padStart(2, '0')}m left`
      : `${_remain}m left`;
    if (_cur >= _endM) {
      const _g = todayHours - dailyTargetHours;
      paceLine = `<div class="split-pace ${_g >= 0 ? 'pace-green' : 'pace-red'}">${_g >= 0 ? 'Shift complete · target hit ✓' : 'Shift complete · below target'}</div>`;
    } else if (_cur < _startM) {
      const _m = _startM - _cur;
      paceLine = `<div class="split-pace pace-muted">Starts in ${_m >= 60 ? Math.floor(_m/60)+'h '+_m%60+'m' : _m+'m'}</div>`;
    } else if (todayHours > 0 && _worked >= 15) {
      const _proj = todayHours + (todayHours / _worked) * _remain;
      const _gap  = _proj - dailyTargetHours;
      if (_gap >= 0) {
        paceLine = `<div class="split-pace pace-green">On pace · ${_remStr}</div>`;
      } else {
        const _n = Math.ceil(Math.abs(_gap) / (56 / 60));
        paceLine = `<div class="split-pace pace-red">${_n} job${_n === 1 ? '' : 's'} to catch up · ${_remStr}</div>`;
      }
    } else if (_remain > 0) {
      paceLine = `<div class="split-pace pace-muted">${_remStr}</div>`;
    }
  }

  return `
    ${isCurrentWeek ? `<div class="dash-greeting" id="greeting-text" data-greeting="${greeting}">${greetDisplay}</div>` : ''}
    ${dateStr ? `<div class="date-header">${dateStr}</div>` : ''}
    ${week.note ? `<div class="dash-note">${week.note}</div>` : ''}
    <div id="ticker-wrap">${buildTickerStrip()}</div>

    <div class="ctap-hero-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="ctap-hero-label">CTAP Balance</div>
        <span class="status-badge ${balColour}" style="font-size:0.58rem;padding:2px 8px">${bal >= 0 ? 'In credit' : 'Deficit'}</span>
      </div>
      <div class="ctap-number-row">
        <span class="ctap-numblock">
          <span class="ctap-sign ${balSignColour}">${balSign}</span><span class="ctap-int ${bal >= 0 ? 'green' : ''}">${balIntNum}</span><span class="ctap-dec">${balDecStr}</span>
        </span>
        <span class="ctap-unit">HRS</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <span style="font-size:0.62rem;color:var(--muted)">Starting balance: <span style="font-weight:600;color:var(--muted)">${(state.startingBalance || 0) >= 0 ? '+' : ''}${(state.startingBalance || 0).toFixed(2)}h</span></span>
      </div>
    </div>

    <div class="split-cards">
      <div class="split-card">
        <div class="split-card-top">
          <span class="split-card-label">Today</span>
          <span class="pct-badge pct-badge-${dayColour}">${Math.round(dayPct)}%</span>
        </div>
        <div class="split-hours ${dayColour}">${todayHours.toFixed(2)}<span class="split-unit">h</span></div>
        <div class="split-sub">of ${dailyTargetHours.toFixed(1)}h target</div>
        ${paceLine}
        <div class="progress-bar" style="margin-top:auto">
          <div class="progress-bar-fill ${dayColour}" style="width:${dayPct.toFixed(1)}%"></div>
        </div>
      </div>
      <div class="split-card" id="week-tile">
        <div class="split-card-top">
          <span class="split-card-label">Week</span>
          <span class="pct-badge pct-badge-${weekColour}">${Math.round(weekPct)}%</span>
        </div>
        <div class="split-hours ${bonus ? 'green' : ''}">${earnedHours.toFixed(2)}<span class="split-unit">h</span></div>
        <div class="split-sub">of ${targetHours.toFixed(1)}h target</div>
        <div class="week-chart">${weekBarsHTML}</div>
      </div>
    </div>

    <details class="insights-details"${hasAny ? ' open' : ''}>
      <summary class="insights-summary">
        <span>Today's Jobs</span>
        <span class="insights-count">${todayHours.toFixed(2)}h${hasPrevDayJobs ? ' · +' + prevDayHours.toFixed(2) + 'h earlier' : ''}</span>
      </summary>
      <div style="margin-top:6px">
        ${hasAny
          ? todayJobs.map((j, i) => {
              const ts = j.ts ? new Date(j.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
              return `<div class="job-entry">
                <span class="job-ts">${ts}</span>
                <span class="job-name">${j.name}${j.variableInput ? ` <span style="color:var(--muted)">(${j.variableInput})</span>` : ''}</span>
                <span class="job-credits">+ ${(j.creditMins / 60).toFixed(2)} h</span>
                <button class="del-btn" data-day="${todayKey}" data-idx="${i}" title="Remove">×</button>
              </div>`;
            }).join('')
            + todayDeds.map(d => `
            <div class="job-entry">
              <span class="job-ts">NPT</span>
              <span class="job-name" style="color:var(--amber)">${d.name}</span>
              <span class="job-credits" style="color:var(--amber)">-${(d.mins / 60).toFixed(2)}h</span>
              <button class="del-btn del-ded-btn" data-ded-idx="${d.logIdx}" title="Remove">×</button>
            </div>`).join('')
            + prevDeds.map(d => {
              const dl = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
              return `<div class="job-entry">
                <span class="job-ts">${dl}</span>
                <span class="job-name" style="color:var(--amber)">${d.name}</span>
                <span class="job-credits" style="color:var(--amber)">-${(d.mins / 60).toFixed(2)}h</span>
                <button class="del-btn del-ded-btn" data-ded-idx="${d.logIdx}" title="Remove">×</button>
              </div>`;
            }).join('')
          : '<div class="empty" style="padding:10px 0">No jobs logged today</div>'
        }
        ${hasPrevDayJobs ? `
          <div style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--sep);display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:0.72rem;color:var(--muted)">Earlier this week</span>
            <span style="font-size:0.78rem;font-weight:600;color:var(--accent)">+${prevDayHours.toFixed(2)}h — see History tab</span>
          </div>` : ''}
      </div>
    </details>

    ${buildInsightsCard(dailyTargetHours, todayHours, targetHours, earnedHours, todayPFMins)}
  `;
}

function buildSchedule() {
  const week = getOrCreateWeek(state, currentWeekKey);
  const shifts = week.shifts || {};
  const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = weekDays(currentWeekKey);
  const todayKey = getTodayKey();

  const rows = days.map((dk, i) => {
    const s = shifts[dk] || {};
    const hrs = shiftHours(s);
    const isLeave = !!(s.leave);
    const d = new Date(dk + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const isToday = dk === todayKey;
    const lunchVal = s.lunch !== undefined ? s.lunch : '';
    return `
      <div class="shift-row${isToday ? ' shift-today' : ''}${isLeave ? ' shift-leave' : ''}">
        <div class="shift-row-header">
          <span class="shift-day-name">${DAY_ABBR[i]} <small>${dateStr}</small>${isToday ? ' <span class="today-pip">TODAY</span>' : ''}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="al-btn${isLeave ? ' active' : ''}" data-day="${dk}" data-action="toggle-leave">${isLeave ? 'Leave ✓' : 'Leave'}</button>
            <span class="shift-hrs">${isLeave ? 'AL' : hrs !== null ? hrs.toFixed(1) + 'h' : '—'}</span>
          </div>
        </div>
        ${!isLeave ? `<div class="shift-row-inputs">
          <input type="time" class="shift-input" data-day="${dk}" data-field="start" value="${s.start || ''}">
          <span class="shift-sep">–</span>
          <input type="time" class="shift-input" data-day="${dk}" data-field="end" value="${s.end || ''}">
          <select class="shift-input shift-lunch-select" data-day="${dk}" data-field="lunch">
            <option value="0"  ${lunchVal==='0'||lunchVal===0   ?'selected':''}>No lunch</option>
            <option value="15" ${lunchVal==='15'||lunchVal===15  ?'selected':''}>15 min</option>
            <option value="30" ${lunchVal==='30'||lunchVal===30||lunchVal===''?'selected':''}>30 min</option>
            <option value="45" ${lunchVal==='45'||lunchVal===45  ?'selected':''}>45 min</option>
            <option value="60" ${lunchVal==='60'||lunchVal===60  ?'selected':''}>1 hour</option>
          </select>
        </div>` : `<div style="font-size:0.75rem;color:var(--amber);padding:6px 0 2px">Annual leave — target hours deducted from weekly total</div>`}
      </div>`;
  }).join('');

  const todayWk = getWeekKey(new Date());
  const isFuture = currentWeekKey > todayWk;
  const maxFutureSched = new Date(); maxFutureSched.setDate(maxFutureSched.getDate() + 56);
  const schedAtCap = currentWeekKey >= getWeekKey(maxFutureSched);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:0.9rem;font-weight:700">Week Schedule</div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
          <button id="sched-prev-week" class="inline-week-btn">&#8249;</button>
          <span style="font-size:0.72rem;color:var(--muted)">${weekLabel(currentWeekKey)}</span>
          <button id="sched-next-week" class="inline-week-btn" ${schedAtCap ? 'disabled' : ''}>&#8250;</button>
        </div>
      </div>
      <button id="apply-default" style="background:var(--surface2);border:none;color:var(--accent);border-radius:8px;padding:6px 12px;font-size:0.75rem;font-weight:600;cursor:pointer">Standard week</button>
    </div>
    ${isFuture ? `<div style="background:rgba(255,165,36,0.08);border:1px solid rgba(255,165,36,0.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:0.76rem;color:var(--accent);line-height:1.5">
      <strong>Future week</strong> — Set your schedule in advance. Leave days will automatically reduce your target when this week becomes active on CTAP.
    </div>` : ''}
    <div class="dashboard-card" style="padding:2px 12px">
      ${rows}
    </div>
    <button id="save-shifts" style="width:100%;margin-top:8px;background:var(--accent);color:var(--jcpd-accent-ink);border:none;border-radius:12px;padding:10px;font-size:0.92rem;font-weight:700;cursor:pointer;letter-spacing:-0.2px">Save Schedule</button>
    <p style="font-size:0.7rem;color:var(--muted);text-align:center;margin-top:6px">Lunch is deducted from your daily target hours</p>
    <div class="week-note-wrap">
      <label class="week-note-label">Week note</label>
      <textarea id="week-note" class="week-note-input" rows="2"
        placeholder="e.g. Training Monday, van in Wednesday…">${(week.note || '').replace(/</g, '&lt;')}</textarea>
      <p class="week-note-hint">Saves automatically</p>
    </div>
  `;
}

function buildBalanceCard() {
  // kept for any future callers; dashboard now uses inline balance
  const bal = cumulativeBalance(state);
  const colour = bal >= 0 ? 'green' : 'red';
  const sign = n => (n >= 0 ? '+' : '') + n.toFixed(2);
  return `<span style="color:var(--${colour})">${sign(bal)}h</span>`;
}

function buildInsightsCard(dailyTarget, todayHours, weekTarget, weekEarned, todayPFMins) {
  const todayKey      = getTodayKey();
  const todayWk       = getWeekKey(new Date());
  const week          = state.weeks[currentWeekKey] || { days: {}, shifts: {} };
  const isCurrentWeek = currentWeekKey === todayWk;

  // All completed past weeks, ascending
  const pastWks = Object.keys(state.weeks).filter(w => w < todayWk).sort();
  const nPast   = pastWks.length;

  const hiveIds = new Set(JOB_TYPES.hive.map(j => j.id));

  // Current-week job type tallies
  let weekHiveCount = 0, weekLeadCount = 0;
  Object.values(week.days || {}).forEach(dayJobs => {
    dayJobs.forEach(j => {
      if (hiveIds.has(j.id))  weekHiveCount++;
      if (j.id === 'hi_lead') weekLeadCount++;
    });
  });

  // NPT logged today
  const todayNPTMins = isCurrentWeek
    ? (week.deductionLog || []).filter(d => d.date === todayKey).reduce((s, d) => s + d.mins, 0)
    : 0;

  // candidates: { p: priority (1=highest), c: colour, t: text, pf?: bool }
  const cands = [];

  // ── P1: Daily status (current week only) ──────────────────────────────
  if (isCurrentWeek && dailyTarget > 0) {
    const gap          = dailyTarget - todayHours;
    const breakdownHrs = 56 / 60;

    if (todayHours >= dailyTarget) {
      const over = todayHours - dailyTarget;
      cands.push({ p: 1, c: 'green',
        t: `Daily target hit${over >= 0.01 ? ` — ${over.toFixed(2)}h over` : ''}` });
    } else if (gap <= breakdownHrs + 0.05) {
      cands.push({ p: 1, c: 'amber',
        t: `${gap.toFixed(2)}h to go today — one more job puts you there` });
    } else {
      const n = Math.ceil(gap / breakdownHrs);
      cands.push({ p: 1, c: 'amber',
        t: `${gap.toFixed(2)}h still needed today — around ${n} more job${n === 1 ? '' : 's'} at breakdown rate` });
    }

    if (todayNPTMins > 0) {
      const nptH   = todayNPTMins / 60;
      const nptPct = Math.round((nptH / dailyTarget) * 100);
      cands.push({ p: 1, c: 'amber',
        t: `NPT has cost you ${nptH.toFixed(2)}h today — that's ${nptPct}% of your daily target` });
    }
  }

  // ── P2: Current-week actionable ───────────────────────────────────────
  if (isCurrentWeek) {
    const bal = cumulativeBalance(state);

    // CTAP deficit recovery
    if (bal < -0.1) {
      const surplus = weekEarned - weekTarget;
      if (surplus > 0.1) {
        const wks = Math.ceil(-bal / surplus);
        cands.push({ p: 2, c: 'red',
          t: `CTAP is ${Math.abs(bal).toFixed(2)}h in deficit — at this week's surplus you'd clear it in ~${wks} week${wks === 1 ? '' : 's'}` });
      } else {
        cands.push({ p: 2, c: 'red',
          t: `CTAP is ${Math.abs(bal).toFixed(2)}h in deficit — you'll need a weekly surplus above target to start recovering` });
      }
    }

    // Hive flag — compare with history if available
    if (nPast >= 3) {
      const avgHive = pastWks.reduce((s, wk) => {
        let c = 0;
        Object.values(state.weeks[wk].days || {}).forEach(jobs => jobs.forEach(j => { if (hiveIds.has(j.id)) c++; }));
        return s + c;
      }, 0) / nPast;
      if (avgHive >= 1 && weekHiveCount === 0) {
        cands.push({ p: 2, c: 'amber',
          t: `You average ${avgHive.toFixed(1)} Hive install${avgHive >= 2 ? 's' : ''} per week but haven't logged any yet this week` });
      } else if (weekHiveCount > 0) {
        cands.push({ p: 3, c: 'green',
          t: `${weekHiveCount} Hive install${weekHiveCount === 1 ? '' : 's'} logged this week` });
      }
    } else if (weekHiveCount === 0) {
      cands.push({ p: 3, c: 'amber',
        t: 'No Hive installs logged this week — each adds up to 1.08h credit' });
    }

    // Boiler lead flag — compare with history if available
    if (nPast >= 3) {
      const avgLead = pastWks.reduce((s, wk) => {
        let c = 0;
        Object.values(state.weeks[wk].days || {}).forEach(jobs => jobs.forEach(j => { if (j.id === 'hi_lead') c++; }));
        return s + c;
      }, 0) / nPast;
      if (avgLead >= 1 && weekLeadCount === 0) {
        cands.push({ p: 2, c: 'amber',
          t: `You average ${avgLead.toFixed(1)} boiler lead${avgLead >= 2 ? 's' : ''} per week — none logged yet this week` });
      } else if (weekLeadCount > 0) {
        cands.push({ p: 3, c: 'green',
          t: `${weekLeadCount} boiler lead${weekLeadCount === 1 ? '' : 's'} banked this week — keep looking on visits` });
      }
    } else if (weekLeadCount === 0) {
      cands.push({ p: 3, c: 'amber',
        t: 'No boiler leads this week — keep an eye out for HI Lead opportunities on your visits' });
    } else {
      cands.push({ p: 3, c: 'green',
        t: `${weekLeadCount} boiler lead${weekLeadCount === 1 ? '' : 's'} banked this week` });
    }

    // End-of-week forecast (need 2+ worked days and days remaining)
    const wkDaysMF = weekDays(todayWk).slice(0, 5);
    const workedN  = wkDaysMF.filter(dk => dk <= todayKey && !dayIsLeave(week, dk) && ((week.days || {})[dk] || []).length > 0).length;
    const remainN  = wkDaysMF.filter(dk => dk >  todayKey && !dayIsLeave(week, dk)).length;
    if (workedN >= 2 && remainN > 0 && weekTarget > 0) {
      const proj    = weekEarned + (weekEarned / workedN) * remainN;
      const projGap = proj - weekTarget;
      cands.push({ p: 2, c: projGap >= 0 ? 'green' : 'amber',
        t: projGap >= 0
          ? `On current pace you're heading for ~${proj.toFixed(2)}h — ${projGap.toFixed(2)}h above target`
          : `On current pace you'll end up around ${proj.toFixed(2)}h — ${Math.abs(projGap).toFixed(2)}h short of target` });
    }

    // Consecutive days hitting daily target this week
    let streak = 0;
    for (const dk of wkDaysMF) {
      if (dk > todayKey) break;
      if (dayIsLeave(week, dk)) continue;
      const dt      = getDailyTarget(state, week, dk);
      if (dt <= 0) continue;
      const dayJobs = (week.days || {})[dk] || [];
      if (dk === todayKey && dayJobs.length === 0) continue; // today not yet started
      const dh = dayJobs.reduce((s, j) => s + j.creditMins, 0) / 60;
      if (dh >= dt) { streak++; } else { streak = 0; }
    }
    if (streak >= 2) {
      cands.push({ p: 2, c: 'green',
        t: `${streak} days in a row hitting daily target this week` });
    }
  }

  // ── P3: Pattern insights (3+ completed weeks) ─────────────────────────
  if (nPast >= 3) {
    const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Strongest weekday historically
    const dayAvgs = [0, 1, 2, 3, 4].map(i => {
      let total = 0, count = 0;
      pastWks.forEach(wk => {
        const dk   = weekDays(wk)[i];
        const w    = state.weeks[wk];
        if (dayIsLeave(w, dk)) return;
        const jobs = (w.days || {})[dk] || [];
        if (jobs.length === 0) return;
        total += jobs.reduce((s, j) => s + j.creditMins, 0) / 60;
        count++;
      });
      return count >= 2 ? total / count : null;
    });
    const bestIdx = dayAvgs.reduce((b, a, i) => a !== null && (b === -1 || a > dayAvgs[b]) ? i : b, -1);
    if (bestIdx >= 0) {
      const todayDow = isCurrentWeek ? (new Date().getDay() + 6) % 7 : -1;
      if (todayDow === bestIdx) {
        cands.push({ p: 3, c: 'green',
          t: `${DAY_NAMES[bestIdx]} is your strongest day on average — you typically log ${dayAvgs[bestIdx].toFixed(2)}h. Make it count.` });
      } else {
        cands.push({ p: 4, c: 'green',
          t: `Your strongest day is usually ${DAY_NAMES[bestIdx]} — you average ${dayAvgs[bestIdx].toFixed(2)}h on that day` });
      }
    }

    // NPT this week vs recent average
    if (isCurrentWeek) {
      const weekNPTH = (week.deductionLog || []).reduce((s, d) => s + d.mins, 0) / 60;
      const avgNPTH  = pastWks.reduce((s, wk) => s + (state.weeks[wk].deductionLog || []).reduce((ds, d) => ds + d.mins, 0), 0) / nPast / 60;
      if (avgNPTH > 0.1) {
        if (weekNPTH > avgNPTH * 1.3) {
          cands.push({ p: 3, c: 'red',
            t: `NPT this week (${weekNPTH.toFixed(1)}h) is above your recent average of ${avgNPTH.toFixed(1)}h — watch the deductions` });
        } else if (weekNPTH < avgNPTH * 0.5) {
          cands.push({ p: 4, c: 'green',
            t: `NPT this week (${weekNPTH.toFixed(1)}h) is well below your recent average of ${avgNPTH.toFixed(1)}h — clean week` });
        }
      }
    }

    // Bonus hit rate (last 10 or all past weeks)
    const rateWks = pastWks.slice(-10);
    const hits    = rateWks.filter(wk => bonusAchieved(state, state.weeks[wk])).length;
    if (rateWks.length >= 3) {
      const rate = hits / rateWks.length;
      if (rate >= 0.8) {
        cands.push({ p: 4, c: 'green',
          t: `Hit target in ${hits} of the last ${rateWks.length} weeks — strong consistency` });
      } else if (rate < 0.5) {
        cands.push({ p: 3, c: 'red',
          t: `Hit target in only ${hits} of the last ${rateWks.length} weeks — worth looking at what's pulling the average down` });
      } else {
        cands.push({ p: 4, c: 'amber',
          t: `Hit target in ${hits} of the last ${rateWks.length} weeks` });
      }
    }
  }

  // ── P4: Long-term trends (4+ completed weeks) ─────────────────────────
  if (nPast >= 4) {
    // CTAP trajectory over last 6 non-excluded weeks
    const last6     = pastWks.slice(-6).filter(wk => !state.weeks[wk].excludeFromCtap);
    if (last6.length >= 4) {
      const change = last6.reduce((s, wk) => s + weekCreditHours(state.weeks[wk]) - adjustedTargetHours(state, state.weeks[wk]), 0);
      if (Math.abs(change) >= 0.2) {
        cands.push({ p: 4, c: change >= 0 ? 'green' : 'red',
          t: `CTAP has ${change >= 0 ? 'improved by +' : 'dropped by '}${Math.abs(change).toFixed(2)}h over the last ${last6.length} weeks` });
      }
    }

    // Personal 8-week average comparison (current week, extrapolated)
    if (isCurrentWeek) {
      const last8  = pastWks.slice(-8);
      const avg8   = last8.reduce((s, wk) => s + weekCreditHours(state.weeks[wk]), 0) / last8.length;
      const wkDaysMF = weekDays(todayWk).slice(0, 5);
      const workedN  = wkDaysMF.filter(dk => dk <= todayKey && !dayIsLeave(week, dk) && ((week.days || {})[dk] || []).length > 0).length;
      if (workedN >= 1) {
        const projFull = (weekEarned / workedN) * 5;
        const diff     = projFull - avg8;
        if (Math.abs(diff) >= 0.3) {
          cands.push({ p: 4, c: diff >= 0 ? 'green' : 'amber',
            t: `Tracking ${Math.abs(diff).toFixed(2)}h ${diff >= 0 ? 'above' : 'below'} your ${last8.length}-week average of ${avg8.toFixed(2)}h` });
        }
      }
    }

    // Last 4 weeks consistency
    const last4       = pastWks.slice(-4);
    const avg4earned  = last4.reduce((s, wk) => s + weekCreditHours(state.weeks[wk]), 0) / 4;
    const avg4target  = last4.reduce((s, wk) => s + adjustedTargetHours(state, state.weeks[wk]), 0) / 4;
    const avgGap      = avg4earned - avg4target;
    if (avgGap >= -0.6 && avgGap < -0.05) {
      cands.push({ p: 4, c: 'amber',
        t: `Your last 4 weeks have averaged ${avg4earned.toFixed(2)}h — just ${Math.abs(avgGap).toFixed(2)}h below target each time` });
    } else if (avgGap >= 0.5) {
      cands.push({ p: 4, c: 'green',
        t: `Your last 4 weeks have averaged ${avg4earned.toFixed(2)}h — consistently above target` });
    }
  }

  // Performance Factor (lowest priority, informational)
  if (isCurrentWeek && todayPFMins != null) {
    cands.push({ p: 5, c: 'amber', t: `Estimated Performance Factor today: ~${todayPFMins} min`, pf: true });
  }

  // Sort by priority, take top 4
  cands.sort((a, b) => a.p - b.p);
  const tips = cands.slice(0, 4);

  if (tips.length === 0) {
    tips.push({ p: 5, c: 'green', t: 'Log some jobs to see insights here' });
  }

  return `
    <details class="insights-details">
      <summary class="insights-summary">
        <span>Insights</span>
        <span class="insights-count">${tips.length} shown</span>
      </summary>
      <div class="insights-scroll">
        ${tips.map(tip => `<div class="tip-row${tip.pf ? ' tip-row-pf' : ''}"><span class="tip-dot ${tip.c}"></span><span class="tip-text">${tip.t}</span></div>`).join('')}
      </div>
    </details>`;
}

// ── Ticker Strip ───────────────────────────────────────────────────────────
function buildTickerStrip() {
  const todayKey = getTodayKey();
  const todayWk  = getWeekKey(new Date());
  const week     = state.weeks[todayWk] || { days: {}, shifts: {} };
  const items    = [];

  const isoWkNum = (function() {
    const d = new Date(); d.setHours(0,0,0,0);
    const dow = d.getDay();
    const thu = new Date(d); thu.setDate(d.getDate() + 3 - (dow + 6) % 7);
    const w1  = new Date(thu.getFullYear(), 0, 4);
    return 1 + Math.round(((thu - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  })();

  const earned  = weekCreditHours(week);
  const target  = adjustedTargetHours(state, week);
  const bonus   = bonusAchieved(state, week);
  const pct     = target > 0 ? (earned / target) * 100 : 0;
  const wkDays  = weekDays(todayWk);

  // ── 1. Daily target status (most actionable) ──
  const todayJobs   = (week.days || {})[todayKey] || [];
  const todayH      = todayJobs.reduce((s, j) => s + j.creditMins, 0) / 60;
  const dailyT      = getDailyTarget(state, week, todayKey);
  if (dailyT > 0) {
    if (todayH >= dailyT) {
      const over = todayH - dailyT;
      items.push(`Daily target hit ✓${over >= 0.05 ? ' · +' + over.toFixed(2) + 'h over' : ''}`);
    } else {
      const gap        = dailyT - todayH;
      const jobsNeeded = Math.ceil(gap / (56 / 60));
      items.push(`${jobsNeeded} more job${jobsNeeded === 1 ? '' : 's'} to hit daily target`);
    }
  }

  // ── 2. Time since last logged job ──
  const allFlat = Object.values(week.days || {}).flat().filter(j => j.ts);
  if (allFlat.length > 0) {
    const lastJob  = allFlat.reduce((a, b) => b.ts > a.ts ? b : a);
    const minsAgo  = Math.round((Date.now() - lastJob.ts) / 60000);
    if (minsAgo < 600) {
      const shortName = lastJob.name.replace(/\s*[\(\–\-].*$/, '').trim();
      const timeStr   = minsAgo < 60
        ? `${minsAgo}m ago`
        : `${Math.floor(minsAgo / 60)}h ${String(minsAgo % 60).padStart(2, '0')}m ago`;
      items.push(`Last: ${shortName} · ${timeStr}`);
    }
  }

  // ── 3. WK number + weekly status ──
  const bonusTxt = bonus ? 'Bonus ✓' : pct >= 80 ? 'On track' : 'Behind';
  items.push(`WK ${isoWkNum} · ${bonusTxt}`);

  // ── 4. Hours/jobs to weekly bonus ──
  if (!bonus && target > 0) {
    const needed   = target - earned;
    const bdjobs   = Math.ceil(needed / (56 / 60));
    items.push(`${needed.toFixed(1)}h to bonus · ~${bdjobs} jobs`);
  }

  // ── 5. CTAP balance ──
  const bal = cumulativeBalance(state);
  if (Math.abs(bal) >= 0.01) {
    items.push(`CTAP ${bal >= 0 ? '+' : ''}${bal.toFixed(2)}h${bal >= 0 ? ' in credit' : ' deficit'}`);
  }

  // ── 6. Days left in working week ──
  const dayOfWk  = (new Date().getDay() + 6) % 7; // 0=Mon … 4=Fri
  const daysLeft = Math.max(0, 4 - dayOfWk);
  if (daysLeft === 0 && dayOfWk === 4) {
    items.push('Friday · Last chance for bonus');
  } else if (daysLeft > 0) {
    items.push(`${daysLeft} working day${daysLeft === 1 ? '' : 's'} left this week`);
  }

  // ── 7. Last week result ──
  const prevDate = new Date(); prevDate.setDate(prevDate.getDate() - 7);
  const prevWk   = state.weeks[getWeekKey(prevDate)];
  if (prevWk) {
    const prevGap = weekCreditHours(prevWk) - adjustedTargetHours(state, prevWk);
    items.push(prevGap >= 0
      ? `Last week: +${prevGap.toFixed(2)}h above target`
      : `Last week: ${Math.abs(prevGap).toFixed(2)}h short`);
  }

  // ── 8. Hive installs this week ──
  const hiveIds = new Set(JOB_TYPES.hive.map(j => j.id));
  let hiveCount = 0;
  Object.values(week.days || {}).forEach(dayJobs => {
    dayJobs.forEach(j => { if (hiveIds.has(j.id)) hiveCount++; });
  });
  if (hiveCount > 0) {
    items.push(`${hiveCount} Hive install${hiveCount === 1 ? '' : 's'} this week`);
  }

  // ── 9. Daily target streak ──
  let streak = 0;
  for (const dk of wkDays.slice(0, 5)) {
    if (dk > todayKey) break;
    if (dayIsLeave(week, dk)) continue;
    const dt = getDailyTarget(state, week, dk);
    if (dt <= 0) continue;
    const dh = ((week.days || {})[dk] || []).reduce((s, j) => s + j.creditMins, 0) / 60;
    if (dh >= dt) { streak++; } else { streak = 0; }
  }
  if (streak >= 2) items.push(`${streak} days hitting daily target`);

  if (items.length === 0) return '';

  const sep      = '<span class="ticker-sep">·</span>';
  const itemsHTML = items.map(t => `<span class="ticker-item">${t}</span>`).join(sep);
  const track    = itemsHTML + sep + itemsHTML + sep;
  const duration = Math.max(20, items.length * 6);

  return `
    <div class="ticker-strip">
      <div class="ticker-track" style="animation-duration:${duration}s">
        ${track}
      </div>
    </div>`;
}

function refreshTicker() {
  const wrap = document.getElementById('ticker-wrap');
  if (wrap) wrap.innerHTML = buildTickerStrip();
}

function buildDayBlock(dayKey, jobs, isToday, week) {
  const total = jobs.reduce((s, j) => s + j.creditMins, 0);
  const totalHours = total / 60;
  const isLeave = dayIsLeave(week, dayKey);
  const target = getDailyTarget(state, week, dayKey);
  const dotColour = isLeave ? 'grey' : totalHours >= target ? 'green' : 'red';
  return `
    <div class="day-section${isToday ? ' open' : ''}">
      <div class="day-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="history-dot ${dotColour}"></span>
          <span class="day-name">${dayLabel(dayKey)}${isToday ? ' <span style="color:var(--accent);font-size:0.7rem">TODAY</span>' : ''}${isLeave ? ' <span style="color:var(--amber);font-size:0.7rem">LEAVE</span>' : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="day-total" style="${isLeave ? 'color:var(--amber)' : ''}">${isLeave ? 'Annual Leave' : totalHours.toFixed(2) + 'h'}</span>
          ${!isLeave ? '<span class="day-chevron">›</span>' : ''}
        </div>
      </div>
      ${!isLeave ? `<div class="day-jobs">
        ${jobs.map((j, i) => `
          <div class="job-entry">
            <span class="job-name">${j.name}${j.variableInput ? ` <span style="color:var(--muted)">(${j.variableInput})</span>` : ''}</span>
            <span class="job-credits">+ ${(j.creditMins/60).toFixed(2)} h</span>
            <button class="del-btn" data-day="${dayKey}" data-idx="${i}" title="Remove">×</button>
          </div>`).join('')}
      </div>` : ''}
    </div>
  `;
}

// ── Recent jobs helper ─────────────────────────────────────────────────────
function getRecentJobs(n) {
  const seen = new Set();
  const result = [];
  const entries = [];
  Object.values(state.weeks).forEach(week => {
    Object.values(week.days || {}).forEach(dayJobs => {
      dayJobs.forEach(j => { if (j.id && j.ts) entries.push(j); });
    });
  });
  entries.sort((a, b) => b.ts - a.ts);
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    const job = findJob(entry.id);
    if (!job || job.isNpt) continue;
    seen.add(entry.id);
    result.push(job);
    if (result.length >= n) break;
  }
  return result;
}

// ── Log Jobs ───────────────────────────────────────────────────────────────
function buildLogJobs() {
  const jobs = JOB_TYPES[activeJobTab];
  const todayKey = getTodayKey();
  const isLoggingToday = activeLogDay === todayKey;

  // Day picker
  const logDayDate = new Date(activeLogDay + 'T00:00:00');
  const logDayLabel = isLoggingToday
    ? 'Today · ' + logDayDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : logDayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const minLogDate = new Date(); minLogDate.setDate(minLogDate.getDate() - 13);
  const atMin = activeLogDay <= localDateStr(minLogDate);
  const dayPickerHTML = `
    <div class="day-picker">
      <button id="log-prev-day" class="day-picker-btn" ${atMin ? 'disabled' : ''}>&#8249;</button>
      <span class="day-picker-label${isLoggingToday ? ' today' : ''}">${logDayLabel}</span>
      <button id="log-next-day" class="day-picker-btn" ${isLoggingToday ? 'disabled' : ''}>&#8250;</button>
    </div>`;

  // Session stats for the selected day
  const wkKey = getWeekKey(new Date(activeLogDay + 'T00:00:00'));
  const wk = state.weeks[wkKey] || { days: {} };
  const dayJobs = (wk.days || {})[activeLogDay] || [];
  const sessionHours = dayJobs.reduce((s, j) => s + j.creditMins, 0) / 60;
  const firstTs = dayJobs.length > 0 ? Math.min(...dayJobs.map(j => j.ts || Date.now())) : null;
  const sinceStr = isLoggingToday && firstTs
    ? new Date(firstTs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  const sessionBarHTML = dayJobs.length > 0 ? `
    <div class="session-bar">
      <span>${dayJobs.length} job${dayJobs.length === 1 ? '' : 's'}</span>
      ${sinceStr ? `<span>· since ${sinceStr}</span>` : ''}
      <span class="session-val">· +${sessionHours.toFixed(2)}h</span>
    </div>` : '';

  // Recently used jobs
  const recentJobs = getRecentJobs(4);
  const recentBarHTML = recentJobs.length > 0 ? `
    <div class="recent-bar">
      <span class="recent-label">Recent</span>
      <div class="recent-jobs">
        ${recentJobs.map(j => `
          <button class="recent-job-btn${j.variable ? ' variable' : ''}" data-job-id="${j.id}">
            <span class="rj-name">${j.name.replace(/\s*[\(\–\-].*$/, '').trim()}</span>
            <span class="rj-credits">${j.variable ? 'Variable' : `+${(j.minutes / 60).toFixed(2)}h`}</span>
          </button>`).join('')}
      </div>
    </div>` : '';

  const searchHTML = `
    <div class="search-wrap">
      <span class="search-icon">&#9906;</span>
      <input type="search" id="job-search" class="job-search-input"
        placeholder="Search jobs…" value="${jobSearch}"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      ${jobSearch ? `<button id="search-clear" class="search-clear-btn">&#10005;</button>` : ''}
    </div>`;

  // Search active — filter across all categories, hide tabs and recent bar
  if (jobSearch.trim()) {
    const q = jobSearch.trim().toLowerCase();
    const allJobs = [
      ...JOB_TYPES.core,
      ...JOB_TYPES.hive,
      ...JOB_TYPES.sales,
      ...JOB_TYPES.absent
    ];
    const filtered = allJobs.filter(j =>
      j.name.toLowerCase().includes(q) ||
      (j.code && j.code.toLowerCase().includes(q))
    );
    const gridHTML = filtered.length > 0
      ? filtered.map(j => `<button class="job-btn${j.variable ? ' variable' : ''}" data-job-id="${j.id}">
          ${j.code ? `<span class="jb-code">${j.code}</span>` : ''}
          <span class="jb-name">${j.name}</span>
          <span class="jb-credits">${j.variable ? 'Variable' : `+${(j.minutes / 60).toFixed(2)}h`}</span>
        </button>`).join('')
      : `<div style="grid-column:1/-1;text-align:center;padding:24px 0;font-size:0.82rem;color:var(--muted)">No jobs match "${jobSearch}"</div>`;
    return `
      ${dayPickerHTML}
      ${searchHTML}
      <div class="job-grid">${gridHTML}</div>
      ${sessionBarHTML}
    `;
  }

  return `
    ${dayPickerHTML}
    ${searchHTML}
    ${recentBarHTML}
    <div class="tab-bar">
      <button class="${activeJobTab === 'core' ? 'active' : ''}" data-jobtab="core">Core</button>
      <button class="${activeJobTab === 'hive' ? 'active' : ''}" data-jobtab="hive">Hive</button>
      <button class="${activeJobTab === 'sales' ? 'active' : ''}" data-jobtab="sales">Sales</button>
      <button class="${activeJobTab === 'absent' ? 'active' : ''}" data-jobtab="absent">Absence</button>
    </div>
    <div class="job-grid">
      ${jobs.map(j => `<button class="job-btn${j.variable ? ' variable' : ''}" data-job-id="${j.id}">
          ${j.code ? `<span class="jb-code">${j.code}</span>` : ''}
          <span class="jb-name">${j.name}</span>
          <span class="jb-credits">${j.variable ? 'Variable' : `+${(j.minutes / 60).toFixed(2)}h`}</span>
        </button>`).join('')}
    </div>
    ${sessionBarHTML}
  `;
}

// ── History ────────────────────────────────────────────────────────────────
function buildHistory() {
  const currentWk = getWeekKey(new Date());
  const weeks = Object.keys(state.weeks).filter(wk => wk <= currentWk).sort().reverse();
  if (weeks.length === 0) return '<div class="empty">No history yet</div>';

  // ── Trend chart ──
  const isoWkNum = wk => {
    const d = new Date(wk + 'T00:00:00');
    const dow = d.getDay();
    const thu = new Date(d); thu.setDate(d.getDate() + 3 - (dow + 6) % 7);
    const w1 = new Date(thu.getFullYear(), 0, 4);
    return 1 + Math.round(((thu - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  };

  const chartWeeks = weeks.filter(wk => wk < currentWk).slice(0, 8).reverse();
  let trendHTML = '';
  if (chartWeeks.length >= 1) {
    const hitCount = chartWeeks.filter(wk => bonusAchieved(state, state.weeks[wk])).length;
    const cols = chartWeeks.map(wk => {
      const week = state.weeks[wk];
      const earned = weekCreditHours(week);
      const target = adjustedTargetHours(state, week);
      const pct    = target > 0 ? (earned / target) * 100 : (earned > 0 ? 100 : 0);
      const colour = pct >= 100 ? 'green' : pct >= 80 ? 'amber' : earned === 0 ? 'grey' : 'red';
      return `
        <div class="trend-col" data-goto-week="${wk}" style="cursor:pointer">
          <div class="trend-track">
            <div class="trend-fill ${colour}" style="height:${Math.min(pct, 100).toFixed(0)}%"></div>
          </div>
          <div class="trend-wk-label">W${isoWkNum(wk)}</div>
        </div>`;
    }).join('');
    trendHTML = `
      <div class="trend-chart-wrap">
        <div class="trend-header">
          <span class="trend-title">Weekly trend</span>
          <span class="trend-stat">${hitCount} / ${chartWeeks.length} weeks bonus</span>
        </div>
        <div class="trend-chart">${cols}</div>
      </div>`;
  }

  const list = weeks.map(wk => {
    const week = state.weeks[wk];
    const earned = weekCreditHours(week);
    const target = adjustedTargetHours(state, week);
    const pct    = target > 0 ? (earned / target) * 100 : 0;
    const bonus  = bonusAchieved(state, week);
    const colour = pct >= 100 ? 'green' : pct >= 80 ? 'amber' : earned === 0 ? 'grey' : 'red';
    const isCurrent = wk === currentWeekKey;
    const isPast    = wk < currentWk;
    const excluded  = week.excludeFromCtap || false;
    return `
      <div class="history-item" data-goto-week="${wk}">
        <div class="hi-left">
          <div class="hi-week">${weekLabel(wk)}${isCurrent ? ' (current)' : ''}</div>
          <div class="hi-credits">${earned.toFixed(2)}h / ${target.toFixed(2)}h target — ${bonus ? 'Bonus ✓' : pct >= 80 ? 'Close' : 'Below target'}</div>
          ${week.note ? `<div class="hi-note">${week.note}</div>` : ''}
          ${isPast ? `<button class="ctap-toggle-btn${excluded ? ' excluded' : ''}" data-week-key="${wk}">${excluded ? '✕ Excluded from CTAP' : '✓ In CTAP'}</button>` : ''}
        </div>
        <div class="history-dot ${colour}"></div>
      </div>`;
  }).join('');

  return trendHTML + list;
}

// ── Settings ───────────────────────────────────────────────────────────────
function buildSettings() {
  const isLight = document.body.classList.contains('light');
  return `
    <div class="dashboard-card">
      <h2>Settings</h2>
      <div class="settings-group" style="margin-top:12px">
        <label>Appearance</label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="theme-btn${!isLight ? ' active' : ''}" data-theme="dark"
            style="flex:1;padding:10px;border-radius:10px;border:1.5px solid ${!isLight ? 'var(--accent)' : 'var(--sep)'};background:${!isLight ? 'var(--jcpd-accent-dim)' : 'var(--surface2)'};color:${!isLight ? 'var(--accent)' : 'var(--muted)'};font-weight:600;font-size:0.82rem;cursor:pointer">
            🌙 Dark
          </button>
          <button class="theme-btn${isLight ? ' active' : ''}" data-theme="light"
            style="flex:1;padding:10px;border-radius:10px;border:1.5px solid ${isLight ? 'var(--accent)' : 'var(--sep)'};background:${isLight ? 'var(--jcpd-accent-dim)' : 'var(--surface2)'};color:${isLight ? 'var(--accent)' : 'var(--muted)'};font-weight:600;font-size:0.82rem;cursor:pointer">
            ☀️ Light
          </button>
        </div>
      </div>
      <div class="settings-group" style="margin-top:12px">
        <label>Base weekly hours target</label>
        <div class="settings-row">
          <input type="number" id="base-hours-input" value="${state.baseHours}" min="1" max="80" step="0.5">
          <button id="save-base-hours">Save</button>
        </div>
        <p class="settings-note">Default: 40 hours. Adjust each quarter as needed. Deductions are subtracted from this to get your adjusted target.</p>
      </div>
      <div class="settings-group">
        <label>Starting CTAP balance (hours)</label>
        <div class="settings-row">
          <input type="number" id="start-bal-input" value="${state.startingBalance || 0}" step="0.5">
          <button id="save-start-bal">Save</button>
        </div>
        <p class="settings-note">Enter your accumulated balance in hours. Use a negative number if you're in deficit (e.g. -22). This is added to your weekly performance history to give your overall CTAP balance.</p>
      </div>
    </div>
    <div class="dashboard-card" style="padding:0;overflow:hidden">
      <details class="info-section">
        <summary class="info-summary">
          <span>How to use this app</span>
          <span class="info-chevron">›</span>
        </summary>
        <div class="info-body">
          <ol class="info-steps">
            <li>
              <div>
                <span class="info-step-title">Set up your schedule</span>
                Go to the <b>Schedule</b> tab and enter your shift start and end times for each day. Select your lunch break from the dropdown. Tap <b>Standard week</b> to quickly apply Mon–Fri 08:00–16:30 with 30 min lunch. Tap <b>Save Schedule</b> when done.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Log your jobs</span>
                Tap <b>Log Job</b> and choose a category. <b>Core</b> covers standard visit types such as breakdowns, annual service visits, OCA, and installs. <b>Hive</b> covers all Hive install, repair, and recall job codes. <b>Sales</b> covers boiler leads. Tap a tile to log it instantly. Tiles with a dashed border are variable — they ask for extra input (minutes or hours) before logging.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Log absences and non-visit time</span>
                Tap <b>Log Job</b> and select the <b>Absence</b> tab. Tap <b>EV Charging</b> (30 min credit), <b>Bybox Part Collection</b> (10 min), or <b>Merchant Parts Collection</b> (10 min) to log these instantly. Tap <b>Non-Productive Time</b> to enter a duration in minutes and an optional reason — this saves as a deduction against your daily target.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Track your day on the Dashboard</span>
                The Dashboard shows your CTAP balance, today's credit hours vs target, weekly progress with a day-by-day bar chart, and a full list of jobs logged today. Tap <b>×</b> next to any job to remove it. The <b>Insights</b> section gives tips on pace, Hive pipeline, CTAP recovery, and today's estimated Performance Factor.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Mark annual leave</span>
                On the <b>Schedule</b> tab, tap <b>Leave</b> next to any day. That day's hours are automatically removed from your weekly target so it does not count against you.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Understand your CTAP balance</span>
                CTAP is your running credit or deficit across completed weeks. It starts from the <b>Starting balance</b> you enter in Settings, then each completed week's surplus or shortfall is added. The balance number turns green when you are in credit and stays white when in deficit — the badge in the top-right of the tile shows <b>In credit</b> or <b>Deficit</b> at a glance.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Use the History tab</span>
                View all past weeks with a colour-coded dot. Tap any week to jump to it on the Dashboard. Each past week shows a <b>✓ In CTAP</b> button — tap it to exclude a week (such as a training week) from your balance calculation.
              </div>
            </li>
            <li>
              <div>
                <span class="info-step-title">Settings</span>
                Set your <b>base weekly hours target</b> (usually 40h — check your contract). Set your <b>starting CTAP balance</b> to reflect any balance you carry from before using this app. Use a negative number if you are in deficit, e.g. <b>-22</b>.
              </div>
            </li>
          </ol>
        </div>
      </details>
    </div>
    <div class="dashboard-card">
      <h2>About</h2>
      <p style="font-size:0.8rem;color:var(--muted);margin-top:8px;line-height:1.6">
        Credits formula: minutes ÷ 83.58<br>
        Bonus: earned credit hours ≥ adjusted target hours<br>
        Adjusted target = base hours − deductions − leave hours<br>
        <br>
        All data is stored locally on this device.
      </p>
    </div>
  `;
}

// ── Modal ──────────────────────────────────────────────────────────────────
function buildModal() {
  return `
    <div class="modal-overlay hidden" id="modal-overlay">
      <div class="modal">
        <h3 id="modal-title"></h3>
        <p id="modal-desc"></p>
        <input type="number" id="modal-input" min="1" step="1" placeholder="0">
        <input type="text" id="modal-name" placeholder="Reason (optional)" style="display:none;margin-top:10px;width:100%;background:var(--surface2);border:none;border-radius:10px;color:var(--fg);font-size:0.9rem;padding:10px 12px;outline:none;box-sizing:border-box;-webkit-appearance:none">
        <div class="modal-btns">
          <button class="btn-cancel" id="modal-cancel">Cancel</button>
          <button class="btn-confirm" id="modal-confirm">Log Job</button>
        </div>
      </div>
    </div>
  `;
}

// ── Week Forecast Sheet ────────────────────────────────────────────────────
function buildWeekForecastSheet() {
  const week = getOrCreateWeek(state, currentWeekKey);
  const todayKey = getTodayKey();
  const todayWk = getWeekKey(new Date());
  const isPastWeek = currentWeekKey < todayWk;
  const isFutureWeek = currentWeekKey > todayWk;

  const earnedHours = weekCreditHours(week);
  const targetHours = adjustedTargetHours(state, week);
  const wDays = weekDays(currentWeekKey);

  // Days with at least one job logged (past + today)
  const workedDayKeys = wDays.filter(dk => {
    const jobs = (week.days || {})[dk] || [];
    return jobs.length > 0 && (isPastWeek || dk <= todayKey);
  });

  // Remaining working days: from today (inclusive) onwards with no jobs yet
  const remainingDayKeys = isPastWeek ? [] : wDays.filter((dk, i) => {
    if (dk < todayKey) return false;
    if (dayIsLeave(week, dk)) return false;
    const hasJobs = ((week.days || {})[dk] || []).length > 0;
    if (hasJobs) return false;
    const shift = (week.shifts || {})[dk];
    return (shift && (shift.start || shift.end)) || i < 5;
  });

  const daysWorked = workedDayKeys.length;
  const daysRemaining = remainingDayKeys.length;

  const dayTotals = workedDayKeys.map(dk =>
    ((week.days || {})[dk] || []).reduce((s, j) => s + j.creditMins, 0) / 60
  );

  const dailyAvg = daysWorked > 0 ? earnedHours / daysWorked : 0;
  const bestDay  = dayTotals.length > 0 ? Math.max(...dayTotals) : 0;
  const worstDay = dayTotals.length > 0 ? Math.min(...dayTotals) : 0;

  const projected  = daysWorked > 0 ? earnedHours + dailyAvg * daysRemaining : null;
  const projGap    = projected !== null ? projected - targetHours : null;
  const bestCase   = daysWorked > 0 && daysRemaining > 0 ? earnedHours + bestDay  * daysRemaining : null;
  const worstCase  = daysWorked > 0 && daysRemaining > 0 ? earnedHours + worstDay * daysRemaining : null;
  const neededPer  = daysRemaining > 0 ? Math.max(0, targetHours - earnedHours) / daysRemaining : 0;

  const pct       = targetHours > 0 ? Math.min((earnedHours / targetHours) * 100, 100) : 0;
  const barColour = pct >= 100 ? 'green' : pct >= 80 ? 'amber' : 'red';
  const isFinalTone = isPastWeek || (!isFutureWeek && daysRemaining === 0);

  // Plain English summary
  let summary;
  if (isFinalTone) {
    const gap = earnedHours - targetHours;
    summary = gap >= 0
      ? `Week complete — finished ${gap.toFixed(2)}h above target. Bonus achieved ✓`
      : `Week complete — finished ${Math.abs(gap).toFixed(2)}h short of the ${targetHours.toFixed(1)}h target.`;
  } else if (isFutureWeek || daysWorked === 0) {
    summary = `No jobs logged yet this week. Target is ${targetHours.toFixed(1)}h.`;
  } else {
    summary = projGap >= 0
      ? `On current pace you'll finish at ~${projected.toFixed(2)}h — ${projGap.toFixed(2)}h above your ${targetHours.toFixed(1)}h target.`
      : `On current pace you'll finish at ~${projected.toFixed(2)}h — ${Math.abs(projGap).toFixed(2)}h short of your ${targetHours.toFixed(1)}h target.`;
  }

  // Needed per day notice
  let neededStr = '';
  if (!isFinalTone && !isFutureWeek && daysRemaining > 0) {
    neededStr = earnedHours >= targetHours
      ? 'Target already reached — bonus secured!'
      : `${neededPer.toFixed(2)}h average per remaining day to hit your ${targetHours.toFixed(1)}h target`;
  }

  // Insights for current week only
  let insightsHTML = '';
  if (currentWeekKey === todayWk) {
    const todayDedMins = (week.deductionLog || []).filter(d => d.date === todayKey).reduce((s, d) => s + d.mins, 0);
    const todayJobs = (week.days || {})[todayKey] || [];
    const todayHrs  = todayJobs.reduce((s, j) => s + j.creditMins, 0) / 60;
    const dailyTgt  = Math.max(0, getDailyTarget(state, week, todayKey) - todayDedMins / 60);
    const shiftHrs  = shiftHours((week.shifts || {})[todayKey]);
    const rawOut    = Math.max(0, (shiftHrs !== null ? shiftHrs : state.baseHours / 5) - todayDedMins / 60);
    const pfMins    = Math.min(40, Math.round(rawOut * 0.085 * 60));
    insightsHTML = buildInsightsCard(dailyTgt, todayHrs, targetHours, earnedHours, pfMins);
  }

  return `
    <div class="forecast-sheet hidden" id="forecast-sheet">
      <div class="forecast-backdrop" id="forecast-backdrop"></div>
      <div class="forecast-panel">
        <div class="forecast-handle"></div>
        <div class="forecast-header">
          <span class="forecast-title">Weekly Forecast</span>
          <button class="forecast-close" id="forecast-close">✕</button>
        </div>
        <div class="forecast-body">

          <div class="forecast-prog-row">
            <span class="forecast-prog-label">Credits earned</span>
            <span class="forecast-prog-val">${earnedHours.toFixed(2)}h <span class="forecast-prog-of">of ${targetHours.toFixed(1)}h</span></span>
          </div>
          <div class="progress-bar" style="margin:7px 0 4px">
            <div class="progress-bar-fill ${barColour}" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <div style="font-size:0.62rem;color:var(--muted);text-align:right;margin-bottom:14px">${Math.round(pct)}% of target</div>

          <div class="forecast-summary-box">
            <div class="forecast-summary-text">${summary}</div>
          </div>

          ${!isFutureWeek && daysWorked > 0 ? `
          <div class="forecast-stats">
            ${projected !== null ? `<div class="forecast-stat">
              <div class="forecast-stat-label">Projected</div>
              <div class="forecast-stat-val ${projGap >= 0 ? 'green' : 'red'}">${projected.toFixed(2)}h</div>
            </div>` : ''}
            <div class="forecast-stat">
              <div class="forecast-stat-label">Daily avg</div>
              <div class="forecast-stat-val">${dailyAvg.toFixed(2)}h</div>
            </div>
            <div class="forecast-stat">
              <div class="forecast-stat-label">Days worked</div>
              <div class="forecast-stat-val">${daysWorked}</div>
            </div>
            ${!isPastWeek ? `<div class="forecast-stat">
              <div class="forecast-stat-label">Days left</div>
              <div class="forecast-stat-val">${daysRemaining}</div>
            </div>` : ''}
          </div>` : ''}

          ${neededStr ? `<div class="forecast-needed"><span class="forecast-needed-arrow">→</span>${neededStr}</div>` : ''}

          ${bestCase !== null && worstCase !== null ? `
          <div class="forecast-range">
            <div class="forecast-range-label">Best / worst case</div>
            <div class="forecast-range-vals">
              <span class="forecast-range-best">${bestCase.toFixed(2)}h</span>
              <span class="forecast-range-sep"> – </span>
              <span class="forecast-range-worst">${worstCase.toFixed(2)}h</span>
            </div>
            <div class="forecast-range-note">Best day ${bestDay.toFixed(2)}h · Worst day ${worstDay.toFixed(2)}h</div>
          </div>` : ''}

          ${insightsHTML ? `<div style="margin-top:4px">${insightsHTML}</div>` : ''}

        </div>
      </div>
    </div>
  `;
}

function openForecastSheet() {
  document.getElementById('forecast-sheet').classList.remove('hidden');
}

function closeForecastSheet() {
  document.getElementById('forecast-sheet').classList.add('hidden');
}

// ── Week Summary Sheet ─────────────────────────────────────────────────────
function buildWeekSummarySheet() {
  const emptySheet = '<div class="week-summary-sheet hidden" id="week-summary-sheet"><div class="forecast-backdrop" id="summary-backdrop"></div><div class="forecast-panel"></div></div>';
  if (!weekSummaryKey) return emptySheet;
  const week = state.weeks[weekSummaryKey];
  if (!week) return emptySheet;

  const wk = weekSummaryKey;
  const earned = weekCreditHours(week);
  const target = adjustedTargetHours(state, week);
  const bonus = bonusAchieved(state, week);
  const gap = earned - target;
  const pct = target > 0 ? Math.min((earned / target) * 100, 100) : 0;
  const barColour = pct >= 100 ? 'green' : pct >= 80 ? 'amber' : 'red';

  // Best single day
  const wkDays = weekDays(wk);
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let bestDayHours = 0, bestDayName = '—';
  wkDays.forEach((dk, i) => {
    const jobs = (week.days || {})[dk] || [];
    const dh = jobs.reduce((s, j) => s + j.creditMins, 0) / 60;
    if (dh > bestDayHours) { bestDayHours = dh; bestDayName = DAY_NAMES[i]; }
  });

  // Category breakdown
  const coreIds = new Set(JOB_TYPES.core.map(j => j.id));
  const hiveIds = new Set(JOB_TYPES.hive.map(j => j.id));
  const salesIds = new Set(JOB_TYPES.sales.map(j => j.id));
  let coreCount = 0, hiveCount = 0, salesCount = 0, absenceCount = 0;
  Object.values(week.days || {}).forEach(dayJobs => {
    dayJobs.forEach(j => {
      if (coreIds.has(j.id)) coreCount++;
      else if (hiveIds.has(j.id)) hiveCount++;
      else if (salesIds.has(j.id)) salesCount++;
      else absenceCount++;
    });
  });
  absenceCount += (week.deductionLog || []).length;

  // CTAP impact
  const ctapImpact = week.excludeFromCtap ? null : gap;
  const ctapStr = ctapImpact === null
    ? 'Excluded'
    : (ctapImpact >= 0 ? '+' : '') + ctapImpact.toFixed(2) + 'h';
  const ctapColour = ctapImpact === null ? '' : ctapImpact >= 0 ? 'green' : 'red';
  const ctapStyle = ctapImpact === null ? ' style="color:var(--muted)"' : '';

  // All jobs for stats
  let allJobs = [];
  const dayJobCounts = {};
  wkDays.forEach(dk => {
    const jobs = (week.days || {})[dk] || [];
    allJobs = allJobs.concat(jobs);
    dayJobCounts[dk] = jobs.length;
  });
  const totalJobCount = allJobs.length;

  // Streak — walk backwards through past weeks counting consecutive hits/misses
  const todayWk = getWeekKey(new Date());
  const allPastWkKeys = Object.keys(state.weeks).filter(w => w < todayWk).sort();
  const wkIdx = allPastWkKeys.indexOf(wk);
  let streakCount = 0;
  if (wkIdx >= 0) {
    for (let i = wkIdx; i >= 0; i--) {
      const w = state.weeks[allPastWkKeys[i]];
      if (!w || bonusAchieved(state, w) !== bonus) break;
      streakCount++;
    }
  } else {
    streakCount = 1;
  }
  const streakText = streakCount >= 2
    ? (bonus ? `${streakCount} weeks in a row hitting target` : `Missed target ${streakCount} weeks running`)
    : (bonus ? 'Bonus hit this week' : 'Missed target this week');

  // Standout stat
  const highestJobEntry = allJobs.length > 0
    ? allJobs.reduce((best, j) => j.creditMins > best.creditMins ? j : best, allJobs[0])
    : null;
  const highestJobHours = highestJobEntry ? highestJobEntry.creditMins / 60 : 0;
  const maxDayCount = Object.values(dayJobCounts).reduce((m, c) => Math.max(m, c), 0);
  const busiestDayIdx = wkDays.findIndex(dk => dayJobCounts[dk] === maxDayCount);

  let standoutText = null;
  if (highestJobHours >= 1.0 && highestJobEntry) {
    const shortName = highestJobEntry.name.replace(/\s*\(.*$/, '');
    standoutText = `Highest single job: ${shortName} — ${highestJobHours.toFixed(2)}h`;
  } else if (maxDayCount >= 5 && busiestDayIdx >= 0) {
    standoutText = `Busiest day: ${DAY_NAMES[busiestDayIdx]} with ${maxDayCount} jobs`;
  } else if (totalJobCount > 0) {
    standoutText = `${totalJobCount} job${totalJobCount === 1 ? '' : 's'} logged across the week`;
  }

  return `
    <div class="week-summary-sheet" id="week-summary-sheet">
      <div class="forecast-backdrop" id="summary-backdrop"></div>
      <div class="forecast-panel">
        <div class="forecast-handle"></div>
        <div class="forecast-header">
          <div>
            <div class="forecast-title">Week Summary</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:1px">${weekLabel(wk)}</div>
          </div>
          <button class="forecast-close" id="summary-close">✕</button>
        </div>
        <div class="forecast-body">

          <div class="wsum-status-banner ${bonus ? 'green' : 'red'}">
            <div class="wsum-status-icon">${bonus ? '✓' : '✕'}</div>
            <div>
              <div class="wsum-status-title">${bonus ? 'Bonus achieved' : 'Missed target'}</div>
              <div class="wsum-status-sub">${bonus
                ? '+' + gap.toFixed(2) + 'h above target'
                : Math.abs(gap).toFixed(2) + 'h short of target'}</div>
            </div>
          </div>

          <div class="forecast-prog-row" style="margin-top:14px">
            <span class="forecast-prog-label">Credits earned</span>
            <span class="forecast-prog-val">${earned.toFixed(2)}h <span class="forecast-prog-of">of ${target.toFixed(1)}h</span></span>
          </div>
          <div class="progress-bar" style="margin:7px 0 14px">
            <div class="progress-bar-fill ${barColour}" style="width:${pct.toFixed(1)}%"></div>
          </div>

          <div class="forecast-stats" style="margin-bottom:14px">
            <div class="forecast-stat">
              <div class="forecast-stat-label">Best day</div>
              <div class="forecast-stat-val" style="font-size:0.88rem;letter-spacing:-0.2px">${bestDayName}</div>
              <div style="font-size:0.67rem;color:var(--muted);margin-top:2px">${bestDayHours > 0 ? bestDayHours.toFixed(2) + 'h' : '—'}</div>
            </div>
            <div class="forecast-stat">
              <div class="forecast-stat-label">CTAP impact</div>
              <div class="forecast-stat-val ${ctapColour}"${ctapStyle}>${ctapStr}</div>
            </div>
            <div class="forecast-stat">
              <div class="forecast-stat-label">Total jobs</div>
              <div class="forecast-stat-val">${totalJobCount}</div>
            </div>
          </div>

          <div style="font-size:0.57rem;font-weight:700;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:8px">Jobs by Category</div>
          <div class="wsum-cats">
            <div class="wsum-cat">
              <div class="wsum-cat-count">${coreCount}</div>
              <div class="wsum-cat-label">Core</div>
            </div>
            <div class="wsum-cat">
              <div class="wsum-cat-count${hiveCount > 0 ? ' accent' : ''}">${hiveCount}</div>
              <div class="wsum-cat-label">Hive</div>
            </div>
            <div class="wsum-cat">
              <div class="wsum-cat-count${salesCount > 0 ? ' accent' : ''}">${salesCount}</div>
              <div class="wsum-cat-label">Sales</div>
            </div>
            <div class="wsum-cat">
              <div class="wsum-cat-count">${absenceCount}</div>
              <div class="wsum-cat-label">Absence</div>
            </div>
          </div>

          <div class="wsum-streak-box">
            <span class="tip-dot ${bonus ? 'green' : 'red'}" style="flex-shrink:0;margin-top:0"></span>
            <span class="wsum-streak-text">${streakText}</span>
          </div>

          ${standoutText ? `
          <div class="wsum-standout-box">
            <div class="wsum-standout-label">Standout</div>
            <div class="wsum-standout-text">${standoutText}</div>
          </div>` : ''}

        </div>
      </div>
    </div>
  `;
}

function closeWeekSummary() {
  weekSummaryKey = null;
  const el = document.getElementById('week-summary-sheet');
  if (el) el.classList.add('hidden');
}

// ── Listeners ──────────────────────────────────────────────────────────────
function attachListeners() {
  // Greeting typewriter + trailing dots (plays on open/refresh and when greeting changes)
  const greetEl = document.getElementById('greeting-text');
  if (greetEl) {
    const text = greetEl.dataset.greeting;
    if (text !== lastGreeting) {
      lastGreeting = text;
      greetEl.textContent = '';
      let i = 0;
      const timer = setInterval(() => {
        if (i < text.length) {
          greetEl.textContent += text[i++];
        } else {
          clearInterval(timer);
          // Dots roll: . .. ... . .. ... . .. ...  then settle clean
          let d = 1;
          const dotTimer = setInterval(() => {
            greetEl.textContent = text + '.'.repeat(d);
            d++;
            if (d > 3) clearInterval(dotTimer);
          }, 380);
        }
      }, 52);
    }
  }

  // Auto-refresh ticker every 60 seconds while on dashboard
  clearInterval(window._tickerTimer);
  if (activeTab === 'dashboard') {
    window._tickerTimer = setInterval(refreshTicker, 60000);
  }

  // Bottom nav
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      weekSummaryKey = null;
      activeTab = btn.dataset.tab;
      if (activeTab === 'dashboard') currentWeekKey = getWeekKey(new Date());
      if (activeTab === 'log') { activeLogDay = getTodayKey(); jobSearch = ''; }
      render();
    });
  });

  // Dashboard week navigation
  const prevBtn = document.getElementById('prev-week');
  const nextBtn = document.getElementById('next-week');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    weekSummaryKey = null;
    const d = new Date(currentWeekKey + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    currentWeekKey = getWeekKey(d);
    render();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    weekSummaryKey = null;
    const d = new Date(currentWeekKey + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const newKey = getWeekKey(d);
    if (newKey <= getWeekKey(new Date())) { currentWeekKey = newKey; render(); }
  });

  // Week note auto-save
  const weekNoteEl = document.getElementById('week-note');
  if (weekNoteEl) {
    weekNoteEl.addEventListener('blur', () => {
      const wk = getOrCreateWeek(state, currentWeekKey);
      const val = weekNoteEl.value.trim();
      if (val) { wk.note = val; } else { delete wk.note; }
      saveState(state);
    });
  }

  // Schedule inline week navigation
  const schedPrev = document.getElementById('sched-prev-week');
  const schedNext = document.getElementById('sched-next-week');
  if (schedPrev) schedPrev.addEventListener('click', () => {
    const d = new Date(currentWeekKey + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    currentWeekKey = getWeekKey(d);
    render();
  });
  if (schedNext) schedNext.addEventListener('click', () => {
    const d = new Date(currentWeekKey + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const newKey = getWeekKey(d);
    const maxFuture = new Date(); maxFuture.setDate(maxFuture.getDate() + 56);
    if (newKey <= getWeekKey(maxFuture)) { currentWeekKey = newKey; render(); }
  });

  // Log Job day picker
  const logPrevDay = document.getElementById('log-prev-day');
  const logNextDay = document.getElementById('log-next-day');
  if (logPrevDay) logPrevDay.addEventListener('click', () => {
    const d = new Date(activeLogDay + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const minDate = new Date(); minDate.setDate(minDate.getDate() - 13);
    const newKey = localDateStr(d);
    if (newKey >= localDateStr(minDate)) { activeLogDay = newKey; render(); }
  });
  if (logNextDay) logNextDay.addEventListener('click', () => {
    const d = new Date(activeLogDay + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const newKey = localDateStr(d);
    if (newKey <= getTodayKey()) { activeLogDay = newKey; render(); }
  });

  // Job search
  const searchInput = document.getElementById('job-search');
  const searchClear = document.getElementById('search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      jobSearch = searchInput.value;
      render();
      const fresh = document.getElementById('job-search');
      if (fresh) { fresh.focus(); fresh.setSelectionRange(fresh.value.length, fresh.value.length); }
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      jobSearch = '';
      render();
    });
  }

  // Job category tabs
  document.querySelectorAll('[data-jobtab]').forEach(btn => {
    btn.addEventListener('click', () => { activeJobTab = btn.dataset.jobtab; render(); });
  });

  // Job buttons
  document.querySelectorAll('[data-job-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.jobId;
      const job = findJob(id);
      if (!job) return;
      if (job.variable) {
        openModal(job);
      } else {
        btn.classList.add('logged');
        setTimeout(() => btn.classList.remove('logged'), 380);
        logJob(job, null);
      }
    });
  });

  // Collapsible day sections
  document.querySelectorAll('.day-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.day-section').classList.toggle('open');
    });
  });

  // Delete job entry
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dayKey = btn.dataset.day;
      const idx = parseInt(btn.dataset.idx, 10);
      const week = getOrCreateWeek(state, currentWeekKey);
      week.days[dayKey].splice(idx, 1);
      if (week.days[dayKey].length === 0) delete week.days[dayKey];
      saveState(state);
      render();
    });
  });

  // Delete deduction log entry
  document.querySelectorAll('.del-ded-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.dedIdx, 10);
      const week = getOrCreateWeek(state, currentWeekKey);
      if (!week.deductionLog) return;
      week.deductionLog.splice(idx, 1);
      week.deductionMins = week.deductionLog.reduce((s, d) => s + d.mins, 0);
      saveState(state);
      render();
    });
  });

  // Save deductions
  const dedInput = document.getElementById('ded-hrs');
  if (dedInput) {
    dedInput.addEventListener('focus', () => {
      dedInput.placeholder = '';
      dedInput.select();
    });
    dedInput.addEventListener('blur', () => {
      if (!dedInput.value) dedInput.placeholder = '0.00';
    });
  }
  const saveDed = document.getElementById('save-ded');
  if (saveDed) saveDed.addEventListener('click', () => {
    const hrs = parseFloat(document.getElementById('ded-hrs').value) || 0;
    if (hrs <= 0) { showToast('Enter hours first'); return; }
    const nameVal = (document.getElementById('ded-name').value || '').trim() || 'Non-productive time';
    const week = getOrCreateWeek(state, currentWeekKey);
    if (!week.deductionLog) week.deductionLog = [];
    week.deductionLog.push({ name: nameVal, mins: hrs * 60, date: getTodayKey() });
    week.deductionMins = week.deductionLog.reduce((s, d) => s + d.mins, 0);
    saveState(state);
    render();
    showToast(nameVal + ' added');
  });

  // Toggle annual leave for a day
  document.querySelectorAll('[data-action="toggle-leave"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dk = btn.dataset.day;
      const week = getOrCreateWeek(state, currentWeekKey);
      if (!week.shifts) week.shifts = {};
      if (!week.shifts[dk]) week.shifts[dk] = {};
      const s = week.shifts[dk];
      if (s.leave) {
        delete s.leave;
      } else {
        s.leave = true;
        delete s.start;
        delete s.end;
        delete s.lunch;
      }
      saveState(state);
      render();
    });
  });

  // Apply standard week (Mon–Fri 08:00–16:30, 30m lunch)
  const applyDefault = document.getElementById('apply-default');
  if (applyDefault) applyDefault.addEventListener('click', () => {
    const week = getOrCreateWeek(state, currentWeekKey);
    if (!week.shifts) week.shifts = {};
    const days = weekDays(currentWeekKey);
    days.forEach((dk, i) => {
      if (i < 5) {
        week.shifts[dk] = { start: '08:00', end: '16:30', lunch: '30' };
      }
    });
    saveState(state);
    render();
    showToast('Standard week applied');
  });

  // Save shifts (captures start, end, and lunch fields)
  const saveShifts = document.getElementById('save-shifts');
  if (saveShifts) saveShifts.addEventListener('click', () => {
    const week = getOrCreateWeek(state, currentWeekKey);
    if (!week.shifts) week.shifts = {};
    document.querySelectorAll('.shift-input').forEach(input => {
      const dk = input.dataset.day;
      const field = input.dataset.field;
      if (!week.shifts[dk]) week.shifts[dk] = {};
      week.shifts[dk][field] = input.value;
    });
    saveState(state);
    render();
    showToast('Schedule saved');
  });

  // Save starting balance
  const saveStartBal = document.getElementById('save-start-bal');
  if (saveStartBal) saveStartBal.addEventListener('click', function() {
    var v = parseFloat(document.getElementById('start-bal-input').value);
    if (isNaN(v)) return;
    state.startingBalance = v;
    saveState(state);
    render();
    showToast('Starting balance saved');
  });

  // Theme toggle
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.body.classList.toggle('light', theme === 'light');
      localStorage.setItem('jcpd_theme', theme);
      render();
    });
  });

  // Save base hours
  const saveBH = document.getElementById('save-base-hours');
  if (saveBH) saveBH.addEventListener('click', () => {
    const v = parseFloat(document.getElementById('base-hours-input').value);
    if (isNaN(v) || v <= 0) return;
    state.baseHours = v;
    saveState(state);
    render();
    showToast('Base hours updated');
  });

  // History item click → navigate to that week; show summary for past weeks
  document.querySelectorAll('[data-goto-week]').forEach(el => {
    el.addEventListener('click', () => {
      const wk = el.dataset.gotoWeek;
      currentWeekKey = wk;
      activeTab = 'dashboard';
      weekSummaryKey = wk < getWeekKey(new Date()) ? wk : null;
      render();
    });
  });

  // CTAP exclude toggle per past week
  document.querySelectorAll('.ctap-toggle-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wk = btn.dataset.weekKey;
      if (state.weeks[wk]) {
        state.weeks[wk].excludeFromCtap = !state.weeks[wk].excludeFromCtap;
        saveState(state);
        const ctapMsg = state.weeks[wk].excludeFromCtap ? 'Week excluded from CTAP' : 'Week included in CTAP';
        render();
        showToast(ctapMsg);
      }
    });
  });

  // Week tile → forecast sheet
  const weekTile = document.getElementById('week-tile');
  if (weekTile) weekTile.addEventListener('click', openForecastSheet);
  const forecastClose = document.getElementById('forecast-close');
  if (forecastClose) forecastClose.addEventListener('click', closeForecastSheet);
  const forecastBackdrop = document.getElementById('forecast-backdrop');
  if (forecastBackdrop) forecastBackdrop.addEventListener('click', closeForecastSheet);

  // Week summary sheet
  const summaryClose = document.getElementById('summary-close');
  if (summaryClose) summaryClose.addEventListener('click', closeWeekSummary);
  const summaryBackdrop = document.getElementById('summary-backdrop');
  if (summaryBackdrop) summaryBackdrop.addEventListener('click', closeWeekSummary);

  // Modal
  const overlay = document.getElementById('modal-overlay');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalInput = document.getElementById('modal-input');

  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  if (modalConfirm) modalConfirm.addEventListener('click', () => {
    const val = parseFloat(modalInput.value);
    if (!val || val <= 0) { modalInput.focus(); return; }
    const nameVal = (document.getElementById('modal-name').value || '').trim();
    logJob(pendingJob, val, nameVal);
    closeModal();
  });
  if (modalInput) {
    modalInput.addEventListener('keydown', e => { if (e.key === 'Enter') modalConfirm.click(); });
  }
}

// ── Job Logic ──────────────────────────────────────────────────────────────
function findJob(id) {
  for (const cat of Object.values(JOB_TYPES)) {
    const j = cat.find(j => j.id === id);
    if (j) return j;
  }
  return null;
}

function openModal(job) {
  pendingJob = job;
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = job.name;
  document.getElementById('modal-desc').textContent = job.variablePrompt;
  const input = document.getElementById('modal-input');
  input.placeholder = job.variableType === 'hours' ? 'e.g. 2.5' : 'e.g. 45';
  input.value = '';
  const nameField = document.getElementById('modal-name');
  nameField.value = '';
  nameField.style.display = job.isNpt ? 'block' : 'none';
  document.getElementById('modal-confirm').textContent = job.isNpt ? 'Log Absence' : 'Log Job';
  overlay.classList.remove('hidden');
  setTimeout(() => input.focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  pendingJob = null;
}

function logJob(job, variableValue, optionalName) {
  const targetDay = activeLogDay;
  const targetWeekKey = getWeekKey(new Date(targetDay + 'T00:00:00'));

  if (targetDay > getTodayKey()) {
    showToast('Cannot log to a future date');
    return;
  }

  // NPT quick-log: save as deduction, not a credit entry
  if (job.isNpt) {
    const mins = Math.round(variableValue);
    if (!mins || mins <= 0) return;
    const label = optionalName || 'Non-Productive Time';
    const week = getOrCreateWeek(state, targetWeekKey);
    if (!week.deductionLog) week.deductionLog = [];
    week.deductionLog.push({ name: label, mins, date: targetDay });
    week.deductionMins = (week.deductionMins || 0) + mins;
    saveState(state);
    showToast('NPT added — ' + mins + ' min');
    if (activeTab !== 'log') render();
    return;
  }

  let creditMins;
  let variableDisplay = null;

  if (job.variable && variableValue !== null) {
    if (job.variableType === 'hours') {
      creditMins = job.minutes * variableValue;
      variableDisplay = `${variableValue}h`;
    } else {
      creditMins = variableValue;
      variableDisplay = `${variableValue}min`;
    }
  } else {
    creditMins = job.minutes;
  }

  const entry = {
    id: job.id,
    name: job.name,
    creditMins,
    variableInput: variableDisplay,
    ts: Date.now()
  };

  const week = getOrCreateWeek(state, targetWeekKey);
  const day = getOrCreateDay(week, targetDay);
  day.push(entry);
  saveState(state);

  const displayName = job.name.replace(/\s*\(.*$/, '');
  const backfillNote = targetDay !== getTodayKey() ? ' (backdated)' : '';
  showToast(displayName + ' added' + backfillNote);
  if (activeTab === 'log') {
    // Stay on log tab, just show toast
  } else {
    render();
  }
}

// ── Utils ──────────────────────────────────────────────────────────────────
function sortedDays(week) {
  return Object.entries(week.days || {}).sort(([a], [b]) => b.localeCompare(a));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── SVG Icons ──────────────────────────────────────────────────────────────
function iconChart()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="13" width="4" height="8"/><rect x="10" y="9" width="4" height="12"/><rect x="17" y="5" width="4" height="16"/></svg>`; }
function iconPlus()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`; }
function iconCalendar() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`; }
function iconClock()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`; }
function iconGear()     { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`; }
