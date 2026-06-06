'use strict';



const THEME_KEY = 'pai_theme';

(function initTheme() {
  const t   = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'dark' ? '☽' : '☀';
})();

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const nxt = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nxt);
  localStorage.setItem(THEME_KEY, nxt);
  document.getElementById('theme-btn').textContent = nxt === 'dark' ? '☽' : '☀';
}

function toast(msg, type = 'info', dur = 3500) {
  const icons = { ok: '✓', err: '✕', info: 'ℹ' };
  const el    = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'tout .2s ease forwards';
    setTimeout(() => el.remove(), 220);
  }, dur);
}

function closeModal(e, id) {
  if (!e || e.target.classList.contains('overlay'))
    document.getElementById(id).style.display = 'none';
}

function toggleSb() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-backdrop').classList.toggle('open');
}

function submitContact() {
  const n = document.getElementById('c-name').value.trim();
  const e = document.getElementById('c-email').value.trim();
  const m = document.getElementById('c-msg').value.trim();
  if (!n || !e || !m) { toast('Please fill all fields.', 'err'); return; }
  if (!isEmail(e))    { toast('Valid email required.', 'err');    return; }
  toast("Message sent! We'll be in touch.", 'ok');
  document.getElementById('c-name').value = '';
  document.getElementById('c-email').value = '';
  document.getElementById('c-msg').value  = '';
}

function toggleFaq(el) { el.closest('.faq-item').classList.toggle('open'); }