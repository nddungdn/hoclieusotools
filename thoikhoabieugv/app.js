(() => {
  "use strict";

  const CONFIG = window.TKB_CONFIG || {};
  const DAYS = [
    { key: "mon", label: "Thứ Hai", short: "T2" },
    { key: "tue", label: "Thứ Ba", short: "T3" },
    { key: "wed", label: "Thứ Tư", short: "T4" },
    { key: "thu", label: "Thứ Năm", short: "T5" },
    { key: "fri", label: "Thứ Sáu", short: "T6" },
    { key: "sat", label: "Thứ Bảy", short: "T7" },
  ];
  const SESSIONS = ["Sáng", "Chiều"];
  const CACHE_PREFIX = "tkb_lhp_v3:";

  const state = {
    view: CONFIG.defaultView === "teacher" ? "teacher" : "student",
    bootstrap: { classes: [], teachers: [], subjects: [], timeBlocks: [] },
    selected: { student: "", teacher: "" },
    timetable: null,
    activeDay: currentDayKey(),
    mode: "live",
    updatedAt: "",
    deferredInstallPrompt: null,
    toastTimer: null,
  };

  const el = {};

  const DEMO = createDemoData();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    collectElements();
    applyConfig();
    setupTheme();
    setupClock();
    setupEvents();
    setupInstall();
    registerServiceWorker();

    const query = new URLSearchParams(window.location.search);
    const queryView = query.get("view");
    if (queryView === "teacher" || queryView === "student") state.view = queryView;
    if (query.get("id")) state.selected[state.view] = query.get("id");

    renderViewTabs();
    loadBootstrap(false);
  }

  function collectElements() {
    [
      "authority-name",
      "school-name",
      "footer-school-name",
      "notice-text",
      "live-clock-text",
      "theme-button",
      "home-link",
      "find-teacher-button",
      "tab-student",
      "tab-teacher",
      "entity-label",
      "entity-select",
      "refresh-button",
      "share-button",
      "print-button",
      "install-button",
      "data-status",
      "current-period",
      "current-period-title",
      "current-period-detail",
      "loading-view",
      "empty-view",
      "error-view",
      "error-message",
      "retry-button",
      "schedule-view",
      "schedule-kicker",
      "workspace-title",
      "effective-date",
      "schedule-meta",
      "desktop-schedule",
      "day-tabs",
      "day-panel",
      "schedule-note",
      "schedule-note-text",
      "toast",
      "find-teacher-dialog",
      "find-teacher-form",
      "finder-close-button",
      "finder-subject",
      "finder-session",
      "finder-day",
      "finder-period",
      "finder-submit-button",
      "finder-results",
    ].forEach((id) => {
      el[toCamel(id)] = document.getElementById(id);
    });
  }

  function applyConfig() {
    const schoolName = CONFIG.schoolName || "TRƯỜNG THCS LÊ HỒNG PHONG";
    el.schoolName.textContent = schoolName;
    el.footerSchoolName.textContent = titleCase(schoolName);
    el.authorityName.textContent = CONFIG.authorityName || "THỜI KHÓA BIỂU TRỰC TUYẾN";
    el.noticeText.textContent = CONFIG.notice || "Vui lòng theo dõi thông báo mới nhất của nhà trường.";
    el.homeLink.href = CONFIG.homeUrl || "https://www.hoclieuso.id.vn/";
    document.title = `Thời khóa biểu | ${titleCase(schoolName)}`;
  }

  function setupEvents() {
    el.tabStudent.addEventListener("click", () => switchView("student"));
    el.tabTeacher.addEventListener("click", () => switchView("teacher"));
    el.entitySelect.addEventListener("change", () => {
      state.selected[state.view] = el.entitySelect.value;
      localStorage.setItem(`${CACHE_PREFIX}last:${state.view}`, el.entitySelect.value);
      updateAddressBar();
      loadTimetable(false);
    });
    el.refreshButton.addEventListener("click", () => loadBootstrap(true));
    el.retryButton.addEventListener("click", () => loadBootstrap(true));
    el.shareButton.addEventListener("click", shareCurrentSchedule);
    el.printButton.addEventListener("click", () => window.print());
    el.themeButton.addEventListener("click", toggleTheme);
    el.findTeacherButton.addEventListener("click", openTeacherFinder);
    el.finderCloseButton.addEventListener("click", () => el.findTeacherDialog.close());
    el.findTeacherForm.addEventListener("submit", findFreeTeachers);
    el.findTeacherDialog.addEventListener("click", (event) => {
      if (event.target === el.findTeacherDialog) el.findTeacherDialog.close();
    });
  }

  function setupTheme() {
    const saved = localStorage.getItem(`${CACHE_PREFIX}theme`);
    const shouldUseDark = saved
      ? saved === "dark"
      : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem(`${CACHE_PREFIX}theme`, dark ? "dark" : "light");
  }

  function setupClock() {
    const render = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("vi-VN", {
        timeZone: CONFIG.timezone || "Asia/Ho_Chi_Minh",
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      el.liveClockText.textContent = capitalizeFirst(formatter.format(now));
      renderCurrentPeriod(now);
    };
    render();
    window.setInterval(render, 1000);
  }

  async function loadBootstrap(force) {
    showLoading();
    setBusy(true);

    try {
      const result = await getBootstrap(force);
      state.bootstrap = result.data;
      state.mode = result.mode;
      state.updatedAt = result.updatedAt || "";
      populateEntitySelect();
      populateFinderSubjects();
      renderDataStatus();
      await loadTimetable(force);
    } catch (error) {
      showError(error.message || "Không thể kết nối với nguồn dữ liệu.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTimetable(force) {
    const id = state.selected[state.view];
    if (!id) {
      state.timetable = null;
      showEmpty();
      return;
    }

    showLoading();
    setBusy(true);
    try {
      const result = await getTimetable(state.view, id, force);
      state.timetable = result.data;
      state.mode = result.mode;
      state.updatedAt = result.updatedAt || state.updatedAt;
      renderSchedule();
      renderDataStatus();
    } catch (error) {
      showError(error.message || "Không tìm thấy thời khóa biểu đã chọn.");
    } finally {
      setBusy(false);
    }
  }

  async function getBootstrap(force) {
    if (!isApiConfigured()) {
      if (CONFIG.demoModeWhenApiMissing === false) {
        throw new Error("Chưa cấu hình URL Google Apps Script trong file config.js.");
      }
      return { data: DEMO.bootstrap, mode: "demo", updatedAt: "" };
    }

    const cacheKey = "bootstrap";
    if (!force) {
      const cached = readCache(cacheKey, false);
      if (cached) return { data: cached.data, mode: "cache", updatedAt: cached.updatedAt };
    }

    try {
      const response = await requestApi({ action: "bootstrap" });
      const data = response.data || response;
      validateBootstrap(data);
      writeCache(cacheKey, data, response.updatedAt);
      return { data, mode: "live", updatedAt: response.updatedAt || "" };
    } catch (error) {
      const cached = readCache(cacheKey, true);
      if (cached) return { data: cached.data, mode: "offline", updatedAt: cached.updatedAt };
      throw error;
    }
  }

  async function getTimetable(view, id, force) {
    if (!isApiConfigured()) {
      const data = view === "student" ? DEMO.students[id] : DEMO.teachers[id];
      if (!data) throw new Error("Không có dữ liệu minh họa cho lựa chọn này.");
      return { data, mode: "demo", updatedAt: "" };
    }

    const cacheKey = `timetable:${view}:${id}`;
    if (!force) {
      const cached = readCache(cacheKey, false);
      if (cached) return { data: cached.data, mode: "cache", updatedAt: cached.updatedAt };
    }

    try {
      const response = await requestApi({ action: "timetable", type: view, id });
      const data = response.data || response;
      validateTimetable(data);
      writeCache(cacheKey, data, response.updatedAt);
      return { data, mode: "live", updatedAt: response.updatedAt || "" };
    } catch (error) {
      const cached = readCache(cacheKey, true);
      if (cached) return { data: cached.data, mode: "offline", updatedAt: cached.updatedAt };
      throw error;
    }
  }

  async function requestApi(params) {
    const url = new URL(String(CONFIG.apiUrl).trim());
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("t", Date.now());

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Máy chủ trả về lỗi ${response.status}.`);
      const payload = await response.json();
      if (payload.success === false) throw new Error(payload.message || "Yêu cầu không thành công.");
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Kết nối quá lâu. Vui lòng thử lại.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function validateBootstrap(data) {
    if (
      !data ||
      !Array.isArray(data.classes) ||
      !Array.isArray(data.teachers) ||
      !Array.isArray(data.timeBlocks)
    ) {
      throw new Error("Dữ liệu lớp, giáo viên hoặc thời gian biểu không đúng cấu trúc.");
    }
  }

  function validateTimetable(data) {
    if (!data || !data.schedule || !data.id) {
      throw new Error("Dữ liệu thời khóa biểu không đúng cấu trúc.");
    }
  }

  function populateEntitySelect() {
    const items = state.view === "student" ? state.bootstrap.classes : state.bootstrap.teachers;
    el.entityLabel.textContent = state.view === "student" ? "Chọn lớp" : "Chọn giáo viên";
    el.entitySelect.replaceChildren();

    if (!items.length) {
      const option = new Option("Chưa có dữ liệu", "");
      el.entitySelect.add(option);
      state.selected[state.view] = "";
      return;
    }

    for (const item of items) {
      el.entitySelect.add(new Option(item.name || item.id, item.id));
    }

    const requested = state.selected[state.view];
    const saved = localStorage.getItem(`${CACHE_PREFIX}last:${state.view}`);
    const validRequested = items.some((item) => item.id === requested) ? requested : "";
    const validSaved = items.some((item) => item.id === saved) ? saved : "";
    state.selected[state.view] = validRequested || validSaved || items[0].id;
    el.entitySelect.value = state.selected[state.view];
    updateAddressBar();
  }

  function populateFinderSubjects() {
    const current = el.finderSubject.value;
    const subjects = Array.isArray(state.bootstrap.subjects) ? state.bootstrap.subjects : [];
    el.finderSubject.replaceChildren(new Option("Tất cả môn", ""));
    subjects.forEach((subject) => el.finderSubject.add(new Option(subject, subject)));
    if (subjects.includes(current)) el.finderSubject.value = current;
  }

  function openTeacherFinder() {
    el.finderResults.textContent = "Chọn buổi, thứ và tiết rồi nhấn tìm kiếm.";
    if (typeof el.findTeacherDialog.showModal === "function") {
      el.findTeacherDialog.showModal();
    } else {
      el.findTeacherDialog.setAttribute("open", "");
    }
  }

  async function findFreeTeachers(event) {
    event.preventDefault();
    const params = {
      action: "findFreeTeachers",
      buoi: el.finderSession.value,
      thu: el.finderDay.value,
      tiet: el.finderPeriod.value,
      toCM: el.finderSubject.value,
    };
    el.finderSubmitButton.disabled = true;
    el.finderResults.textContent = "Đang tìm giáo viên rảnh...";

    try {
      let teachers;
      if (isApiConfigured()) {
        const response = await requestApi(params);
        teachers = response.data || [];
      } else {
        teachers = findFreeTeachersInDemo(params);
      }
      renderFinderResults(teachers, params);
    } catch (error) {
      el.finderResults.textContent = error.message || "Không thể tìm giáo viên lúc này.";
    } finally {
      el.finderSubmitButton.disabled = false;
    }
  }

  function findFreeTeachersInDemo(params) {
    const wantedSubject = normalizeText(params.toCM);
    return Object.values(DEMO.teachers)
      .filter((teacher) => !getScheduleValue(teacher, params.buoi, params.tiet, params.thu))
      .filter((teacher) => {
        if (!wantedSubject) return true;
        return (teacher.subjects || []).some((subject) => normalizeText(subject).includes(wantedSubject));
      })
      .map((teacher) => ({ id: teacher.id, name: teacher.title, subjects: teacher.subjects || [] }));
  }

  function renderFinderResults(teachers, params) {
    const list = Array.isArray(teachers) ? teachers : [];
    const day = DAYS.find((item) => item.key === params.thu);
    el.finderResults.replaceChildren();
    const summary = document.createElement("p");
    summary.className = "finder-result-summary";
    summary.textContent = list.length
      ? `${list.length} giáo viên rảnh · ${day?.label || params.thu}, buổi ${params.buoi.toLocaleLowerCase("vi-VN")}, tiết ${params.tiet}`
      : `Chưa tìm thấy giáo viên phù hợp ở ${day?.label || params.thu}, buổi ${params.buoi.toLocaleLowerCase("vi-VN")}, tiết ${params.tiet}.`;
    el.finderResults.append(summary);
    if (!list.length) return;

    const pills = document.createElement("div");
    pills.className = "teacher-pills";
    list.forEach((teacher) => {
      const pill = document.createElement("span");
      pill.className = "teacher-pill";
      pill.textContent = typeof teacher === "string" ? teacher : teacher.name || teacher.id;
      pills.append(pill);
    });
    el.finderResults.append(pills);
  }

  function switchView(view) {
    if (view === state.view) return;
    state.view = view;
    state.timetable = null;
    state.activeDay = currentDayKey();
    renderViewTabs();
    populateEntitySelect();
    loadTimetable(false);
  }

  function renderViewTabs() {
    const studentActive = state.view === "student";
    el.tabStudent.classList.toggle("is-active", studentActive);
    el.tabTeacher.classList.toggle("is-active", !studentActive);
    el.tabStudent.setAttribute("aria-selected", String(studentActive));
    el.tabTeacher.setAttribute("aria-selected", String(!studentActive));
  }

  function renderSchedule() {
    const data = state.timetable;
    hideAllViews();
    el.scheduleView.hidden = false;

    el.scheduleKicker.textContent =
      state.view === "student" ? "THỜI KHÓA BIỂU HỌC SINH" : "THỜI KHÓA BIỂU GIÁO VIÊN";
    el.workspaceTitle.textContent = data.title || data.id;
    el.effectiveDate.textContent = CONFIG.effectiveDate || "";
    renderMeta(data);
    renderDesktopTable(data);
    renderMobileSchedule(data);

    const note = String(data.note || "").trim();
    el.scheduleNote.hidden = !note;
    el.scheduleNoteText.textContent = note;
  }

  function renderMeta(data) {
    el.scheduleMeta.replaceChildren();
    if (state.view === "student") {
      if (data.homeroomTeacher) addMetaPill("GVCN", data.homeroomTeacher);
      if (data.phone) addMetaPill("Liên hệ", data.phone);
    } else {
      addMetaPill("Giáo viên", data.title || data.id);
    }
  }

  function addMetaPill(label, value) {
    const span = document.createElement("span");
    span.className = "meta-pill";
    span.append(document.createTextNode(`${label}: `));
    const strong = document.createElement("strong");
    strong.textContent = value;
    span.append(strong);
    el.scheduleMeta.append(span);
  }

  function renderDesktopTable(data) {
    el.desktopSchedule.replaceChildren();
    const days = visibleDays();
    const table = document.createElement("table");
    table.className = "schedule-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Buổi", "Tiết"].forEach((label) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headRow.append(th);
    });
    for (const day of days) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = day.label;
      th.classList.toggle("is-today", day.key === currentDayKey());
      headRow.append(th);
    }
    thead.append(headRow);
    table.append(thead);

    for (const session of SESSIONS) {
      const tbody = document.createElement("tbody");
      for (let period = 1; period <= 5; period += 1) {
        const tr = document.createElement("tr");
        if (period === 1) {
          const sessionCell = document.createElement("th");
          sessionCell.scope = "rowgroup";
          sessionCell.rowSpan = 5;
          sessionCell.className = "session-cell";
          sessionCell.textContent = session;
          tr.append(sessionCell);
        }

        const periodCell = document.createElement("th");
        periodCell.scope = "row";
        periodCell.className = "period-cell";
        periodCell.textContent = String(period);
        tr.append(periodCell);

        for (const day of days) {
          const td = document.createElement("td");
          td.classList.toggle("is-today", day.key === currentDayKey());
          td.append(createSubjectChip(getScheduleValue(data, session, period, day.key)));
          tr.append(td);
        }
        tbody.append(tr);
      }
      table.append(tbody);
    }
    el.desktopSchedule.append(table);
  }

  function renderMobileSchedule(data) {
    const days = visibleDays();
    if (!days.some((day) => day.key === state.activeDay)) state.activeDay = days[0].key;
    el.dayTabs.replaceChildren();
    el.dayPanel.replaceChildren();

    days.forEach((day, dayIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-tab";
      button.textContent = day.short;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-label", day.label);
      button.setAttribute("aria-selected", String(day.key === state.activeDay));
      button.classList.toggle("is-active", day.key === state.activeDay);
      button.classList.toggle("is-today", day.key === currentDayKey());
      button.addEventListener("click", () => {
        state.activeDay = day.key;
        updateMobileDayTabs();
        const slide = el.dayPanel.querySelector(`[data-day="${day.key}"]`);
        if (slide) slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      });
      el.dayTabs.append(button);

      const slide = document.createElement("section");
      slide.className = "day-slide";
      slide.dataset.day = day.key;
      slide.setAttribute("role", "tabpanel");
      slide.setAttribute("aria-label", day.label);

      const heading = document.createElement("div");
      heading.className = "mobile-day-title";
      const h3 = document.createElement("h3");
      h3.textContent = day.label;
      heading.append(h3);
      if (day.key === currentDayKey()) {
        const badge = document.createElement("span");
        badge.className = "today-badge";
        badge.textContent = "Hôm nay";
        heading.append(badge);
      }
      slide.append(heading);

      for (const session of SESSIONS) {
        const section = document.createElement("section");
        section.className = "mobile-session";
        const title = document.createElement("h4");
        title.textContent = `Buổi ${session.toLowerCase()}`;
        section.append(title);

        for (let period = 1; period <= 5; period += 1) {
          const row = document.createElement("div");
          row.className = "mobile-period";
          const label = document.createElement("span");
          label.className = "mobile-period-label";
          label.textContent = `Tiết ${period}`;
          const value = document.createElement("div");
          value.className = "mobile-period-value";
          value.append(createSubjectChip(getScheduleValue(data, session, period, day.key)));
          row.append(label, value);
          section.append(row);
        }
        slide.append(section);
      }
      el.dayPanel.append(slide);
    });

    let scrollFrame = 0;
    el.dayPanel.addEventListener("scroll", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        const width = el.dayPanel.clientWidth;
        if (!width) return;
        const index = Math.max(0, Math.min(days.length - 1, Math.round(el.dayPanel.scrollLeft / width)));
        if (days[index].key !== state.activeDay) {
          state.activeDay = days[index].key;
          updateMobileDayTabs();
        }
      });
    }, { passive: true });

    const initialIndex = Math.max(0, days.findIndex((day) => day.key === state.activeDay));
    window.requestAnimationFrame(() => {
      const width = el.dayPanel.clientWidth;
      if (width) el.dayPanel.scrollLeft = initialIndex * width;
    });
  }

  function updateMobileDayTabs() {
    el.dayTabs.querySelectorAll(".day-tab").forEach((button) => {
      const active = button.getAttribute("aria-label") === DAYS.find((day) => day.key === state.activeDay)?.label;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      if (active) button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }

  function createSubjectChip(value) {
    const cleanValue = String(value || "").trim();
    const span = document.createElement("span");
    if (!cleanValue) {
      span.className = "subject-empty";
      span.textContent = "—";
      return span;
    }
    span.className = `subject-chip ${subjectClass(cleanValue)}`;
    span.textContent = cleanValue;
    return span;
  }

  function subjectClass(value) {
    const text = normalizeText(value);
    if (text.includes("ngu van") || /(^|\s)van(\s|$)/.test(text)) return "subject-literature";
    if (text.includes("toan")) return "subject-math";
    if (["khtn", "sinh", "vat li", "hoa hoc", "cong nghe", "tin"].some((term) => text.includes(term))) {
      return "subject-science";
    }
    if (["ngoai ngu", "tieng anh"].some((term) => text.includes(term))) return "subject-language";
    if (["hdtn", "chao co", "shl", "gddp", "the duc", "gdtc"].some((term) => text.includes(term))) {
      return "subject-activity";
    }
    return "subject-default";
  }

  function getScheduleValue(data, session, period, dayKey) {
    const periodData = data.schedule?.[session]?.[String(period)] || data.schedule?.[session]?.[period];
    return periodData?.[dayKey] || "";
  }

  function renderDataStatus() {
    el.dataStatus.classList.remove("is-warning");
    let text = "Dữ liệu đã đồng bộ từ Google Sheet.";
    if (state.mode === "cache") text = "Đang hiển thị bản đã lưu gần nhất để tải nhanh hơn.";
    if (state.mode === "offline") {
      text = "Mất kết nối — đang hiển thị bản đã lưu trên thiết bị.";
      el.dataStatus.classList.add("is-warning");
    }
    if (state.mode === "demo") {
      text = "Đang xem dữ liệu minh họa — hãy điền apiUrl trong config.js để dùng dữ liệu thật.";
      el.dataStatus.classList.add("is-warning");
    }
    if (state.updatedAt) text += ` Cập nhật: ${formatDateTime(state.updatedAt)}.`;
    el.dataStatus.textContent = text;
  }

  function showLoading() {
    hideAllViews();
    el.loadingView.hidden = false;
  }

  function showEmpty() {
    hideAllViews();
    el.emptyView.hidden = false;
  }

  function showError(message) {
    hideAllViews();
    el.errorMessage.textContent = message;
    el.errorView.hidden = false;
    el.dataStatus.textContent = "";
  }

  function hideAllViews() {
    el.loadingView.hidden = true;
    el.emptyView.hidden = true;
    el.errorView.hidden = true;
    el.scheduleView.hidden = true;
  }

  function setBusy(busy) {
    el.refreshButton.disabled = busy;
    el.entitySelect.disabled = busy;
    el.refreshButton.classList.toggle("is-loading", busy);
  }

  function writeCache(key, data, updatedAt) {
    try {
      localStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify({ savedAt: Date.now(), updatedAt: updatedAt || new Date().toISOString(), data }),
      );
    } catch (_error) {
      // Ứng dụng vẫn hoạt động nếu trình duyệt không cho lưu cục bộ.
    }
  }

  function readCache(key, allowStale) {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const value = JSON.parse(raw);
      const maxAge = Math.max(1, Number(CONFIG.cacheMinutes) || 30) * 60 * 1000;
      if (!allowStale && Date.now() - Number(value.savedAt || 0) > maxAge) return null;
      return value;
    } catch (_error) {
      return null;
    }
  }

  function isApiConfigured() {
    const value = String(CONFIG.apiUrl || "").trim();
    return /^https:\/\//i.test(value) && !value.includes("PASTE_GOOGLE_APPS_SCRIPT_URL_HERE");
  }

  function visibleDays() {
    return CONFIG.showSaturday === false ? DAYS.slice(0, 5) : DAYS;
  }

  function currentDayKey() {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: CONFIG.timezone || "Asia/Ho_Chi_Minh",
      weekday: "short",
    }).format(new Date());
    return { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" }[weekday] || "";
  }

  function renderCurrentPeriod(date) {
    const blocks = Array.isArray(state.bootstrap.timeBlocks) ? state.bootstrap.timeBlocks : [];
    el.currentPeriod.classList.remove("is-active");

    if (!blocks.length) {
      el.currentPeriodTitle.textContent = "Chưa có dữ liệu thời gian biểu";
      el.currentPeriodDetail.textContent = "Kiểm tra sheet ThoiGianBieu và tải lại trang.";
      return;
    }

    const parts = zonedClockParts(date);
    if (parts.weekday === "Sun") {
      el.currentPeriodTitle.textContent = "Hôm nay là Chủ nhật";
      el.currentPeriodDetail.textContent = "Không có tiết học trong thời gian biểu.";
      return;
    }

    const nowMinutes = parts.hour * 60 + parts.minute + parts.second / 60;
    const normalized = blocks
      .map((block) => ({ ...block, startMinutes: toMinutes(block.start), endMinutes: toMinutes(block.end) }))
      .filter((block) => Number.isFinite(block.startMinutes) && Number.isFinite(block.endMinutes))
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const current = normalized.find(
      (block) => nowMinutes >= block.startMinutes && nowMinutes < block.endMinutes,
    );

    if (current) {
      const remaining = Math.max(1, Math.ceil(current.endMinutes - nowMinutes));
      const title =
        current.type === "period"
          ? `${current.label} · Buổi ${String(current.session).toLocaleLowerCase("vi-VN")}`
          : `${current.label} · Buổi ${String(current.session).toLocaleLowerCase("vi-VN")}`;
      el.currentPeriodTitle.textContent = title;
      el.currentPeriodDetail.textContent = `${current.start}–${current.end} · Còn khoảng ${remaining} phút`;
      el.currentPeriod.classList.add("is-active");
      return;
    }

    const next = normalized.find((block) => block.startMinutes > nowMinutes);
    if (next) {
      const until = Math.max(1, Math.ceil(next.startMinutes - nowMinutes));
      const title =
        next.type === "period"
          ? `Sắp tới: ${next.label} buổi ${String(next.session).toLocaleLowerCase("vi-VN")}`
          : `Sắp tới: ${next.label} buổi ${String(next.session).toLocaleLowerCase("vi-VN")}`;
      el.currentPeriodTitle.textContent = title;
      el.currentPeriodDetail.textContent = `Bắt đầu lúc ${next.start} · Còn khoảng ${until} phút`;
      return;
    }

    el.currentPeriodTitle.textContent = "Đã kết thúc các tiết học trong ngày";
    el.currentPeriodDetail.textContent = "Thời gian được lấy từ sheet ThoiGianBieu.";
  }

  function zonedClockParts(date) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: CONFIG.timezone || "Asia/Ho_Chi_Minh",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const values = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return {
      weekday: values.weekday,
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    };
  }

  function toMinutes(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return Number.NaN;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function updateAddressBar() {
    const id = state.selected[state.view];
    const url = new URL(window.location.href);
    url.searchParams.set("view", state.view);
    if (id) url.searchParams.set("id", id);
    else url.searchParams.delete("id");
    window.history.replaceState({}, "", url);
  }

  async function shareCurrentSchedule() {
    const title = state.timetable ? `Thời khóa biểu ${state.timetable.title || state.timetable.id}` : document.title;
    const shareData = { title, text: title, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Đã sao chép đường dẫn thời khóa biểu.");
    } catch (_error) {
      showToast("Không thể sao chép tự động. Hãy sao chép đường dẫn trên thanh địa chỉ.");
    }
  }

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      el.installButton.hidden = false;
    });

    el.installButton.addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      el.installButton.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      el.installButton.hidden = true;
      showToast("Đã cài thời khóa biểu trên thiết bị.");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
    }
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      el.toast.hidden = true;
    }, 3000);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: CONFIG.timezone || "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  function titleCase(value) {
    return String(value || "")
      .toLocaleLowerCase("vi-VN")
      .replace(/(^|\s)(\p{L})/gu, (_match, space, letter) => space + letter.toLocaleUpperCase("vi-VN"));
  }

  function capitalizeFirst(value) {
    return value ? value.charAt(0).toLocaleUpperCase("vi-VN") + value.slice(1) : value;
  }

  function toCamel(value) {
    return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
  }

  function emptySchedule() {
    const schedule = {};
    for (const session of SESSIONS) {
      schedule[session] = {};
      for (let period = 1; period <= 5; period += 1) {
        schedule[session][String(period)] = Object.fromEntries(DAYS.map((day) => [day.key, ""]));
      }
    }
    return schedule;
  }

  function createDemoData() {
    const studentSchedule = emptySchedule();
    studentSchedule.Sáng["1"].thu = "Tin / HĐTN";
    studentSchedule.Sáng["1"].fri = "GDTC";
    studentSchedule.Chiều["1"] = { mon: "KHTN", tue: "KHTN", wed: "KHTN", thu: "Toán", fri: "Toán", sat: "" };
    studentSchedule.Chiều["2"] = { mon: "Ngữ văn", tue: "Ngữ văn", wed: "GDĐP", thu: "Toán", fri: "Ngữ văn", sat: "" };
    studentSchedule.Chiều["3"] = { mon: "Công nghệ", tue: "Địa lí", wed: "Toán", thu: "Mĩ thuật", fri: "KHTN", sat: "" };
    studentSchedule.Chiều["4"] = { mon: "Ngoại ngữ", tue: "GDCD", wed: "Lịch sử", thu: "Ngữ văn", fri: "Ngoại ngữ", sat: "" };
    studentSchedule.Chiều["5"] = { mon: "Chào cờ (HĐTN)", tue: "Âm nhạc", wed: "Ngoại ngữ", thu: "Lịch sử", fri: "SHL (HĐTN)", sat: "" };

    const teacherSchedule = emptySchedule();
    teacherSchedule.Sáng["1"].mon = "Chào cờ (HĐTN) - 7.7";
    teacherSchedule.Sáng["1"].tue = "Công nghệ - 7.9";
    teacherSchedule.Sáng["2"].mon = "KHTN - 7.7";
    teacherSchedule.Sáng["2"].tue = "KHTN - 7.7";
    teacherSchedule.Sáng["2"].fri = "KHTN-Sinh - 9.8";
    teacherSchedule.Sáng["3"].mon = "Công nghệ - 7.10";
    teacherSchedule.Sáng["3"].thu = "KHTN - 7.7";
    teacherSchedule.Sáng["4"].thu = "KHTN-Sinh - 9.10";
    teacherSchedule.Sáng["4"].fri = "KHTN - 7.7";
    teacherSchedule.Sáng["5"].mon = "KHTN-Sinh - 9.9";
    teacherSchedule.Sáng["5"].thu = "KHTN-Sinh - 9.7";
    teacherSchedule.Sáng["5"].fri = "SHL (HĐTN) - 7.7";
    teacherSchedule.Chiều["1"].tue = "KHTN-Sinh - 8.7";

    return {
      bootstrap: {
        classes: [{ id: "6.7", name: "Lớp 6.7" }],
        teachers: [{ id: "GIAO_VIEN_MAU", name: "Giáo viên mẫu" }],
        subjects: ["Công nghệ", "KHTN", "KHTN-Sinh"],
        timeBlocks: [
          { session: "Sáng", type: "period", period: 1, label: "Tiết 1", start: "07:00", end: "07:45" },
          { session: "Sáng", type: "period", period: 2, label: "Tiết 2", start: "07:48", end: "08:33" },
          { session: "Sáng", type: "break", period: null, label: "Ra chơi", start: "08:33", end: "08:57" },
          { session: "Sáng", type: "period", period: 3, label: "Tiết 3", start: "08:57", end: "09:42" },
          { session: "Sáng", type: "period", period: 4, label: "Tiết 4", start: "09:45", end: "10:30" },
          { session: "Sáng", type: "period", period: 5, label: "Tiết 5", start: "10:33", end: "11:18" },
          { session: "Chiều", type: "period", period: 1, label: "Tiết 1", start: "12:45", end: "13:30" },
          { session: "Chiều", type: "period", period: 2, label: "Tiết 2", start: "13:33", end: "14:18" },
          { session: "Chiều", type: "period", period: 3, label: "Tiết 3", start: "14:21", end: "15:06" },
          { session: "Chiều", type: "break", period: null, label: "Ra chơi", start: "15:06", end: "15:30" },
          { session: "Chiều", type: "period", period: 4, label: "Tiết 4", start: "15:30", end: "16:15" },
          { session: "Chiều", type: "period", period: 5, label: "Tiết 5", start: "16:18", end: "17:03" },
        ],
      },
      students: {
        "6.7": {
          type: "student",
          id: "6.7",
          title: "Lớp 6.7",
          homeroomTeacher: "Giáo viên chủ nhiệm",
          phone: "",
          note: "Tin học: Tuần lẻ | HĐTN: Tuần chẵn",
          schedule: studentSchedule,
        },
      },
      teachers: {
        GIAO_VIEN_MAU: {
          type: "teacher",
          id: "GIAO_VIEN_MAU",
          title: "Giáo viên mẫu",
          subjects: ["Công nghệ", "KHTN", "KHTN-Sinh"],
          note: "",
          schedule: teacherSchedule,
        },
      },
    };
  }
})();
