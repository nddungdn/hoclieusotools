import { APP_CONFIG } from './config.js';
import { buildTextbookChunks, documentFingerprint } from './parsers.js';
import { analyzeTextbookChunk, consolidateSummaryBatch, synthesizeCurriculumV12, addUsage, splitSummaryBatches, sleep } from './api.js';
import { saveLocal } from './storage.js';

function ensureJob(state){
  state.analysis=state.analysis||{};
  state.analysis.textbook=state.analysis.textbook||{chunks:[],usage:{}};
  const j=state.analysis.textbook;
  j.chunks=j.chunks||[];j.usage=j.usage||{requests:0,inputTokens:0,outputTokens:0,totalTokens:0,estimatedInputTokens:0};
  return j;
}

export function prepareTextbookJob(state){
  const docs=(state.documents||[]).filter(d=>d.kind==='TEXTBOOK');
  if(!docs.length){const loaded=(state.documents||[]).length;throw new Error(loaded?'Đã tải tài liệu nhưng chưa có tệp nào được đánh dấu SGK. Quay lại bước 3, chọn loại “SGK” cho Tập 1/Tập 2 rồi phân tích lại.':'Chưa có SGK để phân tích. Hãy tải SGK ở bước 3.');}
  const scanned=docs.filter(d=>d.scanned);
  if(scanned.length)throw new Error(`Không trích đủ lớp chữ từ: ${scanned.map(x=>x.name).join(', ')}. v1.2 hiện xử lý ổn định nhất với PDF có lớp chữ/DOCX; xem phần PDF scan trong hướng dẫn.`);
  const fresh=buildTextbookChunks(docs);
  if(!fresh.length)throw new Error('Không tạo được phần phân tích từ SGK.');
  const job=ensureJob(state);
  const old=new Map((job.chunks||[]).map(c=>[c.id,c]));
  const fp=documentFingerprint(docs);
  job.fingerprint=fp;
  job.chunks=fresh.map(c=>{
    const o=old.get(c.id);
    return o?.summary ? {...c,status:'completed',attempts:o.attempts||1,summary:o.summary,warnings:o.warnings||[],usage:o.usage||null,lastError:''} : c;
  });
  job.total=job.chunks.length;
  recalc(job);
  job.status=job.completed===job.total?'completed':'prepared';
  job.pauseRequested=false;job.lastError='';
  saveLocal(state);
  return job;
}

export function requestPause(state){
  const job=ensureJob(state);job.pauseRequested=true;
}

export function resetTextbookAnalysis(state){
  state.analysis.textbook={fingerprint:'',status:'idle',pauseRequested:false,chunks:[],compactedSummaries:[],total:0,completed:0,failed:0,currentChunkId:'',startedAt:'',finishedAt:'',usage:{requests:0,inputTokens:0,outputTokens:0,totalTokens:0,estimatedInputTokens:0},lastError:''};
  saveLocal(state);
}

export function markFailedForRetry(state){
  const job=ensureJob(state);
  for(const c of job.chunks||[])if(c.status==='failed'){c.status='pending';c.lastError='';}
  recalc(job);job.status='prepared';saveLocal(state);
}

export async function runTextbookAnalysis(state,{onProgress,onRetry,onStatus}={}){
  let job=ensureJob(state);
  if(!(job.chunks||[]).some(c=>c.text))job=prepareTextbookJob(state);
  job.pauseRequested=false;job.status='running';job.startedAt=job.startedAt||new Date().toISOString();job.lastError='';
  onStatus?.('running');

  for(let idx=0;idx<job.chunks.length;idx++){
    const chunk=job.chunks[idx];
    if(chunk.status==='completed')continue;
    if(job.pauseRequested){job.status='paused';break;}
    if(!chunk.text){throw new Error('Checkpoint đã được khôi phục nhưng chưa có nội dung SGK trong bộ nhớ. Hãy tải lại đúng SGK; hệ thống sẽ nối lại các phần đã hoàn thành.');}

    chunk.status='running';chunk.attempts=(chunk.attempts||0)+1;job.currentChunkId=chunk.id;recalc(job);onProgress?.(job,chunk);
    try{
      const {result,meta}=await analyzeTextbookChunk(state,chunk,{onRetry:info=>onRetry?.(info,chunk)});
      chunk.summary=result;chunk.warnings=result?.warnings||[];chunk.status='completed';chunk.lastError='';chunk.usage=meta?.usage||null;
      addUsage(job.usage,meta,chunk.estimatedTokens||0);
      recalc(job);saveLocal(state);onProgress?.(job,chunk);
      if(APP_CONFIG.interRequestDelayMs)await sleep(APP_CONFIG.interRequestDelayMs);
    }catch(err){
      if(isSizeError(err)&&chunk.charCount>9000){
        const parts=splitChunk(chunk);
        job.chunks.splice(idx,1,...parts);idx--;
        job.lastError='Đã tự chia nhỏ một phần vì provider báo vượt giới hạn ngữ cảnh/request.';
        recalc(job);saveLocal(state);onProgress?.(job,parts[0]);
        continue;
      }
      chunk.status='failed';chunk.lastError=err?.message||String(err);job.lastError=chunk.lastError;recalc(job);saveLocal(state);onProgress?.(job,chunk);
      // Các lỗi xác thực/model/quota nên dừng để tránh tiêu tốn thêm lượt gọi.
      job.status='partial';
      onStatus?.('partial',err);
      throw err;
    }
  }

  recalc(job);job.currentChunkId='';
  if(job.pauseRequested)job.status='paused';
  else if(job.completed===job.total){job.status='completed';job.finishedAt=new Date().toISOString();}
  else if(job.failed)job.status='partial';
  else job.status='prepared';
  saveLocal(state);onStatus?.(job.status);return job;
}

export async function buildCurriculumFromAnalysis(state,{onProgress,onRetry}={}){
  const job=ensureJob(state);
  const completed=(job.chunks||[]).filter(c=>c.status==='completed'&&c.summary);
  if(!completed.length)throw new Error('Chưa có phần SGK nào được phân tích thành công.');
  const summaries=completed.map(c=>({source:{docName:c.docName,pageStart:c.pageStart,pageEnd:c.pageEnd},...c.summary}));
  const batches=splitSummaryBatches(summaries);
  let compact=[];
  if(batches.length===1){compact=summaries;}
  else{
    for(let i=0;i<batches.length;i++){
      onProgress?.(`Đang hợp nhất dữ liệu SGK ${i+1}/${batches.length}...`);
      const {result,meta}=await consolidateSummaryBatch(state,batches[i],i+1,batches.length,{onRetry});
      addUsage(job.usage,meta,Math.ceil(JSON.stringify(batches[i]).length/APP_CONFIG.estimatedCharsPerToken));
      compact.push(result);saveLocal(state);
      if(APP_CONFIG.interRequestDelayMs)await sleep(APP_CONFIG.interRequestDelayMs);
    }
  }
  job.compactedSummaries=compact;
  onProgress?.('Đang tạo PPCT từ dữ liệu SGK đã rút gọn...');
  const {result,meta}=await synthesizeCurriculumV12(state,compact,{onRetry});
  addUsage(job.usage,meta,Math.ceil(JSON.stringify(compact).length/APP_CONFIG.estimatedCharsPerToken));
  saveLocal(state);return result;
}

function isSizeError(err){
  const m=String(err?.message||'').toLowerCase();
  return err?.category==='PAYLOAD_TOO_LARGE' || (err?.category==='BAD_REQUEST' && /(context|token|too long|too large|maximum|limit|length)/i.test(m));
}

function splitChunk(chunk){
  const text=String(chunk.text||'');
  let cut=Math.floor(text.length/2);
  const next=text.indexOf('[TRANG ',cut);
  const prev=text.lastIndexOf('[TRANG ',cut);
  if(next>0&&next-cut<6000)cut=next;else if(prev>0&&cut-prev<6000)cut=prev;
  if(cut<3000||text.length-cut<3000)cut=Math.floor(text.length/2);
  const a=text.slice(0,cut),b=text.slice(cut);
  const pagesA=[...a.matchAll(/\[TRANG\s+(\d+)\]/g)].map(m=>Number(m[1]));
  const pagesB=[...b.matchAll(/\[TRANG\s+(\d+)\]/g)].map(m=>Number(m[1]));
  const make=(part,suffix,pages)=>({
    ...chunk,id:`${chunk.id}-${suffix}`,text:part,charCount:part.length,estimatedTokens:Math.ceil(part.length/APP_CONFIG.estimatedCharsPerToken),
    pageStart:pages.length?pages[0]:chunk.pageStart,pageEnd:pages.length?pages.at(-1):chunk.pageEnd,status:'pending',attempts:0,summary:null,warnings:[],lastError:'',usage:null
  });
  return [make(a,'a',pagesA),make(b,'b',pagesB)];
}

function recalc(job){
  job.total=(job.chunks||[]).length;
  job.completed=(job.chunks||[]).filter(c=>c.status==='completed').length;
  job.failed=(job.chunks||[]).filter(c=>c.status==='failed').length;
}
