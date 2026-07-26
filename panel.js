'use strict';

(function () {
  const STORAGE_KEY = 'image-upload-records';
  const AUTH_TOKEN_KEY = 'image_panel_auth_token';
  const AUTH_EXPIRES_KEY = 'image_panel_auth_expires_at';

  const grid = document.getElementById('recordsGrid');
  const emptyState = document.getElementById('emptyState');
  const listHead = document.getElementById('listHead');
  const loginSection = document.getElementById('loginSection');
  const panelSection = document.getElementById('panelSection');
  const loginForm = document.getElementById('loginForm');
  const authError = document.getElementById('authError');

  const authCfg = window.IMAGE_PANEL_AUTH || {};

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

  function readLocalRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const records = raw ? JSON.parse(raw) : [];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function cloudinaryListUrl() {
    const cloud = authCfg.cloudName;
    const tag = authCfg.listTag || 'web-capture';
    if (!cloud) return null;
    return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/list/${encodeURIComponent(tag)}.json`;
  }

  function mapCloudinaryResource(resource) {
    const publicId = resource.public_id || '';
    const version = resource.version || '';
    const format = resource.format || 'jpg';
    const cloud = authCfg.cloudName;
    const photoUrl =
      resource.secure_url ||
      resource.url ||
      `https://res.cloudinary.com/${cloud}/image/upload/v${version}/${publicId}.${format}`;

    const ctx = resource.context?.custom || resource.context || {};
    const ua = ctx.user_agent ? decodeURIComponent(String(ctx.user_agent)) : '';

    return {
      id: resource.asset_id || publicId,
      photoUrl,
      publicId,
      uploadedAt: resource.created_at || new Date().toISOString(),
      userAgent: ua,
      latitude: ctx.latitude != null ? Number(ctx.latitude) : null,
      longitude: ctx.longitude != null ? Number(ctx.longitude) : null,
      source: 'cloudinary'
    };
  }

  async function fetchCloudinaryRecords() {
    const url = cloudinaryListUrl();
    if (!url) return { records: [], error: null };

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        return {
          records: [],
          error:
            res.status === 401 || res.status === 403 || res.status === 404
              ? 'Cloudinary resource list is disabled. In Cloudinary: Settings → Security → Restricted image types → uncheck Resource list.'
              : `Cloudinary list failed (${res.status})`
        };
      }
      const data = await res.json();
      const resources = Array.isArray(data.resources) ? data.resources : [];
      const records = resources
        .map(mapCloudinaryResource)
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      return { records, error: null };
    } catch {
      return { records: [], error: 'Could not reach Cloudinary list API.' };
    }
  }

  function mergeRecords(cloudRecords, localRecords) {
    const byId = new Map();
    cloudRecords.forEach((r) => byId.set(String(r.id), r));
    localRecords.forEach((r) => {
      const key = String(r.id || r.publicId || r.photoUrl);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, { ...r, source: 'local' });
        return;
      }
      byId.set(key, {
        ...existing,
        userAgent: existing.userAgent || r.userAgent || '',
        latitude: existing.latitude ?? r.latitude ?? null,
        longitude: existing.longitude ?? r.longitude ?? null
      });
    });
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
    );
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


  function renderRows(records) {
    return records
      .map(
        (record, index) => `
          <a class="row-link" href="response-detail.html?id=${encodeURIComponent(record.id)}">
            <img class="row-thumb" src="${escapeHtml(record.photoUrl)}" alt="Photo ${index + 1}" loading="lazy">
            <div>
              <div class="row-title">#${index + 1}</div>
              <div class="row-sub">${escapeHtml(formatDate(record.uploadedAt))}</div>
            </div>
            <div class="row-meta gps">${escapeHtml(formatLocation(record))}</div>
            <div class="row-meta device">${escapeHtml(inferDevice(record.userAgent))}</div>
            <div class="row-chevron" aria-hidden="true">›</div>
          </a>
        `
      )
      .join('');
  }

  async function render() {
    emptyState.hidden = true;
    if (listHead) listHead.hidden = true;
    grid.innerHTML = '<p class="empty">Loading photos from Cloudinary...</p>';

    const localRecords = readLocalRecords();
    const { records: cloudRecords, error } = await fetchCloudinaryRecords();
    const records = mergeRecords(cloudRecords, localRecords);

    if (!records.length) {
      grid.innerHTML = '';
      emptyState.hidden = false;
      emptyState.textContent = error
        ? error
        : 'No photos yet. Capture from the home page, then refresh this panel.';
      return;
    }

    emptyState.hidden = true;
    if (listHead) listHead.hidden = false;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 200)));
    } catch {
      /* ignore */
    }

    const warning = error
      ? `<p class="empty" style="margin-bottom:12px">${escapeHtml(error)}</p>`
      : '';
    grid.innerHTML = warning + renderRows(records);
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
