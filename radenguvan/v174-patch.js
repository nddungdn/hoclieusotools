(()=>{'use strict';
const VERSION='1.7.4';
const PREF_KEY='radenguvan_v174_vi_pref';
const LEVEL_ORDER={nb:0,th:1,vd:2};

function clone(v){return JSON.parse(JSON.stringify(v));}
function transformData(data){
  if(!data||typeof data!=='object')return data;
  try{
    if(data.meta)data.meta.version=VERSION;
    const read=data.grades?.['8']?.read;
    if(Array.isArray(read)){
      const idx=read.findIndex(x=>x?.id==='g8_story');
      if(idx>=0){
        const base=read[idx];
        const source='Bộ đặc tả lớp 8 + đề tham khảo lớp 8 (nguồn đặc tả gộp “truyện ngắn, truyện lịch sử”; tiện ích tách thành hai lựa chọn và giữ nguyên đặc tả nguồn)';
        const shortStory={...clone(base),id:'g8_short_story',label:'Truyện ngắn',source};
        const historicalStory={...clone(base),id:'g8_historical_story',label:'Truyện lịch sử',source};
        read.splice(idx,1,shortStory,historicalStory);
      }
    }
  }catch{}
  return data;
}

// data.js được tải sau config.js. Setter này tách Truyện ngắn/Truyện lịch sử ngay khi NV_DATA được gán.
let nvDataValue;
try{
  if(window.NV_DATA)nvDataValue=transformData(window.NV_DATA);
  Object.defineProperty(window,'NV_DATA',{
    configurable:true,
    enumerable:true,
    get(){return nvDataValue;},
    set(v){nvDataValue=transformData(v);}
  });
}catch{}

function getPref(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{return {};}}
function savePref(v){try{localStorage.setItem(PREF_KEY,JSON.stringify(v));}catch{}}
function modeFromCount(){const c=Number(document.querySelector('#viQuestionCount')?.value||0);return c===2?'pair_nb_th':c===1?'th_only':'none';}
function sortQuestions(list){return Array.isArray(list)?list.slice().sort((a,b)=>(LEVEL_ORDER[a?.level]??99)-(LEVEL_ORDER[b?.level]??99)):list;}

function selectedViValues(){return [...document.querySelectorAll('#viKnowledge input:checked')].map(x=>x.value).filter(Boolean);}
function refreshFocus(){
  const sel=document.querySelector('#viPracticeFocus');if(!sel)return;
  const prev=sel.value||getPref().focus||'';
  const values=selectedViValues();
  sel.innerHTML=values.length?values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''):'<option value="">Hãy chọn tri thức tiếng Việt phía trên</option>';
  if(values.includes(prev))sel.value=prev;
  else if(values.length)sel.value=values[0];
  persistUiPref();
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function persistUiPref(){const mode=document.querySelector('#viPracticeMode')?.value||modeFromCount(),focus=document.querySelector('#viPracticeFocus')?.value||'';savePref({mode,focus});}
function applyMode(mode,{setDefaultPoints=true}={}){
  const count=document.querySelector('#viQuestionCount'),pts=document.querySelector('#viTotalPoints');if(!count)return;
  if(mode==='pair_nb_th')count.value='2';
  else if(mode==='th_only')count.value='1';
  else count.value='0';
  if(pts&&setDefaultPoints){
    const current=Number(pts.value||0);
    if(mode==='none')pts.value='0';
    else if(current<=0)pts.value=mode==='pair_nb_th'?'1':'0.5';
  }
  count.dispatchEvent(new Event('input',{bubbles:true}));
  if(pts)pts.dispatchEvent(new Event('input',{bubbles:true}));
  persistUiPref();
}
function installVietnameseUi(){
  const count=document.querySelector('#viQuestionCount');if(!count||document.querySelector('#viPracticeMode'))return;
  const label=count.closest('label');
  const saved=getPref(),initial=saved.mode||modeFromCount();
  count.type='hidden';
  count.setAttribute('aria-hidden','true');
  if(label){
    const modeLabel=document.createElement('label');
    modeLabel.innerHTML=`Phương án Thực hành tiếng Việt<select id="viPracticeMode">
      <option value="none">Không bố trí câu riêng</option>
      <option value="pair_nb_th">2 câu: 1 Nhận biết + 1 Thông hiểu</option>
      <option value="th_only">1 câu ở mức Thông hiểu</option>
    </select>`;
    label.parentElement?.insertBefore(modeLabel,label);
    label.style.display='none';
    const focusLabel=document.createElement('label');
    focusLabel.innerHTML='Nội dung dùng cho câu Thực hành tiếng Việt<select id="viPracticeFocus"></select>';
    modeLabel.parentElement?.insertBefore(focusLabel,label);
  }
  const mode=document.querySelector('#viPracticeMode');if(mode){mode.value=initial;mode.addEventListener('change',()=>{applyMode(mode.value);refreshFocus();});}
  document.querySelector('#viPracticeFocus')?.addEventListener('change',persistUiPref);
  const knowledge=document.querySelector('#viKnowledge');
  if(knowledge){
    knowledge.addEventListener('change',()=>setTimeout(refreshFocus,0));
    new MutationObserver(()=>setTimeout(refreshFocus,0)).observe(knowledge,{childList:true,subtree:true});
  }
  // App khôi phục bản nháp bằng setTimeout; đồng bộ lại sau khi quá trình đó hoàn tất.
  setTimeout(()=>{
    const restoredMode=modeFromCount();
    if(mode)mode.value=restoredMode!=='none'?restoredMode:(saved.mode||'none');
    applyMode(mode?.value||'none',{setDefaultPoints:false});
    refreshFocus();
  },180);
  refreshFocus();
}

// Bổ sung mode/focus vào payload mà không phải sửa engine app.js V1.7.3.
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  let nextInit=init;
  try{
    const url=typeof input==='string'?input:(input?.url||'');
    if(init?.method?.toUpperCase()==='POST'&&/\/api\//.test(url)&&typeof init.body==='string'){
      const body=JSON.parse(init.body);
      if(body?.payload?.scope?.read){
        const mode=document.querySelector('#viPracticeMode')?.value||modeFromCount();
        const focus=document.querySelector('#viPracticeFocus')?.value||'';
        body.payload.scope.read.viPlan={...(body.payload.scope.read.viPlan||{}),mode,focus};
      }
      nextInit={...init,body:JSON.stringify(body)};
    }
  }catch{}
  const response=await nativeFetch(input,nextInit);
  try{
    const url=typeof input==='string'?input:(input?.url||'');
    if(response.ok&&(/\/api\/generate-read-pack$/.test(url)||/\/api\/validate-exam$/.test(url))){
      const data=await response.clone().json();
      if(Array.isArray(data?.questions))data.questions=sortQuestions(data.questions);
      if(Array.isArray(data?.examCodes))data.examCodes.forEach(c=>{c.readQuestions=sortQuestions(c.readQuestions);});
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:response.headers});
    }
  }catch{}
  return response;
};

document.addEventListener('DOMContentLoaded',installVietnameseUi,{once:true});
})();
