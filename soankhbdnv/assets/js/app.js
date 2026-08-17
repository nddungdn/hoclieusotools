(() => {
  "use strict";
  const cfg = window.SOANKHBD_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const state = { token: sessionStorage.getItem("soankhbd_token") || "", user: null, mode: null, planType: null, uploaded: new Map(), pl2Activities: [], view: "home" };
  const fileInputs = ["fileSgk","fileSgv","fileTemplate","fileExtra"];

  const schemas = {
    khbd: [
      ["grade","Lớp","select",["6","7","8","9"]],
      ["lessonName","Tên bài/chủ đề","text"],
      ["section","Phần học","select",["Đọc","Thực hành tiếng Việt","Viết","Nói và nghe","Ôn tập","Kiểm tra","Khác"]],
      ["periods","Số tiết","number"],
      ["studentLevel","Đối tượng học sinh","select",["Hỗn hợp","Yếu","Trung bình","Khá","Giỏi"]],
      ["devices","Điều kiện thiết bị số","select",["Không dùng thiết bị của học sinh","Có thể dùng thiết bị số","Tùy điều kiện thực tế"]],
      ["digitalCompetency","Tích hợp năng lực số","select",["Không bắt buộc","Có, khi phù hợp với bài học"]],
      ["specialRequirements","Yêu cầu riêng của giáo viên","textarea"]
    ],
    pl1: [
      ["school","Trường","text"],["group","Tổ chuyên môn","text"],["subject","Môn","text","Ngữ văn"],["grade","Lớp","select",["6","7","8","9"]],
      ["schoolYear","Năm học","text","2026–2027"],["classCount","Số lớp","number"],["studentCount","Số học sinh","number"],["teacherCount","Số giáo viên","number"],
      ["annualPeriods","Tổng số tiết/năm","number"],["weeklyPeriods","Số tiết/tuần","text"],["facilities","Thiết bị/phòng học và điều kiện thực tế","textarea"],["notes","Yêu cầu khác","textarea"]
    ],
    pl2: [
      ["school","Trường","text"],["group","Tổ chuyên môn","text"],["subject","Môn","text","Ngữ văn"],["grade","Khối/lớp","select",["6","7","8","9"]],["schoolYear","Năm học","text","2026–2027"],["generalConditions","Điều kiện chung của nhà trường","textarea"]
    ],
    pl3: [
      ["school","Trường","text"],["group","Tổ chuyên môn","text"],["teacherName","Giáo viên","text"],["subject","Môn","text","Ngữ văn"],["grade","Lớp","select",["6","7","8","9"]],
      ["classes","Các lớp được phân công","text"],["schoolYear","Năm học","text","2026–2027"],["annualPeriods","Tổng số tiết/năm","number"],["otherTasks","Nhiệm vụ khác (nếu có)","textarea"]
    ]
  };

  function setMessage(el, text, kind="") { el.textContent = text || ""; el.className = `message ${kind}`.trim(); }
  function deviceId() { let id = localStorage.getItem("soankhbd_device"); if (!id) { id = crypto.randomUUID(); localStorage.setItem("soankhbd_device", id); } return id; }
  function authHeaders(extra={}) { return { ...extra, ...(state.token ? {Authorization:`Bearer ${state.token}`} : {}) }; }
  async function api(path, options={}) {
    const res = await fetch(`${cfg.API_BASE}${path}`, { ...options, headers: authHeaders(options.headers || {}) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { clearSession(); showLogin("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "bad"); }
    if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
    return data;
  }
  function clearSession(){ state.token=""; state.user=null; sessionStorage.removeItem("soankhbd_token"); }

  async function initGoogle() {
    if (!cfg.GOOGLE_CLIENT_ID || cfg.GOOGLE_CLIENT_ID.startsWith("YOUR_")) {
      showLogin("Chưa cấu hình GOOGLE_CLIENT_ID trong assets/js/config.js.", "bad"); return;
    }
    for (let i=0;i<80 && !(window.google && google.accounts && google.accounts.id);i++) await new Promise(r=>setTimeout(r,100));
    if (!(window.google && google.accounts && google.accounts.id)) { showLogin("Không tải được dịch vụ đăng nhập Google.", "bad"); return; }
    google.accounts.id.initialize({ client_id: cfg.GOOGLE_CLIENT_ID, callback: handleGoogleCredential, auto_select:false, cancel_on_tap_outside:true });
    google.accounts.id.renderButton($("#googleButton"), { theme:"outline", size:"large", shape:"pill", text:"signin_with", width:280 });
  }
  async function handleGoogleCredential(response) {
    setMessage($("#loginMessage"), "Đang xác minh tài khoản…");
    try {
      const data = await api("/v1/auth/google", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ credential:response.credential, deviceId:deviceId() }) });
      state.token=data.token; state.user=data.user; sessionStorage.setItem("soankhbd_token", state.token); showApp();
    } catch (e) { showLogin(e.message, "bad"); }
  }
  async function restoreSession() {
    if (!state.token) return false;
    try { const data=await api("/v1/auth/me"); state.user=data.user; showApp(); return true; } catch { clearSession(); return false; }
  }
  function showLogin(text="",kind="") { $("#loginGate").classList.remove("hidden"); $("#appRoot").classList.add("hidden"); setMessage($("#loginMessage"),text,kind); }
  function initials(name,email){ const s=(name||email||"GV").trim(); const parts=s.split(/\s+/).filter(Boolean); return (parts.length>1 ? parts[0][0]+parts[parts.length-1][0] : s.slice(0,2)).toUpperCase(); }
  function showApp() {
    $("#loginGate").classList.add("hidden"); $("#appRoot").classList.remove("hidden");
    $("#userBadge").textContent=state.user?.email || "";
    $("#sideUserEmail").textContent=state.user?.email || "";
    $("#sideUserName").textContent=state.user?.displayName || "Giáo viên";
    $("#userAvatar").textContent=initials(state.user?.displayName,state.user?.email);
    $("#adminNav").classList.toggle("hidden", state.user?.role !== "admin");
    const collapsed=localStorage.getItem("soankhbd_sidebar_collapsed")==="1"; document.body.classList.toggle("sidebar-collapsed",collapsed);
    goHome(false);
  }
  function closeMobileSidebar(){ document.body.classList.remove("sidebar-open"); }
  function setActiveNav(key){ $$('[data-nav]').forEach(el=>el.classList.toggle("active",el.dataset.nav===key)); }
  function showOnly(viewId){ ["homeView","workspace","futureExam","futureGrading"].forEach(id=>$("#"+id).classList.toggle("hidden",id!==viewId)); closeMobileSidebar(); }
  function setHeader(title,sub){ $("#pageTitle").textContent=title; $("#pageSubtitle").textContent=sub||""; }
  function goHome(scroll=true){ state.view="home"; showOnly("homeView"); setActiveNav("home"); setHeader("Trang chủ","Soạn và quản lý kế hoạch Ngữ văn"); if(scroll) window.scrollTo({top:0,behavior:"smooth"}); }
  function openFuture(kind){ state.view=kind; if(kind==="exam"){showOnly("futureExam");setActiveNav("exam");setHeader("Ra đề kiểm tra","Ma trận · Đặc tả · Đề · Hướng dẫn chấm");}else{showOnly("futureGrading");setActiveNav("grading");setHeader("Chấm bài","Module mở rộng dự kiến");} window.scrollTo({top:0,behavior:"smooth"}); }

  function openMode(mode) {
    state.mode=mode; state.planType = mode === "khbd" ? "khbd" : "pl1"; state.view=mode;
    showOnly("workspace"); setActiveNav(mode); $("#resultCard").classList.add("hidden");
    if (mode === "khbd") {
      $("#workspaceTitle").textContent="Soạn Kế hoạch bài dạy"; $("#workspaceSub").textContent="Phụ lục IV · Công văn 5512"; $("#typeTabs").classList.add("hidden"); setHeader("Soạn Kế hoạch bài dạy","Phụ lục IV · Công văn 5512");
    } else {
      $("#workspaceTitle").textContent="Tạo Kế hoạch dạy học"; $("#workspaceSub").textContent="Phụ lục I · II · III · Công văn 5512"; setHeader("Kế hoạch dạy học","Phụ lục I · II · III · Công văn 5512"); renderTabs();
    }
    renderFields(); window.scrollTo({top:0,behavior:"smooth"});
  }
  function renderTabs() {
    const tabs=$("#typeTabs"); tabs.classList.remove("hidden"); tabs.innerHTML="";
    [["pl1","Phụ lục I"],["pl2","Phụ lục II"],["pl3","Phụ lục III"]].forEach(([id,label])=>{
      const b=document.createElement("button"); b.type="button"; b.className=`tab ${state.planType===id?"active":""}`; b.textContent=label;
      b.onclick=()=>{ state.planType=id; renderTabs(); renderFields(); $("#resultCard").classList.add("hidden"); }; tabs.appendChild(b);
    });
  }
  function renderFields() {
    const host=$("#dynamicFields"); host.innerHTML=""; const schema=schemas[state.planType] || schemas.khbd;
    schema.forEach(([name,label,type,opts])=>{
      const wrap=document.createElement("label"); wrap.className=`field ${type==="textarea"?"full":""}`; const title=document.createElement("span"); title.textContent=label; wrap.appendChild(title);
      let el;
      if(type==="select") { el=document.createElement("select"); opts.forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;el.appendChild(op);}); }
      else if(type==="textarea") { el=document.createElement("textarea"); el.placeholder="Nhập thông tin nếu có…"; }
      else { el=document.createElement("input"); el.type=type; if(type==="number") el.min="0"; if(opts && typeof opts==="string") el.value=opts; }
      el.name=name; if(type!=="select" && opts && typeof opts==="string") el.value=opts; wrap.appendChild(el); host.appendChild(wrap);
    });
    if(state.planType==="pl2") renderActivityBuilder(host);
  }
  function renderActivityBuilder(host) {
    const box=document.createElement("div"); box.className="field full"; box.innerHTML='<span>Các hoạt động giáo dục dự kiến</span><div id="activityRows"></div><button id="addActivityBtn" type="button" class="btn secondary">+ Thêm hoạt động</button>'; host.appendChild(box);
    if(!state.pl2Activities.length) state.pl2Activities.push({});
    const rows=box.querySelector("#activityRows");
    const draw=()=>{ rows.innerHTML=""; state.pl2Activities.forEach((a,i)=>{ const d=document.createElement("div"); d.className="step-card"; d.style.margin="8px 0"; d.innerHTML=`<div class="form-grid two">
      <label class="field"><span>Chủ đề/hoạt động</span><input data-k="topic" data-i="${i}" value="${esc(a.topic||"")}"></label>
      <label class="field"><span>Số tiết</span><input data-k="periods" data-i="${i}" type="number" min="0" value="${esc(a.periods||"")}"></label>
      <label class="field full"><span>Yêu cầu cần đạt / mục tiêu dự kiến</span><textarea data-k="requirements" data-i="${i}">${esc(a.requirements||"")}</textarea></label>
      <label class="field"><span>Thời điểm</span><input data-k="time" data-i="${i}" value="${esc(a.time||"")}"></label>
      <label class="field"><span>Địa điểm</span><input data-k="location" data-i="${i}" value="${esc(a.location||"")}"></label>
      <label class="field"><span>Chủ trì</span><input data-k="lead" data-i="${i}" value="${esc(a.lead||"")}"></label>
      <label class="field"><span>Phối hợp</span><input data-k="coordination" data-i="${i}" value="${esc(a.coordination||"")}"></label>
      <label class="field full"><span>Điều kiện thực hiện</span><textarea data-k="conditions" data-i="${i}">${esc(a.conditions||"")}</textarea></label>
      <div class="field full"><button type="button" class="btn ghost remove-activity" data-i="${i}">Xóa hoạt động</button></div></div>`; rows.appendChild(d); });
      rows.querySelectorAll("input,textarea").forEach(el=>el.addEventListener("input",()=>{ state.pl2Activities[+el.dataset.i][el.dataset.k]=el.value; }));
      rows.querySelectorAll(".remove-activity").forEach(b=>b.onclick=()=>{ if(state.pl2Activities.length>1){state.pl2Activities.splice(+b.dataset.i,1);draw();} });
    };
    box.querySelector("#addActivityBtn").onclick=()=>{state.pl2Activities.push({});draw();}; draw();
  }
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function formValues(){ const obj={}; $("#dynamicFields").querySelectorAll("input[name],select[name],textarea[name]").forEach(el=>obj[el.name]=el.value.trim()); if(state.planType==="pl2") obj.activities=state.pl2Activities; return obj; }

  async function extractDocx(file){ if(!window.mammoth) throw new Error("Chưa tải được bộ đọc DOCX."); const arr=await file.arrayBuffer(); const result=await mammoth.convertToHtml({arrayBuffer:arr}); const div=document.createElement("div"); div.innerHTML=result.value; return div.innerText.slice(0,120000); }
  function currentFiles(){ const out=[]; fileInputs.forEach(id=>{ const el=$("#"+id); Array.from(el.files||[]).forEach(f=>out.push({role:id.replace("file","").toLowerCase(),file:f})); }); return out; }
  function renderFileList(){ const list=$("#fileList"); const fs=currentFiles(); list.innerHTML=fs.map(({role,file})=>`<div class="file-chip"><span><strong>${esc(role.toUpperCase())}</strong> · ${esc(file.name)}</span><em>${(file.size/1024/1024).toFixed(2)} MB</em></div>`).join(""); }

  async function uploadToGemini(item, apiKey){
    const key=`${item.role}:${item.file.name}:${item.file.size}:${item.file.lastModified}`; if(state.uploaded.has(key)) return state.uploaded.get(key);
    if(item.file.size>50*1024*1024) throw new Error(`${item.file.name}: vượt 50 MB. Hãy tách/giảm dung lượng PDF.`);
    if(item.file.name.toLowerCase().endsWith(".docx")) { const text=await extractDocx(item.file); const x={role:item.role,name:item.file.name,kind:"text",text}; state.uploaded.set(key,x); return x; }
    if(item.file.type==="text/plain" || item.file.name.toLowerCase().endsWith(".txt")){ const text=(await item.file.text()).slice(0,120000); const x={role:item.role,name:item.file.name,kind:"text",text};state.uploaded.set(key,x);return x; }
    const fd=new FormData(); fd.append("file",item.file); fd.append("apiKey",apiKey); fd.append("role",item.role);
    const x=await api("/v1/files/upload",{method:"POST",body:fd}); state.uploaded.set(key,x.file); return x.file;
  }
  async function generate(){
    const apiKey=$("#apiKey").value.trim(); if(!apiKey){setMessage($("#generateStatus"),"Hãy nhập Gemini API Key.","bad");return;}
    const fields=formValues(); if(!fields.grade && state.planType!=="pl2"){setMessage($("#generateStatus"),"Hãy điền thông tin kế hoạch.","bad");return;}
    const files=currentFiles();
    const hasSgk=files.some(x=>x.role==="sgk"), hasTemplate=files.some(x=>x.role==="template");
    if(["khbd","pl1"].includes(state.planType) && !hasSgk){setMessage($("#generateStatus"),"Hãy tải SGK làm nguồn chính trước khi tạo kế hoạch.","bad");return;}
    if(state.planType==="pl3" && !hasSgk && !hasTemplate){setMessage($("#generateStatus"),"Hãy tải SGK hoặc Phụ lục I/mẫu kế hoạch làm nguồn dữ liệu.","bad");return;}
    $("#generateBtn").disabled=true; setMessage($("#generateStatus"),"Đang chuẩn bị tài liệu…");
    try{
      const refs=[]; let n=0; for(const f of files){ n++; setMessage($("#generateStatus"),`Đang xử lý tài liệu ${n}/${files.length}: ${f.file.name}`); refs.push(await uploadToGemini(f,apiKey)); }
      setMessage($("#generateStatus"),"AI đang xây dựng kế hoạch…");
      const data=await api("/v1/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey,model:$("#model").value,planType:state.planType,fields,files:refs})});
      showResult(data.result); setMessage($("#generateStatus"),"Đã hoàn thành.","ok");
    }catch(e){setMessage($("#generateStatus"),e.message,"bad");}finally{$("#generateBtn").disabled=false;}
  }
  function sanitizeHtml(html){
    const t=document.createElement("template"); t.innerHTML=html||""; const allowed=new Set(["H1","H2","H3","H4","P","BR","STRONG","B","EM","I","UL","OL","LI","TABLE","THEAD","TBODY","TR","TH","TD","DIV","SPAN"]);
    Array.from(t.content.querySelectorAll("*")).forEach(el=>{ if(!allowed.has(el.tagName)){ el.replaceWith(...el.childNodes); return; } Array.from(el.attributes).forEach(a=>{if(!["colspan","rowspan"].includes(a.name.toLowerCase())) el.removeAttribute(a.name);}); }); return t.innerHTML;
  }
  function showResult(result){ $("#resultTitle").textContent=result.documentTitle||"Bản dự thảo"; $("#resultEditor").innerHTML=sanitizeHtml(result.html||""); const notes=(result.notes||[]).map(x=>`<div>• ${esc(x)}</div>`).join(""); $("#resultNotes").innerHTML=notes; $("#resultNotes").classList.toggle("hidden",!notes); $("#resultCard").classList.remove("hidden"); $("#resultCard").scrollIntoView({behavior:"smooth",block:"start"}); }

  async function testKey(){ const key=$("#apiKey").value.trim(); if(!key){setMessage($("#keyMessage"),"Hãy nhập API Key.","bad");return;} setMessage($("#keyMessage"),"Đang kiểm tra…"); try{await api("/v1/ai/test-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:key,model:$("#model").value})}); sessionStorage.setItem("soankhbd_gemini_key",key); setMessage($("#keyMessage"),"API Key hoạt động. Key chỉ được lưu trong phiên trình duyệt này.","ok"); $("#apiStatusPill").textContent="API sẵn sàng"; $("#apiStatusPill").classList.add("ok");}catch(e){setMessage($("#keyMessage"),e.message,"bad");} }

  async function logoutNow(){try{await api("/v1/auth/logout",{method:"POST"});}catch{} clearSession(); if(window.google?.accounts?.id) google.accounts.id.disableAutoSelect(); location.reload();}
  $("#sideLogoutBtn").onclick=logoutNow;
  $$('[data-open]').forEach(b=>b.onclick=()=>openMode(b.dataset.open));
  $$('[data-future]').forEach(b=>b.onclick=()=>openFuture(b.dataset.future));
  $$('[data-nav="home"], [data-nav-home]').forEach(b=>b.onclick=()=>goHome());
  $("#brandHome").onclick=(e)=>{e.preventDefault();goHome();};
  $("#backHome").onclick=()=>goHome();
  $("#mobileMenuBtn").onclick=()=>document.body.classList.toggle("sidebar-open");
  $("#sidebarOverlay").onclick=closeMobileSidebar;
  $("#sidebarCollapseBtn").onclick=()=>{ const v=!document.body.classList.contains("sidebar-collapsed"); document.body.classList.toggle("sidebar-collapsed",v); localStorage.setItem("soankhbd_sidebar_collapsed",v?"1":"0"); };
  fileInputs.forEach(id=>$("#"+id).addEventListener("change",renderFileList));
  $("#testKeyBtn").onclick=testKey; $("#generateBtn").onclick=generate;
  $("#copyBtn").onclick=async()=>{await navigator.clipboard.writeText($("#resultEditor").innerText); $("#copyBtn").textContent="Đã sao chép";setTimeout(()=>$("#copyBtn").textContent="Sao chép",1500);};
  $("#printBtn").onclick=()=>window.print();
  const savedKey=sessionStorage.getItem("soankhbd_gemini_key"); if(savedKey){ $("#apiKey").value=savedKey; $("#apiStatusPill").textContent="API đã nhập"; }

  (async()=>{ if(!cfg.API_BASE || cfg.API_BASE.includes("YOUR-WORKER")){ showLogin("Chưa cấu hình API_BASE trong assets/js/config.js.","bad"); return; } const ok=await restoreSession(); if(!ok){showLogin();await initGoogle();} })();
})();
