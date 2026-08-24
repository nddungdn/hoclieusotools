(() => {
  "use strict";
  const cfg = window.TAOANH_CONFIG || {};
  const API_BASE = String(cfg.API_BASE_URL || "").replace(/\/$/, "");
  const MAX_MB = Number(cfg.MAX_IMAGE_MB || 15);
  const $ = (id) => document.getElementById(id);

  const els = {
    sourceFile: $("sourceFile"), uploadZone: $("uploadZone"), sourcePreviewWrap: $("sourcePreviewWrap"),
    sourceCanvas: $("sourceCanvas"), selectionHint: $("selectionHint"), selectFaceBtn: $("selectFaceBtn"), clearFaceBtn: $("clearFaceBtn"), faceStatus: $("faceStatus"),
    provider: $("provider"), apiKey: $("apiKey"), rememberKey: $("rememberKey"), toggleKey: $("toggleKey"), checkKeyBtn: $("checkKeyBtn"), apiStatus: $("apiStatus"),
    background: $("background"), backgroundCount: $("backgroundCount"), outfit: $("outfit"), pose: $("pose"), preserveMode: $("preserveMode"), beauty: $("beauty"), aspectRatio: $("aspectRatio"), resolution: $("resolution"), quality: $("quality"), modeNote: $("modeNote"), rightsConsent: $("rightsConsent"),
    generateBtn: $("generateBtn"), progressBox: $("progressBox"), progressTitle: $("progressTitle"), progressText: $("progressText"),
    resultEmpty: $("resultEmpty"), resultContent: $("resultContent"), resultImage: $("resultImage"), downloadBtn: $("downloadBtn"), newImageBtn: $("newImageBtn"), providerBadge: $("providerBadge"), refineText: $("refineText"), refineBtn: $("refineBtn"), quickChips: $("quickChips")
  };

  const state = {
    sourceFile: null,
    sourceDataUrl: "",
    sourceMime: "",
    image: null,
    display: { w: 0, h: 0 },
    selecting: false,
    dragging: false,
    dragStart: null,
    faceBox: null,
    resultDataUrl: "",
    resultMime: "image/jpeg",
    interactionId: null
  };

  $("versionBadge").textContent = `v${cfg.APP_VERSION || "1.0.0"}`;
  $("maxMbText").textContent = String(MAX_MB);

  function setStatus(text, type = "") {
    els.apiStatus.textContent = text;
    els.apiStatus.className = `api-status ${type ? `status-${type}` : ""}`;
  }

  function modeNote() {
    if (els.preserveMode.value === "pixel") {
      els.modeNote.innerHTML = "<strong>Giữ mặt tối đa:</strong> ưu tiên góc mặt và cấu trúc mặt gốc. Nếu tư thế mới xung đột với việc giữ mặt, hệ thống sẽ giảm mức thay đổi tư thế. Khoanh vùng khuôn mặt để tăng tín hiệu bảo vệ.";
    } else {
      els.modeNote.innerHTML = "<strong>Giữ nhận diện:</strong> phù hợp khi đổi tư thế/góc đầu nhiều hơn. AI có thể tái dựng khuôn mặt nhưng phải ưu tiên đúng người và đặc điểm nhận diện.";
    }
  }
  modeNote();
  els.preserveMode.addEventListener("change", modeNote);
  els.background.addEventListener("input", () => els.backgroundCount.textContent = String(els.background.value.length));

  function storedKeyName() { return `taoanh_api_${els.provider.value}`; }
  function loadStoredKey() {
    const key = localStorage.getItem(storedKeyName()) || "";
    els.apiKey.value = key;
    els.rememberKey.checked = Boolean(key);
    setStatus("");
  }
  els.provider.addEventListener("change", loadStoredKey);
  loadStoredKey();

  els.toggleKey.addEventListener("click", () => {
    els.apiKey.type = els.apiKey.type === "password" ? "text" : "password";
  });
  els.rememberKey.addEventListener("change", () => {
    if (!els.rememberKey.checked) localStorage.removeItem(storedKeyName());
    else if (els.apiKey.value.trim()) localStorage.setItem(storedKeyName(), els.apiKey.value.trim());
  });
  els.apiKey.addEventListener("change", () => {
    if (els.rememberKey.checked && els.apiKey.value.trim()) localStorage.setItem(storedKeyName(), els.apiKey.value.trim());
  });

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader(); r.onerror = () => reject(new Error("Không đọc được tệp ảnh.")); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file);
    });
  }
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Ảnh không hợp lệ.")); img.src = dataUrl;
    });
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return alert("Chỉ hỗ trợ JPG, PNG hoặc WebP.");
    if (file.size > MAX_MB * 1024 * 1024) return alert(`Ảnh vượt quá ${MAX_MB} MB.`);
    try {
      const dataUrl = await readFileDataUrl(file);
      const img = await loadImage(dataUrl);
      state.sourceFile = file; state.sourceDataUrl = dataUrl; state.sourceMime = file.type; state.image = img; state.faceBox = null; state.interactionId = null;
      els.sourcePreviewWrap.classList.remove("hidden"); els.uploadZone.querySelector("strong").textContent = file.name;
      els.clearFaceBtn.classList.add("hidden"); els.faceStatus.textContent = "Chưa khoanh vùng";
      drawSource();
    } catch (e) { alert(e.message || "Không thể mở ảnh."); }
  }
  els.sourceFile.addEventListener("change", (e) => handleFile(e.target.files?.[0]));
  ["dragenter","dragover"].forEach(ev => els.uploadZone.addEventListener(ev, e => {e.preventDefault(); els.uploadZone.style.borderColor="#4f46e5";}));
  ["dragleave","drop"].forEach(ev => els.uploadZone.addEventListener(ev, e => {e.preventDefault(); els.uploadZone.style.borderColor="";}));
  els.uploadZone.addEventListener("drop", e => handleFile(e.dataTransfer.files?.[0]));

  function drawSource(tempBox = null) {
    if (!state.image) return;
    const maxW = Math.min(760, els.sourcePreviewWrap.clientWidth || 760);
    const scale = Math.min(1, maxW / state.image.naturalWidth, 460 / state.image.naturalHeight);
    const w = Math.max(1, Math.round(state.image.naturalWidth * scale));
    const h = Math.max(1, Math.round(state.image.naturalHeight * scale));
    const c = els.sourceCanvas; c.width = w; c.height = h; state.display = {w,h};
    const ctx = c.getContext("2d"); ctx.clearRect(0,0,w,h); ctx.drawImage(state.image,0,0,w,h);
    const box = tempBox || state.faceBox;
    if (box) {
      const x=box.x*w,y=box.y*h,bw=box.w*w,bh=box.h*h;
      ctx.save(); ctx.lineWidth=3; ctx.strokeStyle="#ffffff"; ctx.shadowColor="rgba(79,70,229,.9)"; ctx.shadowBlur=8; ctx.setLineDash([8,5]); ctx.strokeRect(x,y,bw,bh); ctx.restore();
    }
  }
  window.addEventListener("resize", () => drawSource());

  function canvasPoint(e) {
    const r = els.sourceCanvas.getBoundingClientRect();
    return { x: Math.max(0,Math.min(r.width,e.clientX-r.left)), y: Math.max(0,Math.min(r.height,e.clientY-r.top)), rw:r.width, rh:r.height };
  }
  els.selectFaceBtn.addEventListener("click", () => {
    if (!state.image) return alert("Hãy tải ảnh trước.");
    state.selecting = !state.selecting;
    els.selectionHint.classList.toggle("hidden", !state.selecting);
    els.selectFaceBtn.textContent = state.selecting ? "Đang chọn..." : "Khoanh vùng mặt";
  });
  els.clearFaceBtn.addEventListener("click", () => { state.faceBox=null; drawSource(); els.clearFaceBtn.classList.add("hidden"); els.faceStatus.textContent="Chưa khoanh vùng"; });
  els.sourceCanvas.addEventListener("pointerdown", e => {
    if (!state.selecting) return; e.preventDefault(); state.dragging=true; state.dragStart=canvasPoint(e); els.sourceCanvas.setPointerCapture?.(e.pointerId);
  });
  els.sourceCanvas.addEventListener("pointermove", e => {
    if (!state.dragging || !state.dragStart) return; const p=canvasPoint(e); const s=state.dragStart;
    const x=Math.min(s.x,p.x)/p.rw, y=Math.min(s.y,p.y)/p.rh, w=Math.abs(p.x-s.x)/p.rw, h=Math.abs(p.y-s.y)/p.rh;
    if (w>0.01&&h>0.01) drawSource({x,y,w,h});
  });
  els.sourceCanvas.addEventListener("pointerup", e => {
    if (!state.dragging || !state.dragStart) return; const p=canvasPoint(e); const s=state.dragStart; state.dragging=false; state.dragStart=null;
    const box={x:Math.min(s.x,p.x)/p.rw,y:Math.min(s.y,p.y)/p.rh,w:Math.abs(p.x-s.x)/p.rw,h:Math.abs(p.y-s.y)/p.rh};
    if (box.w<0.04||box.h<0.04) return drawSource();
    state.faceBox=box; state.selecting=false; els.selectionHint.classList.add("hidden"); els.selectFaceBtn.textContent="Khoanh lại vùng mặt"; els.clearFaceBtn.classList.remove("hidden"); els.faceStatus.textContent="Đã có vùng bảo vệ"; drawSource();
  });

  function dataUrlParts(dataUrl) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
    if (!m) throw new Error("Dữ liệu ảnh không hợp lệ.");
    return { mime: m[1], data: m[2] };
  }

  async function buildProtectionAssets() {
    if (!state.faceBox || !state.image) return { mask: null, normalizedSource: null, faceReference: null };
    const originalW = state.image.naturalWidth, originalH = state.image.naturalHeight;
    const maxEdge = 4096;
    const scale = Math.min(1, maxEdge / Math.max(originalW, originalH));
    const w = Math.max(1, Math.round(originalW * scale));
    const h = Math.max(1, Math.round(originalH * scale));

    // Normalize the source to PNG so the OpenAI edit image and alpha mask always
    // have the exact same format and dimensions.
    const src = document.createElement("canvas");
    src.width = w; src.height = h;
    const sctx = src.getContext("2d");
    sctx.drawImage(state.image, 0, 0, w, h);
    const normalizedSource = src.toDataURL("image/png");

    const b = state.faceBox;
    const padX = b.w * .12, padY = b.h * .16;
    const x = Math.max(0, (b.x - padX) * w);
    const y = Math.max(0, (b.y - padY) * h);
    const bw = Math.min(w - x, (b.w + 2 * padX) * w);
    const bh = Math.min(h - y, (b.h + 2 * padY) * h);

    // OpenAI mask: transparent pixels are editable; the opaque face ellipse is
    // protected. The mask is guidance, not a mathematically exact pixel lock.
    const mask = document.createElement("canvas");
    mask.width = w; mask.height = h;
    const mctx = mask.getContext("2d");
    mctx.clearRect(0, 0, w, h);
    mctx.save();
    mctx.fillStyle = "rgba(255,255,255,1)";
    mctx.beginPath();
    mctx.ellipse(x + bw/2, y + bh/2, bw/2, bh/2, 0, 0, Math.PI * 2);
    mctx.fill();
    mctx.restore();

    // Face detail crop: useful as a second high-fidelity identity reference,
    // especially for Gemini where semantic masking is prompt-driven.
    const crop = document.createElement("canvas");
    const cropMax = 1024;
    const cropScale = Math.min(1, cropMax / Math.max(bw, bh));
    crop.width = Math.max(1, Math.round(bw * cropScale));
    crop.height = Math.max(1, Math.round(bh * cropScale));
    crop.getContext("2d").drawImage(src, x, y, bw, bh, 0, 0, crop.width, crop.height);
    const faceReference = crop.toDataURL("image/png");

    return { mask: mask.toDataURL("image/png"), normalizedSource, faceReference };
  }

  async function apiPost(path, payload) {
    if (!API_BASE) throw new Error("Chưa cấu hình API_BASE_URL trong config.js.");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 180000);
    try {
      const res = await fetch(`${API_BASE}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload), signal:controller.signal, cache:"no-store", credentials:"omit", referrerPolicy:"no-referrer" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Lỗi máy chủ (${res.status}).`);
      return json;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Yêu cầu quá thời gian. Hãy thử lại với độ phân giải thấp hơn.");
      throw e;
    } finally { clearTimeout(timer); }
  }

  els.checkKeyBtn.addEventListener("click", async () => {
    const apiKey=els.apiKey.value.trim(); if (!apiKey) return setStatus("Chưa nhập API key", "bad");
    setStatus("Đang kiểm tra...", "warn"); els.checkKeyBtn.disabled=true;
    try {
      const r=await apiPost("/v1/key-check", {provider:els.provider.value,apiKey});
      setStatus(r.message || "API key hợp lệ", "ok"); if (els.rememberKey.checked) localStorage.setItem(storedKeyName(),apiKey);
    } catch(e){ setStatus(e.message,"bad"); }
    finally{ els.checkKeyBtn.disabled=false; }
  });

  function validateGenerate() {
    if (!state.sourceDataUrl) return "Hãy tải ảnh gốc.";
    if (!els.apiKey.value.trim()) return "Hãy nhập API key cá nhân.";
    if (!els.background.value.trim()) return "Hãy mô tả bối cảnh mong muốn.";
    if (!els.rightsConsent.checked) return "Hãy xác nhận quyền sử dụng ảnh.";
    return "";
  }
  function setBusy(busy, title="Đang xử lý ảnh...", text="Thời gian phụ thuộc model, độ phân giải và API của bạn.") {
    els.generateBtn.disabled=busy; els.refineBtn.disabled=busy; els.checkKeyBtn.disabled=busy; els.progressBox.classList.toggle("hidden",!busy); els.progressTitle.textContent=title; els.progressText.textContent=text;
  }
  function showResult(r) {
    state.resultMime=r.mimeType || "image/jpeg"; state.resultDataUrl=`data:${state.resultMime};base64,${r.imageBase64}`; state.interactionId=r.interactionId || null;
    els.resultImage.src=state.resultDataUrl; els.downloadBtn.href=state.resultDataUrl; els.downloadBtn.download=`taoanh-ai-${Date.now()}.${state.resultMime.includes("png")?"png":state.resultMime.includes("webp")?"webp":"jpg"}`;
    els.resultEmpty.classList.add("hidden"); els.resultContent.classList.remove("hidden"); els.providerBadge.textContent=r.model || (els.provider.value==="gemini"?"Gemini":"OpenAI");
    els.resultContent.scrollIntoView({behavior:"smooth",block:"start"});
  }

  els.generateBtn.addEventListener("click", async () => {
    const err=validateGenerate(); if (err) return alert(err);
    setBusy(true,"Đang tạo ảnh...","Hệ thống đang áp dụng prompt bảo vệ khuôn mặt ở phía máy chủ.");
    try {
      const protect=await buildProtectionAssets();
      const src=dataUrlParts(protect.normalizedSource || state.sourceDataUrl);
      const mask=protect.mask?dataUrlParts(protect.mask):null;
      const faceRef=protect.faceReference?dataUrlParts(protect.faceReference):null;
      const r=await apiPost("/v1/generate", {action:"generate",provider:els.provider.value,apiKey:els.apiKey.value.trim(),sourceImage:{mimeType:src.mime,data:src.data},faceReference:faceRef?{mimeType:faceRef.mime,data:faceRef.data}:null,maskImage:mask?{mimeType:mask.mime,data:mask.data}:null,faceBox:state.faceBox,background:els.background.value.trim(),outfit:els.outfit.value.trim(),pose:els.pose.value.trim(),preserveMode:els.preserveMode.value,beauty:els.beauty.value,aspectRatio:els.aspectRatio.value,resolution:els.resolution.value,quality:els.quality.value});
      if (els.rememberKey.checked) localStorage.setItem(storedKeyName(),els.apiKey.value.trim()); showResult(r);
    } catch(e){ alert(e.message || "Không thể tạo ảnh."); }
    finally{ setBusy(false); }
  });

  els.quickChips.addEventListener("click", e => { const b=e.target.closest("button[data-text]"); if (!b) return; els.refineText.value=b.dataset.text; els.refineText.focus(); });
  els.refineBtn.addEventListener("click", async () => {
    const text=els.refineText.value.trim(); if (!text) return alert("Hãy nhập nội dung cần chỉnh tiếp."); if (!state.resultDataUrl) return;
    setBusy(true,"Đang chỉnh tiếp...","Ưu tiên ảnh gốc làm nguồn nhận diện và ảnh hiện tại làm bố cục.");
    try {
      const original=dataUrlParts(state.sourceDataUrl); const current=dataUrlParts(state.resultDataUrl);
      const r=await apiPost("/v1/generate", {action:"refine",provider:els.provider.value,apiKey:els.apiKey.value.trim(),sourceImage:{mimeType:original.mime,data:original.data},currentImage:{mimeType:current.mime,data:current.data},previousInteractionId:state.interactionId,refinement:text,preserveMode:els.preserveMode.value,beauty:els.beauty.value,aspectRatio:els.aspectRatio.value,resolution:els.resolution.value,quality:els.quality.value});
      showResult(r); els.refineText.value="";
    } catch(e){ alert(e.message || "Không thể chỉnh tiếp ảnh."); }
    finally{ setBusy(false); }
  });

  els.newImageBtn.addEventListener("click", () => { els.resultEmpty.classList.remove("hidden"); els.resultContent.classList.add("hidden"); state.resultDataUrl=""; state.interactionId=null; window.scrollTo({top:0,behavior:"smooth"}); });
})();
