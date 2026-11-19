const input = document.querySelector('#pdfInput');
const drop = document.querySelector('#drop');
const list = document.querySelector('#list');
const combine = document.querySelector('#combine');
const clear = document.querySelector('#clear');
const summary = document.querySelector('#summary');
const status = document.querySelector('#status');
const outName = document.querySelector('#outName');
let files = [];
let nextId = 1;

const fmt = n => n < 1024*1024 ? `${(n/1024).toFixed(0)} KB` : `${(n/1024/1024).toFixed(1)} MB`;
function setStatus(msg, error=false){ status.textContent=msg; status.style.color=error?'#a32727':'#586579'; }

async function addFiles(newFiles){
  const pdfs = [...newFiles].filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if(!pdfs.length) return setStatus('Choose one or more PDF files.', true);
  setStatus('Reading PDFs locally...');
  for(const file of pdfs){
    try{
      const bytes = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption:false });
      files.push({ id:nextId++, file, pages:pdf.getPageCount() });
    }catch(e){ setStatus(`Could not read ${file.name}. It may be encrypted or damaged.`, true); }
  }
  render();
  if(files.length) setStatus('Ready. Drag files into the order you want, then combine.');
}

function move(index, delta){ const j=index+delta; if(j<0||j>=files.length)return; [files[index],files[j]]=[files[j],files[index]]; render(); }
function remove(id){ files=files.filter(x=>x.id!==id); render(); }
function render(){
  list.innerHTML='';
  files.forEach((x,i)=>{
    const li=document.createElement('li'); li.className='item'; li.draggable=true; li.dataset.id=x.id;
    li.innerHTML=`<div class="handle" aria-hidden="true">⋮⋮</div><div><div class="name"></div><div class="meta">${x.pages} page${x.pages===1?'':'s'} · ${fmt(x.file.size)}</div></div><div class="actions"><button class="secondary up" title="Move up">↑</button><button class="secondary down" title="Move down">↓</button><button class="danger remove">Remove</button></div>`;
    li.querySelector('.name').textContent=`${i+1}. ${x.file.name}`;
    li.querySelector('.up').onclick=()=>move(i,-1); li.querySelector('.down').onclick=()=>move(i,1); li.querySelector('.remove').onclick=()=>remove(x.id);
    li.ondragstart=e=>{li.classList.add('dragging');e.dataTransfer.setData('text/plain',String(x.id));};
    li.ondragend=()=>li.classList.remove('dragging');
    li.ondragover=e=>e.preventDefault();
    li.ondrop=e=>{e.preventDefault(); const id=Number(e.dataTransfer.getData('text/plain')); const from=files.findIndex(a=>a.id===id); const to=files.findIndex(a=>a.id===x.id); if(from>=0&&to>=0){ const [m]=files.splice(from,1); files.splice(to,0,m); render(); }};
    list.appendChild(li);
  });
  const pages=files.reduce((a,b)=>a+b.pages,0); const totalBytes=files.reduce((a,b)=>a+b.file.size,0); summary.textContent=files.length?`${files.length} PDF${files.length===1?'':'s'} · ${pages.toLocaleString()} pages · ${fmt(totalBytes)} total`:'No PDFs selected';
  combine.disabled=files.length<1; clear.disabled=files.length<1;
}

input.onchange=()=>{addFiles(input.files); input.value='';};
drop.onclick=e=>{ if(e.target.tagName!=='BUTTON') input.click(); };
drop.querySelector('button').onclick=e=>{e.stopPropagation();input.click();};
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
clear.onclick=()=>{files=[];render();setStatus('List cleared.');};
combine.onclick=async()=>{
  if(!files.length)return;
  combine.disabled=true; setStatus('Combining PDFs locally...');
  try{
    const merged=await PDFLib.PDFDocument.create();
    for(const x of files){
      const src=await PDFLib.PDFDocument.load(await x.file.arrayBuffer());
      const pages=await merged.copyPages(src,src.getPageIndices()); pages.forEach(p=>merged.addPage(p));
    }
    const bytes=await merged.save(); const blob=new Blob([bytes],{type:'application/pdf'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; let name=(outName.value.trim()||'combined.pdf'); if(!name.toLowerCase().endsWith('.pdf'))name+='.pdf'; a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000); setStatus(`Done. Downloaded ${name}.`);
  }catch(e){setStatus(`Could not combine the PDFs: ${e.message}`,true);} finally {combine.disabled=false;}
};
render();
