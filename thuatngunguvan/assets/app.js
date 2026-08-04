(function () {
  'use strict';

  var config = window.TL_APP_CONFIG || {};
  var state = {
    data: [],
    filtered: [],
    selectedId: null,
    grade: 'all',
    query: '',
    recent: readJson(config.recentKey, []),
    mobileView: 'list',
    isLoading: false,
    autoRetryTimer: null
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
  loadData({ allowAutoRetry: true });

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
      applyFilters();
    });

    els.searchInput.addEventListener('input', function () {
      state.query = els.searchInput.value.trim();
      els.clearSearchButton.hidden = !state.query;
      applyFilters();
    });

    els.clearSearchButton.addEventListener('click', function () {
      els.searchInput.value = '';
      state.query = '';
      els.clearSearchButton.hidden = true;
      applyFilters();
      els.searchInput.focus();
    });

    els.retryButton.addEventListener('click', loadData);
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
      loadData({ silent: Boolean(state.data.length), allowAutoRetry: false });
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

  async function loadData(options) {
    options = options || {};
    if (state.isLoading) return;
    state.isLoading = true;

    if (state.autoRetryTimer) {
      clearTimeout(state.autoRetryTimer);
      state.autoRetryTimer = null;
    }

    var cached = readJson(config.cacheKey, null);
    var hasUsableCache = cached && Array.isArray(cached.data) && cached.data.length;

    // Hiển thị dữ liệu đã lưu ngay lập tức, không bắt người dùng chờ mạng.
    if (!state.data.length && hasUsableCache) {
      state.data = cached.data.map(function (item, index) {
        item.id = index;
        item.grades = Array.isArray(item.grades) ? item.grades : extractGrades(item.grade);
        return item;
      });
      renderRecent();
      applyFilters();
    }

    if (!options.silent) {
      setStatus('loading', hasUsableCache ? 'Đang cập nhật dữ liệu...' : 'Đang tải dữ liệu...', false);
    }
    els.retryButton.hidden = true;

    try {
      var payload = await loadRemotePayload(config.apiUrl, Number(config.requestTimeout) || 7000);
      var terms = normalizePayload(payload);
      if (!terms.length) throw new Error('Dữ liệu không có thuật ngữ hợp lệ.');

      state.data = terms.sort(function (a, b) {
        return a.term.localeCompare(b.term, 'vi', { sensitivity: 'base' });
      }).map(function (item, index) {
        item.id = index;
        return item;
      });

      writeJson(config.cacheKey, {
        savedAt: new Date().toISOString(),
        data: state.data
      });

      setStatus('success', 'Đã tải ' + state.data.length + ' thuật ngữ.', false);
      renderRecent();
      applyFilters();
    } catch (error) {
      console.warn('Không tải được dữ liệu trực tuyến:', error);

      if (state.data.length || hasUsableCache) {
        setStatus('error', 'Chưa thể cập nhật dữ liệu. Đang dùng dữ liệu đã lưu.', true);
        renderRecent();
        applyFilters();
      } else {
        state.data = [];
        state.filtered = [];
        setStatus('error', 'Chưa thể kết nối dữ liệu.', true);
        renderList();
      }

      if (options.allowAutoRetry !== false && navigator.onLine !== false) {
        state.autoRetryTimer = setTimeout(function () {
          loadData({ silent: Boolean(state.data.length), allowAutoRetry: false });
        }, Number(config.autoRetryDelay) || 5000);
      }
    } finally {
      state.isLoading = false;
    }
  }

  async function loadRemotePayload(url, timeout) {
    if (!url) throw new Error('Chưa cấu hình địa chỉ dữ liệu.');

    // Apps Script Content Service chuyển hướng qua googleusercontent.com.
    // JSONP là đường chính; fetch chạy song song làm phương án dự phòng cho API JSON thuần.
    try {
      return await firstSuccessful([
        jsonpPayload(url, 'prefix', timeout),
        delayedAttempt(function () { return fetchPayload(url, timeout); }, 700)
      ]);
    } catch (primaryError) {
      try {
        return await jsonpPayload(url, 'callback', Math.min(timeout, 5000));
      } catch (callbackError) {
        throw callbackError || primaryError;
      }
    }
  }

  function firstSuccessful(promises) {
    return new Promise(function (resolve, reject) {
      var pending = promises.length;
      var errors = [];
      if (!pending) {
        reject(new Error('Không có phương thức tải dữ liệu.'));
        return;
      }
      promises.forEach(function (promise, index) {
        Promise.resolve(promise).then(resolve).catch(function (error) {
          errors[index] = error;
          pending -= 1;
          if (pending === 0) reject(errors[errors.length - 1] || new Error('Không thể tải dữ liệu.'));
        });
      });
    });
  }

  function delayedAttempt(factory, delay) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        Promise.resolve().then(factory).then(resolve).catch(reject);
      }, delay);
    });
  }

  async function fetchPayload(url, timeout) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, timeout);

    try {
      var response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
        redirect: 'follow',
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var text = await response.text();
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error('Dữ liệu trả về không phải JSON hợp lệ.');
      }
    } finally {
      clearTimeout(timer);
    }
  }

  function jsonpPayload(url, parameterName, timeout) {
    return new Promise(function (resolve, reject) {
      var callbackName = '__tlCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = document.createElement('script');
      var completed = false;
      var timer;

      function cleanup() {
        clearTimeout(timer);
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
      }

      window[callbackName] = function (payload) {
        if (completed) return;
        completed = true;
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        if (completed) return;
        completed = true;
        cleanup();
        reject(new Error('Không tải được JSONP.'));
      };

      timer = setTimeout(function () {
        if (completed) return;
        completed = true;
        cleanup();
        reject(new Error('JSONP quá thời gian chờ.'));
      }, timeout);

      var separator = url.indexOf('?') >= 0 ? '&' : '?';
      script.src = url + separator + encodeURIComponent(parameterName) + '=' + encodeURIComponent(callbackName);
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function normalizePayload(payload) {
    if (payload && payload.success === false) {
      throw new Error(payload.error || 'Nguồn dữ liệu báo lỗi.');
    }

    var rows = payload;
    if (payload && !Array.isArray(payload) && typeof payload === 'object') {
      rows = payload.terms || payload.data || payload.rows || payload.values || [];
    }
    if (!Array.isArray(rows)) return [];
    if (!rows.length) return [];

    if (Array.isArray(rows[0])) return normalizeArrayRows(rows);
    if (rows[0] && typeof rows[0] === 'object') return normalizeObjectRows(rows);
    return [];
  }

  function normalizeArrayRows(rows) {
    var first = rows[0] || [];
    var headerKeys = first.map(normalizeKey);
    var hasHeader = headerKeys.some(function (key) {
      return key.indexOf('thuatngu') >= 0 || key === 'tu' || key.indexOf('giaithich') >= 0 || key.indexOf('vidu') >= 0;
    });
    var startIndex = hasHeader ? 1 : 0;
    var indexes = {
      term: findHeaderIndex(headerKeys, ['thuatngu', 'tu', 'khainiem', 'ten']),
      definition: findHeaderIndex(headerKeys, ['giaithich', 'noidung', 'nghia', 'dinhnghia']),
      grade: findHeaderIndex(headerKeys, ['lop', 'khoi', 'grade']),
      example: findHeaderIndex(headerKeys, ['vidu', 'minhhoa', 'example'])
    };
    if (indexes.term < 0) indexes.term = 0;
    if (indexes.definition < 0) indexes.definition = 1;
    if (indexes.grade < 0) indexes.grade = 2;
    if (indexes.example < 0) indexes.example = 3;

    return rows.slice(startIndex).map(function (row) {
      return createTerm(
        row[indexes.term],
        row[indexes.definition],
        row[indexes.grade],
        row[indexes.example]
      );
    }).filter(Boolean);
  }

  function normalizeObjectRows(rows) {
    return rows.map(function (row) {
      var map = {};
      Object.keys(row).forEach(function (key) {
        map[normalizeKey(key)] = row[key];
      });
      return createTerm(
        pickValue(map, ['term', 'thuatngu', 'tu', 'khainiem', 'ten']),
        pickValue(map, ['definition', 'giaithich', 'noidung', 'nghia', 'dinhnghia']),
        pickValue(map, ['grade', 'lop', 'khoi']),
        pickValue(map, ['example', 'vidu', 'minhhoa'])
      );
    }).filter(Boolean);
  }

  function createTerm(term, definition, grade, example) {
    var cleanTerm = String(term == null ? '' : term).trim();
    if (!cleanTerm) return null;
    var cleanDefinition = String(definition == null ? '' : definition).trim();
    var cleanGrade = String(grade == null ? '' : grade).trim();
    var cleanExample = String(example == null ? '' : example).trim();
    return {
      term: cleanTerm,
      definition: cleanDefinition || '(Chưa có nội dung)',
      grade: cleanGrade,
      grades: extractGrades(cleanGrade),
      example: cleanExample
    };
  }

  function findHeaderIndex(keys, candidates) {
    for (var i = 0; i < keys.length; i += 1) {
      for (var j = 0; j < candidates.length; j += 1) {
        if (keys[i] === candidates[j] || keys[i].indexOf(candidates[j]) >= 0) return i;
      }
    }
    return -1;
  }

  function pickValue(map, candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(map, candidates[i])) return map[candidates[i]];
    }
    var keys = Object.keys(map);
    for (var j = 0; j < keys.length; j += 1) {
      for (var k = 0; k < candidates.length; k += 1) {
        if (keys[j].indexOf(candidates[k]) >= 0) return map[keys[j]];
      }
    }
    return '';
  }

  function extractGrades(value) {
    var matches = String(value || '').match(/(?:^|\D)(6|7|8|9|10|11|12)(?=\D|$)/g) || [];
    return matches.map(function (match) {
      var number = match.match(/6|7|8|9|10|11|12/);
      return number ? number[0] : '';
    }).filter(function (grade, index, list) {
      return grade && list.indexOf(grade) === index;
    });
  }

  function normalizeKey(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  function applyFilters() {
    var query = normalizeText(state.query);
    state.filtered = state.data.filter(function (item) {
      var gradeMatch = state.grade === 'all' || item.grades.indexOf(state.grade) >= 0 || normalizeText(item.grade).indexOf('lop ' + state.grade) >= 0;
      if (!gradeMatch) return false;
      if (!query) return true;
      return normalizeText(item.term).indexOf(query) >= 0 ||
        normalizeText(stripHtml(item.definition)).indexOf(query) >= 0 ||
        normalizeText(stripHtml(item.example)).indexOf(query) >= 0;
    });

    els.resultCount.textContent = state.filtered.length;
    els.mobileCount.textContent = state.filtered.length;
    renderList();
    updateNavigation();
  }

  function renderList() {
    els.termList.innerHTML = '';
    if (!state.filtered.length) {
      var empty = document.createElement('div');
      empty.className = 'no-results';
      empty.innerHTML = '<div><b>Không có kết quả phù hợp.</b><p>Thử đổi từ khóa hoặc chọn một lớp khác.</p></div>';
      els.termList.appendChild(empty);
      return;
    }

    var fragment = document.createDocumentFragment();
    state.filtered.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'term-item' + (item.id === state.selectedId ? ' active' : '');
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', item.id === state.selectedId ? 'true' : 'false');
      button.dataset.id = String(item.id);
      var name = document.createElement('span');
      name.className = 'term-name';
      name.textContent = item.term;
      button.appendChild(name);
      button.addEventListener('click', function () { selectTerm(item.id, true); });
      fragment.appendChild(button);
    });
    els.termList.appendChild(fragment);
  }

  function selectTerm(id, switchToDetail) {
    var item = state.data.find(function (term) { return term.id === id; });
    if (!item) return;
    state.selectedId = id;
    renderList();

    els.emptyDetail.hidden = true;
    els.termDetail.hidden = false;
    els.termTitle.textContent = item.term;
    els.definitionContent.innerHTML = sanitizeHtml(item.definition);

    if (item.example) {
      els.exampleSection.hidden = false;
      els.exampleContent.innerHTML = sanitizeHtml(item.example);
    } else {
      els.exampleSection.hidden = false;
      els.exampleContent.innerHTML = '<em>(Chưa có ví dụ minh họa)</em>';
    }

    if (item.grade) {
      els.gradeBadge.textContent = formatGrade(item.grade);
      els.gradeBadge.hidden = false;
    } else {
      els.gradeBadge.hidden = true;
    }

    renderRelated(item);
    addRecent(item);
    updateNavigation();
    els.detailScroll.scrollTop = 0;

    if (switchToDetail && window.innerWidth <= 820) setMobileView('detail');
  }

  function formatGrade(grade) {
    var text = String(grade || '').trim();
    if (!text) return '';
    if (/lớp|khối/i.test(text)) return text;
    return 'Lớp ' + text;
  }

  function renderRelated(item) {
    var related = state.data.filter(function (candidate) {
      if (candidate.id === item.id) return false;
      if (!item.grades.length || !candidate.grades.length) return false;
      return candidate.grades.some(function (grade) { return item.grades.indexOf(grade) >= 0; });
    });
    if (related.length < 4) {
      var extra = state.data.filter(function (candidate) {
        return candidate.id !== item.id && related.indexOf(candidate) < 0;
      });
      related = related.concat(extra);
    }
    related = related.slice(0, 4);

    els.relatedGrid.innerHTML = '';
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
      button.addEventListener('click', function () { selectTerm(candidate.id, true); });
      els.relatedGrid.appendChild(button);
    });
  }

  function updateNavigation() {
    var index = state.filtered.findIndex(function (item) { return item.id === state.selectedId; });
    if (index < 0) {
      els.positionBadge.textContent = state.filtered.length ? '– / ' + state.filtered.length : '0 / 0';
      els.previousButton.disabled = true;
      els.nextButton.disabled = true;
      return;
    }
    els.positionBadge.textContent = (index + 1) + ' / ' + state.filtered.length;
    els.previousButton.disabled = index <= 0;
    els.nextButton.disabled = index >= state.filtered.length - 1;
  }

  function moveSelection(direction) {
    if (!state.filtered.length) return;
    var index = state.filtered.findIndex(function (item) { return item.id === state.selectedId; });
    if (index < 0) index = direction > 0 ? -1 : state.filtered.length;
    var nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.filtered.length) return;
    selectTerm(state.filtered[nextIndex].id, true);
  }

  function addRecent(item) {
    state.recent = state.recent.filter(function (term) { return term !== item.term; });
    state.recent.unshift(item.term);
    state.recent = state.recent.slice(0, 6);
    writeJson(config.recentKey, state.recent);
    renderRecent();
  }

  function renderRecent() {
    els.recentList.innerHTML = '';
    var available = state.recent.map(function (termName) {
      return state.data.find(function (item) { return item.term === termName; });
    }).filter(Boolean);
    els.recentSection.hidden = !available.length;
    els.clearRecentButton.hidden = !available.length;
    available.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-button';
      button.textContent = item.term;
      button.title = item.term;
      button.addEventListener('click', function () { selectTerm(item.id, true); });
      els.recentList.appendChild(button);
    });
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
    var item = state.data.find(function (term) { return term.id === state.selectedId; });
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
        var keepHref = node.tagName === 'A' && attribute.name.toLowerCase() === 'href';
        var keepTitle = node.tagName === 'A' && attribute.name.toLowerCase() === 'title';
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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* ignore */ }
  }
})();
