(()=>{'use strict';
const VERSION='1.7.5';
const LEVEL_ORDER={nb:0,th:1,vd:2};
const previousFetch=window.fetch.bind(window);
const text=v=>String(v??'').trim();
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const quarter=v=>Math.round(num(v)*4)/4;
const fmt=v=>{const x=quarter(v);return Number.isInteger(x)?String(x):String(x).replace('.',',')};

function modeFromPlan(plan){
  if(['pair_nb_th','th_only','none'].includes(plan?.mode))return plan.mode;
  const c=Math.max(0,Math.round(num(plan?.count)));
  return c===2?'pair_nb_th':c===1?'th_only':'none';
}
function slotsFromPayload(payload){
  const configs=(payload?.matrix||[]).filter(x=>x.ability==='Đọc').map((x,i)=>({...x,__i:i})).sort((a,b)=>(LEVEL_ORDER[a.level]??99)-(LEVEL_ORDER[b.level]??99)||a.__i-b.__i);
  const slots=[];
  for(const cfg of configs)for(let i=0;i<Math.max(0,Math.round(num(cfg.count)));i++)slots.push({level:cfg.level,points:quarter(cfg.pointsPerQuestion)});
  return slots;
}
function feasibleTotals(payload){
  const plan=payload?.scope?.read?.viPlan||{},mode=modeFromPlan(plan),slots=slotsFromPayload(payload);
  if(mode==='none')return {mode,totals:[]};
  const nb=slots.filter(s=>s.level==='nb'),th=slots.filter(s=>s.level==='th');
  const vals=mode==='pair_nb_th'?nb.flatMap(a=>th.map(b=>a.points+b.points)):th.map(x=>x.points);
  return {mode,totals:[...new Set(vals.map(quarter).filter(x=>x>0))].sort((a,b)=>a-b)};
}
function matrixError(payload){
  const plan=payload?.scope?.read?.viPlan||{},mode=modeFromPlan(plan);
  if(mode==='none')return null;
  const selected=quarter(plan.totalPoints),{totals}=feasibleTotals(payload);
  if(totals.some(x=>Math.abs(x-selected)<.001))return null;
  const label=mode==='pair_nb_th'?'1 câu Nhận biết + 1 câu Thông hiểu':'1 câu Thông hiểu';
  return `Thiết lập điểm Thực hành tiếng Việt chưa khớp ma trận; chưa gọi AI. Phương án ${label} không thể có tổng ${fmt(selected)} điểm từ điểm/câu hiện tại.${totals.length?` Có thể chọn: ${totals.map(fmt).join('; ')} điểm.`:' Ma trận chưa có đủ câu ở mức nhận thức cần thiết.'}`;
}
function addRules(body){
  if(body?.payload?.scope?.read){
    body.payload.scope.read.generationRules={
      readingStem:'Không dùng “Viết ngắn”, “Viết đoạn”, “Trình bày bằng đoạn văn” trong phần Đọc. Câu Nhận biết ưu tiên Xác định/Nêu/Chỉ ra.',
      vietnameseScope:'Câu Thực hành tiếng Việt phải chép nguyên văn 1 câu hoặc đoạn 2–3 câu từ ngữ liệu ngay trong câu hỏi rồi mới yêu cầu xác định/giải thích.',
      descriptor:'Mỗi câu chỉ kiểm tra đúng descriptorText đã khóa.'
    };
  }
  return body;
}
function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  let nextInit=init,body=null;
  try{
    if(init?.method?.toUpperCase()==='POST'&&/\/api\//.test(url)&&typeof init.body==='string'){
      body=addRules(JSON.parse(init.body));
      if(/\/api\/(generate-read-pack|validate-exam)$/.test(url)){
        const err=matrixError(body?.payload);
        if(err)return jsonResponse({code:'VI_MATRIX_INCOMPATIBLE',error:err},400);
      }
      nextInit={...init,body:JSON.stringify(body)};
    }
  }catch{}
  const response=await previousFetch(input,nextInit);
  try{
    if(response.ok&&/\/api\/test-provider$/.test(url)){
      const data=await response.clone().json();
      if(Array.isArray(data?.routes)&&data.routes.length&&Array.isArray(data?.health)){
        data.health=data.health.map(x=>{
          if(x?.provider==='gemini'&&!x.ok&&/geo_block|vùng|tuyến mạng|location|region/i.test(String(x.message||''))){
            return {...x,skipped:true,message:'Bị chặn theo vùng/tuyến mạng; đã bỏ qua. Không ảnh hưởng chế độ Tự động vì còn tuyến Cloudflare.'};
          }
          return x;
        });
      }
      return jsonResponse(data,response.status);
    }
  }catch{}
  return response;
};

function installNotes(){
  if(window.APP_CONFIG)window.APP_CONFIG.APP_VERSION=VERSION;
  const badge=document.querySelector('#versionBadge');if(badge)badge.textContent='V'+VERSION;
  const box=document.querySelector('.vi-practice-box');
  if(box&&!document.querySelector('#v175ViRule')){
    const p=document.createElement('div');p.id='v175ViRule';p.className='tiny';p.style.marginTop='8px';p.innerHTML='<b>Quy tắc:</b> 2 câu = 1 Nhận biết + 1 Thông hiểu và cùng một nội dung tiếng Việt; 1 câu = Thông hiểu. Điểm từng câu phải khớp điểm/câu tương ứng trong ma trận. Câu tiếng Việt phải khoanh vùng 1 câu hoặc đoạn 2–3 câu của ngữ liệu.';
    box.appendChild(p);
  }
  const summary=document.querySelector('#generateSummary')?.parentElement;
  if(summary&&!document.querySelector('#v175ReadRule')){
    const p=document.createElement('p');p.id='v175ReadRule';p.className='tiny';p.innerHTML='<b>V1.7.5:</b> câu Đọc bám từng dòng đặc tả; câu Nhận biết ưu tiên “Xác định/Nêu/Chỉ ra”; không dùng nhiệm vụ “Viết ngắn/Viết đoạn” trong phần Đọc.';
    summary.appendChild(p);
  }
}

document.addEventListener('DOMContentLoaded',()=>setTimeout(installNotes,0),{once:true});
})();
