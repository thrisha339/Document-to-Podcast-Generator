const dz = document.getElementById('dropzone');
if (dz) {
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});
  dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');const f=e.dataTransfer?.files?.[0];if(f)setFile(f)});
}
function onFileChange(inp){ if(inp.files?.[0]) setFile(inp.files[0]); }
function setFile(f){
  const MB = f.size/1024/1024;
  if (MB>10){toast('File exceeds 10 MB.','err');return;}
  const ext = f.name.split('.').pop().toLowerCase();
  if (!['pdf','txt','docx','pptx'].includes(ext)){toast('Use PDF, TXT, DOCX, or PPTX.','err');return;}
  S.file = f;
  document.getElementById('fp-name').textContent = f.name;
  document.getElementById('fp-size').textContent = MB.toFixed(1)+' MB';
  document.getElementById('file-pill').style.display = 'flex';
  document.getElementById('gen-btn').disabled = false;
}
function clearFile(){
  S.file=null; document.getElementById('file-inp').value='';
  document.getElementById('file-pill').style.display='none';
  document.getElementById('gen-btn').disabled=true;
}