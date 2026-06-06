'use strict';

async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  ['l-eem', 'l-pem'].forEach(id => document.getElementById(id).textContent = '');

  let ok = true;
  if (!isEmail(email)) { document.getElementById('l-eem').textContent = 'Valid email required.'; ok = false; }
  if (pass.length < 6) { document.getElementById('l-pem').textContent = 'Password too short.';   ok = false; }
  if (!ok) return;

  try {
    const r = await fetch(API() + '/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password: pass }),
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Login failed.', 'err'); return; }
    S.user = { ...d.user, token: d.token };
    localStorage.setItem('pai_user', JSON.stringify(S.user));
    toast('Welcome back, ' + S.user.name + '!', 'ok');
    updateAuthUI();
    nav('dashboard');
    await fetchHistory();
  } catch (e) {
    toast('Could not reach server. Is it running?', 'err');
  }
}

async function doSignup() {
  const name  = document.getElementById('s-name').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const pass  = document.getElementById('s-pass').value;
  ['s-nem', 's-eem', 's-pem'].forEach(id => document.getElementById(id).textContent = '');

  let ok = true;
  if (!name)           { document.getElementById('s-nem').textContent = 'Name is required.';      ok = false; }
  if (!isEmail(email)) { document.getElementById('s-eem').textContent = 'Valid email required.';  ok = false; }
  if (pass.length < 8) { document.getElementById('s-pem').textContent = 'Minimum 8 characters.'; ok = false; }
  if (!ok) return;

  try {
    const r = await fetch(API() + '/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password: pass }),
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Signup failed.', 'err'); return; }
    S.user = { ...d.user, token: d.token };
    localStorage.setItem('pai_user', JSON.stringify(S.user));
    toast('Welcome, ' + S.user.name + '!', 'ok');
    updateAuthUI();
    nav('dashboard');
    await fetchHistory();   
  } catch (e) {
    toast('Could not reach server.', 'err');
  }
}

function logout() {
  S.user = null;
  S.history = [];
  localStorage.removeItem('pai_user');
  updateAuthUI();
  nav('home');
  toast('Signed out.', 'info');
}

function updateAuthUI() {
  const ab = document.getElementById('auth-btns');
  const ua = document.getElementById('user-area');
  const av = document.getElementById('uavatar');
  if (S.user) {
    ab.style.display = 'none';
    ua.style.display = 'flex';
    av.textContent   = (S.user.name || S.user.email || '?')[0].toUpperCase();
    av.title         = S.user.name + ' (' + S.user.email + ')';
  } else {
    ab.style.display = 'flex';
    ua.style.display = 'none';
  }
}