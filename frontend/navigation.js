function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  const btn = document.querySelector(`.nav-btn[onclick*="'${page}'"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('mob-menu').style.display = page === 'dashboard' ? 'flex' : 'none';
  updateAuthUI();
  if (page === 'dashboard') { renderHist(); }
  window.scrollTo(0,0);
}
function checkRoute() {
  const h = window.location.hash;
  if (h.startsWith('#/share/')) {
    loadSharePage(h.slice(8));
    return;
  }
  if (!h || h === '#') {
    nav('home');
    return;
  }
  const pages = ['home','dashboard','about','contact','login','signup'];
  const p = h.startsWith('#/') ? h.slice(2) : 'home';
  nav(pages.includes(p) ? p : 'home');
}
window.addEventListener('hashchange', checkRoute);