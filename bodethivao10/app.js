(() => {
  "use strict";

  const els = {};
  const state = {
    exams: [],
    questions: [],
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

  const SAMPLE_QUESTIONS = [
    {
      IDDe: "MAU2026",
      MaCau: "DH1",
      Phan: "Đọc hiểu",
      TenCau: "Câu 1",
      YeuCau: "Xác định thể thơ của văn bản.",
      DapAn: "Học sinh xác định đúng thể thơ được sử dụng trong ngữ liệu.",
      DiemToiDa: "0,5",
      ThuTu: "1",
      TrangThai: "HIEN"
    },
    {
      IDDe: "MAU2026",
      MaCau: "DH2",
      Phan: "Đọc hiểu",
      TenCau: "Câu 2",
      YeuCau: "Nêu nội dung chính của văn bản.",
      DapAn: "Nêu đúng nội dung chính; có thể diễn đạt theo cách khác nhưng phải hợp lí và bám sát ngữ liệu.",
      DiemToiDa: "1,0",
      ThuTu: "2",
      TrangThai: "HIEN"
    },
    {
      IDDe: "MAU2026",
      MaCau: "V1",
      Phan: "Viết",
      TenCau: "Câu 1",
      YeuCau: "Viết đoạn văn nghị luận khoảng 200 chữ.",
      DapAn: "Đúng hình thức đoạn văn; xác định đúng vấn đề; triển khai lập luận hợp lí; diễn đạt trong sáng và có sáng tạo.",
      DiemToiDa: "2,0",
      ThuTu: "3",
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
      "apiKeyInput", "toggleApiKeyBtn", "saveApiKeyBtn",
      "emptyState", "workspace", "examCount", "examTitle", "examYear",
      "examType", "examContent", "answerFields", "saveIndicator",
      "progressText", "progressBar", "totalScore", "maxTotalScore",
      "addAnswerBtn", "clearBtn", "finishBtn",
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
    els.toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisibility);
    els.saveApiKeyBtn.addEventListener("click", saveApiKeyForSession);
    els.addAnswerBtn.addEventListener("click", () => addExtraAnswer());
    els.clearBtn.addEventListener("click", clearCurrentWork);
    els.finishBtn.addEventListener("click", finishWork);
    els.backToWorkBtn.addEventListener("click", () => {
      els.answerKeySection.hidden = true;
      els.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.apiKeyInput.value = sessionStorage.getItem("van10-gemini-key") || "";
  }

  async function loadExams() {
    const url = String(window.VAN10_APPS_SCRIPT_URL || "").trim();
    if (!url) {
      useExamData(
        SAMPLE_EXAMS,
        SAMPLE_QUESTIONS,
        "Đang dùng đề minh họa. Quản trị viên cần dán URL Apps Script vào file config.js.",
        "is-error"
      );
      return;
    }

    setStatus("Đang tải dữ liệu từ Google Sheets…");
    try {
      const data = await loadJsonp(url);
      const rows = Array.isArray(data) ? data : data.exams;
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!Array.isArray(rows)) throw new Error("Dữ liệu trả về không đúng cấu trúc.");
      useExamData(
        rows,
        questions,
        `Đã tải ${rows.length} đề và ${questions.length} câu hỏi từ Google Sheets.`,
        "is-success"
      );
    } catch (error) {
      console.error(error);
      useExamData(
        SAMPLE_EXAMS,
        SAMPLE_QUESTIONS,
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

  function useExamData(rows, questionRows, message, statusClass) {
    state.exams = rows
      .map(normalizeExam)
      .filter(exam => exam.ID && exam.TinhThanh && isVisible(exam.TrangThai));

    state.exams.sort((a, b) =>
      String(b.Nam).localeCompare(String(a.Nam), "vi", { numeric: true }) ||
      a.TinhThanh.localeCompare(b.TinhThanh, "vi")
    );
    state.questions = (questionRows || [])
      .map(normalizeQuestion)
      .filter(question => question.IDDe && question.MaCau && isVisible(question.TrangThai))
      .sort((a, b) => a.ThuTu - b.ThuTu);

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

  function normalizeQuestion(row) {
    return {
      IDDe: clean(row.IDDe ?? row.idde),
      MaCau: clean(row.MaCau ?? row.macau),
      Phan: clean(row.Phan ?? row.phan),
      TenCau: clean(row.TenCau ?? row.tencau),
      YeuCau: String(row.YeuCau ?? row.yeucau ?? ""),
      DapAn: String(row.DapAn ?? row.dapan ?? ""),
      DiemToiDa: parseScore(row.DiemToiDa ?? row.diemtoida),
      ThuTu: Number(String(row.ThuTu ?? row.thutu ?? "0").replace(",", ".")) || 0,
      TrangThai: clean(row.TrangThai ?? row.trangthai)
    };
  }

  function parseScore(value) {
    const score = Number(String(value ?? "0").replace(",", "."));
    return Number.isFinite(score) && score >= 0 ? score : 0;
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
    const examQuestions = questionsForExam(exam.ID);
    els.answerKeyContent.innerHTML = renderFullAnswerKey(exam, examQuestions);
    buildAnswerFields(exam);
    document.title = `${exam.TinhThanh} – Luyện đề Ngữ văn 10`;
  }

  function buildAnswerFields(exam) {
    state.extraAnswerCount = 0;
    const saved = readSavedWork(exam.ID);
    const savedById = new Map((saved?.fields || []).map(field => [field.id, field]));
    const sheetQuestions = questionsForExam(exam.ID);
    const detected = detectQuestions(exam.DeThi);
    let fields;

    if (sheetQuestions.length) {
      fields = sheetQuestions.map(question => {
        const old = savedById.get(question.MaCau) || {};
        return {
          id: question.MaCau,
          label: [question.Phan, question.TenCau].filter(Boolean).join(" – ") || question.MaCau,
          prompt: question.YeuCau,
          officialAnswer: question.DapAn,
          maxScore: question.DiemToiDa,
          value: old.value || "",
          score: clampScore(old.score, question.DiemToiDa),
          aiResponse: old.aiResponse || ""
        };
      });
    } else {
      fields = detected.length
        ? detected.map((label, index) => {
            const id = `q${index + 1}`;
            const old = savedById.get(id) || {};
            return {
              id,
              label,
              prompt: "",
              officialAnswer: "",
              maxScore: 0,
              value: old.value || "",
              score: 0,
              aiResponse: old.aiResponse || ""
            };
          })
        : [{
            id: "bailam",
            label: "Bài làm",
            prompt: "",
            officialAnswer: exam.DapAn || "",
            maxScore: 10,
            value: savedById.get("bailam")?.value || "",
            score: clampScore(savedById.get("bailam")?.score, 10),
            aiResponse: savedById.get("bailam")?.aiResponse || ""
          }];
    }

    els.answerFields.innerHTML = "";
    fields.forEach(field => appendAnswerField(field));
    updateProgress();
    updateScoreSummary();
  }

  function questionsForExam(examId) {
    return state.questions.filter(question => question.IDDe === examId);
  }

  function clampScore(value, maxScore) {
    const score = parseScore(value);
    return Math.max(0, Math.min(score, Number(maxScore) || 0));
  }

  function renderFullAnswerKey(exam, questions) {
    if (!questions.length) return renderMarkdown(exam.DapAn || "Chưa cập nhật đáp án.");
    return questions.map(question => {
      const heading = [question.Phan, question.TenCau].filter(Boolean).join(" – ") || question.MaCau;
      return `
        <section class="full-answer-item">
          <h3>${escapeHtml(heading)} <small>(${formatScore(question.DiemToiDa)} điểm)</small></h3>
          ${question.YeuCau ? `<div class="full-question">${renderMarkdown(question.YeuCau)}</div>` : ""}
          ${renderMarkdown(question.DapAn || "Chưa cập nhật đáp án.")}
        </section>
      `;
    }).join("");
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
    wrapper.fieldMeta = field;
    const canRemove = String(field.id).startsWith("them-");
    const hasOfficialAnswer = Boolean(String(field.officialAnswer || "").trim());
    wrapper.innerHTML = `
      <div class="answer-label-row">
        <label class="answer-main-label" for="${escapeAttr(`answer-${field.id}`)}">${escapeHtml(field.label)}</label>
        ${canRemove ? '<button class="remove-answer" type="button" title="Xóa ô này">Xóa ô</button>' : ""}
      </div>
      ${field.prompt ? `<div class="question-prompt">${renderMarkdown(field.prompt)}</div>` : ""}
      <textarea class="student-answer" id="${escapeAttr(`answer-${field.id}`)}" placeholder="Nhập bài làm tại đây…">${escapeHtml(field.value || "")}</textarea>

      <div class="answer-tools">
        <button class="small-btn reveal-answer-btn" type="button" ${hasOfficialAnswer ? "" : "disabled"}>
          ${hasOfficialAnswer ? "Xem đáp án" : "Chưa có đáp án"}
        </button>
        <button class="small-btn ai-btn open-ai-btn" type="button">AI hỗ trợ</button>
      </div>

      <div class="result-grid">
        <div class="official-answer">
          <strong>Đáp án</strong>
          <div class="answer-html">${hasOfficialAnswer ? "Nhấn “Xem đáp án” để tự đối chiếu." : "Chưa cập nhật đáp án cho câu này."}</div>
        </div>
        <label class="score-field">
          <span>Điểm</span>
          <input class="earned-score" type="number" min="0" max="${field.maxScore || 0}" step="0.25" value="${formatInputScore(field.score)}">
          <small>Tối đa ${formatScore(field.maxScore)}</small>
        </label>
      </div>

      <div class="ai-box" hidden>
        <strong>AI hỗ trợ câu này</strong>
        <textarea class="ai-question" placeholder="Ví dụ: Gợi ý cho em cách triển khai câu này, không viết hộ đáp án…"></textarea>
        <div class="ai-actions">
          <button class="small-btn ask-ai-btn" type="button">Gửi câu hỏi</button>
          <button class="small-btn grade-ai-btn" type="button">AI nhận xét và chấm thử</button>
        </div>
        <div class="ai-response">${escapeHtml(field.aiResponse || "")}</div>
        <p class="ai-disclaimer">Nhận xét và điểm của AI chỉ có giá trị tham khảo.</p>
      </div>
    `;
    const textarea = wrapper.querySelector(".student-answer");
    textarea.addEventListener("input", () => {
      els.saveIndicator.textContent = "Đang lưu…";
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(saveCurrentWork, 450);
      updateProgress();
    });
    const removeButton = wrapper.querySelector(".remove-answer");
    if (removeButton) {
      removeButton.addEventListener("click", () => {
        wrapper.remove();
        saveCurrentWork();
        updateProgress();
        updateScoreSummary();
      });
    }
    wrapper.querySelector(".reveal-answer-btn").addEventListener("click", button => {
      if (!hasOfficialAnswer) return;
      const answerBox = wrapper.querySelector(".answer-html");
      const isRevealed = wrapper.dataset.answerRevealed === "true";
      if (isRevealed) {
        answerBox.textContent = "Nhấn “Xem đáp án” để tự đối chiếu.";
        wrapper.dataset.answerRevealed = "false";
        button.currentTarget.textContent = "Xem đáp án";
      } else {
        answerBox.innerHTML = renderMarkdown(field.officialAnswer);
        wrapper.dataset.answerRevealed = "true";
        button.currentTarget.textContent = "Ẩn đáp án";
      }
    });
    wrapper.querySelector(".open-ai-btn").addEventListener("click", () => {
      const box = wrapper.querySelector(".ai-box");
      box.hidden = !box.hidden;
      if (!box.hidden) wrapper.querySelector(".ai-question").focus();
    });
    wrapper.querySelector(".ask-ai-btn").addEventListener("click", event => askAiForHelp(wrapper, event.currentTarget));
    wrapper.querySelector(".grade-ai-btn").addEventListener("click", event => gradeWithAi(wrapper, event.currentTarget));
    wrapper.querySelector(".earned-score").addEventListener("change", event => {
      event.currentTarget.value = formatInputScore(clampScore(event.currentTarget.value, field.maxScore));
      saveCurrentWork();
      updateScoreSummary();
    });
    els.answerFields.appendChild(wrapper);
  }

  function addExtraAnswer() {
    state.extraAnswerCount += 1;
    appendAnswerField({
      id: `them-${Date.now()}-${state.extraAnswerCount}`,
      label: `Nội dung bổ sung ${state.extraAnswerCount}`,
      prompt: "",
      officialAnswer: "",
      maxScore: 0,
      value: "",
      score: 0,
      aiResponse: ""
    });
    saveCurrentWork();
    els.answerFields.lastElementChild.querySelector("textarea").focus();
  }

  function collectFields() {
    return [...els.answerFields.querySelectorAll(".answer-field")].map(wrapper => {
      const meta = wrapper.fieldMeta || {};
      return {
        id: wrapper.dataset.fieldId,
        label: wrapper.querySelector(".answer-main-label").textContent,
        value: wrapper.querySelector(".student-answer").value,
        score: clampScore(wrapper.querySelector(".earned-score").value, meta.maxScore),
        aiResponse: wrapper.querySelector(".ai-response").textContent || ""
      };
    });
  }

  function formatScore(value) {
    const score = parseScore(value);
    return score.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  }

  function formatInputScore(value) {
    const score = parseScore(value);
    return String(Math.round(score * 100) / 100);
  }

  function updateScoreSummary() {
    const wrappers = [...els.answerFields.querySelectorAll(".answer-field")];
    let total = 0;
    let maxTotal = 0;
    wrappers.forEach(wrapper => {
      const maxScore = Number(wrapper.fieldMeta?.maxScore) || 0;
      const input = wrapper.querySelector(".earned-score");
      maxTotal += maxScore;
      total += clampScore(input?.value, maxScore);
    });
    els.totalScore.textContent = formatScore(total);
    els.maxTotalScore.textContent = formatScore(maxTotal);
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

  function toggleApiKeyVisibility() {
    const showing = els.apiKeyInput.type === "text";
    els.apiKeyInput.type = showing ? "password" : "text";
    els.toggleApiKeyBtn.textContent = showing ? "Hiện" : "Ẩn";
  }

  function saveApiKeyForSession() {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
      sessionStorage.removeItem("van10-gemini-key");
      showToast("Đã xóa API key khỏi phiên này.");
      return;
    }
    sessionStorage.setItem("van10-gemini-key", key);
    els.apiKeyInput.type = "password";
    els.toggleApiKeyBtn.textContent = "Hiện";
    showToast("Đã lưu API key trong phiên trình duyệt hiện tại.");
  }

  function getApiKey() {
    const key = els.apiKeyInput.value.trim() || sessionStorage.getItem("van10-gemini-key") || "";
    if (key) return key;
    const details = els.apiKeyInput.closest("details");
    if (details) details.open = true;
    els.apiKeyInput.focus();
    showToast("Hãy nhập Gemini API key để sử dụng AI hỗ trợ.");
    return "";
  }

  async function askAiForHelp(wrapper, button) {
    const key = getApiKey();
    if (!key) return;
    const meta = wrapper.fieldMeta || {};
    const studentAnswer = wrapper.querySelector(".student-answer").value.trim();
    const userQuestion = wrapper.querySelector(".ai-question").value.trim() ||
      "Hãy gợi ý từng bước để em tự làm câu này, không cung cấp bài làm hoàn chỉnh.";
    const responseBox = wrapper.querySelector(".ai-response");
    const prompt = [
      "Bạn là giáo viên Ngữ văn THCS hỗ trợ học sinh tự luyện thi vào lớp 10.",
      "Chỉ hướng dẫn phương pháp, đặt câu hỏi gợi mở và chỉ ra hướng cải thiện.",
      "Không viết hộ đáp án hoàn chỉnh, không bịa dẫn chứng hoặc kiến thức.",
      `Đề/câu hỏi: ${plainText(meta.prompt || meta.label || "")}`,
      studentAnswer ? `Bài học sinh đang viết: ${studentAnswer}` : "Học sinh chưa viết bài.",
      `Điều học sinh muốn hỏi: ${userQuestion}`,
      "Trả lời bằng tiếng Việt, rõ ràng, thân thiện và ngắn gọn."
    ].join("\n\n");

    await runAiButton(button, responseBox, async () => {
      const text = await callGemini(key, prompt);
      responseBox.textContent = text;
      saveCurrentWork();
    }, "AI đang chuẩn bị gợi ý…");
  }

  async function gradeWithAi(wrapper, button) {
    const key = getApiKey();
    if (!key) return;
    const meta = wrapper.fieldMeta || {};
    const studentAnswer = wrapper.querySelector(".student-answer").value.trim();
    const responseBox = wrapper.querySelector(".ai-response");

    if (!studentAnswer) {
      showToast("Hãy nhập bài làm trước khi yêu cầu AI nhận xét.");
      wrapper.querySelector(".student-answer").focus();
      return;
    }
    if (!meta.officialAnswer) {
      showToast("Câu này chưa có đáp án trong Google Sheets nên AI chưa thể chấm thử.");
      return;
    }

    const prompt = [
      "Bạn là giáo viên Ngữ văn chấm bài luyện thi vào lớp 10.",
      "Đánh giá linh hoạt: học sinh có thể diễn đạt khác đáp án nhưng đúng ý vẫn được ghi nhận.",
      "Không tự bổ sung ý mà học sinh chưa viết. Điểm phải nằm trong giới hạn.",
      `Câu hỏi: ${plainText(meta.prompt || meta.label || "")}`,
      `Đáp án/hướng dẫn chấm: ${plainText(meta.officialAnswer)}`,
      `Điểm tối đa: ${meta.maxScore}`,
      `Bài làm học sinh: ${studentAnswer}`,
      'Chỉ trả về JSON hợp lệ theo mẫu: {"score":0,"feedback":"Nhận xét ngắn gọn","strengths":["ưu điểm"],"improvements":["điểm cần sửa"]}'
    ].join("\n\n");

    await runAiButton(button, responseBox, async () => {
      const text = await callGemini(key, prompt);
      const result = parseAiGrade(text);
      if (!result) {
        responseBox.textContent = text;
        showToast("AI đã nhận xét nhưng không trả về điểm đúng định dạng.");
        return;
      }
      const score = clampScore(result.score, meta.maxScore);
      wrapper.querySelector(".earned-score").value = formatInputScore(score);
      const strengths = Array.isArray(result.strengths) && result.strengths.length
        ? `\nƯu điểm: ${result.strengths.join("; ")}`
        : "";
      const improvements = Array.isArray(result.improvements) && result.improvements.length
        ? `\nCần cải thiện: ${result.improvements.join("; ")}`
        : "";
      responseBox.textContent =
        `Điểm AI chấm thử: ${formatScore(score)}/${formatScore(meta.maxScore)}\n${result.feedback || ""}${strengths}${improvements}`;
      updateScoreSummary();
      saveCurrentWork();
    }, "AI đang đọc và nhận xét bài làm…");
  }

  async function runAiButton(button, responseBox, action, loadingText) {
    const original = button.textContent;
    button.disabled = true;
    responseBox.textContent = loadingText;
    try {
      await action();
    } catch (error) {
      console.error(error);
      responseBox.textContent = `Không sử dụng được AI: ${error.message || error}`;
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function callGemini(apiKey, prompt) {
    const model = String(window.VAN10_GEMINI_MODEL || "gemini-3.5-flash").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200
        }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Lỗi Gemini API (${response.status})`;
      throw new Error(message);
    }
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();
    if (!text) throw new Error("AI không trả về nội dung.");
    return text;
  }

  function parseAiGrade(text) {
    try {
      const normalized = String(text || "")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const start = normalized.indexOf("{");
      const end = normalized.lastIndexOf("}");
      if (start === -1 || end === -1) return null;
      return JSON.parse(normalized.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }

  function plainText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[*_#>|`]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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
      .replace(/<p\s+align\s*=\s*["']?(left|right|center|justify)["']?\s*>/gi, "\n@@ALIGN:$1@@\n")
      .replace(/<\/p>/gi, "\n@@ENDALIGN@@\n")
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
    let paragraphAlign = "";

    const flushParagraph = () => {
      if (!paragraph.length) return;
      const alignClass = paragraphAlign ? ` class="align-${paragraphAlign}"` : "";
      output.push(`<p${alignClass}>${inlineMarkdown(paragraph.join("\n"))}</p>`);
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

      const alignStart = line.match(/^@@ALIGN:(left|right|center|justify)@@$/i);
      if (alignStart) {
        flushParagraph();
        closeList();
        paragraphAlign = alignStart[1].toLowerCase();
        continue;
      }
      if (line === "@@ENDALIGN@@") {
        flushParagraph();
        closeList();
        paragraphAlign = "";
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
    const allowedTags = [];
    const protectedValue = String(value ?? "").replace(
      /<\/?(?:b|strong|i|em|u|sup|sub)>/gi,
      tag => {
        const token = `\uE000${allowedTags.length}\uE001`;
        allowedTags.push(tag.toLowerCase());
        return token;
      }
    );
    let text = escapeHtml(protectedValue);
    text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
    text = text.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\n/g, "<br>");
    text = text.replace(/\uE000(\d+)\uE001/g, (_, index) => allowedTags[Number(index)] || "");
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
