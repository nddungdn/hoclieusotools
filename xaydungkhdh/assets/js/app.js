import { createDefaultState } from './state.js';
import { parseUploadedFile, combinedText, inferFilenameKind } from './parsers.js';
import { loadProviderModels, testAI, integrateExistingAppendices, reviewExistingDocuments, addUsage } from './api.js';
import { prepareTextbookJob, runTextbookAnalysis, requestPause, markFailedForRetry, resetTextbookAnalysis, buildCurriculumFromAnalysis } from './analysis-engine.js';
import { saveLocal, loadLocal, downloadProject, importProjectFile } from './storage.js';
import { validateState } from './validation.js';
import { buildDocumentModel } from './document-model.js';
import { renderDocumentPreview } from './preview.js';
import { exportDocx } from './export-docx.js';
import { exportPdfViaPrint } from './print-pdf.js';

let state = createDefaultState();
let currentStep = 1;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function setStatus(msg,type=''){
  const el=$('#statusBar'); el.textContent=msg; el.className=`statusbar ${type}`;
}
function busy(msg){setStatus(msg,'busy')}
function ok(msg){setStatus(msg,'ok')}
function fail(err){console.error(err);setStatus(err?.message||String(err),'error')}

function init(){
  bindNavigation(); bindStaticFields(); bindActions(); renderAll(); setDefaultUploadKind();
  const saved=loadLocal();
  if(saved && confirm('Có dự án lưu tạm trên trình duyệt. Khôi phục?')){ state={...createDefaultState(),...saved, ai:{...createDefaultState().ai,...saved.ai,apiKey:''}}; renderAll(); ok('Đã khôi phục dự án lưu tạm.'); }
}

function bindNavigation(){
  $$('.step').forEach(b=>b.addEventListener('click',()=>goStep(Number(b.dataset.step))));
  $('#btnNext').addEventListener('click',()=>goStep(Math.min(7,currentStep+1)));
  $('#btnPrev').addEventListener('click',()=>goStep(Math.max(1,currentStep-1)));
  $$('.mode-card').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;renderModes();setDefaultUploadKind()}));
  $$('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
}
function goStep(n){
  currentStep=n;
  $$('.step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===n));
  $$('.step-panel').forEach(x=>x.classList.toggle('hidden',Number(x.dataset.panel)!==n));
  $('#btnPrev').disabled=n===1; $('#btnNext').style.visibility=n===7?'hidden':'visible';
  if(n===7){validateAndRender();renderPreview();}
}
function showTab(id){
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  $$('.tabbox').forEach(x=>x.classList.toggle('hidden',x.id!==id));
}

function bindStaticFields(){
  const map={academicYear:['project','academicYear'],grade:['project','grade'],totalPeriods:['project','totalPeriods'],semester1Periods:['project','semester1Periods'],semester2Periods:['project','semester2Periods'],deviceMode:['project','deviceMode'],schoolName:['school','officialName'],department:['school','department'],locality:['school','locality'],organizationMode:['school','organizationMode'],totalClassesManual:['school','totalClassesManual'],totalStudentsManual:['school','totalStudentsManual'],provider:['ai','provider'],model:['ai','model'],pl1OtherContents:['pl1','otherContents'],teacherName:['pl3','teacherName'],defaultLocation:['pl3','defaultLocation'],defaultEquipment:['pl3','defaultEquipment'],otherTasks:['pl3','otherTasks']};
  for(const [id,path] of Object.entries(map)){
    const el=$('#'+id); if(!el)continue;
    el.addEventListener('input',()=>setPath(path,el.value));
  }
  $('#apiKey').addEventListener('input',e=>{state.ai.apiKey=e.target.value;clearModelSelection();});
  $('#provider').addEventListener('change',()=>{state.ai.model='';clearModelSelection();});
  $('#consent').addEventListener('change',e=>state.ai.consentGiven=e.target.checked);
  $('#apPl1').addEventListener('change',e=>state.appendices.pl1=e.target.checked);
  $('#apPl2').addEventListener('change',e=>state.appendices.pl2=e.target.checked);
  $('#apPl3').addEventListener('change',e=>state.appendices.pl3=e.target.checked);
  $('#integrateNls').addEventListener('change',e=>state.options.integrateNls=e.target.checked);
  $('#integrateQpan').addEventListener('change',e=>state.options.integrateQpan=e.target.checked);
  $('#reviewYccd').addEventListener('change',e=>state.options.reviewYccd=e.target.checked);
  $('#reviewCurriculum').addEventListener('change',e=>state.options.reviewCurriculum=e.target.checked);
  $('#normalizeN30').addEventListener('change',e=>state.options.normalizeNghiDinh30=e.target.checked);
  $('#includeFormativeAssessments').addEventListener('change',e=>{state.pl3.includeFormativeAssessments=e.target.checked;renderFormativeAssessments();});
  $$('#staffFields input').forEach(el=>el.addEventListener('input',()=>state.pl1.staff[el.dataset.staff]=el.value));
}
function setPath(path,val){let o=state;for(let i=0;i<path.length-1;i++)o=o[path[i]];o[path.at(-1)]=val;state.meta.lastUpdated=new Date().toISOString();}

function bindActions(){
  $('#btnToggleKey').addEventListener('click',()=>{const x=$('#apiKey');x.type=x.type==='password'?'text':'password';$('#btnToggleKey').textContent=x.type==='password'?'Hiện':'Ẩn'});
  $('#btnLoadModels').addEventListener('click',async()=>{
    try{
      guardConsent();busy('Đang kiểm tra API Key và tải danh sách model...');
      const r=await loadProviderModels(state);
      populateModels(r.models||[]);
      ok(`API Key hợp lệ. Đã tải ${r.models?.length||0} model.`);
    }catch(e){clearModelSelection();fail(formatApiError(e));}
  });
  $('#btnTestApi').addEventListener('click',async()=>{try{guardConsent();busy('Đang kiểm tra model...');const r=await testAI(state);addUsage(state.analysis.textbook.usage,r.meta||{},0);ok(r.result?.message||'Kết nối API và model thành công.');renderAnalysis();}catch(e){fail(formatApiError(e))}});
  $('#filesInput').addEventListener('change',handleFiles);
  $('#btnAnalyzeTextbook').addEventListener('click',analyzeTextbook);
  $('#btnPauseAnalysis').addEventListener('click',()=>{requestPause(state);busy('Đã yêu cầu tạm dừng. Hệ thống sẽ dừng sau phần đang xử lý.');renderAnalysis();});
  $('#btnResumeAnalysis').addEventListener('click',analyzeTextbook);
  $('#btnRetryFailed').addEventListener('click',()=>{markFailedForRetry(state);renderAnalysis();analyzeTextbook();});
  $('#btnResetAnalysis').addEventListener('click',()=>{if(confirm('Xóa toàn bộ checkpoint phân tích SGK? PPCT hiện có không bị xóa.')){resetTextbookAnalysis(state);renderAnalysis();ok('Đã xóa checkpoint phân tích SGK.');}});
  $('#btnBuildCurriculum').addEventListener('click',buildCurriculumFromCheckpoint);
  $('#btnAddSite').addEventListener('click',()=>{state.school.sites.push({id:crypto.randomUUID(),type:'BRANCH_CAMPUS',name:'',locality:'',classCount:'',studentCount:'',note:''});renderSites()});
  $('#btnAddEquipment').addEventListener('click',()=>{state.pl1.equipment.push({name:'',quantity:'',site:'',scope:'',note:''});renderEquipment()});
  $('#btnAddFacility').addEventListener('click',()=>{state.pl1.facilities.push({name:'',quantity:'',site:'',scope:'',note:''});renderFacilities()});
  $('#btnAddActivity').addEventListener('click',()=>{state.pl2.activities.push({topic:'',yccd:'',periods:'',time:'',location:'',lead:'',coordinate:'',conditions:''});renderActivities()});
  $('#btnAddAssignment').addEventListener('click',()=>{state.pl3.assignments.push({className:'',grade:state.project.grade,site:''});renderAssignments()});
  $('#btnAddFormativeAssessment').addEventListener('click',()=>{state.pl3.formativeAssessments=state.pl3.formativeAssessments||[];state.pl3.formativeAssessments.push({unit:'',competency:'',content:'',yccd:'',attempt:'',time:'',form:'',target:'',tool:''});renderFormativeAssessments()});
  $('#btnAddCurriculumRow').addEventListener('click',()=>{state.curriculum.push({unit:'',lesson:'',periodStart:'',periodEnd:'',periodCount:1,week:'',yccd:'',digitalCompetency:[],defenseSecurity:[]});renderCurriculum()});
  $('#btnRunAI').addEventListener('click',runAI);
  $('#btnValidateNow').addEventListener('click',validateAndRender);
  $('#btnExportDocx').addEventListener('click',async()=>{try{validateAndRender();if(state.validation.errors.length&&!confirm('Còn lỗi đỏ. Bạn vẫn muốn tải bản nháp Word?'))return;busy('Đang tạo DOCX...');await exportDocx(state);ok('Đã tạo file DOCX.')}catch(e){fail(e)}});
  $('#btnExportPdf').addEventListener('click',()=>{try{validateAndRender();if(state.validation.errors.length&&!confirm('Còn lỗi đỏ. Bạn vẫn muốn mở bản nháp để lưu PDF?'))return;exportPdfViaPrint(state);ok('Đã mở bản in. Chọn Save as PDF/Lưu dưới dạng PDF.')}catch(e){fail(e)}});
  $('#btnSaveLocal').addEventListener('click',()=>{saveLocal(state);ok('Đã lưu tạm trên trình duyệt (không lưu API Key).')});
  $('#btnDownloadProject').addEventListener('click',()=>downloadProject(state));
  $('#projectFile').addEventListener('change',async e=>{try{state=await importProjectFile(e.target.files[0]);renderAll();ok('Đã mở dự án. API Key không được nạp từ tệp.')}catch(err){fail(err)}});
}
function guardConsent(){if(!state.ai.consentGiven)throw new Error('Bạn cần xác nhận hiểu việc gửi phần nội dung cần thiết tới nhà cung cấp AI đã chọn.');}
function clearModelSelection(){const el=$('#model');if(!el)return;state.ai.model='';state.ai.modelInfo=null;el.innerHTML='<option value="">Kiểm tra khóa để tải danh sách model</option>';el.disabled=true;renderAnalysis();renderModelCapability();}
function populateModels(models){
  const el=$('#model');el.innerHTML='<option value="">-- Chọn model --</option>';
  for(const item of models){
    const info=typeof item==='string'?{id:item,displayName:item}:item;
    const base=info.displayName&&info.displayName!==info.id?`${info.displayName} (${info.id})`:info.id;
    const pdf=info.capabilities?.pdfNative===true?' · PDF scan':info.capabilities?.pdfNative===false?' · không PDF scan':'';
    const o=document.createElement('option');o.value=info.id;o.textContent=base+pdf;o.dataset.info=JSON.stringify(info);el.appendChild(o);
  }
  el.disabled=false;
  el.onchange=()=>{state.ai.model=el.value;const o=el.selectedOptions[0];state.ai.modelInfo=o?.dataset?.info?JSON.parse(o.dataset.info):null;renderAnalysis();renderModelCapability();};
}
function formatApiError(e){
  if(e?.category==='AUTH') return new Error('API Key không hợp lệ, bị hạn chế hoặc chưa có quyền dùng API. Hãy tạo/kiểm tra lại khóa của đúng nhà cung cấp.');
  if(e?.category==='QUOTA_OR_RATE_LIMIT') return new Error('API đã vượt hạn mức/tốc độ hoặc tài khoản chưa có quota/billing phù hợp. Kiểm tra quota và thanh toán của nhà cung cấp.');
  if(e?.category==='MODEL_OR_ENDPOINT') return new Error('Model không tồn tại hoặc không được tài khoản này hỗ trợ. Hãy tải lại danh sách model rồi chọn lại.');
  if(e?.category==='PAYLOAD_TOO_LARGE'||e?.category==='NATIVE_PDF_CHUNK_TOO_LARGE') return new Error('Một phần dữ liệu/PDF vẫn quá lớn. v1.2.3 sẽ tự chia nhỏ khi còn nhiều hơn một trang; nếu chỉ một trang vẫn lỗi, hãy giảm dung lượng PDF nguồn.');
  if(e?.category==='TIMEOUT'||e?.category==='NETWORK') return new Error('Kết nối bị gián đoạn hoặc hết thời gian chờ. Các phần đã xong vẫn được giữ; hãy bấm Tiếp tục.');
  return e;
}

async function handleFiles(e){
  const files=[...e.target.files];
  if(!files.length)return;
  busy(`Đang đọc ${files.length} tệp...`);
  for(const file of files){
    try{
      const parsed=await parseUploadedFile(file);
      const selectedKind=$('#uploadKind')?.value||'AUTO'; const resolvedKind=selectedKind==='AUTO'?resolveAutoKind(file,parsed):selectedKind; const doc={id:crypto.randomUUID(),name:file.name,size:file.size,lastModified:file.lastModified||0,type:file.type,kind:resolvedKind,detectedKind:parsed.kind,nameHintKind:parsed.nameHintKind||inferFilenameKind(file.name),kindMismatchDismissed:false,scanned:parsed.scanned,pdfMode:parsed.pdfMode||null,averageTextCharsPerPage:Number(parsed.averageTextCharsPerPage)||0,pageCount:parsed.pageCount||null,extractedPages:parsed.extractedPages||null,charCount:parsed.charCount||parsed.text?.length||0,parsedText:parsed.text,pages:parsed.pages||null,file};
      const oldIndex=state.documents.findIndex(d=>d.name===doc.name&&Number(d.size)===Number(doc.size)&&Number(d.lastModified||0)===Number(doc.lastModified||0));
      if(oldIndex>=0)state.documents[oldIndex]={...state.documents[oldIndex],...doc,id:state.documents[oldIndex].id||doc.id};else state.documents.push(doc);
    }catch(err){state.warnings.push(`${file.name}: ${err.message}`)}
  }
  renderFiles(); renderAnalysis(); const sgkCount=state.documents.filter(d=>d.kind==='TEXTBOOK').length; ok(sgkCount?`Đã tiếp nhận tài liệu. Hiện có ${sgkCount} tệp được gán loại SGK; hãy kiểm tra trạng thái PDF ở danh sách.`:'Đã tiếp nhận tài liệu nhưng chưa có tệp nào được gán loại SGK. Hãy đổi loại tài liệu thành “Sách giáo khoa (SGK)” nếu đây là sách giáo khoa.');
}


function setDefaultUploadKind(){
  const el=$('#uploadKind');
  if(!el)return;
  // Chế độ tạo mới ưu tiên SGK; tích hợp/rà soát ưu tiên tự nhận diện.
  if(state.mode==='new' && (!el.dataset.userChanged || el.value==='AUTO')) el.value='TEXTBOOK';
  else if(state.mode!=='new' && !el.dataset.userChanged) el.value='AUTO';
  el.onchange=()=>{el.dataset.userChanged='1';};
}

function resolveAutoKind(file,parsed){
  const filenameKind=parsed.nameHintKind||inferFilenameKind(file?.name);
  if(filenameKind!=='OTHER')return filenameKind;
  if(parsed.kind && parsed.kind!=='OTHER') return parsed.kind;
  const name=String(file?.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const looksTextbookName=/(sgk|sach.?giao.?khoa|ngu.?van|nguvan|tap.?[12]|lop.?[6-9])/.test(name);
  const largeBookLike=(Number(parsed.pageCount)||0)>=60;
  if(state.mode==='new' && (looksTextbookName || largeBookLike)) return 'TEXTBOOK';
  return parsed.kind||'OTHER';
}

function changeDocumentKind(index,newKind){
  const d=state.documents[index]; if(!d)return;
  const oldKind=d.kind;
  if(oldKind===newKind)return;
  const affectsTextbook=oldKind==='TEXTBOOK'||newKind==='TEXTBOOK';
  if(affectsTextbook && (state.analysis?.textbook?.chunks?.length||0)){
    if(!confirm('Đổi loại SGK sẽ xóa checkpoint phân tích SGK hiện tại để tránh dùng nhầm dữ liệu. Tiếp tục?')){renderFiles();return;}
    resetTextbookAnalysis(state);
  }
  d.kind=newKind;
  d.kindMismatchDismissed=false;
  renderFiles(); renderAnalysis();
  const count=state.documents.filter(x=>x.kind==='TEXTBOOK').length;
  ok(count?`Đã cập nhật loại tài liệu. Hiện có ${count} tệp SGK.`:'Hiện chưa có tệp nào được đánh dấu SGK.');
}

async function runAI(){
  try{
    guardConsent();
    if(state.mode==='new'){
      throw new Error('Chế độ tạo mới v1.2.3 dùng hai nút: “1. Phân tích SGK” rồi “2. Tạo PPCT & tích hợp”.');
    }else if(state.mode==='integrate'){
      const text=combinedText(state.documents,['PL1','PL2','PL3','PPCT','TEXTBOOK','TEACHER_BOOK']);
      if(!text)throw new Error('Chưa có tài liệu để tích hợp.');
      busy('AI đang phân tích phụ lục hiện có và đề xuất tích hợp...');
      const {result,meta}=await integrateExistingAppendices(state,text,{onRetry:showRetry});
      addUsage(state.analysis.existing.usage,meta,Math.ceil(text.length/3));
      applyAiResult(result,'SOURCE_CONFIRMED');
    }else{
      const text=combinedText(state.documents,null);
      if(!text)throw new Error('Chưa có tài liệu để rà soát.');
      busy('AI đang rà soát hồ sơ...');
      const {result,meta}=await reviewExistingDocuments(state,text,{onRetry:showRetry});
      addUsage(state.analysis.existing.usage,meta,Math.ceil(text.length/3));
      applyAiResult(result,state.curriculum.length?state.meta.curriculumSource:'AI_DRAFT');
    }
    renderAll();goStep(6);validateAndRender();ok('AI đã hoàn tất. Hãy rà soát từng dòng trước khi xác nhận sử dụng.');
  }catch(e){fail(formatApiError(e))}
}

async function analyzeTextbook(){
  try{
    guardConsent();
    if(state.mode!=='new')throw new Error('Phân tích SGK nhiều bước dùng cho chế độ Tạo mới từ SGK.');
    if(!state.ai.model)throw new Error('Hãy kiểm tra API và chọn model trước.');
    prepareTextbookJob(state);renderAnalysis();
    busy('Đang phân tích SGK theo từng phần. Có thể tạm dừng sau phần hiện tại...');
    await runTextbookAnalysis(state,{
      onProgress:()=>renderAnalysis(),
      onRetry:(info,chunk)=>{busy(`Phần ${chunk.pageStart||chunk.part}-${chunk.pageEnd||chunk.part}: API tạm lỗi, tự thử lại sau ${Math.ceil(info.wait/1000)} giây...`);renderAnalysis();},
      onStatus:()=>renderAnalysis()
    });
    renderAnalysis();
    if(state.analysis.textbook.status==='completed')ok('Đã phân tích xong SGK. Bước tiếp theo: Tạo PPCT & tích hợp.');
    else if(state.analysis.textbook.status==='paused')ok('Đã tạm dừng. Các phần hoàn thành đã được lưu checkpoint.');
  }catch(e){renderAnalysis();fail(formatApiError(e))}
}

async function buildCurriculumFromCheckpoint(){
  try{
    guardConsent();
    const job=state.analysis.textbook;
    if(!job?.completed)throw new Error('Chưa có kết quả phân tích SGK.');
    if(job.completed<job.total&&!confirm(`Mới hoàn thành ${job.completed}/${job.total} phần. Tạo PPCT từ dữ liệu chưa đầy đủ?`))return;
    busy('Đang hợp nhất kết quả phân tích và tạo PPCT...');
    const result=await buildCurriculumFromAnalysis(state,{onProgress:m=>busy(m),onRetry:showRetry});
    applyAiResult(result,'AI_DRAFT');renderAll();validateAndRender();ok('Đã tạo PPCT từ dữ liệu SGK đã rút gọn. Hãy rà soát từng dòng.');
  }catch(e){fail(formatApiError(e))}
}

function showRetry(info){busy(`API tạm lỗi. Tự thử lại sau ${Math.ceil((info.wait||0)/1000)} giây...`);}

function applyAiResult(result,source){
  if(result.curriculum?.length) state.curriculum=result.curriculum.map(normalizeCurriculumRow);
  if(result.assessments?.length) state.assessments=result.assessments;
  if(result.educationalActivities?.length && !state.pl2.activities.length) state.pl2.activities=result.educationalActivities;
  if(result.suggestions?.length) state.aiSuggestions=result.suggestions;
  state.warnings=[...(state.warnings||[]),...(result.warnings||[])];
  state.meta.curriculumSource=source;
}
function normalizeCurriculumRow(r){
  return {
    unit:r.unit||r.topic||'',lesson:r.lesson||r.content||'',content:r.content||'',
    periodStart:r.periodStart||'',periodEnd:r.periodEnd||'',periodCount:Number(r.periodCount)||calcCount(r.periodStart,r.periodEnd)||1,
    week:r.week||'',semester:r.semester||'',yccd:Array.isArray(r.yccd)?r.yccd.join('; '):(r.yccd||''),
    digitalCompetency:Array.isArray(r.digitalCompetency)?r.digitalCompetency:[],defenseSecurity:Array.isArray(r.defenseSecurity)?r.defenseSecurity:[],
    equipment:r.equipment||'',location:r.location||'',sourceStatus:r.sourceStatus||'AI_DRAFT'
  };
}
function calcCount(a,b){a=Number(a);b=Number(b);return a&&b&&b>=a?b-a+1:0}

function renderAll(){
  renderModes(); syncFields(); renderSites(); renderFiles(); renderEquipment();renderFacilities();renderActivities();renderAssignments();renderFormativeAssessments();renderCurriculum();renderWarnings();renderAnalysis();renderModelCapability();validateAndRender();
}
function renderModes(){
  $$('.mode-card').forEach(x=>x.classList.toggle('selected',x.dataset.mode===state.mode));
  const a=$('#textbookAnalysisBox'),b=$('#existingAiBox');
  if(a)a.classList.toggle('hidden',state.mode!=='new');
  if(b)b.classList.toggle('hidden',state.mode==='new');
}
function syncFields(){
  const ids={academicYear:state.project.academicYear,grade:state.project.grade,totalPeriods:state.project.totalPeriods,semester1Periods:state.project.semester1Periods,semester2Periods:state.project.semester2Periods,deviceMode:state.project.deviceMode,schoolName:state.school.officialName,department:state.school.department,locality:state.school.locality,organizationMode:state.school.organizationMode,totalClassesManual:state.school.totalClassesManual,totalStudentsManual:state.school.totalStudentsManual,provider:state.ai.provider,model:state.ai.model,pl1OtherContents:state.pl1.otherContents,teacherName:state.pl3.teacherName,defaultLocation:state.pl3.defaultLocation,defaultEquipment:state.pl3.defaultEquipment,otherTasks:state.pl3.otherTasks};
  for(const [id,v] of Object.entries(ids)){const el=$('#'+id);if(!el)continue;if(id==='model'){if([...el.options].some(o=>o.value===String(v??'')))el.value=v??'';}else el.value=v??''}
  $('#apiKey').value=state.ai.apiKey||'';$('#consent').checked=!!state.ai.consentGiven;
  $('#apPl1').checked=!!state.appendices.pl1;$('#apPl2').checked=!!state.appendices.pl2;$('#apPl3').checked=!!state.appendices.pl3;
  $('#integrateNls').checked=!!state.options.integrateNls;$('#integrateQpan').checked=!!state.options.integrateQpan;$('#reviewYccd').checked=!!state.options.reviewYccd;$('#reviewCurriculum').checked=!!state.options.reviewCurriculum;$('#normalizeN30').checked=!!state.options.normalizeNghiDinh30;
  $('#includeFormativeAssessments').checked=!!state.pl3.includeFormativeAssessments;
  $$('#staffFields input').forEach(el=>el.value=state.pl1.staff[el.dataset.staff]??'');
}

function renderSites(){
  const el=$('#sitesEditor');el.innerHTML='';
  state.school.sites.forEach((s,i)=>{
    const row=document.createElement('div');row.className='editor-row';row.innerHTML=`<select data-k="type"><option value="MAIN_CAMPUS">Trụ sở chính</option><option value="BRANCH_CAMPUS">Phân hiệu</option><option value="SCHOOL_SITE">Điểm trường</option></select><input data-k="name" placeholder="Tên cơ sở"><input data-k="locality" placeholder="Địa danh"><input data-k="classCount" type="number" placeholder="Số lớp"><input data-k="studentCount" type="number" placeholder="Số HS"><button title="Xóa">×</button>`;
    ['type','name','locality','classCount','studentCount'].forEach(k=>{const f=row.querySelector(`[data-k="${k}"]`);f.value=s[k]??'';f.addEventListener('input',()=>{s[k]=f.value;renderSiteSummary()})});
    row.querySelector('button').addEventListener('click',()=>{if(state.school.sites.length===1)return alert('Cần ít nhất một cơ sở.');state.school.sites.splice(i,1);renderSites()}); el.appendChild(row);
  }); renderSiteSummary();
}
function renderSiteSummary(){const c=state.school.sites.reduce((a,s)=>a+(Number(s.classCount)||0),0),h=state.school.sites.reduce((a,s)=>a+(Number(s.studentCount)||0),0);let x=$('#siteSummary');if(!x){x=document.createElement('div');x.id='siteSummary';x.className='site-summary';$('#sitesEditor').after(x)}x.textContent=`Tổng theo cơ sở: ${c} lớp – ${h} học sinh.`}

function renderFiles(){
  const kinds=[['TEXTBOOK','SGK'],['TEACHER_BOOK','SGV'],['PPCT','PPCT'],['PL1','PL1'],['PL2','PL2'],['PL3','PL3'],['NLS','NLS'],['QPAN','GDQP&AN'],['OTHER','Khác']];
  const el=$('#fileList');el.innerHTML=state.documents.map((d,i)=>{
    const hint=d.nameHintKind||inferFilenameKind(d.name);
    const mismatch=hint!=='OTHER'&&hint!==d.kind&&!d.kindMismatchDismissed;
    const pdfInfo=d.pdfMode==='SCANNED_PDF'?`<span class="tag scan">PDF scan/ảnh · ${Number(d.averageTextCharsPerPage||0).toFixed(1)} ký tự/trang</span>`:d.pdfMode==='TEXT_PDF'?`<span class="tag text">PDF có lớp chữ · ${Number(d.averageTextCharsPerPage||0).toFixed(0)} ký tự/trang</span>`:'';
    const warning=mismatch?`<div class="file-warning">⚠ Tên tệp gợi ý <strong>${kindLabel(hint)}</strong>, nhưng đang chọn <strong>${kindLabel(d.kind)}</strong>.<div class="mini-actions"><button class="ghost" data-acceptkind="${i}" data-kind="${hint}">Đổi thành ${kindLabel(hint)}</button><button class="ghost" data-dismisskind="${i}">Vẫn giữ ${kindLabel(d.kind)}</button></div></div>`:'';
    return `<div class="file-item"><div class="file-main"><strong>${esc(d.name)}</strong><div class="muted">${Math.round(d.size/1024)} KB${d.pageCount?` · ${d.pageCount} trang`:''} · ${fmtNum(d.charCount||0)} ký tự</div><div class="file-tags">${pdfInfo}<span class="tag">Loại đã chọn: ${kindLabel(d.kind)}</span></div>${warning}</div><select class="doc-kind-select" data-kindfile="${i}" aria-label="Loại tài liệu">${kinds.map(([v,l])=>`<option value="${v}"${d.kind===v?' selected':''}>${l}</option>`).join('')}</select><button class="ghost" data-rmfile="${i}">Xóa</button></div>`;
  }).join('');
  $$('[data-kindfile]').forEach(sel=>sel.addEventListener('change',()=>changeDocumentKind(Number(sel.dataset.kindfile),sel.value)));
  $$('[data-acceptkind]').forEach(b=>b.addEventListener('click',()=>changeDocumentKind(Number(b.dataset.acceptkind),b.dataset.kind)));
  $$('[data-dismisskind]').forEach(b=>b.addEventListener('click',()=>{const d=state.documents[Number(b.dataset.dismisskind)];if(d){d.kindMismatchDismissed=true;renderFiles();}}));
  $$('[data-rmfile]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.rmfile);const wasTextbook=state.documents[i]?.kind==='TEXTBOOK';state.documents.splice(i,1);if(wasTextbook&&(state.analysis?.textbook?.chunks?.length||0))resetTextbookAnalysis(state);renderFiles();renderAnalysis()}));
}

function kindLabel(kind){return ({TEXTBOOK:'SGK',TEACHER_BOOK:'SGV',PPCT:'PPCT',PL1:'PL1',PL2:'PL2',PL3:'PL3',NLS:'NLS',QPAN:'GDQP&AN',OTHER:'Khác'})[kind]||kind||'Khác';}

function renderModelCapability(){
  const el=$('#modelCapability');if(!el)return;
  const info=state.ai.modelInfo;
  if(!state.ai.model||!info){el.className='notice info';el.textContent='Chưa có thông tin khả năng đọc PDF của model.';return;}
  const cap=info.capabilities||{};
  if(cap.pdfNative===true){el.className='notice ok';el.textContent=`✓ Model ${state.ai.model} được phép dùng Native PDF Pipeline để đọc PDF scan.`;}
  else if(cap.pdfNative===false){el.className='notice warning';el.textContent=`⚠ Model ${state.ai.model} không được đánh dấu hỗ trợ PDF scan. Hãy chọn model khác nếu SGK là PDF ảnh.`;}
  else{el.className='notice warning';el.textContent='Chưa xác định chắc khả năng đọc PDF scan của model này. Có thể thử với tệp nhỏ trước.';}
}

function renderEquipment(){renderSimpleEditor('#equipmentEditor',state.pl1.equipment,['name','quantity','site','scope','note'],['Tên thiết bị','Số lượng','Cơ sở','Phạm vi','Ghi chú'],renderEquipment)}
function renderFacilities(){renderSimpleEditor('#facilityEditor',state.pl1.facilities,['name','quantity','site','scope','note'],['Tên phòng/không gian','Số lượng','Cơ sở','Phạm vi','Ghi chú'],renderFacilities)}
function renderSimpleEditor(sel,list,keys,phs,rerender){const el=$(sel);el.innerHTML='';list.forEach((item,i)=>{const row=document.createElement('div');row.className='editor-row';row.innerHTML=keys.map((k,j)=>`<input data-k="${k}" placeholder="${phs[j]}">`).join('')+'<button>×</button>';keys.forEach(k=>{const f=row.querySelector(`[data-k="${k}"]`);f.value=item[k]??'';f.addEventListener('input',()=>item[k]=f.value)});row.querySelector('button').addEventListener('click',()=>{list.splice(i,1);rerender()});el.appendChild(row)})}

function renderActivities(){
  const el=$('#activitiesEditor');el.innerHTML='';state.pl2.activities.forEach((a,i)=>{const row=document.createElement('div');row.className='editor-row activity';const keys=['topic','yccd','periods','time','location','lead','coordinate','conditions'];const ph=['Chủ đề','YCCD','Số tiết','Thời điểm','Địa điểm','Chủ trì','Phối hợp','Điều kiện'];row.innerHTML=keys.map((k,j)=>`<input data-k="${k}" placeholder="${ph[j]}">`).join('')+'<button>×</button>';keys.forEach(k=>{const f=row.querySelector(`[data-k="${k}"]`);f.value=a[k]??'';f.addEventListener('input',()=>a[k]=f.value)});row.querySelector('button').addEventListener('click',()=>{state.pl2.activities.splice(i,1);renderActivities()});el.appendChild(row)})
}
function renderAssignments(){
  const el=$('#assignmentsEditor');el.innerHTML='';state.pl3.assignments.forEach((a,i)=>{const row=document.createElement('div');row.className='editor-row small';row.innerHTML='<input data-k="className" placeholder="Lớp, ví dụ 8/1"><input data-k="grade" placeholder="Khối"><input data-k="site" placeholder="Cơ sở"><button>×</button>';['className','grade','site'].forEach(k=>{const f=row.querySelector(`[data-k="${k}"]`);f.value=a[k]??'';f.addEventListener('input',()=>a[k]=f.value)});row.querySelector('button').addEventListener('click',()=>{state.pl3.assignments.splice(i,1);renderAssignments()});el.appendChild(row)})
}

function renderFormativeAssessments(){
  const enabled=!!state.pl3.includeFormativeAssessments;
  $('#formativeAssessmentBox').classList.toggle('hidden',!enabled);
  const list=state.pl3.formativeAssessments=state.pl3.formativeAssessments||[];
  const tbody=$('#formativeAssessmentTable tbody');tbody.innerHTML='';
  const keys=['unit','competency','content','yccd','attempt','time','form','target','tool'];
  list.forEach((item,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=keys.map(k=>`<td><textarea data-k="${k}" rows="3"></textarea></td>`).join('')+'<td><button class="ghost" title="Xóa">×</button></td>';
    keys.forEach(k=>{const input=tr.querySelector(`[data-k="${k}"]`);input.value=item[k]||'';input.addEventListener('input',()=>item[k]=input.value);});
    tr.querySelector('button').addEventListener('click',()=>{list.splice(i,1);renderFormativeAssessments();});
    tbody.appendChild(tr);
  });
}

function renderCurriculum(){
  const tbody=$('#curriculumTable tbody');tbody.innerHTML='';
  state.curriculum.forEach((r,i)=>{
    const tr=document.createElement('tr');
    const nls=formatNlsForEdit(r.digitalCompetency), q=formatQpanForEdit(r.defenseSecurity), periods=r.periodStart&&r.periodEnd?`${r.periodStart}-${r.periodEnd}`:(r.periodStart||r.periodCount||'');
    tr.innerHTML=`<td>${i+1}</td><td><textarea data-k="unit"></textarea></td><td><textarea data-k="lesson"></textarea></td><td><input data-k="periods" value="${esc(periods)}"></td><td><input data-k="week"></td><td><textarea data-k="yccd"></textarea></td><td><textarea data-k="nls"></textarea></td><td><textarea data-k="qpan"></textarea></td><td><button class="ghost">×</button></td>`;
    tr.querySelector('[data-k="unit"]').value=r.unit||'';tr.querySelector('[data-k="lesson"]').value=r.lesson||r.content||'';tr.querySelector('[data-k="week"]').value=r.week||'';tr.querySelector('[data-k="yccd"]').value=r.yccd||'';tr.querySelector('[data-k="nls"]').value=nls;tr.querySelector('[data-k="qpan"]').value=q;
    tr.querySelectorAll('[data-k]').forEach(f=>f.addEventListener('input',()=>updateCurriculumFromCell(r,f.dataset.k,f.value)));
    tr.querySelector('button').addEventListener('click',()=>{state.curriculum.splice(i,1);renderCurriculum();validateAndRender()});tbody.appendChild(tr);
  }); renderCounter();
}
function updateCurriculumFromCell(r,k,v){if(k==='unit'||k==='lesson'||k==='week'||k==='yccd')r[k]=v;else if(k==='periods'){const m=v.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);if(m){r.periodStart=Number(m[1]);r.periodEnd=Number(m[2]);r.periodCount=r.periodEnd-r.periodStart+1}else{r.periodStart=Number(v)||'';r.periodEnd='';r.periodCount=Number(v)?1:(Number(r.periodCount)||1)}}else if(k==='nls'){r.digitalCompetency=v.split('\n').filter(Boolean).map(x=>{const m=x.match(/(\d+\.\d+\.TC[12][a-z])/i);return m?{code:m[1],objective:x.replace(m[1],'').replace(/^\s*[:\-–]\s*/,'')} : x})}else if(k==='qpan'){r.defenseSecurity=v.split('\n').filter(Boolean).map(x=>({content:x.replace(/^GDQP&AN\s*:\s*/i,'')}))}renderCounter()}
function formatNlsForEdit(list){return (Array.isArray(list)?list:[]).map(x=>typeof x==='string'?x:`${x.code||''}: ${x.objective||x.description||''}`.trim()).join('\n')}
function formatQpanForEdit(list){return (Array.isArray(list)?list:[]).map(x=>typeof x==='string'?x:(x.content||x.objective||'')).join('\n')}
function renderCounter(){const sum=state.curriculum.reduce((a,r)=>a+(Number(r.periodCount)||calcCount(r.periodStart,r.periodEnd)||0),0);$('#periodCounter').textContent=`${sum}/${state.project.totalPeriods||140} tiết`}

function renderAnalysis(){
  const box=$('#textbookAnalysisBox');if(!box)return;
  const job=state.analysis?.textbook||{};
  const total=Number(job.total)||0,done=Number(job.completed)||0,failed=Number(job.failed)||0;
  const pct=total?Math.round(done*100/total):0;
  $('#analysisProgress').style.width=`${pct}%`;
  const labels={idle:'Chưa phân tích',prepared:'Đã chia phần',running:'Đang chạy',paused:'Tạm dừng',completed:'Hoàn thành',partial:'Chưa hoàn tất',failed:'Lỗi'};
  $('#analysisState').textContent=labels[job.status]||job.status||'Chưa phân tích';
  const u=job.usage||{};
  const modelInfo=state.ai.modelInfo||{};
  $('#analysisStats').innerHTML=[
    `<span>Tiến độ: <strong>${done}/${total}</strong> phần (${pct}%)</span>`,
    job.pipeline?`<span>Pipeline: <strong>${job.pipeline==='native_pdf'?'PDF scan':job.pipeline==='mixed'?'Kết hợp':'Văn bản'}</strong></span>`:'',
    `<span>Lỗi: <strong>${failed}</strong></span>`,
    `<span>API calls: <strong>${u.requests||0}</strong></span>`,
    `<span>Input tokens thực: <strong>${fmtNum(u.inputTokens||0)}</strong></span>`,
    `<span>Output tokens: <strong>${fmtNum(u.outputTokens||0)}</strong></span>`,
    !u.inputTokens&&u.estimatedInputTokens?`<span>Input ước tính: <strong>${fmtNum(u.estimatedInputTokens)}</strong></span>`:'',
    modelInfo.inputTokenLimit?`<span>Context model: <strong>${fmtNum(modelInfo.inputTokenLimit)}</strong></span>`:''
  ].filter(Boolean).join('');
  const chunks=job.chunks||[];
  $('#chunkList').innerHTML=chunks.length?chunks.map((c,i)=>{
    const page=c.pageStart?`tr. ${c.pageStart}${c.pageEnd&&c.pageEnd!==c.pageStart?`–${c.pageEnd}`:''}`:`phần ${c.part||i+1}`;
    const status=c.status==='completed'?'<span class="status-ok">✓ Xong</span>':c.status==='failed'?'<span class="status-err">✕ Lỗi</span>':c.status==='running'?'<span class="status-run">⟳ Đang xử lý</span>':'<span class="status-wait">Chờ</span>';
    const detail=c.lastError?` title="${esc(c.lastError)}"`:'';
    const metric=c.pipeline==='native_pdf'?`${c.pageCount||((c.pageEnd||0)-(c.pageStart||0)+1)} trang PDF`:`~${fmtNum(c.estimatedTokens||0)} token`;
    const pipeline=c.pipeline==='native_pdf'?'<span class="chunk-pipeline">Native PDF</span>':'<span class="chunk-pipeline">Text</span>';
    return `<div class="chunk-item"${detail}><span>#${i+1}</span><span>${esc(c.docName)} · ${page}${pipeline}</span><span>${metric}</span>${status}</div>`;
  }).join(''):(state.documents.some(d=>d.kind==='TEXTBOOK')?'<div class="muted" style="padding:10px">Đã có SGK. Nhấn “1. Phân tích SGK” để bắt đầu.</div>':(state.documents.length?'<div class="notice warning" style="margin:8px">Đã tải tài liệu nhưng chưa có tệp nào được đánh dấu <strong>SGK</strong>. Quay lại bước 3 và chọn loại <strong>SGK</strong> cho Tập 1/Tập 2.</div>':'<div class="muted" style="padding:10px">Tải SGK rồi nhấn “Phân tích SGK”.</div>'));
  $('#btnPauseAnalysis').disabled=job.status!=='running';
  $('#btnResumeAnalysis').disabled=!['paused','partial','prepared'].includes(job.status);
  $('#btnRetryFailed').disabled=!failed;
  $('#btnBuildCurriculum').disabled=!done;
}
function fmtNum(n){return new Intl.NumberFormat('vi-VN').format(Number(n)||0)}

function renderWarnings(){
  const all=[...(state.warnings||[]),...(state.aiSuggestions||[]).map(x=>typeof x==='string'?x:(x.message||JSON.stringify(x)))];
  $('#aiWarnings').innerHTML=all.length?`<div class="notice warning">${all.slice(-8).map(x=>`• ${esc(x)}`).join('<br>')}</div>`:'';
}
function validateAndRender(){
  const v=validateState(state);const el=$('#validationDashboard');
  el.innerHTML=`<div class="validation">${v.errors.map(x=>`<div class="vitem err">✕ ${esc(x)}</div>`).join('')}${v.warnings.map(x=>`<div class="vitem warn">⚠ ${esc(x)}</div>`).join('')}${v.passed.map(x=>`<div class="vitem ok">✓ ${esc(x)}</div>`).join('')}</div>`;
  return v;
}
function renderPreview(){
  $('#previewArea').innerHTML=renderDocumentPreview(buildDocumentModel(state));
}

init();
