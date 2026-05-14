import { supabase } from './supabase.js';
import { ensureProfile, loadStateFromSupabase, syncStateToSupabase, syncWeekJobLogs, syncWeekMeta, updateProfileField } from './db.js'; // updateProfileField used by window.__ctapSyncProfile
import { checkAndMigrate } from './migrate.js';
import { showAuthScreen } from './auth.js';

let _currentUser = null;
let _syncTimer = null;
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
      // Notify app to disable Log Job tab
      if (window.__ctapSetOffline) window.__ctapSetOffline(true);
    } else {
      if (banner) banner.remove();
      if (window.__ctapSetOffline) window.__ctapSetOffline(false);
      // Flush pending sync
      if (_currentUser && window.__ctapGetState) {
        syncStateToSupabase(_currentUser, window.__ctapGetState()).catch(console.error);
      }
    }
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ── Debounced state sync ───────────────────────────────────────────────────

function patchSaveState() {
  const origSave = window.saveState;
  window.saveState = function(s) {
    // Always write to localStorage as a fast local cache
    origSave(s);
    // Debounced sync to Supabase
    if (!navigator.onLine || !_currentUser) return;
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

// Expose for immediate week-job sync (called after job log/delete)
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

// Expose sign-out for the Settings button
window.__ctapSignOut = async function() {
  await supabase.auth.signOut();
  _currentUser = null;
};

// Expose for profile field sync (theme, coach mode, etc.)
window.__ctapSyncProfile = async function(fields) {
  if (!navigator.onLine || !_currentUser) return;
  try {
    await updateProfileField(_currentUser.id, fields);
  } catch (e) {
    console.warn('Profile sync failed:', e.message);
  }
};

// ── Boot ───────────────────────────────────────────────────────────────────

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

    // Hand off to app.js
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

// ── Session check + entry point ────────────────────────────────────────────

async function init() {
  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    await bootApp(session.user);
  } else {
    showAuthScreen(async (user, _unused, name) => {
      // name is the display name from the signup form (null on login)
      await bootApp(user, name || '');
    });
  }

  // Listen for auth state changes (sign out, session expiry)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      _currentUser = null;
      showAuthScreen(async (user, _unused, name) => {
        await bootApp(user, name || '');
      });
    }
  });
}

init();
