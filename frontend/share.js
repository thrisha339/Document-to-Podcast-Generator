'use strict';

function openShare() {
  if (!S.shareId) return;
  const url = window.location.origin + window.location.pathname + '#/share/' + S.shareId;
  document.getElementById('share-url').value = url;
  document.getElementById('share-modal').style.display = 'flex';
}

function copyShare() {
  const inp = document.getElementById('share-url');
  inp.select();
  navigator.clipboard?.writeText(inp.value).catch(() => document.execCommand('copy'));
  toast('Link copied!', 'ok');
}

async function loadSharePage(shareId) {
  nav('share');
  try {
    const r = await fetch(API() + '/api/share/' + shareId);
    const d = await r.json();
    if (!r.ok) { document.getElementById('share-title').textContent = 'Not found'; return; }
    document.getElementById('share-title').textContent = d.title || d.filename;
    document.getElementById('share-meta').textContent  = 'Generated ' + fmtDate(d.created_at);
    renderScript(d.script, 'share-script');
    if (d.audio) setAudio(d.audio, 'share-audio');
  } catch (e) {
    document.getElementById('share-title').textContent = 'Could not load';
  }
}

function switchShareTab(name, el) {
  el.parentElement.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('share-pane-s').classList.toggle('active', name === 'script');
  document.getElementById('share-pane-a').classList.toggle('active', name === 'audio');
}