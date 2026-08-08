(function () {
  'use strict';

  var config = window.TL_APP_CONFIG || {};
  purgeLegacyCaches();
  var state = {
    items: [],
    total: 0,
    hasMore: false,
    selectedId: null,
    selectedSummary: null,
    selectedDetail: null,
    related: [],
    grade: 'all',
    query: '',
    recent: normalizeRecent(readJson(config.recentKey, [])),
    mobileView: 'list',
    isSearching: false,
    isDetailLoading: false,
    searchSerial: 0,
    searchTimer: null,
    autoRetryTimer: null,
    searchController: null,
    detailController: null,
    detailCache: new Map(),
    lastAction: { type: 'search' },
    clientId: getClientId(),
    limit: clampNumber(config.searchLimit, 1, 40, 36)
  };

  var els = {
    appShell: byId('appShell'),
    statusBanner: byId('statusBanner'),
    statusText: byId('statusText'),
    retryButton: byId('retryButton'),
    closeStatusButton: byId('closeStatusButton'),
    gradeFilter: byId('gradeFilter'),
    searchInput: byId('searchInput'),
    clearSearchButton: byId('clearSearchButton'),
    resultCount: byId('resultCount'),
    mobileCount: byId('mobileCount'),
    termList: byId('termList'),
    loadMoreButton: byId('loadMoreButton'),
    recentSection: byId('recentSection'),
    recentList: byId('recentList'),
    clearRecentButton: byId('clearRecentButton'),
    listTab: byId('listTab'),
    detailTab: byId('detailTab'),
    listPanel: byId('listPanel'),
    detailPanel: byId('detailPanel'),
    emptyDetail: byId('emptyDetail'),
    termDetail: byId('termDetail'),
    termTitle: byId('termTitle'),
    gradeBadge: byId('gradeBadge'),
    positionBadge: byId('positionBadge'),
    definitionContent: byId('definitionContent'),
    exampleContent: byId('exampleContent'),
    exampleSection: byId('exampleSection'),
    relatedSection: byId('relatedSection'),
    relatedGrid: byId('relatedGrid'),
    detailScroll: byId('detailScroll'),
    previousButton: byId('previousButton'),
    nextButton: byId('nextButton'),
    copyButton: byId('copyButton'),
    printButton: byId('printButton'),
    fullscreenButton: byId('fullscreenButton'),
    fullscreenText: byId('fullscreenText')
  };

  bindEvents();
  renderRecent();
  searchTerms({ reset: true, allowAutoRetry: true });

  function byId(id) {
    return document.getElementById(id);
  }

  function bindEvents() {
    els.gradeFilter.addEventListener('click', function (event) {
      var button = event.target.closest('[data-grade]');
      if (!button) return;
      state.grade = button.getAttribute('data-grade') || 'all';
      els.gradeFilter.querySelectorAll('.grade-button').forEach(function (item) {
        item.classList.toggle('active', item === button);
      });
      scheduleSearch(true);
    });

    els.searchInput.addEventListener('input', function () {
      var nextQuery = els.searchInput.value.slice(0, 100).trim();
      if (els.searchInput.value.length > 100) els.searchInput.value = els.searchInput.value.slice(0, 100);
      state.query = nextQuery;
      els.clearSearchButton.hidden = !state.query;
      scheduleSearch(false);
    });

    els.clearSearchButton.addEventListener('click', function () {
      els.searchInput.value = '';
      state.query = '';
      els.clearSearchButton.hidden = true;
      scheduleSearch(true);
      els.searchInput.focus();
    });

    els.loadMoreButton.addEventListener('click', function () {
      searchTerms({ reset: false });
    });

    els.retryButton.addEventListener('click', retryLastAction);
    els.closeStatusButton.addEventListener('click', function () {
      els.statusBanner.hidden = true;
    });

    els.listTab.addEventListener('click', function () { setMobileView('list'); });
    els.detailTab.addEventListener('click', function () { setMobileView('detail'); });

    els.clearRecentButton.addEventListener('click', function () {
      state.recent = [];
      writeJson(config.recentKey, state.recent);
      renderRecent();
    });

    els.previousButton.addEventListener('click', function () { moveSelection(-1); });
    els.nextButton.addEventListener('click', function () { moveSelection(1); });
    els.copyButton.addEventListener('click', copyCurrentTerm);
    els.printButton.addEventListener('click', function () { window.print(); });
    els.fullscreenButton.addEventListener('click', toggleFullscreen);

    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('keydown', function (event) {
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === 'ArrowLeft') moveSelection(-1);
      if (event.key === 'ArrowRight') moveSelection(1);
    });

    window.addEventListener('online', function () {
      if (!state.items.length) searchTerms({ reset: true, allowAutoRetry: false });
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 820) {
        els.listPanel.classList.add('panel-visible');
        els.listPanel.classList.remove('panel-hidden-mobile');
        els.detailPanel.classList.add('panel-visible');
        els.detailPanel.classList.remove('panel-hidden-mobile');
      } else {
        setMobileView(state.mobileView);
      }
    });
  }

  function scheduleSearch(immediate) {
    if (state.searchTimer) clearTimeout(state.searchTimer);
    var delay = immediate ? 0 : clampNumber(config.searchDelay, 100, 1000, 300);
    state.searchTimer = setTimeout(function () {
      searchTerms({ reset: true, allowAutoRetry: false });
    }, delay);
  }

  async function searchTerms(options) {
    options = options || {};
    var reset = options.reset !== false;
    if (!reset && (state.isSearching || !state.hasMore)) return;

    if (state.autoRetryTimer) {
      clearTimeout(state.autoRetryTimer);
      state.autoRetryTimer = null;
    }
    if (reset && state.searchController) state.searchController.abort();

    var serial = ++state.searchSerial;
    var controller = new AbortController();
    state.searchController = controller;
    state.isSearching = true;
    state.lastAction = { type: 'search' };
    els.termList.setAttribute('aria-busy', 'true');
    els.loadMoreButton.disabled = true;

    if (reset) {
      state.items = [];
      state.total = 0;
      state.hasMore = false;
      renderList();
      updateCounts();
    }

    setStatus('loading', reset ? 'Đang tìm thuật ngữ...' : 'Đang tải thêm thuật ngữ...', false);

    try {
      var offset = reset ? 0 : state.items.length;
      var params = new URLSearchParams();
      if (state.query) params.set('q', state.query);
      if (state.grade !== 'all') params.set('grade', state.grade);
      params.set('offset', String(offset));
      params.set('limit', String(state.limit));

      var payload = await apiRequest('/api/terms?' + params.toString(), controller);
      if (serial !== state.searchSerial) return;
      var result = normalizeSearchResponse(payload);
      state.items = reset ? result.items : mergeSummaries(state.items, result.items);
      state.total = Math.max(result.total, state.items.length);
      state.hasMore = result.hasMore && state.items.length < state.total;
      state.isSearching = false;

      renderList();
      updateCounts();
      renderRecent();
      updateNavigation();
      setStatus('success', state.total ? 'Tìm thấy ' + state.total + ' thuật ngữ.' : 'Không có thuật ngữ phù hợp.', false);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (serial !== state.searchSerial) return;
      state.isSearching = false;
      console.warn('Không tải được danh sách thuật ngữ:', safeErrorMessage(error));
      renderList();
      updateCounts();
      setStatus('error', userFacingError(error, 'Chưa thể kết nối dữ liệu.'), true);

      if (options.allowAutoRetry && navigator.onLine !== false) {
        state.autoRetryTimer = setTimeout(function () {
          searchTerms({ reset: true, allowAutoRetry: false });
        }, 5000);
      }
    } finally {
      if (serial === state.searchSerial) {
        state.isSearching = false;
        els.termList.setAttribute('aria-busy', 'false');
        els.loadMoreButton.disabled = false;
        updateLoadMoreButton();
      }
    }
  }

  async function selectTerm(id, switchToDetail, summary, forceReload) {
    if (!isSafeId(id)) return;
    var selectedSummary = normalizeSummary(summary) || state.items.find(function (item) { return item.id === id; }) || { id: id, term: 'Thuật ngữ', grade: '' };

    state.selectedId = id;
    state.selectedSummary = selectedSummary;
    state.lastAction = { type: 'detail', id: id, summary: selectedSummary };
    renderList();
    updateNavigation();
    showDetailLoading(selectedSummary);
    if (switchToDetail && window.innerWidth <= 820) setMobileView('detail');

    if (!forceReload && state.detailCache.has(id)) {
      var cached = state.detailCache.get(id);
      state.detailCache.delete(id);
      state.detailCache.set(id, cached);
      renderDetailPayload(cached);
      return;
    }

    if (state.detailController) state.detailController.abort();
    var controller = new AbortController();
    state.detailController = controller;
    state.isDetailLoading = true;

    try {
      var payload = await apiRequest('/api/terms/' + encodeURIComponent(id), controller);
      if (state.selectedId !== id) return;
      var result = normalizeDetailResponse(payload);
      cacheDetail(id, result);
      renderDetailPayload(result);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (state.selectedId !== id) return;
      console.warn('Không tải được nội dung thuật ngữ:', safeErrorMessage(error));
      els.definitionContent.textContent = 'Chưa thể tải nội dung. Vui lòng thử lại.';
      els.exampleSection.hidden = true;
      setStatus('error', userFacingError(error, 'Chưa thể tải nội dung thuật ngữ.'), true);
    } finally {
      if (state.selectedId === id) state.isDetailLoading = false;
    }
  }

  function showDetailLoading(summary) {
    state.selectedDetail = null;
    state.related = [];
    els.emptyDetail.hidden = true;
    els.termDetail.hidden = false;
    els.termTitle.textContent = summary.term || 'Thuật ngữ';
    els.definitionContent.textContent = 'Đang tải nội dung...';
    els.exampleSection.hidden = true;
    els.relatedSection.hidden = true;
    if (summary.grade) {
      els.gradeBadge.textContent = formatGrade(summary.grade);
      els.gradeBadge.hidden = false;
    } else {
      els.gradeBadge.hidden = true;
    }
    els.detailScroll.scrollTop = 0;
  }

  function renderDetailPayload(payload) {
    var item = payload.item;
    state.selectedDetail = item;
    state.selectedSummary = { id: item.id, term: item.term, grade: item.grade };
    state.related = payload.related;

    els.emptyDetail.hidden = true;
    els.termDetail.hidden = false;
    els.termTitle.textContent = item.term;
    els.definitionContent.innerHTML = sanitizeHtml(item.definition);

    els.exampleSection.hidden = false;
    if (item.example) els.exampleContent.innerHTML = sanitizeHtml(item.example);
    else els.exampleContent.innerHTML = '<em>(Chưa có ví dụ minh họa)</em>';

    if (item.grade) {
      els.gradeBadge.textContent = formatGrade(item.grade);
      els.gradeBadge.hidden = false;
    } else {
      els.gradeBadge.hidden = true;
    }

    renderRelated(payload.related);
    addRecent(state.selectedSummary);
    updateNavigation();
    els.detailScroll.scrollTop = 0;
  }

  function renderList() {
    els.termList.textContent = '';
    if (!state.items.length) {
      var empty = document.createElement('div');
      empty.className = 'no-results';
      var wrapper = document.createElement('div');
      var title = document.createElement('b');
      var copy = document.createElement('p');
      title.textContent = state.isSearching ? 'Đang tải dữ liệu...' : 'Không có kết quả phù hợp.';
      copy.textContent = state.isSearching ? 'Vui lòng chờ trong giây lát.' : 'Thử đổi từ khóa hoặc chọn một lớp khác.';
      wrapper.appendChild(title);
      wrapper.appendChild(copy);
      empty.appendChild(wrapper);
      els.termList.appendChild(empty);
      updateLoadMoreButton();
      return;
    }

    var fragment = document.createDocumentFragment();
    state.items.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'term-item' + (item.id === state.selectedId ? ' active' : '');
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', item.id === state.selectedId ? 'true' : 'false');
      button.dataset.id = item.id;
      var name = document.createElement('span');
      name.className = 'term-name';
      name.textContent = item.term;
      button.appendChild(name);
      button.addEventListener('click', function () { selectTerm(item.id, true, item, false); });
      fragment.appendChild(button);
    });
    els.termList.appendChild(fragment);
    updateLoadMoreButton();
  }

  function renderRelated(related) {
    els.relatedGrid.textContent = '';
    els.relatedSection.hidden = !related.length;
    related.forEach(function (candidate) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'related-button';
      var title = document.createElement('b');
      title.textContent = candidate.term;
      var subtitle = document.createElement('span');
      subtitle.textContent = candidate.grade ? formatGrade(candidate.grade) : 'Thuật ngữ liên quan';
      button.appendChild(title);
      button.appendChild(subtitle);
      button.addEventListener('click', function () { selectTerm(candidate.id, true, candidate, false); });
      els.relatedGrid.appendChild(button);
    });
  }

  function addRecent(summary) {
    var item = normalizeSummary(summary);
    if (!item) return;
    state.recent = state.recent.filter(function (recent) { return recent.id !== item.id; });
    state.recent.unshift(item);
    state.recent = state.recent.slice(0, 6);
    writeJson(config.recentKey, state.recent);
    renderRecent();
  }

  function renderRecent() {
    els.recentList.textContent = '';
    els.recentSection.hidden = !state.recent.length;
    els.clearRecentButton.hidden = !state.recent.length;
    state.recent.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-button';
      button.textContent = item.term;
      button.title = item.term;
      button.addEventListener('click', function () { selectTerm(item.id, true, item, false); });
      els.recentList.appendChild(button);
    });
  }

  function updateCounts() {
    els.resultCount.textContent = state.total;
    els.mobileCount.textContent = state.total;
    updateLoadMoreButton();
  }

  function updateLoadMoreButton() {
    els.loadMoreButton.hidden = !state.hasMore || !state.items.length;
    els.loadMoreButton.textContent = state.isSearching
      ? 'Đang tải...'
      : 'Xem thêm (' + state.items.length + ' / ' + state.total + ')';
  }

  function updateNavigation() {
    var index = state.items.findIndex(function (item) { return item.id === state.selectedId; });
    if (index < 0) {
      els.positionBadge.textContent = state.total ? '– / ' + state.total : '0 / 0';
      els.previousButton.disabled = true;
      els.nextButton.disabled = true;
      return;
    }
    els.positionBadge.textContent = (index + 1) + ' / ' + state.total;
    els.previousButton.disabled = index <= 0;
    els.nextButton.disabled = index >= state.items.length - 1 && !state.hasMore;
  }

  async function moveSelection(direction) {
    if (!state.items.length || state.isDetailLoading) return;
    var index = state.items.findIndex(function (item) { return item.id === state.selectedId; });
    if (index < 0) index = direction > 0 ? -1 : state.items.length;
    var nextIndex = index + direction;

    if (direction > 0 && nextIndex >= state.items.length && state.hasMore) {
      var previousLength = state.items.length;
      await searchTerms({ reset: false });
      if (state.items.length > previousLength) nextIndex = previousLength;
    }

    if (nextIndex < 0 || nextIndex >= state.items.length) return;
    var next = state.items[nextIndex];
    selectTerm(next.id, true, next, false);
  }

  function setMobileView(view) {
    state.mobileView = view === 'detail' ? 'detail' : 'list';
    var showList = state.mobileView === 'list';
    els.listTab.classList.toggle('active', showList);
    els.detailTab.classList.toggle('active', !showList);
    els.listTab.setAttribute('aria-selected', showList ? 'true' : 'false');
    els.detailTab.setAttribute('aria-selected', showList ? 'false' : 'true');
    els.listPanel.classList.toggle('panel-visible', showList);
    els.listPanel.classList.toggle('panel-hidden-mobile', !showList);
    els.detailPanel.classList.toggle('panel-visible', !showList);
    els.detailPanel.classList.toggle('panel-hidden-mobile', showList);
  }

  async function copyCurrentTerm() {
    var item = state.selectedDetail;
    if (!item) return;
    var text = item.term + '\n\nGiải thích:\n' + stripHtml(item.definition);
    if (item.example) text += '\n\nVí dụ:\n' + stripHtml(item.example);
    if (item.grade) text += '\n\n' + formatGrade(item.grade);

    try {
      await navigator.clipboard.writeText(text);
      showCopied();
    } catch (error) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showCopied();
    }
  }

  function showCopied() {
    var original = els.copyButton.innerHTML;
    els.copyButton.classList.add('copied');
    els.copyButton.innerHTML = '<span aria-hidden="true">✓</span><span>Đã chép</span>';
    setTimeout(function () {
      els.copyButton.classList.remove('copied');
      els.copyButton.innerHTML = original;
    }, 1400);
  }

  function toggleFullscreen() {
    var fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fullscreenElement) {
      var request = els.appShell.requestFullscreen || els.appShell.webkitRequestFullscreen;
      if (request) request.call(els.appShell);
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  }

  function updateFullscreenButton() {
    var active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    els.fullscreenText.textContent = active ? 'Thoát toàn màn hình' : 'Toàn màn hình';
  }

  function retryLastAction() {
    if (state.lastAction && state.lastAction.type === 'detail') {
      selectTerm(state.lastAction.id, true, state.lastAction.summary, true);
      return;
    }
    searchTerms({ reset: true, allowAutoRetry: false });
  }

  async function apiRequest(path, controller) {
    var base = String(config.apiBaseUrl || '').replace(/\/+$/, '');
    if (!/^https:\/\//i.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)) {
      throw new Error('CONFIG_ERROR');
    }

    var timeout = clampNumber(config.requestTimeout, 2000, 20000, 9000);
    var timer = setTimeout(function () { controller.abort(); }, timeout);
    try {
      var response = await fetch(base + path, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          'X-TL-Client': state.clientId
        },
        signal: controller.signal
      });

      var payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw createHttpError(response.status, 'INVALID_RESPONSE');
      }

      if (!response.ok || !payload || payload.success !== true) {
        throw createHttpError(response.status, payload && payload.code ? payload.code : 'REQUEST_FAILED');
      }
      return payload.data;
    } finally {
      clearTimeout(timer);
    }
  }

  function createHttpError(status, code) {
    var error = new Error(code || 'REQUEST_FAILED');
    error.status = Number(status) || 0;
    error.code = code || 'REQUEST_FAILED';
    return error;
  }

  function userFacingError(error, fallback) {
    if (error && error.code === 'CONFIG_ERROR') return 'Chưa cấu hình địa chỉ API bảo mật.';
    if (error && error.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.';
    if (error && error.status === 404) return 'Không tìm thấy thuật ngữ này.';
    if (navigator.onLine === false) return 'Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng.';
    return fallback;
  }

  function safeErrorMessage(error) {
    return error && error.message ? String(error.message).slice(0, 120) : 'Unknown error';
  }

  function normalizeSearchResponse(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) throw new Error('INVALID_RESPONSE');
    var items = value.items.map(normalizeSummary).filter(Boolean);
    return {
      items: mergeSummaries([], items),
      total: clampNumber(value.total, 0, 100000, items.length),
      hasMore: Boolean(value.hasMore)
    };
  }

  function normalizeDetailResponse(value) {
    if (!value || typeof value !== 'object') throw new Error('INVALID_RESPONSE');
    var item = normalizeDetail(value.item);
    if (!item) throw new Error('INVALID_RESPONSE');
    var related = Array.isArray(value.related) ? value.related.map(normalizeSummary).filter(Boolean) : [];
    return { item: item, related: mergeSummaries([], related).slice(0, 4) };
  }

  function normalizeSummary(value) {
    if (!value || typeof value !== 'object') return null;
    var id = String(value.id || '').trim();
    var term = String(value.term || '').trim().slice(0, 200);
    var grade = String(value.grade || '').trim().slice(0, 80);
    if (!isSafeId(id) || !term) return null;
    return { id: id, term: term, grade: grade };
  }

  function normalizeDetail(value) {
    var summary = normalizeSummary(value);
    if (!summary) return null;
    return {
      id: summary.id,
      term: summary.term,
      grade: summary.grade,
      definition: String(value.definition || '').slice(0, 25000),
      example: String(value.example || '').slice(0, 15000)
    };
  }

  function mergeSummaries(existing, incoming) {
    var seen = new Set();
    return existing.concat(incoming).filter(function (item) {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function cacheDetail(id, payload) {
    if (state.detailCache.has(id)) state.detailCache.delete(id);
    state.detailCache.set(id, payload);
    var max = clampNumber(config.detailCacheLimit, 1, 30, 12);
    while (state.detailCache.size > max) {
      var oldest = state.detailCache.keys().next().value;
      state.detailCache.delete(oldest);
    }
  }

  function normalizeRecent(value) {
    if (!Array.isArray(value)) return [];
    return mergeSummaries([], value.map(normalizeSummary).filter(Boolean)).slice(0, 6);
  }

  function isSafeId(value) {
    return /^[A-Za-z0-9_-]{6,100}$/.test(String(value || ''));
  }

  function formatGrade(grade) {
    var text = String(grade || '').trim();
    if (!text) return '';
    if (/lớp|khối/i.test(text)) return text;
    return 'Lớp ' + text;
  }

  function setStatus(type, text, showRetry) {
    els.statusBanner.hidden = false;
    els.statusBanner.className = 'status-banner ' + type;
    els.statusText.textContent = text;
    els.retryButton.hidden = !showRetry;
    var icon = els.statusBanner.querySelector('.status-icon');
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '!' : '↻';
  }

  function sanitizeHtml(value) {
    var source = String(value || '');
    var sourceHasHtml = /<[a-z][\s\S]*>/i.test(source);
    if (!sourceHasHtml) {
      var plain = source.trim() || '(Chưa có nội dung)';
      return '<p>' + escapeHtml(plain).replace(/\n/g, '<br>') + '</p>';
    }

    var template = document.createElement('template');
    template.innerHTML = source;
    var allowed = ['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SUB', 'SUP', 'SPAN', 'A'];
    var nodes = Array.prototype.slice.call(template.content.querySelectorAll('*'));
    nodes.forEach(function (node) {
      if (allowed.indexOf(node.tagName) < 0) {
        node.replaceWith(document.createTextNode(node.textContent || ''));
        return;
      }
      Array.prototype.slice.call(node.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase();
        var keepHref = node.tagName === 'A' && name === 'href';
        var keepTitle = node.tagName === 'A' && name === 'title';
        if (!keepHref && !keepTitle) node.removeAttribute(attribute.name);
      });
      if (node.tagName === 'A') {
        var href = node.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) node.removeAttribute('href');
        else {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });
    var html = template.innerHTML.trim();
    return html || '<p>(Chưa có nội dung)</p>';
  }

  function stripHtml(value) {
    var div = document.createElement('div');
    div.innerHTML = sanitizeHtml(value);
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }

  function getClientId() {
    var key = String(config.sessionKey || 'tl_session_v1');
    try {
      var existing = sessionStorage.getItem(key);
      if (/^[A-Za-z0-9_-]{20,80}$/.test(existing || '')) return existing;
      var bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      var generated = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
      sessionStorage.setItem(key, generated);
      return generated;
    } catch (error) {
      return 'fallback_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 18);
    }
  }

  function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(number)));
  }

  function readJson(key, fallback) {
    if (!key) return fallback;
    try {
      var value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* Không lưu được lịch sử xem. */ }
  }

  function purgeLegacyCaches() {
    var keys = Array.isArray(config.legacyCacheKeys) ? config.legacyCacheKeys : [];
    keys.forEach(function (key) {
      try { localStorage.removeItem(String(key)); } catch (error) { /* Trình duyệt chặn bộ nhớ cục bộ. */ }
    });
  }
})();
