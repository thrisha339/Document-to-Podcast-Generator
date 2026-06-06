'use strict';

const STEP_MSGS = ['Extracting text…', 'Filtering content…', 'Writing script…', 'Generating audio…'];
const STEP_PCT  = [8, 30, 58, 82];

function setStep(n) {
  ['s1', 's2', 's3', 's4'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'step-item' + (i + 1 < n ? ' done' : i + 1 === n ? ' active' : '');
  });
  const pct = n <= 4 ? STEP_PCT[n - 1] : 100;
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-lbl').textContent  = n <= 4 ? STEP_MSGS[n - 1] : 'Finalising…';
}

async function generate() {
  if (!S.user)      { toast('Sign in to generate podcasts.', 'info'); nav('login'); return; }
  if (!S.file)      { toast('Upload a file first.', 'err'); return; }
  if (S.generating) return;

  S.generating = true;
  S.audio64 = null; S.script = null;
  document.getElementById('gen-btn').disabled = true;
  document.getElementById('result-card').style.display = 'none';
  document.getElementById('prog-card').style.display   = 'block';

  let step = 1; setStep(1);
  S.stepTimer = setInterval(() => { if (step < 4) { step++; setStep(step); } }, 10000);

  const fd = new FormData();
  fd.append('file', S.file);

  try {
    const r = await fetch(API() + '/api/generate-podcast', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN() },
      body:    fd,
    });
    clearInterval(S.stepTimer);
    const data = await r.json();
    if (!r.ok || data.error) { toast(data.error || 'Server error.', 'err'); resetGen(); return; }

    setStep(5);
    await sleep(400);

    S.script           = data.script;
    S.audio64          = data.audio;
    S.shareId          = data.share_id;
    S.currentPodcastId = data.podcast_id;

    renderScript(data.script, 'script-out');
    setAudio(data.audio, 'audio-el');
    await drawWaveform(data.audio);

    document.getElementById('prog-card').style.display   = 'none';
    document.getElementById('result-card').style.display = 'block';
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });
    toast('Podcast ready!', 'ok');
    await fetchHistory();
  } catch (e) {
    clearInterval(S.stepTimer);
    toast('Request failed: ' + e.message, 'err');
    resetGen();
  }

  S.generating = false;
  document.getElementById('gen-btn').disabled = false;
}

function resetGen() {
  S.generating = false;
  clearInterval(S.stepTimer);
  document.getElementById('prog-card').style.display = 'none';
  document.getElementById('gen-btn').disabled = false;
}

function renderScript(script, targetId) {
  const box = document.getElementById(targetId);
  if (!box) return;
  box.innerHTML = '';
  script.split('\n').forEach(line => {
    if (!line.trim()) return;
    const d  = document.createElement('div');
    d.className = 'sline';
    const lo = line.toLowerCase();
    if (lo.startsWith('alex')) {
      const i = line.indexOf(':');
      d.innerHTML = `<span class="alex">${line.slice(0, i)}</span>${line.slice(i)}`;
    } else if (lo.startsWith('jordan')) {
      const i = line.indexOf(':');
      d.innerHTML = `<span class="jordan">${line.slice(0, i)}</span>${line.slice(i)}`;
    } else {
      d.textContent = line;
    }
    box.appendChild(d);
  });
}

function setAudio(b64, elemId) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: 'audio/mpeg' });
  document.getElementById(elemId).src = URL.createObjectURL(blob);
}

async function drawWaveform(b64) {
  const cv = document.getElementById('wave-canvas');
  if (!cv) return;
  const bytes      = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  let   decoded;
  try {
    decoded = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
  } catch (e) {
    console.warn('Waveform decode failed:', e);
    return;
  }
  const samples = decoded.getChannelData(0);   
  const ctx     = cv.getContext('2d');
  cv.width      = cv.offsetWidth * 2;
  const W = cv.width, H = cv.height * 2;
  ctx.clearRect(0, 0, W, H);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.strokeStyle = isDark ? '#3b82f6' : '#1a6ef5';
  ctx.lineWidth   = 1.5;
  const step = Math.ceil(samples.length / W);
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    let max = 0;
    for (let j = 0; j < step; j++) { const v = Math.abs(samples[x * step + j] || 0); if (v > max) max = v; }
    x === 0 ? ctx.moveTo(x, (H / 2) - (max * H / 2.2))
            : ctx.lineTo(x, (H / 2) - (max * H / 2.2));
  }
  ctx.stroke();
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    let max = 0;
    for (let j = 0; j < step; j++) { const v = Math.abs(samples[x * step + j] || 0); if (v > max) max = v; }
    x === 0 ? ctx.moveTo(x, (H / 2) + (max * H / 2.2))
            : ctx.lineTo(x, (H / 2) + (max * H / 2.2));
  }
  ctx.stroke();
  audioCtx.close();
}

function switchTab(name, el) {
  el.parentElement.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('pane-script').classList.toggle('active', name === 'script');
  document.getElementById('pane-audio').classList.toggle('active', name === 'audio');
}

function dlAudio() {
  if (!S.audio64) return;
  const bytes = Uint8Array.from(atob(S.audio64), c => c.charCodeAt(0));
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
  a.download = 'podcast.mp3';
  a.click();
  toast('Downloading MP3…', 'info');
}

function dlScript() {
  if (!S.script) return;
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([S.script], { type: 'text/plain' }));
  a.download = 'script.txt';
  a.click();
  toast('Downloading script…', 'info');
}