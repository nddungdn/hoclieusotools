(function(){
'use strict';
const scriptElement=document.currentScript;
const host=scriptElement && scriptElement.previousElementSibling;
if(!host || !host.classList.contains('hls-story-widget') || host.shadowRoot)return;
host.setAttribute('lang','vi');
const PLAYLIST_URL=host.getAttribute('data-playlist-url')||'';
function mountStoryPlayer(host,tracks){
 const shadow=host.attachShadow({mode:'open'});
 const icon=(name)=>{const paths={headphones:'<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/>',play:'<path d="m8 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',prev:'<path d="M5 5v14m14-14L8 12l11 7Z"/>',next:'<path d="M19 5v14M5 5l11 7-11 7Z"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>'};return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>'};
 shadow.innerHTML=`<style>
 :host{display:block;width:100%;max-width:100%;min-width:0;color-scheme:light}*{box-sizing:border-box}.widget{font:15px/1.45 Arial,sans-serif;color:#252329;background:#fff;border:1px solid #eae5ef;border-radius:16px;overflow:hidden;width:100%;text-align:left}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:default;opacity:.42}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #9163f7;outline-offset:2px}svg{width:20px;height:20px;display:block;flex:none}.head{padding:17px 16px;background:linear-gradient(120deg,#7c3aed,#5141e6);color:#fff;display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700}.head svg{color:#f0e5ff;width:22px;height:22px}.head span,.eyebrow{text-transform:uppercase}.now{padding:18px 16px 12px;background:linear-gradient(140deg,#f7f1fc,#fcfaff)}.eyebrow{font-size:11px;letter-spacing:1px;color:#7b688f;font-weight:700}.title{font-size:20px;font-weight:700;line-height:1.35;margin:7px 0 3px;overflow-wrap:anywhere}.author{color:#756e7d;font-size:13px;min-height:19px}.progress{width:100%;height:18px;margin:14px 0 0;accent-color:#6240ed;cursor:pointer;display:block}.times{display:flex;justify-content:space-between;font-size:12px;font-variant-numeric:tabular-nums;color:#756e7d}.controls{display:grid;grid-template-columns:32px minmax(0,104px) 64px 32px;justify-content:center;gap:6px;align-items:center;margin:14px 0 10px}.controls .btn{min-width:0;padding:8px 6px;white-space:nowrap;font-size:13px}.controls .btn svg{width:18px;height:18px}.btn{border:0;border-radius:10px;min-height:44px;padding:8px;background:transparent;color:#6542db;display:flex;align-items:center;justify-content:center;gap:6px}.btn:hover:not(:disabled){background:#ece3fa}.btn.play{background:#5035f4;color:white;font-weight:700}.btn.play:hover:not(:disabled){background:#4225d8}.options{display:block;width:100%}.stop{font-size:13px;background:#efe5f7}.speed{display:grid;grid-template-columns:auto minmax(0,1fr) 44px;align-items:center;gap:9px;width:100%;min-height:44px;padding:4px 10px;border:1px solid #e7ddef;border-radius:10px;background:#f2eafb;font-size:12px;color:#625571}.speed input{display:block;width:100%;min-width:0;height:32px;margin:0;accent-color:#6240ed;cursor:pointer}.speed output{text-align:center;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:#623bd6;background:#fff;border-radius:6px;padding:3px 2px}.message{font-size:12px;color:#756e7d;margin-top:7px;min-height:18px}.message.error{color:#a82c28}.retry{font:13px Arial,sans-serif;color:#623bd6;background:#efe5f7;border:1px solid #dfd1ec;border-radius:7px;padding:8px 12px;margin-top:8px;cursor:pointer;min-height:36px}.retry[hidden]{display:none}.list-head{padding:15px 14px 9px;display:flex;justify-content:space-between;align-items:center;gap:5px;font-size:13px;font-weight:700}.count{font-weight:400;color:#81768b}.search{margin:0 14px 10px;display:flex;align-items:center;gap:6px;border:1px solid #e7ddef;border-radius:8px;padding:0 9px;background:#fcfaff}.search svg{width:16px;color:#92859f}.search input{width:100%;min-width:0;border:0;background:transparent;padding:9px 0;color:#40364c;font-size:14px;outline-offset:0}.list{height:238px;overflow-y:scroll;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#ae90ec #f4eefb;scrollbar-gutter:stable;padding:0 6px 4px 8px}.list::-webkit-scrollbar{width:7px}.list::-webkit-scrollbar-track{background:#f4eefb}.list::-webkit-scrollbar-thumb{background:#ae90ec;border-radius:8px}.track{display:flex;align-items:center;width:100%;gap:10px;border:0;border-bottom:1px solid #f0eaf5;border-radius:7px;padding:11px 8px;text-align:left;background:#fff;color:#302837;min-height:62px}.track:hover{background:#f8f3fc}.track[aria-pressed=true]{background:#f0e8ff;box-shadow:inset 3px 0 #7248ec}.number{font-size:12px;color:#9886ad;width:22px;flex:none;text-align:center}.track[aria-pressed=true] .number{color:#623bd6;font-weight:700}.info{min-width:0;flex:1}.track-title{display:block;font-size:14px;font-weight:700;overflow-wrap:anywhere}.track-sub{display:block;color:#81748c;font-size:12px;margin-top:3px}.empty{padding:15px 8px;color:#81748c;font-size:13px}.foot{padding:10px 14px 12px;border-top:1px solid #eee6f5;color:#796789;font-size:12px;display:flex;align-items:center;gap:7px}.foot input{accent-color:#6540e6;width:16px;height:16px;margin:0}audio{display:none}@media(max-width:260px){.now{padding:14px 10px}.controls{gap:3px}.controls .btn{font-size:12px;padding:8px 4px;gap:4px}.title{font-size:18px}}
 </style><section class="widget" aria-label="G\u00f3c nghe truy\u1ec7n"><div class="head">${icon('headphones')}<span>G\u00f3c nghe truy\u1ec7n</span></div><div class="now"><div class="eyebrow">Truy\u1ec7n \u0111\u01b0\u1ee3c ch\u1ecdn</div><div class="title" aria-live="polite"></div><div class="author"></div><input class="progress" type="range" min="0" max="1000" value="0" disabled aria-label="Tua truy\u1ec7n"><div class="times"><span class="elapsed">00:00</span><span class="duration">--:--</span></div><div class="controls"><button class="btn previous" type="button" aria-label="Truy\u1ec7n tr\u01b0\u1edbc" title="Truy\u1ec7n tr\u01b0\u1edbc">${icon('prev')}</button><button class="btn play" type="button">${icon('play')}<span>Ph\u00e1t</span></button><button class="btn stop" type="button">${icon('stop')}<span>D\u1eebng</span></button><button class="btn next" type="button" aria-label="Truy\u1ec7n ti\u1ebfp theo" title="Truy\u1ec7n ti\u1ebfp theo">${icon('next')}</button></div><div class="options"><label class="speed"><span>T\u1ed1c \u0111\u1ed9</span><input type="range" min="0.75" max="2" step="0.25" value="1" aria-label="T\u1ed1c \u0111\u1ed9 \u0111\u1ecdc" aria-valuetext="1x"><output aria-label="T\u1ed1c \u0111\u1ed9 hi\u1ec7n t\u1ea1i">1x</output></label></div><div class="message" role="status" aria-live="polite"></div><button class="retry" type="button" hidden>Th\u1eed l\u1ea1i</button></div><div class="list-head"><span>Danh s\u00e1ch truy\u1ec7n</span><span class="count"></span></div><label class="search">${icon('search')}<input type="search" placeholder="T\u00ecm t\u00ean truy\u1ec7n, t\u00e1c gi\u1ea3\u2026" aria-label="T\u00ecm truy\u1ec7n"></label><div class="list" role="group" aria-label="Danh s\u00e1ch truy\u1ec7n c\u00f3 thanh cu\u1ed9n"></div><label class="foot"><input type="checkbox" class="auto"> T\u1ef1 ph\u00e1t truy\u1ec7n ti\u1ebfp theo</label><audio preload="none"></audio></section>`;
 const $=q=>shadow.querySelector(q),audio=$('audio'),key='hls-story-player-v1',normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\u0111/g,'d');
 let index=0,pendingSeek=0,token=0,loaded=false,wantPlay=false,lastSave=0,disposed=false,saved={};
 const valid=t=>{try{return new URL(t.url).protocol==='https:'}catch{return false}};
 try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
 const fmt=t=>{if(!Number.isFinite(t)||t<0)return '--:--';t=Math.floor(t);return (t>=3600?Math.floor(t/3600)+':':'')+String(Math.floor(t/60)%60).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
 function message(s,error=false){$('.message').textContent=s;$('.message').classList.toggle('error',error)}
 function save(){if(!tracks[index]||!valid(tracks[index]))return;try{localStorage.setItem(key,JSON.stringify({url:tracks[index].url,time:pendingSeek||audio.currentTime||0,speed:Number($('.speed input').value),auto:$('.auto').checked}))}catch{}}
 function refresh(){const playing=!audio.paused&&!audio.ended;$('.play').innerHTML=icon(playing?'pause':'play')+'<span>'+(playing?"T\u1ea1m d\u1eebng":"Ph\u00e1t")+'</span>';$('.play').setAttribute('aria-label',playing?"T\u1ea1m d\u1eebng":"Ph\u00e1t truy\u1ec7n");}
 function times(){const d=audio.duration,t=pendingSeek||audio.currentTime||0;$('.elapsed').textContent=fmt(t);$('.duration').textContent=fmt(d);$('.progress').disabled=!Number.isFinite(d)||d<=0;$('.progress').value=d>0?t/d*1000:0;$('.progress').setAttribute('aria-valuetext',fmt(t)+' / '+fmt(d));}
 function renderList(){const q=normalize($('.search input').value);$('.list').replaceChildren();let n=0;tracks.forEach((t,i)=>{if(!normalize(t.title+' '+t.author).includes(q))return;n++;const b=document.createElement('button');b.type='button';b.className='track';b.setAttribute('aria-pressed',String(i===index));const num=document.createElement('span');num.className='number';num.textContent=String(i+1).padStart(2,'0');const info=document.createElement('span');info.className='info';const title=document.createElement('span');title.className='track-title';title.textContent=t.title;const sub=document.createElement('span');sub.className='track-sub';sub.textContent=(t.author||'')+(!valid(t)?(t.author?" \u00b7 ":'')+"Ch\u01b0a c\u00f3 MP3":'');info.append(title,sub);b.append(num,info);b.onclick=()=>{if(index===i){if(valid(t))toggle()}else select(i,true)};$('.list').append(b)});$('.count').textContent=(q?n+'/'+tracks.length:tracks.length)+" truy\u1ec7n";if(!n){const p=document.createElement('div');p.className='empty';p.textContent="Kh\u00f4ng t\u00ecm th\u1ea5y truy\u1ec7n ph\u00f9 h\u1ee3p.";$('.list').append(p)}}
 function select(i,autoplay=false,resume=0){token++;wantPlay=false;audio.pause();audio.removeAttribute('src');audio.load();loaded=false;index=i;pendingSeek=Math.max(0,Number(resume)||0);const t=tracks[index];$('.title').textContent=t?t.title:"Ch\u01b0a c\u00f3 truy\u1ec7n";$('.author').textContent=t?t.author:'';const available=t&&valid(t);$('.play').disabled=!available;$('.stop').disabled=!available;$('.previous').disabled=index<=0;$('.next').disabled=index>=tracks.length-1;message(available?(pendingSeek?"B\u1ea5m Ph\u00e1t \u0111\u1ec3 nghe ti\u1ebfp.":"S\u1eb5n s\u00e0ng \u0111\u1ec3 nghe."):"Truy\u1ec7n n\u00e0y ch\u01b0a c\u00f3 link MP3.");refresh();times();renderList();if(autoplay&&available)play();}
 async function play(){if(!tracks[index]||!valid(tracks[index]))return;const current=++token;wantPlay=true;if(!loaded){audio.src=tracks[index].url;audio.load();loaded=true}audio.playbackRate=Number($('.speed input').value);message("\u0110ang t\u1ea3i \u00e2m thanh\u2026");try{await audio.play();if(current!==token||disposed)return;refresh();message("\u0110ang ph\u00e1t");save()}catch(e){if(current!==token||disposed||e.name==='AbortError')return;wantPlay=false;message(e.name==='NotAllowedError'?"B\u1ea5m Ph\u00e1t \u0111\u1ec3 b\u1eaft \u0111\u1ea7u nghe.":"Kh\u00f4ng ph\u00e1t \u0111\u01b0\u1ee3c. H\u00e3y ki\u1ec3m tra link MP3 ho\u1eb7c m\u1ea1ng.",true);refresh()}}
 function toggle(){if(wantPlay||!audio.paused){token++;wantPlay=false;audio.pause();message("\u0110\u00e3 t\u1ea1m d\u1eebng");save();refresh()}else play()}
 $('.play').onclick=toggle;
 $('.stop').onclick=()=>{token++;wantPlay=false;audio.pause();pendingSeek=0;try{audio.currentTime=0}catch{}message("\u0110\u00e3 d\u1eebng \u2022 V\u1ec1 \u0111\u1ea7u truy\u1ec7n");times();refresh();save()};
 $('.previous').onclick=()=>{if(index>0){save();select(index-1,true)}};$('.next').onclick=()=>{if(index<tracks.length-1){save();select(index+1,true)}};
 $('.progress').oninput=()=>{if(Number.isFinite(audio.duration)){pendingSeek=0;audio.currentTime=Number($('.progress').value)/1000*audio.duration;times();save()}};
 function updateSpeed(){const rate=Number($('.speed input').value);const label=String(rate).replace('.',',')+"x";audio.playbackRate=rate;$('.speed output').textContent=label;$('.speed input').setAttribute('aria-valuetext',label)}
 $('.speed input').oninput=()=>{updateSpeed();save()};$('.auto').onchange=save;$('.search input').oninput=renderList;
 audio.onloadedmetadata=()=>{if(pendingSeek&&Number.isFinite(audio.duration)){audio.currentTime=Math.min(pendingSeek,Math.max(0,audio.duration-0.1));pendingSeek=0}audio.playbackRate=Number($('.speed input').value);times()};
 audio.ontimeupdate=()=>{times();if(Date.now()-lastSave>2500){save();lastSave=Date.now()}};
 audio.onplaying=()=>{if(!wantPlay){audio.pause();return}message("\u0110ang ph\u00e1t");refresh()};audio.onpause=()=>{refresh();save()};audio.onwaiting=()=>{if(wantPlay)message("\u0110ang t\u1ea3i \u00e2m thanh\u2026")};
 audio.onerror=()=>{if(!loaded)return;wantPlay=false;loaded=false;message("Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c \u00e2m thanh. Ki\u1ec3m tra link MP3 ho\u1eb7c m\u1ea1ng.",true);refresh()};
 audio.onended=()=>{wantPlay=false;pendingSeek=0;audio.currentTime=0;save();refresh();if($('.auto').checked){let n=index+1;while(n<tracks.length&&!valid(tracks[n]))n++;if(n<tracks.length){select(n,true);return}}message("\u0110\u00e3 nghe h\u1ebft truy\u1ec7n");times()};
 const speed=[0.75,1,1.25,1.5,1.75,2].includes(Number(saved.speed))?saved.speed:1;$('.speed input').value=String(speed);updateSpeed();$('.auto').checked=Boolean(saved.auto);
 const restored=tracks.findIndex(t=>t.url&&t.url===saved.url);select(restored<0?0:restored,false,restored<0?0:saved.time);
 const onHide=()=>save();window.addEventListener('pagehide',onHide);
 return {
   setTracks(next){
     tracks=next;
     const found=tracks.findIndex(t=>t.url&&t.url===saved.url);
     select(found<0?0:found,false,found<0?0:saved.time);
     $('.retry').hidden=true;
     if(!tracks.length)message("Danh s\u00e1ch ch\u01b0a c\u00f3 truy\u1ec7n.");
   },
   setStatus(title,detail,error=false){$('.title').textContent=title;message(detail,error);$('.retry').hidden=!error},
   onRetry(handler){$('.retry').onclick=handler},
   destroy(){save();disposed=true;token++;wantPlay=false;audio.pause();audio.removeAttribute('src');audio.load();window.removeEventListener('pagehide',onHide)}
 };
}
function validatePlaylist(data){
  if(!Array.isArray(data))throw new Error("Danh s\u00e1ch JSON ph\u1ea3i b\u1eaft \u0111\u1ea7u b\u1eb1ng [ v\u00e0 k\u1ebft th\u00fac b\u1eb1ng ].");
  return data.map((t,i)=>{
    if(!t || typeof t.title!=='string' || !t.title.trim())throw new Error("Truy\u1ec7n s\u1ed1 "+(i+1)+" thi\u1ebfu t\u00ean (title).");
    if(t.author!==undefined && typeof t.author!=='string')throw new Error("T\u00e1c gi\u1ea3 c\u1ee7a truy\u1ec7n s\u1ed1 "+(i+1)+" ph\u1ea3i l\u00e0 v\u0103n b\u1ea3n.");
    if(t.url!==undefined && typeof t.url!=='string')throw new Error("Link MP3 c\u1ee7a truy\u1ec7n s\u1ed1 "+(i+1)+" ph\u1ea3i l\u00e0 v\u0103n b\u1ea3n.");
    const url=(t.url||'').trim();
    if(url){let parsed;try{parsed=new URL(url)}catch{}if(!parsed || parsed.protocol!=='https:' || parsed.username || parsed.password)throw new Error("Link MP3 c\u1ee7a truy\u1ec7n s\u1ed1 "+(i+1)+" c\u1ea7n l\u00e0 HTTPS c\u00f4ng khai.");}
    return {title:t.title.trim(),author:(t.author||'').trim(),url};
  });
}
async function fetchPlaylist(url,fetcher=fetch,timeoutMs=12000){
  let parsed;try{parsed=new URL(url)}catch{}
  if(!parsed || parsed.protocol!=='https:' || parsed.username || parsed.password)throw new Error("H\u00e3y c\u1ea5u h\u00ecnh link JSON c\u00f4ng khai d\u00f9ng HTTPS.");
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    const response=await fetcher(parsed.href,{mode:'cors',credentials:'omit',cache:'no-cache',signal:abort.signal});
    if(!response.ok){if(response.status===404)throw new Error("Ch\u01b0a t\u00ecm th\u1ea5y truyen.json. Ki\u1ec3m tra v\u1ecb tr\u00ed t\u1ec7p v\u00e0 link Raw.");throw new Error("Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c danh s\u00e1ch (HTTP "+response.status+').');}
    const text=await response.text();
    let data;try{data=JSON.parse((text.charCodeAt(0)===65279?text.slice(1):text))}catch{throw new Error("T\u1ec7p danh s\u00e1ch kh\u00f4ng ph\u1ea3i JSON h\u1ee3p l\u1ec7. Ki\u1ec3m tra d\u1ea5u ph\u1ea9y v\u00e0 d\u1ea5u nh\u00e1y.");}
    return validatePlaylist(data);
  }catch(error){
    if(error.name==='AbortError')throw new Error("T\u1ea3i danh s\u00e1ch qu\u00e1 l\u00e2u. B\u1ea5m Th\u1eed l\u1ea1i.");
    if(error instanceof TypeError)throw new Error("Kh\u00f4ng k\u1ebft n\u1ed1i \u0111\u01b0\u1ee3c danh s\u00e1ch. Ki\u1ec3m tra m\u1ea1ng ho\u1eb7c quy\u1ec1n truy c\u1eadp link JSON.");
    throw error;
  }finally{clearTimeout(timer)}
}

const player=mountStoryPlayer(host,[]);
let loading=false;
async function loadList(){
  if(loading)return;
  loading=true;
  player.setStatus("\u0110ang t\u1ea3i danh s\u00e1ch\u2026","Vui l\u00f2ng ch\u1edd m\u1ed9t ch\u00fat.");
  try{player.setTracks(await fetchPlaylist(PLAYLIST_URL))}
  catch(error){player.setStatus("Ch\u01b0a t\u1ea3i \u0111\u01b0\u1ee3c danh s\u00e1ch",error.message,true)}
  finally{loading=false}
}
player.onRetry(loadList);
loadList();
})();
