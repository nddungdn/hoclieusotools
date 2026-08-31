(() => {
'use strict';
const CFG = window.APP_CONFIG || {};
const DATA = window.GDCD_DATA || {grades:{}};
const LEVELS = [
  {id:'nb', label:'Nhận biết', key:'nhan_biet'},
  {id:'th', label:'Thông hiểu', key:'thong_hieu'},
  {id:'vd', label:'Vận dụng', key:'van_dung'}
];
const formsForLevel = level => level==='vd' ? ['tl'] : ['tn','tl'];
const POINTS = [0.25,0.5,0.75,1,1.5,2,2.5,3];
const SUBTYPES_NORMAL = [
  ['single','Một lựa chọn đúng nhất'],['multiple','Nhiều lựa chọn đúng'],['truefalse','Đúng / Sai'],['short','Trả lời ngắn'],['matching','Nối']
];
const SUBTYPES_7991 = [
  ['single','Một lựa chọn đúng nhất'],['truefalse','Đúng / Sai'],['short','Trả lời ngắn']
];
const ESSAY_TYPES = [['direct','Câu hỏi trực tiếp'],['situation','Câu hỏi sử dụng tình huống']];
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
function parsePartPoints(value){
  if(Array.isArray(value)) return value.map(nval).filter(x=>x>0);
  return String(value||'').split(';').map(x=>nval(x.trim())).filter(x=>x>0);
}
function allConfigs(){
  const out=[];
  selectedLessons().forEach(l=>LEVELS.forEach(lev=>formsForLevel(lev.id).forEach(form=>{
    (ensureLessonMatrix(l.id)[lev.id][form]||[]).forEach((r,idx)=>{
      const partsCount=form==='tl'?Math.max(1,Math.min(4,Number(r.partsCount||1))):0;
      let partPoints=form==='tl'?parsePartPoints(r.partPoints):[];
      if(form==='tl' && partsCount===1) partPoints=[nval(r.points)];
      out.push({
        id:`${l.id}_${lev.id}_${form}_${idx}`,
        lessonId:l.id, lessonTitle:l.title, strand:l.track, level:lev.id, levelName:lev.label,
        form:form==='tn'?'TNKQ':'TL', subtype:form==='tn'?(r.subtype||'single'):'essay',
        essayType:form==='tl'?(r.essayType||'direct'):undefined,
        partsCount, partPoints,
        count:nval(r.count), pointsPerQuestion:nval(r.points), total:nval(r.count)*nval(r.points)
      });
    });
  })));
  return out.filter(x=>x.count>0 && x.pointsPerQuestion>0);
}
function totalPoints(){ return allConfigs().reduce((s,x)=>s+x.total,0); }
function levelPoints(level){ return allConfigs().filter(x=>x.level===level).reduce((s,x)=>s+x.total,0); }
function levelCount(level){ return allConfigs().filter(x=>x.level===level).reduce((s,x)=>s+x.count,0); }
function lessonPoints(id){ return allConfigs().filter(x=>x.lessonId===id).reduce((s,x)=>s+x.total,0); }
function formLabel(sub){ return ({single:'Một lựa chọn đúng nhất',multiple:'Nhiều lựa chọn đúng',mcq:'Một lựa chọn đúng nhất',truefalse:'Đúng / Sai',matching:'Nối',short:'Trả lời ngắn',essay:'Tự luận'})[sub] || sub; }
function essayTypeLabel(v){return ({direct:'Câu hỏi trực tiếp',situation:'Câu hỏi sử dụng tình huống'})[v]||v;}
function stripChoiceLabel(x){return String(x??'').replace(/^\s*[A-Ha-h][\.\)]\s*/,'').trim();}
function hash32(text){
  let h=2166136261>>>0;
  for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return h>>>0;
}
function seededShuffle(arr,seed){
  const out=arr.slice();let x=(seed>>>0)||0x9e3779b9;
  for(let i=out.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=x%(i+1);[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function remapChoiceLetter(letter,a,b){
  const x=String(letter||'').trim().toUpperCase();
  const A=String.fromCharCode(65+a),B=String.fromCharCode(65+b);
  if(x===A)return B;if(x===B)return A;return x;
}
function moveCorrectAnswerTo(q,targetLetter){
  if(!q||!Array.isArray(q.options)||q.options.length!==4)return;
  const current=String(q.answer||'').trim().toUpperCase();
  const ci=current.charCodeAt(0)-65,ti=String(targetLetter).charCodeAt(0)-65;
  if(ci<0||ci>3||ti<0||ti>3||ci===ti){if(ti>=0&&ti<4)q.answer=String(targetLetter);return;}
  [q.options[ci],q.options[ti]]=[q.options[ti],q.options[ci]];
  q.answer=String(targetLetter);
  if(q.distractor)q.distractor=remapChoiceLetter(q.distractor,ci,ti);
}
function balanceSingleChoiceAnswers(exam){
  if(!exam?.examCodes?.length)return exam;
  exam.examCodes.forEach((code,codeIndex)=>{
    const singles=(code.questions||[]).filter(q=>q.form==='TNKQ'&&(q.subtype==='single'||q.subtype==='mcq')&&Array.isArray(q.options)&&q.options.length===4);
    if(!singles.length)return;
    const labels=Array.from({length:singles.length},(_,i)=>String.fromCharCode(65+(i%4)));
    const seed=hash32(`${code.code||codeIndex}|${singles.length}|${singles.map(q=>q.prompt||q.context||'').join('|')}`);
    const targets=seededShuffle(labels,seed);
    singles.forEach((q,i)=>moveCorrectAnswerTo(q,targets[i]));
  });
  return exam;
}
function slugAscii(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
function cellSummary(rows, form){
  if(!rows?.length) return 'Chưa chọn';
  return rows.map(r=>`${countFmt(r.count)} câu × ${fmt(r.points)}đ · ${form==='tn'?formLabel(r.subtype):essayTypeLabel(r.essayType||'direct')+(Number(r.partsCount||1)>1?` · ${Number(r.partsCount)} ý [${parsePartPoints(r.partPoints).map(fmt).join(' + ')}đ]`:'')}`).join('\n');
}
function cellCompact(rows,form){
  if(!rows?.length) return '';
  const count=rows.reduce((s,r)=>s+nval(r.count),0), pts=rows.reduce((s,r)=>s+nval(r.count)*nval(r.points),0);
  return `${countFmt(count)} ${form==='tn'?'TNKQ':'TL'} (${fmt(pts)} điểm)`;
}
function descriptorLines(text){
  const t=String(text||'').replace(/\r/g,'').replace(/\s+-\s+/g,'\n- ').trim();
  if(!t)return [];
  return t.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>({bullet:/^-\s*/.test(x),text:x.replace(/^-\s*/, '')}));
}
function descriptorHtml(text){
  const lines=descriptorLines(text); if(!lines.length)return '<span class="muted">—</span>';
  let out='', list=[]; const flush=()=>{if(list.length){out+=`<ul class="spec-bullets">${list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;list=[];}};
  lines.forEach(x=>{if(x.bullet)list.push(x.text);else{flush();out+=`<p class="spec-line">${esc(x.text)}</p>`;}});flush();return out;
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
    mode:mode(), disabledGuide:$('#disabledGuide').checked, disabledType:$('#disabledType')?.value||'intellectual', disabledScoring:$('#disabledScoring')?.value||'tn_scale10', disabledNote:$('#disabledNote')?.value?.trim()||'', extraNotes:$('#extraNotes').value.trim()
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
  if(!lessons.length){$('#matrixBody').innerHTML='<tr><td colspan="9">Chưa chọn bài. Quay lại bước 2.</td></tr>';$('#matrixFoot').innerHTML='';return;}
  $('#matrixBody').innerHTML=lessons.map((l,i)=>{
    const m=ensureLessonMatrix(l.id);
    const cells=LEVELS.flatMap(lev=>formsForLevel(lev.id).map(form=>`<td><button class="matrix-cell-btn ${(m[lev.id][form]||[]).length?'has-data':''}" data-mcell="${l.id}|${lev.id}|${form}"><span class="cell-summary">${esc(cellSummary(m[lev.id][form],form))}</span></button></td>`)).join('');
    return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><strong>Bài ${l.num}</strong><br>${esc(l.title)}</td>${cells}<td><strong>${fmt(lessonPoints(l.id))}</strong></td></tr>`;
  }).join('');
  const total=totalPoints();
  const pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  $('#matrixFoot').innerHTML=`<tr class="matrix-foot"><td colspan="3"><strong>Tổng số câu</strong></td><td colspan="2">${countFmt(levelCount('nb'))}</td><td colspan="2">${countFmt(levelCount('th'))}</td><td>${countFmt(levelCount('vd'))}</td><td><strong>${fmt(total)}</strong></td></tr>
  <tr class="matrix-foot"><td colspan="3"><strong>Tỉ lệ %</strong></td><td colspan="2">${fmt(pct[0])}%</td><td colspan="2">${fmt(pct[1])}%</td><td>${fmt(pct[2])}%</td><td>${total?'100%':'0%'}</td></tr>
  <tr class="matrix-foot"><td colspan="3"><strong>Tỉ lệ chung</strong></td><td colspan="4">NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%</td><td>VD: ${fmt(pct[2]||0)}%</td><td></td></tr>`;
  $('#matrixNotice').innerHTML = Math.abs(total-10)<0.001 ? `<span class="success-text">✓ Tổng điểm ma trận: 10,0 điểm.</span>` : `<span class="warning-text">⚠ Tổng điểm hiện tại: ${fmt(total)} điểm. Cần điều chỉnh về 10,0 điểm trước khi tạo đề.</span>`;
  $$('[data-mcell]').forEach(b=>b.addEventListener('click',()=>openMatrixDialog(...b.dataset.mcell.split('|'))));
}
function openMatrixDialog(lessonId,level,form){
  if(level==='vd' && form==='tn') return;
  const l=lessonById(lessonId), lev=LEVELS.find(x=>x.id===level);
  const existing=JSON.parse(JSON.stringify(ensureLessonMatrix(lessonId)[level][form]||[]));
  if(!existing.length)existing.push(form==='tn'?{subtype:'single',count:1,points:.25}:{essayType:'direct',count:1,points:1,partsCount:1,partPoints:[1]});
  state.dialog={lessonId,level,form,rows:existing};
  $('#dialogLesson').textContent=`Bài ${l.num}. ${l.title}`;
  $('#dialogTitle').textContent=`${lev.label} · ${form==='tn'?'Trắc nghiệm':'Tự luận'}`;
  renderConfigRows(); $('#matrixDialog').showModal();
}
function subtypeOptions(current){
  const arr=mode()==='7991'?SUBTYPES_7991:SUBTYPES_NORMAL;
  const cur=current==='mcq'?'single':current;
  return arr.map(([v,t])=>`<option value="${v}" ${v===cur?'selected':''}>${t}</option>`).join('');
}
function essayTypeOptions(current){return ESSAY_TYPES.map(([v,t])=>`<option value="${v}" ${v===(current||'direct')?'selected':''}>${t}</option>`).join('');}
function pointOptions(v){
  const val=nval(v), standard=POINTS.some(x=>Math.abs(x-val)<1e-9);
  return POINTS.map(p=>`<option value="${p}" ${standard&&p===val?'selected':''}>${fmt(p)} điểm</option>`).join('')+`<option value="custom" ${!standard?'selected':''}>Khác...</option>`;
}
function defaultPartPoints(points,count){
  points=nval(points)||1;count=Math.max(1,Number(count||1));
  if(count===1)return [points];
  const base=Math.floor(points/count*100)/100, arr=Array(count).fill(base);
  arr[count-1]=Math.round((points-arr.slice(0,-1).reduce((a,b)=>a+b,0))*100)/100;
  return arr;
}
function renderConfigRows(){
  const d=state.dialog; if(!d)return;
  if(!d.rows.length){
    $('#configRows').innerHTML='<div class="empty-config-state"><strong>Đã xóa toàn bộ cấu hình của ô này.</strong><br><span class="tiny">Nhấn “Lưu cấu hình” để xóa thiết lập khỏi ma trận, hoặc “+ Thêm cấu hình” để thiết lập lại.</span></div>';
    updateDialogSummary();
    return;
  }
  $('#configRows').innerHTML=d.rows.map((r,i)=>{
    const partPts=parsePartPoints(r.partPoints); const partsCount=Math.max(1,Number(r.partsCount||1));
    return `<div class="config-row ${d.form==='tl'?'tl-row':'tn-row'}" data-row="${i}">
      ${d.form==='tn'?`<label class="subtype">Kiểu trắc nghiệm<select data-field="subtype">${subtypeOptions(r.subtype||'single')}</select></label>`:`<label class="subtype">Kiểu tự luận<select data-field="essayType">${essayTypeOptions(r.essayType||'direct')}</select></label>`}
      <label>Số câu<input data-field="count" type="number" min="0.5" step="0.5" value="${nval(r.count)||1}" /></label>
      <label>Điểm/câu<select data-field="pointsPreset">${pointOptions(r.points)}</select><input data-field="pointsCustom" type="number" min="0.05" step="0.05" value="${nval(r.points)||.25}" style="${POINTS.includes(nval(r.points))?'display:none':''};margin-top:6px" /></label>
      ${d.form==='tl'?`<label>Số ý/câu<select data-field="partsCount">${[1,2,3,4].map(n=>`<option value="${n}" ${n===partsCount?'selected':''}>${n} ý</option>`).join('')}</select></label><label class="part-points">Điểm từng ý<input data-field="partPoints" value="${esc((partPts.length?partPts:defaultPartPoints(r.points,partsCount)).map(fmt).join('; '))}" placeholder="VD: 1; 1 hoặc 0,5; 1,5"/><small>Dùng dấu ; để ngăn cách. Tổng phải bằng điểm/câu.</small></label>`:''}
      <button type="button" class="btn ghost remove-config" data-remove="${i}" title="Xóa">✕</button>
    </div>`;
  }).join('');
  $$('#configRows [data-row]').forEach(row=>{
    const i=+row.dataset.row;
    row.querySelectorAll('[data-field]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      const f=el.dataset.field;
      if(f==='subtype')d.rows[i].subtype=el.value;
      if(f==='essayType')d.rows[i].essayType=el.value;
      if(f==='count')d.rows[i].count=nval(el.value);
      if(f==='partsCount'){
        d.rows[i].partsCount=Number(el.value); d.rows[i].partPoints=defaultPartPoints(d.rows[i].points,d.rows[i].partsCount);
        renderConfigRows(); return;
      }
      if(f==='partPoints')d.rows[i].partPoints=parsePartPoints(el.value);
      if(f==='pointsPreset'){
        const custom=row.querySelector('[data-field="pointsCustom"]');
        custom.style.display=el.value==='custom'?'block':'none';
        if(el.value!=='custom')d.rows[i].points=nval(el.value); else d.rows[i].points=nval(custom.value);
        if(d.form==='tl' && Number(d.rows[i].partsCount||1)===1)d.rows[i].partPoints=[d.rows[i].points];
      }
      if(f==='pointsCustom'){
        d.rows[i].points=nval(el.value);
        if(d.form==='tl' && Number(d.rows[i].partsCount||1)===1)d.rows[i].partPoints=[d.rows[i].points];
      }
      updateDialogSummary();
    }));
  });
  $$('[data-remove]').forEach(b=>b.addEventListener('click',()=>{d.rows.splice(+b.dataset.remove,1);renderConfigRows();}));
  updateDialogSummary();
}
function validateEssayRows(rows){
  for(const r of rows||[]){
    const pc=Math.max(1,Number(r.partsCount||1)), pp=parsePartPoints(r.partPoints);
    if(nval(r.count)<1 && pc!==1)return 'Cấu hình ½ câu chỉ được dùng như một ý ghép; hãy đặt Số ý/câu = 1.';
    if(pp.length!==pc)return `Cấu hình tự luận ${essayTypeLabel(r.essayType||'direct')}: cần nhập đúng ${pc} mức điểm cho ${pc} ý.`;
    const sum=pp.reduce((a,b)=>a+b,0);
    if(Math.abs(sum-nval(r.points))>.001)return `Tổng điểm các ý (${fmt(sum)}) phải bằng điểm/câu (${fmt(r.points)}).`;
  }
  return '';
}
function updateDialogSummary(){
  const rows=state.dialog?.rows||[]; const pts=rows.reduce((s,r)=>s+nval(r.count)*nval(r.points),0), cnt=rows.reduce((s,r)=>s+nval(r.count),0);
  const err=state.dialog?.form==='tl'?validateEssayRows(rows):'';
  $('#dialogSummary').innerHTML=`Tổng: ${fmt(cnt)} câu · ${fmt(pts)} điểm${err?`<br><span class="warning-text">⚠ ${esc(err)}</span>`:''}`;
}
function renderSpec(){
  const lessons=selectedLessons();
  if(!lessons.length){$('#specBody').innerHTML='<tr><td colspan="7">Chưa chọn bài.</td></tr>';$('#specFoot').innerHTML='';return;}
  $('#specBody').innerHTML=lessons.map((l,i)=>{
    const t=ensureTeacherSpec(l.id), m=ensureLessonMatrix(l.id);
    const official=LEVELS.map(lev=>`<div class="spec-source-block"><strong>${lev.label}</strong>${descriptorHtml(l.descriptor?.[lev.key]||'')}</div>`).join('');
    const teacher=`<details class="teacher-spec" ${Object.values(t).some(Boolean)?'open':''}><summary>+ Đặc tả bổ sung của giáo viên ${Object.values(t).some(Boolean)?'<span class="teacher-tag">Đang dùng</span>':''}</summary><div class="teacher-spec-grid">${LEVELS.map(lev=>`<label>${lev.label}<textarea data-tspec="${l.id}|${lev.id}" placeholder="Nhập thêm đặc tả ${lev.label.toLowerCase()} cho đúng bài này...">${esc(t[lev.id]||'')}</textarea></label>`).join('')}</div></details>`;
    return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><strong>Bài ${l.num}</strong><br>${esc(l.title)}</td><td><div class="spec-source">${official}</div>${teacher}</td>${LEVELS.map(lev=>`<td class="spec-count">${formsForLevel(lev.id).map(form=>cellCompact(m[lev.id][form],form)).filter(Boolean).map(esc).join('<br>')||'—'}</td>`).join('')}</tr>`;
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
    state.exam=balanceSingleChoiceAnswers(data); renderExam(); box.textContent='✓ Đã tạo đề. Hãy kiểm tra nội dung trước khi xuất Word.';
  }catch(e){box.textContent='✕ '+e.message;}
  finally{btn.disabled=false;}
}
function sectionScore(code,form){return (code?.questions||[]).filter(q=>q.form===form).reduce((s,q)=>s+nval(q.points),0);}
function orderedQuestions(code){
  const qs=(code?.questions||[]).slice();
  const tn=qs.filter(q=>q.form==='TNKQ'), tl=qs.filter(q=>q.form==='TL');
  return [...tn,...tl].map((q,i)=>({...q,number:i+1}));
}
function renderExam(){
  const root=$('#examPreview'); if(!state.exam?.examCodes?.length){root.className='exam-preview empty';root.textContent='AI chưa trả cấu trúc đề hợp lệ.';return;}
  root.className='exam-preview';
  root.innerHTML=state.exam.examCodes.map(code=>{
    const qs=orderedQuestions(code), tn=qs.filter(q=>q.form==='TNKQ'), tl=qs.filter(q=>q.form==='TL');
    return `<div class="preview-code"><h3>ĐỀ ${esc(code.code||'A')}</h3>
      <div class="preview-section"><div class="part-heading">PHẦN I. TRẮC NGHIỆM (${fmt(tn.reduce((s,q)=>s+nval(q.points),0))} điểm)</div>${tnInstruction(tn)?`<div class="tiny">${esc(tnInstruction(tn))}</div>`:''}${tn.map(q=>questionHtml(q)).join('')}</div>
      <div class="preview-section"><div class="part-heading">PHẦN II. TỰ LUẬN (${fmt(tl.reduce((s,q)=>s+nval(q.points),0))} điểm)</div>${tl.map(q=>questionHtml(q)).join('')}</div>
    </div>`;
  }).join('') + (state.exam.notes?.length?`<div class="notice"><b>Lưu ý của AI:</b><ul>${state.exam.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'');
}
function questionHtml(q){
  let body=`<div class="preview-q"><b>Câu ${esc(q.number)} (${fmt(q.points)} điểm):</b>`;
  if(q.context)body+=` <strong>Cho tình huống:</strong> ${esc(q.context)}`;
  if(q.prompt)body+=q.context?`<div class="preview-context">${esc(q.prompt)}</div>`:` ${esc(q.prompt)}`;
  if(q.options?.length) body+=`<div class="preview-options">${q.options.map((x,i)=>`${String.fromCharCode(65+i)}. ${esc(stripChoiceLabel(x))}`).join('<br>')}</div>`;
  if(q.statements?.length){
    if(q.subtype==='truefalse')body+=`<div class="table-scroll"><table class="mini-tf-table"><thead><tr><th>Nhận định</th><th>Đúng</th><th>Sai</th></tr></thead><tbody>${q.statements.map((x,i)=>`<tr><td>${String(x.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')}. ${esc(x.text||x)}</td><td></td><td></td></tr>`).join('')}</tbody></table></div>`;
    else body+=`<div class="preview-options">${q.statements.map((x,i)=>`${String(x.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')}. ${esc(x.text||x)}`).join('<br>')}</div>`;
  }
  if(q.pairsLeft?.length){const max=Math.max(q.pairsLeft.length,(q.pairsRight||[]).length);body+=`<div class="table-scroll"><table class="mini-match-table"><thead><tr><th>Cột A</th><th>Cột B</th></tr></thead><tbody>${Array.from({length:max},(_,i)=>`<tr><td>${i+1}. ${esc(q.pairsLeft[i]||'')}</td><td>${String.fromCharCode(97+i)}. ${esc((q.pairsRight||[])[i]||'')}</td></tr>`).join('')}</tbody></table></div>`;}
  if(q.parts?.length) body+=`<div class="preview-options">${q.parts.map((p,i)=>`${String(p.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')} (${fmt(p.points)} điểm): ${esc(p.prompt||'')}`).join('<br>')}</div>`;
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
function wPParts(parts=[],opt={}){const {align='left',size=26,after=80,before=0,pageBreak=false}=opt;return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${after}" w:before="${before}"/>${pageBreak?'<w:pageBreakBefore/>':''}</w:pPr>${parts.map(x=>wRun(x.text||'',{b:!!x.b,i:!!x.i,size:x.size||size})).join('')}</w:p>`;}
function wRich(lines,opt={}){return (lines||[]).map((x,i)=>wP(x.text??x,{...opt,b:x.bold??opt.b,align:x.align??opt.align,size:x.size??opt.size,after:x.after??opt.after})).join('');}
function tc(content,{span=1,vMerge=null,width=null,align='left',fill=null}={}){return `<w:tc><w:tcPr>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${vMerge===true?'<w:vMerge w:val="restart"/>':vMerge===false?'<w:vMerge/>':''}${width?`<w:tcW w:w="${width}" w:type="dxa"/>`:''}${fill?`<w:shd w:fill="${fill}"/>`:''}<w:vAlign w:val="center"/></w:tcPr>${typeof content==='string'&&content.startsWith('<w:')?content:wP(content,{align,size:20,after:20})}</w:tc>`;}
function tr(cells,{header=false}={}){return `<w:tr>${header?'<w:trPr><w:tblHeader/></w:trPr>':''}${cells.join('')}</w:tr>`;}
function tbl(rows,widths=[]){return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>${widths.length?`<w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`:''}${rows.join('')}</w:tbl>`;}
function headerDoc(setup,title,opts={}){
  const code=opts.code||'';
  const examSheet=Boolean(opts.examSheet);
  const left=wP(setup.parentOrg,{align:'center',b:true,size:22})+wP(setup.schoolName,{align:'center',b:true,size:22})+wP(setup.schoolLine2,{align:'center',b:true,size:22})+(examSheet&&code?wP(`ĐỀ ${code}`,{align:'center',b:true,size:22}):'');
  const right=wP(title,{align:'center',b:true,size:22})+wP(`NĂM HỌC ${setup.schoolYear}`,{align:'center',b:true,size:22})+wP(`Môn: Giáo dục công dân – Lớp ${setup.grade}`,{align:'center',b:true,size:22})+(examSheet?wP(`Thời gian làm bài: ${setup.duration} phút (không kể thời gian phát đề)`,{align:'center',b:true,size:21}):'');
  const rows=[tr([tc(left,{width:4700}),tc(right,{width:4700})])];
  if(examSheet) rows.push(tr([tc(wPParts([{text:'Họ và tên học sinh: ',b:true},{text:'...............................................................................  '},{text:'Lớp: ',b:true},{text:'........'}],{size:21,after:15}),{span:2})]));
  return tbl(rows,[4700,4700]);
}
function matrixDoc(){
  const rows=[];
  rows.push(tr([tc('TT',{vMerge:true,fill:'EDEBFA'}),tc('Mạch nội dung',{vMerge:true,fill:'EDEBFA'}),tc('Nội dung/chủ đề/bài',{vMerge:true,fill:'EDEBFA'}),tc('Mức độ nhận thức',{span:5,fill:'EDEBFA'}),tc('Tổng điểm',{vMerge:true,fill:'EDEBFA'})],{header:true}));
  rows.push(tr([tc('',{vMerge:false}),tc('',{vMerge:false}),tc('',{vMerge:false}),tc('Nhận biết',{span:2,fill:'EDEBFA'}),tc('Thông hiểu',{span:2,fill:'EDEBFA'}),tc('Vận dụng',{fill:'EDEBFA'}),tc('',{vMerge:false})],{header:true}));
  rows.push(tr([tc('',{vMerge:false}),tc('',{vMerge:false}),tc('',{vMerge:false}),tc('TNKQ',{fill:'EDEBFA'}),tc('TL',{fill:'EDEBFA'}),tc('TNKQ',{fill:'EDEBFA'}),tc('TL',{fill:'EDEBFA'}),tc('TL',{fill:'EDEBFA'}),tc('',{vMerge:false})],{header:true}));
  selectedLessons().forEach((l,i)=>{const m=ensureLessonMatrix(l.id);rows.push(tr([tc(String(i+1)),tc(l.track),tc(`Bài ${l.num}. ${l.title}`),tc(cellCompact(m.nb.tn,'tn')||''),tc(cellCompact(m.nb.tl,'tl')||''),tc(cellCompact(m.th.tn,'tn')||''),tc(cellCompact(m.th.tl,'tl')||''),tc(cellCompact(m.vd.tl,'tl')||''),tc(fmt(lessonPoints(l.id)))]));});
  const total=totalPoints(),pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  rows.push(tr([tc('Tổng số câu',{span:3}),tc(countFmt(levelCount('nb')),{span:2}),tc(countFmt(levelCount('th')),{span:2}),tc(countFmt(levelCount('vd'))),tc(fmt(total))]));
  rows.push(tr([tc('Tỉ lệ %',{span:3}),tc(`${fmt(pct[0])}%`,{span:2}),tc(`${fmt(pct[1])}%`,{span:2}),tc(`${fmt(pct[2])}%`),tc(total?'100%':'0%')]));
  rows.push(tr([tc('Tỉ lệ chung',{span:3}),tc(`NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%`,{span:4}),tc(`VD: ${fmt(pct[2]||0)}%`),tc('')]));
  return tbl(rows);
}
function descriptorDoc(text){
  const lines=descriptorLines(text); if(!lines.length)return wP('—',{size:20,after:15});
  return lines.map(x=>wP(`${x.bullet?'– ':''}${x.text}`,{size:20,after:18})).join('');
}
function multiLineDoc(text){return String(text||'').split(/\n+/).filter(Boolean).map(x=>wP(x,{size:20,after:18})).join('');}
function specTextCell(l){
  let xml=''; const t=ensureTeacherSpec(l.id);
  LEVELS.forEach(lev=>{
    xml+=wP(`${lev.label}:`,{b:true,size:20,after:10});
    xml+=descriptorDoc(l.descriptor?.[lev.key]||'');
    if(t[lev.id]){xml+=wP('Đặc tả bổ sung của giáo viên:',{b:true,size:20,after:10});xml+=descriptorDoc(t[lev.id]);}
  });
  return xml;
}
function specCountCell(rows){
  const vals=rows.filter(Boolean); if(!vals.length)return '';
  return vals.map(x=>wP(x,{size:20,after:15})).join('');
}
function specDoc(){
  const rows=[tr([tc('TT',{fill:'EDEBFA'}),tc('Mạch nội dung',{fill:'EDEBFA'}),tc('Nội dung/chủ đề/bài',{fill:'EDEBFA'}),tc('Mức độ đánh giá',{fill:'EDEBFA'}),...LEVELS.map(l=>tc(l.label,{fill:'EDEBFA'}))],{header:true})];
  selectedLessons().forEach((l,i)=>{const m=ensureLessonMatrix(l.id);rows.push(tr([tc(String(i+1)),tc(l.track),tc(`Bài ${l.num}. ${l.title}`),tc(specTextCell(l)),tc(specCountCell([cellCompact(m.nb.tn,'tn'),cellCompact(m.nb.tl,'tl')].filter(Boolean))),tc(specCountCell([cellCompact(m.th.tn,'tn'),cellCompact(m.th.tl,'tl')].filter(Boolean))),tc(specCountCell([cellCompact(m.vd.tl,'tl')].filter(Boolean)))]));});
  const total=totalPoints(),pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  rows.push(tr([tc('Tổng số câu hỏi',{span:4}),...LEVELS.map(l=>tc(countFmt(levelCount(l.id))))]));
  rows.push(tr([tc('Tỉ lệ %',{span:4}),...pct.map(x=>tc(`${fmt(x)}%`))]));
  rows.push(tr([tc('Tỉ lệ chung',{span:4}),tc(`NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%`,{span:2}),tc(`VD: ${fmt(pct[2]||0)}%`)]));
  return tbl(rows);
}
function qDoc(q){
  const prefix=`Câu ${q.number} (${fmt(q.points)} điểm):`;
  let first='';
  if(q.context) first=` Cho tình huống: ${q.context}`;
  else if(q.prompt) first=` ${q.prompt}`;
  let xml=wPParts([{text:prefix,b:true},{text:first}],{size:24,after:45});
  if(q.context&&q.prompt)xml+=wP(q.prompt,{size:24,after:45});
  if(q.options?.length) q.options.forEach((x,i)=>xml+=wP(`${String.fromCharCode(65+i)}. ${stripChoiceLabel(x)}`,{size:24,after:20}));
  if(q.statements?.length){
    if(q.subtype==='truefalse'){
      const rows=[tr([tc('Nhận định',{fill:'EDEBFA'}),tc('Đúng',{fill:'EDEBFA'}),tc('Sai',{fill:'EDEBFA'})],{header:true})];
      q.statements.forEach((x,i)=>rows.push(tr([tc(`${String(x.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')}. ${x.text||x}`),tc(''),tc('')])));xml+=tbl(rows);
    }else q.statements.forEach((x,i)=>xml+=wP(`${String(x.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')}. ${x.text||x}`,{size:24,after:20}));
  }
  if(q.pairsLeft?.length){const pairs=[];const max=Math.max(q.pairsLeft.length,(q.pairsRight||[]).length);for(let i=0;i<max;i++)pairs.push(tr([tc(`${i+1}. ${q.pairsLeft[i]||''}`),tc(`${String.fromCharCode(97+i)}. ${(q.pairsRight||[])[i]||''}`)]));xml+=tbl(pairs);}
  if(q.parts?.length)q.parts.forEach((p,i)=>xml+=wP(`${String(p.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')} (${fmt(p.points)} điểm): ${p.prompt||''}`,{size:24,after:35}));
  return xml;
}
function numberRuns(nums){
  nums=[...new Set(nums.map(Number).filter(Number.isFinite))].sort((a,b)=>a-b); if(!nums.length)return '';
  const runs=[];let a=nums[0],b=nums[0];
  for(let i=1;i<nums.length;i++){if(nums[i]===b+1)b=nums[i];else{runs.push([a,b]);a=b=nums[i];}}runs.push([a,b]);
  return runs.map(([x,y])=>x===y?`Câu ${x}`:`Câu ${x} đến Câu ${y}`).join(', ');
}
function tnInstruction(qs){
  const labels={single:'chọn một đáp án đúng nhất',mcq:'chọn một đáp án đúng nhất',multiple:'chọn tất cả đáp án đúng',truefalse:'xác định Đúng/Sai cho từng nhận định',short:'trả lời ngắn',matching:'nối thông tin sao cho phù hợp'};
  const order=['matching','truefalse','single','mcq','multiple','short']; const chunks=[];
  const used=new Set();
  order.forEach(type=>{if(used.has(type))return;const related=type==='single'||type==='mcq'?qs.filter(q=>q.subtype==='single'||q.subtype==='mcq'):qs.filter(q=>q.subtype===type);if(related.length){chunks.push(`${numberRuns(related.map(q=>q.number))}: ${labels[type]}`);used.add(type);if(type==='single'||type==='mcq'){used.add('single');used.add('mcq');}}});
  return chunks.length?`${chunks.join('; ')}. Ghi kết quả vào giấy làm bài kiểm tra.`:'';
}
function answerText(q){
  if(Array.isArray(q.answer))return q.answer.join(', ');
  if(typeof q.answer==='string')return q.answer;
  if(q.answer&&typeof q.answer==='object')return Object.entries(q.answer).map(([k,v])=>`${k}: ${typeof v==='boolean'?(v?'Đ':'S'):v}`).join('; ');
  return '';
}
function splitInlineMarking(raw=''){
  const text=String(raw||'').replace(/\r/g,'').trim();
  if(!text)return {answer:'',rubric:[]};
  const m=text.match(/\*{0,2}_*\s*Hướng\s*dẫn\s*chấm\s*:?\s*_?\*{0,2}/i);
  if(!m)return {answer:text,rubric:[]};
  const answer=text.slice(0,m.index).trim();
  const after=text.slice((m.index||0)+m[0].length).trim();
  return {answer,rubric:splitRubricLines(after)};
}
function splitRubricLines(raw=''){
  let text=String(raw||'').replace(/\r/g,'').trim();
  if(!text)return [];
  text=text
    .replace(/\s+(?=[–—•]\s+)/g,'\n')
    .replace(/\s+(?=-\s+)/g,'\n')
    .replace(/\n{2,}/g,'\n');
  return text.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/^[–—•-]\s*/,'').trim()).filter(Boolean);
}
function answerParagraphs(raw=''){
  let text=String(raw||'').replace(/\r/g,'').trim();
  if(!text)return [];
  return text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
}
function cleanScoreContent(content=''){
  return String(content||'')
    .replace(/\r/g,'')
    .replace(/^\s*Hướng\s*dẫn\s*chấm\s*:?\s*/i,'')
    .replace(/^[–—•-]\s*/,'')
    .replace(/\s*\((?:\d+[\.,]?\d*)\s*(?:đ|điểm)\)\s*$/i,'')
    .trim();
}
function normalizedRubric(rawRubric, inlineRubric=[]){
  if(Array.isArray(rawRubric)&&rawRubric.length){
    return rawRubric.map(r=>({content:cleanScoreContent(r?.content||''),points:r?.points})).filter(r=>r.content);
  }
  return (inlineRubric||[]).map(line=>{
    const m=String(line||'').match(/\((\d+(?:[\.,]\d+)?)\s*(?:đ|điểm)\)\s*$/i);
    return {content:cleanScoreContent(line),points:m?Number(m[1].replace(',','.')):''};
  }).filter(r=>r.content);
}
function markingGuideTitleDoc(){
  return wPParts([{text:'Hướng dẫn chấm:',b:true,i:true}],{size:20,after:18,before:8});
}
function rubricDoc(rubric=[]){
  let xml='';
  (rubric||[]).forEach(r=>{
    const content=cleanScoreContent(r.content||'');
    if(!content)return;
    const suffix=(r.points!==''&&r.points!==undefined&&r.points!==null)?` (${fmt(r.points)}đ)`:'';
    xml+=wPParts([{text:`– ${content}${suffix}`,i:true}],{size:20,after:18});
  });
  return xml;
}
function partMarkingCellDoc(part,index){
  if(!part)return wP('',{size:20,after:18});
  const label=String(part.label||String.fromCharCode(97+index)).replace(/[\.)]$/,'');
  const inline=splitInlineMarking(part.answer||'');
  const rubric=normalizedRubric(part.rubric,inline.rubric);
  let xml='';
  const paras=answerParagraphs(inline.answer);
  if(paras.length){
    paras.forEach((para,j)=>{
      const cleaned=j===0?para.replace(new RegExp(`^\\s*${label}[\\.)]\\s*`,'i'),''):para;
      xml+=wP(`${j===0?label+'. ':''}${cleaned}`,{size:20,after:18});
    });
  }else xml+=wP(`${label}.`,{size:20,after:18});
  if(rubric.length){xml+=markingGuideTitleDoc();xml+=rubricDoc(rubric);}
  return xml;
}
function questionMarkingCellDoc(q){
  if(!q)return wP('',{size:20,after:18});
  const inline=splitInlineMarking(answerText(q));
  const rubric=normalizedRubric(q.rubric,inline.rubric);
  let xml='';
  answerParagraphs(inline.answer).forEach(para=>xml+=wP(para,{size:20,after:18}));
  if(rubric.length){xml+=markingGuideTitleDoc();xml+=rubricDoc(rubric);}
  return xml||wP('',{size:20,after:18});
}
function disabilityGuideDoc(tnScore){
  const setup=setupValue(); if(!setup.disabledGuide)return '';
  let xml=wP('HƯỚNG DẪN CHẤM DÀNH CHO HỌC SINH KHUYẾT TẬT',{b:true,size:24,before:120});
  const note=setup.disabledNote?` Ghi chú của giáo viên: ${setup.disabledNote}`:'';
  if(setup.disabledType==='intellectual'&&setup.disabledScoring==='tn_scale10'){
    xml+=wP('Đối tượng: học sinh khuyết tật trí tuệ khi giáo viên xác nhận phương án này phù hợp với kế hoạch giáo dục cá nhân (IEP/KHGD cá nhân) của học sinh.',{size:22});
    xml+=wP(`Yêu cầu làm bài: chỉ thực hiện PHẦN I. TRẮC NGHIỆM của đề. Tổng điểm gốc của phần trắc nghiệm là ${fmt(tnScore)} điểm.`,{size:22});
    xml+=wP(`Cách quy đổi: Điểm kiểm tra = (Điểm trắc nghiệm học sinh đạt được / ${fmt(tnScore)}) × 10. Kết quả làm tròn đến một chữ số thập phân.`,{b:true,size:22});
    if(note)xml+=wP(note.trim(),{size:22});
  }else if(setup.disabledScoring==='same_exam'){
    xml+=wP('Học sinh làm cùng cấu trúc đề và thang điểm; giáo viên điều chỉnh cách trình bày, thời gian, phương thức tiếp nhận/trả lời theo nhu cầu giáo dục đặc biệt và kế hoạch giáo dục cá nhân.',{size:22});
    if(note)xml+=wP(note.trim(),{size:22});
  }else{
    xml+=wP('Thực hiện theo hướng dẫn riêng của giáo viên và kế hoạch giáo dục cá nhân của học sinh; không tự động thay đổi chuẩn đánh giá khi chưa có căn cứ.',{size:22});
    if(note)xml+=wP(note.trim(),{size:22});
  }
  return xml;
}
function tnScoreNoteDoc(codes){
  const qs=codes?.length?orderedQuestions(codes[0]).filter(q=>q.form==='TNKQ'):[];
  if(!qs.length)return '';
  const label={single:'Một lựa chọn đúng nhất',mcq:'Một lựa chọn đúng nhất',multiple:'Nhiều lựa chọn đúng',truefalse:'Đúng / Sai',short:'Trả lời ngắn',matching:'Nối'};
  const groups=new Map();
  qs.forEach(q=>{
    const type=q.subtype==='mcq'?'single':q.subtype;
    const key=`${type}|${nval(q.points)}`;
    if(!groups.has(key))groups.set(key,{type,points:nval(q.points)});
  });
  const vals=[...groups.values()];
  if(vals.length===1)return wP(`Mỗi câu đúng được ${fmt(vals[0].points)} điểm.`,{i:true,size:21,after:45});
  return vals.map(g=>wP(`${label[g.type]||formLabel(g.type)}: Mỗi câu đúng được ${fmt(g.points)} điểm.`,{i:true,size:21,after:25})).join('');
}
function tnAnswerTable(codes){
  const codeQs=codes.map(c=>orderedQuestions(c).filter(q=>q.form==='TNKQ'));
  const max=Math.max(0,...codeQs.map(x=>x.length)); if(!max)return '';
  const rows=[];
  const top=[tc('Câu',{fill:'EDEBFA'})];
  for(let i=0;i<max;i++){const q=codeQs[0]?.[i];top.push(tc(q?String(q.number):String(i+1),{fill:'EDEBFA'}));}
  rows.push(tr(top,{header:true}));
  codes.forEach((code,ci)=>{const row=[tc(`Đề ${code.code}`,{fill:'F8F7FC'})];for(let i=0;i<max;i++){const q=codeQs[ci]?.[i];row.push(tc(q?answerText(q):''));}rows.push(tr(row));});
  return tbl(rows);
}
function pairedEssayMarkingTable(codes){
  const essays=codes.map(c=>orderedQuestions(c).filter(q=>q.form==='TL'));
  const max=Math.max(0,...essays.map(x=>x.length)); if(!max)return '';
  const headCau=wP('Câu',{b:true,align:'center',size:20,after:20});
  const headTitle=wP('Yêu cầu cần đạt / Hướng dẫn chấm',{b:true,align:'center',size:20,after:20});
  const headDiem=wP('Điểm',{b:true,align:'center',size:20,after:20});
  if(codes.length>=2){
    const rows=[
      tr([tc(headCau,{vMerge:true,fill:'EDEBFA',align:'center'}),tc(headTitle,{span:2,fill:'EDEBFA',align:'center'}),tc(headDiem,{vMerge:true,fill:'EDEBFA',align:'center'})],{header:true}),
      tr([tc('',{vMerge:false}),tc(wP(`ĐỀ ${codes[0].code}`,{b:true,align:'center',size:20,after:20}),{fill:'EDEBFA',align:'center'}),tc(wP(`ĐỀ ${codes[1].code}`,{b:true,align:'center',size:20,after:20}),{fill:'EDEBFA',align:'center'}),tc('',{vMerge:false})],{header:true})
    ];
    for(let i=0;i<max;i++){
      const a=essays[0]?.[i], b=essays[1]?.[i];
      const no=a?.number??b?.number??'';
      const pts=a?.points??b?.points??'';
      const ap=a?.parts?.length?a.parts:null;
      const bp=b?.parts?.length?b.parts:null;
      const subrows=Math.max(ap?.length||1,bp?.length||1);
      for(let j=0;j<subrows;j++){
        const aDoc=ap?partMarkingCellDoc(ap[j],j):(j===0?questionMarkingCellDoc(a):wP('',{size:20,after:18}));
        const bDoc=bp?partMarkingCellDoc(bp[j],j):(j===0?questionMarkingCellDoc(b):wP('',{size:20,after:18}));
        if(subrows===1){
          rows.push(tr([tc(String(no),{align:'center'}),tc(aDoc),tc(bDoc),tc(fmt(pts),{align:'center'})]));
        }else if(j===0){
          rows.push(tr([tc(String(no),{vMerge:true,align:'center'}),tc(aDoc),tc(bDoc),tc(fmt(pts),{vMerge:true,align:'center'})]));
        }else{
          rows.push(tr([tc('',{vMerge:false,align:'center'}),tc(aDoc),tc(bDoc),tc('',{vMerge:false,align:'center'})]));
        }
      }
    }
    return tbl(rows,[650,4100,4100,650]);
  }
  const rows=[tr([tc(headCau,{fill:'EDEBFA',align:'center'}),tc(headTitle,{fill:'EDEBFA',align:'center'}),tc(headDiem,{fill:'EDEBFA',align:'center'})],{header:true})];
  essays[0].forEach(q=>{
    const parts=q?.parts?.length?q.parts:null;
    const subrows=parts?.length||1;
    for(let j=0;j<subrows;j++){
      const cell=parts?partMarkingCellDoc(parts[j],j):questionMarkingCellDoc(q);
      if(subrows===1)rows.push(tr([tc(String(q.number),{align:'center'}),tc(cell),tc(fmt(q.points),{align:'center'})]));
      else if(j===0)rows.push(tr([tc(String(q.number),{vMerge:true,align:'center'}),tc(cell),tc(fmt(q.points),{vMerge:true,align:'center'})]));
      else rows.push(tr([tc('',{vMerge:false,align:'center'}),tc(cell),tc('',{vMerge:false,align:'center'})]));
    }
  });
  return tbl(rows,[650,8200,650]);
}
function markingDoc(){
  let xml=''; const codes=state.exam.examCodes||[];
  const tnScore=codes.length?sectionScore(codes[0],'TNKQ'):0, tlScore=codes.length?sectionScore(codes[0],'TL'):0;
  xml+=wP(`PHẦN I. TRẮC NGHIỆM (${fmt(tnScore)} điểm)`,{b:true,size:24});
  xml+=tnScoreNoteDoc(codes);
  xml+=tnAnswerTable(codes);
  xml+=wP(`PHẦN II. TỰ LUẬN (${fmt(tlScore)} điểm)`,{b:true,size:24,before:120});
  xml+=pairedEssayMarkingTable(codes);
  xml+=disabilityGuideDoc(tnScore);
  xml+=wP('LƯU Ý: Phần tự luận chấp nhận các câu trả lời có ý nghĩa tương đương nếu phù hợp với yêu cầu của câu hỏi, chuẩn mực đạo đức và quy định pháp luật trong nguồn được sử dụng.',{i:true,size:22,before:100});
  return xml;
}
async function exportDocx(){
  if(!window.JSZip) return alert('Thiếu JSZip.'); if(!state.exam?.examCodes?.length)return alert('Chưa có đề để xuất.');
  const setup=setupValue(); let body='';
  body+=headerDoc(setup,setup.examType,{});body+=wP('I. MỤC TIÊU ĐỀ KIỂM TRA',{b:true,size:24,before:100});body+=wP(`Thu thập thông tin để đánh giá mức độ đạt yêu cầu cần đạt môn Giáo dục công dân lớp ${setup.grade} theo các bài: ${selectedLessons().map(l=>l.title).join('; ')}.`,{size:24});
  body+=wP('II. HÌNH THỨC ĐỀ KIỂM TRA',{b:true,size:24,before:100});body+=wP(setup.mode==='7991'?'Kiểm tra theo lựa chọn “Ra đề theo Công văn 7991”, kết hợp TNKQ và tự luận theo ma trận đã thiết lập.':'Kiểm tra kết hợp TNKQ và tự luận theo ma trận đã thiết lập.',{size:24});
  body+=wP('III. THIẾT LẬP MA TRẬN, ĐẶC TẢ',{b:true,size:24,before:100});body+=wP('1. Khung ma trận',{b:true,size:24});body+=matrixDoc();body+=wP('2. Bản đặc tả',{b:true,size:24,before:100});body+=specDoc();
  body+=wP('IV. BIÊN SOẠN ĐỀ KIỂM TRA (trang sau)',{b:true,size:24,before:100});body+=wP('',{pageBreak:true});
  state.exam.examCodes.forEach((code,idx)=>{
    const qs=orderedQuestions(code), tn=qs.filter(q=>q.form==='TNKQ'), tl=qs.filter(q=>q.form==='TL');
    body+=headerDoc(setup,setup.examType,{code:code.code,examSheet:true});
    body+=wP(`PHẦN I. TRẮC NGHIỆM (${fmt(tn.reduce((s,q)=>s+nval(q.points),0))} điểm)`,{b:true,size:24,before:80});
    const inst=tnInstruction(tn); if(inst)body+=wP(inst,{size:22,after:60});
    tn.forEach(q=>body+=qDoc(q));
    body+=wP(`PHẦN II. TỰ LUẬN (${fmt(tl.reduce((s,q)=>s+nval(q.points),0))} điểm)`,{b:true,size:24,before:100});
    tl.forEach(q=>body+=qDoc(q));
    body+=wP('----- HẾT -----',{align:'center',b:true,size:22,before:120});body+=wP('',{pageBreak:true});
  });
  body+=headerDoc(setup,`HƯỚNG DẪN CHẤM ${setup.examType}`,{});body+=markingDoc();
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1418" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const drels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const zip=new JSZip();zip.file('[Content_Types].xml',ct);zip.folder('_rels').file('.rels',rels);zip.folder('word').file('document.xml',doc).file('styles.xml',styles).folder('_rels').file('document.xml.rels',drels);
  const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`De_GDCD_${setup.grade}_${slugAscii(setup.examType)}_${slugAscii(setup.schoolYear)}.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
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
  $('#addConfigBtn').addEventListener('click',()=>{state.dialog.rows.push(state.dialog.form==='tn'?{subtype:'single',count:1,points:.25}:{essayType:'direct',count:1,points:1,partsCount:1,partPoints:[1]});renderConfigRows();});
  $('#closeDialog').addEventListener('click',()=>$('#matrixDialog').close());$('#cancelDialog').addEventListener('click',()=>$('#matrixDialog').close());
  $('#matrixForm').addEventListener('submit',e=>{e.preventDefault();const d=state.dialog;if(d.form==='tl'){const err=validateEssayRows(d.rows);if(err){alert(err);return;}}ensureLessonMatrix(d.lessonId)[d.level][d.form]=d.rows.filter(r=>nval(r.count)>0&&nval(r.points)>0);$('#matrixDialog').close();renderMatrix();});
  $('#generateBtn').addEventListener('click',generateExam);$('#exportDocxBtn').addEventListener('click',exportDocx);
  const syncDisabled=()=>$('#disabledOptions')?.classList.toggle('hidden',!$('#disabledGuide').checked);
  $('#disabledGuide').addEventListener('change',syncDisabled); syncDisabled();
  $('#grade').value=state.grade;renderLessons();renderMatrix();renderSpec();renderAudit();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
