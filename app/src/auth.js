import { supabase } from './supabase.js';

export function showAuthScreen(onSuccess, options = {}) {
  const dismissable = options.dismissable || false;
  let mode = options.initialMode || 'login'; // 'login' | 'signup' | 'reset'

  const el = document.createElement('div');
  el.id = 'auth-overlay';
  el.className = 'auth-overlay';
  render();
  document.body.appendChild(el);

  function render() {
    el.innerHTML = buildAuthHTML(mode);
    attachAuthListeners();
  }

  function buildAuthHTML(m) {
    const closeBtn = dismissable
      ? `<button class="auth-close-btn" id="auth-close" aria-label="Close">✕</button>`
      : '';

    if (m === 'reset') {
      return `
        <div class="auth-card">
          ${closeBtn}
          <div class="auth-logo">
            <span class="auth-logo-title">CTAP Tracker</span>
            <span class="auth-logo-sub">Service + Repair</span>
          </div>

          <div class="auth-reset-header">Reset your password</div>
          <p class="auth-reset-sub">Enter your email and we'll send you a reset link.</p>

          <form class="auth-form" id="auth-form" novalidate>
            <div class="auth-field">
              <label class="auth-label">Email</label>
              <input class="auth-input" type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" required>
            </div>

            <div class="auth-error" id="auth-error" style="display:none"></div>
            <div class="auth-success" id="auth-success" style="display:none"></div>

            <button class="auth-submit" type="submit" id="auth-submit">Send reset link</button>
          </form>

          <button class="auth-back-link" id="auth-back">← Back to sign in</button>
        </div>
      `;
    }

    return `
      <div class="auth-card">
        ${closeBtn}
        <div class="auth-logo">
          <span class="auth-logo-title">CTAP Tracker</span>
          <span class="auth-logo-sub">Service + Repair</span>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab ${m === 'login' ? 'active' : ''}" data-mode="login">Sign in</button>
          <button class="auth-tab ${m === 'signup' ? 'active' : ''}" data-mode="signup">Create account</button>
        </div>

        <form class="auth-form" id="auth-form" novalidate>
          ${m === 'signup' ? `
          <div class="auth-field">
            <label class="auth-label">Your name</label>
            <input class="auth-input" type="text" id="auth-name" placeholder="e.g. Jake" autocomplete="name" required>
          </div>` : ''}

          <div class="auth-field">
            <label class="auth-label">Email</label>
            <input class="auth-input" type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" required>
          </div>

          <div class="auth-field">
            <label class="auth-label">Password</label>
            <input class="auth-input" type="password" id="auth-password" placeholder="${m === 'signup' ? 'Min 8 characters' : 'Your password'}" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" required>
          </div>

          <div class="auth-error" id="auth-error" style="display:none"></div>

          <button class="auth-submit" type="submit" id="auth-submit">
            ${m === 'login' ? 'Sign in' : 'Create account'}
          </button>

          ${m === 'login' ? `<button type="button" class="auth-forgot-link" id="auth-forgot">Forgot your password?</button>` : ''}
        </form>
      </div>
    `;
  }

  function attachAuthListeners() {
    const closeBtn = el.querySelector('#auth-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => el.remove());
    }

    el.querySelectorAll('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        render();
      });
    });

    const forgotBtn = el.querySelector('#auth-forgot');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        mode = 'reset';
        render();
      });
    }

    const backBtn = el.querySelector('#auth-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        mode = 'login';
        render();
      });
    }

    const form = el.querySelector('#auth-form');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const emailEl  = el.querySelector('#auth-email');
      const passEl   = el.querySelector('#auth-password');
      const nameEl   = el.querySelector('#auth-name');
      const errEl    = el.querySelector('#auth-error');
      const succEl   = el.querySelector('#auth-success');
      const submitBtn = el.querySelector('#auth-submit');

      const email    = emailEl ? emailEl.value.trim() : '';
      const password = passEl  ? passEl.value         : '';
      const name     = nameEl  ? nameEl.value.trim()  : '';

      if (errEl)  errEl.style.display  = 'none';
      if (succEl) succEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = mode === 'login' ? 'Signing in…'
        : mode === 'signup' ? 'Creating account…'
        : 'Sending…';

      try {
        if (mode === 'reset') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/'
          });
          if (error) throw error;
          if (succEl) {
            succEl.textContent = 'Check your email for a password reset link.';
            succEl.style.display = 'block';
          }
          if (emailEl) emailEl.value = '';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send reset link';
          return;
        }

        if (mode === 'login') {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          el.remove();
          onSuccess(data.user, null, null);
        } else {
          if (password.length < 8) throw new Error('Password must be at least 8 characters.');
          if (!name) throw new Error('Please enter your name.');
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          if (!data.session) {
            throw new Error('An account with this email already exists. Please log in instead.');
          }
          el.remove();
          onSuccess(data.user, name, name);
        }
      } catch (err) {
        let msg = err.message || 'Something went wrong. Please try again.';
        if (msg === 'User already registered' || err.code === 'user_already_exists') {
          msg = 'An account with this email already exists. Please log in instead.';
        }
        if (errEl) {
          errEl.textContent = msg;
          errEl.style.display = 'block';
        }
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? 'Sign in'
          : mode === 'signup' ? 'Create account'
          : 'Send reset link';
      }
    });
  }
}

export function hideAuthScreen() {
  const el = document.getElementById('auth-overlay');
  if (el) el.remove();
}
