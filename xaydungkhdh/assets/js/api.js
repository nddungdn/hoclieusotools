import { APP_CONFIG } from './config.js';

function apiUrl(path){
  const base=String(APP_CONFIG.apiBase||'').replace(/\/$/,'');
  if(!base || /YOUR_|PASTE_/i.test(base)) throw new Error('Chưa cấu hình URL Cloudflare Worker trong assets/js/config.js.');
  return `${base}${path}`;
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function post(path, body){
  let res;
  try{
    res=await fetch(apiUrl(path),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  }catch(e){
    const err=new Error('Không kết nối được Cloudflare Worker. Kiểm tra URL Worker, CORS và trạng thái triển khai.');
    err.category='NETWORK'; throw err;
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    const prefix=data.provider?`${data.provider}: `:'';
    const suffix=data.requestId?` (Request ID: ${data.requestId})`:'';
    const err=new Error(prefix+(data.error||`Lỗi API (${res.status}).`)+suffix);
    err.category=data.category; err.status=res.status; err.providerStatus=data.providerStatus; err.requestId=data.requestId;
    err.retryAfterMs=Number(data.retryAfterMs)||0;
    throw err;
  }
  return data;
}

function shouldRetry(err){
  return err?.category==='NETWORK' || err?.status===408 || err?.status===429 || Number(err?.status)>=500;
}

async function postWithRetry(path,body,onRetry){
  let lastErr;
  for(let attempt=0;attempt<=APP_CONFIG.maxRetries;attempt++){
    try{return await post(path,body);}catch(err){
      lastErr=err;
      if(attempt>=APP_CONFIG.maxRetries || !shouldRetry(err)) throw err;
      const wait=err.retryAfterMs || APP_CONFIG.retryBaseMs*Math.pow(2,attempt);
      onRetry?.({attempt:attempt+1,wait,error:err});
      await sleep(wait);
    }
  }
  throw lastErr;
}

export async function loadProviderModels(state){
  if(!state.ai.provider) throw new Error('Chưa chọn nhà cung cấp AI.');
  if(!state.ai.apiKey) throw new Error('Chưa nhập API Key.');
  const data=await post('/models',{provider:state.ai.provider,apiKey:state.ai.apiKey});
  return data.result;
}

export async function testAI(state){
  if(!state.ai.provider) throw new Error('Chưa chọn nhà cung cấp AI.');
  if(!state.ai.apiKey) throw new Error('Chưa nhập API Key.');
  if(!state.ai.model) throw new Error('Chưa chọn model.');
  const data=await post('/test',{provider:state.ai.provider,apiKey:state.ai.apiKey,model:state.ai.model});
  return {result:data.result,meta:data.meta||{}};
}

function sanitizeProjectForAI(state) {
  return {
    academicYear: state.project.academicYear,
    grade: Number(state.project.grade),
    subject: state.project.subject,
    totalPeriods: Number(state.project.totalPeriods || 140),
    semester1Periods: Number(state.project.semester1Periods || 72),
    semester2Periods: Number(state.project.semester2Periods || 68),
    deviceMode: state.project.deviceMode,
    integrateNls: !!state.options.integrateNls,
    integrateQpan: !!state.options.integrateQpan
  };
}

export async function callAI(state,task,payload,{onRetry}={}){
  if(!state.ai.provider) throw new Error('Chưa chọn nhà cung cấp AI.');
  if(!state.ai.apiKey) throw new Error('Chưa nhập API Key.');
  if(!state.ai.model) throw new Error('Chưa chọn model API.');
  const raw=JSON.stringify(payload||{});
  if(raw.length>APP_CONFIG.requestHardMaxChars) throw new Error(`Dữ liệu một request quá lớn (${Math.round(raw.length/1000)} nghìn ký tự). v1.2.3 yêu cầu chia nhỏ trước khi gửi.`);
  const data=await postWithRetry('/ai',{
    provider:state.ai.provider,apiKey:state.ai.apiKey,model:state.ai.model,task,payload
  },onRetry);
  return {result:data.result,meta:data.meta||{}};
}

export async function analyzeTextbookChunk(state,chunk,{onRetry}={}){
  return callAI(state,'extract_textbook_chunk_v12',{
    project:sanitizeProjectForAI(state),
    chunk:{docName:chunk.docName,pageStart:chunk.pageStart,pageEnd:chunk.pageEnd,part:chunk.part||null,charCount:chunk.charCount},
    text:chunk.text
  },{onRetry});
}

export async function analyzeNativeTextbookPdf(state,chunk,pdfSlice,{onRetry}={}){
  if(!state.ai.provider) throw new Error('Chưa chọn nhà cung cấp AI.');
  if(!state.ai.apiKey) throw new Error('Chưa nhập API Key.');
  if(!state.ai.model) throw new Error('Chưa chọn model API.');
  if(!pdfSlice?.base64) throw new Error('Không tạo được dữ liệu PDF cho phần đang xử lý.');
  if(pdfSlice.base64.length>APP_CONFIG.nativePdfChunkHardMaxBase64Chars){
    const err=new Error('Cụm PDF scan vượt giới hạn an toàn của tiện ích.');
    err.category='NATIVE_PDF_CHUNK_TOO_LARGE';
    throw err;
  }
  const data=await postWithRetry('/ai-pdf',{
    provider:state.ai.provider,
    apiKey:state.ai.apiKey,
    model:state.ai.model,
    task:'extract_textbook_pdf_chunk_v122',
    payload:{
      project:sanitizeProjectForAI(state),
      chunk:{docName:chunk.docName,pageStart:chunk.pageStart,pageEnd:chunk.pageEnd,pageCount:chunk.pageCount},
      document:{filename:`${safeFilename(chunk.docName)}-trang-${chunk.pageStart}-${chunk.pageEnd}.pdf`,mimeType:'application/pdf',dataBase64:pdfSlice.base64}
    }
  },onRetry);
  return {result:data.result,meta:data.meta||{}};
}

export function modelSupportsNativePdf(state){
  return state.ai?.modelInfo?.capabilities?.pdfNative!==false;
}

function safeFilename(name){
  return String(name||'sgk').replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,90)||'sgk';
}

export async function consolidateSummaryBatch(state,summaries,batchIndex,totalBatches,{onRetry}={}){
  return callAI(state,'consolidate_textbook_summaries_v12',{
    project:sanitizeProjectForAI(state),batchIndex,totalBatches,summaries
  },{onRetry});
}

export async function synthesizeCurriculumV12(state,summaries,{onRetry}={}){
  return callAI(state,'synthesize_ppct_v12',{
    project:sanitizeProjectForAI(state),summaries
  },{onRetry});
}

export async function integrateExistingAppendices(state, sourceText,{onRetry}={}) {
  return callAI(state,'integrate_existing',{project:sanitizeProjectForAI(state),options:state.options,sourceText},{onRetry});
}
export async function reviewExistingDocuments(state, sourceText,{onRetry}={}) {
  return callAI(state,'review_existing',{project:sanitizeProjectForAI(state),options:state.options,sourceText},{onRetry});
}

export function addUsage(target,meta,estimatedInputTokens=0){
  if(!target)return;
  target.requests=(target.requests||0)+1;
  const u=meta?.usage||{};
  const input=Number(u.inputTokens||u.input_tokens||u.promptTokenCount||0);
  const output=Number(u.outputTokens||u.output_tokens||u.candidatesTokenCount||0);
  const total=Number(u.totalTokens||u.total_tokens||u.totalTokenCount||input+output||0);
  target.inputTokens=(target.inputTokens||0)+input;
  target.outputTokens=(target.outputTokens||0)+output;
  target.totalTokens=(target.totalTokens||0)+total;
  if(!input && estimatedInputTokens) target.estimatedInputTokens=(target.estimatedInputTokens||0)+estimatedInputTokens;
}

export function splitSummaryBatches(summaries){
  const batches=[];let current=[],chars=0;
  for(const s of summaries){
    const n=JSON.stringify(s).length;
    if(current.length && chars+n>APP_CONFIG.summaryBatchMaxChars){batches.push(current);current=[];chars=0;}
    current.push(s);chars+=n;
  }
  if(current.length)batches.push(current);
  return batches;
}

export { sleep };
