(() => {
  'use strict';

  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlWJPoCDiAsfhkT1avWRtmg92lprbnEQ6mzJSYDcrDwHYOJxRKzUW3Sd5llZqvg9s/exec';
  const STORAGE = {
    favorites: 'hoclieuso_favorite_terms',
    recent: 'hoclieuso_recent_terms',
    liveCache: 'hoclieuso_terms_cache_v1',
    fontSize: 'hoclieuso_term_font_size'
  };
  const ALPHABET = ['Tất cả', 'A', 'B', 'C', 'D', 'Đ', 'E', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y'];
  const ALLOWED_TAGS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SUP', 'SUB']);

  const fallbackTerms = Array.isArray(window.FALLBACK_TERMS) ? window.FALLBACK_TERMS : [];

  const state = {
    terms: normalizeTerms(fallbackTerms),
    filteredTerms: [],
    selectedTerm: null,
    searchQuery: '',
    selectedLetter: 'Tất cả',
    viewMode: 'all',
    searchInDefinition: false,
    favorites: loadStringArray(STORAGE.favorites),
    recent: loadStringArray(STORAGE.recent),
    mobileTab: 'list',
    fontSize: clamp(Number(localStorage.getItem(STORAGE.fontSize)) || 18, 14, 26),
    speaking: false,
    source: 'fallback'
  };

  const el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindElements();
    buildAlphabet();
    bindEvents();
    document.getElementById('currentYear').textContent = String(new Date().getFullYear());
    document.documentElement.classList.add('js-ready');

    const cached = readLiveCache();
    if (cached.length) {
      state.terms = cached;
      state.source = 'cache';
    }

    state.selectedTerm = chooseInitialTerm(state.terms);
    renderAll();
    loadLiveTerms();
  }

  function bindElements() {
    [
      'statusBanner', 'statusIcon', 'statusText', 'closeStatus',
      'mobileListTab', 'mobileDetailTab', 'mobileResultCount',
      'sidebarPanel', 'detailPanel', 'searchInput', 'clearSearch',
      'termCount', 'recentCount', 'favoriteCount', 'searchDefinition',
      'resetFilters', 'alphabetBar', 'termList', 'clearRecentWrap', 'clearRecent',
      'emptyDetail', 'termDetail', 'termPosition', 'dataSource',
      'decreaseFont', 'increaseFont', 'fontSizeLabel', 'speechButton',
      'copyButton', 'favoriteButton', 'shareButton', 'printButton',
      'detailTerm', 'definitionContent', 'relatedSection', 'relatedTerms',
      'prevTerm', 'nextTerm'
    ].forEach((id) => { el[id] = document.getElementById(id); });
    el.viewTabs = [...document.querySelectorAll('.view-tab')];
  }

  function bindEvents() {
    el.closeStatus.addEventListener('click', () => { el.statusBanner.hidden = true; });
    el.searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value;
      renderListArea();
    });
    el.clearSearch.addEventListener('click', () => {
      state.searchQuery = '';
      el.searchInput.value = '';
      el.searchInput.focus();
      renderListArea();
    });
    el.searchDefinition.addEventListener('change', (event) => {
      state.searchInDefinition = event.target.checked;
      renderListArea();
    });
    el.resetFilters.addEventListener('click', () => {
      state.searchQuery = '';
      state.selectedLetter = 'Tất cả';
      el.searchInput.value = '';
      renderAll();
    });
    el.viewTabs.forEach((button) => button.addEventListener('click', () => {
      state.viewMode = button.dataset.view;
      renderAll();
    }));
    el.mobileListTab.addEventListener('click', () => setMobileTab('list'));
    el.mobileDetailTab.addEventListener('click', () => setMobileTab('detail'));
    el.clearRecent.addEventListener('click', () => {
      state.recent = [];
      saveStringArray(STORAGE.recent, state.recent);
      renderAll();
    });
    el.decreaseFont.addEventListener('click', () => updateFontSize(-2));
    el.increaseFont.addEventListener('click', () => updateFontSize(2));
    el.speechButton.addEventListener('click', toggleSpeech);
    el.copyButton.addEventListener('click', copyCurrentTerm);
    el.favoriteButton.addEventListener('click', () => {
      if (state.selectedTerm) toggleFavorite(state.selectedTerm.term);
    });
    el.shareButton.addEventListener('click', shareCurrentTerm);
    el.printButton.addEventListener('click', () => window.print());
    el.prevTerm.addEventListener('click', () => navigateTerm(-1));
    el.nextTerm.addEventListener('click', () => navigateTerm(1));
    window.addEventListener('keydown', handleKeyboard);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('beforeunload', stopSpeech);
  }

  async function loadLiveTerms() {
    showStatus('loading', 'Đang đồng bộ dữ liệu thuật ngữ từ Google Sheet…', false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}${GOOGLE_SCRIPT_URL.includes('?') ? '&' : '?'}_=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rawTerms = Array.isArray(payload) ? payload : (Array.isArray(payload?.terms) ? payload.terms : []);
      const liveTerms = normalizeTerms(rawTerms);
      if (!liveTerms.length) throw new Error('Dữ liệu trả về không hợp lệ');

      state.terms = liveTerms;
      state.source = 'live';
      writeLiveCache(liveTerms);
      reconcileSelection();
      renderAll();
      showStatus('success', `Đã đồng bộ ${liveTerms.length} thuật ngữ từ Google Sheet.`, true);
    } catch (error) {
      const hasCache = state.source === 'cache' && state.terms.length > 0;
      const hasFallback = state.terms.length > 0;
      const message = hasCache
        ? `Không thể kết nối Google Sheet. Đang dùng ${state.terms.length} thuật ngữ đã lưu từ lần truy cập trước.`
        : hasFallback
          ? `Không thể kết nối Google Sheet. Đang hiển thị ${state.terms.length} thuật ngữ dự phòng có trong mã nguồn.`
          : 'Không thể tải dữ liệu thuật ngữ. Vui lòng thử lại khi có kết nối mạng.';
      showStatus('warning', message, false);
      console.warn('Không thể đồng bộ dữ liệu thuật ngữ:', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeTerms(items) {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items
      .map((item, index) => ({
        id: item?.id != null ? String(item.id) : String(index + 1),
        term: typeof item?.term === 'string' ? item.term.trim() : '',
        definition: typeof item?.definition === 'string' ? sanitizeHtml(item.definition) : ''
      }))
      .filter((item) => item.term && item.definition)
      .filter((item) => {
        const key = item.term.toLocaleUpperCase('vi');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function sanitizeHtml(html) {
    const documentFragment = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = documentFragment.body.firstElementChild;
    if (!root) return '';
    [...root.querySelectorAll('*')].forEach((node) => {
      if (!ALLOWED_TAGS.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    });
    return root.innerHTML;
  }

  function renderAll() {
    renderTabs();
    renderAlphabet();
    renderListArea();
    renderDetail();
    renderMobileTabs();
  }

  function renderTabs() {
    el.viewTabs.forEach((button) => {
      const active = button.dataset.view === state.viewMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    el.favoriteCount.textContent = String(state.favorites.length);
    el.recentCount.textContent = String(state.recent.length);
  }

  function buildAlphabet() {
    el.alphabetBar.innerHTML = '';
    ALPHABET.forEach((letter) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'alphabet-button';
      button.textContent = letter;
      button.dataset.letter = letter;
      button.addEventListener('click', () => {
        state.selectedLetter = letter;
        renderAll();
      });
      el.alphabetBar.append(button);
    });
  }

  function renderAlphabet() {
    [...el.alphabetBar.children].forEach((button) => {
      button.classList.toggle('active', button.dataset.letter === state.selectedLetter);
    });
  }

  function renderListArea() {
    state.filteredTerms = getFilteredTerms();
    el.termCount.textContent = `${state.filteredTerms.length} thuật ngữ`;
    el.mobileResultCount.textContent = String(state.filteredTerms.length);
    el.clearSearch.hidden = !state.searchQuery;
    el.resetFilters.hidden = !(state.searchQuery || state.selectedLetter !== 'Tất cả');
    el.clearRecentWrap.hidden = !(state.viewMode === 'recent' && state.recent.length > 0);
    renderTermList();
    renderTabs();
    renderDetailNavigation();
  }

  function getFilteredTerms() {
    let result = [...state.terms];
    if (state.viewMode === 'favorites') {
      result = result.filter((term) => state.favorites.includes(term.term));
    } else if (state.viewMode === 'recent') {
      const map = new Map(state.terms.map((term) => [term.term, term]));
      result = state.recent.map((name) => map.get(name)).filter(Boolean);
    }
    if (state.selectedLetter !== 'Tất cả') {
      result = result.filter((term) => firstLetterGroup(term.term) === state.selectedLetter);
    }
    const query = normalizeText(state.searchQuery.trim());
    if (query) {
      result = result.filter((term) => {
        if (normalizeText(term.term).includes(query)) return true;
        return state.searchInDefinition && normalizeText(stripHtml(term.definition)).includes(query);
      });
    }
    return result;
  }

  function renderTermList() {
    el.termList.innerHTML = '';
    if (!state.filteredTerms.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      const title = state.viewMode === 'recent' ? 'Chưa có thuật ngữ nào đã tra cứu' : state.viewMode === 'favorites' ? 'Chưa lưu thuật ngữ nào' : 'Không tìm thấy thuật ngữ phù hợp';
      const note = state.viewMode === 'recent' ? 'Khi bạn xem một thuật ngữ, nó sẽ tự động xuất hiện ở đây.' : state.viewMode === 'favorites' ? 'Nhấn biểu tượng ngôi sao để lưu thuật ngữ cần xem lại.' : 'Thử từ khóa khác hoặc chuyển bộ lọc chữ cái.';
      empty.innerHTML = `<div><div style="font-size:1.8rem;color:#d6d3d1">▤</div><b>${escapeHtml(title)}</b><p>${escapeHtml(note)}</p></div>`;
      el.termList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.filteredTerms.forEach((term) => {
      const item = document.createElement('div');
      item.className = `term-item${state.selectedTerm?.term === term.term ? ' selected' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(state.selectedTerm?.term === term.term));
      item.tabIndex = 0;

      const nameWrap = document.createElement('div');
      nameWrap.className = 'term-name-wrap';
      const dot = document.createElement('span');
      dot.className = 'term-dot';
      const name = document.createElement('span');
      name.className = 'term-name';
      name.textContent = term.term;
      nameWrap.append(dot, name);

      const star = document.createElement('button');
      star.type = 'button';
      star.className = `star-button${state.favorites.includes(term.term) ? ' active' : ''}`;
      star.textContent = state.favorites.includes(term.term) ? '★' : '☆';
      star.title = state.favorites.includes(term.term) ? 'Bỏ lưu thuật ngữ' : 'Lưu thuật ngữ này';
      star.setAttribute('aria-label', star.title);
      star.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFavorite(term.term);
      });

      const select = () => selectTerm(term);
      item.addEventListener('click', select);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
      item.append(nameWrap, star);
      fragment.append(item);
    });
    el.termList.append(fragment);
  }

  function selectTerm(term, options = {}) {
    if (!term) return;
    stopSpeech();
    state.selectedTerm = term;
    state.recent = [term.term, ...state.recent.filter((name) => name !== term.term)].slice(0, 30);
    saveStringArray(STORAGE.recent, state.recent);
    if (!options.fromHash) updateHash(term.term);
    setMobileTab('detail', false);
    renderAll();
    if (window.innerWidth < 1024 && !options.skipScroll) {
      el.detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderDetail() {
    const term = state.selectedTerm;
    el.emptyDetail.hidden = Boolean(term);
    el.termDetail.hidden = !term;
    if (!term) return;

    el.detailTerm.textContent = term.term;
    el.definitionContent.innerHTML = term.definition;
    el.definitionContent.style.fontSize = `${state.fontSize}px`;
    el.fontSizeLabel.textContent = `${state.fontSize}px`;
    el.decreaseFont.disabled = state.fontSize <= 14;
    el.increaseFont.disabled = state.fontSize >= 26;
    el.dataSource.textContent = state.source === 'live' ? 'Dữ liệu Google Sheet' : state.source === 'cache' ? 'Dữ liệu đã lưu gần nhất' : 'Dữ liệu dự phòng';
    renderFavoriteButton();
    renderRelatedTerms();
    renderDetailNavigation();
  }

  function renderDetailNavigation() {
    if (!state.selectedTerm) return;
    const index = state.filteredTerms.findIndex((term) => term.term === state.selectedTerm.term);
    el.termPosition.textContent = index >= 0 ? `Thuật ngữ #${index + 1} / ${state.filteredTerms.length}` : 'Thuật ngữ';
    el.prevTerm.disabled = index <= 0;
    el.nextTerm.disabled = index < 0 || index >= state.filteredTerms.length - 1;
  }

  function renderRelatedTerms() {
    const current = state.selectedTerm;
    if (!current) return;
    const words = normalizeText(current.term).split(/\s+/).filter((word) => word.length > 2);
    const related = state.terms
      .filter((term) => term.term !== current.term)
      .map((term) => {
        const haystack = `${normalizeText(term.term)} ${normalizeText(stripHtml(term.definition))}`;
        const score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
        return { term, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.term.term.localeCompare(b.term.term, 'vi'))
      .slice(0, 3)
      .map((item) => item.term);

    el.relatedTerms.innerHTML = '';
    el.relatedSection.hidden = related.length === 0;
    related.forEach((term) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'related-button';
      const title = document.createElement('b');
      title.textContent = term.term;
      const summary = document.createElement('span');
      summary.textContent = stripHtml(term.definition);
      button.append(title, summary);
      button.addEventListener('click', () => selectTerm(term));
      el.relatedTerms.append(button);
    });
  }

  function toggleFavorite(termName) {
    const exists = state.favorites.includes(termName);
    state.favorites = exists ? state.favorites.filter((name) => name !== termName) : [...state.favorites, termName];
    saveStringArray(STORAGE.favorites, state.favorites);
    renderAll();
  }

  function renderFavoriteButton() {
    const active = Boolean(state.selectedTerm && state.favorites.includes(state.selectedTerm.term));
    el.favoriteButton.classList.toggle('active', active);
    el.favoriteButton.innerHTML = `${active ? '★' : '☆'} <span>${active ? 'Đã lưu' : 'Lưu'}</span>`;
    el.favoriteButton.title = active ? 'Bỏ lưu thuật ngữ' : 'Lưu thuật ngữ này';
  }

  function navigateTerm(direction) {
    if (!state.selectedTerm) return;
    const index = state.filteredTerms.findIndex((term) => term.term === state.selectedTerm.term);
    const next = state.filteredTerms[index + direction];
    if (next) selectTerm(next, { skipScroll: true });
  }

  function handleKeyboard(event) {
    const tag = event.target?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') navigateTerm(1);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') navigateTerm(-1);
  }

  function updateFontSize(delta) {
    state.fontSize = clamp(state.fontSize + delta, 14, 26);
    localStorage.setItem(STORAGE.fontSize, String(state.fontSize));
    renderDetail();
  }

  async function copyCurrentTerm() {
    if (!state.selectedTerm) return;
    const text = `${state.selectedTerm.term}\n\n${stripHtml(state.selectedTerm.definition)}\n\nNguồn: 150 thuật ngữ Văn học (Lại Nguyên Ân, NXB Văn học 2017) – Tra cứu tại www.hoclieuso.id.vn`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      const original = el.copyButton.innerHTML;
      el.copyButton.innerHTML = '✓ <span>Đã chép</span>';
      setTimeout(() => { el.copyButton.innerHTML = original; }, 1800);
    } catch (error) {
      showStatus('warning', 'Trình duyệt không cho phép sao chép tự động. Vui lòng chọn và sao chép nội dung thủ công.', false);
    }
  }

  async function shareCurrentTerm() {
    if (!state.selectedTerm) return;
    const shareData = {
      title: `Thuật ngữ: ${state.selectedTerm.term}`,
      text: `${state.selectedTerm.term}: ${stripHtml(state.selectedTerm.definition).slice(0, 180)}…`,
      url: window.location.href
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) {
        if (error?.name !== 'AbortError') console.warn(error);
      }
    } else {
      await copyCurrentTerm();
    }
  }

  function toggleSpeech() {
    if (!state.selectedTerm || !('speechSynthesis' in window)) return;
    if (state.speaking) {
      stopSpeech();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(`${state.selectedTerm.term}. Khái niệm: ${stripHtml(state.selectedTerm.definition)}`);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    utterance.onend = stopSpeech;
    utterance.onerror = stopSpeech;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    state.speaking = true;
    el.speechButton.classList.add('speaking');
    el.speechButton.innerHTML = '🔇 <span>Đang đọc…</span>';
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.speaking = false;
    if (el.speechButton) {
      el.speechButton.classList.remove('speaking');
      el.speechButton.innerHTML = '🔊 <span>Đọc</span>';
    }
  }

  function setMobileTab(tab, render = true) {
    state.mobileTab = tab;
    if (render) renderMobileTabs();
    else renderMobileTabs();
  }

  function renderMobileTabs() {
    const listActive = state.mobileTab === 'list';
    el.mobileListTab.classList.toggle('active', listActive);
    el.mobileDetailTab.classList.toggle('active', !listActive);
    el.mobileListTab.setAttribute('aria-selected', String(listActive));
    el.mobileDetailTab.setAttribute('aria-selected', String(!listActive));
    el.sidebarPanel.classList.toggle('panel-hidden-mobile', !listActive);
    el.sidebarPanel.classList.toggle('panel-visible', listActive);
    el.detailPanel.classList.toggle('panel-hidden-mobile', listActive);
    el.detailPanel.classList.toggle('panel-visible', !listActive);
  }

  function chooseInitialTerm(terms) {
    const hashTerm = termFromHash(terms);
    return hashTerm || terms[0] || null;
  }

  function reconcileSelection() {
    const fromHash = termFromHash(state.terms);
    const current = state.selectedTerm ? state.terms.find((term) => term.term === state.selectedTerm.term) : null;
    state.selectedTerm = fromHash || current || state.terms[0] || null;
  }

  function handleHashChange() {
    const term = termFromHash(state.terms);
    if (term && term.term !== state.selectedTerm?.term) selectTerm(term, { fromHash: true, skipScroll: true });
  }

  function updateHash(termName) {
    const hash = `#${encodeURIComponent(termName)}`;
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
  }

  function termFromHash(terms) {
    if (!window.location.hash) return null;
    let decoded = '';
    try { decoded = decodeURIComponent(window.location.hash.slice(1)); } catch { return null; }
    return terms.find((term) => term.term === decoded) || null;
  }

  function firstLetterGroup(term) {
    const first = String(term || '').trim().charAt(0).toLocaleUpperCase('vi');
    if (first === 'Đ') return 'Đ';
    const normalized = normalizeText(first).toUpperCase();
    return /^[A-Z]$/.test(normalized) ? normalized : '#';
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function stripHtml(html) {
    const documentFragment = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return (documentFragment.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function loadStringArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    } catch { return []; }
  }

  function saveStringArray(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn(error); }
  }

  function readLiveCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE.liveCache) || 'null');
      if (!parsed || !Array.isArray(parsed.terms)) return [];
      return normalizeTerms(parsed.terms);
    } catch { return []; }
  }

  function writeLiveCache(terms) {
    try { localStorage.setItem(STORAGE.liveCache, JSON.stringify({ savedAt: Date.now(), terms })); } catch (error) { console.warn(error); }
  }

  function showStatus(type, text, autoHide) {
    el.statusBanner.className = `status-banner ${type}`;
    el.statusIcon.textContent = type === 'success' ? '✓' : type === 'loading' ? '…' : '!';
    el.statusText.textContent = text;
    el.statusBanner.hidden = false;
    if (autoHide) setTimeout(() => { el.statusBanner.hidden = true; }, 3500);
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  if ('speechSynthesis' in window) {
    window.addEventListener('DOMContentLoaded', () => { if (el.speechButton) el.speechButton.hidden = false; });
  }
})();
