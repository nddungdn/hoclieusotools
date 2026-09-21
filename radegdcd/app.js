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
const CF_MODELS=[['@cf/meta/llama-3.1-8b-instruct-fp8','Llama 3.1 8B FP8 · mặc định · nhẹ, ít tốn Neurons'],['@cf/zai-org/glm-4.7-flash','GLM 4.7 Flash · dự phòng đa ngôn ngữ'],['@cf/meta/llama-3.3-70b-instruct-fp8-fast','Llama 3.3 70B Fast · dự phòng JSON']];
const SPEC_STORAGE_KEY='radegdcd_spec_overrides_v254';
const state = {
  grade:'6', selected:new Set(), matrix:{}, teacherSpec:{}, specOverrides:{}, specDirty:false, apiOk:false, provider:'cloudflare',
  models:CF_MODELS.map(x=>x[0]), model:CF_MODELS[0][0], exam:null, generationDraft:null, dialog:null, reviewTab:'matrix', reviewProposal:null, editHistory:[], aiReview:null
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt = n => Number(n||0).toLocaleString('vi-VN',{minimumFractionDigits:Number(n)%1?1:0,maximumFractionDigits:2});
const nval = v => Number(String(v ?? '').replace(',','.')) || 0;
const countFmt = n => { n=nval(n); const i=Math.floor(n), f=n-i; if(Math.abs(f-.5)<1e-9) return i?`${i} + ½`:'½'; return fmt(n); };
const mode = () => ($('input[name="mode"]:checked')||{}).value || 'normal';
const apiBase = () => String(CFG.API_BASE||'').replace(/\/$/,'');
const aiProvider=()=>($('input[name="aiProvider"]:checked')||{}).value||'cloudflare';
function aiRequestParams(){const p=aiProvider();return {provider:p,apiKey:p==='gemini'?($('#apiKey')?.value||'').trim():'',model:$('#modelSelect')?.value||state.model,autoFallback:$('#autoProviderFallback')?.checked!==false,fallbackApiKey:p==='cloudflare'?($('#fallbackApiKey')?.value||'').trim():''};}
function modelLabel(id){return Object.fromEntries(CF_MODELS)[id]||id;}

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
function loadSpecOverrides(){
  try{const x=JSON.parse(localStorage.getItem(SPEC_STORAGE_KEY)||'{}');return x&&typeof x==='object'?x:{};}catch{return {};}
}
function specGradeStore(){
  if(!state.specOverrides[state.grade])state.specOverrides[state.grade]={};
  return state.specOverrides[state.grade];
}
function effectiveDescriptor(lesson,lev){
  const saved=state.specOverrides?.[state.grade]?.[lesson?.id]?.[lev.id];
  return typeof saved==='string'?saved:String(lesson?.descriptor?.[lev.key]||'');
}
function setDescriptorOverride(lessonId,levId,value){
  const l=lessonById(lessonId),lev=LEVELS.find(x=>x.id===levId);if(!l||!lev)return;
  const base=String(l.descriptor?.[lev.key]||''),v=String(value||'');const g=specGradeStore();
  if(v.trim()===base.trim()){
    if(g[lessonId]){delete g[lessonId][levId];if(!Object.keys(g[lessonId]).length)delete g[lessonId];}
  }else{
    if(!g[lessonId])g[lessonId]={};g[lessonId][levId]=v;
  }
  state.specDirty=true;updateSpecSaveStatus('Có thay đổi chưa lưu.','warning');
}
function updateSpecSaveStatus(text='',kind='neutral'){
  const el=$('#specSaveStatus');if(!el)return;el.textContent=text;el.className=`spec-save-status ${kind}`;
}
function saveSpecOverrides(){
  try{localStorage.setItem(SPEC_STORAGE_KEY,JSON.stringify(state.specOverrides));state.specDirty=false;updateSpecSaveStatus('✓ Đã lưu đặc tả trên trình duyệt này.','ok');renderReviewWorkspace();return true;}
  catch{updateSpecSaveStatus('Không lưu được trên trình duyệt. Nội dung vẫn được giữ trong phiên hiện tại.','bad');return false;}
}
function resetSelectedSpecOverrides(){
  const g=specGradeStore();selectedLessons().forEach(l=>delete g[l.id]);saveSpecOverrides();renderSpec();renderAudit();renderReviewWorkspace();updateSpecSaveStatus('Đã khôi phục đặc tả gốc của các bài đang chọn.','ok');
}
function effectiveDescriptorObject(lesson){
  return {...(lesson.descriptor||{}),...Object.fromEntries(LEVELS.map(lev=>[lev.key,effectiveDescriptor(lesson,lev)]))};
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

// ===== V2.5.3 DETERMINISTIC EXAM PIPELINE =====
// Không tin điểm do AI tự tính. Điểm được đối chiếu/chuẩn hóa theo ma trận,
// sau đó mới cho phép xem, chỉnh và xuất Word.
const QUALITY_MAX_GENERATE_ATTEMPTS = 1;
const QUALITY_MAX_REPAIR_PASSES = 2;
const QUALITY_REPAIR_CONCURRENCY = 1;
const QUALITY_REPAIR_BUDGET_MS = 180000;
const AI_CLIENT_GAP_MS = 4200;
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const SCORE_EPS = 0.02;
const REPAIRABLE_QUESTION_CATEGORIES = new Set(['Độ dài phương án','Phương án','Đáp án','Phương án nhiễu','Đúng/Sai','Hướng dẫn chấm','Tình huống','Tên nhân vật']);
const scoreRound = n => Math.round(nval(n)*100)/100;
const subtypeKey = x => {
  const s=String(x||'').toLowerCase();
  return s==='mcq'?'single':s;
};
function expectedFormPoints(form){
  return scoreRound(allConfigs().filter(x=>x.form===form).reduce((s,x)=>s+x.total,0));
}
function expectedSlots(form){
  const configs=allConfigs().filter(x=>x.form===form);
  // ½ câu là cấu hình ghép ý. Trường hợp này không suy diễn số object câu hỏi.
  if(configs.some(x=>Math.abs(x.count-Math.round(x.count))>.001))return null;
  const slots=[];
  configs.forEach(c=>{
    for(let i=0;i<Math.round(c.count);i++)slots.push({
      form:c.form, subtype:subtypeKey(c.subtype), essayType:c.essayType||'direct',
      lessonId:c.lessonId, level:c.level, points:scoreRound(c.pointsPerQuestion),
      partsCount:Number(c.partsCount||0), partPoints:(c.partPoints||[]).map(scoreRound)
    });
  });
  return slots;
}
function distributePoints(items,target){
  if(!Array.isArray(items)||!items.length)return;
  target=scoreRound(target);
  const raw=items.map(x=>Math.max(0,nval(x.points)));
  const sum=raw.reduce((a,b)=>a+b,0);
  if(sum<=0){
    const each=scoreRound(target/items.length);
    let used=0;
    items.forEach((x,i)=>{x.points=i===items.length-1?scoreRound(target-used):each;used=scoreRound(used+x.points);});
    return;
  }
  let used=0;
  items.forEach((x,i)=>{
    const p=i===items.length-1?scoreRound(target-used):scoreRound(target*raw[i]/sum);
    x.points=Math.max(0,p);used=scoreRound(used+x.points);
  });
}
function normalizeRubricPoints(rubric,target){
  if(!Array.isArray(rubric)||!rubric.length)return;
  if(rubricLooksLikeAlternativeBands(rubric))return;
  distributePoints(rubric,target);
}
function applySlotScore(q,slot){
  if(!q||!slot)return;
  q.points=scoreRound(slot.points);
  if(Array.isArray(q.parts)&&q.parts.length){
    if(slot.partPoints?.length===q.parts.length){
      q.parts.forEach((p,i)=>{p.points=scoreRound(slot.partPoints[i]);normalizeRubricPoints(p.rubric,p.points);});
    }else{
      distributePoints(q.parts,q.points);
      q.parts.forEach(p=>normalizeRubricPoints(p.rubric,p.points));
    }
  }else normalizeRubricPoints(q.rubric,q.points);
}
function normalizeCodeFormScores(code,form){
  const qs=(code?.questions||[]).filter(q=>q.form===form);
  const slots=expectedSlots(form);
  if(!slots||slots.length!==qs.length)return false;
  if(form==='TNKQ'){
    const expected=new Map(),actual=new Map();
    slots.forEach(s=>expected.set(s.subtype,(expected.get(s.subtype)||0)+1));
    qs.forEach(q=>{const k=subtypeKey(q.subtype);actual.set(k,(actual.get(k)||0)+1);});
    const keys=new Set([...expected.keys(),...actual.keys()]);
    if([...keys].some(k=>(expected.get(k)||0)!==(actual.get(k)||0)))return false;
    keys.forEach(k=>{
      const qg=qs.filter(q=>subtypeKey(q.subtype)===k).sort((a,b)=>nval(a.points)-nval(b.points));
      const sg=slots.filter(s=>s.subtype===k).sort((a,b)=>a.points-b.points);
      qg.forEach((q,i)=>applySlotScore(q,sg[i]));
    });
  }else{
    const qg=qs.slice().sort((a,b)=>nval(a.points)-nval(b.points));
    const sg=slots.slice().sort((a,b)=>a.points-b.points);
    qg.forEach((q,i)=>applySlotScore(q,sg[i]));
  }
  return true;
}
function stripSinglePartPrefix(text){
  return String(text||'').replace(/^\s*a\s*(?:[\.\):\-]|\(\s*\d+(?:[\.,]\d+)?\s*(?:đ|điểm)\s*\)\s*:?)\s*/iu,'').trim();
}
function mergeQuestionPrompt(a,b){
  const x=stripSinglePartPrefix(String(a||'').trim()),y=stripSinglePartPrefix(b);if(!x)return y;if(!y)return x;
  const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9đ]+/g,' ').trim().replace(/\s+/g,' ');
  const nx=norm(x),ny=norm(y);if(nx===ny||nx.includes(ny))return x;if(ny.includes(nx))return y;
  const xt=new Set(nx.split(' ').filter(Boolean)),yt=ny.split(' ').filter(Boolean),over=yt.filter(t=>xt.has(t)).length/Math.max(1,Math.min(xt.size,yt.length));
  if(over>=.85)return x.length>=y.length?x:y;
  return `${x} ${y}`.trim();
}
function collapseSinglePartEssays(exam){
  for(const code of exam?.examCodes||[]){
    for(const q of code.questions||[]){
      if(q.form!=='TL')continue;
      if(Array.isArray(q.parts)&&q.parts.length===1){
        const p=q.parts[0]||{};q.prompt=mergeQuestionPrompt(q.prompt,p.prompt);q.answer=p.answer??q.answer;q.rubric=Array.isArray(p.rubric)?p.rubric:q.rubric;q.configId=p.configId||q.configId;q.level=p.level||q.level;q.points=nval(p.points)||nval(q.points);delete q.parts;
      }
      if(!q.parts?.length)q.prompt=stripSinglePartPrefix(q.prompt);
    }
  }
  return exam;
}
function normalizeGeneratedScores(exam){
  if(!exam?.examCodes?.length)return exam;
  exam.examCodes.forEach(code=>{
    (code.questions||[]).forEach(q=>{
      q.points=scoreRound(q.points);
      if(Array.isArray(q.parts)&&q.parts.length){
        q.parts.forEach(p=>{p.points=scoreRound(p.points);normalizeRubricPoints(p.rubric,p.points);});
      }else normalizeRubricPoints(q.rubric,q.points);
    });
  });
  return collapseSinglePartEssays(exam);
}
function optionWordCount(text){
  return stripChoiceLabel(text).replace(/[^\p{L}\p{N}%]+/gu,' ').trim().split(/\s+/).filter(Boolean).length;
}
function optionCharCount(text){
  return stripChoiceLabel(text).replace(/\s+/g,' ').trim().length;
}
function optionLengthProblem(q){
  if(!Array.isArray(q?.options)||q.options.length!==4)return null;
  const words=q.options.map(optionWordCount),chars=q.options.map(optionCharCount);
  const min=Math.min(...words),max=Math.max(...words),diff=max-min,ratio=max/Math.max(1,min);
  const cmin=Math.min(...chars),cmax=Math.max(...chars),cratio=cmax/Math.max(1,cmin);
  const bad = diff>3 || (max>=4&&diff>=2&&ratio>1.6) || (cmax-cmin>20&&cratio>1.5);
  return bad?{words,chars,min,max,diff,ratio}:null;
}
function matrixSubtypeCounts(form){
  const slots=expectedSlots(form);if(!slots)return null;
  const m=new Map();slots.forEach(s=>m.set(s.subtype,(m.get(s.subtype)||0)+1));return m;
}
function rubricLooksLikeAlternativeBands(rubric){
  const rows=(Array.isArray(rubric)?rubric:[]).map(x=>String(x?.content||'').toLowerCase());
  const band=/\b(?:nêu|trình bày|xác định|kể|chỉ ra|đưa ra)\s+(?:được\s+)?\d+\s*(?:ý|biểu hiện|việc làm|hành động|nội dung|dẫn chứng|ví dụ)/iu;
  return rows.filter(x=>band.test(x)).length>=2;
}
function strictExamQualityIssues(exam){
  const issues=[];
  if(!exam?.examCodes?.length)return [{severity:'block',category:'Cấu trúc đề',message:'AI chưa trả cấu trúc mã đề hợp lệ.'}];
  const expectedCodes=Math.max(1,Number(setupValue().examCodes||1));
  if(exam.examCodes.length!==expectedCodes)issues.push({severity:'block',category:'Số mã đề',message:`Cần ${expectedCodes} mã đề nhưng AI trả ${exam.examCodes.length}.`});
  exam.examCodes.forEach((code,ci)=>{
    const codeName=code.code||String.fromCharCode(65+ci),qs=code.questions||[];
    const total=scoreRound(qs.reduce((s,q)=>s+nval(q.points),0));
    if(Math.abs(total-10)>SCORE_EPS)issues.push({severity:'block',category:'Tổng điểm',code:codeName,codeIndex:ci,message:`Tổng điểm Đề ${codeName} là ${fmt(total)}, bắt buộc phải bằng 10,0.`});
    ['TNKQ','TL'].forEach(form=>{
      const got=scoreRound(qs.filter(q=>q.form===form).reduce((s,q)=>s+nval(q.points),0));
      const exp=expectedFormPoints(form);
      if(Math.abs(got-exp)>SCORE_EPS)issues.push({severity:'block',category:'Điểm theo ma trận',code:codeName,codeIndex:ci,message:`${form==='TNKQ'?'Trắc nghiệm':'Tự luận'} Đề ${codeName}: ${fmt(got)} điểm, ma trận yêu cầu ${fmt(exp)} điểm.`});
      const slots=expectedSlots(form);
      if(slots&&qs.filter(q=>q.form===form).length!==slots.length)issues.push({severity:'block',category:'Số câu',code:codeName,codeIndex:ci,message:`Số câu ${form==='TNKQ'?'trắc nghiệm':'tự luận'} không khớp ma trận.`});
    });
    const expTN=matrixSubtypeCounts('TNKQ');
    if(expTN){
      const gotTN=new Map();qs.filter(q=>q.form==='TNKQ').forEach(q=>{const k=subtypeKey(q.subtype);gotTN.set(k,(gotTN.get(k)||0)+1);});
      new Set([...expTN.keys(),...gotTN.keys()]).forEach(k=>{
        if((expTN.get(k)||0)!==(gotTN.get(k)||0))issues.push({severity:'block',category:'Dạng trắc nghiệm',code:codeName,codeIndex:ci,message:`Số câu "${formLabel(k)}" không khớp ma trận (${gotTN.get(k)||0}/${expTN.get(k)||0}).`});
      });
    }
    qs.forEach((q,qi)=>{
      const qno=q.number||qi+1;
      const base={severity:'block',code:codeName,codeIndex:ci,questionNumber:qno,questionIndex:qi};
      if(!(nval(q.points)>0))issues.push({...base,category:'Điểm câu',message:'Câu hỏi có điểm bằng 0 hoặc không hợp lệ.'});
      if(Array.isArray(q.parts)&&q.parts.length){
        const ps=scoreRound(q.parts.reduce((s,p)=>s+nval(p.points),0));
        if(Math.abs(ps-nval(q.points))>SCORE_EPS)issues.push({...base,category:'Điểm các ý',message:`Tổng điểm các ý ${fmt(ps)} không bằng điểm câu ${fmt(q.points)}.`});
      }
      if(q.form==='TNKQ'){
        const sub=subtypeKey(q.subtype);
        if(sub==='single'||sub==='multiple'){
          if(!Array.isArray(q.options)||q.options.length!==4)issues.push({...base,category:'Phương án',message:'Câu trắc nghiệm phải có đúng 4 phương án.'});
          else{
            const p=optionLengthProblem(q);
            if(p)issues.push({...base,category:'Độ dài phương án',message:`Các phương án chênh lệch quá lớn (số từ: ${p.words.join(' – ')}). Cần viết lại gần tương đương về độ dài và cấu trúc ngữ pháp.`});
            const choices=q.options.map(x=>stripChoiceLabel(x).toLocaleLowerCase('vi'));
            if(choices.some(x=>!x)||new Set(choices).size!==4)issues.push({...base,category:'Phương án',message:'Bốn phương án phải có nội dung và không được trùng nhau.'});
          }
          const correct=sub==='multiple'?(Array.isArray(q.answer)?q.answer.map(x=>String(x).trim().toUpperCase()):[]):[String(q.answer||'').trim().toUpperCase()];
          if(sub==='single'&&!/^[A-D]$/.test(correct[0]||''))issues.push({...base,category:'Đáp án',message:'Đáp án câu một lựa chọn phải là A, B, C hoặc D.'});
          if(sub==='multiple'&&(!Array.isArray(q.answer)||q.answer.length<2||q.answer.some(x=>!/^[A-D]$/i.test(String(x).trim()))))issues.push({...base,category:'Đáp án',message:'Đáp án câu nhiều lựa chọn đúng chưa đúng cấu trúc.'});
          const dis=String(q.distractor||'').trim().toUpperCase();
          if(!/^[A-D]$/.test(dis)||correct.includes(dis))issues.push({...base,category:'Phương án nhiễu',message:'Cần có một phương án nhiễu hợp lí và không trùng với đáp án đúng.'});
        }
        if(sub==='truefalse'&&(!Array.isArray(q.statements)||q.statements.length!==4))issues.push({...base,category:'Đúng/Sai',message:'Câu Đúng/Sai phải có đúng 4 nhận định.'});
      }
      if(q.form==='TL'){
        if(q.essayType==='situation'&&!String(q.context||'').trim())issues.push({...base,category:'Tình huống',message:'Câu tự luận tình huống chưa có nội dung tình huống.'});
        if(Array.isArray(q.parts)&&q.parts.length){
          q.parts.forEach((p,pi)=>{
            const rub=Array.isArray(p.rubric)?p.rubric:[];
            const rs=scoreRound(rub.reduce((s,r)=>s+nval(r.points),0));
            if(!String(p.answer||'').trim())issues.push({...base,partIndex:pi,category:'Hướng dẫn chấm',message:`Ý ${p.label||String.fromCharCode(97+pi)} thiếu đáp án gợi ý tách riêng.`});
            if(!rub.length||Math.abs(rs-nval(p.points))>SCORE_EPS)issues.push({...base,partIndex:pi,category:'Hướng dẫn chấm',message:`Hướng dẫn chấm ý ${p.label||String.fromCharCode(97+pi)} chưa đủ hoặc tổng điểm rubric ${fmt(rs)} không bằng ${fmt(p.points)} điểm.`});
            else if(rubricLooksLikeAlternativeBands(rub))issues.push({...base,partIndex:pi,category:'Hướng dẫn chấm',message:`Hướng dẫn chấm ý ${p.label||String.fromCharCode(97+pi)} đang dùng các mức điểm thay thế; cần đổi thành tiêu chí cộng điểm độc lập.`});
          });
        }else{
          const rub=Array.isArray(q.rubric)?q.rubric:[];
          const rs=scoreRound(rub.reduce((s,r)=>s+nval(r.points),0));
          if(!String(q.answer||'').trim())issues.push({...base,category:'Hướng dẫn chấm',message:'Câu tự luận thiếu đáp án gợi ý tách riêng.'});
          if(!rub.length||Math.abs(rs-nval(q.points))>SCORE_EPS)issues.push({...base,category:'Hướng dẫn chấm',message:`Hướng dẫn chấm chưa đủ hoặc tổng điểm rubric ${fmt(rs)} không bằng ${fmt(q.points)} điểm.`});
          else if(rubricLooksLikeAlternativeBands(rub))issues.push({...base,category:'Hướng dẫn chấm',message:'Hướng dẫn chấm đang dùng các mức điểm thay thế; cần đổi thành tiêu chí cộng điểm độc lập.'});
        }
      }
    });
  });
  return issues;
}
function isRepairableQuestionIssue(x){
  return Number.isInteger(x?.codeIndex)&&Number.isInteger(x?.questionIndex)&&REPAIRABLE_QUESTION_CATEGORIES.has(x.category);
}
function groupRepairableQuestionIssues(issues=[]){
  const m=new Map();
  (issues||[]).filter(isRepairableQuestionIssue).forEach(x=>{
    const k=`${x.codeIndex}|${x.questionIndex}`;
    if(!m.has(k))m.set(k,{codeIndex:x.codeIndex,questionIndex:x.questionIndex,issues:[]});
    m.get(k).issues.push(x);
  });
  return [...m.values()];
}
function buildRepairPayloadForQuestion(q){
  const p=buildPayload();
  const lessonId=q?.lessonId;
  if(lessonId){
    const lessons=p.lessons.filter(x=>x.id===lessonId); if(lessons.length)p.lessons=lessons;
    const matrix=p.matrix.filter(x=>x.lessonId===lessonId); if(matrix.length)p.matrix=matrix;
  }
  return p;
}
function repairScopeForIssues(items=[]){
  const cats=new Set(items.map(x=>x.category));
  if([...cats].every(x=>x==='Hướng dẫn chấm'))return 'marking';
  if([...cats].every(x=>x==='Tình huống'))return 'context';
  return 'whole';
}
function repairRequestText(items=[],q){
  const cats=new Set(items.map(x=>x.category));
  const detail=items.map(x=>`- ${x.message}`).join('\n');
  let task='Chỉ sửa đúng câu này để khắc phục các lỗi dưới đây; giữ nguyên bài, yêu cầu cần đạt, mức độ, dạng câu và điểm.';
  if([...cats].some(x=>['Độ dài phương án','Phương án','Đáp án','Phương án nhiễu'].includes(x))){
    task+=' Với câu lựa chọn, GIỮ NGUYÊN phần dẫn/câu hỏi; viết lại 4 phương án không rỗng, không trùng, cùng kiểu ngữ pháp, chênh không quá 3 từ và tránh chênh lệch số kí tự rõ rệt. Không làm lộ đáp án. Đảm bảo đáp án đúng thực sự đúng và có ít nhất một nhiễu hợp lí gần đáp án đúng.';
  }
  if(cats.has('Đúng/Sai'))task+=' Với câu Đúng/Sai, tạo đúng 4 nhận định, rõ ràng và đúng cấu trúc đáp án.';
  if(cats.has('Hướng dẫn chấm'))task+=' Chỉ chỉnh đáp án/hướng dẫn chấm. Bắt buộc trả trường answer là ĐÁP ÁN GỢI Ý hoàn chỉnh, tách riêng; rubric chỉ gồm các tiêu chí cộng điểm độc lập, không trùng ý, không dùng các mức điểm thay thế, và tổng điểm rubric phải đúng tuyệt đối bằng điểm câu/ý.';
  if(cats.has('Tình huống'))task+=' Bổ sung/chỉnh tình huống ngắn gọn, tự nhiên, phù hợp học sinh THCS và không làm thay đổi kiến thức cần kiểm tra.';
  return `${task}\n\nLỖI CẦN SỬA:\n${detail}`;
}
function mergeAutoRepairedQuestion(oldQ,newQ,items=[]){
  const cats=new Set(items.map(x=>x.category));
  const optionOnly=[...cats].every(x=>['Độ dài phương án','Phương án','Đáp án','Phương án nhiễu'].includes(x));
  const markingOnly=[...cats].every(x=>x==='Hướng dẫn chấm');
  const contextOnly=[...cats].every(x=>x==='Tình huống');
  const out=deepClone(oldQ);
  if(optionOnly){
    if(Array.isArray(newQ?.options))out.options=newQ.options.map(stripChoiceLabel);
    if(newQ?.answer!==undefined)out.answer=deepClone(newQ.answer);
    if(newQ?.distractor!==undefined)out.distractor=newQ.distractor;
    return out;
  }
  if(markingOnly){
    if(newQ?.answer!==undefined)out.answer=deepClone(newQ.answer);
    if(Array.isArray(newQ?.rubric))out.rubric=deepClone(newQ.rubric);
    if(Array.isArray(out.parts)&&Array.isArray(newQ?.parts))out.parts=out.parts.map((p,i)=>({...p,answer:newQ.parts[i]?.answer??p.answer,rubric:Array.isArray(newQ.parts[i]?.rubric)?deepClone(newQ.parts[i].rubric):p.rubric}));
    return out;
  }
  if(contextOnly){out.context=String(newQ?.context||'').trim();return out;}
  const fixed=['number','configId','lessonId','level','form','subtype','essayType','points'];
  const merged={...deepClone(newQ)}; fixed.forEach(k=>merged[k]=oldQ[k]);
  if(Array.isArray(oldQ.parts)&&Array.isArray(merged.parts)&&oldQ.parts.length===merged.parts.length){
    merged.parts=merged.parts.map((p,i)=>({...p,label:oldQ.parts[i].label,configId:oldQ.parts[i].configId,level:oldQ.parts[i].level,points:oldQ.parts[i].points}));
  }
  return merged;
}
async function repairOneQuestionGroup(group,deadline){
  const code=state.exam?.examCodes?.[group.codeIndex],oldQ=code?.questions?.[group.questionIndex];
  if(!code||!oldQ)return {ok:false,group,error:'Không tìm thấy câu cần sửa.'};
  const remaining=deadline-Date.now();
  if(remaining<=0)return {ok:false,group,error:'Đã hết thời gian sửa tự động; có thể sửa tiếp ở Bước 6.'};
  const field=repairScopeForIssues(group.issues);
  const data=await post('/api/refine',{...aiRequestParams(),payload:buildRepairPayloadForQuestion(oldQ),target:{codeIndex:group.codeIndex,questionIndex:group.questionIndex,field,partIndex:null,code:code.code,question:deepClone(oldQ)},teacherRequest:repairRequestText(group.issues,oldQ)},Math.min(90000,remaining));
  if(!data?.proposal?.question)throw new Error('AI không trả câu sửa hợp lệ.');
  code.questions[group.questionIndex]=mergeAutoRepairedQuestion(oldQ,data.proposal.question,group.issues);
  return {ok:true,group};
}
async function runRepairBatch(groups,deadline,limit=QUALITY_REPAIR_CONCURRENCY,onProgress=()=>{}){
  const results=[];
  for(let i=0;i<groups.length;i+=limit){
    if(Date.now()>=deadline)break;
    const batch=groups.slice(i,i+limit);
    const r=await Promise.allSettled(batch.map(g=>repairOneQuestionGroup(g,deadline)));
    r.forEach((x,j)=>results.push(x.status==='fulfilled'?x.value:{ok:false,group:batch[j],error:String(x.reason?.message||x.reason)}));
    onProgress(Math.min(i+batch.length,groups.length),groups.length);
    if(i+batch.length<groups.length&&Date.now()+AI_CLIENT_GAP_MS<deadline)await wait(AI_CLIENT_GAP_MS);
  }
  return results;
}
async function repairCurrentQuestionIssues({box=null,manual=false}={}){
  if(!state.exam?.examCodes?.length)return {repaired:0,remaining:[]};
  let repaired=0,failed=[];
  const deadline=Date.now()+QUALITY_REPAIR_BUDGET_MS;
  for(let pass=1;pass<=QUALITY_MAX_REPAIR_PASSES;pass++){
    if(Date.now()>=deadline)break;
    state.exam=normalizeGeneratedScores(state.exam);state.exam=balanceSingleChoiceAnswers(state.exam);
    const groups=groupRepairableQuestionIssues(strictExamQualityIssues(state.exam));
    if(!groups.length)break;
    if(box)box.textContent=`Đề đã tạo. Đang sửa riêng ${groups.length} câu lỗi (lượt ${pass}/${QUALITY_MAX_REPAIR_PASSES})…`;
    const results=await runRepairBatch(groups,deadline,QUALITY_REPAIR_CONCURRENCY,(done,total)=>{if(box)box.textContent=`Đang sửa từng câu lỗi: ${done}/${total} · lượt ${pass}/${QUALITY_MAX_REPAIR_PASSES}…`;});
    repaired+=results.filter(x=>x.ok).length;failed=results.filter(x=>!x.ok);
    state.exam=normalizeGeneratedScores(state.exam);state.exam=balanceSingleChoiceAnswers(state.exam);
    if(!groupRepairableQuestionIssues(strictExamQualityIssues(state.exam)).length)break;
  }
  const remaining=strictExamQualityIssues(state.exam);
  renderExam();renderAudit();renderReviewWorkspace();resetReviewConfirmation();
  if(manual){
    const qIssues=remaining.filter(isRepairableQuestionIssue);
    const qleft=groupRepairableQuestionIssues(qIssues).length;
    appendChat('ai',qleft?`Đã sửa riêng các câu có thể sửa tự động nhưng còn ${qleft} câu chưa đạt:\n${qualityIssueText(qIssues,10)}\nChọn đúng câu trong danh sách cảnh báo hoặc Trợ lý AI để chỉnh tiếp. Nếu AI chưa sửa được, vẫn có thể xuất Word và sửa thủ công.`:`Đã sửa xong các câu lỗi kỹ thuật mà không tạo lại toàn bộ đề.`);
  }
  return {repaired,failed,remaining};
}
function qualityFeedbackText(issues=[]){
  return issues.slice(0,12).map(x=>`- ${x.code?`Đề ${x.code}${x.questionNumber?`, câu ${x.questionNumber}`:''}: `:''}${x.message}`).join('\n');
}
function buildQualityRules(retryFeedback=''){
  return [
    'YÊU CẦU KỸ THUẬT BẮT BUỘC (không được bỏ qua):',
    '1) Mỗi mã đề phải đúng tổng 10,0 điểm; điểm phần TNKQ và TL phải đúng tuyệt đối theo ma trận. Không tự tăng/giảm điểm.',
    '2) Với câu có 4 phương án, viết 4 nội dung không rỗng, không trùng, song song về ngữ pháp và gần tương đương độ dài. Chênh lệch tối đa 3 từ; tránh một phương án nổi bật vì số kí tự dài/ngắn bất thường.',
    '3) Không đưa A./B./C./D. vào nội dung phương án; lớp hiển thị sẽ tự thêm nhãn.',
    '4) Mỗi câu/ý tự luận phải có trường answer là đáp án gợi ý hoàn chỉnh, tách riêng khỏi rubric. Rubric chỉ gồm tiêu chí cộng điểm độc lập; không dùng các mức điểm thay thế. Tổng điểm các ý và rubric phải đúng bằng điểm câu.',
    '5) Tự luận chỉ có 1 ý thì KHÔNG tạo nhãn a/a). Chỉ dùng a, b, c... khi câu có từ 2 ý trở lên. Đáp án gợi ý phải viết thành các ý ngắn, ưu tiên mỗi ý một dòng/gạch đầu dòng; không viết thành đoạn văn dài.',
    retryFeedback?`LỖI CỦA LẦN TRƯỚC – PHẢI SỬA Ở LẦN NÀY:\n${retryFeedback}`:''
  ].filter(Boolean).join('\n');
}

function issueLocationLabel(x){
  let s=x?.code?`Đề ${x.code}`:'Toàn đề';
  if(x?.questionNumber!==undefined&&x?.questionNumber!==null&&x.questionNumber!=='')s+=` · Câu ${x.questionNumber}`;
  if(Number.isInteger(x?.partIndex))s+=` · ý ${String.fromCharCode(97+x.partIndex)}`;
  return s;
}
function issueSuggestedPrompt(x){
  const c=String(x?.category||'');
  if(c==='Độ dài phương án')return 'Chỉ sửa 4 phương án của câu này: giữ nguyên phần dẫn, kiến thức, mức độ và đáp án; viết các phương án song song về ngữ pháp, gần tương đương độ dài và không làm lộ đáp án.';
  if(c==='Phương án')return 'Bổ sung/chỉnh đúng 4 phương án cho câu này, cùng kiểu ngữ pháp, gần tương đương độ dài; giữ nguyên kiến thức, mức độ và điểm.';
  if(c==='Đáp án')return 'Kiểm tra lại câu này và sửa đáp án cho chính xác; nếu cần thì chỉnh phương án để câu chỉ có đáp án đúng theo đúng dạng trắc nghiệm, nhưng không đổi kiến thức, mức độ hoặc điểm.';
  if(c==='Phương án nhiễu')return 'Chỉnh phương án nhiễu của câu này để hợp lí, gần đáp án đúng nhưng vẫn sai rõ ràng theo kiến thức; không đổi phần dẫn, mức độ hoặc điểm.';
  if(c==='Đúng/Sai')return 'Chỉnh riêng câu Đúng/Sai này để có đúng 4 nhận định rõ ràng, phù hợp kiến thức và cấu trúc đáp án; không đổi mức độ hoặc điểm.';
  if(c==='Hướng dẫn chấm')return 'Chỉ sửa đáp án/hướng dẫn chấm của câu hoặc ý này: bắt buộc có trường answer là đáp án gợi ý hoàn chỉnh, tách riêng; rubric là các tiêu chí cộng điểm độc lập, không trùng ý, không dùng mức điểm thay thế và tổng điểm phải đúng bằng điểm đã khóa trong ma trận.';
  if(c==='Tình huống')return 'Chỉ bổ sung/chỉnh tình huống của câu này cho ngắn gọn, tự nhiên, phù hợp học sinh THCS; giữ nguyên yêu cầu cần đạt, mức độ, câu hỏi và điểm.';
  if(c==='Tên nhân vật')return 'Chỉ sửa tên nhân vật trong tình huống thành chữ cái in hoa như A, H, M; không thay đổi nội dung, mức độ hoặc điểm.';
  if(c==='Điểm các ý'||c==='Điểm câu'||c==='Tổng điểm'||c==='Điểm theo ma trận')return 'Kiểm tra lại cấu trúc điểm của câu/đề này theo đúng ma trận 10 điểm. Không thay đổi kiến thức; chỉ sửa phần dữ liệu điểm/hướng dẫn chấm nếu cần.';
  return `Kiểm tra và sửa đúng lỗi sau ở ${issueLocationLabel(x)}: ${x?.message||''}. Giữ nguyên bài, yêu cầu cần đạt, mức độ, dạng câu và điểm nếu không liên quan trực tiếp đến lỗi.`;
}
function qualityIssueRefs(issues=[],limit=6){
  const vals=[];const seen=new Set();
  (issues||[]).forEach(x=>{
    const label=issueLocationLabel(x);
    if(!seen.has(label)){seen.add(label);vals.push(label);}
  });
  if(!vals.length)return '';
  return vals.slice(0,limit).join('; ')+(vals.length>limit?` … (+${vals.length-limit})`:'');
}
function qualityIssueText(issues=[],limit=8){
  const lines=(issues||[]).slice(0,limit).map(x=>`${issueLocationLabel(x)} — ${x.category}: ${x.message}`);
  if((issues||[]).length>limit)lines.push(`… còn ${(issues||[]).length-limit} cảnh báo khác.`);
  return lines.join('\n');
}
function qualityIssueHtml(issues=[]){
  return (issues||[]).map((x,i)=>{
    const canFocus=isRepairableQuestionIssue(x);
    return `<div class="quality-issue-item">
      <div class="quality-issue-main"><div class="quality-issue-title">${esc(issueLocationLabel(x))} · ${esc(x.category||'Cần kiểm tra')}</div><div class="quality-issue-message">${esc(x.message||'')}</div></div>
      ${canFocus?`<button type="button" class="btn ghost quality-focus-btn" data-quality-issue="${i}">Chọn câu này để sửa</button>`:''}
    </div>`;
  }).join('');
}
function renderQualityIssueReport(){
  const root=$('#qualityIssueReport');if(!root)return;
  const issues=state.exam?strictExamQualityIssues(state.exam):[];
  if(!issues.length){
    root.classList.add('hidden');root.innerHTML='';return;
  }
  const qCount=groupRepairableQuestionIssues(issues).length;
  const structural=issues.filter(x=>!isRepairableQuestionIssue(x)).length;
  root.classList.remove('hidden');
  root.innerHTML=`<div class="quality-issue-head"><div><h3>⚠ Còn ${issues.length} cảnh báo kỹ thuật${qCount?` · ${qCount} câu cần kiểm tra`:''}</h3><p>Hệ thống ghi rõ vị trí để giáo viên yêu cầu AI sửa đúng câu. Nếu AI vẫn không sửa được, giáo viên vẫn có thể xuất Word và sửa thủ công sau khi xác nhận đã kiểm tra.${structural?` Có ${structural} cảnh báo ở cấp cấu trúc/toàn đề.`:''}</p></div></div>${qualityIssueHtml(issues)}`;
  root.querySelectorAll('[data-quality-issue]').forEach(btn=>btn.addEventListener('click',()=>{
    const issue=issues[Number(btn.dataset.qualityIssue)];
    if(!issue||!isRepairableQuestionIssue(issue))return;
    const field=repairScopeForIssues([issue]);
    const sel=$('#aiScope');
    const candidates=[`${issue.codeIndex}|${issue.questionIndex}|${field}`,`${issue.codeIndex}|${issue.questionIndex}|whole`];
    if(sel){
      const values=[...sel.options].map(o=>o.value);
      const v=candidates.find(x=>values.includes(x));
      if(v)sel.value=v;
    }
    const ta=$('#aiEditRequest');if(ta)ta.value=issueSuggestedPrompt(issue);
    $('.ai-editor-card')?.scrollIntoView({behavior:'smooth',block:'start'});
    appendChat('system',`Đã chọn ${issueLocationLabel(issue)} · ${issue.category}. Có thể chỉnh lại yêu cầu rồi bấm “Gửi yêu cầu”.`);
  }));
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
  if(name==='review'){ renderAudit(); renderReviewWorkspace(); }
}
function setApiStatus(text,kind='neutral',actionUrl='',actionLabel='Mở trang kích hoạt API ↗'){
  $('#apiStatus').textContent=text;
  $('#apiDot').className=`status-dot ${kind}`;
  const link=$('#apiActionLink');
  if(link){link.hidden=!actionUrl;link.href=actionUrl||'#';link.textContent=actionLabel||'Mở trang kích hoạt API ↗';}
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
      <label>Số câu<input data-field="count" type="number" min="${d.form==='tl'?'0.5':'1'}" step="${d.form==='tl'?'0.5':'1'}" value="${nval(r.count)||1}" /></label>
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
function validateConfigCounts(rows,form){
  const step=form==='tl'?.5:1;
  for(const r of rows||[]){
    const count=nval(r.count);
    if(!Number.isFinite(count)||count<step||Math.abs(count/step-Math.round(count/step))>.001){
      return form==='tl'?'Số câu tự luận phải là ½; 1; 1½; 2…':'Số câu trắc nghiệm phải là số nguyên từ 1 trở lên.';
    }
  }
  return '';
}
function validateEssayRows(rows){
  const countError=validateConfigCounts(rows,'tl');if(countError)return countError;
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
    const m=ensureLessonMatrix(l.id);
    const editable=LEVELS.map(lev=>`<label class="spec-edit-block"><span>${lev.label}</span><textarea data-specedit="${l.id}|${lev.id}" rows="6" spellcheck="true" placeholder="Nhập đặc tả ${lev.label.toLowerCase()}...">${esc(effectiveDescriptor(l,lev))}</textarea></label>`).join('');
    return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><strong>Bài ${l.num}</strong><br>${esc(l.title)}</td><td><div class="spec-edit-grid">${editable}</div></td>${LEVELS.map(lev=>`<td class="spec-count">${formsForLevel(lev.id).map(form=>cellCompact(m[lev.id][form],form)).filter(Boolean).map(esc).join('<br>')||'—'}</td>`).join('')}</tr>`;
  }).join('');
  const total=totalPoints(), pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  $('#specFoot').innerHTML=`<tr class="spec-foot"><td colspan="4"><strong>Tổng số câu hỏi</strong></td>${LEVELS.map(l=>`<td>${countFmt(levelCount(l.id))}</td>`).join('')}</tr>
  <tr class="spec-foot"><td colspan="4"><strong>Tỉ lệ %</strong></td>${pct.map(x=>`<td>${fmt(x)}%</td>`).join('')}</tr>
  <tr class="spec-foot"><td colspan="4"><strong>Tỉ lệ chung</strong></td><td colspan="2">NB + TH: ${fmt((pct[0]||0)+(pct[1]||0))}%</td><td>VD: ${fmt(pct[2]||0)}%</td></tr>`;
  $$('[data-specedit]').forEach(t=>t.addEventListener('input',e=>{const [id,lev]=e.target.dataset.specedit.split('|');setDescriptorOverride(id,lev,e.target.value);renderAudit();resetReviewConfirmation();}));
  if(!state.specDirty)updateSpecSaveStatus('Có thể chỉnh trực tiếp nội dung rồi bấm “Lưu đặc tả”.','neutral');
}

async function post(path,body,timeoutOverrideMs){
  if(!apiBase() || /YOUR_SUBDOMAIN/.test(apiBase())) throw new Error('Chưa cấu hình API_BASE trong config.js.');
  const controller=new AbortController();
  const timeoutMs=timeoutOverrideMs||({'/api/generate':420000,'/api/test-provider':30000,'/api/refine':90000}[path]||120000);
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(apiBase()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{data={error:text||'Phản hồi không hợp lệ'}};
    if(!r.ok){const error=new Error(data.error||`HTTP ${r.status}`);error.status=r.status;error.workerVersion=data.workerVersion||'';error.errorCode=data.errorCode||'';error.actionUrl=data.actionUrl||'';error.actionLabel=data.actionLabel||'';throw error;}
    return data;
  }catch(error){
    if(error?.name==='AbortError')throw new Error(`Yêu cầu ${path} vượt quá ${Math.ceil(timeoutMs/1000)} giây chờ. Ma trận và đề đã nhận được vẫn được giữ nguyên.`);
    throw error;
  }finally{clearTimeout(timer);}
}
function renderModelSelect(models=[],labels={},recommended=''){
  state.models=models.slice();state.model=recommended||models[0]||'';
  const sel=$('#modelSelect');if(!sel)return;sel.disabled=!models.length;
  sel.innerHTML=models.length?models.map(m=>`<option value="${esc(m)}" ${m===state.model?'selected':''}>${esc(labels[m]||modelLabel(m))}</option>`).join(''):'<option>Chưa có model...</option>';
}
function syncAiProviderUI(){
  const p=aiProvider();state.provider=p;state.apiOk=false;
  $('#cloudflareAiPanel')?.classList.toggle('hidden',p!=='cloudflare');
  $('#geminiAiPanel')?.classList.toggle('hidden',p!=='gemini');
  if(p==='cloudflare'){
    const labels=Object.fromEntries(CF_MODELS);renderModelSelect(CF_MODELS.map(x=>x[0]),labels,state.model?.startsWith('@cf/')?state.model:CF_MODELS[0][0]);
    setApiStatus('Chưa kiểm tra Cloudflare Workers AI (có kiểm tra JSON cấu trúc).','neutral');
  }else{
    state.models=[];state.model='';const sel=$('#modelSelect');if(sel){sel.disabled=true;sel.innerHTML='<option>Kiểm tra Gemini API để tải model...</option>';}
    setApiStatus('Chưa kiểm tra Gemini API cá nhân.','neutral');
  }
}
async function testApi(){
  const p=aiProvider(),key=p==='gemini'?($('#apiKey').value||'').trim():'';
  if(p==='gemini'&&!key){setApiStatus('Vui lòng nhập Gemini API key.','bad');return;}
  const btn=$('#testApiBtn');btn.disabled=true;btn.textContent='Đang kiểm tra…';state.apiOk=false;
  try{
    const data=await post('/api/test-provider',aiRequestParams());
    renderModelSelect(data.models||[],data.modelLabels||{},data.recommended||'');
    state.apiOk=true;state.provider=p;setApiStatus(`✓ ${data.message||'AI hoạt động.'}${data.fallbackMessage?` ${data.fallbackMessage}`:''}`,'ok');
  }catch(e){setApiStatus(`✕ ${e.message}`,'bad',e.actionUrl||'',e.actionLabel||'Mở trang kích hoạt API ↗');if(p==='gemini')$('#modelSelect').disabled=true;}
  finally{btn.disabled=false;btn.textContent='Kiểm tra AI';}
}
function buildPayload(retryFeedback=''){
  const setup=setupValue();
  setup.extraNotes=[setup.extraNotes,buildQualityRules(retryFeedback)].filter(Boolean).join('\n\n');
  return {
    setup,
    lessons:selectedLessons().map(l=>({id:l.id,number:l.num,title:l.title,strand:l.track,descriptor:effectiveDescriptorObject(l),teacherDescriptor:ensureTeacherSpec(l.id)})),
    matrix:allConfigs()
  };
}
async function generateExam(){
  if(!state.apiOk) return alert('Hãy kiểm tra nhà cung cấp AI thành công trước.');
  if(!state.selected.size) return alert('Chưa chọn bài.');
  if(Math.abs(totalPoints()-10)>.001) return alert(`Tổng điểm ma trận hiện là ${fmt(totalPoints())}; cần bằng 10,0.`);
  const btn=$('#generateBtn'), box=$('#generateStatus');btn.disabled=true;box.classList.remove('hidden');
  try{
    const params=aiRequestParams(),payload=buildPayload();
    for(const cfg of payload.matrix){const error=validateConfigCounts([cfg],cfg.form==='TL'?'tl':'tn');if(error)throw new Error(`${cfg.lessonTitle}: ${error}`);}
    let data;
    if(params.provider==='cloudflare'){
      const plan=await post('/api/generation-plan',{payload});
      const fingerprint=hash32(JSON.stringify({payload,params,workerVersion:plan.workerVersion}));
      let draft=state.generationDraft;
      if(!draft||draft.fingerprint!==fingerprint||draft.totalChunks!==plan.totalChunks){
        draft={fingerprint,totalChunks:plan.totalChunks,nextIndex:0,questions:[],notes:[],chunkMeta:[]};
        state.generationDraft=draft;
      }
      for(let i=draft.nextIndex;i<draft.totalChunks;i++){
        box.textContent=`Đang tạo phần ${i+1}/${draft.totalChunks} của mã đề A. Nếu lỗi, bấm Tạo đề lần nữa để tiếp tục từ phần này.`;
        const chunk=await post('/api/generate-chunk',{...params,payload,chunkIndex:i},210000);
        if(chunk.aiMeta?.workerVersion!==plan.workerVersion)throw new Error('Máy chủ vừa được cập nhật. Bấm Tạo đề để tạo lại các phần theo cùng một phiên bản.');
        if(chunk.chunkIndex!==i||chunk.totalChunks!==draft.totalChunks||!Array.isArray(chunk.questions)||!chunk.questions.length)throw new Error(`Phần ${i+1} trả dữ liệu không hợp lệ; có thể thử tiếp phần này.`);
        draft.questions.push(...chunk.questions);
        draft.notes.push(...(chunk.notes||[]));
        draft.chunkMeta.push(chunk.aiMeta||{});
        draft.nextIndex=i+1;
      }
      box.textContent='Đã tạo đủ các phần. Đang ghép mã đề và kiểm tra ma trận…';
      data=await post('/api/finalize-generation',{payload,questions:draft.questions,notes:draft.notes,chunkMeta:draft.chunkMeta},60000);
      state.generationDraft=null;
    }else{
      box.textContent='Đang tạo mã đề chuẩn A… Nếu chọn 2 mã, hệ thống sẽ tự tạo mã B bằng hoán vị có kiểm soát.';
      data=await post('/api/generate',{...params,payload});
    }
    data=normalizeGeneratedScores(data);data=balanceSingleChoiceAnswers(data);
    state.exam=data;state.editHistory=[];state.reviewProposal=null;state.aiReview=null;
    renderExam();renderAudit();renderReviewWorkspace();resetReviewConfirmation();

    let issues=strictExamQualityIssues(state.exam);
    const qGroups=groupRepairableQuestionIssues(issues);
    if(qGroups.length){
      box.textContent=`✓ Đã nhận bản đề gốc. Phát hiện ${qGroups.length} câu cần sửa; đang sửa riêng từng câu, không tạo lại toàn bộ đề…`;
      const result=await repairCurrentQuestionIssues({box});
      issues=result.remaining;
    }

    const blocking=issues.filter(x=>x.severity==='block');
    const qleft=groupRepairableQuestionIssues(blocking).length;
    const structural=blocking.filter(x=>!isRepairableQuestionIssue(x));
    if(!blocking.length){
      const derived=state.exam?.aiMeta?.derivedCodes?.length?' Mã B được tạo từ mã A bằng hoán vị có kiểm soát, bảo đảm cùng ma trận và tổng điểm.':'';
      const chunks=state.exam?.aiMeta?.cloudflareChunks?` Cloudflare đã gộp theo nhóm và xử lí trong ${state.exam.aiMeta.cloudflareChunks} lượt có giãn cách để giảm RPM/quá tải.`:'';
      const failover=state.exam?.aiMeta?.fallbackUsed?` Hệ thống đã tự dùng model/nhà cung cấp dự phòng (${state.exam.aiMeta.provider==='gemini'?'Gemini':'Cloudflare'}) để hoàn tất.`:'';
      box.textContent='✓ Đã tạo đủ mã đề và sửa các lỗi kỹ thuật. Đề vượt qua kiểm tra cấu trúc; giáo viên tiếp tục kiểm tra nội dung.'+derived+chunks+failover;
    }else if(qleft){
      const qIssues=blocking.filter(isRepairableQuestionIssue);
      box.textContent=`⚠ Đề đã được GIỮ LẠI. Còn ${qleft} câu cần chỉnh:\n${qualityIssueText(qIssues,10)}\n\nSang Bước 6, bấm “Chọn câu này để sửa” hoặc chọn đúng câu trong Trợ lý AI. Nếu AI chưa sửa được, vẫn có thể xuất Word để sửa thủ công sau khi xác nhận đã kiểm tra.`;
    }else if(structural.length){
      box.textContent=`⚠ Đề đã được GIỮ LẠI nhưng còn cảnh báo cấu trúc:\n${qualityIssueText(structural,10)}\n\nHệ thống không tự tạo lại nhiều lần để tránh chờ lâu. Giáo viên có thể kiểm tra và vẫn xuất Word để sửa thủ công nếu cần.`;
    }
  }catch(e){
    const timeout=/3046|3007|3008|3040|5006|408|409|429|500|502|503|504|timeout|thời gian chờ|quá tải|high\s+demand|overload|capacity|resource[_\s-]*exhausted|unavailable/i.test(String(e.message||''));
    const daily=/3036|10[.,]?000\s+neurons|hết hạn mức miễn phí/i.test(String(e.message||''));
    box.textContent='✕ '+e.message+(daily?' Đây là giới hạn tài khoản Cloudflare, mã nguồn không thể vượt qua; có thể chờ hạn mức ngày mới hoặc dùng Gemini API cá nhân.':timeout?' Dịch vụ AI không hoàn tất lần tạo đề. Hệ thống không thay đổi ma trận; hãy thử lại hoặc chuyển sang Gemini API cá nhân nếu Cloudflare đang quá tải.':' Ma trận và các thiết lập vẫn được giữ nguyên để thử lại.');
  }finally{btn.disabled=false;}
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
  if(q.parts?.length===1){const merged=mergeQuestionPrompt(q.prompt,q.parts[0].prompt);if(merged&&merged!==String(q.prompt||'').trim())body+=`<div class="preview-options">${esc(stripSinglePartPrefix(q.parts[0].prompt||''))}</div>`;}
  else if(q.parts?.length) body+=`<div class="preview-options">${q.parts.map((p,i)=>`${String(p.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')} (${fmt(p.points)} điểm): ${esc(p.prompt||'')}`).join('<br>')}</div>`;
  return body+'</div>';
}
function examScore(code){return (code?.questions||[]).reduce((s,q)=>s+nval(q.points),0);}
function renderAudit(){
  const safety=localSafetyFlags(),quality=state.exam?strictExamQualityIssues(state.exam):[];
  const optionIssues=quality.filter(x=>x.category==='Độ dài phương án');
  const scoreIssues=quality.filter(x=>['Tổng điểm','Điểm theo ma trận','Điểm câu','Điểm các ý'].includes(x.category));
  const qIssues=quality.filter(isRepairableQuestionIssue);
  const qGroups=groupRepairableQuestionIssues(qIssues);
  const audits=[
    [state.apiOk,'Nhà cung cấp AI',state.apiOk?`Đã kiểm tra ${aiProvider()==='cloudflare'?'Cloudflare Workers AI':'Gemini API cá nhân'}`:'Chưa kiểm tra'],
    [state.selected.size>0,'Phạm vi bài',`${state.selected.size} bài được chọn`],
    [Math.abs(totalPoints()-10)<.001,'Tổng điểm ma trận',`${fmt(totalPoints())}/10,0 điểm`],
    [allConfigs().every(x=>{const l=lessonById(x.lessonId),lev=LEVELS.find(y=>y.id===x.level);return Boolean(effectiveDescriptor(l,lev)||ensureTeacherSpec(x.lessonId)[x.level]);}),'Đặc tả theo bài','Mọi ô ma trận đều có nguồn đặc tả tương ứng'],
    [Boolean(state.exam?.examCodes?.length),'Đề kiểm tra',state.exam?.examCodes?.length?`${state.exam.examCodes.length} mã đề`:'Chưa tạo đề'],
    [Boolean(state.exam?.examCodes?.length)&&!scoreIssues.length,'Điểm đề = 10,0',state.exam?.examCodes?.length?(scoreIssues.length?qualityIssueRefs(scoreIssues,4):state.exam.examCodes.map(c=>`${c.code}: ${fmt(examScore(c))}`).join(' · ')):'Chưa có'],
    [Boolean(state.exam?.examCodes?.length)&&!optionIssues.length,'Độ dài phương án TN',state.exam?.examCodes?.length?(optionIssues.length?`${qualityIssueRefs(optionIssues,6)} cần sửa`:'Các phương án không có chênh lệch lớn theo bộ kiểm tra kỹ thuật'):'Chưa có đề'],
    [Boolean(state.exam?.examCodes?.length)&&!qGroups.length,'Câu cần sửa',state.exam?.examCodes?.length?(qGroups.length?`${qGroups.length} câu: ${qualityIssueRefs(qIssues,8)}`:'Không còn lỗi kỹ thuật cấp câu'):'Chưa có đề'],
    [!safety.some(x=>x.severity==='block'),'An toàn nội dung',safety.length?`${safety.length} cảnh báo cần giáo viên xem`:'Chưa phát hiện cảnh báo tự động']
  ];
  $('#auditGrid').innerHTML=audits.map(([ok,t,d])=>`<div class="audit-item ${ok?'ok':'bad'}"><div class="audit-icon">${ok?'✓':'!'}</div><div><strong>${esc(t)}</strong><div class="tiny">${esc(d)}</div></div></div>`).join('');
}


// ===== V2.3 ONLINE REVIEW + GUARDED AI EDITOR =====
function deepClone(x){return JSON.parse(JSON.stringify(x));}
function examQuestionRefs(){
  const out=[];
  (state.exam?.examCodes||[]).forEach((code,ci)=>(code.questions||[]).forEach((q,qi)=>out.push({code,ci,q,qi})));
  return out;
}
function questionPlainText(q){
  return [q?.context,q?.prompt,...(q?.options||[]),(q?.statements||[]).map(x=>x?.text||x),...(q?.pairsLeft||[]),...(q?.pairsRight||[]),q?.answer,
    ...(q?.rubric||[]).map(x=>x?.content||''),...(q?.parts||[]).flatMap(p=>[p?.prompt,p?.answer,...(p?.rubric||[]).map(x=>x?.content||'')])].filter(Boolean).join(' ');
}
function localSafetyFlags(){
  if(!state.exam?.examCodes?.length)return [];
  const flags=[]; const seen=new Set();
  const add=(severity,category,message,code='',questionNumber='')=>{const k=[severity,category,message,code,questionNumber].join('|');if(!seen.has(k)){seen.add(k);flags.push({severity,category,message,code,questionNumber,source:'local'});}};
  const obscene=/\b(địt|đụ|đéo|lồn|cặc|buồi|fuck|shit)\b/iu;
  const explicit=/\b(khiêu\s*dâm|nội\s*dung\s*khiêu\s*dâm|quan\s*hệ\s*tình\s*dục\s*chi\s*tiết)\b/iu;
  const operationalIllegal=/(?:cách|hướng\s*dẫn|các\s*bước).{0,45}(?:chế\s*tạo|làm|pha|chế).{0,35}(?:bom|chất\s*nổ|vũ\s*khí)|(?:cách|hướng\s*dẫn).{0,45}(?:hack|xâm\s*nhập|trộm|gian\s*lận|trốn\s*thuế|mua\s*bán\s*ma\s*túy)/iu;
  const political=/\b(Đảng|Quốc\s*hội|Chính\s*phủ|Chủ\s*tịch\s*nước|bầu\s*cử|chủ\s*quyền|lãnh\s*thổ|Biển\s*Đông|hệ\s*thống\s*chính\s*trị)\b/iu;
  const legal=/(?:\bLuật\b|\bHiến\s*pháp\b|\bNghị\s*định\b|\bThông\s*tư\b|\bCông\s*ước\b|\bĐiều\s+\d+)/iu;
  examQuestionRefs().forEach(({code,q})=>{
    const text=questionPlainText(q);
    if(obscene.test(text)||explicit.test(text))add('block','Ngôn ngữ/thuần phong mỹ tục','Phát hiện từ ngữ hoặc nội dung có nguy cơ phản cảm/tục tĩu, không phù hợp học sinh THCS.',code.code,q.number);
    if(operationalIllegal.test(text))add('block','Pháp luật/an toàn','Nội dung có dấu hiệu mô tả cách thực hiện hành vi nguy hiểm hoặc vi phạm pháp luật. Chỉ nên đặt theo hướng nhận diện, phòng ngừa hoặc đánh giá.',code.code,q.number);
    if(political.test(text))add('warning','Chính trị – xã hội','Câu có yếu tố chính trị – xã hội. Cần đối chiếu đúng nguồn, giữ diễn đạt trung lập và tránh suy diễn ngoài phạm vi bài học.',code.code,q.number);
    if(legal.test(text))add('warning','Pháp luật','Câu có dẫn chiếu/nội dung pháp luật. Cần đối chiếu nguồn đang dùng và kiểm tra tính chính xác, cập nhật.',code.code,q.number);
  });
  return flags;
}
function resetReviewConfirmation(){
  const cb=$('#reviewConfirm'); if(cb)cb.checked=false; updateExportGate();
}
function updateExportGate(){
  const btn=$('#exportDocxBtn'); if(!btn)return;
  const hardSafety=localSafetyFlags().some(x=>x.severity==='block');
  const quality=state.exam?strictExamQualityIssues(state.exam):[];
  const qCount=groupRepairableQuestionIssues(quality).length;
  btn.disabled=!state.exam?.examCodes?.length || !$('#reviewConfirm')?.checked || hardSafety;
  btn.textContent=quality.length?`⬇ Xuất file .docx · còn ${qCount||quality.length} cảnh báo`:'⬇ Xuất file .docx';
  btn.title=quality.length?'Vẫn có thể xuất Word để giáo viên sửa thủ công. Hãy xem danh sách cảnh báo trước khi xuất.':'Xuất file Word';
}
function reviewMatrixHtml(){
  const lessons=selectedLessons(); if(!lessons.length)return '<div class="notice">Chưa có ma trận.</div>';
  const rows=lessons.map((l,i)=>{const m=ensureLessonMatrix(l.id);return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><b>Bài ${l.num}.</b> ${esc(l.title)}</td><td>${esc(cellCompact(m.nb.tn,'tn')||'—')}</td><td>${esc(cellCompact(m.nb.tl,'tl')||'—')}</td><td>${esc(cellCompact(m.th.tn,'tn')||'—')}</td><td>${esc(cellCompact(m.th.tl,'tl')||'—')}</td><td>${esc(cellCompact(m.vd.tl,'tl')||'—')}</td><td><b>${fmt(lessonPoints(l.id))}</b></td></tr>`;}).join('');
  const total=totalPoints(),pct=LEVELS.map(x=>total?levelPoints(x.id)/total*100:0);
  return `<div class="table-scroll"><table class="matrix-table"><thead><tr><th rowspan="2">TT</th><th rowspan="2">Mạch nội dung</th><th rowspan="2">Bài</th><th colspan="2">Nhận biết</th><th colspan="2">Thông hiểu</th><th>Vận dụng</th><th rowspan="2">Tổng điểm</th></tr><tr><th>TNKQ</th><th>TL</th><th>TNKQ</th><th>TL</th><th>TL</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3"><b>Tổng số câu</b></td><td colspan="2">${countFmt(levelCount('nb'))}</td><td colspan="2">${countFmt(levelCount('th'))}</td><td>${countFmt(levelCount('vd'))}</td><td><b>${fmt(total)}</b></td></tr><tr><td colspan="3"><b>Tỉ lệ %</b></td><td colspan="2">${fmt(pct[0])}%</td><td colspan="2">${fmt(pct[1])}%</td><td>${fmt(pct[2])}%</td><td>${total?'100%':'0%'}</td></tr></tfoot></table></div>`;
}
function reviewSpecHtml(){
  const lessons=selectedLessons(); if(!lessons.length)return '<div class="notice">Chưa có bản đặc tả.</div>';
  const rows=lessons.map((l,i)=>{const m=ensureLessonMatrix(l.id);const desc=LEVELS.map(lev=>`<div class="spec-source-block"><b>${lev.label}:</b>${descriptorHtml(effectiveDescriptor(l,lev))}</div>`).join('');return `<tr><td>${i+1}</td><td>${esc(l.track)}</td><td><b>Bài ${l.num}.</b> ${esc(l.title)}</td><td>${desc}</td><td>${formsForLevel('nb').map(f=>esc(cellCompact(m.nb[f],f))).filter(Boolean).join('<br>')||'—'}</td><td>${formsForLevel('th').map(f=>esc(cellCompact(m.th[f],f))).filter(Boolean).join('<br>')||'—'}</td><td>${esc(cellCompact(m.vd.tl,'tl')||'—')}</td></tr>`;}).join('');
  return `<div class="table-scroll"><table class="spec-table"><thead><tr><th>TT</th><th>Mạch nội dung</th><th>Bài</th><th>Mức độ đánh giá</th><th>Nhận biết</th><th>Thông hiểu</th><th>Vận dụng</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function reviewExamHtml(){
  if(!state.exam?.examCodes?.length)return '<div class="notice">Chưa tạo đề.</div>';
  return state.exam.examCodes.map(code=>{const qs=orderedQuestions(code),tn=qs.filter(q=>q.form==='TNKQ'),tl=qs.filter(q=>q.form==='TL');return `<div class="preview-code"><h3>ĐỀ ${esc(code.code||'A')}</h3><div class="part-heading">PHẦN I. TRẮC NGHIỆM (${fmt(sectionScore(code,'TNKQ'))} điểm)</div>${tnInstruction(tn)?`<p class="tiny">${esc(tnInstruction(tn))}</p>`:''}${tn.map(questionHtml).join('')}<div class="part-heading">PHẦN II. TỰ LUẬN (${fmt(sectionScore(code,'TL'))} điểm)</div>${tl.map(questionHtml).join('')}</div>`;}).join('');
}
function rubricHtml(rubric=[]){return (rubric||[]).map(r=>`<div class="marking-rubric">– ${esc(cleanScoreContent(r.content||''))}${r.points!==undefined&&r.points!==null?` (${fmt(r.points)}đ)`:''}</div>`).join('');}
function markingUnitHtml(q,part=null,index=0,showLabel=true){
  if(part){const inline=splitInlineMarking(part.answer||''),rub=normalizedRubric(part.rubric,inline.rubric),answer=resolvedMarkingAnswer(inline.answer,rub),label=String(part.label||String.fromCharCode(97+index)).replace(/[\.)]$/,'');return `${showLabel?`<div><b>${esc(label)}.</b></div>`:''}${answerBulletsHtml(answer)}${rub.length?'<div class="marking-label">Hướng dẫn chấm:</div>'+rubricHtml(rub):''}`;}
  const inline=splitInlineMarking(answerText(q)),rub=normalizedRubric(q?.rubric,inline.rubric),answer=resolvedMarkingAnswer(inline.answer,rub);return `${answerBulletsHtml(answer)}${rub.length?'<div class="marking-label">Hướng dẫn chấm:</div>'+rubricHtml(rub):''}`;
}

function reviewMarkingHtml(){
  const codes=state.exam?.examCodes||[]; if(!codes.length)return '<div class="notice">Chưa có hướng dẫn chấm.</div>';
  const firstTN=orderedQuestions(codes[0]).filter(q=>q.form==='TNKQ'),notes=[];const groups=new Map();firstTN.forEach(q=>{const k=`${q.subtype}|${q.points}`;if(!groups.has(k))groups.set(k,{type:q.subtype,points:q.points});});groups.forEach(g=>notes.push(`${formLabel(g.type)}: Mỗi câu đúng được ${fmt(g.points)} điểm.`));
  const maxTN=Math.max(...codes.map(c=>orderedQuestions(c).filter(q=>q.form==='TNKQ').length),0);let tnTable='';if(maxTN){const headers=Array.from({length:maxTN},(_,i)=>`<th>${i+1}</th>`).join('');const rows=codes.map(c=>{const qs=orderedQuestions(c).filter(q=>q.form==='TNKQ');return `<tr><th>Đề ${esc(c.code)}</th>${Array.from({length:maxTN},(_,i)=>`<td>${esc(qs[i]?answerText(qs[i]):'')}</td>`).join('')}</tr>`;}).join('');tnTable=`<p class="marking-preview-note">${notes.map(esc).join('<br>')}</p><div class="table-scroll"><table class="review-marking-table"><thead><tr><th>Câu</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;}
  const essays=codes.map(c=>orderedQuestions(c).filter(q=>q.form==='TL')),max=Math.max(...essays.map(x=>x.length),0);let tlRows='';for(let i=0;i<max;i++){const a=essays[0]?.[i],b=essays[1]?.[i];const aParts=a?.parts?.length>1?a.parts:null,bParts=b?.parts?.length>1?b.parts:null;const parts=Math.max(aParts?.length||1,bParts?.length||1);for(let j=0;j<parts;j++){const aCell=a?(aParts?markingUnitHtml(a,aParts[j],j,true):a?.parts?.length===1?markingUnitHtml(a,a.parts[0],0,false):j===0?markingUnitHtml(a):''):'';const bCell=b?(bParts?markingUnitHtml(b,bParts[j],j,true):b?.parts?.length===1?markingUnitHtml(b,b.parts[0],0,false):j===0?markingUnitHtml(b):''):'';tlRows+=`<tr>${j===0?`<td rowspan="${parts}">${esc(a?.number??b?.number??'')}</td>`:''}<td>${aCell}</td>${codes.length>1?`<td>${bCell}</td>`:''}${j===0?`<td rowspan="${parts}">${fmt(a?.points??b?.points??0)}</td>`:''}</tr>`;}}
  const h=codes.length>1?'<th>ĐỀ A</th><th>ĐỀ B</th>':'<th>Yêu cầu cần đạt / Hướng dẫn chấm</th>';
  return `<h3>PHẦN I. TRẮC NGHIỆM (${fmt(sectionScore(codes[0],'TNKQ'))} điểm)</h3>${tnTable}<h3>PHẦN II. TỰ LUẬN (${fmt(sectionScore(codes[0],'TL'))} điểm)</h3><div class="table-scroll"><table class="review-marking-table"><thead><tr><th>Câu</th>${h}<th>Điểm</th></tr></thead><tbody>${tlRows}</tbody></table></div>`;
}
function renderReviewWorkspace(){
  if(!$('#reviewPreview'))return;
  $$('.review-tab').forEach(b=>b.classList.toggle('active',b.dataset.reviewTab===state.reviewTab));
  const titles={matrix:'Ma trận',spec:'Bản đặc tả',exam:'Đề kiểm tra',marking:'Hướng dẫn chấm'};$('#reviewPreviewTitle').textContent=titles[state.reviewTab]||'Xem trước';
  $('#reviewPreview').innerHTML=state.reviewTab==='matrix'?reviewMatrixHtml():state.reviewTab==='spec'?reviewSpecHtml():state.reviewTab==='exam'?reviewExamHtml():reviewMarkingHtml();
  renderAiScopeOptions();renderSafetyReport();renderQualityIssueReport();updateExportGate();
}
function renderAiScopeOptions(){
  const sel=$('#aiScope');if(!sel)return;const current=sel.value;let opts='<option value="">Chọn câu/ý cần chỉnh...</option>';
  (state.exam?.examCodes||[]).forEach((code,ci)=>(code.questions||[]).forEach((q,qi)=>{const n=q.number||qi+1;opts+=`<optgroup label="Đề ${esc(code.code)} · Câu ${n}"><option value="${ci}|${qi}|whole">Toàn câu ${n}</option>${q.context?`<option value="${ci}|${qi}|context">Tình huống câu ${n}</option>`:''}<option value="${ci}|${qi}|marking">Đáp án/Hướng dẫn chấm câu ${n}</option>${(q.parts?.length>1?q.parts:[]).map((p,pi)=>`<option value="${ci}|${qi}|partMarking|${pi}">Hướng dẫn chấm ý ${esc(p.label||String.fromCharCode(97+pi))} câu ${n}</option>`).join('')}</optgroup>`;}));sel.innerHTML=opts;if([...sel.options].some(o=>o.value===current))sel.value=current;
}
function parseScopeValue(v){const [ci,qi,field,pi]=String(v||'').split('|');if(ci===''||qi===''||!field)return null;const code=state.exam?.examCodes?.[Number(ci)],q=code?.questions?.[Number(qi)];if(!q)return null;return {ci:Number(ci),qi:Number(qi),field,pi:pi===undefined?null:Number(pi),code,question:q};}
function appendChat(kind,text){const log=$('#aiChatLog');if(!log)return;const d=document.createElement('div');d.className=kind==='user'?'chat-user':kind==='ai'?'chat-ai':'chat-system';d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;}
function proposalPlainText(q){if(!q)return '';let out=[];if(q.context)out.push('Tình huống: '+q.context);if(q.prompt)out.push('Câu hỏi: '+q.prompt);if(q.options?.length)out.push(q.options.map((x,i)=>`${String.fromCharCode(65+i)}. ${stripChoiceLabel(x)}`).join('\n'));if(q.parts?.length)q.parts.forEach((p,i)=>{out.push(`${q.parts.length>1?`${p.label||String.fromCharCode(97+i)}. `:''}${stripSinglePartPrefix(p.prompt||'')}`);if(p.answer)out.push('Đáp án:\n'+answerBulletItems(p.answer).map(x=>'– '+x).join('\n'));(p.rubric||[]).forEach(r=>out.push(`– ${r.content} (${fmt(r.points)}đ)`));});else{if(q.answer)out.push('Đáp án: '+answerText(q));(q.rubric||[]).forEach(r=>out.push(`– ${r.content} (${fmt(r.points)}đ)`));}return out.join('\n');}
function renderProposal(data){const box=$('#aiProposal');if(!box)return;if(!data?.proposal?.question){box.classList.add('hidden');box.innerHTML='';return;}const warns=(data.warnings||[]).map(x=>`<li>${esc(x)}</li>`).join('');box.classList.remove('hidden');box.innerHTML=`<strong>Đề xuất của AI</strong><p class="tiny">${esc(data.summary||'')}</p>${warns?`<ul class="tiny">${warns}</ul>`:''}<div class="proposal-preview">${esc(proposalPlainText(data.proposal.question))}</div><div class="proposal-actions"><button type="button" class="btn primary" id="applyAiProposal">Áp dụng</button><button type="button" class="btn ghost" id="discardAiProposal">Bỏ qua</button></div>`;$('#applyAiProposal').addEventListener('click',applyAiProposal);$('#discardAiProposal').addEventListener('click',()=>{state.reviewProposal=null;renderProposal(null);});}
async function sendAiEdit(){
  if(!state.apiOk)return alert('Hãy kiểm tra nhà cung cấp AI trước.');if(!state.exam?.examCodes?.length)return alert('Chưa có đề để chỉnh.');const target=parseScopeValue($('#aiScope').value);if(!target)return alert('Hãy chọn phạm vi chỉnh sửa.');const req=$('#aiEditRequest').value.trim();if(!req)return alert('Hãy nhập yêu cầu điều chỉnh.');
  const btn=$('#aiEditBtn');btn.disabled=true;$('#editAiDot').className='status-dot neutral';appendChat('user',req);
  try{const data=await post('/api/refine',{...aiRequestParams(),payload:buildPayload(),target:{codeIndex:target.ci,questionIndex:target.qi,field:target.field,partIndex:target.pi,code:target.code.code,question:deepClone(target.question)},teacherRequest:req});state.reviewProposal={...data,target:{ci:target.ci,qi:target.qi}};renderProposal(state.reviewProposal);appendChat('ai',data.summary||'AI đã tạo một phương án chỉnh sửa. Hãy xem và bấm Áp dụng nếu phù hợp.');$('#editAiDot').className='status-dot ok';}catch(e){appendChat('ai','Không thể tạo đề xuất: '+e.message);$('#editAiDot').className='status-dot bad';}finally{btn.disabled=false;}
}
function applyAiProposal(){const d=state.reviewProposal;if(!d?.proposal?.question||!d.target)return;state.editHistory.push(deepClone(state.exam));if(state.editHistory.length>10)state.editHistory.shift();const oldQ=state.exam.examCodes[d.target.ci].questions[d.target.qi],newQ=deepClone(d.proposal.question);newQ.points=oldQ.points;newQ.form=oldQ.form;newQ.subtype=oldQ.subtype;if(Array.isArray(oldQ.parts)&&Array.isArray(newQ.parts)&&oldQ.parts.length===newQ.parts.length)newQ.parts.forEach((p,i)=>p.points=oldQ.parts[i].points);state.exam.examCodes[d.target.ci].questions[d.target.qi]=newQ;state.exam=normalizeGeneratedScores(state.exam);state.exam=balanceSingleChoiceAnswers(state.exam);state.reviewProposal=null;state.aiReview=null;renderProposal(null);renderExam();renderAudit();renderReviewWorkspace();resetReviewConfirmation();$('#undoEditBtn').disabled=false;const qi=strictExamQualityIssues(state.exam);appendChat('ai',qi.length?'Đã áp dụng nhưng bộ kiểm tra kỹ thuật còn cảnh báo. Hãy xem mục Kiểm tra trước khi xuất Word.':'Đã áp dụng đề xuất và kiểm tra kỹ thuật đạt yêu cầu.');}
function undoAiEdit(){if(!state.editHistory.length)return;state.exam=state.editHistory.pop();state.reviewProposal=null;state.aiReview=null;renderProposal(null);renderExam();renderAudit();renderReviewWorkspace();resetReviewConfirmation();$('#undoEditBtn').disabled=!state.editHistory.length;appendChat('ai','Đã hoàn tác lần chỉnh sửa gần nhất.');}
function renderSafetyReport(){const root=$('#safetyReport');if(!root)return;const local=localSafetyFlags(),worker=state.exam?.safetyFlags||[],ai=state.aiReview?.issues||[],items=[...local,...worker,...ai];if(!items.length){root.classList.remove('hidden');root.innerHTML='<h3>Rà soát an toàn & chuyên môn</h3><div class="safety-issue"><span class="safety-badge info">THÔNG TIN</span><div>Chưa phát hiện cảnh báo. Kết quả tự động không thay thế việc giáo viên kiểm tra.</div></div>';return;}root.classList.remove('hidden');root.innerHTML=`<h3>Rà soát an toàn & chuyên môn (${items.length})</h3>${items.map(x=>`<div class="safety-issue"><span class="safety-badge ${esc(x.severity||'warning')}">${x.severity==='block'?'CẦN SỬA':x.severity==='info'?'THÔNG TIN':'KIỂM TRA'}</span><div><b>${esc(x.category||'Cảnh báo')}${x.code?` · Đề ${esc(x.code)}`:''}${x.questionNumber?` · Câu ${esc(x.questionNumber)}`:''}</b><div>${esc(x.message||'')}</div>${x.suggestion?`<div class="tiny"><b>Gợi ý:</b> ${esc(x.suggestion)}</div>`:''}</div></div>`).join('')}${local.some(x=>x.severity==='block')?'<div class="local-block-notice"><b>Chưa thể xuất Word</b> cho đến khi các cảnh báo nghiêm trọng tự động được xử lí.</div>':''}`;}
async function runAiReview(){if(!state.apiOk)return alert('Hãy kiểm tra nhà cung cấp AI trước.');if(!state.exam?.examCodes?.length)return alert('Chưa có đề để rà soát.');const btn=$('#aiReviewBtn');btn.disabled=true;btn.textContent='Đang rà soát…';try{state.aiReview=await post('/api/review',{...aiRequestParams(),payload:buildPayload(),exam:state.exam});renderSafetyReport();appendChat('ai',state.aiReview.summary||`Đã rà soát: ${(state.aiReview.issues||[]).length} điểm cần chú ý.`);}catch(e){appendChat('ai','Rà soát thất bại: '+e.message);}finally{btn.disabled=false;btn.textContent='🔍 AI rà soát toàn bộ';}}

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
  let xml='';
  LEVELS.forEach(lev=>{
    xml+=wP(`${lev.label}:`,{b:true,size:20,after:10});
    xml+=descriptorDoc(effectiveDescriptor(l,lev));
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
  if(q.parts?.length===1){const merged=mergeQuestionPrompt(q.prompt,q.parts[0].prompt);if(merged&&merged!==String(q.prompt||'').trim())xml+=wP(stripSinglePartPrefix(q.parts[0].prompt||''),{size:24,after:35});}
  else if(q.parts?.length)q.parts.forEach((p,i)=>xml+=wP(`${String(p.label||String.fromCharCode(97+i)).replace(/[\.\)]$/,'')} (${fmt(p.points)} điểm): ${p.prompt||''}`,{size:24,after:35}));
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
function answerBulletItems(raw=''){
  let text=String(raw||'').replace(/\r/g,'').trim();if(!text)return [];
  text=text.replace(/\s*[;；]\s*/g,'\n').replace(/\s+(?=[–—•]\s+)/g,'\n');
  const rows=text.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/^(?:[–—•-]|\d+[\.\)]|[a-zA-Z][\.\)])\s*/,'').trim()).filter(Boolean);
  return [...new Set(rows)];
}
function answerBulletsHtml(raw){
  const items=answerBulletItems(raw);return `<div class="marking-label"><b>Đáp án gợi ý:</b></div><ul class="answer-bullets">${(items.length?items:['[Cần bổ sung đáp án gợi ý trước khi sử dụng]']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
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
function deriveAnswerFromRubric(rubric=[]){
  const answers=[];
  (rubric||[]).forEach(r=>{
    const content=cleanScoreContent(r?.content||'');
    const match=content.match(/(?:^|[.;]\s*)(?:ví\s*dụ|gợi\s*ý|đáp\s*án(?:\s*gợi\s*ý)?)\s*:\s*(.+)$/iu);
    if(match?.[1])answers.push(match[1].trim());
  });
  return [...new Set(answers)].join('\n');
}
function resolvedMarkingAnswer(answer,rubric=[]){
  return String(answer||'').trim()||deriveAnswerFromRubric(rubric)||'[Cần bổ sung đáp án gợi ý trước khi sử dụng]';
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
function answerBulletsDoc(raw){
  let xml=wPParts([{text:'Đáp án gợi ý:',b:true}],{size:20,after:12});
  const items=answerBulletItems(raw);(items.length?items:['[Cần bổ sung đáp án gợi ý trước khi sử dụng]']).forEach(x=>xml+=wP(`– ${x}`,{size:20,after:16}));return xml;
}
function partMarkingCellDoc(part,index,showLabel=true){
  if(!part)return wP('',{size:20,after:18});
  const label=String(part.label||String.fromCharCode(97+index)).replace(/[\.)]$/,'');
  const inline=splitInlineMarking(part.answer||'');const rubric=normalizedRubric(part.rubric,inline.rubric);let xml='';
  if(showLabel)xml+=wP(`${label}.`,{b:true,size:20,after:8});
  xml+=answerBulletsDoc(resolvedMarkingAnswer(inline.answer,rubric));
  if(rubric.length){xml+=markingGuideTitleDoc();xml+=rubricDoc(rubric);}return xml;
}
function questionMarkingCellDoc(q){
  if(!q)return wP('',{size:20,after:18});
  const inline=splitInlineMarking(answerText(q));const rubric=normalizedRubric(q.rubric,inline.rubric);let xml=answerBulletsDoc(resolvedMarkingAnswer(inline.answer,rubric));
  if(rubric.length){xml+=markingGuideTitleDoc();xml+=rubricDoc(rubric);}return xml;
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
      const ap=a?.parts?.length>1?a.parts:null;
      const bp=b?.parts?.length>1?b.parts:null;
      const subrows=Math.max(ap?.length||1,bp?.length||1);
      for(let j=0;j<subrows;j++){
        const aDoc=ap?partMarkingCellDoc(ap[j],j,true):(a?.parts?.length===1?partMarkingCellDoc(a.parts[0],0,false):(j===0?questionMarkingCellDoc(a):wP('',{size:20,after:18})));
        const bDoc=bp?partMarkingCellDoc(bp[j],j,true):(b?.parts?.length===1?partMarkingCellDoc(b.parts[0],0,false):(j===0?questionMarkingCellDoc(b):wP('',{size:20,after:18})));
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
    const parts=q?.parts?.length>1?q.parts:null;
    const subrows=parts?.length||1;
    for(let j=0;j<subrows;j++){
      const cell=parts?partMarkingCellDoc(parts[j],j,true):(q?.parts?.length===1?partMarkingCellDoc(q.parts[0],0,false):questionMarkingCellDoc(q));
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
  if(!$('#reviewConfirm')?.checked)return alert('Hãy xác nhận đã kiểm tra bản cuối trước khi xuất Word.');
  const hardFlags=localSafetyFlags().filter(x=>x.severity==='block'); if(hardFlags.length)return alert('Chưa thể xuất Word vì còn cảnh báo an toàn nghiêm trọng. Hãy xem mục Kiểm tra & Xuất Word và chỉnh lại nội dung.');
  const quality=strictExamQualityIssues(state.exam);
  if(quality.length){
    const msg=`Đề vẫn còn ${quality.length} cảnh báo kỹ thuật:\n\n${qualityIssueText(quality,10)}\n\nBạn vẫn muốn xuất Word để kiểm tra và sửa thủ công?`;
    if(!window.confirm(msg))return;
  }
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
  state.specOverrides=loadSpecOverrides();
  $('#versionBadge').textContent='V'+(CFG.APP_VERSION||'2.0.0');$('#apiGuide').href=CFG.API_GUIDE_URL||'#';
  $$('.step-btn').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.step)));
  $$('.next-btn').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.next)));
  $$('.prev-btn').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.prev)));
  $('#grade').addEventListener('change',e=>{state.grade=e.target.value;state.selected.clear();state.matrix={};state.teacherSpec={};state.exam=null;state.editHistory=[];state.reviewProposal=null;state.aiReview=null;renderLessons();resetReviewConfirmation();});
  $('#clearLessons').addEventListener('click',()=>{state.selected.clear();renderLessons();});
  $('#saveSpecBtn')?.addEventListener('click',saveSpecOverrides);$('#resetSpecBtn')?.addEventListener('click',()=>{if(confirm('Khôi phục đặc tả gốc cho các bài đang chọn?'))resetSelectedSpecOverrides();});
  $('#toggleKey').addEventListener('click',()=>{$('#apiKey').type=$('#apiKey').type==='password'?'text':'password';});
  $('#toggleFallbackKey')?.addEventListener('click',()=>{const el=$('#fallbackApiKey');if(el)el.type=el.type==='password'?'text':'password';});
  $('#testApiBtn').addEventListener('click',testApi);$('#modelSelect').addEventListener('change',e=>state.model=e.target.value);$$('input[name="aiProvider"]').forEach(r=>r.addEventListener('change',syncAiProviderUI));
  $('input[name="mode"][value="7991"]').addEventListener('change',()=>{renderMatrix();});$('input[name="mode"][value="normal"]').addEventListener('change',()=>{renderMatrix();});
  $('#addConfigBtn').addEventListener('click',()=>{state.dialog.rows.push(state.dialog.form==='tn'?{subtype:'single',count:1,points:.25}:{essayType:'direct',count:1,points:1,partsCount:1,partPoints:[1]});renderConfigRows();});
  $('#closeDialog').addEventListener('click',()=>$('#matrixDialog').close());$('#cancelDialog').addEventListener('click',()=>$('#matrixDialog').close());
  $('#matrixForm').addEventListener('submit',e=>{e.preventDefault();const d=state.dialog;const err=d.form==='tl'?validateEssayRows(d.rows):validateConfigCounts(d.rows,'tn');if(err){alert(err);return;}ensureLessonMatrix(d.lessonId)[d.level][d.form]=d.rows.filter(r=>nval(r.count)>0&&nval(r.points)>0);$('#matrixDialog').close();renderMatrix();});
  $('#generateBtn').addEventListener('click',generateExam);$('#exportDocxBtn').addEventListener('click',exportDocx);
  const syncDisabled=()=>$('#disabledOptions')?.classList.toggle('hidden',!$('#disabledGuide').checked);
  $('#disabledGuide').addEventListener('change',syncDisabled); syncDisabled();
  $$('.review-tab').forEach(b=>b.addEventListener('click',()=>{state.reviewTab=b.dataset.reviewTab;renderReviewWorkspace();}));
  $('#repairIssuesBtn')?.addEventListener('click',async()=>{const btn=$('#repairIssuesBtn');if(!state.apiOk)return alert('Hãy kiểm tra nhà cung cấp AI trước.');if(!state.exam?.examCodes?.length)return alert('Chưa có đề để sửa.');btn.disabled=true;const old=btn.textContent;btn.textContent='Đang sửa từng câu…';try{await repairCurrentQuestionIssues({manual:true});}finally{btn.disabled=false;btn.textContent=old;}});
  $('#aiReviewBtn')?.addEventListener('click',runAiReview);
  $('#aiEditBtn')?.addEventListener('click',sendAiEdit);
  $('#undoEditBtn')?.addEventListener('click',undoAiEdit);
  $('#reviewConfirm')?.addEventListener('change',updateExportGate);
  $$('.chip-btn[data-ai-quick]').forEach(b=>b.addEventListener('click',()=>{$('#aiEditRequest').value=b.dataset.aiQuick||'';}));
  $('#grade').value=state.grade;syncAiProviderUI();renderLessons();renderMatrix();renderSpec();renderAudit();renderReviewWorkspace();updateExportGate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
