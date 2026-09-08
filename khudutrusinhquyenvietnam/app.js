const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const reserveList = $('#reserveList');
const detailSection = $('#detailSection');
let selectedId = null;
let activeRegion = 'Tất cả';
let markers = {};
let minorIslandsVisible = true;

const regionOrder = ['Tất cả', 'Miền Bắc', 'Miền Trung', 'Tây Nguyên', 'Miền Nam'];
const regionClass = {
  'Miền Bắc': 'north',
  'Miền Trung': 'central',
  'Tây Nguyên': 'highlands',
  'Miền Nam': 'south'
};

function youtubeThumb(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
function imageTag(r, className = '') {
  const fallback = youtubeThumb(r.video.id);
  const src = escapeAttr(r.image?.src || fallback);
  return `<img class="${className}" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${src}" alt="Cảnh quan ${escapeAttr(r.name)}" onerror="this.onerror=null;this.src='${fallback}'">`;
}
function imageCredit(r) {
  return r.image?.credit || r.image?.sourceName || 'Nguồn chính thống Việt Nam';
}

// ---------------- MAP ----------------
// V10: bản đồ nền chính thức của Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam.
// Không còn dùng atlas vector tự dựng, tile OSM/CARTO hay REST VNSDI có token.
// Nền chính là bản đồ hành chính Việt Nam 1:9.000.000 (2025) công bố công khai dưới dạng PDF.
const OFFICIAL_MAP_PDF = 'https://vnsdi.mae.gov.vn/downloads/hcvn_9tr_2025.pdf';
// Khung tọa độ in trên bản đồ chính thức: 102°E–118°E, 6°N–24°N.
const OFFICIAL_BOUNDS = L.latLngBounds([[6, 102], [24, 118]]);
const PADDED_BOUNDS = L.latLngBounds([[5.75, 101.75], [24.25, 118.25]]);

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: 3,
  maxZoom: 9.5,
  zoomControl: true,
  attributionControl: false,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  maxBoundsViscosity: 1,
  preferCanvas: true
});
map.setMaxBounds(PADDED_BOUNDS);

map.createPane('officialMapPane');
map.getPane('officialMapPane').style.zIndex = 120;
map.getPane('officialMapPane').style.pointerEvents = 'none';
map.createPane('reservePane');
map.getPane('reservePane').style.zIndex = 420;

// Overlay PDF tùy biến: Leaflet chịu trách nhiệm pan/zoom, còn nội dung bản đồ là PDF chính thức.
// Khung PDF được cắt đúng vào phần bản đồ (bỏ tiêu đề, lề giấy và dòng nguồn ở dưới).
const OfficialPdfOverlay = L.Layer.extend({
  initialize(pdfUrl, bounds) {
    this._pdfUrl = pdfUrl;
    this._bounds = L.latLngBounds(bounds);
  },
  onAdd(m) {
    this._map = m;
    const pane = m.getPane('officialMapPane');
    this._container = L.DomUtil.create('div', 'official-map-overlay', pane);
    this._container.setAttribute('aria-hidden', 'true');

    const loading = document.createElement('div');
    loading.className = 'official-map-loading';
    loading.innerHTML = '<b>Đang tải bản đồ hành chính chính thức…</b><span>Nguồn: Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam</span>';

    const obj = document.createElement('object');
    obj.className = 'official-map-pdf';
    obj.type = 'application/pdf';
    obj.tabIndex = -1;
    obj.data = `${this._pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`;
    obj.addEventListener('load', () => {
      this._container?.classList.add('pdf-ready');
      document.documentElement.classList.add('official-pdf-loaded');
    }, {once:true});
    this._object = obj;

    this._container.append(loading, obj);
    m.on('zoom viewreset move resize', this._reset, this);
    this._reset();
  },
  onRemove(m) {
    m.off('zoom viewreset move resize', this._reset, this);
    this._container?.remove();
  },
  _reset() {
    if (!this._map || !this._container) return;
    const nw = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
    const se = this._map.latLngToLayerPoint(this._bounds.getSouthEast());
    L.DomUtil.setPosition(this._container, nw);
    this._container.style.width = `${Math.max(1, se.x - nw.x)}px`;
    this._container.style.height = `${Math.max(1, se.y - nw.y)}px`;
  }
});

new OfficialPdfOverlay(OFFICIAL_MAP_PDF, OFFICIAL_BOUNDS).addTo(map);

function reserveIcon(r) {
  return L.divIcon({
    className: '',
    html: `<div class="reserve-marker ${regionClass[r.region] || ''}" aria-hidden="true"><span></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function bindReserveTooltip(r) {
  const marker = markers[r.id];
  if (!marker) return;
  marker.bindTooltip(`<b>${r.name}</b><br><span>UNESCO ${r.year} · ${r.currentLocation}</span>`, {
    direction: 'top', offset: [0, -9], className: 'reserve-tooltip'
  });
}

BIOSPHERES.forEach(r => {
  const m = L.marker([r.lat, r.lng], {
    icon: reserveIcon(r),
    riseOnHover: true,
    keyboard: true,
    pane: 'reservePane'
  }).addTo(map);
  markers[r.id] = m;
  bindReserveTooltip(r);
  m.on('click', () => {
    if (quizState.active) handleQuizAnswer(r.id);
    else selectReserve(r.id, true);
  });
});

let overviewZoom = 5;
function fitVietnam({animate=false} = {}) {
  // fitBounds bảo đảm nhìn thấy toàn bộ Việt Nam, Hoàng Sa và Trường Sa của bản đồ chính thức.
  map.setMinZoom(2.5);
  map.fitBounds(OFFICIAL_BOUNDS, {
    paddingTopLeft:[10,10], paddingBottomRight:[10,10], animate
  });
  overviewZoom = map.getZoom();
  // Không cho thu nhỏ đến mức lộ ngoài phạm vi tờ bản đồ.
  map.setMinZoom(Math.max(2.5, overviewZoom));
}

let resizeTimer;
function refreshMapLayout() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const wasOverview = Math.abs(map.getZoom() - overviewZoom) <= .35;
    map.invalidateSize({pan:false});
    if (wasOverview) fitVietnam();
  }, 140);
}
window.addEventListener('resize', refreshMapLayout, {passive:true});

$('#resetMap').addEventListener('click', () => fitVietnam({animate:true}));

// ---------------- FILTER + LIST ----------------
function currentFiltered() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const environment = $('#environmentFilter').value;
  let list = BIOSPHERES.filter(r => activeRegion === 'Tất cả' || r.region === activeRegion);
  if (environment !== 'Tất cả') list = list.filter(r => r.environment === environment || r.type.includes(environment));
  if (q) {
    list = list.filter(r => [
      r.name, r.unescoName, r.currentLocation, r.unescoLocation, r.region, r.environment,
      r.year, r.area, ...r.type, r.summary, r.nature, r.role, r.highlight
    ].join(' ').toLowerCase().includes(q));
  }
  const sort = $('#sortSelect').value;
  if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'vi'));
  else if (sort === 'northSouth') list.sort((a,b) => b.lat - a.lat);
  else list.sort((a,b) => a.year - b.year || a.name.localeCompare(b.name, 'vi'));
  return list;
}

function renderFilters() {
  $('#regionFilters').innerHTML = regionOrder.map(r =>
    `<button class="chip ${r === activeRegion ? 'active' : ''}" data-region="${r}" type="button">${r}</button>`
  ).join('');
  $$('[data-region]', $('#regionFilters')).forEach(btn => btn.addEventListener('click', () => {
    activeRegion = btn.dataset.region;
    renderFilters();
    renderList();
  }));
}

function renderList() {
  const list = currentFiltered();
  $('#resultCount').textContent = list.length;
  reserveList.innerHTML = list.length ? list.map(r => `
    <article class="reserve-card ${selectedId === r.id ? 'active' : ''}" data-id="${r.id}" tabindex="0" role="button" aria-label="Xem ${r.name}">
      <div class="card-thumb">${imageTag(r)}</div>
      <div class="card-main">
        <div class="card-title-row"><h3>${r.name}</h3><span class="region-dot ${regionClass[r.region]}"></span></div>
        <div class="meta-row"><span class="meta-pill">UNESCO ${r.year}</span><span class="meta-pill">${r.currentLocation}</span></div>
        <div class="card-desc">${r.summary}</div>
      </div>
    </article>`).join('') : '<div class="empty">Không tìm thấy khu phù hợp.</div>';

  $$('.reserve-card', reserveList).forEach(card => {
    const go = () => selectReserve(card.dataset.id, true);
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}

function selectReserve(id, moveMap = false, shouldScroll = false) {
  const r = BIOSPHERES.find(x => x.id === id);
  if (!r) return;
  selectedId = id;
  renderList();
  if (moveMap) {
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 8), { duration: 1.05 });
    if (markers[id].getTooltip()) markers[id].openTooltip();
  }
  detailSection.innerHTML = detailHtml(r);
  bindDetailEvents(r);
  if (shouldScroll || (moveMap && window.innerWidth < 1050)) {
    setTimeout(() => detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
  }
}

function detailHtml(r) {
  const changedAdminIds = new Set(['red-river','kien-giang','cu-lao-cham','nui-chua','phong-nha']);
  const changed = changedAdminIds.has(r.id);
  return `
    <div class="detail-layout">
      <div class="detail-media">
        <figure class="detail-figure">
          ${imageTag(r, 'detail-image')}
          <figcaption>
            <span>Ảnh: ${imageCredit(r)}</span>
            <a href="${escapeAttr(r.image.sourceUrl)}" target="_blank" rel="noopener">${r.image.sourceName} ↗</a>
          </figcaption>
        </figure>
        <button class="video-preview" type="button" data-video-id="${r.video.id}" data-video-title="${escapeAttr(r.video.title)}">
          <img loading="lazy" src="${youtubeThumb(r.video.id)}" alt="Video ${r.name}">
          <span class="play-badge">▶</span>
          <span class="video-copy"><b>${r.video.title}</b><small>${r.video.channel}</small></span>
        </button>
      </div>

      <div class="detail-copy">
        <div class="detail-top">
          <div>
            <div class="detail-kicker">${r.unescoName.toUpperCase()}</div>
            <h2>${r.name}</h2>
            <div class="detail-location">📍 ${r.currentLocation}</div>
          </div>
          <div class="year-stamp"><b>${r.year}</b><span>UNESCO</span></div>
        </div>
        ${changed ? `<div class="admin-note">Hồ sơ UNESCO sử dụng địa danh: <b>${r.unescoLocation}</b>. Tiện ích ưu tiên hiển thị địa giới hành chính hiện nay.</div>` : ''}
        <p class="detail-summary">${r.summary}</p>
        <div class="facts">
          <div class="fact"><span>DIỆN TÍCH</span><b>${r.area}</b></div>
          <div class="fact"><span>TỌA ĐỘ THAM CHIẾU</span><b>${formatCoord(r.lat, 'N')} · ${formatCoord(r.lng, 'E')}</b></div>
          <div class="fact"><span>KIỂU CẢNH QUAN</span><b>${r.type.slice(0, 3).join(' · ')}</b></div>
        </div>
        <div class="detail-tabs" role="tablist">
          <button class="detail-tab active" data-tab="nature" type="button">🌿 Tự nhiên</button>
          <button class="detail-tab" data-tab="people" type="button">👥 Con người</button>
          <button class="detail-tab" data-tab="role" type="button">🎯 Vai trò</button>
          <button class="detail-tab" data-tab="challenge" type="button">⚠ Thách thức</button>
        </div>
        <div class="tab-panels">
          <div class="tab-panel active" data-panel="nature"><p>${r.nature}</p></div>
          <div class="tab-panel" data-panel="people"><p>${r.people}</p></div>
          <div class="tab-panel" data-panel="role"><p>${r.role}</p></div>
          <div class="tab-panel" data-panel="challenge"><p>${r.challenge}</p></div>
        </div>
        <div class="highlight-box"><b>💡 Ghi nhớ:</b> ${r.highlight}</div>
        <div class="detail-actions">
          <button class="soft-btn" type="button" data-focus-map="${r.id}">◎ Xem vị trí trên bản đồ</button>
          <a class="soft-btn" href="${r.source}" target="_blank" rel="noopener">UNESCO ↗</a>
          <a class="soft-btn" href="https://www.youtube.com/watch?v=${r.video.id}" target="_blank" rel="noopener">YouTube ↗</a>
        </div>
      </div>
    </div>`;
}

function bindDetailEvents(r) {
  $$('.detail-tab', detailSection).forEach(btn => btn.addEventListener('click', () => {
    $$('.detail-tab', detailSection).forEach(x => x.classList.toggle('active', x === btn));
    $$('.tab-panel', detailSection).forEach(panel => panel.classList.toggle('active', panel.dataset.panel === btn.dataset.tab));
  }));
  const video = $('[data-video-id]', detailSection);
  if (video) video.addEventListener('click', () => openVideoModal(r));
  const mapBtn = $('[data-focus-map]', detailSection);
  if (mapBtn) mapBtn.addEventListener('click', () => {
    $('#atlas').scrollIntoView({ behavior:'smooth', block:'start' });
    setTimeout(() => map.flyTo([r.lat,r.lng], 8, {duration:1}), 350);
  });
}

function formatCoord(n, suffix) {
  return `${Number(n).toFixed(3)}°${suffix}`;
}
function escapeAttr(s='') {
  return s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

$('#searchInput').addEventListener('input', renderList);
$('#sortSelect').addEventListener('change', renderList);
$('#environmentFilter').addEventListener('change', renderList);

// ---------------- TIMELINE ----------------
function renderTimeline() {
  const groups = BIOSPHERES.slice().sort((a,b)=>a.year-b.year).reduce((acc,r)=>{
    (acc[r.year] ||= []).push(r); return acc;
  },{});
  $('#timelineTrack').innerHTML = `<div class="timeline-inner">${Object.entries(groups).map(([year, list]) => `
    <div class="timeline-year">
      <div class="year-dot"></div>
      <b class="year-number">${year}</b>
      <div class="year-items">
        ${list.map(r=>`<button type="button" data-timeline-id="${r.id}">${r.name}</button>`).join('')}
      </div>
    </div>`).join('')}</div>`;
  $$('[data-timeline-id]').forEach(btn=>btn.addEventListener('click',()=>{
    selectReserve(btn.dataset.timelineId, true, false);
    $('#atlas').scrollIntoView({behavior:'smooth',block:'start'});
  }));
}

// ---------------- COMPARE ----------------
function initCompare() {
  const opts = BIOSPHERES.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  $('#compareA').innerHTML = opts;
  $('#compareB').innerHTML = opts;
  $('#compareA').value = 'can-gio';
  $('#compareB').value = 'langbiang';
  $('#compareBtn').addEventListener('click', renderCompare);
  $('#swapCompare').addEventListener('click', () => {
    const a = $('#compareA').value;
    $('#compareA').value = $('#compareB').value;
    $('#compareB').value = a;
    renderCompare();
  });
  renderCompare();
}
function renderCompare() {
  const a = BIOSPHERES.find(r => r.id === $('#compareA').value);
  const b = BIOSPHERES.find(r => r.id === $('#compareB').value);
  if (!a || !b) return;
  $('#compareResult').innerHTML = `
    <div class="compare-scroll"><table class="compare-table">
      <thead><tr><th>Nội dung</th><th>${a.name}</th><th>${b.name}</th></tr></thead>
      <tbody>
        <tr><td>Vị trí hiện nay</td><td>${a.currentLocation}</td><td>${b.currentLocation}</td></tr>
        <tr><td>UNESCO</td><td>${a.year}</td><td>${b.year}</td></tr>
        <tr><td>Diện tích</td><td>${a.area}</td><td>${b.area}</td></tr>
        <tr><td>Cảnh quan</td><td>${a.type.join(', ')}</td><td>${b.type.join(', ')}</td></tr>
        <tr><td>Tự nhiên</td><td>${a.nature}</td><td>${b.nature}</td></tr>
        <tr><td>Vai trò</td><td>${a.role}</td><td>${b.role}</td></tr>
        <tr><td>Thách thức</td><td>${a.challenge}</td><td>${b.challenge}</td></tr>
      </tbody>
    </table></div>`;
}

// ---------------- MEDIA ----------------
function renderMedia() {
  $('#mediaGrid').innerHTML = BIOSPHERES.map(r => `
    <article class="media-card">
      <button class="media-image-btn" type="button" data-image-id="${r.id}" aria-label="Xem ảnh lớn ${r.name}">
        ${imageTag(r)}
        <span class="media-year">${r.year}</span>
      </button>
      <div class="media-card-copy">
        <h3>${r.name}</h3>
        <p>${r.currentLocation} · ${r.type[0]}</p>
        <div class="media-buttons">
          <button type="button" data-image-id="${r.id}">🖼 Ảnh</button>
          <button type="button" data-video-reserve="${r.id}">▶ Video</button>
        </div>
      </div>
    </article>`).join('');

  $$('[data-image-id]', $('#mediaGrid')).forEach(btn => btn.addEventListener('click', () => {
    const r = BIOSPHERES.find(x => x.id === btn.dataset.imageId);
    if (r) openImageModal(r);
  }));
  $$('[data-video-reserve]', $('#mediaGrid')).forEach(btn => btn.addEventListener('click', () => {
    const r = BIOSPHERES.find(x => x.id === btn.dataset.videoReserve);
    if (r) openVideoModal(r);
  }));
}

function openImageModal(r) {
  $('#modalContent').innerHTML = `
    <div class="modal-image-wrap">
      ${imageTag(r, 'modal-image')}
      <div class="modal-caption">
        <div><h2 id="modalTitle">${r.name}</h2><p>Ảnh: ${imageCredit(r)}</p></div>
        <a href="${escapeAttr(r.image.sourceUrl)}" target="_blank" rel="noopener">Xem nguồn: ${r.image.sourceName} ↗</a>
      </div>
    </div>`;
  showModal();
}
function openVideoModal(r) {
  $('#modalContent').innerHTML = `
    <div class="modal-video-wrap">
      <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${r.video.id}?rel=0" title="${escapeAttr(r.video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
      <div class="modal-caption"><div><h2 id="modalTitle">${r.video.title}</h2><p>${r.video.channel} · ${r.name}</p></div><a href="https://www.youtube.com/watch?v=${r.video.id}" target="_blank" rel="noopener">Mở trên YouTube ↗</a></div>
    </div>`;
  showModal();
}
function showModal() {
  const modal = $('#mediaModal');
  modal.hidden = false;
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}
function closeModal() {
  const modal = $('#mediaModal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden','true');
  $('#modalContent').innerHTML = '';
  document.body.classList.remove('modal-open');
}
$$('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#mediaModal').hidden) closeModal(); });

// ---------------- MAP QUIZ ----------------
const quizState = { active:false, order:[], index:0, score:0, wrong:0, answered:false };

function shuffled(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function startQuiz() {
  quizState.active = true;
  quizState.order = shuffled(BIOSPHERES).slice(0, 8).map(r => r.id);
  quizState.index = 0;
  quizState.score = 0;
  quizState.wrong = 0;
  quizState.answered = false;
  document.body.classList.add('quiz-active');
  $('#quizHud').hidden = false;
  Object.values(markers).forEach(m => { m.closeTooltip(); m.unbindTooltip(); });
  fitVietnam();
  renderQuizQuestion();
}
function closeQuiz() {
  quizState.active = false;
  document.body.classList.remove('quiz-active');
  $('#quizHud').hidden = true;
  BIOSPHERES.forEach(bindReserveTooltip);
}
function renderQuizQuestion() {
  const total = quizState.order.length;
  if (quizState.index >= total) {
    $('#quizRound').textContent = `${total}/${total}`;
    $('#quizProgressBar').style.width = '100%';
    $('#quizQuestion').textContent = 'Hoàn thành thử thách!';
    $('#quizHint').innerHTML = `Bạn đạt <b>${quizState.score}/${total * 10} điểm</b>. Hãy thử lại để cải thiện khả năng định vị trên bản đồ.`;
    $('#quizFeedback').className = 'quiz-feedback success';
    $('#quizFeedback').textContent = quizState.score >= 70 ? 'Rất tốt! Bạn đã định hướng khá chắc trên bản đồ Việt Nam.' : 'Hãy xem lại các vị trí vừa nhầm rồi thử thêm một lượt.';
    $('#quizNext').hidden = false;
    $('#quizNext').textContent = 'Chơi lại ↻';
    $('#quizNext').onclick = startQuiz;
    return;
  }
  const r = BIOSPHERES.find(x => x.id === quizState.order[quizState.index]);
  quizState.answered = false;
  quizState.wrong = 0;
  $('#quizRound').textContent = `${quizState.index + 1}/${total}`;
  $('#quizScore').textContent = quizState.score;
  $('#quizProgressBar').style.width = `${(quizState.index / total) * 100}%`;
  $('#quizQuestion').textContent = `Hãy tìm: ${r.name}`;
  $('#quizHint').textContent = 'Bấm vào marker mà em cho là đúng.';
  $('#quizFeedback').className = 'quiz-feedback';
  $('#quizFeedback').textContent = '';
  $('#quizNext').hidden = true;
  $('#quizNext').textContent = 'Câu tiếp theo →';
  $('#quizNext').onclick = nextQuizQuestion;
}
function handleQuizAnswer(id) {
  if (!quizState.active || quizState.answered) return;
  const target = BIOSPHERES.find(x => x.id === quizState.order[quizState.index]);
  const chosen = BIOSPHERES.find(x => x.id === id);
  const markerEl = markers[id]._icon?.querySelector('.reserve-marker');
  if (id === target.id) {
    quizState.answered = true;
    const earned = Math.max(4, 10 - quizState.wrong * 2);
    quizState.score += earned;
    $('#quizScore').textContent = quizState.score;
    $('#quizFeedback').className = 'quiz-feedback success';
    $('#quizFeedback').innerHTML = `✓ Chính xác! <b>${target.name}</b> thuộc ${target.region}, hiện ở ${target.currentLocation}. +${earned} điểm.`;
    $('#quizNext').hidden = false;
    markerEl?.classList.add('quiz-correct');
    setTimeout(()=>markerEl?.classList.remove('quiz-correct'), 1100);
    map.flyTo([target.lat,target.lng], 7.4, {duration:.8});
  } else {
    quizState.wrong += 1;
    $('#quizFeedback').className = 'quiz-feedback wrong';
    $('#quizFeedback').innerHTML = `Chưa đúng. <b>${chosen.name}</b> không phải đáp án. Gợi ý: ${target.name} thuộc <b>${target.region}</b> và có cảnh quan ${target.type[0].toLowerCase()}.`;
    markerEl?.classList.add('quiz-wrong');
    setTimeout(()=>markerEl?.classList.remove('quiz-wrong'), 700);
  }
}
function nextQuizQuestion() {
  quizState.index += 1;
  fitVietnam();
  renderQuizQuestion();
}
$('#startQuizTop').addEventListener('click', () => {
  $('#atlas').scrollIntoView({behavior:'smooth', block:'start'});
  setTimeout(startQuiz, 450);
});
$('#closeQuiz').addEventListener('click', closeQuiz);

// ---------------- TOP ACTIONS ----------------
$('#startExplore').addEventListener('click', () => $('#atlas').scrollIntoView({behavior:'smooth',block:'start'}));

// ---------------- INIT ----------------
renderFilters();
renderList();
renderTimeline();
initCompare();
renderMedia();
fitVietnam();
