(() => {
  "use strict";

  const STORAGE_KEY = "hoclieuso.viettinbangai.draft.v2";
  const SESSION_KEY = "hoclieuso.viettinbangai.api-session.v1";
  const WORKER_ORIGIN = "https://viet-tin-bang-ai.nddungdn.workers.dev";
  const API_URL = `${WORKER_ORIGIN}/api/write`;
  const API_TEST_URL = `${WORKER_ORIGIN}/api/test`;
  const CONFIG_URL = `${WORKER_ORIGIN}/api/config`;

  const AI_PROVIDERS = {
    gemini: {
      name: "Google Gemini",
      keyUrl: "https://aistudio.google.com/apikey",
      keyLabel: "Mở trang tạo API key Gemini",
      placeholder: "Thường bắt đầu bằng AIza...",
      models: [
        ["gemini-3.6-flash", "Gemini 3.6 Flash — cân bằng"],
        ["gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite — tiết kiệm"],
      ],
    },
    openai: {
      name: "OpenAI",
      keyUrl: "https://platform.openai.com/api-keys",
      keyLabel: "Mở trang tạo API key OpenAI",
      placeholder: "Thường bắt đầu bằng sk-...",
      models: [
        ["gpt-5-mini", "GPT-5 mini — tiết kiệm"],
        ["gpt-5.4-mini", "GPT-5.4 mini — chất lượng cao hơn"],
      ],
    },
    groq: {
      name: "Groq",
      keyUrl: "https://console.groq.com/keys",
      keyLabel: "Mở trang tạo API key Groq",
      placeholder: "Dán Groq API key",
      models: [
        ["openai/gpt-oss-20b", "GPT-OSS 20B — nhanh, tiết kiệm"],
        ["openai/gpt-oss-120b", "GPT-OSS 120B — chất lượng cao"],
        ["llama-3.3-70b-versatile", "Llama 3.3 70B Versatile"],
      ],
    },
    openrouter: {
      name: "OpenRouter",
      keyUrl: "https://openrouter.ai/settings/keys",
      keyLabel: "Mở trang tạo API key OpenRouter",
      placeholder: "Thường bắt đầu bằng sk-or-...",
      models: [
        ["openrouter/free", "OpenRouter Free — tự chọn model miễn phí"],
        ["google/gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"],
        ["openai/gpt-5-mini", "OpenAI GPT-5 mini"],
      ],
    },
  };

  const state = {
    mode: "create",
    result: null,
    busy: false,
    apiTesting: false,
    turnstileId: null,
    turnstileToken: "",
    lastTurnstileToken: "",
    turnstileRequired: true,
    toastTimer: null,
    saveTimer: null,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    form: $("#writer-form"),
    createFields: $("#create-fields"),
    reviseFields: $("#revise-fields"),
    modeButtons: $$(".mode-button"),
    generateButton: $("#generate-button"),
    buttonLabel: $("#generate-button .button-label"),
    clearButton: $("#clear-form-button"),
    emptyState: $("#empty-state"),
    resultContent: $("#result-content"),
    articleTitle: $("#article-title"),
    articleSapo: $("#article-sapo"),
    articleBody: $("#article-body"),
    articleHashtags: $("#article-hashtags"),
    alternativeTitles: $("#alternative-titles"),
    seoDetails: $("#seo-details"),
    seoDescription: $("#seo-description"),
    seoSlug: $("#seo-slug"),
    photoCaptions: $("#photo-captions"),
    factCheckList: $("#fact-check-list"),
    factCheckCount: $("#fact-check-count"),
    chatInput: $("#chat-input"),
    chatSendButton: $("#chat-send-button"),
    chatLog: $("#chat-log"),
    saveStatus: $("#save-status"),
    toast: $("#toast"),
    errorDialog: $("#error-dialog"),
    errorMessage: $("#error-message"),
    turnstileMessage: $("#turnstile-message"),
    aiProvider: $("#ai-provider"),
    aiModel: $("#ai-model"),
    customModelField: $("#custom-model-field"),
    customModel: $("#custom-model"),
    apiKey: $("#user-api-key"),
    apiTestButton: $("#test-api-button"),
    apiTestStatus: $("#api-test-status"),
    toggleApiKey: $("#toggle-api-key"),
    rememberApiKey: $("#remember-api-key"),
    providerKeyLink: $("#provider-key-link"),
  };

  function normalizeResult(input) {
    const value = input && typeof input === "object" ? input : {};
    const asText = (item) => (typeof item === "string" ? item.trim() : "");
    const asList = (item, max = 20) =>
      Array.isArray(item) ? item.map(asText).filter(Boolean).slice(0, max) : [];

    return {
      title: asText(value.title),
      sapo: asText(value.sapo),
      paragraphs: asList(value.paragraphs, 30),
      alternativeTitles: asList(value.alternativeTitles, 8),
      seoDescription: asText(value.seoDescription),
      seoSlug: asText(value.seoSlug),
      hashtags: asList(value.hashtags, 15),
      photoCaptions: asList(value.photoCaptions, 8),
      factChecks: asList(value.factChecks, 15),
    };
  }

  function getFormData() {
    const formData = new FormData(elements.form);
    return {
      platform: String(formData.get("platform") || "website"),
      what: String(formData.get("what") || "").trim(),
      who: String(formData.get("who") || "").trim(),
      when: String(formData.get("when") || "").trim(),
      where: String(formData.get("where") || "").trim(),
      why: String(formData.get("why") || "").trim(),
      how: String(formData.get("how") || "").trim(),
      extra: String(formData.get("extra") || "").trim(),
      sourceArticle: String(formData.get("sourceArticle") || "").trim(),
      editLevel: String(formData.get("editLevel") || "standard"),
      length: String(formData.get("length") || "500"),
      style: String(formData.get("style") || "journalistic"),
      audience: String(formData.get("audience") || "general"),
      keywords: String(formData.get("keywords") || "").trim(),
      includeSeo: formData.get("includeSeo") === "on",
    };
  }

  function readSessionCredentials() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return {};
    }
  }

  function saveSessionCredentials() {
    if (!elements.rememberApiKey.checked) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const provider = elements.aiProvider.value;
    const apiKey = elements.apiKey.value.trim();
    const selectedModel = elements.aiModel.value;
    const model = selectedModel === "__custom__" ? elements.customModel.value.trim() : selectedModel;
    const allCredentials = readSessionCredentials();
    if (apiKey) allCredentials[provider] = { apiKey, model };
    else delete allCredentials[provider];
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(allCredentials));
  }

  function loadProviderCredentials(provider) {
    const saved = readSessionCredentials()[provider];
    elements.apiKey.value = saved?.apiKey || "";
    return saved?.model || "";
  }

  function updateProviderUI(preferredModel = "") {
    const provider = elements.aiProvider.value;
    const config = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
    const currentModel = preferredModel || elements.aiModel.value;
    elements.aiModel.replaceChildren();
    config.models.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      elements.aiModel.append(option);
    });
    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "Model khác — tự nhập mã";
    elements.aiModel.append(customOption);

    const knownModel = config.models.some(([value]) => value === currentModel);
    if (knownModel) {
      elements.aiModel.value = currentModel;
      elements.customModel.value = "";
    } else if (currentModel) {
      elements.aiModel.value = "__custom__";
      elements.customModel.value = currentModel;
    }
    elements.customModelField.hidden = elements.aiModel.value !== "__custom__";
    elements.providerKeyLink.href = config.keyUrl;
    elements.providerKeyLink.textContent = config.keyLabel;
    elements.apiKey.placeholder = config.placeholder;
    setApiTestStatus("Chưa kiểm tra API key.");
  }

  function setApiTestStatus(message, type = "") {
    elements.apiTestStatus.textContent = message;
    elements.apiTestStatus.className = "api-test-status";
    if (type) elements.apiTestStatus.classList.add(`is-${type}`);
  }

  function getCredentials() {
    const provider = elements.aiProvider.value;
    const selectedModel = elements.aiModel.value;
    const model = (selectedModel === "__custom__" ? elements.customModel.value : selectedModel).trim();
    const apiKey = elements.apiKey.value.trim();
    elements.apiKey.removeAttribute("aria-invalid");
    elements.customModel.removeAttribute("aria-invalid");

    if (!AI_PROVIDERS[provider]) {
      showError("Nhà cung cấp AI không hợp lệ.");
      return null;
    }
    if (!model || !/^[A-Za-z0-9._:/~-]{2,160}$/.test(model)) {
      const field = selectedModel === "__custom__" ? elements.customModel : elements.aiModel;
      field.setAttribute("aria-invalid", "true");
      field.focus();
      showError("Vui lòng chọn hoặc nhập đúng mã model AI.");
      return null;
    }
    if (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey)) {
      elements.apiKey.setAttribute("aria-invalid", "true");
      elements.apiKey.focus();
      showError("Vui lòng nhập API key hợp lệ của nhà cung cấp đã chọn.");
      return null;
    }
    saveSessionCredentials();
    return { provider, model, apiKey };
  }

  function validateForm(data) {
    $$("[aria-invalid='true']", elements.form).forEach((field) => field.removeAttribute("aria-invalid"));
    const required = state.mode === "create" ? $("#what") : $("#source-article");
    const valid = state.mode === "create" ? data.what.length >= 3 : data.sourceArticle.length >= 40;
    if (!valid) {
      required.setAttribute("aria-invalid", "true");
      required.focus();
      showError(
        state.mode === "create"
          ? "Vui lòng nhập tên hoặc nội dung chính của sự kiện."
          : "Bài viết cần biên tập phải có ít nhất 40 ký tự."
      );
      return false;
    }
    return true;
  }

  function setMode(mode, { save = true } = {}) {
    state.mode = mode === "revise" ? "revise" : "create";
    elements.modeButtons.forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    elements.createFields.hidden = state.mode !== "create";
    elements.reviseFields.hidden = state.mode !== "revise";
    elements.buttonLabel.textContent = state.mode === "create" ? "Tạo bài viết" : "Biên tập bài viết";
    if (save) scheduleDraftSave();
  }

  function setBusy(busy, label = "Đang xử lý...") {
    state.busy = busy;
    elements.generateButton.disabled = busy;
    elements.chatSendButton.disabled = busy;
    elements.generateButton.classList.toggle("is-loading", busy);
    if (busy) elements.buttonLabel.textContent = label;
    else elements.buttonLabel.textContent = state.mode === "create" ? "Tạo bài viết" : "Biên tập bài viết";
  }

  function showError(message) {
    elements.errorMessage.textContent = message || "Đã xảy ra lỗi. Vui lòng thử lại.";
    if (typeof elements.errorDialog.showModal === "function") elements.errorDialog.showModal();
    else window.alert(elements.errorMessage.textContent);
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
  }

  function appendTextElement(parent, tag, text, className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    parent.append(node);
    return node;
  }

  function renderResult(rawResult) {
    const result = normalizeResult(rawResult);
    if (!result.title || !result.paragraphs.length) {
      showError("AI chưa trả về bài viết đúng cấu trúc. Vui lòng thử lại.");
      return false;
    }

    state.result = result;
    elements.emptyState.hidden = true;
    elements.resultContent.hidden = false;
    elements.articleTitle.textContent = result.title;
    elements.articleSapo.textContent = result.sapo;
    elements.articleBody.replaceChildren();
    result.paragraphs.forEach((paragraph) => appendTextElement(elements.articleBody, "p", paragraph));
    elements.articleHashtags.textContent = result.hashtags.join(" ");

    elements.alternativeTitles.replaceChildren();
    result.alternativeTitles.forEach((title) => {
      const row = document.createElement("div");
      row.className = "title-option";
      appendTextElement(row, "p", title);
      const useButton = document.createElement("button");
      useButton.type = "button";
      useButton.textContent = "Dùng tiêu đề";
      useButton.addEventListener("click", () => {
        state.result.title = title;
        elements.articleTitle.textContent = title;
        scheduleDraftSave();
        showToast("Đã thay tiêu đề.");
      });
      row.append(useButton);
      elements.alternativeTitles.append(row);
    });

    elements.seoDescription.textContent = result.seoDescription || "Không tạo";
    elements.seoSlug.textContent = result.seoSlug || "Không tạo";
    elements.photoCaptions.textContent = result.photoCaptions.length ? result.photoCaptions.join("\n") : "Không tạo";
    elements.seoDetails.hidden = !(
      result.seoDescription || result.seoSlug || result.photoCaptions.length
    );

    const checks = result.factChecks.length
      ? result.factChecks
      : ["Đối chiếu tên riêng, thời gian, địa điểm, số liệu và trích dẫn với nguồn gốc."];
    elements.factCheckList.replaceChildren();
    checks.forEach((item) => appendTextElement(elements.factCheckList, "li", item));
    elements.factCheckCount.textContent = `${checks.length} mục`;
    scheduleDraftSave();
    return true;
  }

  function articleAsPlainText() {
    if (!state.result) return "";
    const parts = [state.result.title, state.result.sapo, ...state.result.paragraphs];
    if (state.result.hashtags.length) parts.push(state.result.hashtags.join(" "));
    return parts.filter(Boolean).join("\n\n");
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function articleAsHtml() {
    if (!state.result) return "";
    return [
      `<h1>${escapeHtml(state.result.title)}</h1>`,
      `<p><em><strong>${escapeHtml(state.result.sapo)}</strong></em></p>`,
      ...state.result.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
      state.result.hashtags.length ? `<p>${escapeHtml(state.result.hashtags.join(" "))}</p>` : "",
    ].filter(Boolean).join("\n");
  }

  async function copyToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
      showToast(successMessage);
    }
  }

  function xmlEscape(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function wordRun(text, options = {}) {
    const properties = [
      options.bold ? "<w:b/>" : "",
      options.italic ? "<w:i/>" : "",
      `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/>`,
      `<w:sz w:val="${options.size || 26}"/><w:szCs w:val="${options.size || 26}"/>`,
      `<w:lang w:val="vi-VN"/>`,
    ].join("");
    return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
  }

  function wordParagraph(text, type = "body") {
    const settings = {
      title: {
        pPr: '<w:jc w:val="center"/><w:spacing w:before="0" w:after="240" w:line="276" w:lineRule="auto"/><w:keepNext/><w:widowControl/>',
        run: { bold: true, size: 28 },
      },
      sapo: {
        pPr: '<w:jc w:val="both"/><w:spacing w:before="0" w:after="120" w:line="276" w:lineRule="auto"/><w:widowControl/>',
        run: { bold: true, italic: true, size: 26 },
      },
      body: {
        pPr: '<w:jc w:val="both"/><w:ind w:firstLine="709"/><w:spacing w:before="0" w:after="120" w:line="276" w:lineRule="auto"/><w:widowControl/>',
        run: { size: 26 },
      },
      hashtags: {
        pPr: '<w:jc w:val="left"/><w:spacing w:before="120" w:after="0" w:line="276" w:lineRule="auto"/><w:widowControl/>',
        run: { italic: true, size: 26 },
      },
    }[type];
    return `<w:p><w:pPr>${settings.pPr}</w:pPr>${wordRun(text, settings.run)}</w:p>`;
  }

  function createDocxFiles() {
    const article = state.result;
    const body = [
      wordParagraph(article.title, "title"),
      wordParagraph(article.sapo, "sapo"),
      ...article.paragraphs.map((paragraph) => wordParagraph(paragraph, "body")),
      article.hashtags.length ? wordParagraph(article.hashtags.join(" "), "hashtags") : "",
    ].join("");
    const now = new Date().toISOString();

    return {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
      "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(article.title)}</dc:title><dc:creator>Học liệu số</dc:creator><cp:lastModifiedBy>Học liệu số</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
      "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Học liệu số</Application><AppVersion>2.2</AppVersion></Properties>`,
      "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:headerReference w:type="first" r:id="rId2"/><w:titlePg/><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1984" w:header="567" w:footer="567" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`,
      "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`,
      "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`,
      "word/settings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="709"/><w:updateFields w:val="true"/><w:compat/></w:settings>`,
      "word/header1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>`,
      "word/header2.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:hdr>`,
    };
  }

  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let k = 0; k < 8; k += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[n] = value >>> 0;
    }
    return table;
  }

  const CRC_TABLE = makeCrcTable();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  function concatBytes(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      output.set(chunk, offset);
      offset += chunk.length;
    });
    return output;
  }

  function createStoredZip(files) {
    const encoder = new TextEncoder();
    const localChunks = [];
    const centralChunks = [];
    let localOffset = 0;
    const { time, day } = zipDateTime();

    Object.entries(files).forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const dataBytes = encoder.encode(content);
      const checksum = crc32(dataBytes);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, time, true);
      localView.setUint16(12, day, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      localChunks.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, time, true);
      centralView.setUint16(14, day, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, localOffset, true);
      centralHeader.set(nameBytes, 46);
      centralChunks.push(centralHeader);
      localOffset += localHeader.length + dataBytes.length;
    });

    const localData = concatBytes(localChunks);
    const centralData = concatBytes(centralChunks);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, centralChunks.length, true);
    endView.setUint16(10, centralChunks.length, true);
    endView.setUint32(12, centralData.length, true);
    endView.setUint32(16, localData.length, true);
    endView.setUint16(20, 0, true);
    return concatBytes([localData, centralData, end]);
  }

  function safeFilename(value) {
    const normalized = String(value || "bai-viet")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return normalized || "bai-viet";
  }

  function downloadWord() {
    if (!state.result) return;
    try {
      const bytes = createStoredZip(createDocxFiles());
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFilename(state.result.seoSlug || state.result.title)}.docx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Đã tạo tệp Word chuẩn trình bày Nghị định 30.");
    } catch {
      showError("Chưa thể tạo tệp Word. Vui lòng thử lại.");
    }
  }

  function addChatMessage(role, text) {
    const message = document.createElement("div");
    message.className = `chat-message ${role}`;
    message.textContent = text;
    elements.chatLog.append(message);
    elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
  }

  function readTurnstileToken() {
    if (state.turnstileId === null || !window.turnstile) return "";
    try {
      if (typeof window.turnstile.isExpired === "function" && window.turnstile.isExpired(state.turnstileId)) {
        state.turnstileToken = "";
        return "";
      }
    } catch {
      state.turnstileToken = "";
    }

    let token = String(state.turnstileToken || "").trim();
    if (!token) {
      try {
        token = String(window.turnstile.getResponse(state.turnstileId) || "").trim();
      } catch {
        token = "";
      }
    }
    if (!token || token === state.lastTurnstileToken) return "";
    state.turnstileToken = token;
    return token;
  }

  function clearTurnstileResponseFields() {
    elements.form
      .querySelectorAll('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]')
      .forEach((field) => {
        field.value = "";
      });
  }

  async function getTurnstileToken() {
    if (!state.turnstileRequired) return "development-bypass";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const token = readTurnstileToken();
      if (token) {
        state.lastTurnstileToken = token;
        state.turnstileToken = "";
        clearTurnstileResponseFields();
        return token;
      }
      if (attempt < 11) await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    showError("Lượt xác minh chưa sẵn sàng hoặc đã được sử dụng. Vui lòng chờ Turnstile xác minh lại rồi nhấn Tạo bài viết.");
    return "";
  }

  function resetTurnstile(message = "Đang tạo lượt xác minh mới...") {
    state.turnstileToken = "";
    clearTurnstileResponseFields();
    if (state.turnstileRequired && state.turnstileId !== null && window.turnstile) {
      try {
        window.turnstile.reset(state.turnstileId);
        elements.turnstileMessage.textContent = message;
      } catch {
        elements.turnstileMessage.textContent = "Chưa thể làm mới xác minh. Hãy tải lại trang.";
      }
    }
  }

  async function apiRequest(payload) {
    const credentials = getCredentials();
    if (!credentials) return null;
    const token = await getTurnstileToken();
    if (!token) return null;
    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...credentials, turnstileToken: token }),
      });
    } catch {
      throw new Error("Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.");
    } finally {
      resetTurnstile();
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      const error = new Error(data.message || "Máy chủ chưa thể xử lý yêu cầu.");
      error.code = data.code || "UNKNOWN";
      throw error;
    }
    return data.result;
  }

  async function handleApiTest() {
    if (state.apiTesting || state.busy) return;
    const credentials = getCredentials();
    if (!credentials) return;
    state.apiTesting = true;
    elements.apiTestButton.disabled = true;
    elements.apiTestButton.textContent = "Đang kiểm tra...";
    setApiTestStatus("Đang kết nối tới nhà cung cấp AI...", "testing");
    try {
      const response = await fetch(API_TEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      if (!response.ok) throw new Error(data.message || "Chưa thể kiểm tra API key.");
      setApiTestStatus(data.message || "API key hợp lệ và đã kết nối thành công.", "success");
    } catch (error) {
      setApiTestStatus(error.message || "Không thể kết nối nhà cung cấp AI.", "error");
    } finally {
      state.apiTesting = false;
      elements.apiTestButton.disabled = false;
      elements.apiTestButton.textContent = "Kiểm tra API";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.busy) return;
    const data = getFormData();
    if (!validateForm(data)) return;

    setBusy(true, state.mode === "create" ? "AI đang viết..." : "AI đang biên tập...");
    try {
      const result = await apiRequest({ mode: state.mode, data });
      if (result && renderResult(result)) {
        elements.chatLog.replaceChildren();
        addChatMessage("assistant", "Bài viết đã sẵn sàng. Bạn có thể yêu cầu tôi chỉnh sửa thêm.");
        showToast("Đã tạo bài viết.");
        if (window.innerWidth < 1020) $("#result-title").scrollIntoView({ behavior: "smooth" });
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleChat(instruction) {
    const request = String(instruction || elements.chatInput.value).trim();
    if (!request || !state.result || state.busy) return;
    elements.chatInput.value = "";
    addChatMessage("user", request);
    setBusy(true, "Đang xử lý...");
    elements.chatSendButton.textContent = "Đang sửa...";
    try {
      const result = await apiRequest({
        mode: "chat",
        data: {
          platform: getFormData().platform,
          instruction: request,
          currentArticle: state.result,
        },
      });
      if (result && renderResult(result)) {
        addChatMessage("assistant", "Tôi đã cập nhật bài viết theo yêu cầu.");
      }
    } catch (error) {
      addChatMessage("assistant", "Chưa thể chỉnh sửa ở lần này.");
      showError(error.message);
    } finally {
      setBusy(false);
      elements.chatSendButton.textContent = "Gửi";
    }
  }

  function serializeDraft() {
    const fields = {};
    $$("input, textarea, select", elements.form).forEach((field) => {
      if (!field.name || field.name === "cf-turnstile-response") return;
      if (field.type === "radio") {
        if (field.checked) fields[field.name] = field.value;
      } else if (field.type === "checkbox") {
        fields[field.name] = field.checked;
      } else {
        fields[field.name] = field.value;
      }
    });
    return { mode: state.mode, fields, result: state.result, savedAt: Date.now() };
  }

  function scheduleDraftSave() {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft()));
        elements.saveStatus.textContent = "Đã lưu bản nháp";
      } catch {
        elements.saveStatus.textContent = "";
      }
    }, 450);
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!draft || !draft.fields) return;
      setMode(draft.mode, { save: false });
      if (AI_PROVIDERS[draft.fields.aiProvider]) elements.aiProvider.value = draft.fields.aiProvider;
      const preferredModel =
        draft.fields.aiModel === "__custom__" ? draft.fields.customModel : draft.fields.aiModel;
      updateProviderUI(String(preferredModel || ""));
      Object.entries(draft.fields).forEach(([name, value]) => {
        const fields = $$(`[name="${CSS.escape(name)}"]`, elements.form);
        fields.forEach((field) => {
          if (field.type === "radio") field.checked = field.value === value;
          else if (field.type === "checkbox") field.checked = Boolean(value);
          else field.value = String(value ?? "");
        });
      });
      elements.customModelField.hidden = elements.aiModel.value !== "__custom__";
      const sessionModel = loadProviderCredentials(elements.aiProvider.value);
      if (sessionModel) updateProviderUI(sessionModel);
      if (draft.result) renderResult(draft.result);
      elements.saveStatus.textContent = "Đã khôi phục bản nháp";
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function clearDraft() {
    if (!window.confirm("Xóa toàn bộ nội dung đang nhập và bài viết đã tạo?")) return;
    elements.form.reset();
    const sessionModel = loadProviderCredentials(elements.aiProvider.value);
    updateProviderUI(sessionModel);
    setMode("create", { save: false });
    state.result = null;
    elements.resultContent.hidden = true;
    elements.emptyState.hidden = false;
    elements.chatLog.replaceChildren();
    localStorage.removeItem(STORAGE_KEY);
    elements.saveStatus.textContent = "Đã xóa bản nháp";
    showToast("Đã xóa nội dung.");
  }

  async function waitForTurnstile(timeout = 10000) {
    const started = Date.now();
    while (!window.turnstile && Date.now() - started < timeout) {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    return Boolean(window.turnstile);
  }

  async function initTurnstile() {
    try {
      const response = await fetch(CONFIG_URL, { headers: { Accept: "application/json" } });
      const config = await response.json();
      if (!response.ok) throw new Error();
      state.turnstileRequired = config.turnstileRequired !== false;
      if (!state.turnstileRequired) {
        elements.turnstileMessage.textContent = "Chế độ kiểm thử cục bộ.";
        return;
      }
      if (!config.turnstileSiteKey || !(await waitForTurnstile())) throw new Error();
      state.turnstileId = window.turnstile.render("#turnstile-widget", {
        sitekey: config.turnstileSiteKey,
        theme: "light",
        size: "flexible",
        action: "write_news",
        "response-field": false,
        retry: "auto",
        "retry-interval": 5000,
        callback: (token) => {
          const freshToken = String(token || "").trim();
          state.turnstileToken = freshToken === state.lastTurnstileToken ? "" : freshToken;
          elements.turnstileMessage.textContent = state.turnstileToken
            ? "Đã xác minh. Lượt xác minh này chỉ dùng một lần."
            : "Đang tạo lượt xác minh mới...";
        },
        "expired-callback": () => {
          state.turnstileToken = "";
          clearTurnstileResponseFields();
          elements.turnstileMessage.textContent = "Xác minh đã hết hạn. Vui lòng xác minh lại.";
        },
        "timeout-callback": () => {
          state.turnstileToken = "";
          clearTurnstileResponseFields();
          elements.turnstileMessage.textContent = "Xác minh đã quá thời gian. Đang thử lại...";
          window.setTimeout(() => resetTurnstile(), 600);
        },
        "error-callback": (errorCode) => {
          state.turnstileToken = "";
          clearTurnstileResponseFields();
          elements.turnstileMessage.textContent = `Turnstile chưa xác minh được (mã ${String(errorCode || "không rõ")}). Hãy tải lại trang.`;
          return true;
        },
      });
      elements.turnstileMessage.textContent = "Hoàn tất xác minh trước khi dùng AI.";
    } catch {
      elements.turnstileMessage.textContent = "Chưa tải được bước xác minh. Hãy tải lại trang.";
    }
  }

  function bindEvents() {
    elements.form.addEventListener("submit", handleSubmit);
    elements.form.addEventListener("input", scheduleDraftSave);
    elements.form.addEventListener("change", scheduleDraftSave);
    elements.modeButtons.forEach((button) =>
      button.addEventListener("click", () => setMode(button.dataset.mode))
    );
    elements.clearButton.addEventListener("click", clearDraft);
    elements.aiProvider.addEventListener("change", () => {
      const sessionModel = loadProviderCredentials(elements.aiProvider.value);
      updateProviderUI(sessionModel);
      scheduleDraftSave();
    });
    elements.aiModel.addEventListener("change", () => {
      elements.customModelField.hidden = elements.aiModel.value !== "__custom__";
      if (!elements.customModelField.hidden) elements.customModel.focus();
      saveSessionCredentials();
      setApiTestStatus("API key hoặc model đã thay đổi; vui lòng kiểm tra lại.");
    });
    elements.customModel.addEventListener("input", () => {
      saveSessionCredentials();
      setApiTestStatus("API key hoặc model đã thay đổi; vui lòng kiểm tra lại.");
    });
    elements.apiKey.addEventListener("input", () => {
      saveSessionCredentials();
      setApiTestStatus("API key hoặc model đã thay đổi; vui lòng kiểm tra lại.");
    });
    elements.rememberApiKey.addEventListener("change", saveSessionCredentials);
    elements.apiTestButton.addEventListener("click", handleApiTest);
    elements.toggleApiKey.addEventListener("click", () => {
      const show = elements.apiKey.type === "password";
      elements.apiKey.type = show ? "text" : "password";
      elements.toggleApiKey.textContent = show ? "Ẩn" : "Hiện";
      elements.toggleApiKey.setAttribute("aria-pressed", String(show));
      elements.toggleApiKey.setAttribute("aria-label", show ? "Ẩn API key" : "Hiện API key");
      elements.apiKey.focus();
    });
    $("#copy-text-button").addEventListener("click", () =>
      copyToClipboard(articleAsPlainText(), "Đã sao chép văn bản.")
    );
    $("#copy-html-button").addEventListener("click", () =>
      copyToClipboard(articleAsHtml(), "Đã sao chép HTML.")
    );
    $("#download-word-button").addEventListener("click", downloadWord);
    $("#print-button").addEventListener("click", () => window.print());
    elements.chatSendButton.addEventListener("click", () => handleChat());
    elements.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleChat();
      }
    });
    $$(".quick-actions button").forEach((button) =>
      button.addEventListener("click", () => handleChat(button.dataset.instruction))
    );
  }

  bindEvents();
  updateProviderUI(loadProviderCredentials(elements.aiProvider.value));
  restoreDraft();
  initTurnstile();
})();
