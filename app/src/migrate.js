import { supabase } from './supabase.js';
import { syncStateToSupabase, syncWeekJobLogs } from './db.js';

const LS_KEY = 'jct_state';

export function hasLocalData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return s && Object.keys(s.weeks || {}).length > 0;
  } catch {
    return false;
  }
}

export function readLocalState() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {
    return null;
  }
}

// Shows the migration prompt and resolves with 'migrate' | 'fresh'
export function showMigrationPrompt() {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.id = 'migration-overlay';
    el.className = 'migration-overlay';
    el.innerHTML = `
      <div class="migration-card">
        <div class="migration-icon">📦</div>
        <h2 class="migration-title">Existing data found</h2>
        <p class="migration-body">You have job history saved on this device. Would you like to import it into your new account, or start fresh?</p>
        <button class="migration-btn migration-btn-primary" id="mig-import">Import my history</button>
        <button class="migration-btn migration-btn-ghost" id="mig-fresh">Start fresh</button>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('#mig-import').addEventListener('click', () => {
      el.remove();
      resolve('migrate');
    });
    el.querySelector('#mig-fresh').addEventListener('click', () => {
      el.remove();
      resolve('fresh');
    });
  });
}

export async function migrateLocalToSupabase(user, localState) {
  // Sync profile + all week metadata
  await syncStateToSupabase(user, localState);

  // Sync job logs week by week
  for (const weekKey of Object.keys(localState.weeks || {})) {
    await syncWeekJobLogs(user, localState, weekKey);
  }

  // Mark migration complete
  await supabase
    .from('users_profile')
    .update({ migration_complete: true })
    .eq('id', user.id);
}

export async function checkAndMigrate(user, profile) {
  if (profile.migration_complete) return;
  if (!hasLocalData()) {
    // No local data — mark done so we never ask again
    await supabase.from('users_profile').update({ migration_complete: true }).eq('id', user.id);
    return;
  }

  const choice = await showMigrationPrompt();
  if (choice === 'migrate') {
    const localState = readLocalState();
    if (localState) {
      await migrateLocalToSupabase(user, localState);
    }
  } else {
    await supabase.from('users_profile').update({ migration_complete: true }).eq('id', user.id);
  }
  // Clear localStorage regardless — Supabase is now the source of truth
  localStorage.removeItem(LS_KEY);
}
