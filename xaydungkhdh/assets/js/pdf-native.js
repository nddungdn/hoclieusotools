import { APP_CONFIG } from './config.js';
import { documentFingerprint } from './parsers.js';

const sourceCache=new WeakMap();

function pdfLib(){
  if(!window.PDFLib?.PDFDocument)throw new Error('Không tải được thư viện cắt PDF scan (pdf-lib). Hãy tải lại trang và kiểm tra kết nối CDN.');
  return window.PDFLib;
}

export function buildNativePdfChunks(documents){
  const chunks=[];
  for(const d of documents.filter(x=>x.kind==='TEXTBOOK'&&x.pdfMode==='SCANNED_PDF')){
    if(!d.pageCount)continue;
    const fingerprint=documentFingerprint([d]);
    for(let pageStart=1;pageStart<=d.pageCount;pageStart+=APP_CONFIG.nativePdfChunkMaxPages){
      const pageEnd=Math.min(d.pageCount,pageStart+APP_CONFIG.nativePdfChunkMaxPages-1);
      const pageCount=pageEnd-pageStart+1;
      chunks.push({
        id:`pdf-${fingerprint}-${pageStart}-${pageEnd}`,
        docId:d.id,
        docName:d.name,
        kind:d.kind,
        pipeline:'native_pdf',
        pageStart,
        pageEnd,
        pageCount,
        charCount:0,
        estimatedTokens:pageCount*APP_CONFIG.nativePdfEstimatedTokensPerPage,
        text:'',
        status:'pending',
        attempts:0,
        summary:null,
        warnings:[],
        lastError:'',
        usage:null
      });
    }
  }
  return chunks;
}

async function loadSource(file){
  if(!file)throw new Error('Không còn tệp PDF trong bộ nhớ. Hãy tải lại đúng SGK để tiếp tục checkpoint.');
  let pending=sourceCache.get(file);
  if(!pending){
    pending=(async()=>{
      const bytes=await file.arrayBuffer();
      return pdfLib().PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
    })();
    sourceCache.set(file,pending);
  }
  return pending;
}

export async function createPdfSliceBase64(document,chunk){
  if(!document?.file)throw new Error(`Cần tải lại tệp “${chunk.docName}” để tiếp tục đọc PDF scan.`);
  const source=await loadSource(document.file);
  const total=source.getPageCount();
  const start=Math.max(1,Number(chunk.pageStart)||1);
  const end=Math.min(total,Number(chunk.pageEnd)||start);
  if(start>end)throw new Error('Khoảng trang PDF không hợp lệ.');

  const out=await pdfLib().PDFDocument.create();
  const indexes=[];
  for(let page=start;page<=end;page++)indexes.push(page-1);
  const pages=await out.copyPages(source,indexes);
  pages.forEach(page=>out.addPage(page));
  out.setTitle(`${document.name} - trang ${start}-${end}`);
  out.setProducer('Xay dung KHDH Ngu van v1.2.3');
  const bytes=await out.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
  const base64=bytesToBase64(bytes);
  if(base64.length>APP_CONFIG.nativePdfChunkHardMaxBase64Chars){
    const err=new Error(`Cụm PDF trang ${start}-${end} có dung lượng ${formatMb(bytes.length)}, vượt giới hạn an toàn. Hệ thống sẽ tự chia nhỏ hơn.`);
    err.category='NATIVE_PDF_CHUNK_TOO_LARGE';
    err.byteLength=bytes.length;
    throw err;
  }
  return {base64,byteLength:bytes.length,pageCount:end-start+1};
}

function bytesToBase64(bytes){
  let binary='';
  const step=0x8000;
  for(let i=0;i<bytes.length;i+=step){
    binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+step,bytes.length)));
  }
  return btoa(binary);
}

function formatMb(bytes){return `${(Number(bytes||0)/1024/1024).toFixed(1)} MB`;}
