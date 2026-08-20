import { buildDocumentModel } from './document-model.js';

export function exportPdfViaPrint(state){
  const model=buildDocumentModel(state);
  const w=window.open('','_blank');
  if(w) w.opener=null;
  if(!w) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up cho trang này.');
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(model.meta.title)}</title>
  <style>
  @page{size:A4 portrait;margin:20mm 20mm 20mm 30mm}
  @page landscapePage{size:A4 landscape;margin:20mm 20mm 20mm 30mm}
  *{box-sizing:border-box}body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.15;color:#000;margin:0}
  .section{page-break-before:always}.section:first-child{page-break-before:auto}.landscape{page:landscapePage}
  .head{width:100%;display:grid;grid-template-columns:48% 52%;gap:2%;text-align:center;margin-bottom:8pt}.head .strong{font-weight:700}
  h1{font-size:14pt;text-align:center;margin:10pt 0 4pt}h2{font-size:13pt;margin:10pt 0 4pt}p{margin:0 0 6pt;text-align:justify;text-indent:1cm}.center{text-align:center;text-indent:0}.noindent{text-indent:0}
  table{border-collapse:collapse;width:100%;margin:5pt 0 10pt;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #000;padding:4px 5px;vertical-align:top;font-size:11pt}th{text-align:center;font-weight:700}
  .sig{border:0}.sig td{border:0;text-align:center;width:50%;padding-top:12pt}
  @media screen{body{background:#eee;padding:16px}.section{background:white;margin:auto auto 20px;max-width:1100px;padding:20mm 20mm 20mm 30mm;box-shadow:0 1px 8px #aaa}.landscape{max-width:1400px}}
  </style></head><body>${model.sections.map(renderSection).join('')}</body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); },700);
}

function renderSection(s){return `<section class="section ${s.orientation==='landscape'?'landscape':''}">${s.blocks.map(renderBlock).join('')}</section>`}
function renderBlock(b){
  if(b.type==='twoColumnHeader'){const l=escapeHtml(b.left).replace(/\n/g,'<br>'),r=escapeHtml(b.right).replace(/\n/g,'<br>');return `<div class="head"><div>${l}</div><div>${r}</div></div>`}
  if(b.type==='title')return `<h1>${escapeHtml(b.text)}</h1>`;
  if(b.type==='subtitle')return `<p class="center">${escapeHtml(b.text)}</p>`;
  if(b.type==='heading')return `<h2>${escapeHtml(b.text)}</h2>`;
  if(b.type==='paragraph')return `<p>${escapeHtml(b.text).replace(/\n/g,'<br>')}</p>`;
  if(b.type==='table')return `<table><thead><tr>${b.headers.map(x=>`<th>${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${(b.rows.length?b.rows:[Array(b.headers.length).fill('')]).map(r=>`<tr>${b.headers.map((_,i)=>`<td>${escapeHtml(r[i]??'').replace(/\n/g,'<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  if(b.type==='signature')return `<table class="sig"><tr><td><strong>${escapeHtml(b.left)}</strong><br><em>(Ký và ghi rõ họ tên)</em></td><td>${escapeHtml(b.locality)}, ngày ..... tháng ..... năm .....<br><strong>${escapeHtml(b.right)}</strong><br><em>(Ký và ghi rõ họ tên)</em></td></tr></table>`;
  return '';
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
