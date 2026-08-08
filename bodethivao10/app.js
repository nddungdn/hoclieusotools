(() => {
  "use strict";

  const APP_VERSION = "12.0.0-secure";
  const MAX_IMAGES_PER_WRITING = Number(window.VAN10_MAX_IMAGES_PER_WRITING || 8);
  const MAX_IMAGE_BYTES = Number(window.VAN10_MAX_IMAGE_BYTES || 1500000);
  const MAX_IMAGE_SIDE = Number(window.VAN10_MAX_IMAGE_SIDE || 1800);
  const JPEG_QUALITY = Number(window.VAN10_JPEG_QUALITY || 0.82);
  const els = {};
  const state = {
    exams: [], questions: [], filtered: [], current: null,
    selectedProvince: "", extraAnswerCount: 0, saveTimer: null, toastTimer: null,
    images: {}, startedAt: new Date().toISOString(), finishedSnapshot: null,
    apiClientId: getOrCreateApiClientId_(), posting: false, sentSubmissionId: "",
    activeQuestionCode: "", splitPreset: "balanced", splitterDragging: false,
    splitterStartX: 0, splitterStartY: 0, splitterMoved: false,
    aiOverallResult: null, aiOverallRunning: false,
    preKeyboardSplit: null, drawerOpen: false,
    provinceOptions: [], provinceSearch: "", selectionRequest: 0,
    attemptToken: "", reviewAvailableAt: 0, questionContexts: new Map()
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    console.info(`Luyện đề Ngữ văn 10 – phiên bản ${APP_VERSION}`);
    purgeLegacySensitiveStorage_();
    cacheElements();
    bindEvents();
    restorePreferences();
    loadData();
  }

  function cacheElements() {
    [
      "menuBtn","headerActions","fontDownBtn","fontUpBtn","themeBtn",
      "settingsDrawer","drawerBackdrop","closeDrawerBtn","headerExamTitle","answerToolsBtn","aiBackdrop",
      "examToolbarCard","mobileExamSummary","mobileExamTitle","changeExamBtn",
      "provinceSearchInput","clearProvinceSearchBtn","provinceSearchHint","provinceButton","provinceMenu","yearSelect","typeSelect","examSelect",
      "studentName","studentClass","studentSchool","apiKeyInput","toggleApiKeyBtn","saveApiKeyBtn","utilityDetails",
      "dataHealth","dataStatusDot","dataStatusText","statusBar","emptyState","workspace",
      "sourcePanel","answerPanel","workspaceSplitter","splitterHint","sourceTopBtn","restoreReadingBtn","questionNav",
      "examTitle","currentExamLabel","examYear","examType","examContent","saveIndicator","progressText","progressBar",
      "totalScore","maxTotalScore","answerFields","addAnswerBtn","clearBtn","finishBtn",
      "reviewSection","backToWorkBtn","answerKeyPanel","aiScorePanel","referencesPanel","sendTeacherPanel",
      "answerKeyContent","aiScoreContent","aiScoreStatus","runAiScoreBtn","referenceContent","teacherEmail","teacherMessage","confirmOwnWork",
      "sendSummary","sendSubmissionBtn","uploadProgress","uploadProgressText","uploadProgressPercent",
      "uploadProgressBar","sendResult","toast","imageLightbox","closeLightboxBtn","lightboxImage"
    ].forEach(id => { els[id] = document.getElementById(id); });
  }

  function bindEvents() {
    els.menuBtn.addEventListener("click", () => openSettingsDrawer());
    els.closeDrawerBtn?.addEventListener("click", closeSettingsDrawer);
    els.drawerBackdrop?.addEventListener("click", closeSettingsDrawer);
    els.answerToolsBtn?.addEventListener("click", () => openSettingsDrawer());
    els.fontDownBtn.addEventListener("click", () => changeFont(-1));
    els.fontUpBtn.addEventListener("click", () => changeFont(1));
    els.themeBtn.addEventListener("click", toggleTheme);
    els.provinceButton.addEventListener("click", toggleProvinceMenu);
    els.provinceSearchInput?.addEventListener("focus", () => {
      renderProvinceMenu(state.provinceOptions);
      openProvinceMenu();
    });
    els.provinceSearchInput?.addEventListener("input", handleProvinceSearchInput);
    els.provinceSearchInput?.addEventListener("keydown", handleProvinceSearchKeydown);
    els.clearProvinceSearchBtn?.addEventListener("click", clearProvinceSearch);
    document.addEventListener("click", e => {
      if (!e.target.closest(".province-wrap, .province-search-field")) closeProvinceMenu();
    });
    els.yearSelect.addEventListener("change", applyFilters);
    els.typeSelect.addEventListener("change", applyFilters);
    els.examSelect.addEventListener("change", () => {
      if (els.examSelect.value) selectExam(els.examSelect.value);
    });
    els.changeExamBtn.addEventListener("click", () => openSettingsDrawer());
    [els.studentName,els.studentClass,els.studentSchool].forEach(el => el.addEventListener("input", saveStudentInfo));
    els.toggleApiKeyBtn.addEventListener("click", toggleApiKey);
    els.saveApiKeyBtn.addEventListener("click", saveApiKey);
    els.addAnswerBtn.addEventListener("click", addExtraAnswer);
    els.clearBtn.addEventListener("click", clearAnswers);
    els.finishBtn.addEventListener("click", finishExam);
    els.backToWorkBtn.addEventListener("click", backToWork);
    document.querySelectorAll(".review-tab").forEach(btn => btn.addEventListener("click", () => openReviewTab(btn.dataset.tab)));
    els.sendSubmissionBtn.addEventListener("click", sendSubmission);
    els.runAiScoreBtn.addEventListener("click", requestAiOverallGrade);
    els.closeLightboxBtn.addEventListener("click", closeLightbox);
    els.imageLightbox.addEventListener("click", e => { if (e.target === els.imageLightbox) closeLightbox(); });
    els.sourceTopBtn.addEventListener("click", () => els.examContent.scrollTo({ top: 0, behavior: "smooth" }));
    els.restoreReadingBtn.addEventListener("click", () => {
      setSplitPreset("source");
      focusSourcePanel();
    });
    document.querySelectorAll("[data-split-preset]").forEach(btn => {
      btn.addEventListener("click", () => setSplitPreset(btn.dataset.splitPreset));
    });
    bindWorkspaceSplitter();
    bindMobileKeyboardWorkspace();
    els.aiBackdrop?.addEventListener("click", closeAiPanels);

    // Bảo vệ đề PDF trong giao diện: chặn menu chuột phải và các phím lưu/in phổ biến.
    // Đây là lớp hạn chế thao tác thông thường; ảnh chụp màn hình vẫn không thể bị ngăn tuyệt đối trên web.
    els.examContent.addEventListener("contextmenu", e => {
      if (e.target.closest(".pdf-protected-shell")) e.preventDefault();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { closeSettingsDrawer(); closeAiPanels(); }
      if (!state.current || els.workspace.hidden) return;
      const key = String(e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === "s" || key === "p")) {
        e.preventDefault();
        toast("Đề thi chỉ được hiển thị để làm bài trực tuyến.");
      }
    });
  }

  function openSettingsDrawer() {
    if (!els.settingsDrawer) return;
    state.drawerOpen = true;
    els.settingsDrawer.classList.add("is-open");
    els.settingsDrawer.setAttribute("aria-hidden", "false");
    if (els.drawerBackdrop) els.drawerBackdrop.hidden = false;
    els.menuBtn?.setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-open");
  }

  function closeSettingsDrawer() {
    if (!els.settingsDrawer) return;
    state.drawerOpen = false;
    els.settingsDrawer.classList.remove("is-open");
    els.settingsDrawer.setAttribute("aria-hidden", "true");
    if (els.drawerBackdrop) els.drawerBackdrop.hidden = true;
    els.menuBtn?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-open");
  }

  function closeAiPanels(except = null) {
    document.querySelectorAll(".ai-scroll-box").forEach(box => {
      if (box !== except) box.hidden = true;
    });
    if (!except) {
      if (els.aiBackdrop) els.aiBackdrop.hidden = true;
      document.body.classList.remove("ai-panel-open");
    }
  }

  function bindMobileKeyboardWorkspace() {
    if (!els.answerPanel) return;
    els.answerPanel.addEventListener("focusin", event => {
      if (!isMobileSplit() || !event.target.matches("textarea,input")) return;
      if (state.preKeyboardSplit === null) state.preKeyboardSplit = getCurrentSplitRatio();
      if (getCurrentSplitRatio() > 24) setSplitRatio(20, { persist: false, preset: "answer" });
    });
    els.answerPanel.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!isMobileSplit()) return;
        if (els.answerPanel.contains(document.activeElement) && document.activeElement.matches("textarea,input")) return;
        if (state.preKeyboardSplit !== null) {
          setSplitRatio(state.preKeyboardSplit, { persist: false, preset: "custom" });
          state.preKeyboardSplit = null;
        }
      }, 220);
    });
  }

  function restorePreferences() {
    const theme = localStorage.getItem("van10_theme");
    if (theme === "dark") document.body.classList.add("dark");
    const size = Number(localStorage.getItem("van10_font_size") || 17);
    document.documentElement.style.setProperty("--reader-size", `${Math.min(23,Math.max(14,size))}px`);
    const student = readJson(sessionStorage.getItem("van10_student_session"), {});
    els.studentName.value = student.name || "";
    els.studentClass.value = student.className || "";
    els.studentSchool.value = student.school || "";
    els.apiKeyInput.value = sessionStorage.getItem("van10_gemini_key") || "";
    restoreSplitPreference();
  }

  function changeFont(delta) {
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--reader-size"), 10) || 17;
    const next = Math.min(23, Math.max(14, current + delta));
    document.documentElement.style.setProperty("--reader-size", `${next}px`);
    localStorage.setItem("van10_font_size", String(next));
  }
  function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem("van10_theme", document.body.classList.contains("dark") ? "dark" : "light");
  }
  function saveStudentInfo() {
    sessionStorage.setItem("van10_student_session", JSON.stringify({name:els.studentName.value.trim(),className:els.studentClass.value.trim(),school:els.studentSchool.value.trim()}));
  }
  function toggleApiKey() {
    const show = els.apiKeyInput.type === "password";
    els.apiKeyInput.type = show ? "text" : "password";
    els.toggleApiKeyBtn.textContent = show ? "Ẩn" : "Hiện";
  }
  function saveApiKey() {
    const key = els.apiKeyInput.value.trim();
    if (!key) { sessionStorage.removeItem("van10_gemini_key"); toast("Đã xóa API key trong phiên này."); return; }
    sessionStorage.setItem("van10_gemini_key", key);
    toast("Đã lưu API key trong phiên trình duyệt này.");
  }

  function restoreSplitPreference() {
    const desktop = Number(localStorage.getItem("van10_split_desktop") || 42);
    const mobile = Number(localStorage.getItem("van10_split_mobile") || 46);
    els.workspace.style.setProperty("--source-pane", `${clamp(desktop, 28, 64)}%`);
    els.workspace.style.setProperty("--mobile-source-pane", `${clamp(Number.isFinite(mobile) ? mobile : 46, 18, 72)}%`);
    state.splitPreset = localStorage.getItem("van10_split_preset") || "balanced";
    updateSplitPresetButtons();
    updateSplitterAria();
    updateMobileWorkspaceState();
  }

  function bindWorkspaceSplitter() {
    const splitter = els.workspaceSplitter;
    if (!splitter) return;

    splitter.addEventListener("pointerdown", event => {
      event.preventDefault();
      state.splitterDragging = true;
      state.splitterMoved = false;
      state.splitterStartX = event.clientX;
      state.splitterStartY = event.clientY;
      els.workspace.classList.add("is-resizing");
      splitter.setPointerCapture?.(event.pointerId);
    });

    splitter.addEventListener("pointermove", event => {
      if (!state.splitterDragging) return;
      const distance = Math.hypot(event.clientX - state.splitterStartX, event.clientY - state.splitterStartY);
      if (distance > 4) state.splitterMoved = true;

      const rect = els.workspace.getBoundingClientRect();
      const mobile = isMobileSplit();
      const raw = mobile
        ? ((event.clientY - rect.top) / rect.height) * 100
        : ((event.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(raw, { persist: false, preset: "custom" });
    });

    const finishDrag = event => {
      if (!state.splitterDragging) return;
      const wasMoved = state.splitterMoved;
      state.splitterDragging = false;
      state.splitterMoved = false;
      els.workspace.classList.remove("is-resizing");
      splitter.releasePointerCapture?.(event.pointerId);

      if (isMobileSplit() && !wasMoved) {
        // Chạm vào thanh kéo để chuyển nhanh giữa cân bằng và viết nhiều.
        setSplitPreset(getCurrentSplitRatio() <= 24 ? "balanced" : "answer");
        return;
      }

      persistCurrentSplit();
      updateMobileWorkspaceState();
    };
    splitter.addEventListener("pointerup", finishDrag);
    splitter.addEventListener("pointercancel", finishDrag);

    splitter.addEventListener("keydown", event => {
      const mobile = isMobileSplit();
      const allowed = mobile ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
      if (!allowed.includes(event.key)) return;
      event.preventDefault();
      const current = getCurrentSplitRatio();
      const delta = (event.key === "ArrowRight" || event.key === "ArrowDown") ? 2 : -2;
      setSplitRatio(current + delta, { persist: true, preset: "custom" });
    });

    window.addEventListener("resize", debounce(() => {
      updateSplitterAria();
      updateMobileWorkspaceState();
    }, 120));
  }

  function isMobileSplit() {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  function getCurrentSplitRatio() {
    const variable = isMobileSplit() ? "--mobile-source-pane" : "--source-pane";
    const inline = els.workspace.style.getPropertyValue(variable);
    const computed = getComputedStyle(els.workspace).getPropertyValue(variable);
    const parsed = Number.parseFloat(inline || computed);
    return Number.isFinite(parsed) ? parsed : (isMobileSplit() ? 46 : 42);
  }

  function setSplitRatio(value, options = {}) {
    const mobile = isMobileSplit();
    const min = mobile ? 18 : 28;
    const max = mobile ? 72 : 64;
    const numeric = Number(value);
    const fallback = mobile ? 46 : 42;
    const ratio = clamp(Number.isFinite(numeric) ? numeric : fallback, min, max);
    const variable = mobile ? "--mobile-source-pane" : "--source-pane";
    els.workspace.style.setProperty(variable, `${ratio}%`);
    state.splitPreset = options.preset || "custom";
    if (options.persist !== false) persistCurrentSplit();
    updateSplitPresetButtons();
    updateSplitterAria(ratio);
    updateMobileWorkspaceState(ratio);
  }

  function setSplitPreset(preset) {
    const mobile = isMobileSplit();
    const values = mobile
      ? { source: 66, balanced: 46, answer: 20 }
      : { source: 54, balanced: 42, answer: 30 };
    const selected = Object.prototype.hasOwnProperty.call(values, preset) ? preset : "balanced";
    setSplitRatio(values[selected], { persist: true, preset: selected });
  }

  function persistCurrentSplit() {
    const ratio = getCurrentSplitRatio();
    localStorage.setItem(isMobileSplit() ? "van10_split_mobile" : "van10_split_desktop", String(Math.round(ratio * 10) / 10));
    localStorage.setItem("van10_split_preset", state.splitPreset || "custom");
  }

  function updateSplitPresetButtons() {
    document.querySelectorAll("[data-split-preset]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.splitPreset === state.splitPreset);
    });
  }

  function updateSplitterAria(value = getCurrentSplitRatio()) {
    if (!els.workspaceSplitter) return;
    const mobile = isMobileSplit();
    els.workspaceSplitter.setAttribute("aria-orientation", mobile ? "horizontal" : "vertical");
    els.workspaceSplitter.setAttribute("aria-valuemin", mobile ? "18" : "28");
    els.workspaceSplitter.setAttribute("aria-valuemax", mobile ? "72" : "64");
    els.workspaceSplitter.setAttribute("aria-valuenow", String(Math.round(value)));
  }

  function updateMobileWorkspaceState(value = getCurrentSplitRatio()) {
    if (!els.workspace) return;
    const mobile = isMobileSplit();
    const compact = mobile && value <= 24;

    els.workspace.classList.remove("is-source-collapsed");
    els.workspace.classList.toggle("is-source-compact", compact);

    if (els.splitterHint) {
      els.splitterHint.textContent = compact
        ? "Kéo xuống để đọc nhiều hơn"
        : "Kéo để thay đổi không gian";
    }

    if (els.restoreReadingBtn) {
      els.restoreReadingBtn.hidden = !state.current;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadData() {
    loadExamCatalog_();
  }

  async function loadExamCatalog_() {
    setStatus("Đang tải danh mục đề thi an toàn…", "");
    try {
      const data = await apiRequest("/api/exams");
      const exams = normalizeRows(Array.isArray(data.items) ? data.items : []);
      if (!exams.length) throw new Error("Chưa có đề thi ở trạng thái hiển thị.");
      state.exams = exams;
      state.questions = [];
      buildFilters();
      applyFilters();
      setStatus(`Đã kết nối an toàn: ${state.exams.length} đề. Nội dung chỉ tải khi chọn đề.`, "success");
    } catch (error) {
      console.warn("Không tải được danh mục đề:", safeErrorText_(error));
      state.exams = [];
      state.questions = [];
      els.workspace.hidden = true;
      els.reviewSection.hidden = true;
      els.emptyState.hidden = false;
      setStatus(error.message || "Chưa thể kết nối dữ liệu đề thi.", "error");
    }
  }

  function normalizeUnicodeText(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      // Sửa một số dấu thanh bị tách thành ký tự riêng sau nguyên âm.
      .replace(/([aăâeêioôơuưyAĂÂEÊIOÔƠUƯY])[´\u02CA]/g, "$1\u0301")
      .replace(/([aăâeêioôơuưyAĂÂEÊIOÔƠUƯY])[`\u02CB]/g, "$1\u0300")
      // Chuẩn hóa Unicode tổ hợp về dạng dựng sẵn để font hiển thị dấu đúng.
      .normalize("NFC");
  }

  function normalizeRows(rows) {
    return rows.map(row => {
      const out = {};
      Object.keys(row || {}).forEach(key => {
        const cleanKey = normalizeUnicodeText(String(key).trim());
        out[cleanKey] = normalizeUnicodeText(row[key]);
      });
      return out;
    });
  }

  function buildFilters() {
    const provinces = uniqueSorted(state.exams.map(e => e.TinhThanh));
    const years = uniqueSorted(state.exams.map(e => e.Nam), true);
    const types = uniqueSorted(state.exams.map(e => e.LoaiDe));
    state.provinceOptions = provinces;
    renderProvinceMenu(provinces);
    fillSelect(els.yearSelect, years, "Tất cả");
    fillSelect(els.typeSelect, types, "Tất cả");
  }
  function uniqueSorted(values, desc=false) {
    const arr = [...new Set(values.map(v=>String(v||"").trim()).filter(Boolean))];
    return arr.sort((a,b)=>desc?b.localeCompare(a,"vi",{numeric:true}):a.localeCompare(b,"vi"));
  }
  function fillSelect(select, values, firstText) {
    const old = select.value;
    select.innerHTML = `<option value="">${escapeHtml(firstText)}</option>` + values.map(v=>`<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
    if ([...select.options].some(o=>o.value===old)) select.value=old;
  }
  function renderProvinceMenu(provinces = state.provinceOptions) {
    const query = String(state.provinceSearch || els.provinceSearchInput?.value || "").trim();
    const foldedQuery = foldSearchText(query);
    const matched = foldedQuery
      ? provinces.filter(province => foldSearchText(province).includes(foldedQuery))
      : provinces;
    const items = foldedQuery ? matched : ["", ...matched];

    if (!items.length) {
      els.provinceMenu.innerHTML = `<div class="province-empty" role="status">Không tìm thấy tỉnh/thành phù hợp với “${escapeHtml(query)}”.</div>`;
    } else {
      els.provinceMenu.innerHTML = items.map(v => `<button type="button" class="province-option ${state.selectedProvince===v?"is-selected":""}" role="option" aria-selected="${state.selectedProvince===v}" data-value="${escapeAttr(v)}"><span>${escapeHtml(v || "Tất cả tỉnh/thành")}</span>${state.selectedProvince===v?'<span class="province-check" aria-hidden="true">✓</span>':''}</button>`).join("");
      els.provinceMenu.querySelectorAll(".province-option").forEach(btn => btn.addEventListener("click", () => selectProvince(btn.dataset.value || "")));
    }

    updateProvinceSearchUi(query, matched.length, provinces.length);
  }

  function handleProvinceSearchInput(event) {
    state.provinceSearch = event.target.value || "";
    renderProvinceMenu(state.provinceOptions);
    openProvinceMenu();
  }

  function handleProvinceSearchKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearProvinceSearch();
      closeProvinceMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openProvinceMenu();
      els.provinceMenu.querySelector(".province-option")?.focus();
      return;
    }
    if (event.key === "Enter") {
      const first = els.provinceMenu.querySelector(".province-option");
      if (first && String(state.provinceSearch || "").trim()) {
        event.preventDefault();
        first.click();
      }
    }
  }

  function selectProvince(value) {
    state.selectedProvince = value || "";
    els.provinceButton.textContent = state.selectedProvince || "Tất cả tỉnh/thành";
    state.provinceSearch = "";
    if (els.provinceSearchInput) els.provinceSearchInput.value = "";
    closeProvinceMenu();
    renderProvinceMenu(state.provinceOptions);
    applyFilters();
  }

  function clearProvinceSearch() {
    state.provinceSearch = "";
    if (els.provinceSearchInput) {
      els.provinceSearchInput.value = "";
      els.provinceSearchInput.focus();
    }
    renderProvinceMenu(state.provinceOptions);
    openProvinceMenu();
  }

  function updateProvinceSearchUi(query, matchedCount, totalCount) {
    if (els.clearProvinceSearchBtn) els.clearProvinceSearchBtn.hidden = !query;
    if (!els.provinceSearchHint) return;
    if (query) {
      els.provinceSearchHint.textContent = matchedCount
        ? `Tìm thấy ${matchedCount} tỉnh/thành. Chọn một mục để lọc đề.`
        : "Không có tỉnh/thành phù hợp. Hãy thử từ khóa ngắn hơn.";
    } else {
      els.provinceSearchHint.textContent = `${totalCount} tỉnh/thành đang có đề. Có thể gõ không dấu, ví dụ “da nang”.`;
    }
  }

  function foldSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLocaleLowerCase("vi")
      .trim();
  }

  function toggleProvinceMenu(){
    if (els.provinceMenu.hidden) openProvinceMenu(); else closeProvinceMenu();
  }
  function openProvinceMenu(){
    renderProvinceMenu(state.provinceOptions);
    els.provinceMenu.hidden=false;
    els.provinceButton.setAttribute("aria-expanded","true");
    els.provinceSearchInput?.setAttribute("aria-expanded","true");
  }
  function closeProvinceMenu(){
    els.provinceMenu.hidden=true;
    els.provinceButton.setAttribute("aria-expanded","false");
    els.provinceSearchInput?.setAttribute("aria-expanded","false");
  }

  function applyFilters() {
    const year = els.yearSelect.value;
    const type = els.typeSelect.value;

    state.filtered = state.exams.filter(exam => {
      if (String(exam.TrangThai || "HIEN").toUpperCase() === "AN") return false;
      if (state.selectedProvince && exam.TinhThanh !== state.selectedProvince) return false;
      if (year && exam.Nam !== year) return false;
      if (type && exam.LoaiDe !== type) return false;
      return true;
    });

    renderExamSelect();
    els.emptyState.hidden = Boolean(state.filtered.length);

    if (!state.filtered.length) {
      els.workspace.hidden = true;
      els.restoreReadingBtn.hidden = true;
      els.examToolbarCard.classList.remove("is-collapsed");
      els.mobileExamSummary.hidden = true;
      els.reviewSection.hidden = true;
      return;
    }

    const currentStillVisible = state.current && state.filtered.some(exam => exam.ID === state.current.ID);
    if (currentStillVisible) {
      els.examSelect.value = state.current.ID;
      updateCurrentExamHeading();
      return;
    }

    const requestedId = els.examSelect.value;
    const nextExam = state.filtered.find(exam => exam.ID === requestedId) || state.filtered[0];
    selectExam(nextExam.ID, { scrollIntoView: false });
  }

  function renderExamSelect() {
    const previous = state.current?.ID || els.examSelect.value;
    if (!state.filtered.length) {
      els.examSelect.innerHTML = '<option value="">Không có đề phù hợp</option>';
      els.examSelect.disabled = true;
      return;
    }

    els.examSelect.disabled = false;
    els.examSelect.innerHTML = state.filtered.map(exam => {
      const label = `${exam.TinhThanh || exam.ID} · ${exam.Nam || ""} · ${exam.LoaiDe || "Chung"}`;
      return `<option value="${escapeAttr(exam.ID)}">${escapeHtml(label)}</option>`;
    }).join("");

    const selected = state.filtered.some(exam => exam.ID === previous) ? previous : state.filtered[0].ID;
    els.examSelect.value = selected;
  }

  async function selectExam(id, options = {}) {
    const summary = state.exams.find(item => item.ID === id);
    if (!summary) return;

    const requestNumber = ++state.selectionRequest;
    els.examSelect.value = summary.ID;
    els.examSelect.disabled = true;
    setStatus(`Đang mở đề ${summary.TinhThanh || summary.ID}…`, "");

    try {
      const data = await apiRequest(`/api/exams/${encodeURIComponent(summary.ID)}`);
      if (requestNumber !== state.selectionRequest) return;
      const exam = normalizeRows([data.exam || {}])[0];
      const questions = normalizeRows(Array.isArray(data.questions) ? data.questions : []);
      if (!exam?.ID || exam.ID !== summary.ID || !questions.length) throw new Error("Dữ liệu đề thi không đầy đủ.");

      Object.values(state.images).flat().forEach(item => URL.revokeObjectURL(item.dataUrl));
      state.current = exam;
      state.questions = questions;
      state.attemptToken = String(data.attemptToken || "");
      state.reviewAvailableAt = Number(data.reviewAvailableAt || 0);
      state.questionContexts = new Map();
      state.extraAnswerCount = 0;
      state.images = {};
      state.finishedSnapshot = null;
      state.sentSubmissionId = "";
      state.startedAt = new Date().toISOString();
      state.activeQuestionCode = "";
      state.aiOverallResult = null;
      state.aiOverallRunning = false;

      if (!state.attemptToken) throw new Error("Phiên làm bài chưa được xác thực.");
      els.reviewSection.hidden = true;
      els.workspace.hidden = false;
      updateMobileWorkspaceState();
      els.examSelect.value = exam.ID;
      updateCurrentExamHeading();
      els.examContent.innerHTML = renderDocument(exam.DeThi || "<p>Chưa cập nhật nội dung đề.</p>");

      restoreExamData();
      renderAnswerFields();
      els.examContent.scrollTop = 0;
      els.answerPanel.scrollTop = 0;
      setStatus(`Đã mở đề an toàn · ${questions.length} câu hỏi.`, "success");

      closeSettingsDrawer();
      if (options.scrollIntoView !== false) scrollPageToSection(els.workspace);
    } catch (error) {
      if (requestNumber !== state.selectionRequest) return;
      console.warn("Không mở được đề:", safeErrorText_(error));
      state.current = null;
      state.questions = [];
      state.attemptToken = "";
      els.workspace.hidden = true;
      setStatus(error.message || "Chưa thể mở đề thi này.", "error");
    } finally {
      if (requestNumber === state.selectionRequest) els.examSelect.disabled = false;
    }
  }

  function updateCurrentExamHeading() {
    if (!state.current) return;
    const exam = state.current;
    els.examTitle.textContent = exam.TinhThanh || "Đề thi";
    els.currentExamLabel.textContent = `${exam.TinhThanh || exam.ID} · ${exam.Nam || ""} · ${exam.LoaiDe || "Đề chung"}`;
    els.examYear.textContent = exam.Nam || "";
    els.examType.textContent = exam.LoaiDe || "";
    const compactTitle = `${exam.TinhThanh || exam.ID} · ${exam.Nam || ""} · ${exam.LoaiDe || "Chung"}`;
    els.mobileExamTitle.textContent = compactTitle;
    if (els.headerExamTitle) els.headerExamTitle.textContent = compactTitle;
    els.mobileExamSummary.hidden = true;
  }

  function questionsForCurrent() {
    if (!state.current) return [];
    return state.questions.filter(q=>q.IDDe===state.current.ID && String(q.TrangThai||"HIEN").toUpperCase()!=="AN")
      .sort((a,b)=>(toNumber(a.ThuTu)-toNumber(b.ThuTu)) || a.MaCau.localeCompare(b.MaCau,"vi"));
  }

  function renderAnswerFields() {
    const questions = questionsForCurrent();
    if (!questions.length) {
      els.answerFields.innerHTML = `<div class="answer-card"><p>Chưa có dữ liệu câu hỏi trong sheet CauHoiNam${escapeHtml(state.current.Nam || "")}.</p></div>`;
      els.questionNav.innerHTML = "";
      updateProgress();
      return;
    }

    els.answerFields.innerHTML = questions.map(renderAnswerCard).join("");
    const restoredExtras = (state._restoredAnswers || []).filter(item => /^EXTRA\d+$/i.test(item.code || ""));
    restoredExtras.forEach(item => {
      const n = Number(String(item.code).replace(/\D/g, "")) || 1;
      state.extraAnswerCount = Math.max(state.extraAnswerCount, n);
      els.answerFields.insertAdjacentHTML("beforeend", renderExtraAnswerCard(item.code, n, item.text || ""));
    });

    bindAnswerCardEvents();
    renderQuestionNav(questions);
    updateProgress();

    const firstCode = questions[0]?.MaCau || "";
    if (firstCode) setActiveQuestion(firstCode);
  }

  function renderAnswerCard(q) {
    const code = q.MaCau || `Q${q.ThuTu}`;
    const isWriting = isWritingQuestion(q);
    const saved = getSavedAnswer(code);
    const max = toNumber(q.DiemToiDa);
    const imageBlock = isWriting ? `
      <div class="upload-block" data-upload-code="${escapeAttr(code)}">
        <div class="upload-head"><strong>Ảnh bài viết tay</strong><label class="file-label">＋ Chọn nhiều ảnh<input class="image-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple data-code="${escapeAttr(code)}"></label></div>
        <p class="upload-note">Tối đa ${MAX_IMAGES_PER_WRITING} ảnh/câu. Có thể chọn nhiều ảnh cùng lúc; dùng các nút để đổi thứ tự, xoay hoặc xóa ảnh.</p>
        <div class="image-grid" id="imageGrid_${escapeAttr(code)}"><div class="image-empty">Chưa chọn ảnh.</div></div>
      </div>` : "";

    const writingExpandButton = isWriting
      ? `<button class="mini-btn expand-writing-btn" type="button" data-code="${escapeAttr(code)}">↔ Mở rộng vùng viết</button>`
      : "";

    return `<section class="answer-card ${isWriting ? "is-writing" : ""}" data-code="${escapeAttr(code)}" tabindex="-1">
      <div class="answer-card-head"><div><h3>${escapeHtml(q.Phan ? `${q.Phan} – ${q.TenCau || code}` : (q.TenCau || code))}</h3><div class="question-meta">Mã ${escapeHtml(code)} · Tối đa ${formatNumber(max)} điểm</div></div></div>
      <div class="question-prompt">${formatRichContent(q.YeuCau || "")}</div>
      <textarea class="answer-text" data-code="${escapeAttr(code)}" placeholder="Nhập bài làm của em…">${escapeHtml(saved.text || "")}</textarea>
      <div class="answer-tools">
        <button class="mini-btn source-jump-btn" type="button" data-code="${escapeAttr(code)}">📖 Xem ngữ liệu</button>
        ${writingExpandButton}
        <button class="mini-btn hint-btn" type="button" data-code="${escapeAttr(code)}">Gợi ý cách làm</button>
        <button class="mini-btn ai-grade-btn" type="button" data-code="${escapeAttr(code)}">AI nhận xét, chấm thử</button>
      </div>
      <div class="hint-box ai-scroll-box" id="hint_${escapeAttr(code)}" hidden role="region" aria-label="Gợi ý của AI" tabindex="0">
        <div class="ai-scroll-head"><strong>Gợi ý của AI</strong><span>Vuốt hoặc cuộn để xem hết</span><button class="ai-close-btn" type="button" aria-label="Đóng">×</button></div>
        <div class="ai-scroll-body"></div>
      </div>
      <div class="ai-result ai-scroll-box" id="ai_${escapeAttr(code)}" hidden role="region" aria-label="AI nhận xét và chấm thử" tabindex="0">
        <div class="ai-scroll-head"><strong>AI nhận xét, chấm thử</strong><span>Vuốt hoặc cuộn để xem hết</span><button class="ai-close-btn" type="button" aria-label="Đóng">×</button></div>
        <div class="ai-scroll-body"></div>
      </div>
      <div class="score-line"><span>Điểm tự chấm:</span><input class="score-input" data-code="${escapeAttr(code)}" type="number" min="0" max="${max}" step="0.25" value="${escapeAttr(saved.score || "")}"><span>/ ${formatNumber(max)}</span></div>
      ${imageBlock}
    </section>`;
  }

  function bindAnswerCardEvents() {
    els.answerFields.querySelectorAll(".answer-text,.score-input").forEach(input => {
      input.addEventListener("input", () => { scheduleSave(); updateProgress(); });
      input.addEventListener("focus", () => setActiveQuestion(input.dataset.code || input.closest(".answer-card")?.dataset.code || ""));
    });
    els.answerFields.querySelectorAll(".answer-card").forEach(card => {
      card.addEventListener("pointerdown", () => setActiveQuestion(card.dataset.code || ""));
    });
    els.answerFields.querySelectorAll(".source-jump-btn").forEach(btn => btn.addEventListener("click", () => {
      setActiveQuestion(btn.dataset.code || "");
      focusSourcePanel();
    }));
    els.answerFields.querySelectorAll(".expand-writing-btn").forEach(btn => btn.addEventListener("click", () => toggleWritingFocus(btn.dataset.code, btn)));
    els.answerFields.querySelectorAll(".hint-btn").forEach(btn => btn.addEventListener("click", () => requestHint(btn.dataset.code)));
    els.answerFields.querySelectorAll(".ai-grade-btn").forEach(btn => btn.addEventListener("click", () => requestAiGrade(btn.dataset.code)));
    els.answerFields.querySelectorAll(".ai-close-btn").forEach(btn => btn.addEventListener("click", () => closeAiPanels()));
    els.answerFields.querySelectorAll(".image-input").forEach(input => input.addEventListener("change", e => handleImageFiles(input.dataset.code, e.target.files)));
  }

  function renderQuestionNav(questions) {
    els.questionNav.innerHTML = questions.map(question => {
      const code = question.MaCau || `Q${question.ThuTu}`;
      const label = code;
      const writingClass = isWritingQuestion(question) ? "is-writing" : "";
      return `<button type="button" class="${writingClass}" data-code="${escapeAttr(code)}" title="${escapeAttr(question.Phan || "Câu hỏi")}">${escapeHtml(label)}</button>`;
    }).join("");

    els.questionNav.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => scrollToAnswerQuestion(btn.dataset.code));
    });
  }

  function scrollToAnswerQuestion(code) {
    const card = els.answerFields.querySelector(`.answer-card[data-code="${cssEscape(code)}"]`);
    if (!card) return;
    setActiveQuestion(code);
    const stickyHeight = els.answerPanel.querySelector(".answer-toolbar-sticky")?.offsetHeight || 190;
    const target = Math.max(0, card.offsetTop - stickyHeight - 14);
    els.answerPanel.scrollTo({ top: target, behavior: "smooth" });
    window.setTimeout(() => card.querySelector("textarea")?.focus({ preventScroll: true }), 280);
  }

  function setActiveQuestion(code) {
    if (!code) return;
    state.activeQuestionCode = code;
    els.answerFields.querySelectorAll(".answer-card").forEach(card => card.classList.toggle("is-active", card.dataset.code === code));
    els.questionNav.querySelectorAll("button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.code === code));
  }

  function focusSourcePanel() {
    if (window.matchMedia("(max-width: 820px)").matches) setSplitPreset("source");
    els.sourcePanel.focus({ preventScroll: true });
    if (typeof els.sourcePanel.animate === "function") {
      els.sourcePanel.animate(
        [
          { boxShadow: "0 0 0 0 rgba(11,92,171,0)" },
          { boxShadow: "0 0 0 4px rgba(11,92,171,.18)" },
          { boxShadow: "0 0 0 0 rgba(11,92,171,0)" }
        ],
        { duration: 650 }
      );
    }
  }

  function toggleWritingFocus(code, button) {
    const card = els.answerFields.querySelector(`.answer-card[data-code="${cssEscape(code)}"]`);
    if (!card) return;
    const expanded = card.classList.toggle("writing-expanded");
    button.textContent = expanded ? "↔ Thu gọn vùng viết" : "↔ Mở rộng vùng viết";
    setSplitPreset(expanded ? "answer" : "balanced");
    card.querySelector("textarea")?.focus({ preventScroll: true });
  }

  function isWritingQuestion(q) { return normalizeText(q.Phan).includes("viet") && /^(V1|V2)$/i.test(String(q.MaCau||"")); }

  function renderExtraAnswerCard(code, number, text = "") {
    return `<section class="answer-card" data-code="${escapeAttr(code)}"><div class="answer-card-head"><h3>Ô làm bài bổ sung ${number}</h3></div><textarea class="answer-text" data-code="${escapeAttr(code)}" placeholder="Nhập nội dung bổ sung…">${escapeHtml(text)}</textarea><div class="score-line"><span>Ghi chú bổ sung, không tính điểm tự động.</span></div></section>`;
  }

  function addExtraAnswer() {
    state.extraAnswerCount++;
    const code = `EXTRA${state.extraAnswerCount}`;
    els.answerFields.insertAdjacentHTML("beforeend", renderExtraAnswerCard(code, state.extraAnswerCount, ""));
    const wrapper = els.answerFields.lastElementChild;
    const textarea = wrapper.querySelector("textarea");
    textarea.addEventListener("input", () => { scheduleSave(); updateProgress(); });
    textarea.addEventListener("focus", () => setActiveQuestion(code));
    setActiveQuestion(code);
    textarea.focus();
  }

  function collectAnswerData() {
    const questions = questionsForCurrent();
    const qMap = Object.fromEntries(questions.map(q=>[q.MaCau,q]));
    return [...els.answerFields.querySelectorAll(".answer-card")].map(card=>{
      const code=card.dataset.code; const q=qMap[code]||{};
      const text=card.querySelector(".answer-text")?.value.trim()||"";
      const scoreRaw=card.querySelector(".score-input")?.value||"";
      return {MaCau:code,Phan:q.Phan||"Bổ sung",TenCau:q.TenCau||code,YeuCau:q.YeuCau||"",BaiLam:text,DiemTuCham:scoreRaw===""?"":toNumber(scoreRaw),DiemToiDa:toNumber(q.DiemToiDa),BaiVietThamKhao:q.BaiVietThamKhao||"",DapAn:q.DapAn||"",HuongDanCham:q.HuongDanCham||""};
    });
  }

  function scheduleSave() {
    els.saveIndicator.textContent="Đang lưu…"; clearTimeout(state.saveTimer);
    state.saveTimer=setTimeout(()=>{ saveExamData(); els.saveIndicator.textContent="Đã lưu"; },350);
  }
  function examStorageKey(){ return state.current?`van10_exam_${state.current.ID}`:""; }
  function saveExamData(){ if(!state.current)return; const data={answers:collectAnswerData().map(a=>({code:a.MaCau,text:a.BaiLam,score:a.DiemTuCham})),extraAnswerCount:state.extraAnswerCount,startedAt:state.startedAt}; localStorage.setItem(examStorageKey(),JSON.stringify(data)); }
  function restoreExamData(){ const data=readJson(localStorage.getItem(examStorageKey()),{}); state.extraAnswerCount=Number(data.extraAnswerCount||0); state.startedAt=data.startedAt||new Date().toISOString(); state._restoredAnswers=Array.isArray(data.answers)?data.answers:[]; }
  function getSavedAnswer(code){ const row=(state._restoredAnswers||[]).find(x=>x.code===code); return row||{}; }

  function updateProgress() {
    const cards=[...els.answerFields.querySelectorAll(".answer-card")];
    const answered=cards.filter(c=>(c.querySelector(".answer-text")?.value.trim()||"") || ((state.images[c.dataset.code]||[]).length>0)).length;
    const pct=cards.length?Math.round(answered/cards.length*100):0;
    els.progressText.textContent=`${pct}%`; els.progressBar.style.width=`${pct}%`;
    const answers=collectAnswerData(); const total=answers.reduce((s,a)=>s+(typeof a.DiemTuCham==="number"?a.DiemTuCham:0),0); const max=questionsForCurrent().reduce((s,q)=>s+toNumber(q.DiemToiDa),0);
    els.totalScore.textContent=formatNumber(total); els.maxTotalScore.textContent=formatNumber(max||10);
  }

  async function handleImageFiles(code, fileList) {
    const files=[...fileList]; if(!files.length)return;
    const current=state.images[code]||[];
    if(current.length+files.length>MAX_IMAGES_PER_WRITING){ toast(`Mỗi câu chỉ được tối đa ${MAX_IMAGES_PER_WRITING} ảnh.`); return; }
    const input=els.answerFields.querySelector(`.image-input[data-code="${cssEscape(code)}"]`); if(input) input.disabled=true;
    try {
      for (const file of files) {
        if (/hei[cf]/i.test(file.type)||/\.hei[cf]$/i.test(file.name)) { toast(`Ảnh ${file.name} là HEIC/HEIF. Hãy chuyển sang JPG hoặc chụp lại trong trình duyệt.`); continue; }
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) { toast(`Không hỗ trợ tệp ${file.name}.`); continue; }
        toast(`Đang tối ưu ảnh ${file.name}…`);
        const item=await compressImage(file,0);
        current.push(item);
      }
      state.images[code]=current; renderImageGrid(code); updateProgress();
    } catch(err){ toast(err.message||String(err)); }
    finally { if(input){input.disabled=false;input.value="";} }
  }

  async function compressImage(file, rotation=0) {
    const dataUrl=await readFileAsDataUrl(file);
    const img=await loadImage(dataUrl);
    const rotated=Math.abs(rotation)%180===90;
    const sourceW=img.naturalWidth, sourceH=img.naturalHeight;
    const scale=Math.min(1,MAX_IMAGE_SIDE/Math.max(sourceW,sourceH));
    const drawW=Math.max(1,Math.round(sourceW*scale)), drawH=Math.max(1,Math.round(sourceH*scale));
    const canvas=document.createElement("canvas"); canvas.width=rotated?drawH:drawW; canvas.height=rotated?drawW:drawH;
    const ctx=canvas.getContext("2d",{alpha:false}); ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.translate(canvas.width/2,canvas.height/2); ctx.rotate(rotation*Math.PI/180); ctx.drawImage(img,-drawW/2,-drawH/2,drawW,drawH);
    let quality=JPEG_QUALITY; let blob=await canvasToBlob(canvas,"image/jpeg",quality);
    while(blob.size>MAX_IMAGE_BYTES && quality>0.5){quality-=0.08;blob=await canvasToBlob(canvas,"image/jpeg",quality);}
    if(blob.size>MAX_IMAGE_BYTES) throw new Error(`Ảnh ${file.name} vẫn quá lớn sau khi nén.`);
    return {id:cryptoRandomId(),name:file.name.replace(/\.[^.]+$/,".jpg"),blob,dataUrl:URL.createObjectURL(blob),width:canvas.width,height:canvas.height,size:blob.size,rotation};
  }

  function renderImageGrid(code) {
    const grid=document.getElementById(`imageGrid_${code}`); if(!grid)return;
    const list=state.images[code]||[];
    if(!list.length){grid.innerHTML='<div class="image-empty">Chưa chọn ảnh.</div>';return;}
    grid.innerHTML=list.map((item,i)=>`<div class="image-card" data-index="${i}"><div class="image-thumb" data-view="${i}"><img src="${escapeAttr(item.dataUrl)}" alt="Trang ${i+1}"></div><div class="image-caption">Trang ${i+1} · ${formatBytes(item.size)}</div><div class="image-actions"><button type="button" data-action="left" title="Đưa lên trước">←</button><button type="button" data-action="right" title="Đưa xuống sau">→</button><button type="button" data-action="rotate" title="Xoay ảnh">↻</button><button type="button" data-action="remove" title="Xóa ảnh">×</button></div></div>`).join("");
    grid.querySelectorAll(".image-thumb").forEach(el=>el.addEventListener("click",()=>openLightbox(list[Number(el.dataset.view)].dataUrl)));
    grid.querySelectorAll(".image-card").forEach(card=>card.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>imageAction(code,Number(card.dataset.index),btn.dataset.action))));
  }

  async function imageAction(code,index,action) {
    const list=state.images[code]||[]; const item=list[index]; if(!item)return;
    if(action==="remove"){URL.revokeObjectURL(item.dataUrl);list.splice(index,1);}
    if(action==="left"&&index>0)[list[index-1],list[index]]=[list[index],list[index-1]];
    if(action==="right"&&index<list.length-1)[list[index+1],list[index]]=[list[index],list[index+1]];
    if(action==="rotate"){
      try{const file=new File([item.blob],item.name,{type:"image/jpeg"});const next=await compressImage(file,(item.rotation+90)%360);URL.revokeObjectURL(item.dataUrl);list[index]=next;}catch(err){toast(err.message||String(err));}
    }
    state.images[code]=list;renderImageGrid(code);updateProgress();
  }
  function openLightbox(src){els.lightboxImage.src=src;els.imageLightbox.hidden=false;document.body.style.overflow="hidden";}
  function closeLightbox(){els.imageLightbox.hidden=true;els.lightboxImage.src="";document.body.style.overflow="";}

  function setAiScrollBox(box, content, options = {}) {
    if (!box) return;
    const body = box.querySelector(".ai-scroll-body") || box;
    closeAiPanels(box);
    box.hidden = false;
    if (els.aiBackdrop) els.aiBackdrop.hidden = false;
    document.body.classList.add("ai-panel-open");
    box.classList.toggle("is-loading", Boolean(options.loading));
    box.classList.toggle("is-error", Boolean(options.error));
    if (options.html) body.innerHTML = content;
    else body.textContent = content;
    box.scrollTop = 0;
    body.scrollTop = 0;
  }

  function inferQuestionDemand(q) {
    const request = normalizeText(stripHtml(q?.YeuCau || ""));
    const part = normalizeText(q?.Phan || "");
    const code = String(q?.MaCau || "").toUpperCase();
    if (part.includes("viet") || /^V\d+/.test(code)) {
      return "Phần Viết: chấm theo yêu cầu của đề, các mục lớn trong hướng dẫn chấm và đặc trưng của văn nghị luận; không chấm theo mức độ giống bài mẫu.";
    }
    const demands = [];
    if (/(xac dinh|chi ra|neu|ke ten|cho biet|tim|liet ke)/.test(request)) demands.push("nhận biết/trả lời trực tiếp");
    if (/(giai thich|li giai|ly giai|vi sao|tai sao)/.test(request)) demands.push("giải thích/lí giải");
    if (/(phan tich|lam ro)/.test(request)) demands.push("phân tích/làm rõ");
    if (/(tac dung|hieu qua)/.test(request)) demands.push("nêu tác dụng/hiệu quả");
    if (/(nhan xet|danh gia|suy nghi|quan diem|thong diep|bai hoc|lien he)/.test(request)) demands.push("câu hỏi mở/nhận xét/đánh giá");
    return demands.length ? demands.join("; ") : "Cần đọc nguyên văn yêu cầu để xác định chính xác phạm vi trả lời.";
  }

  function getAiSourceContext(maxLength = 9000) {
    const raw = String(state.current?.DeThi || "").trim();
    if (!raw || /^https?:\/\//i.test(raw)) return "";
    return stripHtml(raw).replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  async function requestHint(code) {
    const q=questionsForCurrent().find(x=>x.MaCau===code); if(!q)return;
    const box=document.getElementById(`hint_${code}`);
    setAiScrollBox(box,"AI đang tạo gợi ý…",{loading:true});
    try {
      const context = await getQuestionContext_(code, "hint");
      const sourceContext = getAiSourceContext(6500);
      const prompt=`Bạn là giáo viên Ngữ văn THCS hướng dẫn học sinh tự làm một câu trong đề thi vào lớp 10.

NGUYÊN TẮC BẮT BUỘC:
1. Trước hết phải đọc đúng động từ và phạm vi yêu cầu của câu hỏi. Hỏi gì thì hướng dẫn học sinh làm đúng việc đó; không nâng yêu cầu lên mức cao hơn.
2. Nếu đề chỉ yêu cầu “xác định”, “chỉ ra”, “nêu”, “kể tên”, “cho biết”, “tìm” hoặc “liệt kê”: chỉ gợi ý cách tìm câu trả lời trực tiếp; không yêu cầu giải thích, phân tích, dẫn chứng hay mở rộng nếu đề và hướng dẫn chấm không yêu cầu.
3. Nếu đề yêu cầu giải thích, lí giải, nhận xét, đánh giá hoặc trình bày quan điểm: hướng dẫn học sinh tạo một câu trả lời hợp lí, có cơ sở từ ngữ liệu hoặc hoàn cảnh của câu hỏi. Không buộc học sinh lặp lại nguyên văn đáp án.
4. Với phần Viết: hướng dẫn theo các mục lớn của hướng dẫn chấm và chuẩn văn nghị luận; chấp nhận cách sắp xếp luận điểm, lí lẽ, dẫn chứng và cách diễn đạt khác đáp án hoặc bài tham khảo.
5. Chỉ gợi ý phương pháp và các bước suy nghĩ; tuyệt đối không viết đáp án hoàn chỉnh để học sinh sao chép.
6. Không đưa thêm tiêu chí ngoài yêu cầu, đáp án và hướng dẫn chấm.
7. Trình bày ngắn gọn, rõ ràng, tối đa 280 từ.

THÔNG TIN CÂU HỎI:
- Mã câu: ${q.MaCau}
- Phần: ${q.Phan}
- Dạng yêu cầu được nhận diện sơ bộ: ${inferQuestionDemand(q)}
- Yêu cầu: ${stripHtml(q.YeuCau)}
- Đáp án tham khảo: ${stripHtml(context.DapAn || "")}
- Hướng dẫn chấm: ${stripHtml(context.HuongDanCham || "")}
${sourceContext ? `- Ngữ liệu/đề bài dạng chữ: ${sourceContext}` : "- Ngữ liệu gốc không có dạng chữ trong yêu cầu này; hãy ưu tiên yêu cầu, đáp án và hướng dẫn chấm."}

Hãy đưa ra 2–5 bước tự làm phù hợp đúng cấp độ yêu cầu. Không tiết lộ đáp án hoàn chỉnh.`;
      const result=await callGemini(prompt,{temperature:0.2,maxOutputTokens:2100});
      setAiScrollBox(box,formatRichContent(result),{html:true});
    } catch(err){setAiScrollBox(box,err.message||String(err),{error:true});}
  }

  async function requestAiGrade(code) {
    const q=questionsForCurrent().find(x=>x.MaCau===code); if(!q)return;
    const card=els.answerFields.querySelector(`.answer-card[data-code="${cssEscape(code)}"]`); const answer=card?.querySelector(".answer-text")?.value.trim()||"";
    if(!answer){toast("Hãy nhập bài làm trước khi nhờ AI nhận xét.");return;}
    const box=document.getElementById(`ai_${code}`);
    setAiScrollBox(box,"AI đang nhận xét…",{loading:true});
    try {
      const context = await getQuestionContext_(code, "grade");
      const sourceContext = getAiSourceContext(9000);
      const prompt=`Bạn là giáo viên Ngữ văn THCS chấm tham khảo một câu trong đề thi vào lớp 10.

I. NGUYÊN TẮC CHẤM BẮT BUỘC
1. Chấm đúng phạm vi câu hỏi yêu cầu. Thứ tự ưu tiên: (a) yêu cầu câu hỏi; (b) hướng dẫn chấm; (c) đáp án tham khảo.
2. Không tự thêm yêu cầu giải thích, phân tích, dẫn chứng, trích dẫn, mở rộng hoặc viết thành đoạn nếu đề và hướng dẫn chấm không yêu cầu.
3. Với các động từ “xác định”, “chỉ ra”, “nêu”, “kể tên”, “cho biết”, “tìm”, “liệt kê”: câu trả lời trực tiếp, ngắn gọn nhưng chính xác được xem là đầy đủ. Không trừ điểm vì học sinh không giải thích thêm.
4. Với câu yêu cầu giải thích, lí giải, nhận xét, đánh giá, trình bày suy nghĩ hoặc quan điểm: đáp án chỉ là một phương án tham khảo. Chấp nhận cách trả lời khác nếu đúng trọng tâm, phù hợp ngữ liệu hoặc hoàn cảnh câu hỏi, có logic, không mâu thuẫn dữ kiện rõ ràng, không trực tiếp cổ xúy hành vi trái pháp luật Việt Nam và không trái chuẩn mực đạo đức cơ bản. Không coi việc mô tả, phân tích hoặc phê phán hành vi tiêu cực là cổ xúy.
5. Với câu hỏi mở, không bắt buộc dùng đúng từ khóa, cách diễn đạt hoặc thứ tự ý của đáp án nếu nội dung tương đương và bảo vệ được.
6. Với phần Viết: đáp án và bài tham khảo không phải khuôn duy nhất. Chấp nhận cách trình bày, hệ thống luận điểm, lí lẽ, dẫn chứng, cách mở/kết và cách diễn đạt khác nếu bám đúng vấn đề, đáp ứng các mục lớn trong hướng dẫn chấm, có đặc trưng của văn nghị luận, lập luận hợp lí, nội dung có tính xây dựng, không trực tiếp cổ xúy hành vi trái pháp luật Việt Nam và không trái chuẩn mực đạo đức cơ bản.
7. Với nghị luận văn học, chấp nhận cách cảm nhận khác nếu có căn cứ từ văn bản và lập luận thuyết phục. Với nghị luận xã hội, chấp nhận quan điểm hoặc giải pháp riêng nếu phù hợp thực tế và được lí giải.
8. Không dò độ giống với bài mẫu. Không trừ điểm chỉ vì bài làm khác đáp án về cách triển khai.
9. Chỉ nêu “nội dung bắt buộc còn thiếu” khi bài thực sự thiếu hoặc sai một yêu cầu bắt buộc. Nếu bài đã đủ, phải ghi rõ: “Không có nội dung bắt buộc cần bổ sung.”
10. Lời khuyên nâng cao phải ghi rõ là không ảnh hưởng điểm. Không buộc phải tìm lỗi khi bài làm đã đạt đầy đủ.
11. Điểm không âm, không vượt quá ${toNumber(q.DiemToiDa)} và không phải điểm chính thức.

II. DỮ LIỆU CHẤM
- Mã câu: ${q.MaCau}
- Phần: ${q.Phan}
- Dạng yêu cầu được nhận diện sơ bộ: ${inferQuestionDemand(q)}
- Yêu cầu: ${stripHtml(q.YeuCau)}
- Đáp án tham khảo: ${stripHtml(context.DapAn || "")}
- Hướng dẫn chấm: ${stripHtml(context.HuongDanCham || "")}
- Bài làm học sinh: ${answer}
${sourceContext ? `- Ngữ liệu/đề bài dạng chữ: ${sourceContext}` : "- Ngữ liệu gốc không có dạng chữ trong yêu cầu này; hãy ưu tiên yêu cầu, đáp án và hướng dẫn chấm."}

III. CẤU TRÚC PHẢN HỒI
Kết quả: Đạt đầy đủ / Chưa đầy đủ / Chưa đúng
Đối chiếu yêu cầu và hướng dẫn chấm: nhận xét ngắn gọn, chỉ ra nội dung đã đạt và căn cứ chấm.
Điểm tham khảo: .../${toNumber(q.DiemToiDa)}
Nội dung bắt buộc còn thiếu: liệt kê nếu có; nếu không có, ghi đúng câu “Không có nội dung bắt buộc cần bổ sung.”
Gợi ý nâng cao (không ảnh hưởng điểm): chỉ viết khi thật sự hữu ích; có thể bỏ mục này nếu không cần.

Trình bày súc tích, tối đa 450 từ. Không khẳng định đây là điểm chính thức.`;
      const result=await callGemini(prompt,{temperature:0.15,maxOutputTokens:3000});
      setAiScrollBox(box,formatRichContent(result),{html:true});
    } catch(err){setAiScrollBox(box,err.message||String(err),{error:true});}
  }

  async function getQuestionContext_(code, purpose) {
    if (!state.current || !state.attemptToken) throw new Error("Phiên làm bài không còn hợp lệ. Hãy mở lại đề.");
    const key = `${purpose}:${code}`;
    if (state.questionContexts.has(key)) return state.questionContexts.get(key);
    const data = await apiRequest("/api/attempt/context", {
      method: "POST",
      body: {
        attemptToken: state.attemptToken,
        examId: state.current.ID,
        questionCode: code,
        purpose
      }
    });
    const context = normalizeRows([data.context || {}])[0];
    if (!context?.MaCau || context.MaCau !== code) throw new Error("Không nhận được dữ liệu hướng dẫn cho câu này.");
    if (state.questionContexts.size >= 8) {
      const firstKey = state.questionContexts.keys().next().value;
      state.questionContexts.delete(firstKey);
    }
    state.questionContexts.set(key, context);
    return context;
  }

  async function callGemini(prompt, options = {}) {
    return callGeminiParts(
      [{ text: String(prompt || "") }],
      {
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0.35,
        maxOutputTokens: Number(options.maxOutputTokens || 1800)
      }
    );
  }

  async function callGeminiParts(parts, options = {}) {
    const key=(sessionStorage.getItem("van10_gemini_key")||els.apiKeyInput.value.trim());
    if(!key) throw new Error("Chưa nhập Gemini API Key.");
    const model=window.VAN10_GEMINI_MODEL||"gemini-2.5-flash";
    const body={
      contents:[{parts}],
      generationConfig:{
        temperature:Number.isFinite(options.temperature)?options.temperature:0.25,
        maxOutputTokens:Number(options.maxOutputTokens||2200)
      }
    };
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":key},
      referrerPolicy:"no-referrer",
      credentials:"omit",
      body:JSON.stringify(body)
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data?.error?.message||"Gemini trả về lỗi.");
    return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n")||"AI chưa trả về nội dung.";
  }


  function resetAiScorePanel() {
    if (!els.aiScoreContent || !els.aiScoreStatus || !els.runAiScoreBtn) return;
    els.aiScoreContent.hidden = true;
    els.aiScoreContent.innerHTML = "";
    els.aiScoreStatus.hidden = false;
    els.aiScoreStatus.className = "ai-score-status";
    els.aiScoreStatus.innerHTML = `
      <strong>Chưa chấm bằng AI.</strong>
      <span>Nhấn “Chấm toàn bài bằng AI” sau khi đã nhập Gemini API Key. AI có thể đọc bài nhập bằng bàn phím và một số ảnh bài viết tay đã chọn.</span>`;
    els.runAiScoreBtn.disabled = false;
    els.runAiScoreBtn.textContent = "Chấm toàn bài bằng AI";
  }

  async function requestAiOverallGrade() {
    const snapshot = state.finishedSnapshot;
    if (!snapshot || state.aiOverallRunning) return;
    if (!snapshot.reviewUnlocked) {
      openReviewTab("answerKey");
      toast("Cần mở đáp án và hướng dẫn chấm trước khi AI chấm toàn bài.");
      return;
    }

    const key = sessionStorage.getItem("van10_gemini_key") || els.apiKeyInput.value.trim();
    if (!key) {
      openSettingsDrawer();
      els.utilityDetails.open = true;
      window.setTimeout(() => els.apiKeyInput.focus({ preventScroll: true }), 260);
      toast("Hãy nhập Gemini API Key trong phần thiết lập.");
      return;
    }

    state.aiOverallRunning = true;
    els.runAiScoreBtn.disabled = true;
    els.runAiScoreBtn.textContent = "AI đang chấm…";
    els.aiScoreContent.hidden = true;
    els.aiScoreStatus.hidden = false;
    els.aiScoreStatus.className = "ai-score-status is-loading";
    els.aiScoreStatus.innerHTML = `<strong>AI đang đối chiếu toàn bài…</strong><span>Vui lòng giữ trang mở. Bài viết tay có thể cần thêm thời gian để đọc.</span>`;

    try {
      const parts = await buildOverallGradeParts(snapshot);
      const raw = await callGeminiParts(parts, { temperature: 0.1, maxOutputTokens: 4800 });
      const result = parseAiOverallGrade(raw, snapshot);
      state.aiOverallResult = result;
      renderAiOverallGrade(result, snapshot);
      els.aiScoreStatus.hidden = true;
      els.aiScoreContent.hidden = false;
      els.runAiScoreBtn.textContent = "Chấm lại bằng AI";
    } catch (error) {
      els.aiScoreStatus.hidden = false;
      els.aiScoreStatus.className = "ai-score-status is-error";
      els.aiScoreStatus.innerHTML = `<strong>Chưa chấm được.</strong><span>${escapeHtml(error.message || String(error))}</span>`;
      els.runAiScoreBtn.textContent = "Thử chấm lại";
    } finally {
      state.aiOverallRunning = false;
      els.runAiScoreBtn.disabled = false;
    }
  }

  async function buildOverallGradeParts(snapshot) {
    const answers = snapshot.answers.filter(item => !String(item.MaCau || "").startsWith("EXTRA"));
    const totalMax = answers.reduce((sum, item) => sum + toNumber(item.DiemToiDa), 0);
    const sourceRaw = String(snapshot.exam.DeThi || "").trim();
    const sourceText = /^https?:\/\//i.test(sourceRaw) ? "" : stripHtml(sourceRaw).slice(0, 14000);

    const answerText = answers.map(item => {
      const imageCount = (snapshot.images?.[item.MaCau] || []).length;
      return [
        `MÃ CÂU: ${item.MaCau}`,
        `PHẦN: ${item.Phan || ""}`,
        `TÊN CÂU: ${item.TenCau || ""}`,
        `ĐIỂM TỐI ĐA: ${formatNumber(item.DiemToiDa)}`,
        `YÊU CẦU: ${stripHtml(item.YeuCau || "")}`,
        `ĐÁP ÁN/HƯỚNG DẪN CHẤM: ${stripHtml(`${item.DapAn || ""}\n${item.HuongDanCham || ""}`)}`,
        `BÀI LÀM GÕ BÀN PHÍM: ${item.BaiLam || "[không có]"}`,
        `SỐ ẢNH BÀI VIẾT TAY: ${imageCount}`
      ].join("\n");
    }).join("\n\n---\n\n");

    const prompt = `Bạn là giáo viên Ngữ văn THCS đang chấm tham khảo một bài luyện thi vào lớp 10.

NGUYÊN TẮC CHUNG BẮT BUỘC:
1. Chấm đúng phạm vi từng câu hỏi. Ưu tiên theo thứ tự: yêu cầu câu hỏi → hướng dẫn chấm → đáp án tham khảo.
2. Không tự thêm tiêu chí ngoài dữ liệu. Không yêu cầu giải thích, phân tích, dẫn chứng, trích dẫn hoặc mở rộng nếu đề và hướng dẫn chấm không yêu cầu.
3. Với câu “xác định”, “chỉ ra”, “nêu”, “kể tên”, “cho biết”, “tìm”, “liệt kê”: câu trả lời trực tiếp, ngắn gọn nhưng chính xác được xem là đầy đủ.
4. Với câu giải thích, lí giải, nhận xét, đánh giá, trình bày suy nghĩ hoặc quan điểm: đáp án chỉ là một phương án tham khảo. Chấp nhận câu trả lời khác nếu đúng trọng tâm, phù hợp ngữ liệu hoặc hoàn cảnh, có logic, không mâu thuẫn dữ kiện rõ ràng, không trực tiếp cổ xúy hành vi trái pháp luật Việt Nam và không trái chuẩn mực đạo đức cơ bản. Không coi việc mô tả, phân tích hoặc phê phán hành vi tiêu cực là cổ xúy.
5. Không bắt buộc học sinh dùng đúng từ khóa, cách diễn đạt hoặc thứ tự ý của đáp án khi nội dung tương đương và bảo vệ được.
6. Với phần Viết: đáp án và bài tham khảo không phải khuôn duy nhất. Chấp nhận cách mở bài, kết bài, sắp xếp luận điểm, lí lẽ, dẫn chứng và cách diễn đạt khác nếu bám đúng vấn đề, đáp ứng các mục lớn trong hướng dẫn chấm, bảo đảm đặc trưng văn nghị luận, lập luận hợp lí, nội dung có tính xây dựng, không trực tiếp cổ xúy hành vi trái pháp luật Việt Nam và không trái chuẩn mực đạo đức cơ bản.
7. Với nghị luận văn học, chấp nhận cách cảm nhận khác nếu có căn cứ từ văn bản và lập luận thuyết phục. Với nghị luận xã hội, chấp nhận quan điểm hoặc giải pháp riêng nếu phù hợp thực tế và được lí giải.
8. Không dò độ giống với bài mẫu. Không trừ điểm chỉ vì bài làm triển khai khác đáp án.
9. Phân biệt rõ ba loại: (a) nội dung bắt buộc còn thiếu — có ảnh hưởng điểm; (b) cách triển khai khác nhưng hợp lí — không trừ điểm; (c) gợi ý nâng cao — không ảnh hưởng điểm.
10. Câu đạt đầy đủ phải có requiredMissing là mảng rỗng. Không buộc phải tìm lỗi. Danh sách improvements toàn bài chỉ chứa thiếu sót bắt buộc và được phép là mảng rỗng.
11. Chấp nhận cách diễn đạt tương đương. Chỉ xét lỗi diễn đạt khi làm sai, mơ hồ hoặc ảnh hưởng chất lượng theo tiêu chí của hướng dẫn chấm.
12. Không coi đây là điểm chính thức. Nếu ảnh chữ viết tay khó đọc hoặc thiếu ngữ liệu, phải phản ánh trong confidence và không suy đoán quá mức.

THÔNG TIN ĐỀ:
- Đề: ${snapshot.exam.TinhThanh || snapshot.exam.ID} – ${snapshot.exam.Nam || ""} – ${snapshot.exam.LoaiDe || ""}
- Tổng điểm tối đa theo dữ liệu: ${formatNumber(totalMax)}
${sourceText ? `- NGỮ LIỆU/ĐỀ BÀI DẠNG CHỮ:
${sourceText}
` : `- Ngữ liệu gốc nằm trong tệp PDF nên không có toàn văn dạng chữ trong yêu cầu này. Hãy ưu tiên yêu cầu, đáp án và hướng dẫn chấm; giảm mức độ tin cậy nếu cần.
`}
BÀI LÀM VÀ HƯỚNG DẪN CHẤM:
${answerText}

Trả về DUY NHẤT một đối tượng JSON hợp lệ, không dùng Markdown, không thêm lời dẫn, theo cấu trúc:
{
  "totalScore": 0,
  "maxScore": ${totalMax},
  "confidence": "cao|trung bình|thấp",
  "overallComment": "nhận xét chung ngắn gọn",
  "strengths": ["điểm mạnh thực sự"],
  "improvements": ["chỉ ghi thiếu sót bắt buộc; có thể để mảng rỗng"],
  "questions": [
    {
      "code": "DH1",
      "status": "full|partial|incorrect|blank",
      "score": 0,
      "maxScore": 0.5,
      "comment": "nhận xét cụ thể, không áp đặt đáp án mẫu",
      "basis": "căn cứ ngắn gọn theo yêu cầu, bài làm và hướng dẫn chấm",
      "requiredMissing": ["chỉ ghi nội dung bắt buộc còn thiếu; để rỗng nếu đã đủ"],
      "optionalAdvice": "gợi ý nâng cao không ảnh hưởng điểm; có thể để trống"
    }
  ]
}

Yêu cầu kỹ thuật:
- Chấm đủ tất cả mã câu đã cung cấp.
- Điểm từng câu không âm và không vượt điểm tối đa.
- Tổng điểm bằng tổng điểm từng câu, làm tròn đến 0,25 điểm khi hợp lí.
- Với câu không có bài gõ nhưng có ảnh, đọc ảnh được đính kèm ngay sau lời nhắc này.
- Với câu không có bài làm và không có ảnh, cho 0 điểm, status là "blank".
- Nếu score bằng maxScore thì status phải là "full" và requiredMissing phải là [].`;

    const parts = [{ text: prompt }];
    const maxImages = Math.max(0, Number(window.VAN10_MAX_AI_IMAGES || 4));
    const maxBytes = Math.max(1_000_000, Number(window.VAN10_MAX_AI_IMAGE_TOTAL_BYTES || 8_000_000));
    let usedImages = 0;
    let usedBytes = 0;

    for (const answer of answers) {
      const images = snapshot.images?.[answer.MaCau] || [];
      for (let index = 0; index < images.length; index += 1) {
        if (usedImages >= maxImages) break;
        const image = images[index];
        if (!image?.blob || usedBytes + Number(image.blob.size || 0) > maxBytes) continue;
        const base64 = await blobToBase64(image.blob);
        parts.push({ text: `Ảnh bài viết tay của câu ${answer.MaCau}, trang ${index + 1}:` });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
        usedImages += 1;
        usedBytes += Number(image.blob.size || 0);
      }
      if (usedImages >= maxImages) break;
    }

    if (usedImages) {
      parts.push({ text: `Đã đính kèm ${usedImages} ảnh bài viết tay. Nếu còn ảnh chưa được đính kèm do giới hạn dung lượng, hãy ghi mức độ chắc chắn phù hợp.` });
    }
    return parts;
  }

  function parseAiOverallGrade(raw, snapshot) {
    const cleaned = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let data;
    try {
      data = JSON.parse(cleaned);
    } catch (_) {
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("AI trả về kết quả không đúng định dạng JSON. Hãy thử chấm lại.");
      data = JSON.parse(cleaned.slice(first, last + 1));
    }

    const answerMap = new Map(snapshot.answers.filter(a => !String(a.MaCau || "").startsWith("EXTRA")).map(a => [String(a.MaCau), a]));
    const normalizeMissing = value => {
      if (Array.isArray(value)) return value.map(String).map(x => x.trim()).filter(Boolean).slice(0, 8);
      const text = String(value || "").trim();
      return text ? [text] : [];
    };
    const questions = Array.isArray(data.questions) ? data.questions.map(item => {
      const code = String(item.code || "").trim();
      const original = answerMap.get(code);
      const max = original ? toNumber(original.DiemToiDa) : Math.max(0, toNumber(item.maxScore));
      const score = clamp(roundQuarter(toNumber(item.score)), 0, max);
      let status = String(item.status || "").trim().toLowerCase();
      if (!["full","partial","incorrect","blank"].includes(status)) {
        status = score >= max && max > 0 ? "full" : (score > 0 ? "partial" : "incorrect");
      }
      let requiredMissing = normalizeMissing(item.requiredMissing ?? item.missingRequiredContent);
      if (score >= max && max > 0) {
        status = "full";
        requiredMissing = [];
      }
      return {
        code,
        status,
        score,
        maxScore: max,
        comment: String(item.comment || ""),
        basis: String(item.basis || item.evidence || ""),
        requiredMissing,
        optionalAdvice: String(item.optionalAdvice || item.suggestion || "")
      };
    }).filter(item => item.code && answerMap.has(item.code)) : [];

    answerMap.forEach((answer, code) => {
      if (!questions.some(item => item.code === code)) {
        questions.push({
          code,
          status: "incorrect",
          score: 0,
          maxScore: toNumber(answer.DiemToiDa),
          comment: "AI chưa trả về nhận xét cho câu này.",
          basis: "",
          requiredMissing: ["Chưa có kết quả chấm đáng tin cậy cho câu này."],
          optionalAdvice: "Hãy đối chiếu yêu cầu, hướng dẫn chấm hoặc hỏi giáo viên."
        });
      }
    });

    const maxScore = questions.reduce((sum, item) => sum + item.maxScore, 0);
    const calculatedTotal = roundQuarter(questions.reduce((sum, item) => sum + item.score, 0));
    return {
      totalScore: clamp(calculatedTotal, 0, maxScore),
      maxScore,
      confidence: String(data.confidence || "trung bình"),
      overallComment: String(data.overallComment || ""),
      strengths: Array.isArray(data.strengths) ? data.strengths.map(String).filter(Boolean).slice(0, 6) : [],
      improvements: Array.isArray(data.improvements) ? data.improvements.map(String).filter(Boolean).slice(0, 8) : [],
      questions
    };
  }

  function renderAiOverallGrade(result, snapshot) {
    const answerMap = new Map(snapshot.answers.map(item => [String(item.MaCau), item]));
    const confidenceClass = normalizeText(result.confidence).includes("cao") ? "high" : (normalizeText(result.confidence).includes("thap") ? "low" : "medium");
    const strengths = result.strengths.length ? `<ul>${result.strengths.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p><em>AI chưa nêu điểm mạnh cụ thể.</em></p>";
    const improvements = result.improvements.length
      ? `<ul>${result.improvements.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "<p><em>Không có nội dung bắt buộc cần cải thiện theo kết quả AI.</em></p>";
    const statusLabel = status => ({
      full: "Đạt đầy đủ",
      partial: "Chưa đầy đủ",
      incorrect: "Chưa đúng",
      blank: "Chưa làm"
    })[status] || "Đang đối chiếu";
    const rows = result.questions.map(item => {
      const original = answerMap.get(item.code) || {};
      const missing = item.requiredMissing?.length
        ? `<div><b>Nội dung bắt buộc còn thiếu:</b><ul>${item.requiredMissing.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul></div>`
        : `<div><b>Nội dung bắt buộc còn thiếu:</b> Không có nội dung bắt buộc cần bổ sung.</div>`;
      return `<section class="ai-question-score">
        <div class="ai-question-score-head">
          <div><strong>${escapeHtml(original.Phan ? `${original.Phan} – ${original.TenCau || item.code}` : item.code)}</strong><small>Mã ${escapeHtml(item.code)} · ${escapeHtml(statusLabel(item.status))}</small></div>
          <span>${formatNumber(item.score)}/${formatNumber(item.maxScore)}</span>
        </div>
        ${item.comment ? `<p>${escapeHtml(item.comment)}</p>` : ""}
        ${item.basis ? `<div><b>Căn cứ chấm:</b> ${escapeHtml(item.basis)}</div>` : ""}
        ${missing}
        ${item.optionalAdvice ? `<div><b>Gợi ý nâng cao (không ảnh hưởng điểm):</b> ${escapeHtml(item.optionalAdvice)}</div>` : ""}
      </section>`;
    }).join("");

    els.aiScoreContent.innerHTML = `
      <div class="ai-score-summary-card">
        <div class="ai-score-number"><strong>${formatNumber(result.totalScore)}</strong><span>/ ${formatNumber(result.maxScore)} điểm</span></div>
        <div class="ai-score-summary-copy">
          <span class="ai-confidence is-${confidenceClass}">Độ tin cậy: ${escapeHtml(result.confidence)}</span>
          <p>${escapeHtml(result.overallComment || "AI đã hoàn tất chấm tham khảo.")}</p>
        </div>
      </div>
      <div class="ai-overview-grid">
        <section><h4>Điểm mạnh</h4>${strengths}</section>
        <section><h4>Nội dung bắt buộc cần cải thiện</h4>${improvements}</section>
      </div>
      <div class="ai-question-list">${rows}</div>
      <div class="ai-disclaimer"><b>Lưu ý:</b> Điểm trên do AI ước lượng từ dữ liệu hiện có. Giáo viên mới là người quyết định điểm chính thức, đặc biệt với bài viết sáng tạo và ảnh chữ viết tay khó đọc.</div>`;
  }

  function roundQuarter(value) {
    return Math.round((Number(value) || 0) * 4) / 4;
  }

  function getStickyPageOffset() {
    return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 58;
  }

  function scrollPageToSection(element) {
    if (!element) return;
    element.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  function clearAnswers() {
    if(!state.current||!confirm("Xóa toàn bộ bài làm và ảnh đã chọn của đề này?"))return;
    localStorage.removeItem(examStorageKey()); Object.values(state.images).flat().forEach(i=>URL.revokeObjectURL(i.dataUrl)); state.images={};state.finishedSnapshot=null;state.sentSubmissionId="";state._restoredAnswers=[];state.extraAnswerCount=0;renderAnswerFields();toast("Đã xóa bài làm.");
  }

  async function finishExam() {
    if(!state.current)return;
    saveExamData();
    const answers=collectAnswerData();
    const unanswered=answers.filter(a=>!a.BaiLam && !(state.images[a.MaCau]||[]).length).length;
    if(unanswered && !confirm(`Còn ${unanswered} câu chưa có bài làm hoặc ảnh. Vẫn hoàn thành?`))return;
    const frozenImages = Object.fromEntries(Object.entries(state.images).map(([code,list]) => [code, list.map(item => ({...item}))]));
    state.finishedSnapshot={exam:{...state.current},answers:JSON.parse(JSON.stringify(answers)),startedAt:state.startedAt,finishedAt:new Date().toISOString(),images:frozenImages,imageCounts:Object.fromEntries(Object.entries(frozenImages).map(([k,v])=>[k,v.length])),reviewUnlocked:false};
    state.sentSubmissionId="";
    els.sendSubmissionBtn.textContent="Gửi bài cho giáo viên";
    els.sendSubmissionBtn.disabled=false;
    els.sendResult.hidden=true;
    els.uploadProgress.hidden=true;
    state.aiOverallResult = null;
    state.aiOverallRunning = false;
    resetAiScorePanel();
    els.answerKeyContent.innerHTML='<div class="reference-note">Đang mở đáp án và hướng dẫn chấm an toàn…</div>';
    els.referenceContent.innerHTML='<div class="reference-note">Đang tải bài viết tham khảo…</div>';
    renderSendSummary();
    closeAiPanels();
    els.workspace.hidden=true;
    els.reviewSection.hidden=false;
    els.reviewSection.scrollTop = 0;
    openReviewTab("answerKey");scrollPageToSection(els.reviewSection);
    try {
      await loadReviewData_();
    } catch (error) {
      showReviewLoadError_(error);
    }
  }

  async function loadReviewData_() {
    const snapshot = state.finishedSnapshot;
    if (!snapshot || !state.attemptToken) throw new Error("Phiên làm bài không còn hợp lệ. Hãy mở lại đề.");
    const data = await apiRequest("/api/attempt/review", {
      method: "POST",
      body: {
        attemptToken: state.attemptToken,
        examId: snapshot.exam.ID,
        completedCount: snapshot.answers.filter(answer => answer.BaiLam || (snapshot.images?.[answer.MaCau] || []).length).length
      }
    });
    const hiddenRows = normalizeRows(Array.isArray(data.answers) ? data.answers : []);
    const hiddenByCode = new Map(hiddenRows.map(row => [String(row.MaCau || ""), row]));
    snapshot.answers = snapshot.answers.map(answer => {
      const hidden = hiddenByCode.get(String(answer.MaCau || ""));
      if (!hidden || String(answer.MaCau || "").startsWith("EXTRA")) return answer;
      return {
        ...answer,
        DapAn: hidden.DapAn || "",
        HuongDanCham: hidden.HuongDanCham || "",
        BaiVietThamKhao: hidden.BaiVietThamKhao || ""
      };
    });
    snapshot.reviewUnlocked = true;
    renderAnswerKey();
    renderReferences();
  }

  function showReviewLoadError_(error) {
    const wait = Math.max(0, Number(error?.retryAfterSeconds || 0));
    const detail = wait
      ? `Đáp án sẽ sẵn sàng sau khoảng ${wait} giây.`
      : escapeHtml(error?.message || "Chưa thể tải đáp án.");
    els.answerKeyContent.innerHTML = `<div class="reference-note"><b>Chưa mở được đáp án.</b><br>${detail}<br><button id="retryReviewBtn" class="secondary-btn" type="button">Thử lại</button></div>`;
    els.referenceContent.innerHTML = '<div class="reference-note">Bài tham khảo sẽ hiển thị sau khi mở đáp án thành công.</div>';
    document.getElementById("retryReviewBtn")?.addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = "Đang thử lại…";
      try {
        await loadReviewData_();
      } catch (nextError) {
        showReviewLoadError_(nextError);
      }
    });
  }

  function backToWork() {
    els.reviewSection.hidden = true;
    els.workspace.hidden = false;
    scrollPageToSection(els.workspace);
    if (state.activeQuestionCode) window.setTimeout(() => scrollToAnswerQuestion(state.activeQuestionCode), 260);
  }
  function openReviewTab(tab){
    document.querySelectorAll(".review-tab").forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    ["answerKey","aiScore","references","sendTeacher"].forEach(name => {
      const panel = document.getElementById(`${name}Panel`);
      const active = name === tab;
      panel.classList.toggle("is-active", active);
      panel.setAttribute("aria-hidden", String(!active));
    });
  }

  function renderAnswerKey() {
    const snapshot=state.finishedSnapshot; if(!snapshot)return;
    els.answerKeyContent.innerHTML=snapshot.answers.filter(a=>!a.MaCau.startsWith("EXTRA")).map(a=>`<section class="review-question"><h3>${escapeHtml(a.Phan)} – ${escapeHtml(a.TenCau||a.MaCau)} <small>(${formatNumber(a.DiemToiDa)} điểm)</small></h3><div class="question-prompt">${formatRichContent(a.YeuCau)}</div><div class="review-grid"><div class="review-box"><h4>Bài làm của học sinh</h4>${a.BaiLam?formatPlainText(a.BaiLam):'<em>Không nhập nội dung bằng bàn phím.</em>'}${renderImageCount(a.MaCau)}</div><div class="review-box"><h4>Đáp án – hướng dẫn chấm</h4>${formatRichContent(a.DapAn||"")}${a.HuongDanCham?`<hr>${formatRichContent(a.HuongDanCham)}`:""}</div></div></section>`).join("") || "<p>Chưa có dữ liệu câu hỏi.</p>";
  }
  function renderImageCount(code){const count=(state.finishedSnapshot?.images?.[code]||[]).length;return count?`<p><b>Ảnh bài viết tay:</b> ${count} ảnh.</p>`:"";}
  function renderReferences() {
    const refs=state.finishedSnapshot.answers.filter(a=>/^(V1|V2)$/i.test(a.MaCau));
    els.referenceContent.innerHTML=`<div class="reference-note">Bài viết dưới đây chỉ là một cách triển khai tham khảo, không phải đáp án duy nhất. Học sinh cần đối chiếu để tự sửa bài, không sao chép máy móc.</div>` + refs.map(a=>`<section class="reference-card"><h3>${escapeHtml(a.Phan)} – ${escapeHtml(a.TenCau||a.MaCau)}</h3><div class="question-prompt">${formatRichContent(a.YeuCau)}</div>${a.BaiVietThamKhao?formatRichContent(a.BaiVietThamKhao):'<p><em>Chưa cập nhật bài viết tham khảo cho câu này.</em></p>'}</section>`).join("");
  }
  function renderSendSummary() {
    if(!state.finishedSnapshot)return;
    const frozenImages=state.finishedSnapshot.images||{}; const counts=Object.values(frozenImages).reduce((s,a)=>s+a.length,0); const bytes=Object.values(frozenImages).flat().reduce((s,i)=>s+i.size,0);
    els.sendSummary.innerHTML=`<b>Đề:</b> ${escapeHtml(state.finishedSnapshot.exam.TinhThanh)} ${escapeHtml(state.finishedSnapshot.exam.Nam)} · <b>Số câu:</b> ${state.finishedSnapshot.answers.length} · <b>Ảnh viết tay:</b> ${counts} (${formatBytes(bytes)})`;
  }

  async function sendSubmission() {
    if(state.posting)return;
    if(state.sentSubmissionId){toast(`Bài đã được gửi. Mã bài nộp: ${state.sentSubmissionId}`);return;}
    const email=els.teacherEmail.value.trim();
    if(!isValidEmail(email)){toast("Email giáo viên chưa đúng định dạng.");return;}
    if(!els.confirmOwnWork.checked){toast("Hãy tích xác nhận trước khi gửi.");return;}
    if(!els.studentName.value.trim()){toast("Hãy nhập họ và tên học sinh.");return;}
    if(!state.finishedSnapshot){toast("Hãy hoàn thành bài làm trước.");return;}
    state.posting=true;els.sendSubmissionBtn.disabled=true;els.sendResult.hidden=true;showUploadProgress(1,"Đang tạo bài nộp…");
    try {
      const payload={
        examId:state.finishedSnapshot.exam.ID,
        student:{HoTen:els.studentName.value.trim(),Lop:els.studentClass.value.trim(),Truong:els.studentSchool.value.trim()},
        teacherEmail:email,message:els.teacherMessage.value.trim(),
        startedAt:state.finishedSnapshot.startedAt,finishedAt:state.finishedSnapshot.finishedAt,
        answers:state.finishedSnapshot.answers.map(a=>({MaCau:a.MaCau,Phan:a.Phan,TenCau:a.TenCau,BaiLam:a.BaiLam,DiemTuCham:a.DiemTuCham,DiemToiDa:a.DiemToiDa}))
      };
      const created=await postApi("createSubmission",payload);
      const allImages=[];Object.entries(state.finishedSnapshot.images||{}).forEach(([code,list])=>list.forEach((item,index)=>allImages.push({code,index,item})));
      for(let i=0;i<allImages.length;i++){
        const row=allImages[i];const base64=await blobToBase64(row.item.blob);
        const pct=Math.round(5+(i/Math.max(1,allImages.length))*80);showUploadProgress(pct,`Đang tải ảnh ${i+1}/${allImages.length}…`);
        await postApi("uploadImage",{submissionId:created.submissionId,uploadToken:created.uploadToken,examId:state.finishedSnapshot.exam.ID,questionCode:row.code,order:row.index+1,fileName:row.item.name,mimeType:"image/jpeg",base64,width:row.item.width,height:row.item.height});
      }
      showUploadProgress(90,"Đang gửi email cho giáo viên…");
      const done=await postApi("finalizeSubmission",{submissionId:created.submissionId,uploadToken:created.uploadToken,teacherEmail:email,message:els.teacherMessage.value.trim()});
      showUploadProgress(100,"Hoàn tất");showSendResult(true,done.message||`Đã gửi bài đến ${email}. Mã bài nộp: ${created.submissionId}`);
      state.sentSubmissionId=created.submissionId;
      els.sendSubmissionBtn.textContent="Đã gửi bài";
    } catch(err){showSendResult(false,err.message||String(err));}
    finally{state.posting=false;els.sendSubmissionBtn.disabled=Boolean(state.sentSubmissionId);}
  }

  function postApi(action,payload) {
    const routes = {
      createSubmission: "/api/submissions/create",
      uploadImage: "/api/submissions/image",
      finalizeSubmission: "/api/submissions/finalize"
    };
    const path = routes[action];
    if (!path) return Promise.reject(new Error("Thao tác gửi bài không hợp lệ."));
    return apiRequest(path, {
      method: "POST",
      body: {
        ...(payload || {}),
        attemptToken: state.attemptToken,
        examId: state.current?.ID || state.finishedSnapshot?.exam?.ID || ""
      },
      timeoutMs: action === "uploadImage" ? 60000 : 120000
    });
  }

  async function apiRequest(path, options = {}) {
    const base = String(window.VAN10_API_BASE_URL || "").trim().replace(/\/+$/, "");
    let endpoint;
    try {
      endpoint = new URL(`${base}${path}`);
    } catch (_) {
      throw new Error("Chưa cấu hình đúng địa chỉ API bảo mật.");
    }
    const local = endpoint.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(endpoint.hostname);
    if (endpoint.protocol !== "https:" && !local) throw new Error("API bảo mật phải sử dụng HTTPS.");

    const method = String(options.method || "GET").toUpperCase();
    const headers = {
      "Accept": "application/json",
      "X-VAN10-Client": state.apiClientId
    };
    const init = {
      method,
      headers,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    };
    if (method !== "GET" && options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    init.signal = controller.signal;
    const timeoutMs = Math.max(3000, Number(options.timeoutMs || window.VAN10_API_TIMEOUT_MS || 20000));
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint.toString(), init);
      const text = await response.text();
      let payload = {};
      try { payload = text ? JSON.parse(text) : {}; }
      catch (_) { throw new Error("Máy chủ trả về dữ liệu không hợp lệ."); }
      if (!response.ok || payload.success !== true) {
        const error = new Error(payload.error || "Máy chủ chưa thể xử lí yêu cầu.");
        error.code = payload.code || `HTTP_${response.status}`;
        error.retryAfterSeconds = Number(payload.retryAfterSeconds || response.headers.get("Retry-After") || 0);
        throw error;
      }
      return payload.data || {};
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Máy chủ phản hồi quá thời gian. Hãy kiểm tra kết nối và thử lại.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }
  function showUploadProgress(pct,text){els.uploadProgress.hidden=false;els.uploadProgressText.textContent=text;els.uploadProgressPercent.textContent=`${pct}%`;els.uploadProgressBar.style.width=`${pct}%`;}
  function showSendResult(ok,text){els.sendResult.hidden=false;els.sendResult.className=`send-result ${ok?"success":"error"}`;els.sendResult.textContent=text;}

  function renderDocument(content) {
    const raw = String(content || "").trim();
    const pdf = toPdfPreview(raw);
    if (pdf) {
      return `
        <div class="pdf-protected-shell" data-pdf-protected="true">
          <div class="pdf-protected-viewport">
            <iframe
              class="pdf-frame"
              src="${escapeAttr(pdf.preview)}"
              title="Tệp PDF đề thi - chỉ xem trực tuyến"
              loading="eager"
              sandbox="allow-scripts allow-same-origin"
              referrerpolicy="no-referrer"
            ></iframe>
            ${pdf.maskToolbar ? '<div class="pdf-toolbar-mask" aria-hidden="true"><span>Đề thi · chỉ xem trực tuyến</span></div>' : ''}
          </div>
          <p class="pdf-protected-note">Đề thi chỉ hiển thị để làm bài trực tuyến; chức năng tải xuống và mở toàn màn hình đã được ẩn.</p>
        </div>`;
    }
    return formatRichContent(raw);
  }
  function toPdfPreview(value) {
    const drive = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i) || value.match(/[?&]id=([\w-]{20,})/i);
    if (drive) {
      const id = drive[1];
      return { preview: `https://drive.google.com/file/d/${id}/preview`, maskToolbar: true };
    }
    if (/^https:\/\/.+\.pdf(?:[?#].*)?$/i.test(value) && isTrustedContentUrl_(value)) {
      const separator = value.includes("#") ? "&" : "#";
      return { preview: `${value}${separator}toolbar=0&navpanes=0&scrollbar=1&view=FitH`, maskToolbar: false };
    }
    return null;
  }
  function formatRichContent(value) {
    let html = normalizeUnicodeText(value);
    if (!/<[a-z][\s\S]*>/i.test(html)) html = markdownLite(html);
    return normalizeUnicodeText(sanitizeHtml(html));
  }
  function markdownLite(text){return escapeHtml(text).replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/^## (.+)$/gm,"<h2>$1</h2>").replace(/^# (.+)$/gm,"<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\*(.+?)\*/g,"<i>$1</i>").replace(/\r?\n/g,"<br>");}
  function sanitizeHtml(html) {
    const doc=new DOMParser().parseFromString(`<div>${html}</div>`,"text/html"); const allowed=new Set(["DIV","P","BR","B","STRONG","I","EM","U","S","H1","H2","H3","H4","UL","OL","LI","BLOCKQUOTE","TABLE","THEAD","TBODY","TR","TH","TD","HR","SPAN","A","IMG","SUP","SUB"]);
    [...doc.body.querySelectorAll("*")].forEach(node=>{
      if(!allowed.has(node.tagName)){node.replaceWith(...node.childNodes);return;}
      [...node.attributes].forEach(attr=>{const n=attr.name.toLowerCase();if(!["href","src","alt","title","align","target","rel","colspan","rowspan"].includes(n))node.removeAttribute(attr.name);});
      if(node.tagName==="A"){const href=node.getAttribute("href")||"";if(!/^https:\/\//i.test(href))node.removeAttribute("href");else{node.setAttribute("target","_blank");node.setAttribute("rel","noopener noreferrer");}}
      if(node.tagName==="IMG"){
        const src=node.getAttribute("src")||"";
        if(!isTrustedContentUrl_(src)){node.remove();return;}
        node.setAttribute("loading","lazy");
        node.setAttribute("referrerpolicy","no-referrer");
      }
    });
    return doc.body.firstElementChild.innerHTML;
  }

  function formatPlainText(text){return `<p>${escapeHtml(normalizeUnicodeText(text)).replace(/\n/g,"<br>")}</p>`;}
  function stripHtml(value){const d=document.createElement("div");d.innerHTML=normalizeUnicodeText(value);return normalizeUnicodeText(d.textContent||"");}
  function setStatus(text, type = "") {
    const normalizedType = type || "loading";
    els.dataHealth.className = `data-health is-${normalizedType}`;
    els.dataHealth.title = text;
    els.dataStatusText.textContent = type === "success"
      ? `${state.exams.length} đề · ${state.questions.length} câu`
      : (type === "error" ? "Lỗi dữ liệu" : "Đang tải dữ liệu…");

    if (type === "error") {
      els.statusBar.hidden = false;
      els.statusBar.textContent = text;
      els.statusBar.className = "status-bar error";
    } else {
      els.statusBar.hidden = true;
      els.statusBar.textContent = "";
      els.statusBar.className = "status-bar";
    }
  }
  function toast(text){clearTimeout(state.toastTimer);els.toast.textContent=text;els.toast.classList.add("show");state.toastTimer=setTimeout(()=>els.toast.classList.remove("show"),3500);}
  function escapeHtml(v){return normalizeUnicodeText(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function escapeAttr(v){return escapeHtml(v);}
  function normalizeText(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
  function toNumber(v){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:0;}
  function formatNumber(v){return Number(v||0).toLocaleString("vi-VN",{maximumFractionDigits:2});}
  function formatBytes(bytes){if(!bytes)return"0 B";const units=["B","KB","MB","GB"];const i=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));return`${(bytes/1024**i).toFixed(i?1:0)} ${units[i]}`;}
  function readJson(text,fallback){try{return JSON.parse(text)||fallback;}catch{return fallback;}}
  function debounce(fn,wait){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};}
  function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Không đọc được ảnh."));r.readAsDataURL(file);});}
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Không mở được ảnh."));img.src=src;});}
  function canvasToBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Không nén được ảnh.")),type,quality));}
  function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.onerror=()=>reject(new Error("Không mã hóa được ảnh."));r.readAsDataURL(blob);});}
  function cryptoRandomId(){if(crypto?.randomUUID)return crypto.randomUUID();return`${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;}
  function getOrCreateApiClientId_(){let id=sessionStorage.getItem("van10_api_client");if(!/^[A-Za-z0-9_-]{20,80}$/.test(id||"")){id=cryptoRandomId();sessionStorage.setItem("van10_api_client",id);}return id;}
  function purgeLegacySensitiveStorage_(){
    const configured=Array.isArray(window.VAN10_LEGACY_CACHE_KEYS)?window.VAN10_LEGACY_CACHE_KEYS:[];
    configured.forEach(key=>localStorage.removeItem(String(key)));
    for(let i=localStorage.length-1;i>=0;i-=1){const key=localStorage.key(i)||"";if(/^van10_exam_data_cache_/i.test(key))localStorage.removeItem(key);}
  }
  function isTrustedContentUrl_(value){
    try{
      const url=new URL(String(value||""),location.href);
      if(url.protocol!=="https:")return false;
      const host=url.hostname.toLowerCase();
      return host===location.hostname.toLowerCase() || host==="drive.google.com" || host==="docs.google.com" || host.endsWith(".googleusercontent.com") || host.endsWith(".ggpht.com") || host.endsWith(".blogspot.com") || host==="hoclieuso.id.vn" || host.endsWith(".hoclieuso.id.vn") || host==="hls.id.vn" || host.endsWith(".hls.id.vn");
    }catch{return false;}
  }
  function safeErrorText_(error){return String(error?.message||error||"Lỗi không xác định").replace(/[\r\n]+/g," ").slice(0,180);}
  function isValidEmail(v){return/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);}
  function cssEscape(v){return window.CSS&&CSS.escape?CSS.escape(v):String(v).replace(/[^a-zA-Z0-9_-]/g,"\\$&");}
})();
