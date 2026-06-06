async function fetchHistory(){
  if (!S.user) return;
  try {
    const r = await fetch(API()+'/api/podcasts',{headers:{'Authorization':'Bearer '+TOKEN()}});
    const d = await r.json();
    if (r.ok){ S.history = d.podcasts; renderHist(); }
  } catch(_){}
}
function renderHist(){
  const list = document.getElementById('hist-list');
  const q    = S.search.toLowerCase();
  const items = S.history.filter(h=>!q||(h.title||h.filename||'').toLowerCase().includes(q));
  document.getElementById('hist-count').textContent = S.history.length;
  if (!items.length){
    list.innerHTML = `<div class="sb-empty">${q?'No results':'No podcasts yet.<br/>Generate your first one!'}</div>`;
    return;
  }
  list.innerHTML = items.map(h=>`
    <div class="hist-item" onclick="loadHist('${h.podcast_id}')">
      <span class="hist-ico">🎙</span>
      <div class="hist-info">
        <div class="hist-name" title="${esc(h.title||h.filename)}">${esc(h.title||h.filename)}</div>
        <div class="hist-date">${fmtDate(h.created_at)}</div>
      </div>
      <button class="hist-edit" onclick="openRename(event,'${h.podcast_id}','${esc(h.title||h.filename)}')" title="Rename">✎</button>
      <button class="hist-del" onclick="delHist(event,'${h.podcast_id}')" title="Delete">✕</button>
    </div>
  `).join('');
}
async function loadHist(id){
  if (!S.user) return;
  try {
    const r = await fetch(API()+'/api/podcasts/'+id,{headers:{'Authorization':'Bearer '+TOKEN()}});
    const d = await r.json();
    if (!r.ok){ toast('Could not load.','err'); return; }
    const p = d.podcast;
    S.script = p.script; S.audio64 = p.audio; S.shareId = p.share_id; S.currentPodcastId = p.podcast_id;
    renderScript(p.script,'script-out');
    setAudio(p.audio,'audio-el');
    drawWaveform(p.audio);
    document.getElementById('result-card').style.display='block';
    document.getElementById('prog-card').style.display='none';
    document.querySelectorAll('.hist-item').forEach(el=>el.classList.remove('active'));
    toast('Loaded: '+esc(p.title||p.filename),'info');
    if (window.innerWidth<=700) toggleSb();
  } catch(e){ toast('Failed to load.','err'); }
}
async function delHist(e, id){
  e.stopPropagation();
  if (!confirm('Delete this podcast?')) return;
  try {
    await fetch(API()+'/api/podcasts/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+TOKEN()}});
    S.history = S.history.filter(h=>h.podcast_id!==id);
    renderHist(); toast('Deleted.','info');
  } catch(_){ toast('Failed to delete.','err'); }
}
function openRename(e, id, current){
  e.stopPropagation();
  S.renamingId = id;
  document.getElementById('rename-inp').value = current;
  document.getElementById('rename-modal').style.display = 'flex';
  setTimeout(()=>document.getElementById('rename-inp').focus(),50);
}
async function confirmRename(){
  const title = document.getElementById('rename-inp').value.trim();
  if (!title){ toast('Title required.','err'); return; }
  try {
    await fetch(API()+'/api/podcasts/'+S.renamingId+'/rename',{
      method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN()},
      body:JSON.stringify({title})
    });
    const p = S.history.find(h=>h.podcast_id===S.renamingId);
    if (p) p.title = title;
    renderHist();
    closeModal(null,'rename-modal');
    toast('Renamed.','ok');
  } catch(_){ toast('Failed to rename.','err'); }
}
function filterHist(q){ S.search=q; renderHist(); }
function newSession(){
  S.file=null; S.audio64=null; S.script=null; S.shareId=null;
  document.getElementById('file-inp').value='';
  document.getElementById('file-pill').style.display='none';
  document.getElementById('gen-btn').disabled=true;
  document.getElementById('result-card').style.display='none';
  document.getElementById('prog-card').style.display='none';
  document.querySelectorAll('.hist-item').forEach(el=>el.classList.remove('active'));
  if (window.innerWidth<=700) toggleSb();
}