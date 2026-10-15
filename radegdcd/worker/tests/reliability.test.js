import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{__test as W} from '../index.js';
import {googleConfig,googleText,classifyGoogleError,generateReliableChunk} from '../reliable.js';
const R=globalThis.GDCD_RELIABILITY;
const clone=x=>JSON.parse(JSON.stringify(x));
function tn(count=4,points=.75){return {id:'tn',lessonId:'lesson',lessonTitle:'Bài học',level:'nb',levelName:'Nhận biết',form:'TNKQ',subtype:'single',count,pointsPerQuestion:points,total:count*points};}
function essay(id,level,points,extra={}){return {id,lessonId:'lesson',lessonTitle:'Bài học',level,form:'TL',subtype:'essay',essayType:'direct',partsCount:1,partPoints:[points],count:1,pointsPerQuestion:points,total:points,...extra};}
function payload(matrix=[tn(4,2.5)]){return {setup:{grade:'8',examCodes:2},lessons:[{id:'lesson',title:'Lao động cần cù, sáng tạo',descriptor:{nhan_biet:'Nhận biết cần cù và sáng tạo.',thong_hieu:'Giải thích ý nghĩa.',van_dung:'Xử lí tình huống.'}}],matrix};}
const explanations={optionRationales:['Đúng vì thể hiện dấu hiệu cải tiến.','Sai vì nhầm siêng năng với đổi mới.','Sai vì chưa có dấu hiệu tự giác.','Sai vì chưa có dấu hiệu phối hợp.'],distractorRationale:'Học sinh dễ nhầm kết quả tốt do cải tiến với sự siêng năng đơn thuần.'};
function question(slot,cfg){
  const base={questionId:slot.questionId,prompt:`Yêu cầu riêng tại vị trí ${slot.questionId}`,context:''};
  if(cfg.form==='TL')return {...base,answer:'Nêu cách ứng xử phù hợp yêu cầu bài.',rubric:[{content:'Nêu được cách ứng xử phù hợp.',points:cfg.pointsPerQuestion}],...(cfg.partsCount>1?{parts:cfg.partPoints.map((points,i)=>({prompt:`Yêu cầu ý ${i+1}`,answer:'Đáp án ý phù hợp.',rubric:[{content:'Nêu đúng ý.',points}]}))}:{}),context:cfg.essayType==='situation'?'H gặp bạn chưa hoàn thành nhiệm vụ.':''};
  return {...base,options:['Sáng tạo trong lao động','Cần cù trong lao động','Tự giác trong lao động','Hợp tác trong lao động'],answer:'A',distractor:'B',...clone(explanations)};
}
function inputPayload(input){const text=input.messages[1].content;return JSON.parse(text.slice(text.indexOf('{')));}
function makeEnv({generate,verify}={}){
  const calls=[];
  return {SYSTEM_PROMPT_A:'A',SYSTEM_PROMPT_B:'B',SYSTEM_PROMPT_C:'C',calls,AI:{async run(model,input){
    const p=inputPayload(input);calls.push(p);
    if(p._task==='verify')return {response:verify?await verify(p):{results:p.questions.map(q=>({questionId:q.questionId,passed:true,correctAnswers:[q.answer],unambiguous:true,distractorPlausible:true,reason:'Có đủ dấu hiệu phân biệt đúng nhất và nhiễu dựa trên nhầm lẫn kiến thức.'}))}};
    return {response:generate?await generate(p):{examCodes:[{code:'A',questions:p.requestedSlots.map(slot=>question(slot,p.matrix[0]))}]}};
  }}};
}
async function post(env,path,body){const response=await worker.fetch(new Request(`https://example.test/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env);return {status:response.status,data:await response.json()};}
test('matrix rejects inconsistent totals, nonfinite points and duplicate IDs before AI',async()=>{
  for(const matrix of [[{...tn(),total:10}],[{...tn(),pointsPerQuestion:'NaN',total:10}],[tn(2,2.5),tn(2,2.5)]]){
    const env=makeEnv(),out=await post(env,'generation-plan',{payload:payload(matrix)});assert.equal(out.status,400);assert.equal(env.calls.length,0);
  }
});
test('MAX_TOKENS is distinguished from malformed JSON and thought text is excluded',()=>{
  assert.throws(()=>googleText({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"ok":true}'}]}}]}),e=>e.code==='AI_TRUNCATED');
  assert.equal(googleText({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private'},{text:'{"ok":true}'}]}}]}),'{"ok":true}');
});
test('Gemini schema fixes slot count and four options; model parameters match model family',()=>{
  const p=payload();p.requestedSlots=[{questionId:'tn::1'},{questionId:'tn::2'}];
  const config=googleConfig('gemini-3.8-flash',p,6000),schema=config.responseSchema.properties.examCodes.items.properties.questions;
  assert.equal(schema.minItems,2);assert.equal(schema.maxItems,2);assert.equal(schema.items.properties.options.minItems,4);assert.equal(config.temperature,undefined);
  assert.equal(googleConfig('gemini-2.5-flash',p,6000).thinkingConfig.thinkingBudget,0);
});
test('Google cooldown is preserved and daily quota does not trigger blind retries',()=>{
  assert.equal(W.backoffDelayMs({retryAfterMs:60000},0,'gemini'),60000);
  const e=classifyGoogleError(Object.assign(new Error('quota'),{httpStatus:429}),{error:{details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProject'}]}]}});
  assert.equal(e.code,'GOOGLE_DAILY_LIMIT');assert.equal(W.retryableAIError(e),false);
  const now=Date.now(),d=W.googleRetryAfterMs({},new Date(now+60000).toUTCString());assert.ok(d>=58000&&d<=60000);
});
test('12 TN × .25 plus 1+2+4 essay points yields complete A/B with validated answers',async()=>{
  const env=makeEnv(),p=payload([tn(12,.25),essay('tl1','nb',1),essay('tl2','th',2),essay('tl3','vd',4,{essayType:'situation',partsCount:2,partPoints:[2,2]})]);
  const plan=await post(env,'generation-plan',{payload:p});assert.equal(plan.status,200);const questions=[];
  for(let i=0;i<plan.data.totalChunks;i++){
    const out=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:i,previousQuestions:questions});assert.equal(out.status,200,out.data.error);assert.equal(out.data.missingSlots.length,0,JSON.stringify(out.data.issues));questions.push(...out.data.questions);
  }
  const final=await post(env,'finalize-generation',{payload:p,questions});assert.equal(final.status,200,final.data.error);
  for(const code of final.data.examCodes){assert.equal(code.questions.filter(q=>q.form==='TNKQ').length,12);assert.equal(code.questions.reduce((n,q)=>n+q.points,0),10);assert.equal(R.examIssues({examCodes:[code]},{...p,setup:{examCodes:1}},{verification:true}).length,0);}
  assert.equal(env.calls.filter(p=>p._task==='generate').length,6);assert.equal(env.calls.filter(p=>p._task==='verify').length,3);
});
test('underfilled batch retains accepted slots and requests only the missing slot',async()=>{
  let generated=0;const env=makeEnv({generate:p=>{generated++;const slots=generated===1?p.requestedSlots.slice(0,3):p.requestedSlots;return {examCodes:[{code:'A',questions:slots.map(slot=>question(slot,p.matrix[0]))}]};}}),p=payload();
  const first=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0});assert.equal(first.status,200);assert.equal(first.data.questions.length,3);assert.deepEqual(first.data.missingSlots,['tn::4']);
  const second=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0,acceptedQuestions:first.data.questions});assert.equal(second.data.questions.length,4);assert.equal(second.data.missingSlots.length,0);
  assert.equal(env.calls.filter(p=>p._task==='generate')[1].requestedSlots.length,1);assert.deepEqual(second.data.questions.slice(0,3),first.data.questions);
});
test('truncated batch is reduced to one slot and leaves the other slots resumable',async()=>{
  let count=0;const env=makeEnv({generate:p=>{if(++count===1)throw Object.assign(new Error('cut'),{code:'AI_TRUNCATED'});return {examCodes:[{code:'A',questions:p.requestedSlots.map(slot=>question(slot,p.matrix[0]))}]};}});
  const out=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:payload(),chunkIndex:0});assert.equal(out.status,200,out.data.error);assert.equal(out.data.questions.length,1);assert.equal(out.data.missingSlots.length,3);assert.equal(env.calls.filter(x=>x._task==='generate')[1].requestedSlots.length,1);
});
test('quota during review retains pending questions and resumes review without regenerating',async()=>{
  let checks=0;const env=makeEnv({verify:p=>{if(++checks===1)throw Object.assign(new Error('429 quota'),{httpStatus:429,retryAfterMs:60000});return {results:p.questions.map(q=>({questionId:q.questionId,passed:true,correctAnswers:[q.answer],unambiguous:true,distractorPlausible:true,reason:'Đã kiểm tra đúng nhất và nhiễu có cơ sở.'}))};}}),p=payload();
  const first=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0});assert.equal(first.status,429);assert.equal(first.data.retryAfterMs,60000);assert.equal(first.data.pendingQuestions.length,4);
  const second=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0,pendingQuestions:first.data.pendingQuestions});assert.equal(second.status,200);assert.equal(second.data.questions.length,4);assert.equal(env.calls.filter(p=>p._task==='generate').length,1);
});
test('reviewer disagreement or weak distractor cannot pass finalization',async()=>{
  const env=makeEnv({verify:p=>({results:p.questions.map(q=>({questionId:q.questionId,passed:true,correctAnswers:['B'],unambiguous:true,distractorPlausible:false,reason:'Nhiễu chưa hợp lí và khóa đáp án không thống nhất.'}))})}),p=payload();
  const part=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0});assert.equal(part.data.questions.length,0);assert.equal(part.data.missingSlots.length,4);
  const final=await post(env,'finalize-generation',{payload:p,questions:part.data.questions});assert.notEqual(final.status,200);
});
test('duplicate questions across chunks are rejected instead of counted twice',async()=>{
  const env=makeEnv({generate:p=>({examCodes:[{code:'A',questions:p.requestedSlots.map(slot=>({...question(slot,p.matrix[0]),prompt:'Cùng một câu hỏi bị lặp'}))}]})}),p=payload();
  const part=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0,previousQuestions:[{lessonId:'lesson',prompt:'Cùng một câu hỏi bị lặp'}]});assert.equal(part.data.questions.length,0);assert.equal(part.data.missingSlots.length,4);
});
test('refinement rejects distractor equal to correct answer',()=>{
  const q={...question({questionId:'tn::1'},tn()),configId:'tn',lessonId:'lesson',level:'nb',form:'TNKQ',subtype:'single',points:.75};
  assert.throws(()=>W.basicQuestionValidation({...q,distractor:'A'},q),/Nhiễu/);
});
test('permutation preserves correct option, rationale and review fingerprint',async()=>{
  const env=makeEnv(),p=payload(),part=await post(env,'generate-chunk',{provider:'cloudflare',autoFallback:false,payload:p,chunkIndex:0});
  const final=await post(env,'finalize-generation',{payload:p,questions:part.data.questions});assert.equal(final.status,200);
  for(const code of final.data.examCodes)for(const q of code.questions){assert.equal(q.options[q.answer.charCodeAt(0)-65],'Sáng tạo trong lao động');assert.match(q.optionRationales[q.answer.charCodeAt(0)-65],/^Đúng/);assert.equal(q.verification.contentHash,R.contentHash(q));}
});
test('Gemini receives the same chunk pipeline and native schema (mocked HTTP, no real key)',async()=>{
  const old=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,options)=>{
    if(String(url).endsWith('/models'))return Response.json({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]});
    const body=JSON.parse(options.body),text=body.contents[0].parts[0].text,p=JSON.parse(text.slice(text.indexOf('{')));requests.push({body,p});
    const response=p._task==='verify'?{results:p.questions.map(q=>({questionId:q.questionId,passed:true,correctAnswers:[q.answer],unambiguous:true,distractorPlausible:true,reason:'Đáp án và nhiễu đã được kiểm tra độc lập.'}))}:{examCodes:[{code:'A',questions:p.requestedSlots.map(slot=>question(slot,p.matrix[0]))}]};
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(response)}]}}]});
  };
  try{const out=await post(makeEnv(),'generate-chunk',{provider:'gemini',apiKey:'AIza_MOCK_KEY_FOR_TESTS_ONLY_259',autoFallback:false,payload:payload(),chunkIndex:0});assert.equal(out.status,200,out.data.error);assert.equal(out.data.questions.length,4);assert.ok(requests[0].body.generationConfig.responseSchema);assert.equal(requests.length,2);}finally{globalThis.fetch=old;}
});
