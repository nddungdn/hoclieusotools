import { APP_CONFIG } from './config.js';

export async function parseUploadedFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return parsePdf(file);
  if (ext === 'docx') return parseDocx(file);
  if (['txt','md','json','csv'].includes(ext)) {
    const text = (await file.text()).slice(0, APP_CONFIG.maxExtractedCharsPerFile);
    return { text, pages:null, kind: classifyDocument(file.name, text), scanned:false, charCount:text.length };
  }
  throw new Error(`Chưa hỗ trợ định dạng .${ext}. Ưu tiên PDF, DOCX, TXT.`);
}

async function parsePdf(file) {
  if (!window.pdfjsLib) throw new Error('Không tải được thư viện đọc PDF.');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages=[];
  let totalChars=0;
  const maxPages=Math.min(pdf.numPages,APP_CONFIG.maxPdfPages);
  for(let i=1;i<=maxPages;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    const line=content.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();
    pages.push({page:i,text:line});
    totalChars+=line.length;
    if(totalChars>=APP_CONFIG.maxExtractedCharsPerFile) break;
  }
  const text=pages.map(p=>`[TRANG ${p.page}]\n${p.text}`).join('\n');
  const nonSpace=text.replace(/\s/g,'').length;
  const scanned=nonSpace < Math.min(1600, Math.max(500,pdf.numPages*45));
  return {
    text,
    pages,
    kind:classifyDocument(file.name,text),
    scanned,
    pageCount:pdf.numPages,
    extractedPages:pages.length,
    charCount:text.length
  };
}

async function parseDocx(file) {
  if (!window.mammoth) throw new Error('Không tải được thư viện đọc DOCX.');
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  const text = (result.value || '').slice(0, APP_CONFIG.maxExtractedCharsPerFile);
  return { text, pages:null, kind: classifyDocument(file.name, text), scanned:false, charCount:text.length };
}

export function classifyDocument(name, text='') {
  const s = `${name}\n${text.slice(0,16000)}`.toLowerCase();
  if (s.includes('phụ lục i') || s.includes('phu luc 1') || s.includes('kế hoạch dạy học của tổ chuyên môn')) return 'PL1';
  if (s.includes('phụ lục ii') || s.includes('phu luc 2') || s.includes('kế hoạch tổ chức các hoạt động giáo dục')) return 'PL2';
  if (s.includes('phụ lục iii') || s.includes('phu luc 3') || s.includes('kế hoạch giáo dục của giáo viên')) return 'PL3';
  if (s.includes('sách giáo khoa') || s.includes('mục lục') || (s.includes('ngữ văn') && /(tập 1|tập 2|bài 1|bài 2)/.test(s))) return 'TEXTBOOK';
  if (s.includes('sách giáo viên') || s.includes('hướng dẫn dạy học')) return 'TEACHER_BOOK';
  if (s.includes('năng lực số') || s.includes('3456/bgddt') || s.includes('02/2025/tt-bgddt')) return 'NLS';
  if (s.includes('quốc phòng') || s.includes('an ninh')) return 'QPAN';
  if (s.includes('phân phối chương trình') || s.includes('ppct')) return 'PPCT';
  return 'OTHER';
}

function fnv1a(str){
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return (h>>>0).toString(16).padStart(8,'0');
}

function makeChunkId(docKey,pageStart,pageEnd,text){
  const sample=`${docKey}|${pageStart}|${pageEnd}|${text.slice(0,800)}|${text.slice(-800)}`;
  return `${fnv1a(sample)}-${pageStart}-${pageEnd}`;
}

export function documentFingerprint(documents){
  const key=documents.map(d=>`${d.name}|${d.size}|${d.lastModified||0}|${d.pageCount||0}|${d.charCount||0}`).sort().join('||');
  return fnv1a(key);
}

export function buildTextbookChunks(documents){
  return buildChunks(documents.filter(d=>d.kind==='TEXTBOOK'),{
    targetChars:APP_CONFIG.textbookChunkTargetChars,
    hardMaxChars:APP_CONFIG.textbookChunkHardMaxChars,
    maxPages:APP_CONFIG.textbookChunkMaxPages,
    overlapPages:APP_CONFIG.textbookChunkOverlapPages
  });
}

export function buildGenericChunks(documents,kinds=null){
  const list=kinds?documents.filter(d=>kinds.includes(d.kind)):documents;
  return buildChunks(list,{
    targetChars:APP_CONFIG.genericChunkTargetChars,
    hardMaxChars:APP_CONFIG.genericChunkHardMaxChars,
    maxPages:APP_CONFIG.textbookChunkMaxPages,
    overlapPages:0
  });
}

function buildChunks(documents,opts){
  const chunks=[];
  for(const d of documents){
    const docKey=`${d.name}|${d.size}|${d.lastModified||0}`;
    if(Array.isArray(d.pages)&&d.pages.length){
      let start=0;
      while(start<d.pages.length){
        let end=start, chars=0, parts=[];
        while(end<d.pages.length && (end-start)<opts.maxPages){
          const p=d.pages[end];
          const addition=`[TRANG ${p.page}]\n${p.text}\n`;
          if(parts.length && chars+addition.length>opts.hardMaxChars) break;
          parts.push(addition); chars+=addition.length; end++;
          if(chars>=opts.targetChars) break;
        }
        if(end===start){end=start+1;parts=[`[TRANG ${d.pages[start].page}]\n${d.pages[start].text}\n`];}
        const selected=d.pages.slice(start,end);
        const text=parts.join('');
        const pageStart=selected[0]?.page||start+1;
        const pageEnd=selected.at(-1)?.page||end;
        chunks.push({
          id:makeChunkId(docKey,pageStart,pageEnd,text),docName:d.name,kind:d.kind,
          pageStart,pageEnd,charCount:text.length,estimatedTokens:estimateTokens(text),text,
          status:'pending',attempts:0,summary:null,warnings:[],lastError:'',usage:null
        });
        if(end>=d.pages.length) break;
        start=Math.max(end-(opts.overlapPages||0),start+1);
      }
    }else{
      const text=d.parsedText||'';
      let pos=0,part=1;
      while(pos<text.length){
        let end=Math.min(text.length,pos+opts.targetChars);
        if(end<text.length){
          const nl=text.lastIndexOf('\n',end);
          if(nl>pos+opts.targetChars*0.6) end=nl;
        }
        if(end-pos>opts.hardMaxChars) end=pos+opts.hardMaxChars;
        const chunkText=text.slice(pos,end);
        chunks.push({
          id:makeChunkId(docKey,part,part,chunkText),docName:d.name,kind:d.kind,
          pageStart:null,pageEnd:null,part,charCount:chunkText.length,estimatedTokens:estimateTokens(chunkText),text:chunkText,
          status:'pending',attempts:0,summary:null,warnings:[],lastError:'',usage:null
        });
        pos=end;part++;
      }
    }
  }
  return chunks;
}

export function estimateTokens(text){
  return Math.ceil(String(text||'').length/APP_CONFIG.estimatedCharsPerToken);
}

export function combinedText(documents, kinds=null, max=APP_CONFIG.maxCombinedTextForSmallJobs) {
  let out = '';
  for (const d of documents) {
    if (kinds && !kinds.includes(d.kind)) continue;
    if (!d.parsedText) continue;
    out += `\n\n===== ${d.name} | ${d.kind} =====\n${d.parsedText}`;
    if (out.length >= max) break;
  }
  return out.slice(0,max);
}
