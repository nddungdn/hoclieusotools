(() => {
  "use strict";

  const els = {};
  const state = {
    exams: [],
    filtered: [],
    current: null,
    extraAnswerCount: 0,
    saveTimer: null,
    toastTimer: null
  };

  const SAMPLE_EXAMS = [
    {
      ID: "MAU2026",
      TinhThanh: "Đề minh họa",
      Nam: "2026",
      LoaiDe: "Chung",
      DeThi: "## ĐỀ MINH HỌA<br><br>**I. ĐỌC HIỂU (4,0 điểm)**<br><br>Đọc ngữ liệu và thực hiện các yêu cầu:<br><br>**Câu 1.** Xác định thể thơ của văn bản.<br><br>**Câu 2.** Nêu nội dung chính của văn bản.<br><br>**II. VIẾT (6,0 điểm)**<br><br>**Câu 1.** Viết đoạn văn nghị luận khoảng 200 chữ.<br><br>**Câu 2.** Viết bài văn nghị luận theo yêu cầu.",
      DapAn: "## HƯỚNG DẪN CHẤM<br><br>**Câu 1.** Học sinh xác định đúng thể thơ.<br><br>**Câu 2.** Trình bày được nội dung chính, diễn đạt rõ ràng.<br><br>Phần viết được đánh giá theo nội dung, lập luận, diễn đạt và sự sáng tạo.",
      TrangThai: "HIEN"
    }
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    restorePreferences();
    loadExams();
  }

  function cacheElements() {
    [
      "menuBtn", "headerActions", "fontDownBtn", "fontUpBtn", "themeBtn",
      "provinceSelect", "yearSelect", "typeSelect", "searchInput",
      "studentName", "studentClass", "studentSchool", "statusBar",
      "emptyState", "workspace", "examCount", "examTitle", "examYear",
      "examType", "examContent", "answerFields", "saveIndicator",
      "progressText", "progressBar", "addAnswerBtn", "clearBtn", "finishBtn",
      "answerKeySection", "answerKeyContent", "backToWorkBtn", "toast"
    ].forEach(id => { els[id] = document.getElementById(id); });
  }

  function bindEvents() {
    els.menuBtn.addEventListener("click", () => {
      const open = els.headerActions.classList.toggle("open");
      els.menuBtn.setAttribute("aria-expanded", String(open));
    });
    els.themeBtn.addEventListener("click", toggleTheme);
    els.fontDownBtn.addEventListener("click", () => changeFont(-1));
    els.fontUpBtn.addEventListener("click", () => changeFont(1));
    els.provinceSelect.addEventListener("change", selectExamFromControls);
    els.yearSelect.addEventListener("change", applyFilters);
    els.typeSelect.addEventListener("change", applyFilters);
    els.searchInput.addEventListener("input", applyFilters);
    [els.studentName, els.studentClass, els.studentSchool].forEach(el => {
      el.addEventListener("input", saveStudentInfo);
    });
    els.addAnswerBtn.addEventListener("click", () => addExtraAnswer());
    els.clearBtn.addEventListener("click", clearCurrentWork);
    els.finishBtn.addEventListener("click", finishWork);
    els.backToWorkBtn.addEventListener("click", () => {
      els.answerKeySection.hidden = true;
      els.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function loadExams() {
    const url = String(window.VAN10_APPS_SCRIPT_URL || "").trim();
    if (!url) {
      useExamData(SAMPLE_EXAMS, "Đang dùng đề minh họa. Quản trị viên cần dán URL Apps Script vào file config.js.", "is-error");
      return;
    }

    setStatus("Đang tải dữ liệu từ Google Sheets…");
    try {
      const data = await loadJsonp(url);
      const rows = Array.isArray(data) ? data : data.exams;
      if (!Array.isArray(rows)) throw new Error("Dữ liệu trả về không đúng cấu trúc.");
      useExamData(rows, `Đã tải ${rows.length} dòng dữ liệu từ Google Sheets.`, "is-success");
    } catch (error) {
      console.error(error);
      useExamData(
        SAMPLE_EXAMS,
        "Không kết nối được Google Sheets nên tiện ích đang hiển thị đề minh họa. Kiểm tra URL và quyền triển khai Apps Script.",
        "is-error"
      );
    }
  }

  function loadJsonp(baseUrl) {
    return new Promise((resolve, reject) => {
      const callback = `van10Callback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => cleanup(new Error("Quá thời gian tải dữ liệu.")), 15000);

      function cleanup(error, data) {
        clearTimeout(timeout);
        script.remove();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("Không thể tải Apps Script."));
      const separator = baseUrl.includes("?") ? "&" : "?";
      script.src = `${baseUrl}${separator}callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function useExamData(rows, message, statusClass) {
    state.exams = rows
      .map(normalizeExam)
      .filter(exam => exam.ID && exam.TinhThanh && isVisible(exam.TrangThai));

    state.exams.sort((a, b) =>
      String(b.Nam).localeCompare(String(a.Nam), "vi", { numeric: true }) ||
      a.TinhThanh.localeCompare(b.TinhThanh, "vi")
    );

    els.examCount.textContent = state.exams.length;
    populateFilter(els.yearSelect, uniqueValues(state.exams, "Nam"), "Tất cả");
    populateFilter(els.typeSelect, uniqueValues(state.exams, "LoaiDe"), "Tất cả");
    applyFilters();
    restoreStudentInfo();
    setStatus(message, statusClass);
  }

  function normalizeExam(row) {
    return {
      ID: clean(row.ID ?? row.id),
      TinhThanh: clean(row.TinhThanh ?? row.tinhthanh),
      Nam: clean(row.Nam ?? row.nam),
      LoaiDe: clean(row.LoaiDe ?? row.loaide),
      DeThi: String(row.DeThi ?? row.dethi ?? ""),
      DapAn: String(row.DapAn ?? row.dapan ?? ""),
      TrangThai: clean(row.TrangThai ?? row.trangthai)
    };
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function isVisible(value) {
    const normalized = removeVietnamese(value).toUpperCase();
    return !normalized || ["HIEN", "HIENTHI", "TRUE", "1", "CONGKHAI"].includes(normalized);
  }

  function uniqueValues(rows, key) {
    return [...new Set(rows.map(row => row[key]).filter(Boolean))]
      .sort((a, b) => String(b).localeCompare(String(a), "vi", { numeric: true }));
  }

  function populateFilter(select, values, firstText) {
    select.innerHTML = `<option value="">${escapeHtml(firstText)}</option>` +
      values.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function applyFilters() {
    const year = els.yearSelect.value;
    const type = els.typeSelect.value;
    const query = removeVietnamese(els.searchInput.value).toLowerCase();
    const previousId = state.current?.ID || els.provinceSelect.value;

    state.filtered = state.exams.filter(exam => {
      if (year && exam.Nam !== year) return false;
      if (type && exam.LoaiDe !== type) return false;
      if (query) {
        const haystack = removeVietnamese(`${exam.TinhThanh} ${exam.Nam} ${exam.LoaiDe}`).toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    els.provinceSelect.innerHTML = state.filtered.length
      ? state.filtered.map(exam => (
          `<option value="${escapeAttr(exam.ID)}">${escapeHtml(exam.TinhThanh)}${exam.LoaiDe ? ` – ${escapeHtml(exam.LoaiDe)}` : ""}</option>`
        )).join("")
      : '<option value="">Không có đề phù hợp</option>';

    const stillExists = state.filtered.some(exam => exam.ID === previousId);
    if (stillExists) els.provinceSelect.value = previousId;
    selectExamFromControls();
  }

  function selectExamFromControls() {
    const id = els.provinceSelect.value;
    const exam = state.filtered.find(item => item.ID === id) || null;
    state.current = exam;
    els.emptyState.hidden = Boolean(exam);
    els.workspace.hidden = !exam;
    els.answerKeySection.hidden = true;
    if (!exam) return;

    els.examTitle.textContent = exam.TinhThanh || "Đề thi";
    els.examYear.textContent = exam.Nam;
    els.examType.textContent = exam.LoaiDe;
    els.examContent.innerHTML = renderMarkdown(exam.DeThi);
    els.answerKeyContent.innerHTML = renderMarkdown(exam.DapAn || "Chưa cập nhật đáp án.");
    buildAnswerFields(exam);
    document.title = `${exam.TinhThanh} – Luyện đề Ngữ văn 10`;
  }

  function buildAnswerFields(exam) {
    state.extraAnswerCount = 0;
    const saved = readSavedWork(exam.ID);
    const detected = detectQuestions(exam.DeThi);
    const fields = saved?.fields?.length
      ? saved.fields
      : (detected.length ? detected.map((label, index) => ({ id: `q${index + 1}`, label, value: "" })) : [
          { id: "bailam", label: "Bài làm", value: "" }
        ]);

    els.answerFields.innerHTML = "";
    fields.forEach(field => appendAnswerField(field));
    updateProgress();
  }

  function detectQuestions(markdown) {
    const text = String(markdown || "").replace(/<br\s*\/?>/gi, "\n");
    const lines = text.split(/\r?\n/);
    let section = "";
    const questions = [];

    for (const raw of lines) {
      const line = raw.replace(/[*_#>|]/g, "").trim();
      if (!line) continue;
      if (/đọc\s*hiểu/i.test(line)) section = "Đọc hiểu";
      else if (/(^|\s)(viết|làm văn)(\s|$)/i.test(line)) section = "Viết";

      const match = line.match(/^(?:[IVX]+\.\s*)?(Câu\s*\d+)\s*[:.)-]?/i);
      if (!match) continue;
      const base = match[1].replace(/\s+/g, " ");
      const label = section ? `${section} – ${base}` : base;
      if (!questions.includes(label)) questions.push(label);
    }
    return questions.slice(0, 20);
  }

  function appendAnswerField(field) {
    const wrapper = document.createElement("div");
    wrapper.className = "answer-field";
    wrapper.dataset.fieldId = field.id;
    wrapper.innerHTML = `
      <div class="answer-label-row">
        <label for="${escapeAttr(`answer-${field.id}`)}">${escapeHtml(field.label)}</label>
        <button class="remove-answer" type="button" title="Xóa ô này">Xóa ô</button>
      </div>
      <textarea id="${escapeAttr(`answer-${field.id}`)}" placeholder="Nhập bài làm tại đây…">${escapeHtml(field.value || "")}</textarea>
    `;
    const textarea = wrapper.querySelector("textarea");
    textarea.addEventListener("input", () => {
      els.saveIndicator.textContent = "Đang lưu…";
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(saveCurrentWork, 450);
      updateProgress();
    });
    wrapper.querySelector(".remove-answer").addEventListener("click", () => {
      if (els.answerFields.children.length <= 1) {
        showToast("Cần giữ lại ít nhất một ô làm bài.");
        return;
      }
      wrapper.remove();
      saveCurrentWork();
      updateProgress();
    });
    els.answerFields.appendChild(wrapper);
  }

  function addExtraAnswer() {
    state.extraAnswerCount += 1;
    appendAnswerField({
      id: `them-${Date.now()}-${state.extraAnswerCount}`,
      label: `Nội dung bổ sung ${state.extraAnswerCount}`,
      value: ""
    });
    saveCurrentWork();
    els.answerFields.lastElementChild.querySelector("textarea").focus();
  }

  function collectFields() {
    return [...els.answerFields.querySelectorAll(".answer-field")].map(wrapper => ({
      id: wrapper.dataset.fieldId,
      label: wrapper.querySelector("label").textContent,
      value: wrapper.querySelector("textarea").value
    }));
  }

  function saveCurrentWork() {
    if (!state.current) return;
    const payload = {
      examId: state.current.ID,
      updatedAt: new Date().toISOString(),
      fields: collectFields()
    };
    try {
      localStorage.setItem(workKey(state.current.ID), JSON.stringify(payload));
      els.saveIndicator.textContent = "Đã lưu";
    } catch (error) {
      els.saveIndicator.textContent = "Chưa lưu được";
      console.error(error);
    }
  }

  function readSavedWork(examId) {
    try {
      return JSON.parse(localStorage.getItem(workKey(examId)) || "null");
    } catch (_) {
      return null;
    }
  }

  function workKey(examId) {
    return `van10-work:${examId}`;
  }

  function clearCurrentWork() {
    if (!state.current) return;
    if (!window.confirm("Xóa toàn bộ bài làm đang lưu của đề này?")) return;
    localStorage.removeItem(workKey(state.current.ID));
    buildAnswerFields(state.current);
    showToast("Đã xóa bài làm.");
  }

  function finishWork() {
    if (!state.current) return;
    saveCurrentWork();
    const hasContent = collectFields().some(field => field.value.trim());
    if (!hasContent && !window.confirm("Bài làm đang để trống. Bạn vẫn muốn mở đáp án?")) return;
    els.answerKeySection.hidden = false;
    els.answerKeySection.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Đã hoàn thành. Hãy tự đối chiếu với hướng dẫn chấm.");
  }

  function updateProgress() {
    const fields = collectFields();
    const completed = fields.filter(field => field.value.trim().length >= 20).length;
    const percent = fields.length ? Math.round(completed / fields.length * 100) : 0;
    els.progressText.textContent = `${percent}%`;
    els.progressBar.style.width = `${percent}%`;
  }

  function saveStudentInfo() {
    const info = {
      name: els.studentName.value,
      className: els.studentClass.value,
      school: els.studentSchool.value
    };
    localStorage.setItem("van10-student", JSON.stringify(info));
  }

  function restoreStudentInfo() {
    try {
      const info = JSON.parse(localStorage.getItem("van10-student") || "{}");
      els.studentName.value = info.name || "";
      els.studentClass.value = info.className || "";
      els.studentSchool.value = info.school || "";
    } catch (_) {}
  }

  function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem("van10-theme", document.body.classList.contains("dark") ? "dark" : "light");
  }

  function changeFont(delta) {
    const current = Number(localStorage.getItem("van10-font") || 17);
    const next = Math.max(14, Math.min(23, current + delta));
    document.documentElement.style.setProperty("--reading-size", `${next}px`);
    localStorage.setItem("van10-font", String(next));
    showToast(`Cỡ chữ: ${next}px`);
  }

  function restorePreferences() {
    if (localStorage.getItem("van10-theme") === "dark") document.body.classList.add("dark");
    const font = Number(localStorage.getItem("van10-font") || 17);
    document.documentElement.style.setProperty("--reading-size", `${Math.max(14, Math.min(23, font))}px`);
  }

  function setStatus(message, className = "") {
    els.statusBar.textContent = message;
    els.statusBar.className = `status-bar ${className}`.trim();
  }

  function showToast(message) {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function renderMarkdown(source) {
    const normalized = String(source || "")
      .replace(/\r\n?/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n");
    const lines = normalized.split("\n").map(line => {
      // Khi nội dung được chuẩn bị dưới dạng bảng Markdown một cột,
      // bỏ cặp dấu | bao ngoài để đề hiển thị như văn bản bình thường.
      if (/^\s*\|\s*:?-{3,}:?\s*\|\s*$/.test(line)) return "";
      const oneCell = line.match(/^\s*\|([^|]*)\|\s*$/);
      return oneCell ? oneCell[1].trim() : line;
    });
    const output = [];
    let paragraph = [];
    let listType = "";

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${inlineMarkdown(paragraph.join("\n"))}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (!listType) return;
      output.push(`</${listType}>`);
      listType = "";
    };

    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i];
      const line = raw.trim();

      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      if (isTableHeader(lines, i)) {
        flushParagraph();
        closeList();
        const headerCells = splitTableRow(line);
        const bodyRows = [];
        i += 2;
        while (i < lines.length && isTableRow(lines[i])) {
          bodyRows.push(splitTableRow(lines[i]));
          i += 1;
        }
        i -= 1;
        output.push(
          `<table><thead><tr>${headerCells.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>` +
          `<tbody>${bodyRows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        );
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      if (/^[-*_]{3,}$/.test(line) || /^-{8,}$/.test(line)) {
        flushParagraph();
        closeList();
        output.push("<hr>");
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
        continue;
      }

      const unordered = line.match(/^[-+*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          output.push(`<${nextType}>`);
          listType = nextType;
        }
        output.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
        continue;
      }

      closeList();
      paragraph.push(line);
    }

    flushParagraph();
    closeList();
    return output.join("");
  }

  function inlineMarkdown(value) {
    let text = escapeHtml(value);
    text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
    text = text.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\n/g, "<br>");
    return text;
  }

  function isTableHeader(lines, index) {
    return isTableRow(lines[index]) &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]);
  }

  function isTableRow(line) {
    return typeof line === "string" && line.includes("|") && line.trim().replace(/^\||\|$/g, "").includes("|");
  }

  function splitTableRow(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
  }

  function removeVietnamese(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
