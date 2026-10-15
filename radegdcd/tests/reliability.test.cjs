const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function app(){
  const elements=new Map(),storage=new Map(),alerts=[];
  const el=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',checked:false,disabled:false,textContent:'',title:'',classList:{remove(){},add(){},toggle(){}},addEventListener(){}});return elements.get(selector);};
  el('#examCodes').value='1';el('input[name="mode"]:checked').value='normal';
  const ctx={window:{APP_CONFIG:{APP_VERSION:'2.5.9'},GDCD_DATA:{grades:{'6':{lessons:[{id:'lesson',num:1,title:'Bài học',descriptor:{nhan_biet:'Nhận biết.'}}]}}},JSZip:{}},document:{readyState:'loading',addEventListener(){},querySelector:el,querySelectorAll:()=>[]},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},alert:m=>alerts.push(m),setTimeout,clearTimeout};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','reliability.js'),'utf8'),ctx);
  const text=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8').replace(/\}\)\(\);\s*$/,'globalThis.audit={state,buildPayload,strictExamQualityIssues,moveCorrectAnswerTo,balanceSingleChoiceAnswers,updateExportGate,exportDocx,saveGenerationProgress,restoreGenerationProgress};})();');
  vm.runInContext(text,ctx);const a=ctx.audit;
  a.state.selected.add('lesson');a.state.matrix.lesson={nb:{tn:[{count:2,points:5,subtype:'single'}],tl:[]},th:{tn:[],tl:[]},vd:{tn:[],tl:[]}};
  const cfg=a.buildPayload().matrix[0];
  const questions=[1,2].map(i=>({questionId:`${cfg.id}::${i}`,configId:cfg.id,lessonId:'lesson',level:'nb',form:'TNKQ',subtype:'single',points:5,number:i,prompt:`Yêu cầu thứ ${i}`,answer:'A',distractor:'B',options:['Sáng tạo trong lao động','Cần cù trong lao động','Tự giác trong lao động','Hợp tác trong lao động'],optionRationales:['Đúng vì có dấu hiệu cải tiến.','Sai vì chưa đủ dấu hiệu cần cù.','Sai vì chưa thể hiện tự giác.','Sai vì không có sự phối hợp.'],distractorRationale:'Nhầm kết quả cải tiến với sự cần cù.'}));
  questions.forEach(q=>q.verification={status:'passed',contentHash:ctx.GDCD_RELIABILITY.contentHash(q)});
  a.state.exam={examCodes:[{code:'A',questions}],inputHash:ctx.GDCD_RELIABILITY.hash(a.buildPayload())};el('#reviewConfirm').checked=true;
  return {...a,ctx,el,storage,alerts};
}
test('valid reviewed exam enables export; missing 5 points disables and blocks export function',async()=>{
  const a=app();assert.equal(a.strictExamQualityIssues(a.state.exam).length,0);a.updateExportGate();assert.equal(a.el('#exportDocxBtn').disabled,false);
  a.state.exam.examCodes[0].questions.pop();a.updateExportGate();assert.equal(a.el('#exportDocxBtn').disabled,true);await a.exportDocx();assert.match(a.alerts[0],/Chưa thể xuất/);
});
test('invalid E or empty correct answer stays invalid during answer balancing',()=>{
  const a=app();for(const answer of ['E','']){const q={...a.state.exam.examCodes[0].questions[0],answer};a.moveCorrectAnswerTo(q,'B');assert.equal(q.answer,answer);}
});
test('answer reordering moves rationale and distractor and preserves review binding',()=>{
  const a=app(),q=a.state.exam.examCodes[0].questions[0];a.moveCorrectAnswerTo(q,'D');assert.equal(q.answer,'D');assert.equal(q.options[3],'Sáng tạo trong lao động');assert.match(q.optionRationales[3],/^Đúng/);assert.equal(q.verification.contentHash,a.ctx.GDCD_RELIABILITY.contentHash(q));
});
test('stale lesson, changed descriptors, duplicate questions and edited unreviewed options block export',()=>{
  for(const mutate of [a=>a.state.exam.examCodes[0].questions[0].lessonId='other',a=>a.state.teacherSpec.lesson={nb:'Yêu cầu mới',th:'',vd:''},a=>a.state.exam.examCodes[0].questions[1].prompt=a.state.exam.examCodes[0].questions[0].prompt,a=>a.state.exam.examCodes[0].questions[0].options[0]='Cách làm khác']){
    const a=app();mutate(a);assert.ok(a.strictExamQualityIssues(a.state.exam).length);a.updateExportGate();assert.equal(a.el('#exportDocxBtn').disabled,true);
  }
});
test('session progress restores configuration and accepted parts without saving API credentials',()=>{
  const a=app();a.el('#apiKey').value='SECRET_MUST_NOT_BE_SAVED';a.el('#fallbackApiKey').value='OTHER_SECRET';
  a.state.generationDraft={payload:{setup:{grade:'6'}},fingerprint:'hash',nextIndex:1,totalChunks:3,parts:[{questions:a.state.exam.examCodes[0].questions}]};
  a.saveGenerationProgress();const raw=[...a.storage.values()][0];assert.ok(raw.includes('questionId'));assert.ok(!raw.includes('SECRET'));a.state.generationDraft=null;a.state.selected.clear();a.restoreGenerationProgress();assert.equal(a.state.generationDraft.nextIndex,1);assert.ok(a.state.selected.has('lesson'));
});
test('Word export produces a real DOCX with questions and key, excluding teacher-only distractor rationale',async()=>{
  const a=app(),JSZip=require('../jszip.min.js');let blob;
  a.ctx.JSZip=JSZip;a.ctx.window.JSZip=JSZip;
  a.ctx.URL={createObjectURL(value){blob=value;return 'blob:qa';},revokeObjectURL(){}};
  a.ctx.document.createElement=()=>({click(){}});
  await a.exportDocx();assert.ok(blob,'Expected a generated Word archive');
  const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  const xml=await zip.file('word/document.xml').async('string');
  assert.match(xml,/Yêu cầu thứ 1/);assert.match(xml,/Yêu cầu thứ 2/);assert.match(xml,/HƯỚNG DẪN CHẤM/);
  assert.ok(!xml.includes('Nhầm kết quả cải tiến với sự cần cù.'));
  assert.ok(zip.file('[Content_Types].xml'));assert.ok(zip.file('word/styles.xml'));
});
