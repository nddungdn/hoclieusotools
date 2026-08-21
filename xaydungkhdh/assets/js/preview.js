const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

export function renderDocumentPreview(model){
  if(!model?.sections?.length)return '<p>Chưa chọn phụ lục.</p>';
  return `<div class="preview-help">Nhấn vào từng phụ lục để mở hoặc thu gọn bản xem trước.</div>${model.sections.map(renderSection).join('')}`;
}

function renderSection(section){
  const tables=section.blocks.filter(b=>b.type==='table');
  const rows=tables.reduce((sum,b)=>sum+(b.rows?.length||0),0);
  const orientation=section.orientation==='landscape'?'Khổ ngang':'Khổ dọc';
  return `<details class="preview-section" data-preview="${esc(section.id)}">
    <summary class="preview-summary">
      <span><strong>${esc(section.title)}</strong><small>${orientation} · ${tables.length} bảng · ${rows} dòng dữ liệu</small></span>
      <span class="preview-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="preview-paper ${section.orientation==='landscape'?'preview-landscape':'preview-portrait'}">${section.blocks.map(renderBlock).join('')}</div>
  </details>`;
}

function renderBlock(block){
  if(block.type==='twoColumnHeader')return `<div class="preview-letterhead"><div>${lines(block.left)}</div><div>${lines(block.right)}</div></div>`;
  if(block.type==='title')return `<h4 class="preview-title">${esc(block.text)}</h4>`;
  if(block.type==='subtitle')return `<p class="preview-subtitle">${esc(block.text)}</p>`;
  if(block.type==='heading')return `<h5 class="preview-heading">${esc(block.text)}</h5>`;
  if(block.type==='subheading')return `<h6 class="preview-subheading">${esc(block.text)}</h6>`;
  if(block.type==='paragraph')return `<p class="preview-paragraph">${lines(block.text)}</p>`;
  if(block.type==='table')return renderTable(block);
  if(block.type==='signature')return `<div class="preview-signature"><div><strong>${esc(block.left)}</strong><em>(Ký và ghi rõ họ tên)</em></div><div><span>${esc(block.locality)}, ngày ..... tháng ..... năm .....</span><strong>${esc(block.right)}</strong><em>(Ký và ghi rõ họ tên)</em></div></div>`;
  return '';
}

function renderTable(block){
  const rows=block.rows?.length?block.rows:[Array(block.headers.length).fill('')];
  const cols=Array.isArray(block.widths)&&block.widths.length===block.headers.length?`<colgroup>${block.widths.map(w=>`<col style="width:${Number(w)||0}%">`).join('')}</colgroup>`:'';
  return `<div class="preview-table-wrap"><table class="preview-table">${cols}<thead><tr>${block.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${block.headers.map((_,i)=>`<td>${lines(row[i]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function lines(value){return esc(value).replace(/\n/g,'<br>');}
