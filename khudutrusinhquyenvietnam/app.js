(() => {
'use strict';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reserveList = $('#reserveList');
const detailSection = $('#detailSection');

let selectedId = null;
let activeRegion = 'Tất cả';
const regionOrder = ['Tất cả', 'Miền Bắc', 'Miền Trung', 'Tây Nguyên', 'Miền Nam'];
const regionClass = {'Miền Bắc':'north','Miền Trung':'central','Tây Nguyên':'highlands','Miền Nam':'south'};
const PLACEHOLDER = 'assets/photo-placeholder.svg';

function esc(s='') { return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function imageTag(r, className='') {
  return `<img class="${className}" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(r.image?.src || PLACEHOLDER)}" alt="Cảnh quan ${esc(r.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;
}
function imageCredit(r) { return r.image?.credit || r.image?.sourceName || 'Nguồn chính thống Việt Nam'; }
function formatCoord(n, suffix) { return `${Number(n).toFixed(3)}°${suffix}`; }

// ====================== MAP ENGINE: SELF-CONTAINED ======================
// Không tile, không API key, không PDF nhúng, không CDN bản đồ.
const MAP_BOUNDS = {west:90, east:135, south:-5, north:35};
const VIEW_BOUNDS = {west:101.2, east:118.7, south:5.0, north:24.2};
const STAGE_W = 1000;
const STAGE_H = 942.5; // đúng tỉ lệ ảnh Mercator đã đóng gói (7200 × 6786)
const markerOffsets = {
  'cat-ba':[10,-7], 'red-river':[-10,7], 'can-gio':[8,-6], 'dong-nai':[-8,5],
  'nui-chua':[9,-4], 'langbiang':[-8,5], 'mui-ca-mau':[7,7], 'kien-giang':[-7,-5]
};
const mapLabels = [
  {name:'VIỆT NAM', lat:15.4, lng:106.4, cls:'country-label'},
  {name:'TRUNG QUỐC', lat:25.1, lng:108.5, cls:'neighbor-label'},
  {name:'LÀO', lat:18.0, lng:102.6, cls:'neighbor-label'},
  {name:'CAMPUCHIA', lat:12.7, lng:104.2, cls:'neighbor-label'},
  {name:'THÁI LAN', lat:15.1, lng:100.8, cls:'neighbor-label'},
  {name:'PHILIPPINES', lat:12.6, lng:122.2, cls:'neighbor-label'},
  {name:'BIỂN ĐÔNG', lat:13.2, lng:113.2, cls:'sea-label'},
  {name:'Quần đảo Hoàng Sa', lat:16.45, lng:112.0, cls:'archipelago-label major'},
  {name:'Quần đảo Trường Sa', lat:9.45, lng:114.25, cls:'archipelago-label major'},
  {name:'Cát Bà', lat:20.80, lng:107.00, cls:'island-label minor'},
  {name:'Bạch Long Vĩ', lat:20.13, lng:107.72, cls:'island-label minor'},
  {name:'Cồn Cỏ', lat:17.16, lng:107.34, cls:'island-label minor'},
  {name:'Lý Sơn', lat:15.38, lng:109.12, cls:'island-label minor'},
  {name:'Cù Lao Chàm', lat:15.95, lng:108.52, cls:'island-label minor'},
  {name:'Phú Quốc', lat:10.24, lng:103.96, cls:'island-label minor'},
  {name:'Côn Đảo', lat:8.68, lng:106.60, cls:'island-label minor'}
];

function mercY(lat) {
  const clamped = Math.max(-85, Math.min(85, lat));
  const rad = clamped * Math.PI/180;
  return Math.log(Math.tan(Math.PI/4 + rad/2));
}
const mercNorth = mercY(MAP_BOUNDS.north), mercSouth = mercY(MAP_BOUNDS.south);
function geoToStage(lat,lng) {
  const x = (lng - MAP_BOUNDS.west)/(MAP_BOUNDS.east-MAP_BOUNDS.west)*STAGE_W;
  const y = (mercNorth-mercY(lat))/(mercNorth-mercSouth)*STAGE_H;
  return {x,y};
}

class AtlasMap {
  constructor(el) {
    this.el = el;
    this.scale = 1; this.tx = 0; this.ty = 0; this.minScale = 1; this.maxScale = 8; this.overviewScale = 1;
    this.drag = null; this.selectedId = null; this.quizMode = false;
    this.build();
    this.bind();
    requestAnimationFrame(() => this.fitVietnam(false));
  }
  build() {
    this.el.innerHTML = `
      <div class="atlas-viewport" id="atlasViewport" tabindex="0" aria-label="Bản đồ tương tác Việt Nam và Biển Đông">
        <div class="atlas-stage" id="atlasStage"><img src="assets/atlas-region.webp" alt="Bản đồ nền học tập khu vực Việt Nam và Đông Nam Á" draggable="false"></div>
        <div class="atlas-label-layer" id="atlasLabelLayer" aria-hidden="true"></div>
        <div class="atlas-marker-layer" id="atlasMarkerLayer"></div>
        <div class="atlas-zoom-controls" aria-label="Thu phóng bản đồ">
          <button type="button" data-map-zoom="in" aria-label="Phóng to">+</button>
          <button type="button" data-map-zoom="out" aria-label="Thu nhỏ">−</button>
        </div>
      </div>`;
    this.viewport = $('#atlasViewport', this.el);
    this.stage = $('#atlasStage', this.el);
    this.labels = $('#atlasLabelLayer', this.el);
    this.markers = $('#atlasMarkerLayer', this.el);
    this.renderStaticLabels();
    this.renderMarkers();
  }
  renderStaticLabels() {
    this.labels.innerHTML = mapLabels.map((l,i)=>`<div class="atlas-map-label ${l.cls}" data-label-index="${i}">${l.name}</div>`).join('');
  }
  renderMarkers() {
    this.markers.innerHTML = BIOSPHERES.map(r=>`
      <button class="reserve-marker ${regionClass[r.region] || ''}" type="button" data-map-id="${r.id}" aria-label="${esc(r.name)}">
        <span class="marker-core"></span><span class="marker-tooltip"><b>${r.name}</b><small>UNESCO ${r.year} · ${r.currentLocation}</small></span>
      </button>`).join('');
    $$('[data-map-id]', this.markers).forEach(btn=>btn.addEventListener('click', e=>{
      e.stopPropagation(); const id=btn.dataset.mapId;
      if (quizState.active) handleQuizAnswer(id); else selectReserve(id, true);
    }));
  }
  bind() {
    this.viewport.addEventListener('wheel', e=>{
      e.preventDefault();
      const rect=this.viewport.getBoundingClientRect();
      this.zoomAt(e.clientX-rect.left,e.clientY-rect.top,e.deltaY<0?1.16:1/1.16);
    },{passive:false});
    this.viewport.addEventListener('pointerdown', e=>{
      if (e.button!==0 || e.target.closest('button')) return;
      this.viewport.setPointerCapture(e.pointerId);
      this.drag={x:e.clientX,y:e.clientY,tx:this.tx,ty:this.ty,pointerId:e.pointerId};
      this.viewport.classList.add('dragging');
    });
    this.viewport.addEventListener('pointermove', e=>{
      if(!this.drag || this.drag.pointerId!==e.pointerId) return;
      this.tx=this.drag.tx+(e.clientX-this.drag.x); this.ty=this.drag.ty+(e.clientY-this.drag.y);
      this.clamp(); this.render();
    });
    const end=e=>{ if(this.drag && (!e.pointerId || e.pointerId===this.drag.pointerId)){this.drag=null;this.viewport.classList.remove('dragging');} };
    this.viewport.addEventListener('pointerup',end); this.viewport.addEventListener('pointercancel',end);
    this.viewport.addEventListener('dblclick', e=>{
      const rect=this.viewport.getBoundingClientRect(); this.zoomAt(e.clientX-rect.left,e.clientY-rect.top,1.35);
    });
    $$('[data-map-zoom]',this.el).forEach(b=>b.addEventListener('click',()=>{
      const rect=this.viewport.getBoundingClientRect(); this.zoomAt(rect.width/2,rect.height/2,b.dataset.mapZoom==='in'?1.28:1/1.28);
    }));
    new ResizeObserver(()=>this.handleResize()).observe(this.viewport);
  }
  computeFullMinScale() {
    const w=this.viewport.clientWidth||1,h=this.viewport.clientHeight||1;
    return Math.max(w/STAGE_W,h/STAGE_H);
  }
  fitBounds(bounds, animate=true) {
    const nw=geoToStage(bounds.north,bounds.west), se=geoToStage(bounds.south,bounds.east);
    const bw=Math.max(1,se.x-nw.x), bh=Math.max(1,se.y-nw.y);
    const vw=this.viewport.clientWidth||1,vh=this.viewport.clientHeight||1,pad=Math.min(46,Math.max(18,vw*.035));
    this.minScale=this.computeFullMinScale();
    const s=Math.max(this.minScale,Math.min((vw-2*pad)/bw,(vh-2*pad)/bh));
    this.overviewScale=s; this.maxScale=Math.max(s*5.5,this.minScale*7);
    const cx=(nw.x+se.x)/2,cy=(nw.y+se.y)/2;
    this.setTransform(s,vw/2-cx*s,vh/2-cy*s,animate);
  }
  fitVietnam(animate=true){this.fitBounds(VIEW_BOUNDS,animate);}
  focus(lat,lng,level=1.9,animate=true){
    const p=geoToStage(lat,lng),vw=this.viewport.clientWidth||1,vh=this.viewport.clientHeight||1;
    const s=Math.min(this.maxScale,Math.max(this.overviewScale*level,this.minScale));
    this.setTransform(s,vw/2-p.x*s,vh/2-p.y*s,animate);
  }
  zoomAt(x,y,factor){
    const ns=Math.max(this.minScale,Math.min(this.maxScale,this.scale*factor));
    const ratio=ns/this.scale;
    this.setTransform(ns,x-(x-this.tx)*ratio,y-(y-this.ty)*ratio,true);
  }
  setTransform(scale,tx,ty,animate=false){
    this.scale=scale;this.tx=tx;this.ty=ty;this.clamp();
    if(animate){this.stage.classList.add('map-animating');this.labels.classList.add('map-animating');this.markers.classList.add('map-animating');clearTimeout(this.animTimer);this.animTimer=setTimeout(()=>{this.stage.classList.remove('map-animating');this.labels.classList.remove('map-animating');this.markers.classList.remove('map-animating');},320);}
    this.render();
  }
  clamp(){
    const vw=this.viewport.clientWidth||1,vh=this.viewport.clientHeight||1;
    const sw=STAGE_W*this.scale,sh=STAGE_H*this.scale;
    if(sw<=vw) this.tx=(vw-sw)/2; else this.tx=Math.min(0,Math.max(vw-sw,this.tx));
    if(sh<=vh) this.ty=(vh-sh)/2; else this.ty=Math.min(0,Math.max(vh-sh,this.ty));
  }
  handleResize(){
    const oldOverview=Math.abs(this.scale-this.overviewScale)<.12*this.overviewScale;
    this.minScale=this.computeFullMinScale();
    if(oldOverview || !Number.isFinite(this.scale)) this.fitVietnam(false); else {this.scale=Math.max(this.scale,this.minScale);this.clamp();this.render();}
  }
  render(){
    this.stage.style.transform=`translate3d(${this.tx}px,${this.ty}px,0) scale(${this.scale})`;
    const detailRatio=this.scale/Math.max(this.overviewScale,.0001);
    const overview=detailRatio<1.55;
    mapLabels.forEach((l,i)=>{
      const el=$(`[data-label-index="${i}"]`,this.labels); if(!el)return;
      const p=geoToStage(l.lat,l.lng); const x=this.tx+p.x*this.scale,y=this.ty+p.y*this.scale;
      el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      const minor=l.cls.includes('minor');
      el.hidden=minor && overview;
    });
    BIOSPHERES.forEach(r=>{
      const el=$(`[data-map-id="${r.id}"]`,this.markers);if(!el)return;
      const p=geoToStage(r.lat,r.lng); let x=this.tx+p.x*this.scale,y=this.ty+p.y*this.scale;
      if(overview && markerOffsets[r.id]){x+=markerOffsets[r.id][0];y+=markerOffsets[r.id][1];}
      el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      const vw=this.viewport.clientWidth,vh=this.viewport.clientHeight;
      el.hidden=(x<-24||y<-24||x>vw+24||y>vh+24);
      el.classList.toggle('selected',r.id===this.selectedId);
    });
    this.el.classList.toggle('map-detail',detailRatio>1.6);
  }
  select(id){this.selectedId=id;this.render();}
}

const map = new AtlasMap($('#map'));
$('#resetMap').addEventListener('click',()=>map.fitVietnam(true));

// ====================== FILTER + LIST ======================
function currentFiltered(){
  const q=$('#searchInput').value.trim().toLowerCase(); const environment=$('#environmentFilter').value;
  let list=BIOSPHERES.filter(r=>activeRegion==='Tất cả'||r.region===activeRegion);
  if(environment!=='Tất cả') list=list.filter(r=>r.environment===environment||r.type.includes(environment));
  if(q) list=list.filter(r=>[r.name,r.unescoName,r.currentLocation,r.unescoLocation,r.region,r.environment,r.year,r.area,...r.type,r.summary,r.nature,r.role,r.highlight].join(' ').toLowerCase().includes(q));
  const sort=$('#sortSelect').value;
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  else if(sort==='northSouth') list.sort((a,b)=>b.lat-a.lat);
  else list.sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name,'vi'));
  return list;
}
function renderFilters(){
  $('#regionFilters').innerHTML=regionOrder.map(r=>`<button class="chip ${r===activeRegion?'active':''}" data-region="${r}" type="button">${r}</button>`).join('');
  $$('[data-region]',$('#regionFilters')).forEach(btn=>btn.addEventListener('click',()=>{activeRegion=btn.dataset.region;renderFilters();renderList();}));
}
function renderList(){
  const list=currentFiltered(); $('#resultCount').textContent=list.length;
  reserveList.innerHTML=list.length?list.map(r=>`<article class="reserve-card ${selectedId===r.id?'active':''}" data-id="${r.id}" tabindex="0" role="button" aria-label="Xem ${esc(r.name)}"><div class="card-thumb">${imageTag(r)}</div><div class="card-main"><div class="card-title-row"><h3>${r.name}</h3><span class="region-dot ${regionClass[r.region]}"></span></div><div class="meta-row"><span class="meta-pill">UNESCO ${r.year}</span><span class="meta-pill">${r.currentLocation}</span></div><div class="card-desc">${r.summary}</div></div></article>`).join(''):'<div class="empty">Không tìm thấy khu phù hợp.</div>';
  $$('.reserve-card',reserveList).forEach(card=>{const go=()=>selectReserve(card.dataset.id,true);card.addEventListener('click',go);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
}
function selectReserve(id,moveMap=false,shouldScroll=false){
  const r=BIOSPHERES.find(x=>x.id===id);if(!r)return; selectedId=id; map.select(id);renderList();
  if(moveMap) map.focus(r.lat,r.lng,2.0,true);
  detailSection.innerHTML=detailHtml(r);bindDetailEvents(r);
  if(shouldScroll||(moveMap&&window.innerWidth<1050)) setTimeout(()=>detailSection.scrollIntoView({behavior:'smooth',block:'start'}),360);
}
function detailHtml(r){
  const changed=new Set(['red-river','kien-giang','cu-lao-cham','nui-chua','phong-nha']).has(r.id);
  return `<div class="detail-layout"><div class="detail-media"><figure class="detail-figure">${imageTag(r,'detail-image')}<figcaption><span>Ảnh: ${imageCredit(r)}</span><a href="${esc(r.image.sourceUrl)}" target="_blank" rel="noopener">${r.image.sourceName} ↗</a></figcaption></figure><button class="video-preview" type="button" data-video-id="${r.video.id}"><img loading="lazy" src="https://i.ytimg.com/vi/${r.video.id}/hqdefault.jpg" onerror="this.onerror=null;this.src='${PLACEHOLDER}'" alt="Video ${esc(r.name)}"><span class="play-badge">▶</span><span class="video-copy"><b>${r.video.title}</b><small>${r.video.channel}</small></span></button></div><div class="detail-copy"><div class="detail-top"><div><div class="detail-kicker">${r.unescoName.toUpperCase()}</div><h2>${r.name}</h2><div class="detail-location">📍 ${r.currentLocation}</div></div><div class="year-stamp"><b>${r.year}</b><span>UNESCO</span></div></div>${changed?`<div class="admin-note">Hồ sơ UNESCO sử dụng địa danh: <b>${r.unescoLocation}</b>. Tiện ích ưu tiên địa giới hành chính hiện nay.</div>`:''}<p class="detail-summary">${r.summary}</p><div class="facts"><div class="fact"><span>DIỆN TÍCH</span><b>${r.area}</b></div><div class="fact"><span>TỌA ĐỘ THAM CHIẾU</span><b>${formatCoord(r.lat,'N')} · ${formatCoord(r.lng,'E')}</b></div><div class="fact"><span>KIỂU CẢNH QUAN</span><b>${r.type.slice(0,3).join(' · ')}</b></div></div><div class="detail-tabs" role="tablist"><button class="detail-tab active" data-tab="nature" type="button">🌿 Tự nhiên</button><button class="detail-tab" data-tab="people" type="button">👥 Con người</button><button class="detail-tab" data-tab="role" type="button">🎯 Vai trò</button><button class="detail-tab" data-tab="challenge" type="button">⚠ Thách thức</button></div><div class="tab-panels"><div class="tab-panel active" data-panel="nature"><p>${r.nature}</p></div><div class="tab-panel" data-panel="people"><p>${r.people}</p></div><div class="tab-panel" data-panel="role"><p>${r.role}</p></div><div class="tab-panel" data-panel="challenge"><p>${r.challenge}</p></div></div><div class="highlight-box"><b>💡 Ghi nhớ:</b> ${r.highlight}</div><div class="detail-actions"><button class="soft-btn" type="button" data-focus-map>◎ Xem vị trí trên bản đồ</button><a class="soft-btn" href="${r.source}" target="_blank" rel="noopener">UNESCO ↗</a><a class="soft-btn" href="https://www.youtube.com/watch?v=${r.video.id}" target="_blank" rel="noopener">YouTube ↗</a></div></div></div>`;
}
function bindDetailEvents(r){
  $$('.detail-tab',detailSection).forEach(btn=>btn.addEventListener('click',()=>{$$('.detail-tab',detailSection).forEach(x=>x.classList.toggle('active',x===btn));$$('.tab-panel',detailSection).forEach(p=>p.classList.toggle('active',p.dataset.panel===btn.dataset.tab));}));
  $('[data-video-id]',detailSection)?.addEventListener('click',()=>openVideoModal(r));
  $('[data-focus-map]',detailSection)?.addEventListener('click',()=>{$('#atlas').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>map.focus(r.lat,r.lng,2.15,true),300);});
}
$('#searchInput').addEventListener('input',renderList);$('#sortSelect').addEventListener('change',renderList);$('#environmentFilter').addEventListener('change',renderList);

// ====================== TIMELINE ======================
function renderTimeline(){
  const groups=BIOSPHERES.slice().sort((a,b)=>a.year-b.year).reduce((acc,r)=>{(acc[r.year]||=[]).push(r);return acc;},{});
  $('#timelineTrack').innerHTML=`<div class="timeline-inner">${Object.entries(groups).map(([year,list])=>`<div class="timeline-year"><div class="year-dot"></div><b class="year-number">${year}</b><div class="year-items">${list.map(r=>`<button type="button" data-timeline-id="${r.id}">${r.name}</button>`).join('')}</div></div>`).join('')}</div>`;
  $$('[data-timeline-id]').forEach(btn=>btn.addEventListener('click',()=>{selectReserve(btn.dataset.timelineId,true,false);$('#atlas').scrollIntoView({behavior:'smooth',block:'start'});}));
}

// ====================== COMPARE ======================
function initCompare(){
  const opts=BIOSPHERES.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');$('#compareA').innerHTML=opts;$('#compareB').innerHTML=opts;$('#compareA').value='can-gio';$('#compareB').value='langbiang';$('#compareBtn').addEventListener('click',renderCompare);$('#swapCompare').addEventListener('click',()=>{const a=$('#compareA').value;$('#compareA').value=$('#compareB').value;$('#compareB').value=a;renderCompare();});renderCompare();
}
function renderCompare(){
  const a=BIOSPHERES.find(r=>r.id===$('#compareA').value),b=BIOSPHERES.find(r=>r.id===$('#compareB').value);if(!a||!b)return;
  $('#compareResult').innerHTML=`<div class="compare-scroll"><table class="compare-table"><thead><tr><th>Nội dung</th><th>${a.name}</th><th>${b.name}</th></tr></thead><tbody><tr><td>Vị trí hiện nay</td><td>${a.currentLocation}</td><td>${b.currentLocation}</td></tr><tr><td>UNESCO</td><td>${a.year}</td><td>${b.year}</td></tr><tr><td>Diện tích</td><td>${a.area}</td><td>${b.area}</td></tr><tr><td>Cảnh quan</td><td>${a.type.join(', ')}</td><td>${b.type.join(', ')}</td></tr><tr><td>Tự nhiên</td><td>${a.nature}</td><td>${b.nature}</td></tr><tr><td>Vai trò</td><td>${a.role}</td><td>${b.role}</td></tr><tr><td>Thách thức</td><td>${a.challenge}</td><td>${b.challenge}</td></tr></tbody></table></div>`;
}

// ====================== MEDIA ======================
function renderMedia(){
  $('#mediaGrid').innerHTML=BIOSPHERES.map(r=>`<article class="media-card"><button class="media-image-btn" type="button" data-image-id="${r.id}" aria-label="Xem ảnh lớn ${esc(r.name)}">${imageTag(r)}<span class="media-year">${r.year}</span></button><div class="media-card-copy"><h3>${r.name}</h3><p>${r.currentLocation} · ${r.type[0]}</p><div class="media-buttons"><button type="button" data-image-id="${r.id}">🖼 Ảnh</button><button type="button" data-video-reserve="${r.id}">▶ Video</button></div></div></article>`).join('');
  $$('[data-image-id]',$('#mediaGrid')).forEach(btn=>btn.addEventListener('click',()=>{const r=BIOSPHERES.find(x=>x.id===btn.dataset.imageId);if(r)openImageModal(r);}));
  $$('[data-video-reserve]',$('#mediaGrid')).forEach(btn=>btn.addEventListener('click',()=>{const r=BIOSPHERES.find(x=>x.id===btn.dataset.videoReserve);if(r)openVideoModal(r);}));
}
function openImageModal(r){$('#modalContent').innerHTML=`<div class="modal-image-wrap">${imageTag(r,'modal-image')}<div class="modal-caption"><div><h2 id="modalTitle">${r.name}</h2><p>Ảnh: ${imageCredit(r)}</p></div><a href="${esc(r.image.sourceUrl)}" target="_blank" rel="noopener">Xem nguồn: ${r.image.sourceName} ↗</a></div></div>`;showModal();}
function openVideoModal(r){$('#modalContent').innerHTML=`<div class="modal-video-wrap"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${r.video.id}?rel=0" title="${esc(r.video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="modal-caption"><div><h2 id="modalTitle">${r.video.title}</h2><p>${r.video.channel} · ${r.name}</p></div><a href="https://www.youtube.com/watch?v=${r.video.id}" target="_blank" rel="noopener">Mở trên YouTube ↗</a></div></div>`;showModal();}
function showModal(){const modal=$('#mediaModal');modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');}
function closeModal(){const modal=$('#mediaModal');modal.hidden=true;modal.setAttribute('aria-hidden','true');$('#modalContent').innerHTML='';document.body.classList.remove('modal-open');}
$$('[data-close-modal]').forEach(el=>el.addEventListener('click',closeModal));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#mediaModal').hidden)closeModal();});

// ====================== QUIZ ======================
const quizState={active:false,order:[],index:0,score:0,wrong:0,answered:false};
function shuffled(arr){const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function startQuiz(){quizState.active=true;quizState.order=shuffled(BIOSPHERES).slice(0,8).map(r=>r.id);quizState.index=0;quizState.score=0;quizState.wrong=0;quizState.answered=false;document.body.classList.add('quiz-active');$('#quizHud').hidden=false;map.fitVietnam(false);renderQuizQuestion();}
function closeQuiz(){quizState.active=false;document.body.classList.remove('quiz-active');$('#quizHud').hidden=true;}
function renderQuizQuestion(){const total=quizState.order.length;if(quizState.index>=total){$('#quizRound').textContent=`${total}/${total}`;$('#quizProgressBar').style.width='100%';$('#quizQuestion').textContent='Hoàn thành thử thách!';$('#quizHint').innerHTML=`Bạn đạt <b>${quizState.score}/${total*10} điểm</b>.`;$('#quizFeedback').className='quiz-feedback success';$('#quizFeedback').textContent=quizState.score>=70?'Rất tốt! Bạn đã định hướng khá chắc trên bản đồ Việt Nam.':'Hãy xem lại các vị trí vừa nhầm rồi thử thêm một lượt.';$('#quizNext').hidden=false;$('#quizNext').textContent='Chơi lại ↻';$('#quizNext').onclick=startQuiz;return;}const r=BIOSPHERES.find(x=>x.id===quizState.order[quizState.index]);quizState.answered=false;quizState.wrong=0;$('#quizRound').textContent=`${quizState.index+1}/${total}`;$('#quizScore').textContent=quizState.score;$('#quizProgressBar').style.width=`${quizState.index/total*100}%`;$('#quizQuestion').textContent=`Hãy tìm: ${r.name}`;$('#quizHint').textContent='Bấm vào marker mà em cho là đúng.';$('#quizFeedback').className='quiz-feedback';$('#quizFeedback').textContent='';$('#quizNext').hidden=true;$('#quizNext').textContent='Câu tiếp theo →';$('#quizNext').onclick=nextQuizQuestion;}
function handleQuizAnswer(id){if(!quizState.active||quizState.answered)return;const target=BIOSPHERES.find(x=>x.id===quizState.order[quizState.index]),chosen=BIOSPHERES.find(x=>x.id===id),markerEl=$(`[data-map-id="${id}"]`);if(id===target.id){quizState.answered=true;const earned=Math.max(4,10-quizState.wrong*2);quizState.score+=earned;$('#quizScore').textContent=quizState.score;$('#quizFeedback').className='quiz-feedback success';$('#quizFeedback').innerHTML=`✓ Chính xác! <b>${target.name}</b> thuộc ${target.region}, hiện ở ${target.currentLocation}. +${earned} điểm.`;$('#quizNext').hidden=false;markerEl?.classList.add('quiz-correct');setTimeout(()=>markerEl?.classList.remove('quiz-correct'),1000);map.focus(target.lat,target.lng,1.75,true);}else{quizState.wrong++;$('#quizFeedback').className='quiz-feedback wrong';$('#quizFeedback').innerHTML=`Chưa đúng. <b>${chosen.name}</b> không phải đáp án. Gợi ý: ${target.name} thuộc <b>${target.region}</b> và có cảnh quan ${target.type[0].toLowerCase()}.`;markerEl?.classList.add('quiz-wrong');setTimeout(()=>markerEl?.classList.remove('quiz-wrong'),650);}}
function nextQuizQuestion(){quizState.index++;map.fitVietnam(false);renderQuizQuestion();}
$('#startQuizTop').addEventListener('click',()=>{$('#atlas').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(startQuiz,350);});$('#closeQuiz').addEventListener('click',closeQuiz);
$('#startExplore').addEventListener('click',()=>$('#atlas').scrollIntoView({behavior:'smooth',block:'start'}));

// ====================== INIT ======================
function init(){
  if(!Array.isArray(BIOSPHERES)||BIOSPHERES.length!==12) throw new Error(`Dữ liệu khu sinh quyển không hợp lệ (${BIOSPHERES?.length ?? 0}/12).`);
  renderFilters();renderList();renderTimeline();initCompare();renderMedia();map.fitVietnam(false);
  document.documentElement.classList.add('app-ready');
}
try{init();}catch(err){console.error(err);const banner=document.createElement('div');banner.className='fatal-banner';banner.textContent='Tiện ích gặp lỗi khi khởi tạo: '+err.message;document.body.prepend(banner);}

})();
