(() => {
'use strict';
const CFG = window.APP_CONFIG || {};
const DATA = window.GDCD_DATA || {grades:{}};
const LEVELS = [
  {id:'nb', label:'Nhận biết', key:'nhan_biet'},
  {id:'th', label:'Thông hiểu', key:'thong_hieu'},
  {id:'vd', label:'Vận dụng', key:'van_dung'}
];
const FORMS = ['tn','tl'];
const POINTS = [0.25,0.5,0.75,1,1.5,2,2.5,3];
const SUBTYPES_NORMAL = [
  ['mcq','Nhiều lựa chọn'],['truefalse','Đúng/Sai'],['matching','Nối'],['short','Trả lời ngắn']
];
const SUBTYPES_7991 = [
  ['mcq','Nhiều lựa chọn'],['truefalse','Đúng/Sai'],['short','Trả lời ngắn']
];
const state = {
  grade:'6', selected:new Set(), matrix:{}, teacherSpec:{}, apiOk:false,
  models:[], model:'', exam:null, dialog:null
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt = n => Number(n||0).toLocaleString('vi-VN',{minimumFractionDigits:Number(n)%1?1:0,maximumFractionDigits:2});
const nval = v => Number(String(v ?? '').replace(',','.')) || 0;
const countFmt = n => { n=nval(n); const i=Math.floor(n), f=n-i; if(Math.abs(f-.5)<1e-9) return i?`${i} + ½`:'½'; return fmt(n); };
const mode = () => ($('input[name="mode"]:checked')||{}).value || 'normal';
const apiBase = () => String(CFG.API_BASE||'').replace(/\/$/,'');

function currentLessons(){ return (DATA.grades?.[state.grade]?.lessons || []); }
function lessonById(id){ return currentLessons().find(x=>x.id===id) || Object.values(DATA.grades||{}).flatMap(x=>x.lessons||[]).find(x=>x.id===id); }
function selectedLessons(){ return currentLessons().filter(x=>state.selected.has(x.id)); }
function blankCell(){ return {tn:[],tl:[]}; }
function ensureLessonMatrix(id){
  if(!state.matrix[id]) state.matrix[id] = {nb:blankCell(),th:blankCell(),vd:blankCell()};
  return state.matrix[id];
}
function ensureTeacherSpec(id){
  if(!state.teacherSpec[id]) state.teacherSpec[id]={nb:'',th:'',vd:''};
  return state.teacherSpec[id];
}
function allConfigs(){
  const out=[];
  selectedLessons().forEach(l=>LEVELS.forEach(lev=>FORMS.forEach(form=>{
    (ensureLessonMatrix(l.id)[lev.id][form]||[]).forEach((r,idx)=>out.push({
      id:`${l.id}_${lev.id}_${form}_${idx}`,
      lessonId:l.id, lessonTitle:l.title, strand:l.track, level:lev.id, levelName:lev.label,
      form:form==='tn'?'TNKQ':'TL', subtype:form==='tn'?(r.subtype||'mcq'):'essay',
      count:nval(r.count), pointsPerQuestion:nval(r.points), total:nval(r.count)*nval(r.points)
    }));
  })));
  return out.filter(x=>x.count>0 && x.pointsPerQuestion>0);
}
function totalPoints(){ return allConfigs().reduce((s,x)=>s+x.total,0); }
function levelPoints(level){ return allConfigs().filter(x=>x.level===level).reduce((s,x)=>s+x.total,0); }
function levelCount(level){ return allConfigs().filter(x=>x.level===level).reduce((s,x)=>s+x.count,0); }
function lessonPoints(id){ return allConfigs().filter(x=>x.lessonId===id).reduce((s,x)=>s+x.total,0); }
function formLabel(sub){ return ({mcq:'Nhiều lựa chọn',truefalse:'Đúng/Sai',matching:'Nối',short:'Trả lời ngắn',essay:'Tự luận'})[sub] || sub; }
function cellSummary(rows, form){
  if(!rows?.length) return 'Chưa chọn';
  return rows.map(r=>`${countFmt(r.count)} câu × ${fmt(r.points)}đ${form==='tn'?' · '+formLabel(r.subtype):''}`).join('\n');
}
function cellCompact(rows,form){
  if(!rows?.length) return '';
  const count=rows.reduce((s,r)=>s+nval(r.count),0), pts=rows.reduce((s,r)=>s+nval(r.count)*nval(r.points),0);
  return `${countFmt(count)} ${form==='tn'?'TNKQ':'TL'} (${fmt(pts)} điểm)`;
}
function showPanel(name){
  $$('.panel').forEach(x=>x.classList.toggle('active',x.id===`panel-${name}`));
  $$('.step-btn').forEach(x=>x.classList.toggle('active',x.dataset.step===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='lessons') renderLessons();
  if(name==='matrix') renderMatrix();
  if(name==='spec') renderSpec();
  if(name==='review') renderAudit();
}
function setApiStatus(text,kind='neutral'){
  $('#apiStatus').textContent=text;
  $('#apiDot').className=`status-dot ${kind}`;
}
function setupValue(){
  return {
    parentOrg:$('#parentOrg').value.trim(), schoolName:$('#schoolName').value.trim(), schoolLine2:$('#schoolLine2').value.trim(),
    schoolYear:$('#schoolYear').value.trim(), examType:$('#examType').value, grade:state.grade,
    duration:nval($('#duration').value)||45, examCodes:nval($('#examCodes').value)||1,
    mode:mode(), disabledGuide:$('#disabledGuide').checked, extraNotes:$('#extraNotes').value.trim()
  };
}

function renderLessons(){
  $('#gradeChip').textContent=`GDCD ${state.grade}`;
  $('#lessonList').innerHTML=currentLessons().map(l=>`<label class="lesson-card ${state.selected.has(l.id)?'selected':''}">
    <input type="checkbox" data-lesson="${esc(l.id)}" ${state.selected.has(l.id)?'checked':''}/>
    <div><h3>Bài ${l.num}. ${esc(l.title)}</h3><p>${esc((l.descriptor?.raw||'').slice(0,170))}${(l.descriptor?.raw||'').length>170?'…':''}</p><span class="track">${esc(l.track)}</span></div>
  </label>`).join('');
  $$('[data-lesson]').forEach(ch=>ch.addEventListener('change',e=>{
    const id=e.target.dataset.lesson;
    if(e.target.checked){state.selected.add(id);ensureLessonMatrix(id);ensureTeacherSpec(id);}else{state.selected.delete(id);}
    renderLessons();
  }));
}
function renderMatrix(){
  const lessons=selectedLessons();
  if(!lessons.length){$('#matrixBody').innerHTML='<tr><td colspan="10">Chưa chọn bài. Quay lại bước 2.</td></tr>';$('#matrixFoot').innerHTML='';return;}
  $('#matrixBody').innerHTML=lessons.map((l,i)=>{
    const m=ensureLessonMatrix(l.id);
    const cells=LEVELS.flatMap(lev=>FORMS.map(form=>`<td><button class="matrix-cell-btn ${(m[lev.id][form]||[]).length?'has-data':''}" data-mcell="${l.id}|${lev.id}|${form}"><span class="cell-summary">${esc(cellSummary(m[lev.id][form],form))}</span></button></td>`)).join('');
    return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><strong>Bài ${l.num}</strong><br>${esc(l.title)}</td>${cells}<td><strong>${fmt(lessonPoints(l.id))}</strong></td></tr>`;
  }).join('');
  const total=totalPoints();
  const pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  $('#matrixFoot').innerHTML=`<tr class="matrix-foot"><td colspan="3"><strong>Tổng số câu</strong></td>${LEVELS.map(l=>`<td colspan="2">${countFmt(levelCount(l.id))}</td>`).join('')}<td><strong>${fmt(total)}</strong></td></tr>
  <tr class="matrix-foot"><td colspan="3"><strong>Tỉ lệ %</strong></td>${pct.map(x=>`<td colspan="2">${fmt(x)}%</td>`).join('')}<td>${total?'100%':'0%'}</td></tr>
  <tr class="matrix-foot"><td colspan="3"><strong>Tỉ lệ chung</strong></td><td colspan="4">NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%</td><td colspan="2">VD: ${fmt(pct[2]||0)}%</td><td></td></tr>`;
  $('#matrixNotice').innerHTML = Math.abs(total-10)<0.001 ? `<span class="success-text">✓ Tổng điểm ma trận: 10,0 điểm.</span>` : `<span class="warning-text">⚠ Tổng điểm hiện tại: ${fmt(total)} điểm. Cần điều chỉnh về 10,0 điểm trước khi tạo đề.</span>`;
  $$('[data-mcell]').forEach(b=>b.addEventListener('click',()=>openMatrixDialog(...b.dataset.mcell.split('|'))));
}
function openMatrixDialog(lessonId,level,form){
  const l=lessonById(lessonId), lev=LEVELS.find(x=>x.id===level);
  state.dialog={lessonId,level,form,rows:JSON.parse(JSON.stringify(ensureLessonMatrix(lessonId)[level][form]||[]))};
  $('#dialogLesson').textContent=`Bài ${l.num}. ${l.title}`;
  $('#dialogTitle').textContent=`${lev.label} · ${form==='tn'?'TNKQ':'Tự luận'}`;
  renderConfigRows(); $('#matrixDialog').showModal();
}
function subtypeOptions(current){
  const arr=mode()==='7991'?SUBTYPES_7991:SUBTYPES_NORMAL;
  return arr.map(([v,t])=>`<option value="${v}" ${v===current?'selected':''}>${t}</option>`).join('');
}
function pointOptions(v){
  const val=nval(v), standard=POINTS.some(x=>Math.abs(x-val)<1e-9);
  return POINTS.map(p=>`<option value="${p}" ${standard&&p===val?'selected':''}>${fmt(p)} điểm</option>`).join('')+`<option value="custom" ${!standard?'selected':''}>Khác...</option>`;
}
function renderConfigRows(){
  const d=state.dialog; if(!d)return;
  if(!d.rows.length)d.rows.push({subtype:'mcq',count:1,points:.25});
  $('#configRows').innerHTML=d.rows.map((r,i)=>`<div class="config-row" data-row="${i}">
    ${d.form==='tn'?`<label class="subtype">Dạng TNKQ<select data-field="subtype">${subtypeOptions(r.subtype||'mcq')}</select></label>`:`<label class="subtype">Dạng câu<input value="Tự luận" disabled /></label>`}
    <label>Số câu<input data-field="count" type="number" min="0.5" step="0.5" value="${nval(r.count)||1}" /></label>
    <label>Điểm/câu<select data-field="pointsPreset">${pointOptions(r.points)}</select><input data-field="pointsCustom" type="number" min="0.05" step="0.05" value="${nval(r.points)||.25}" style="${POINTS.includes(nval(r.points))?'display:none':''};margin-top:6px" /></label>
    <button type="button" class="btn ghost remove-config" data-remove="${i}" title="Xóa">✕</button>
  </div>`).join('');
  $$('#configRows [data-row]').forEach(row=>{
    const i=+row.dataset.row;
    row.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',()=>{
      const f=el.dataset.field;
      if(f==='subtype')d.rows[i].subtype=el.value;
      if(f==='count')d.rows[i].count=nval(el.value);
      if(f==='pointsPreset'){
        const custom=row.querySelector('[data-field="pointsCustom"]');
        custom.style.display=el.value==='custom'?'block':'none';
        if(el.value!=='custom')d.rows[i].points=nval(el.value); else d.rows[i].points=nval(custom.value);
      }
      if(f==='pointsCustom')d.rows[i].points=nval(el.value);
      updateDialogSummary();
    }));
  });
  $$('[data-remove]').forEach(b=>b.addEventListener('click',()=>{d.rows.splice(+b.dataset.remove,1);renderConfigRows();}));
  updateDialogSummary();
}
function updateDialogSummary(){
  const rows=state.dialog?.rows||[]; const pts=rows.reduce((s,r)=>s+nval(r.count)*nval(r.points),0), cnt=rows.reduce((s,r)=>s+nval(r.count),0);
  $('#dialogSummary').textContent=`Tổng: ${fmt(cnt)} câu · ${fmt(pts)} điểm`;
}
function renderSpec(){
  const lessons=selectedLessons();
  if(!lessons.length){$('#specBody').innerHTML='<tr><td colspan="7">Chưa chọn bài.</td></tr>';$('#specFoot').innerHTML='';return;}
  $('#specBody').innerHTML=lessons.map((l,i)=>{
    const t=ensureTeacherSpec(l.id), m=ensureLessonMatrix(l.id);
    const official=LEVELS.map(lev=>`<div class="spec-source-block"><strong>${lev.label}</strong>${esc(l.descriptor?.[lev.key]||'—')}</div>`).join('');
    const teacher=`<details class="teacher-spec" ${Object.values(t).some(Boolean)?'open':''}><summary>+ Đặc tả bổ sung của giáo viên ${Object.values(t).some(Boolean)?'<span class="teacher-tag">Đang dùng</span>':''}</summary><div class="teacher-spec-grid">${LEVELS.map(lev=>`<label>${lev.label}<textarea data-tspec="${l.id}|${lev.id}" placeholder="Nhập thêm đặc tả ${lev.label.toLowerCase()} cho đúng bài này...">${esc(t[lev.id]||'')}</textarea></label>`).join('')}</div></details>`;
    return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><strong>Bài ${l.num}</strong><br>${esc(l.title)}</td><td><div class="spec-source">${official}</div>${teacher}</td>${LEVELS.map(lev=>`<td class="spec-count">${esc([cellCompact(m[lev.id].tn,'tn'),cellCompact(m[lev.id].tl,'tl')].filter(Boolean).join('\n')||'—')}</td>`).join('')}</tr>`;
  }).join('');
  const total=totalPoints(), pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  $('#specFoot').innerHTML=`<tr class="spec-foot"><td colspan="4"><strong>Tổng số câu hỏi</strong></td>${LEVELS.map(l=>`<td>${countFmt(levelCount(l.id))}</td>`).join('')}</tr>
  <tr class="spec-foot"><td colspan="4"><strong>Tỉ lệ %</strong></td>${pct.map(x=>`<td>${fmt(x)}%</td>`).join('')}</tr>
  <tr class="spec-foot"><td colspan="4"><strong>Tỉ lệ chung</strong></td><td colspan="2">NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%</td><td>VD: ${fmt(pct[2]||0)}%</td></tr>`;
  $$('[data-tspec]').forEach(t=>t.addEventListener('input',e=>{
    const [id,lev]=e.target.dataset.tspec.split('|'); ensureTeacherSpec(id)[lev]=e.target.value;
  }));
}
async function post(path,body){
  if(!apiBase() || /YOUR_SUBDOMAIN/.test(apiBase())) throw new Error('Chưa cấu hình API_BASE trong config.js.');
  const r=await fetch(apiBase()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{data={error:text||'Phản hồi không hợp lệ'}};
  if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`); return data;
}
async function testApi(){
  const key=$('#apiKey').value.trim(); if(!key){setApiStatus('Vui lòng nhập API key.','bad');return;}
  const btn=$('#testApiBtn');btn.disabled=true;btn.textContent='Đang kiểm tra…';state.apiOk=false;
  try{
    const data=await post('/api/test-key',{apiKey:key});
    state.models=data.models||[]; state.model=data.recommended||state.models[0]||'';
    $('#modelSelect').disabled=false; $('#modelSelect').innerHTML=state.models.map(m=>`<option value="${esc(m)}" ${m===state.model?'selected':''}>${esc(m)}</option>`).join('');
    state.apiOk=true; setApiStatus(`✓ API hoạt động. ${state.models.length} model có thể dùng.`,'ok');
  }catch(e){setApiStatus(`✕ ${e.message}`,'bad');$('#modelSelect').disabled=true;}
  finally{btn.disabled=false;btn.textContent='Kiểm tra API';}
}
function buildPayload(){
  return {
    setup:setupValue(),
    lessons:selectedLessons().map(l=>({id:l.id,number:l.num,title:l.title,strand:l.track,descriptor:l.descriptor,teacherDescriptor:ensureTeacherSpec(l.id)})),
    matrix:allConfigs()
  };
}
async function generateExam(){
  if(!state.apiOk) return alert('Hãy kiểm tra API thành công trước.');
  if(!state.selected.size) return alert('Chưa chọn bài.');
  if(Math.abs(totalPoints()-10)>.001) return alert(`Tổng điểm ma trận hiện là ${fmt(totalPoints())}; cần bằng 10,0.`);
  const btn=$('#generateBtn'), box=$('#generateStatus');btn.disabled=true;box.classList.remove('hidden');box.textContent='Đang tạo đề từ đúng bài, đặc tả và ma trận đã chọn…';
  try{
    const data=await post('/api/generate',{apiKey:$('#apiKey').value.trim(),model:$('#modelSelect').value||state.model,payload:buildPayload()});
    state.exam=data; renderExam(); box.textContent='✓ Đã tạo đề. Hãy kiểm tra nội dung trước khi xuất Word.';
  }catch(e){box.textContent='✕ '+e.message;}
  finally{btn.disabled=false;}
}
function renderExam(){
  const root=$('#examPreview'); if(!state.exam?.examCodes?.length){root.className='exam-preview empty';root.textContent='AI chưa trả cấu trúc đề hợp lệ.';return;}
  root.className='exam-preview';
  root.innerHTML=state.exam.examCodes.map(code=>`<div class="preview-code"><h3>ĐỀ ${esc(code.code||'A')}</h3>${(code.questions||[]).map(q=>questionHtml(q)).join('')}</div>`).join('') + (state.exam.notes?.length?`<div class="notice"><b>Lưu ý của AI:</b><ul>${state.exam.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'');
}
function questionHtml(q){
  let body=`<div class="preview-q"><b>Câu ${esc(q.number)} (${fmt(q.points)} điểm):</b> ${esc(q.prompt||'')}`;
  if(q.options?.length) body+=`<div class="preview-options">${q.options.map((x,i)=>`${String.fromCharCode(65+i)}. ${esc(x)}`).join('<br>')}</div>`;
  if(q.statements?.length) body+=`<div class="preview-options">${q.statements.map((x,i)=>`${x.label||String.fromCharCode(97+i)}. ${esc(x.text||x)}`).join('<br>')}</div>`;
  if(q.pairsLeft?.length) body+=`<div class="preview-options">${q.pairsLeft.map((x,i)=>`${i+1}. ${esc(x)}`).join('<br>')}<br>${(q.pairsRight||[]).map((x,i)=>`${String.fromCharCode(97+i)}. ${esc(x)}`).join('<br>')}</div>`;
  if(q.parts?.length) body+=`<div class="preview-options">${q.parts.map((p,i)=>`${p.label||String.fromCharCode(97+i)} (${fmt(p.points)}đ). ${esc(p.prompt||'')}`).join('<br>')}</div>`;
  return body+'</div>';
}
function examScore(code){return (code?.questions||[]).reduce((s,q)=>s+nval(q.points),0);}
function renderAudit(){
  const audits=[
    [state.apiOk,'API Gemini','Đã kiểm tra API cá nhân'],
    [state.selected.size>0,'Phạm vi bài',`${state.selected.size} bài được chọn`],
    [Math.abs(totalPoints()-10)<.001,'Tổng điểm ma trận',`${fmt(totalPoints())}/10,0 điểm`],
    [allConfigs().every(x=>{const l=lessonById(x.lessonId),lev=LEVELS.find(y=>y.id===x.level);return Boolean(l?.descriptor?.[lev.key]||ensureTeacherSpec(x.lessonId)[x.level]);}),'Đặc tả theo bài','Mọi ô ma trận đều có nguồn đặc tả tương ứng'],
    [Boolean(state.exam?.examCodes?.length),'Đề kiểm tra',state.exam?.examCodes?.length?`${state.exam.examCodes.length} mã đề`:'Chưa tạo đề'],
    [Boolean(state.exam?.examCodes?.length)&&state.exam.examCodes.every(c=>Math.abs(examScore(c)-10)<.01),'Điểm đề AI',state.exam?.examCodes?.length?state.exam.examCodes.map(c=>`${c.code}: ${fmt(examScore(c))}`).join(' · '):'Chưa có']
  ];
  $('#auditGrid').innerHTML=audits.map(([ok,t,d])=>`<div class="audit-item ${ok?'ok':'bad'}"><div class="audit-icon">${ok?'✓':'!'}</div><div><strong>${esc(t)}</strong><div class="tiny">${esc(d)}</div></div></div>`).join('');
}

// ===== DOCX (OOXML) =====
function xesc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function wRun(text,{b=false,i=false,size=26}={}){return `<w:r><w:rPr>${b?'<w:b/>':''}${i?'<w:i/>':''}<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xesc(text)}</w:t></w:r>`;}
function wP(text='',opt={}){const {b=false,align='left',size=26,after=80,before=0,pageBreak=false}=opt;return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${after}" w:before="${before}"/>${pageBreak?'<w:pageBreakBefore/>':''}</w:pPr>${wRun(text,{b,size})}</w:p>`;}
function wRich(lines,opt={}){return (lines||[]).map((x,i)=>wP(x.text??x,{...opt,b:x.bold??opt.b,align:x.align??opt.align,size:x.size??opt.size,after:x.after??opt.after})).join('');}
function tc(content,{span=1,vMerge=null,width=null,align='left',fill=null}={}){return `<w:tc><w:tcPr>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${vMerge===true?'<w:vMerge w:val="restart"/>':vMerge===false?'<w:vMerge/>':''}${width?`<w:tcW w:w="${width}" w:type="dxa"/>`:''}${fill?`<w:shd w:fill="${fill}"/>`:''}<w:vAlign w:val="center"/></w:tcPr>${typeof content==='string'&&content.startsWith('<w:')?content:wP(content,{align,size:20,after:20})}</w:tc>`;}
function tr(cells,{header=false}={}){return `<w:tr>${header?'<w:trPr><w:tblHeader/></w:trPr>':''}${cells.join('')}</w:tr>`;}
function tbl(rows,widths=[]){return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>${widths.length?`<w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`:''}${rows.join('')}</w:tbl>`;}
function headerDoc(setup,title,code=''){
  const left=wP(setup.parentOrg,{align:'center',b:true,size:22})+wP(setup.schoolName,{align:'center',b:true,size:22})+wP(setup.schoolLine2,{align:'center',b:true,size:22});
  const right=wP(title,{align:'center',b:true,size:22})+wP(`NĂM HỌC ${setup.schoolYear}`,{align:'center',b:true,size:22})+wP(`Môn: Giáo dục công dân – Lớp ${setup.grade}`,{align:'center',b:true,size:22})+(code?wP(`ĐỀ ${code}`,{align:'center',b:true,size:22}):'');
  return tbl([tr([tc(left,{width:4700}),tc(right,{width:4700})])],[4700,4700]);
}
function matrixDoc(){
  const rows=[];
  rows.push(tr([tc('TT',{vMerge:true,fill:'EDEBFA'}),tc('Mạch nội dung',{vMerge:true,fill:'EDEBFA'}),tc('Nội dung/chủ đề/bài',{vMerge:true,fill:'EDEBFA'}),tc('Mức độ nhận thức',{span:6,fill:'EDEBFA'}),tc('Tổng điểm',{vMerge:true,fill:'EDEBFA'})],{header:true}));
  rows.push(tr([tc('',{vMerge:false}),tc('',{vMerge:false}),tc('',{vMerge:false}),...LEVELS.flatMap(l=>[tc(l.label,{span:2,fill:'EDEBFA'})]),tc('',{vMerge:false})],{header:true}));
  rows.push(tr([tc('',{vMerge:false}),tc('',{vMerge:false}),tc('',{vMerge:false}),...LEVELS.flatMap(()=>[tc('TNKQ',{fill:'EDEBFA'}),tc('TL',{fill:'EDEBFA'})]),tc('',{vMerge:false})],{header:true}));
  selectedLessons().forEach((l,i)=>{const m=ensureLessonMatrix(l.id);rows.push(tr([tc(String(i+1)),tc(l.track),tc(`Bài ${l.num}. ${l.title}`),...LEVELS.flatMap(lev=>[tc(cellCompact(m[lev.id].tn,'tn')||''),tc(cellCompact(m[lev.id].tl,'tl')||'')]),tc(fmt(lessonPoints(l.id)))]));});
  const total=totalPoints(),pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  rows.push(tr([tc('Tổng số câu',{span:3}),...LEVELS.flatMap(l=>[tc(countFmt(levelCount(l.id)),{span:2})]),tc(fmt(total))]));
  rows.push(tr([tc('Tỉ lệ %',{span:3}),...pct.flatMap(x=>[tc(`${fmt(x)}%`,{span:2})]),tc(total?'100%':'0%')]));
  rows.push(tr([tc('Tỉ lệ chung',{span:3}),tc(`NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%`,{span:4}),tc(`VD: ${fmt(pct[2]||0)}%`,{span:2}),tc('')]));
  return tbl(rows);
}
function specTextCell(l){
  let xml=''; const t=ensureTeacherSpec(l.id);
  LEVELS.forEach(lev=>{xml+=wP(`${lev.label}:`,{b:true,size:20,after:15});xml+=wP(l.descriptor?.[lev.key]||'—',{size:20,after:25});if(t[lev.id]){xml+=wP('Đặc tả bổ sung của giáo viên:',{b:true,size:20,after:15});xml+=wP(t[lev.id],{size:20,after:25});}});return xml;
}
function specDoc(){
  const rows=[tr([tc('TT',{fill:'EDEBFA'}),tc('Mạch nội dung',{fill:'EDEBFA'}),tc('Nội dung/chủ đề/bài',{fill:'EDEBFA'}),tc('Mức độ đánh giá',{fill:'EDEBFA'}),...LEVELS.map(l=>tc(l.label,{fill:'EDEBFA'}))],{header:true})];
  selectedLessons().forEach((l,i)=>{const m=ensureLessonMatrix(l.id);rows.push(tr([tc(String(i+1)),tc(l.track),tc(`Bài ${l.num}. ${l.title}`),tc(specTextCell(l)),...LEVELS.map(lev=>tc([cellCompact(m[lev.id].tn,'tn'),cellCompact(m[lev.id].tl,'tl')].filter(Boolean).join('\n')))]));});
  const total=totalPoints(),pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  rows.push(tr([tc('Tổng số câu hỏi',{span:4}),...LEVELS.map(l=>tc(countFmt(levelCount(l.id))))]));
  rows.push(tr([tc('Tỉ lệ %',{span:4}),...pct.map(x=>tc(`${fmt(x)}%`))]));
  rows.push(tr([tc('Tỉ lệ chung',{span:4}),tc(`NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%`,{span:2}),tc(`VD: ${fmt(pct[2]||0)}%`)]));
  return tbl(rows);
}
function qDoc(q){
  let xml=wP(`Câu ${q.number} (${fmt(q.points)} điểm): ${q.prompt||''}`,{b:false,size:24,after:50});
  if(q.options?.length) q.options.forEach((x,i)=>xml+=wP(`${String.fromCharCode(65+i)}. ${x}`,{size:24,after:20}));
  if(q.statements?.length){q.statements.forEach((x,i)=>xml+=wP(`${x.label||String.fromCharCode(97+i)}. ${x.text||x}`,{size:24,after:20}));}
  if(q.pairsLeft?.length){const pairs=[];const max=Math.max(q.pairsLeft.length,(q.pairsRight||[]).length);for(let i=0;i<max;i++)pairs.push(tr([tc(`${i+1}. ${q.pairsLeft[i]||''}`),tc(`${String.fromCharCode(97+i)}. ${(q.pairsRight||[])[i]||''}`)]));xml+=tbl(pairs);}
  if(q.parts?.length)q.parts.forEach((p,i)=>xml+=wP(`${p.label||String.fromCharCode(97+i)} (${fmt(p.points)} điểm). ${p.prompt||''}`,{size:24,after:35}));
  return xml;
}
function markingDoc(){
  let xml=wP('PHẦN I. ĐÁP ÁN / HƯỚNG DẪN CHẤM', {b:true,size:24});
  (state.exam.examCodes||[]).forEach(code=>{
    xml+=wP(`ĐỀ ${code.code}`,{b:true,size:24});
    const rows=[tr([tc('Câu',{fill:'EDEBFA'}),tc('Đáp án / Yêu cầu cần đạt',{fill:'EDEBFA'}),tc('Điểm',{fill:'EDEBFA'})],{header:true})];
    (code.questions||[]).forEach(q=>{
      let ans='';
      if(typeof q.answer==='string')ans=q.answer; else if(q.answer&&typeof q.answer==='object')ans=Object.entries(q.answer).map(([k,v])=>`${k}: ${typeof v==='boolean'?(v?'Đ':'S'):v}`).join('; ');
      if(q.parts?.length) ans=q.parts.map(p=>`${p.label||''}: ${p.answer||''}`).join('\n');
      const rub=[...(q.rubric||[]),...(q.parts||[]).flatMap(p=>p.rubric||[])];
      const detail=ans+(rub.length?'\n'+rub.map(r=>`- ${r.content} (${fmt(r.points)}đ)`).join('\n'):'');
      rows.push(tr([tc(String(q.number)),tc(detail),tc(fmt(q.points))]));
    });
    xml+=tbl(rows);
  });
  if(setupValue().disabledGuide){xml+=wP('HƯỚNG DẪN CHẤM DÀNH CHO HỌC SINH KHUYẾT TẬT',{b:true,size:24,before:120});xml+=wP(state.exam.disabilityGuide||'Giáo viên căn cứ kế hoạch giáo dục cá nhân và quy định hiện hành để điều chỉnh yêu cầu, không tự động giảm chuẩn nếu chưa có căn cứ.',{size:24});}
  xml+=wP('LƯU Ý: Phần tự luận chấp nhận các câu trả lời có ý nghĩa tương đương nếu phù hợp với yêu cầu của câu hỏi, chuẩn mực đạo đức và quy định pháp luật trong nguồn được sử dụng.',{i:true,size:22,before:100});
  return xml;
}
async function exportDocx(){
  if(!window.JSZip) return alert('Thiếu JSZip.'); if(!state.exam?.examCodes?.length)return alert('Chưa có đề để xuất.');
  const setup=setupValue(); let body='';
  body+=headerDoc(setup,setup.examType);body+=wP('I. MỤC TIÊU ĐỀ KIỂM TRA',{b:true,size:24,before:100});body+=wP(`Thu thập thông tin để đánh giá mức độ đạt yêu cầu cần đạt môn Giáo dục công dân lớp ${setup.grade} theo các bài: ${selectedLessons().map(l=>l.title).join('; ')}.`,{size:24});
  body+=wP('II. HÌNH THỨC ĐỀ KIỂM TRA',{b:true,size:24,before:100});body+=wP(setup.mode==='7991'?'Kiểm tra theo lựa chọn “Ra đề theo Công văn 7991”, kết hợp TNKQ và tự luận theo ma trận đã thiết lập.':'Kiểm tra kết hợp TNKQ và tự luận theo ma trận đã thiết lập.',{size:24});
  body+=wP('III. THIẾT LẬP MA TRẬN, ĐẶC TẢ',{b:true,size:24,before:100});body+=wP('1. Khung ma trận',{b:true,size:24});body+=matrixDoc();body+=wP('2. Bản đặc tả',{b:true,size:24,before:100});body+=specDoc();
  body+=wP('IV. BIÊN SOẠN ĐỀ KIỂM TRA (trang sau)',{b:true,size:24,before:100});body+=wP('',{pageBreak:true});
  state.exam.examCodes.forEach((code,idx)=>{body+=headerDoc(setup,setup.examType,code.code);body+=wP(`Thời gian làm bài: ${setup.duration} phút (không kể thời gian phát đề)`,{align:'center',b:true,size:22});body+=wP('Họ và tên học sinh: ...............................................................................  Lớp: ........',{size:22});(code.questions||[]).forEach(q=>body+=qDoc(q));body+=wP('----- HẾT -----',{align:'center',b:true,size:22,before:120});body+=wP('',{pageBreak:true});});
  body+=headerDoc(setup,`HƯỚNG DẪN CHẤM ${setup.examType}`);body+=markingDoc();
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1418" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const drels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const zip=new JSZip();zip.file('[Content_Types].xml',ct);zip.folder('_rels').file('.rels',rels);zip.folder('word').file('document.xml',doc).file('styles.xml',styles).folder('_rels').file('document.xml.rels',drels);
  const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Bo-de-GDCD${setup.grade}-${setup.examType.replace(/\s+/g,'-')}.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function bind(){
  $('#versionBadge').textContent='V'+(CFG.APP_VERSION||'2.0.0');$('#apiGuide').href=CFG.API_GUIDE_URL||'#';
  $$('.step-btn').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.step)));
  $$('.next-btn').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.next)));
  $$('.prev-btn').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.prev)));
  $('#grade').addEventListener('change',e=>{state.grade=e.target.value;state.selected.clear();state.matrix={};state.teacherSpec={};state.exam=null;renderLessons();});
  $('#clearLessons').addEventListener('click',()=>{state.selected.clear();renderLessons();});
  $('#toggleKey').addEventListener('click',()=>{$('#apiKey').type=$('#apiKey').type==='password'?'text':'password';});
  $('#testApiBtn').addEventListener('click',testApi);$('#modelSelect').addEventListener('change',e=>state.model=e.target.value);
  $('input[name="mode"][value="7991"]').addEventListener('change',()=>{renderMatrix();});$('input[name="mode"][value="normal"]').addEventListener('change',()=>{renderMatrix();});
  $('#addConfigBtn').addEventListener('click',()=>{state.dialog.rows.push({subtype:'mcq',count:1,points:.25});renderConfigRows();});
  $('#closeDialog').addEventListener('click',()=>$('#matrixDialog').close());$('#cancelDialog').addEventListener('click',()=>$('#matrixDialog').close());
  $('#matrixForm').addEventListener('submit',e=>{e.preventDefault();const d=state.dialog;ensureLessonMatrix(d.lessonId)[d.level][d.form]=d.rows.filter(r=>nval(r.count)>0&&nval(r.points)>0);$('#matrixDialog').close();renderMatrix();});
  $('#generateBtn').addEventListener('click',generateExam);$('#exportDocxBtn').addEventListener('click',exportDocx);
  $('#grade').value=state.grade;renderLessons();renderMatrix();renderSpec();renderAudit();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
