(function(){
  "use strict";

  const CFG=window.RADENGUVAN_CONFIG;
  const DATA=window.RADENGUVAN_DATA;
  const $=(id)=>document.getElementById(id);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const STORAGE_KEY="radenguvan_draft_v2";
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
    $("presetGrade6").addEventListener("click",()=>applyOfficialPreset("6"));
    $("presetGrade8").addEventListener("click",()=>applyOfficialPreset("8"));
    ["useMcq","useEssay"].forEach(id=>$(id).addEventListener("change",()=>{
      if(!$("useMcq").checked&&!$("useEssay").checked){$(id).checked=true;return toast("Ma trận phải dùng ít nhất một dạng câu.","error");}
      const rows=getMatrix(true);renderMatrixHeader();renderMatrixRows(rows);state.approved.matrix=false;state.approved.spec=false;updateMatrixTotals();scheduleSave();
    }));
    $("addMatrixRow").addEventListener("click",()=>addMatrixRow({section:"doc_hieu",competency:"Đọc hiểu",unit:"",cells:emptyMatrixCells(),shared:false}));
    $("approveMatrix").addEventListener("click",()=>{
      const result=validateMatrix();
      if(!result.ok) return toast(result.messages[0],"error");
      state.approved.matrix=true; buildSpecFromMatrix(); setChip("specStatus","Chờ giáo viên duyệt","neutral"); scheduleSave(); showStep("spec");
    });
  }

  function applyOfficialPreset(grade){
    $("grade").value=grade;
    $("examMode").value=grade==="6"?"mixed":"essay";
    $("useMcq").checked=grade==="6";$("useEssay").checked=true;
    resetMatrix(grade==="6"?"grade6":"grade8");
    toast(`Đã nạp cấu trúc tham chiếu từ đề chính thức lớp ${grade}.`,"success");
  }

  function resetMatrix(preset){
    $("matrixBody").innerHTML="";
    const key=preset||($("grade").value==="6"&&$("examMode").value==="mixed"?"grade6":$("grade").value==="8"&&$("examMode").value==="essay"?"grade8":$("examMode").value);
    if(!preset){$("useMcq").checked=$("examMode").value!=="essay";$("useEssay").checked=true;}
    renderMatrixHeader();
    const rows=DATA.defaults[key]||DATA.defaults.mixed;
    rows.forEach(row=>addMatrixRow(JSON.parse(JSON.stringify(row))));
    state.approved.matrix=false; state.approved.spec=false; updateMatrixTotals();
  }

  function emptyMatrixCells(){return Object.fromEntries(DATA.cellKeys.map(key=>[key,{count:0,pct:0}]));}
  function selectedQuestionTypes(){return [$("useMcq").checked?"mcq":"",$("useEssay").checked?"essay":""].filter(Boolean);}
  function visibleCellKeys(){return ["nb","th","vd"].flatMap(level=>selectedQuestionTypes().map(type=>`${level}_${type}`));}
  function renderMatrixHeader(){
    const types=selectedQuestionTypes(),span=types.length;
    $("matrixHead").innerHTML=`<tr><th rowspan="2">TT</th><th rowspan="2">Năng lực</th><th rowspan="2">Đơn vị kiến thức/bài học</th>${["Nhận biết","Thông hiểu","Vận dụng"].map(level=>`<th colspan="${span}">${level}</th>`).join("")}<th rowspan="2">Tổng</th><th rowspan="2">Câu 1*</th><th rowspan="2"></th></tr><tr>${["nb","th","vd"].flatMap(()=>types.map(type=>`<th>${type==="mcq"?"TNKQ":"TL"}<small>Số câu · % điểm</small></th>`)).join("")}</tr>`;
  }
  function renderMatrixRows(rows){$("matrixBody").innerHTML="";rows.forEach(addMatrixRow);}

  function addMatrixRow(row){
    const tr=document.createElement("tr");
    const cells={...emptyMatrixCells(),...(row.cells||{})};
    tr.innerHTML=`<td class="m-order"></td><td><select class="m-section">${options(DATA.labels.sections,row.section)}</select><input class="m-competency" value="${escapeHtml(row.competency||"")}" placeholder="Tên năng lực"></td><td><textarea class="m-unit" rows="2" placeholder="Nội dung">${escapeHtml(row.unit||"")}</textarea></td>${visibleCellKeys().map(key=>`<td><div class="matrix-cell-fields"><label>Số câu<input class="m-count" data-key="${key}" type="number" min="0" max="50" step="1" value="${Number(cells[key]?.count)||0}"></label><label>% điểm<input class="m-pct" data-key="${key}" type="number" min="0" max="100" step="0.5" value="${Number(cells[key]?.pct)||0}"></label></div></td>`).join("")}<td><span class="row-total">0</span></td><td><label class="star-check"><input class="m-shared" type="checkbox" ${row.shared?"checked":""}> 1*</label></td><td><button class="delete-row" type="button" aria-label="Xóa dòng">Xóa</button></td>`;
    tr._allCells=cells;
    tr.querySelectorAll("input,select,textarea").forEach(el=>el.addEventListener("input",()=>{state.approved.matrix=false;state.approved.spec=false;updateMatrixTotals();scheduleSave();}));
    tr.querySelector(".delete-row").addEventListener("click",()=>{tr.remove();state.approved.matrix=false;state.approved.spec=false;updateMatrixOrder();updateMatrixTotals();scheduleSave();});
    $("matrixBody").appendChild(tr);updateMatrixOrder();updateMatrixTotals();
  }

  function updateMatrixOrder(){$$("#matrixBody tr").forEach((tr,index)=>tr.querySelector(".m-order").textContent=index+1);}
  function getMatrix(includeHidden=false){return $$("#matrixBody tr").map(tr=>{
    const cells={...emptyMatrixCells(),...(tr._allCells||{})};
    tr.querySelectorAll(".m-count").forEach(input=>{cells[input.dataset.key]={...(cells[input.dataset.key]||{}),count:Number(input.value)||0};});
    tr.querySelectorAll(".m-pct").forEach(input=>{cells[input.dataset.key]={...(cells[input.dataset.key]||{}),pct:Number(input.value)||0};});
    if(!includeHidden){if(!$("useMcq").checked) ["nb_mcq","th_mcq","vd_mcq"].forEach(key=>cells[key]={count:0,pct:0});if(!$("useEssay").checked) ["nb_essay","th_essay","vd_essay"].forEach(key=>cells[key]={count:0,pct:0});}
    return {section:tr.querySelector(".m-section").value,competency:tr.querySelector(".m-competency").value.trim(),unit:tr.querySelector(".m-unit").value.trim(),cells,shared:tr.querySelector(".m-shared").checked};
  });}
  function matrixRowCount(row){const values=visibleCellKeys().map(key=>Number(row.cells[key]?.count)||0);return row.shared?Math.max(0,...values):values.reduce((sum,value)=>sum+value,0);}
  function matrixRowPct(row){return visibleCellKeys().reduce((sum,key)=>sum+(Number(row.cells[key]?.pct)||0),0);}
  function updateMatrixTotals(){
    const rows=getMatrix(),pct=rows.reduce((sum,row)=>sum+matrixRowPct(row),0),questions=rows.reduce((sum,row)=>sum+matrixRowCount(row),0);
    $$("#matrixBody tr").forEach((tr,index)=>tr.querySelector(".row-total").textContent=`${matrixRowCount(rows[index])} câu · ${formatScore(matrixRowPct(rows[index]))}%`);
    $("matrixTotal").textContent=formatScore(pct)+"%";$("matrixTarget").textContent=`· ${questions} câu · ${formatScore((Number($("totalScore").value)||0)*pct/100)} điểm`;
    updateMatrixOrder();
    const result=validateMatrix();const box=$("matrixValidation");box.className="validation-box "+(result.ok?"ok":pct>100?"bad":"warning");box.innerHTML=result.messages.map(message=>`<div>${result.ok?"✓":"•"} ${escapeHtml(message)}</div>`).join("");
  }

  function validateMatrix(){
    const rows=getMatrix(),target=Number($("totalScore").value)||0,pctTotal=rows.reduce((sum,row)=>sum+matrixRowPct(row),0),messages=[];
    if(!rows.length) messages.push("Ma trận chưa có dòng dữ liệu.");
    if(rows.some(r=>!r.unit||!r.competency)) messages.push("Mỗi dòng phải có năng lực và đơn vị kiến thức/bài học.");
    if(rows.some(row=>visibleCellKeys().some(key=>{const cell=row.cells[key];return !Number.isInteger(cell.count)||cell.count<0||cell.pct<0||(cell.count===0)!==(cell.pct===0);}))) messages.push("Mỗi ô phải có đồng thời số câu nguyên không âm và % điểm; cùng bằng 0 nếu không sử dụng.");
    if(!rows.some(r=>r.section==="doc_hieu")) messages.push("Thiếu phần Đọc hiểu.");
    if(!rows.some(r=>r.section==="viet")) messages.push("Thiếu phần Viết.");
    if(!$("useEssay").checked) messages.push("Cần bật TL vì hồ sơ Ngữ văn có PHẦN II. VIẾT; TNKQ là phần có thể bật hoặc tắt theo quy định của trường.");
    const writingRows=rows.filter(r=>r.section==="viet");
    if(writingRows.length!==1||!writingRows[0]?.shared) messages.push("Phần Viết phải là một dòng có đánh dấu 1* để chỉ tính một câu xuyên ba mức nhận thức.");
    if(Math.abs(pctTotal-100)>0.001) messages.push(`Tổng tỉ lệ là ${formatScore(pctTotal)}%, phải bằng 100%.`);
    const levelPct=level=>rows.reduce((sum,row)=>sum+visibleCellKeys().filter(key=>key.startsWith(level+"_")).reduce((s,key)=>s+Number(row.cells[key].pct||0),0),0);
    const questions=rows.reduce((sum,row)=>sum+matrixRowCount(row),0),nb=levelPct("nb"),th=levelPct("th"),vd=levelPct("vd");
    if(!messages.length) messages.push(`Ma trận hợp lệ: ${questions} câu, ${formatScore(target)} điểm; NB ${formatScore(nb)}% · TH ${formatScore(th)}% · VD ${formatScore(vd)}%; NB+TH ${formatScore(nb+th)}% / VD ${formatScore(vd)}%.`);
    return {ok:messages.length===1&&messages[0].startsWith("Ma trận hợp lệ"),messages,total:target*pctTotal/100,pctTotal,questions,levelPct:{nb,th,vd}};
  }

  function bindSpec(){
    $("addSpecRow").addEventListener("click",()=>addSpecRow({section:"doc_hieu",unit:"",level:"nhan_biet",descriptor:"",allocation:"—",score:0,shared:false}));
    $("approveSpec").addEventListener("click",()=>{
      const result=validateSpec(); if(!result.ok) return toast(result.message,"error");
      state.approved.spec=true;setChip("specStatus","Đã duyệt","ok");updateRequestSummary();scheduleSave();showStep("exam");
    });
  }

  function buildSpecFromMatrix(){
    $("specBody").innerHTML="";
    const grade=$("grade").value,levelMap={nb:"nhan_biet",th:"thong_hieu",vd:"van_dung"},target=Number($("totalScore").value)||10;
    getMatrix().forEach(row=>{
      ["nb","th","vd"].forEach(level=>{
        const parts=[],mcq=row.cells[`${level}_mcq`],essay=row.cells[`${level}_essay`];
        if(mcq.count)parts.push(`${mcq.count}${row.shared?"*":""} TN`);
        if(essay.count)parts.push(`${essay.count}${row.shared?"*":""} TL`);
        const pct=Number(mcq.pct||0)+Number(essay.pct||0);if(!parts.length&&!pct)return;
        const mapped=levelMap[level],descriptor=DATA.descriptors[grade]?.[row.section]?.[mapped]||"Giáo viên nhập yêu cầu cần đạt theo chương trình và nguồn chính thức.";
        addSpecRow({section:row.section,unit:row.unit,level:mapped,descriptor,allocation:parts.join(" + "),score:round(target*pct/100),shared:row.shared});
      });
    });
  }

  function addSpecRow(row){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td class="s-order"></td><td><select class="s-section">${options(DATA.labels.sections,row.section)}</select></td><td><textarea class="s-unit" rows="2">${escapeHtml(row.unit||"")}</textarea></td><td><select class="s-level">${options(DATA.labels.levels,row.level)}</select></td><td><textarea class="s-descriptor" rows="6" placeholder="Nhập từng yêu cầu cần đạt, mỗi ý một dòng">${escapeHtml(row.descriptor||"")}</textarea></td><td><input class="s-allocation" value="${escapeHtml(row.allocation||"—")}" placeholder="VD: 3 TN + 1 TL"></td><td><input class="s-score" type="number" min="0" step="0.25" value="${Number(row.score)||0}"></td><td><input class="s-shared" type="checkbox" ${row.shared?"checked":""} aria-label="Một câu dùng chung ba mức"></td><td><div class="row-actions"><button class="duplicate-row" type="button">Nhân bản</button><button class="delete-row" type="button">Xóa</button></div></td>`;
    tr.querySelectorAll("input,select,textarea").forEach(el=>el.addEventListener("input",()=>{state.approved.spec=false;setChip("specStatus","Đã chỉnh sửa – cần duyệt lại","neutral");scheduleSave();}));
    tr.querySelector(".duplicate-row").addEventListener("click",()=>{const item=getSpecRow(tr);addSpecRow({...item,allocation:"—",score:0});state.approved.spec=false;scheduleSave();});
    tr.querySelector(".delete-row").addEventListener("click",()=>{tr.remove();updateSpecOrder();state.approved.spec=false;scheduleSave();});
    $("specBody").appendChild(tr);updateSpecOrder();
  }

  function updateSpecOrder(){$$("#specBody tr").forEach((tr,index)=>tr.querySelector(".s-order").textContent=index+1);}
  function getSpecRow(tr){return {section:tr.querySelector(".s-section").value,unit:tr.querySelector(".s-unit").value.trim(),level:tr.querySelector(".s-level").value,descriptor:tr.querySelector(".s-descriptor").value.trim(),allocation:tr.querySelector(".s-allocation").value.trim(),score:Number(tr.querySelector(".s-score").value)||0,shared:tr.querySelector(".s-shared").checked};}
  function getSpec(){return $$("#specBody tr").map(getSpecRow);}
  function validateSpec(){
    const rows=getSpec(); if(!rows.length) return {ok:false,message:"Bản đặc tả chưa có dữ liệu."};
    if(rows.some(r=>!r.unit||!r.descriptor||!r.allocation||r.score<0)) return {ok:false,message:"Bản đặc tả còn dòng thiếu đơn vị kiến thức, yêu cầu cần đạt hoặc số lượng/dạng câu."};
    const matrixTotal=validateMatrix().total,specTotal=rows.reduce((s,r)=>s+r.score,0);
    if(Math.abs(matrixTotal-specTotal)>0.001) return {ok:false,message:`Tổng điểm đặc tả (${formatScore(specTotal)}) không khớp ma trận (${formatScore(matrixTotal)}).`};
    const levelMap={nhan_biet:"nb",thong_hieu:"th",van_dung:"vd"},target=Number($("totalScore").value)||10,matrix=getMatrix();
    for(const [level,prefix] of Object.entries(levelMap)){
      const expected=matrix.reduce((sum,row)=>sum+visibleCellKeys().filter(key=>key.startsWith(prefix+"_")).reduce((s,key)=>s+Number(row.cells[key].pct||0),0),0)*target/100;
      const actual=rows.filter(row=>row.level===level).reduce((sum,row)=>sum+row.score,0);
      if(Math.abs(expected-actual)>0.001)return {ok:false,message:`Điểm đặc tả mức ${DATA.labels.levels[level]} (${formatScore(actual)}) không khớp ma trận (${formatScore(expected)}).`};
    }
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
    let html=`<table class="exam-header"><tr><td><b>${escapeHtml($("schoolName").value||"TRƯỜNG THCS …")}</b></td><td><b>${title}</b><br>Môn: Ngữ văn – Lớp ${escapeHtml($("grade").value)}<br>Năm học ${escapeHtml($("schoolYear").value)}<br>Thời gian: ${escapeHtml($("duration").value)} phút (không kể thời gian phát đề)</td></tr></table><p><b>Họ và tên học sinh:</b> ........................................................................ <b>Lớp:</b> ............</p>`;
    if(data.instructions) html+=`<p><i>${escapeHtml(data.instructions)}</i></p>`;
    if(data.reading&&data.writing){
      const reading=data.reading,mcq=reading.mcqQuestions||[],essay=reading.essayQuestions||[];
      html+=`<h3 style="text-align:left">PHẦN I. ĐỌC (${formatScore(Number(reading.score)||0)} điểm)</h3>`;
      if(reading.source)html+=`<div class="exam-source">${escapeHtml(reading.source).replace(/\n/g,"<br>")}</div>`;
      if(reading.sourceNote)html+=`<p style="text-align:right"><i>${escapeHtml(reading.sourceNote)}</i></p>`;
      if(reading.glossary)html+=`<p><i>Chú thích: ${escapeHtml(reading.glossary).replace(/\n/g,"<br>")}</i></p>`;
      if(mcq.length){const score=mcq.reduce((sum,q)=>sum+Number(q.score||0),0);html+=`<h4>I. TRẮC NGHIỆM (${formatScore(score)} điểm)</h4>`;html+=mcq.map((q,index)=>renderQuestion(q,index)).join("");}
      if(essay.length){const score=essay.reduce((sum,q)=>sum+Number(q.score||0),0);html+=`<h4>${mcq.length?"II":"I"}. TỰ LUẬN (${formatScore(score)} điểm)</h4>`;html+=essay.map((q,index)=>renderQuestion(q,index+mcq.length)).join("");}
      html+=`<h3 style="text-align:left">PHẦN II. VIẾT (${formatScore(Number(data.writing.score)||0)} điểm)</h3>`;
      html+=renderQuestion(data.writing.question||{},mcq.length+essay.length);
    }else{
      (data.sections||[]).forEach((section,index)=>{html+=`<h3 style="text-align:left">PHẦN ${roman(index+1)}. ${escapeHtml(section.title||DATA.labels.sections[index===0?"doc_hieu":"viet"])}</h3>`;if(section.source)html+=`<div class="exam-source">${escapeHtml(section.source).replace(/\n/g,"<br>")}</div>`;(section.questions||[]).forEach((q,qIndex)=>html+=renderQuestion(q,qIndex));});
    }
    return html;
  }
  function renderQuestion(q,index){let html=`<p><b>Câu ${escapeHtml(String(q.number||index+1))}.</b> ${escapeHtml(q.prompt||"")} <b>(${formatScore(Number(q.score)||0)} điểm)</b></p>`;if(Array.isArray(q.options)&&q.options.length)html+=`<ol type="A">${q.options.map(option=>`<li>${escapeHtml(String(option).replace(/^[A-D][.)]\s*/,""))}</li>`).join("")}</ol>`;return html;}

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
    if(data.reading&&data.writing){
      html+="<h2>PHẦN I. ĐỌC</h2>";
      const mcq=data.reading.mcqAnswers||[];if(mcq.length)html+=`<h3>I. TRẮC NGHIỆM</h3><table><thead><tr><th>Câu</th>${mcq.map(item=>`<th>${escapeHtml(item.number)}</th>`).join("")}</tr></thead><tbody><tr><th>Đáp án</th>${mcq.map(item=>`<td>${escapeHtml(item.answer)}</td>`).join("")}</tr><tr><th>Điểm</th>${mcq.map(item=>`<td>${formatScore(Number(item.score)||0)}</td>`).join("")}</tr></tbody></table>`;
      const essays=data.reading.essayAnswers||[];if(essays.length)html+=`<h3>${mcq.length?"II":"I"}. TỰ LUẬN</h3><table><thead><tr><th>Câu</th><th>Yêu cầu cần đạt và hướng dẫn chấm</th><th>Điểm</th></tr></thead><tbody>${essays.map(item=>`<tr><td>${escapeHtml(item.number)}</td><td><b>Đáp án định hướng:</b><br>${escapeHtml(item.expected||"").replace(/\n/g,"<br>")}<br><b>Hướng dẫn chấm:</b><ul>${(item.scoring||[]).map(rule=>`<li>${escapeHtml(rule.description||"")} (${formatScore(Number(rule.score)||0)} điểm)</li>`).join("")}</ul></td><td>${formatScore(Number(item.maxScore)||0)}</td></tr>`).join("")}</tbody></table>`;
      html+="<h2>PHẦN II. VIẾT</h2>";
      html+=`<table><thead><tr><th>Nhóm yêu cầu</th><th>Tiêu chí/yêu cầu cần đạt</th><th>Điểm</th></tr></thead><tbody>${[...(data.writing.skillRequirements||[]).map(row=>({...row,group:"1. Yêu cầu về kĩ năng"})),...(data.writing.contentRequirements||[]).map(row=>({...row,group:"2. Yêu cầu về nội dung"}))].map(row=>`<tr><td>${escapeHtml(row.group)}</td><td><b>${escapeHtml(row.criterion||"")}</b><br>${escapeHtml(row.description||"").replace(/\n/g,"<br>")}</td><td>${formatScore(Number(row.score)||0)}</td></tr>`).join("")}</tbody></table>`;
      if((data.writing.scoreBands||[]).length)html+=`<h3>Biểu điểm tổng thể</h3><table><thead><tr><th>Mức điểm</th><th>Mô tả</th></tr></thead><tbody>${data.writing.scoreBands.map(row=>`<tr><td>${escapeHtml(row.range||"")}</td><td>${escapeHtml(row.description||"")}</td></tr>`).join("")}</tbody></table>`;
    }else{
      (data.items||[]).forEach((item,index)=>{html+=`<h3>Câu ${escapeHtml(String(item.number||index+1))} (${formatScore(Number(item.score)||0)} điểm)</h3><p>${escapeHtml(item.answer||item.guidance||"").replace(/\n/g,"<br>")}</p>`;if(Array.isArray(item.criteria)&&item.criteria.length)html+="<ul>"+item.criteria.map(c=>`<li>${escapeHtml(c.description||c.label||"")} <b>(${formatScore(Number(c.score)||0)} điểm)</b></li>`).join("")+"</ul>";});
      if(Array.isArray(data.writingRubric)&&data.writingRubric.length)html+="<h2>Rubric phần viết</h2><table><thead><tr><th>Tiêu chí</th><th>Yêu cầu</th><th>Điểm</th></tr></thead><tbody>"+data.writingRubric.map(row=>`<tr><td>${escapeHtml(row.criterion||"")}</td><td>${escapeHtml(row.description||"")}</td><td>${formatScore(Number(row.score)||0)}</td></tr>`).join("")+"</tbody></table>";
    }
    if(data.notes) html+=`<p><i>${escapeHtml(data.notes)}</i></p>`;
    if(data.accommodations)html+=`<h2>HƯỚNG DẪN CHẤM CHO HỌC SINH KHUYẾT TẬT (NẾU ÁP DỤNG)</h2><p>${escapeHtml(data.accommodations).replace(/\n/g,"<br>")}</p>`;
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
      config:{schoolName:$("schoolName").value.trim(),grade:$("grade").value,schoolYear:$("schoolYear").value.trim(),examType:$("examType").value,duration:Number($("duration").value),totalScore:Number($("totalScore").value),examMode:$("examMode").value,questionTypes:{mcq:$("useMcq").checked,essay:$("useEssay").checked},scope:$("scope").value.trim(),extraRequirements:$("extraRequirements").value.trim()},
      matrix:getMatrix(),spec:getSpec(),readingText:$("readingText").value.trim(),writingText:$("writingText").value.trim(),sources
    };
  }

  function updateRequestSummary(){
    if(!$("requestSummary")) return;
    const config=`Lớp ${$("grade").value} · ${$("examType").value} · ${$("duration").value} phút · ${$("totalScore").value} điểm`;
    const matrix=validateMatrix(),types=selectedQuestionTypes().map(type=>type==="mcq"?"TNKQ":"TL").join(" + ");
    $("requestSummary").innerHTML=`<div class="summary-block"><strong>Kì kiểm tra</strong><span>${escapeHtml(config)}</span></div><div class="summary-block"><strong>Dạng câu do trường chọn</strong><span>${escapeHtml(types)}</span></div><div class="summary-block"><strong>Ma trận</strong><span>${matrix.questions||0} câu · ${formatScore(matrix.total)} điểm · ${formatScore(matrix.pctTotal||0)}%</span></div><div class="summary-block"><strong>Bản đặc tả</strong><span>${getSpec().length} dòng yêu cầu cần đạt</span></div><div class="summary-block"><strong>Nguồn</strong><span>${state.sources.length} tệp · ${$("readingText").value.trim()?"có":"chưa có"} ngữ liệu dán trực tiếp</span></div><div class="summary-block"><strong>Dữ liệu không gửi</strong><span>API key, bản nháp cục bộ và tệp gốc.</span></div>`;
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
    const keys=visibleCellKeys(),matrix=getMatrix(),levelName={nb:"Nhận biết",th:"Thông hiểu",vd:"Vận dụng"},typeName={mcq:"TNKQ",essay:"TL"};
    const matrixHeaders=["TT","Năng lực","Đơn vị kiến thức/bài học",...keys.map(key=>{const [level,type]=key.split("_");return `${levelName[level]}\n${typeName[type]}`;}),"Tổng số câu, % điểm"];
    const matrixRows=matrix.map((r,index)=>[String(index+1),r.competency,r.unit,...keys.map(key=>{const cell=r.cells[key];return cell.count?`${cell.count}${r.shared?"*":""}\n${formatScore(cell.pct)}%`:"0";}),`${matrixRowCount(r)}\n${formatScore(matrixRowPct(r))}%`]);
    const levelTotals=prefix=>matrix.reduce((sum,row)=>sum+keys.filter(key=>key.startsWith(prefix+"_")).reduce((s,key)=>s+Number(row.cells[key].pct||0),0),0);
    matrixRows.push(["","Tổng","",...keys.map(key=>`${formatScore(matrix.reduce((sum,row)=>sum+Number(row.cells[key].pct||0),0))}%`),`${validateMatrix().questions}\n100%`]);
    matrixRows.push(["","Tỉ lệ %","",...keys.map(key=>`${formatScore(levelTotals(key.split("_")[0]))}%`),"100%"]);
    matrixRows.push(["","Tỉ lệ chung","",...keys.map(key=>key.startsWith("vd_")?`${formatScore(levelTotals("vd"))}%`:`${formatScore(levelTotals("nb")+levelTotals("th"))}%`),"100%"]);
    parts.push(wTable(matrixHeaders,matrixRows));
    parts.push(pageBreak(),wPara("II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA",true,"left",26));
    parts.push(wTable(["TT","Kĩ năng","Đơn vị kiến thức/kĩ năng","Mức độ nhận thức","Yêu cầu cần đạt","Số lượng/dạng câu","Điểm"],getSpec().map((r,index)=>[String(index+1),DATA.labels.sections[r.section],r.unit,DATA.labels.levels[r.level],r.descriptor,r.allocation,formatScore(r.score)])));
    parts.push(pageBreak(),wPara("III. ĐỀ KIỂM TRA",true,"left",26));
    parts.push(...editorToWordBlocks($("examEditor")));
    parts.push(pageBreak(),wPara("IV. HƯỚNG DẪN CHẤM, ĐÁP ÁN VÀ BIỂU ĐIỂM",true,"left",26));
    parts.push(...editorToWordBlocks($("answerEditor")));
    if(state.review){parts.push(pageBreak(),wPara("PHỤ LỤC: KẾT QUẢ RÀ SOÁT AI",true,"left",26),...plainTextParagraphs(state.review));}
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }

  function editorToWordBlocks(root){
    const blocks=[];
    Array.from(root.children).forEach(node=>{
      if(node.tagName==="TABLE"){
        const rows=Array.from(node.rows).map(row=>Array.from(row.cells).map(cell=>cleanText(cell.innerText)));
        if(rows.length)blocks.push(wTable(rows[0],rows.slice(1)));return;
      }
      if(node.tagName==="UL"||node.tagName==="OL"){Array.from(node.children).forEach((li,index)=>blocks.push(wPara(`${node.tagName==="OL"?(index+1)+". ":"- "}${li.innerText}`,false,"both",26)));return;}
      const text=cleanText(node.innerText||node.textContent||"");if(!text)return;
      const heading=/^H[1-4]$/.test(node.tagName);blocks.push(wPara(text,heading,heading?(node.tagName==="H3"||node.tagName==="H4"?"left":"center"):"both",heading?26:26));
    });
    return blocks.length?blocks:plainTextParagraphs(root.innerText);
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
    version:2,step:state.step,approved:state.approved,review:state.review,questionTypes:{mcq:$("useMcq").checked,essay:$("useEssay").checked},
    fields:Object.fromEntries(["schoolName","grade","schoolYear","examType","duration","totalScore","examMode","scope","extraRequirements","provider","model","readingText","writingText"].map(id=>[id,$(id).value])),
    matrix:getMatrix(),spec:getSpec(),examHtml:hasEditorContent($("examEditor"))?$("examEditor").innerHTML:"",answerHtml:hasEditorContent($("answerEditor"))?$("answerEditor").innerHTML:"",sources:includeSources?state.sources:[]
  };}
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(collectDraft(false)));$("saveState").textContent="Đã lưu bản nháp trên máy";}catch(_){$("saveState").textContent="Không thể lưu thêm bản nháp";}},350);}
  function loadDraft(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)applyDraft(JSON.parse(raw));}catch(_){localStorage.removeItem(STORAGE_KEY);}}
  function applyDraft(data){
    if(!data||typeof data!=="object")throw new Error("Invalid draft");
    Object.entries(data.fields||{}).forEach(([id,value])=>{if($(id)&&id!=="apiKey")$(id).value=value;});
    state.step=data.step||"setup";state.approved={matrix:false,spec:false,exam:false,answer:false,...data.approved};state.review=data.review||"";state.sources=Array.isArray(data.sources)?data.sources:[];
    if(data.questionTypes){$("useMcq").checked=Boolean(data.questionTypes.mcq);$("useEssay").checked=Boolean(data.questionTypes.essay);}renderMatrixHeader();
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
