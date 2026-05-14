import { supabase } from './supabase.js';
import { ensureProfile, loadStateFromSupabase, syncStateToSupabase, syncWeekJobLogs, syncWeekMeta, updateProfileField } from './db.js';
import { checkAndMigrate } from './migrate.js';
import { showAuthScreen } from './auth.js';

let _currentUser = null;
let _syncTimer = null;
let _saveStatePatched = false;
const SYNC_DEBOUNCE = 2500;

// ── Loading overlay ────────────────────────────────────────────────────────

function showLoading(msg) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="loading-spinner"></div><div class="loading-msg">${msg || 'Loading…'}</div>`;
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.remove();
}

// ── Offline banner ─────────────────────────────────────────────────────────

function setupOfflineHandling() {
  function update() {
    let banner = document.getElementById('offline-banner');
    if (!navigator.onLine) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'offline-banner';
        banner.textContent = "You're offline — data will sync when you reconnect.";
        document.body.appendChild(banner);
      }
      if (window.__ctapSetOffline) window.__ctapSetOffline(true);
    } else {
      if (banner) banner.remove();
      if (window.__ctapSetOffline) window.__ctapSetOffline(false);
      if (_currentUser && window.__ctapGetState) {
        syncStateToSupabase(_currentUser, window.__ctapGetState()).catch(console.error);
      }
    }
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ── Debounced state sync (idempotent — safe to call in guest mode) ─────────

function patchSaveState() {
  if (_saveStatePatched) return;
  _saveStatePatched = true;
  const origSave = window.saveState;
  window.saveState = function(s) {
    origSave(s);
    if (!navigator.onLine || !_currentUser) return; // guest: localStorage only
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        await syncStateToSupabase(_currentUser, s);
      } catch (e) {
        console.warn('Supabase sync failed:', e.message);
      }
    }, SYNC_DEBOUNCE);
  };
}

// ── Exposed bridge functions ───────────────────────────────────────────────

window.__ctapSyncWeek = async function(weekKey) {
  if (!navigator.onLine || !_currentUser || !window.__ctapGetState) return;
  try {
    const s = window.__ctapGetState();
    await syncWeekMeta(_currentUser, s, weekKey);
    await syncWeekJobLogs(_currentUser, s, weekKey);
  } catch (e) {
    console.warn('Week sync failed:', e.message);
  }
};

window.__ctapSignOut = async function() {
  await supabase.auth.signOut();
  _currentUser = null;
  if (window.__ctapOnSignOut) window.__ctapOnSignOut();
};

window.__ctapSyncProfile = async function(fields) {
  if (!navigator.onLine || !_currentUser) return;
  try {
    await updateProfileField(_currentUser.id, fields);
  } catch (e) {
    console.warn('Profile sync failed:', e.message);
  }
};

// Show auth overlay from Settings (dismissable, optional initial mode)
window.__ctapShowAuth = function(initialMode) {
  showAuthScreen(async (user, _unused, name) => {
    _currentUser = user;
    showLoading('Signing in…');
    try {
      const profile = await ensureProfile(user, name || '');
      await checkAndMigrate(user, profile);
      const { state } = await loadStateFromSupabase(user);
      hideLoading();
      window.__ctapInit(state, profile, user);
    } catch (e) {
      hideLoading();
      console.error('Login failed:', e);
      if (window.__ctapOnSignOut) window.__ctapOnSignOut(); // revert to guest view
    }
  }, { dismissable: true, initialMode: initialMode || 'login' });
};

// ── Boot paths ─────────────────────────────────────────────────────────────

async function bootApp(user, displayName) {
  _currentUser = user;
  showLoading('Loading your data…');
  try {
    const profile = await ensureProfile(user, displayName || '');
    await checkAndMigrate(user, profile);
    const { state } = await loadStateFromSupabase(user);
    hideLoading();
    patchSaveState();
    setupOfflineHandling();
    window.__ctapInit(state, profile, user);
  } catch (e) {
    hideLoading();
    document.getElementById('app').innerHTML = `
      <div style="padding:24px;color:#ef4444;background:#1e293b;margin:16px;border-radius:12px;font-family:monospace;font-size:13px">
        <b>Failed to load data</b><br>${e.message}<br><br>
        <button onclick="location.reload()" style="padding:8px 16px;background:#334155;color:#fff;border:none;border-radius:6px;cursor:pointer">Retry</button>
      </div>`;
  }
}

function bootGuest() {
  // State already loaded from localStorage by app.js at startup
  const localState = window.__ctapGetState ? window.__ctapGetState() : null;
  patchSaveState(); // safe — skips Supabase sync when _currentUser is null
  setupOfflineHandling();
  window.__ctapInit(localState, null, null);
}

// ── Session check + entry point ────────────────────────────────────────────

async function init() {
  showLoading('Starting up…');
  try {
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw sessErr;
    hideLoading();

    if (session) {
      await bootApp(session.user);
    } else {
      bootGuest();
    }

    // Handle sign-out and session expiry — go to guest mode, not auth screen
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        _currentUser = null;
        if (window.__ctapOnSignOut) window.__ctapOnSignOut();
      }
    });
  } catch (e) {
    hideLoading();
    document.getElementById('app').innerHTML = `
      <div style="padding:24px;color:#ef4444;background:#1e293b;margin:16px;border-radius:12px;font-family:monospace;font-size:13px">
        <b>Startup error</b><br>${e.message}<br><br>
        <button onclick="location.reload()" style="padding:8px 16px;background:#334155;color:#fff;border:none;border-radius:6px;cursor:pointer">Retry</button>
      </div>`;
  }
}

init();
