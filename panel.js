'use strict';

(function () {
  const STORAGE_KEY = 'image-upload-records';
  const AUTH_TOKEN_KEY = 'image_panel_auth_token';
  const AUTH_EXPIRES_KEY = 'image_panel_auth_expires_at';

  const grid = document.getElementById('recordsGrid');
  const emptyState = document.getElementById('emptyState');
  const loginSection = document.getElementById('loginSection');
  const panelSection = document.getElementById('panelSection');
  const loginForm = document.getElementById('loginForm');
  const authError = document.getElementById('authError');

  const authCfg = window.IMAGE_PANEL_AUTH || {};

  function readRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const records = raw ? JSON.parse(raw) : [];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return value || '-';
    }
  }

  function formatLocation(record) {
    if (record.latitude == null || record.longitude == null) return 'GPS n/a';
    return `${Number(record.latitude).toFixed(4)}, ${Number(record.longitude).toFixed(4)}`;
  }

  function inferDevice(userAgent) {
    const ua = String(userAgent || '');
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function isLocalAuth() {
    return (
      authCfg.mode === 'local' &&
      typeof authCfg.email === 'string' &&
      authCfg.email.includes('@') &&
      typeof authCfg.password === 'string' &&
      authCfg.password.length > 0
    );
  }

  function isSupabaseConfigured() {
    return (
      typeof authCfg.supabaseUrl === 'string' &&
      authCfg.supabaseUrl.startsWith('https://') &&
      typeof authCfg.supabaseAnonKey === 'string' &&
      authCfg.supabaseAnonKey.length > 10 &&
      !authCfg.supabaseAnonKey.includes('YOUR_SUPABASE')
    );
  }

  function isAuthConfigured() {
    return isLocalAuth() || isSupabaseConfigured();
  }

  function isLoggedIn() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const exp = Number(localStorage.getItem(AUTH_EXPIRES_KEY) || 0);
      if (!token || !exp || Date.now() > exp) return false;
      return true;
    } catch {
      return false;
    }
  }

  function saveSession(accessToken, expiresIn) {
    const ttl = Math.max((expiresIn || 3600) - 60, 60) * 1000;
    const exp = Date.now() + ttl;
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(AUTH_EXPIRES_KEY, String(exp));
  }

  function loginLocal(email, password) {
    const ok =
      email.trim().toLowerCase() === String(authCfg.email).trim().toLowerCase() &&
      password === String(authCfg.password);

    if (!ok) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    return {
      access_token: `local-${Date.now()}`,
      expires_in: 60 * 60 * 24 * 7
    };
  }

  async function loginWithSupabase(email, password) {
    const url = `${authCfg.supabaseUrl}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: authCfg.supabaseAnonKey,
        Authorization: `Bearer ${authCfg.supabaseAnonKey}`
      },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const body = await res.text();
      let msg = body;
      try {
        const data = JSON.parse(body);
        msg = data?.msg || data?.message || data?.error_description || body;
      } catch {
        /* ignore */
      }
      const err = new Error(msg || 'Login failed');
      err.status = res.status;
      throw err;
    }

    return res.json();
  }

  function showPanel() {
    loginSection.hidden = true;
    panelSection.hidden = false;
    render();
  }

  function showLogin(message) {
    panelSection.hidden = true;
    loginSection.hidden = false;
    if (message) {
      authError.textContent = message;
      authError.hidden = false;
    } else {
      authError.hidden = true;
    }
  }

  function render() {
    const records = readRecords();
    if (!records.length) {
      emptyState.hidden = false;
      grid.innerHTML = '';
      return;
    }

    emptyState.hidden = true;
    grid.innerHTML = records
      .map(
        (record, index) => `
          <a class="card" href="response-detail.html?id=${encodeURIComponent(record.id)}">
            <div class="thumb-wrap">
              <img class="thumb" src="${escapeHtml(record.photoUrl)}" alt="Photo ${index + 1}" loading="lazy">
            </div>
            <div class="content">
              <h2 class="title">#${index + 1}</h2>
              <span class="meta">${escapeHtml(formatDate(record.uploadedAt))}</span>
              <span class="meta">GPS: ${escapeHtml(formatLocation(record))}</span>
              <span class="meta">${escapeHtml(inferDevice(record.userAgent))}</span>
            </div>
          </a>
        `
      )
      .join('');
  }

  if (!isAuthConfigured()) {
    showPanel();
  } else if (isLoggedIn()) {
    showPanel();
  } else {
    showLogin();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const email = form.email.value;
      const password = form.password.value;

      authError.hidden = true;
      authError.textContent = '';

      if (!isAuthConfigured()) {
        authError.hidden = false;
        authError.textContent = 'Auth is not configured in panel-config.js';
        return;
      }

      try {
        const session = isLocalAuth()
          ? loginLocal(email, password)
          : await loginWithSupabase(email, password);
        saveSession(session.access_token, session.expires_in);
        showPanel();
      } catch (err) {
        authError.hidden = false;
        authError.textContent =
          err.status === 401 || err.status === 403
            ? 'Invalid email or password'
            : (err.message || 'Login failed');
      }
    });
  }
})();
