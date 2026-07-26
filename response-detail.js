(function () {
  'use strict';

  const STORAGE_KEY = 'image-upload-records';
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('id');

  function readRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const records = raw ? JSON.parse(raw) : [];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderNotFound() {
    document.getElementById('notFound').hidden = false;
    document.getElementById('content').hidden = true;
  }

  function renderRecord(record) {
    document.getElementById('content').hidden = false;
    document.getElementById('notFound').hidden = true;
    document.getElementById('recordMeta').textContent = formatDate(record.uploadedAt);
    document.getElementById('photo').src = record.photoUrl || '';
    document.getElementById('gpsValue').textContent =
      record.latitude == null || record.longitude == null
        ? 'GPS not available'
        : `${Number(record.latitude).toFixed(6)}, ${Number(record.longitude).toFixed(6)}`;

    const mapValue = document.getElementById('mapValue');
    if (record.latitude == null || record.longitude == null) {
      mapValue.textContent = 'Map link not available';
    } else {
      mapValue.innerHTML = `<a href="https://www.google.com/maps?q=${encodeURIComponent(record.latitude)},${encodeURIComponent(record.longitude)}" target="_blank" rel="noopener noreferrer">${escapeHtml(`${record.latitude}, ${record.longitude}`)}</a>`;
    }

    document.getElementById('uaValue').textContent = record.userAgent || 'Unknown';
  }

  const record = readRecords().find((item) => String(item.id) === String(recordId));
  if (!record) renderNotFound();
  else renderRecord(record);
})();
