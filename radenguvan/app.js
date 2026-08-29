(function(){
  "use strict";

  const CFG=window.RADENGUVAN_CONFIG;
  const DATA=window.RADENGUVAN_DATA;
  const $=(id)=>document.getElementById(id);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const STORAGE_KEY="radenguvan_draft_v1";
  const STEP_ORDER=["setup","matrix","spec","exam","answer","export"];
  const STEP_HINTS={
    setup:"Cấu hình đề và thêm nguồn tham khảo.",matrix:"Kiểm soát số câu, mức độ và tổng điểm.",
    spec:"Duyệt yêu cầu cần đạt cho từng nhóm câu.",exam:"Tạo rồi biên tập đề kiểm tra.",
    answer:"Tạo đáp án, hướng dẫn chấm và rubric.",export:"Đối chiếu toàn bộ trước khi tải Word."
  };
  const state={sources:[],approved:{matrix:false,spec:false,exam:false,answer:false},review:""};
  let saveTimer=null;

  document.addEventListener("DOMContentLoaded",init);

  function init(){
    bindNavigation();
    bindSetup();
    bindMatrix();
    bindSpec();
    bindExam();
    bindAnswer();
    bindExport();
    bindReset();
    loadDraft();
    if(!$('matrixBody').children.length) resetMatrix();
    updateMatrixTotals();
    renderSources();
    updateRequestSummary();
    showStep(state.step||"setup",false);
  }

  function bindNavigation(){
    $$(".step-link").forEach(btn=>btn.addEventListener("click",()=>showStep(btn.dataset.step)));
    $$(".next-step").forEach(btn=>btn.addEventListener("click",()=>showStep(btn.dataset.next)));
    $$(".prev-step").forEach(btn=>btn.addEventListener("click",()=>showStep(btn.dataset.prev)));
    $("menuButton").addEventListener("click",()=>{
      const open=$("sidebar").classList.toggle("open");
      $("menuButton").setAttribute("aria-expanded",String(open));
    });
    document.addEventListener("click",(event)=>{
      if(innerWidth<=820 && $("sidebar").classList.contains("open") && !$("sidebar").contains(event.target) && event.target!==$("menuButton")){
        $("sidebar").classList.remove("open");
        $("menuButton").setAttribute("aria-expanded","false");
      }
    });
  }

  function showStep(step,scroll=true){
    if(!STEP_ORDER.includes(step)) step="setup";
    state.step=step;
    $$(".step-panel").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===step));
    $$(".step-link").forEach((btn,index)=>{
      btn.classList.toggle("active",btn.dataset.step===step);
      btn.classList.toggle("completed",isStepCompleted(btn.dataset.step));
      btn.setAttribute("aria-current",btn.dataset.step===step?"step":"false");
      if(btn.dataset.step===step){
        $("progressBar").style.width=((index+1)/STEP_ORDER.length*100)+"%";
        $("progressText").textContent=`Bước ${index+1}/${STEP_ORDER.length}`;
        $("progressHint").textContent=STEP_HINTS[step];
      }
    });
    if(step==="exam") updateRequestSummary();
    if(step==="export") runFinalCheck();
    $("sidebar").classList.remove("open");
    $("menuButton").setAttribute("aria-expanded","false");
    scheduleSave();
    if(scroll) window.scrollTo({top:0,behavior:"smooth"});
  }

  function isStepCompleted(step){
    if(step==="setup") return Boolean($("grade").value&&$("examType").value&&Number($("totalScore").value)>0);
    return Boolean(state.approved[step]);
  }

  function bindSetup(){
    $("provider").addEventListener("change",()=>{$("model").value=DATA.providers[$("provider").value]||"";$("apiStatus").className="status-chip neutral";$("apiStatus").textContent="Chưa kiểm tra API";scheduleSave();});
    $("toggleKey").addEventListener("click",()=>{
      const input=$("apiKey"); input.type=input.type==="password"?"text":"password"; $("toggleKey").textContent=input.type==="password"?"Hiện":"Ẩn";
    });
    $("testApi").addEventListener("click",testApi);
    ["schoolName","grade","schoolYear","examType","duration","totalScore","examMode","scope","extraRequirements","provider","model","readingText","writingText"].forEach(id=>{
      $(id).addEventListener("input",()=>{if(id==="totalScore") updateMatrixTotals();scheduleSave();updateRequestSummary();});
    });
    $("examMode").addEventListener("change",()=>{state.approved.matrix=false;resetMatrix();});
    const drop=$("dropZone");
    $("sourceFiles").addEventListener("change",event=>handleFiles(event.target.files));
    ["dragenter","dragover"].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add("dragover");}));
    ["dragleave","drop"].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove("dragover");}));
    drop.addEventListener("drop",event=>handleFiles(event.dataTransfer.files));
    $("clearSources").addEventListener("click",()=>{state.sources=[];renderSources();updateRequestSummary();toast("Đã xóa danh sách nguồn.");});
  }

  async function handleFiles(fileList){
    const files=Array.from(fileList||[]);
    if(!files.length) return;
    const remaining=Math.max(0,CFG.MAX_FILES-state.sources.length);
    if(files.length>remaining) toast(`Chỉ có thể thêm ${remaining} tệp nữa.`,"error");
    showLoading("Đang đọc tài liệu","Nội dung được xử lí tại thiết bị của bạn.");
    try{
      for(const file of files.slice(0,remaining)){
        if(file.size>CFG.MAX_FILE_SIZE_MB*1024*1024){toast(`${file.name}: vượt ${CFG.MAX_FILE_SIZE_MB} MB.`,"error");continue;}
        if(state.sources.some(s=>s.name===file.name&&s.size===file.size)){toast(`${file.name}: đã có trong danh sách.`);continue;}
        try{
          const text=await extractFileText(file);
          if(!text.trim()) throw new Error("Không trích xuất được văn bản");
          state.sources.push({id:crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random(),name:file.name,size:file.size,type:file.name.split(".").pop().toLowerCase(),text:cleanText(text).slice(0,CFG.MAX_SOURCE_CHARS)});
        }catch(error){toast(`${file.name}: ${error.message}`,"error");}
      }
    }finally{
      hideLoading();
      $("sourceFiles").value="";
      renderSources(); updateRequestSummary();
    }
  }

  async function extractFileText(file){
    const ext=file.name.split(".").pop().toLowerCase();
    if(ext==="txt"||ext==="md") return file.text();
    if(ext==="docx"){
      if(!window.JSZip) throw new Error("Thiếu thư viện đọc DOCX");
      const zip=await JSZip.loadAsync(await file.arrayBuffer());
      const entry=zip.file("word/document.xml");
      if(!entry) throw new Error("Tệp DOCX không hợp lệ");
      const xml=await entry.async("string");
      return decodeXml(xml.replace(/<w:tab\/?[^>]*>/g,"\t").replace(/<\/w:p>/g,"\n").replace(/<\/w:tr>/g,"\n").replace(/<[^>]+>/g,""));
    }
    if(ext==="pdf"){
      const pdfjs=await import("./vendor/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc="./vendor/pdf.worker.min.mjs";
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      let result="";
      for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
        const page=await pdf.getPage(pageNo); const content=await page.getTextContent();
        result+=`\n--- Trang ${pageNo} ---\n`+content.items.map(item=>item.str).join(" ");
      }
      return result;
    }
    throw new Error("Định dạng chưa được hỗ trợ; hãy dùng PDF, DOCX hoặc TXT");
  }

  function decodeXml(text){const box=document.createElement("textarea");box.innerHTML=text;return box.value;}
  function cleanText(text){return String(text||"").replace(/\u0000/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").trim();}
  function renderSources(){
    const root=$("sourceList");
    if(!state.sources.length){root.innerHTML='<div class="empty-state">Chưa có tài liệu nào.</div>';return;}
    root.innerHTML="";
    state.sources.forEach(source=>{
      const item=document.createElement("div"); item.className="source-item";
      item.innerHTML=`<span class="source-type">${escapeHtml(source.type.toUpperCase())}</span><div><strong title="${escapeHtml(source.name)}">${escapeHtml(source.name)}</strong><small>${formatBytes(source.size)} · ${source.text.length.toLocaleString("vi-VN")} kí tự đã đọc</small></div><button type="button" aria-label="Xóa ${escapeHtml(source.name)}">×</button>`;
      item.querySelector("button").addEventListener("click",()=>{state.sources=state.sources.filter(s=>s.id!==source.id);renderSources();updateRequestSummary();});
      root.appendChild(item);
    });
  }

  async function testApi(){
    if(!$("apiKey").value.trim()) return toast("Hãy nhập API key cá nhân.","error");
    showLoading("Đang kiểm tra kết nối","Không lưu API key của bạn.");
    try{
      await apiFetch("/api/test",{message:"ping"});
      setChip("apiStatus","Kết nối thành công","ok"); toast("API hoạt động bình thường.","success");
    }catch(error){setChip("apiStatus","Kết nối thất bại","bad");toast(error.message,"error");}
    finally{hideLoading();}
  }

  function bindMatrix(){
    $("resetMatrix").addEventListener("click",resetMatrix);
    $("addMatrixRow").addEventListener("click",()=>addMatrixRow({section:"doc_hieu",unit:"",qtype:"tu_luan",level:"nhan_biet",count:1,point:0.5}));
    $("approveMatrix").addEventListener("click",()=>{
      const result=validateMatrix();
      if(!result.ok) return toast(result.messages[0],"error");
      state.approved.matrix=true; buildSpecFromMatrix(); setChip("specStatus","Chờ giáo viên duyệt","neutral"); scheduleSave(); showStep("spec");
    });
  }

  function resetMatrix(){
    $("matrixBody").innerHTML="";
    const rows=DATA.defaults[$("examMode").value]||DATA.defaults.mixed;
    const target=Number($("totalScore").value)||10;
    const defaultSum=rows.reduce((sum,row)=>sum+row.count*row.point,0);
    rows.forEach(row=>addMatrixRow({...row,point:round(row.point*target/defaultSum)}));
    state.approved.matrix=false; state.approved.spec=false; updateMatrixTotals();
  }

  function addMatrixRow(row){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><select class="m-section">${options(DATA.labels.sections,row.section)}</select></td><td><input class="m-unit" value="${escapeHtml(row.unit||"")}" placeholder="Nội dung"></td><td><select class="m-qtype">${options(DATA.labels.questionTypes,row.qtype)}</select></td><td><select class="m-level">${options(DATA.labels.levels,row.level)}</select></td><td><input class="m-count" type="number" min="1" max="30" step="1" value="${Number(row.count)||1}"></td><td><input class="m-point" type="number" min="0.25" max="10" step="0.25" value="${Number(row.point)||0.5}"></td><td><span class="row-total">0</span></td><td><button class="delete-row" type="button" aria-label="Xóa dòng">×</button></td>`;
    tr.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",()=>{state.approved.matrix=false;state.approved.spec=false;updateMatrixTotals();scheduleSave();}));
    tr.querySelector(".delete-row").addEventListener("click",()=>{tr.remove();state.approved.matrix=false;updateMatrixTotals();scheduleSave();});
    $("matrixBody").appendChild(tr); updateMatrixTotals();
  }

  function getMatrix(){return $$("#matrixBody tr").map(tr=>({section:tr.querySelector(".m-section").value,unit:tr.querySelector(".m-unit").value.trim(),qtype:tr.querySelector(".m-qtype").value,level:tr.querySelector(".m-level").value,count:Number(tr.querySelector(".m-count").value),point:Number(tr.querySelector(".m-point").value)}));}
  function updateMatrixTotals(){
    let total=0;
    $$("#matrixBody tr").forEach(tr=>{const value=(Number(tr.querySelector(".m-count").value)||0)*(Number(tr.querySelector(".m-point").value)||0);tr.querySelector(".row-total").textContent=formatScore(value);total+=value;});
    $("matrixTotal").textContent=formatScore(total); $("matrixTarget").textContent=formatScore(Number($("totalScore").value)||0);
    const result=validateMatrix(); const box=$("matrixValidation"); box.className="validation-box "+(result.ok?"ok":total>(Number($("totalScore").value)||0)?"bad":"warning"); box.innerHTML=result.messages.map(message=>`<div>${result.ok?"✓":"•"} ${escapeHtml(message)}</div>`).join("");
  }

  function validateMatrix(){
    const rows=getMatrix(),target=Number($("totalScore").value)||0,total=rows.reduce((s,r)=>s+r.count*r.point,0),messages=[];
    if(!rows.length) messages.push("Ma trận chưa có dòng dữ liệu.");
    if(rows.some(r=>!r.unit||!Number.isInteger(r.count)||r.count<1||r.point<=0)) messages.push("Mỗi dòng phải có nội dung, số câu nguyên dương và điểm lớn hơn 0.");
    if(!rows.some(r=>r.section==="doc_hieu")) messages.push("Thiếu phần Đọc hiểu.");
    if(!rows.some(r=>r.section==="viet")) messages.push("Thiếu phần Viết.");
    if(Math.abs(total-target)>0.001) messages.push(`Tổng điểm ma trận là ${formatScore(total)}, chưa bằng ${formatScore(target)}.`);
    if(!messages.length) messages.push(`Ma trận hợp lệ: ${rows.reduce((s,r)=>s+r.count,0)} câu/ý, tổng ${formatScore(total)} điểm.`);
    return {ok:messages.length===1&&messages[0].startsWith("Ma trận hợp lệ"),messages,total};
  }

  function bindSpec(){
    $("addSpecRow").addEventListener("click",()=>addSpecRow({section:"doc_hieu",unit:"",level:"nhan_biet",descriptor:"",count:1,score:0.5}));
    $("approveSpec").addEventListener("click",()=>{
      const result=validateSpec(); if(!result.ok) return toast(result.message,"error");
      state.approved.spec=true;setChip("specStatus","Đã duyệt","ok");updateRequestSummary();scheduleSave();showStep("exam");
    });
  }

  function buildSpecFromMatrix(){
    $("specBody").innerHTML=""; const counters={};
    getMatrix().forEach(row=>{
      const pool=row.section==="viet"?DATA.descriptors.writing[row.level]:DATA.descriptors.reading[row.level];
      const key=row.section+row.level; counters[key]=(counters[key]||0); const descriptor=pool&&pool.length?pool[counters[key]++%pool.length]:"Giáo viên bổ sung yêu cầu cần đạt theo nguồn chính thức.";
      addSpecRow({section:row.section,unit:row.unit,level:row.level,descriptor,count:row.count,score:round(row.count*row.point)});
    });
  }

  function addSpecRow(row){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><select class="s-section">${options(DATA.labels.sections,row.section)}</select></td><td><input class="s-unit" value="${escapeHtml(row.unit||"")}"></td><td><select class="s-level">${options(DATA.labels.levels,row.level)}</select></td><td><textarea class="s-descriptor" rows="3">${escapeHtml(row.descriptor||"")}</textarea></td><td><input class="s-count" type="number" min="1" step="1" value="${Number(row.count)||1}"></td><td><input class="s-score" type="number" min="0.25" step="0.25" value="${Number(row.score)||0.5}"></td><td><button class="delete-row" type="button" aria-label="Xóa dòng">×</button></td>`;
    tr.querySelectorAll("input,select,textarea").forEach(el=>el.addEventListener("input",()=>{state.approved.spec=false;setChip("specStatus","Đã chỉnh sửa – cần duyệt lại","neutral");scheduleSave();}));
    tr.querySelector(".delete-row").addEventListener("click",()=>{tr.remove();state.approved.spec=false;scheduleSave();});
    $("specBody").appendChild(tr);
  }

  function getSpec(){return $$("#specBody tr").map(tr=>({section:tr.querySelector(".s-section").value,unit:tr.querySelector(".s-unit").value.trim(),level:tr.querySelector(".s-level").value,descriptor:tr.querySelector(".s-descriptor").value.trim(),count:Number(tr.querySelector(".s-count").value),score:Number(tr.querySelector(".s-score").value)}));}
  function validateSpec(){
    const rows=getSpec(); if(!rows.length) return {ok:false,message:"Bản đặc tả chưa có dữ liệu."};
    if(rows.some(r=>!r.unit||!r.descriptor||!Number.isInteger(r.count)||r.count<1||r.score<=0)) return {ok:false,message:"Bản đặc tả còn dòng thiếu nội dung, yêu cầu cần đạt, số câu hoặc điểm."};
    const matrixTotal=validateMatrix().total,specTotal=rows.reduce((s,r)=>s+r.score,0);
    if(Math.abs(matrixTotal-specTotal)>0.001) return {ok:false,message:`Tổng điểm đặc tả (${formatScore(specTotal)}) không khớp ma trận (${formatScore(matrixTotal)}).`};
    return {ok:true,message:"Bản đặc tả hợp lệ."};
  }

  function bindExam(){
    $("generateExam").addEventListener("click",generateExam);
    $("copyExam").addEventListener("click",()=>copyElementText($("examEditor")));
    $("examEditor").addEventListener("input",()=>{state.approved.exam=false;setChip("examStatus","Đã chỉnh sửa – cần duyệt lại","neutral");scheduleSave();});
    $("approveExam").addEventListener("click",()=>{
      if(!hasEditorContent($("examEditor"))) return toast("Chưa có nội dung đề kiểm tra.","error");
      state.approved.exam=true;setChip("examStatus","Đã duyệt","ok");scheduleSave();showStep("answer");
    });
  }

  async function generateExam(){
    if(!state.approved.matrix||!state.approved.spec) return toast("Hãy duyệt ma trận và bản đặc tả trước.","error");
    if(!$("apiKey").value.trim()) return toast("Hãy nhập API key cá nhân.","error");
    const payload=buildPayload();
    if(!payload.readingText&&!payload.sources.length) return toast("Cần có ngữ liệu đọc hiểu hoặc ít nhất một nguồn tài liệu.","error");
    showLoading("AI đang tạo đề","Thời gian xử lí có thể kéo dài đến 2 phút.");
    try{
      const response=await apiFetch("/api/generate/questions",payload);
      $("examEditor").innerHTML=renderExam(response.result||response); state.approved.exam=false; setChip("examStatus","Đã tạo – chờ duyệt","neutral"); scheduleSave(); toast("Đã tạo đề. Hãy đọc và chỉnh sửa trước khi duyệt.","success");
    }catch(error){toast(error.message,"error");}
    finally{hideLoading();}
  }

  function renderExam(data){
    if(typeof data==="string") return `<div>${escapeHtml(data).replace(/\n/g,"<br>")}</div>`;
    const title=escapeHtml(data.title||`ĐỀ KIỂM TRA ${$("examType").value.toUpperCase()}`);
    let html=`<h2>${escapeHtml($("schoolName").value||"TRƯỜNG THCS …")}</h2><h1>${title}</h1><p style="text-align:center"><b>Môn: Ngữ văn ${escapeHtml($("grade").value)} · Năm học ${escapeHtml($("schoolYear").value)}</b><br>Thời gian: ${escapeHtml($("duration").value)} phút (không kể thời gian giao đề)</p>`;
    if(data.instructions) html+=`<p><i>${escapeHtml(data.instructions)}</i></p>`;
    (data.sections||[]).forEach((section,index)=>{
      html+=`<h3>${roman(index+1)}. ${escapeHtml(section.title||DATA.labels.sections[index===0?"doc_hieu":"viet"])}</h3>`;
      if(section.source) html+=`<div class="exam-source">${escapeHtml(section.source).replace(/\n/g,"<br>")}</div>`;
      (section.questions||[]).forEach((q,qIndex)=>{
        html+=`<p><b>Câu ${escapeHtml(String(q.number||qIndex+1))}.</b> ${escapeHtml(q.prompt||"")} <b>(${formatScore(Number(q.score)||0)} điểm)</b></p>`;
        if(Array.isArray(q.options)) html+=`<ol type="A">${q.options.map(option=>`<li>${escapeHtml(option)}</li>`).join("")}</ol>`;
      });
    });
    return html;
  }

  function bindAnswer(){
    $("generateAnswer").addEventListener("click",generateAnswer);
    $("copyAnswer").addEventListener("click",()=>copyElementText($("answerEditor")));
    $("answerEditor").addEventListener("input",()=>{state.approved.answer=false;setChip("answerStatus","Đã chỉnh sửa – cần duyệt lại","neutral");scheduleSave();});
    $("approveAnswer").addEventListener("click",()=>{
      if(!hasEditorContent($("answerEditor"))) return toast("Chưa có hướng dẫn chấm.","error");
      state.approved.answer=true;setChip("answerStatus","Đã duyệt","ok");scheduleSave();showStep("export");
    });
  }

  async function generateAnswer(){
    if(!state.approved.exam) return toast("Hãy duyệt đề kiểm tra trước.","error");
    if(!$("apiKey").value.trim()) return toast("Hãy nhập API key cá nhân.","error");
    showLoading("AI đang tạo hướng dẫn chấm","Đang đối chiếu từng câu với số điểm trong ma trận.");
    try{
      const payload={...buildPayload(),examText:$("examEditor").innerText.trim()};
      const response=await apiFetch("/api/generate/answer-key",payload);
      $("answerEditor").innerHTML=renderAnswer(response.result||response);state.approved.answer=false;setChip("answerStatus","Đã tạo – chờ duyệt","neutral");scheduleSave();toast("Đã tạo hướng dẫn chấm. Hãy thẩm định trước khi duyệt.","success");
    }catch(error){toast(error.message,"error");}
    finally{hideLoading();}
  }

  function renderAnswer(data){
    if(typeof data==="string") return `<div>${escapeHtml(data).replace(/\n/g,"<br>")}</div>`;
    let html=`<h1>${escapeHtml(data.title||"HƯỚNG DẪN CHẤM VÀ ĐÁP ÁN")}</h1>`;
    (data.items||[]).forEach((item,index)=>{
      html+=`<h3>Câu ${escapeHtml(String(item.number||index+1))} (${formatScore(Number(item.score)||0)} điểm)</h3><p>${escapeHtml(item.answer||item.guidance||"").replace(/\n/g,"<br>")}</p>`;
      if(Array.isArray(item.criteria)&&item.criteria.length){html+="<ul>"+item.criteria.map(c=>`<li>${escapeHtml(c.description||c.label||"")} <b>(${formatScore(Number(c.score)||0)} điểm)</b></li>`).join("")+"</ul>";}
    });
    if(Array.isArray(data.writingRubric)&&data.writingRubric.length){html+="<h2>Rubric phần viết</h2><table><thead><tr><th>Tiêu chí</th><th>Yêu cầu</th><th>Điểm</th></tr></thead><tbody>"+data.writingRubric.map(row=>`<tr><td>${escapeHtml(row.criterion||"")}</td><td>${escapeHtml(row.description||"")}</td><td>${formatScore(Number(row.score)||0)}</td></tr>`).join("")+"</tbody></table>";}
    if(data.notes) html+=`<p><i>${escapeHtml(data.notes)}</i></p>`;
    return html;
  }

  function bindExport(){
    $("runFinalCheck").addEventListener("click",runFinalCheck);
    $("exportDocx").addEventListener("click",exportDocx);
    $("exportJson").addEventListener("click",exportJson);
    $("importJson").addEventListener("change",importJson);
    $("aiReview").addEventListener("click",aiReview);
  }

  function runFinalCheck(){
    const checks=[];
    checks.push(check("Thông tin kì kiểm tra",Boolean($("grade").value&&$("examType").value&&Number($("duration").value)>0&&Number($("totalScore").value)>0),"Đã có lớp, kì kiểm tra, thời gian và tổng điểm.","Thiếu một hoặc nhiều thông tin bắt buộc."));
    const matrix=validateMatrix(); checks.push(check("Ma trận",matrix.ok,matrix.messages.join(" "),matrix.messages.join(" ")));
    const spec=validateSpec(); checks.push(check("Bản đặc tả",spec.ok,spec.message,spec.message));
    checks.push(check("Đề kiểm tra",state.approved.exam&&hasEditorContent($("examEditor")),"Đề đã được giáo viên duyệt.","Đề chưa có hoặc chưa được duyệt sau lần chỉnh sửa cuối."));
    checks.push(check("Hướng dẫn chấm",state.approved.answer&&hasEditorContent($("answerEditor")),"Hướng dẫn chấm đã được giáo viên duyệt.","Hướng dẫn chấm chưa có hoặc chưa được duyệt sau lần chỉnh sửa cuối."));
    const sourceOk=Boolean($("readingText").value.trim()||state.sources.length); checks.push(check("Căn cứ nguồn",sourceOk,"Có ngữ liệu hoặc tài liệu làm căn cứ.","Chưa có ngữ liệu đọc hiểu hay tài liệu nguồn."));
    $("checkList").innerHTML=checks.map(item=>`<div class="check-item ${item.ok?"ok":"bad"}"><span class="check-icon">${item.ok?"✓":"!"}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span></div></div>`).join("");
    const passed=checks.every(item=>item.ok); $("exportDocx").disabled=!passed;setChip("finalStatus",passed?"Đủ điều kiện xuất":"Cần hoàn thiện",passed?"ok":"bad");return passed;
  }

  function check(title,ok,success,failure){return {title,ok,message:ok?success:failure};}

  async function aiReview(){
    if(!runFinalCheck()) return toast("Hãy xử lí các mục chưa đạt trước khi rà soát AI.","error");
    if(!$("apiKey").value.trim()) return toast("Hãy nhập API key cá nhân.","error");
    showLoading("AI đang rà soát","Đối chiếu ma trận, đặc tả, đề và hướng dẫn chấm.");
    try{
      const response=await apiFetch("/api/review",{...buildPayload(),examText:$("examEditor").innerText.trim(),answerText:$("answerEditor").innerText.trim()});
      state.review=response.result||response.review||String(response);$("reviewOutput").textContent=state.review;scheduleSave();toast("Đã hoàn thành rà soát.","success");
    }catch(error){toast(error.message,"error");}
    finally{hideLoading();}
  }

  function buildPayload(){
    const sources=[];let used=0;
    for(const source of state.sources){
      const remaining=CFG.MAX_SOURCE_CHARS-used;if(remaining<=0) break;
      const excerpt=source.text.slice(0,remaining);sources.push({name:source.name,text:excerpt});used+=excerpt.length;
    }
    return {
      appVersion:CFG.APP_VERSION,
      config:{schoolName:$("schoolName").value.trim(),grade:$("grade").value,schoolYear:$("schoolYear").value.trim(),examType:$("examType").value,duration:Number($("duration").value),totalScore:Number($("totalScore").value),examMode:$("examMode").value,scope:$("scope").value.trim(),extraRequirements:$("extraRequirements").value.trim()},
      matrix:getMatrix(),spec:getSpec(),readingText:$("readingText").value.trim(),writingText:$("writingText").value.trim(),sources
    };
  }

  function updateRequestSummary(){
    if(!$("requestSummary")) return;
    const config=`Lớp ${$("grade").value} · ${$("examType").value} · ${$("duration").value} phút · ${$("totalScore").value} điểm`;
    $("requestSummary").innerHTML=`<div class="summary-block"><strong>Kì kiểm tra</strong><span>${escapeHtml(config)}</span></div><div class="summary-block"><strong>Ma trận</strong><span>${getMatrix().length} nhóm câu · ${formatScore(validateMatrix().total)} điểm</span></div><div class="summary-block"><strong>Bản đặc tả</strong><span>${getSpec().length} yêu cầu đã lập</span></div><div class="summary-block"><strong>Nguồn</strong><span>${state.sources.length} tệp · ${$("readingText").value.trim()?"có":"chưa có"} ngữ liệu dán trực tiếp</span></div><div class="summary-block"><strong>Dữ liệu không gửi</strong><span>API key, bản nháp cục bộ và tệp gốc.</span></div>`;
  }

  async function apiFetch(path,payload){
    const apiBase=String(CFG.API_BASE||"").replace(/\/$/,"");
    if(!apiBase||apiBase.includes("YOUR-SUBDOMAIN")) throw new Error("Chưa cấu hình API_BASE trong config.js.");
    const key=$("apiKey").value.trim(); if(!key) throw new Error("Chưa nhập API key cá nhân.");
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),CFG.REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(apiBase+path,{method:"POST",headers:{"Content-Type":"application/json","X-User-API-Key":key,"X-AI-Provider":$("provider").value,"X-AI-Model":$("model").value.trim()},body:JSON.stringify(payload||{}),signal:controller.signal,credentials:"omit",referrerPolicy:"strict-origin-when-cross-origin"});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||data.message||`Máy chủ trả lỗi ${response.status}.`);
      return data;
    }catch(error){if(error.name==="AbortError") throw new Error("Hết thời gian chờ 2 phút. Hãy kiểm tra mạng, model hoặc hạn mức API rồi thử lại.");throw error;}
    finally{clearTimeout(timer);}
  }

  async function exportDocx(){
    if(!runFinalCheck()) return;
    if(!window.JSZip) return toast("Thiếu thư viện tạo Word.","error");
    showLoading("Đang tạo tệp Word","Định dạng A4, Times New Roman, lề 2 cm.");
    try{
      const zip=new JSZip();
      zip.file("[Content_Types].xml",contentTypesXml());
      zip.folder("_rels").file(".rels",relsXml());
      const word=zip.folder("word");word.file("document.xml",documentXml());word.file("styles.xml",stylesXml());word.folder("_rels").file("document.xml.rels",documentRelsXml());
      zip.folder("docProps").file("core.xml",coreXml()).file("app.xml",appXml());
      const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",compression:"DEFLATE"});
      downloadBlob(blob,`${safeFileName($("schoolName").value||"THCS")}_De_Ngu_van_${$("grade").value}_${safeFileName($("examType").value)}.docx`);toast("Đã tạo bộ hồ sơ Word.","success");
    }catch(error){toast("Không thể tạo Word: "+error.message,"error");}
    finally{hideLoading();}
  }

  function documentXml(){
    const parts=[];
    parts.push(wPara($("schoolName").value||"TRƯỜNG THCS …",true,"center",26));
    parts.push(wPara(`BỘ HỒ SƠ KIỂM TRA ${$("examType").value.toUpperCase()}`,true,"center",28));
    parts.push(wPara(`MÔN NGỮ VĂN ${$("grade").value} · NĂM HỌC ${$("schoolYear").value}`,true,"center",26));
    parts.push(wPara(`Thời gian: ${$("duration").value} phút · Tổng điểm: ${formatScore(Number($("totalScore").value))}`,false,"center",26));
    parts.push(wPara("I. MA TRẬN ĐỀ KIỂM TRA",true,"left",26));
    parts.push(wTable(["Phần","Nội dung","Dạng câu","Mức độ","Số câu","Điểm/câu","Thành tiền"],getMatrix().map(r=>[DATA.labels.sections[r.section],r.unit,DATA.labels.questionTypes[r.qtype],DATA.labels.levels[r.level],String(r.count),formatScore(r.point),formatScore(r.count*r.point)])));
    parts.push(pageBreak(),wPara("II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA",true,"left",26));
    parts.push(wTable(["Phần","Nội dung","Mức độ","Yêu cầu cần đạt","Số câu","Điểm"],getSpec().map(r=>[DATA.labels.sections[r.section],r.unit,DATA.labels.levels[r.level],r.descriptor,String(r.count),formatScore(r.score)])));
    parts.push(pageBreak(),wPara("III. ĐỀ KIỂM TRA",true,"left",26));
    parts.push(...editorToParagraphs($("examEditor")));
    parts.push(pageBreak(),wPara("IV. HƯỚNG DẪN CHẤM, ĐÁP ÁN VÀ BIỂU ĐIỂM",true,"left",26));
    parts.push(...editorToParagraphs($("answerEditor")));
    if(state.review){parts.push(pageBreak(),wPara("PHỤ LỤC: KẾT QUẢ RÀ SOÁT AI",true,"left",26),...plainTextParagraphs(state.review));}
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }

  function editorToParagraphs(root){
    const clone=root.cloneNode(true);clone.querySelectorAll("br").forEach(br=>br.replaceWith("\n"));
    clone.querySelectorAll("tr").forEach(tr=>{const cells=$$("th,td",tr).map(cell=>cell.innerText.trim());tr.replaceWith(document.createTextNode(cells.join(" | ")+"\n"));});
    clone.querySelectorAll("li").forEach((li,index)=>li.prepend(`${index+1}. `));
    return plainTextParagraphs(clone.innerText);
  }
  function plainTextParagraphs(text){return cleanText(text).split(/\n+/).filter(Boolean).map(line=>wPara(line,false,"both",26));}
  function wPara(text,bold=false,align="both",size=26){return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${bold?"<w:b/>":""}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;}
  function wTable(headers,rows){const cell=(text,bold=false)=>`<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${wPara(text,bold,"left",24)}</w:tc>`;const tr=(items,bold=false)=>`<w:tr>${items.map(item=>cell(String(item??""),bold)).join("")}</w:tr>`;return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/><w:insideH w:val="single" w:sz="6" w:color="000000"/><w:insideV w:val="single" w:sz="6" w:color="000000"/></w:tblBorders></w:tblPr>${tr(headers,true)}${rows.map(row=>tr(row)).join("")}</w:tbl>`;}
  function pageBreak(){return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';}
  function contentTypesXml(){return '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';}
  function relsXml(){return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';}
  function documentRelsXml(){return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';}
  function stylesXml(){return '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';}
  function coreXml(){const now=new Date().toISOString();return `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Bộ hồ sơ đề kiểm tra Ngữ văn THCS</dc:title><dc:creator>Học liệu số</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;}
  function appXml(){return '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Radenguvan</Application><AppVersion>1.0</AppVersion></Properties>';}

  function exportJson(){const blob=new Blob([JSON.stringify(collectDraft(true),null,2)],{type:"application/json;charset=utf-8"});downloadBlob(blob,`radenguvan-lop-${$("grade").value}-${Date.now()}.json`);}
  async function importJson(event){
    const file=event.target.files[0];if(!file)return;
    try{const data=JSON.parse(await file.text());applyDraft(data);toast("Đã mở bản sao dữ liệu.","success");}catch(error){toast("Tệp JSON không hợp lệ.","error");}finally{event.target.value="";}
  }

  function bindReset(){
    $("resetAll").addEventListener("click",()=>{$("confirmModal").hidden=false;});
    $("cancelReset").addEventListener("click",()=>{$("confirmModal").hidden=true;});
    $("confirmReset").addEventListener("click",()=>{localStorage.removeItem(STORAGE_KEY);location.reload();});
    $("confirmModal").addEventListener("click",event=>{if(event.target===$("confirmModal"))$("confirmModal").hidden=true;});
  }

  function collectDraft(includeSources=false){return {
    version:1,step:state.step,approved:state.approved,review:state.review,
    fields:Object.fromEntries(["schoolName","grade","schoolYear","examType","duration","totalScore","examMode","scope","extraRequirements","provider","model","readingText","writingText"].map(id=>[id,$(id).value])),
    matrix:getMatrix(),spec:getSpec(),examHtml:hasEditorContent($("examEditor"))?$("examEditor").innerHTML:"",answerHtml:hasEditorContent($("answerEditor"))?$("answerEditor").innerHTML:"",sources:includeSources?state.sources:[]
  };}
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(collectDraft(false)));$("saveState").textContent="Đã lưu bản nháp trên máy";}catch(_){$("saveState").textContent="Không thể lưu thêm bản nháp";}},350);}
  function loadDraft(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)applyDraft(JSON.parse(raw));}catch(_){localStorage.removeItem(STORAGE_KEY);}}
  function applyDraft(data){
    if(!data||typeof data!=="object")throw new Error("Invalid draft");
    Object.entries(data.fields||{}).forEach(([id,value])=>{if($(id)&&id!=="apiKey")$(id).value=value;});
    state.step=data.step||"setup";state.approved={matrix:false,spec:false,exam:false,answer:false,...data.approved};state.review=data.review||"";state.sources=Array.isArray(data.sources)?data.sources:[];
    $("matrixBody").innerHTML="";(data.matrix||[]).forEach(addMatrixRow);
    $("specBody").innerHTML="";(data.spec||[]).forEach(addSpecRow);
    if(data.examHtml)$("examEditor").innerHTML=data.examHtml;if(data.answerHtml)$("answerEditor").innerHTML=data.answerHtml;if(state.review)$("reviewOutput").textContent=state.review;
    if(state.approved.spec)setChip("specStatus","Đã duyệt","ok");if(state.approved.exam)setChip("examStatus","Đã duyệt","ok");if(state.approved.answer)setChip("answerStatus","Đã duyệt","ok");
    renderSources();updateMatrixTotals();updateRequestSummary();showStep(state.step,false);
  }

  function options(map,selected){return Object.entries(map).map(([value,label])=>`<option value="${value}" ${value===selected?"selected":""}>${escapeHtml(label)}</option>`).join("");}
  function setChip(id,text,type){$(id).textContent=text;$(id).className=`status-chip ${type}`;}
  function hasEditorContent(element){return element&&element.innerText.trim()&&!element.querySelector(".empty-state");}
  async function copyElementText(element){try{await navigator.clipboard.writeText(element.innerText.trim());toast("Đã sao chép.","success");}catch(_){toast("Trình duyệt không cho phép sao chép tự động.","error");}}
  function showLoading(title,text){$("loadingTitle").textContent=title;$("loadingText").textContent=text;$("loadingOverlay").hidden=false;}
  function hideLoading(){$("loadingOverlay").hidden=true;}
  function toast(message,type=""){const item=document.createElement("div");item.className=`toast ${type}`;item.textContent=message;$("toastRegion").appendChild(item);setTimeout(()=>item.remove(),4500);}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function safeFileName(value){return String(value||"tai-lieu").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_|_$/g,"");}
  function formatBytes(bytes){if(bytes<1024)return bytes+" B";if(bytes<1048576)return (bytes/1024).toFixed(1)+" KB";return (bytes/1048576).toFixed(1)+" MB";}
  function formatScore(value){return Number.isInteger(value)?String(value):String(Math.round(value*100)/100).replace(".",",");}
  function round(value){return Math.round(value*100)/100;}
  function roman(number){return ["I","II","III","IV","V","VI"][number-1]||String(number);}
  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
  function escapeXml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]));}
})();
