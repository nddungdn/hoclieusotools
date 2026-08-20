function text(v){ return v==null?'':String(v); }
function siteTotals(state){
  const sites=state.school.sites||[];
  const sum=(k)=>sites.reduce((a,s)=>a+(Number(s[k])||0),0);
  return { classes: sum('classCount'), students: sum('studentCount') };
}
function curriculumRows(state, forPl3=false){
  return (state.curriculum||[]).map((r,i)=> forPl3 ? [
    i+1,
    [r.unit,r.lesson||r.content].filter(Boolean).join(' – '),
    r.periodCount||'',
    r.week||'',
    r.equipment||state.pl3.defaultEquipment||'',
    r.location||state.pl3.defaultLocation||''
  ] : [
    i+1,
    r.unit||'',
    r.lesson||r.content||'',
    formatPeriods(r),
    r.yccd||'',
    buildNote(r)
  ]);
}
function formatPeriods(r){
  if (r.periodStart && r.periodEnd && r.periodStart!==r.periodEnd) return `${r.periodStart}–${r.periodEnd}`;
  return r.periodStart||r.periodEnd||r.periodCount||'';
}
function buildNote(r){
  const bits=[];
  const nls=Array.isArray(r.digitalCompetency)?r.digitalCompetency:[];
  for (const x of nls) bits.push(typeof x==='string'?x:`NLS ${x.code||''}: ${x.objective||x.description||''}`.trim());
  const q=Array.isArray(r.defenseSecurity)?r.defenseSecurity:[];
  for (const x of q) bits.push(typeof x==='string'?x:`GDQP&AN: ${x.content||x.objective||''}`);
  return bits.join('\n');
}

export function buildDocumentModel(state){
  const sections=[];
  const totals=siteTotals(state);
  const common={
    school: state.school.officialName||'[TÊN TRƯỜNG]',
    department: state.school.department||'[TỔ CHUYÊN MÔN]',
    year: state.project.academicYear,
    subject:`NGỮ VĂN ${state.project.grade}`,
    locality: state.school.locality||'[ĐỊA DANH]'
  };

  if (state.appendices.pl1) sections.push(buildPL1(state, common, totals));
  if (state.appendices.pl2) sections.push(buildPL2(state, common));
  if (state.appendices.pl3) sections.push(buildPL3(state, common));
  return { meta:{title:'Kế hoạch dạy học Ngữ văn', academicYear:state.project.academicYear}, sections };
}

function baseHeader(common, title, subtitle=''){
  return [
    {type:'twoColumnHeader', left:`TRƯỜNG: ${common.school}\nTỔ: ${common.department}`, right:'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc'},
    {type:'title', text:title},
    ...(subtitle?[{type:'subtitle',text:subtitle}]:[]),
    {type:'subtitle', text:`(Năm học ${common.year})`}
  ];
}

function buildPL1(state, common, totals){
  const st=state.pl1.staff;
  const blocks=baseHeader(common,'KẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN',`MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC: ${common.subject}`);
  blocks.push({type:'heading',text:'I. ĐẶC ĐIỂM TÌNH HÌNH'});
  blocks.push({type:'paragraph',text:`1. Số lớp: ${state.school.totalClassesManual||totals.classes||'……'}; Số học sinh: ${state.school.totalStudentsManual||totals.students||'……'}.`});
  blocks.push({type:'paragraph',text:`2. Tình hình đội ngũ: Số giáo viên: ${st.total||'……'}; Cao đẳng: ${st.college||'……'}; Đại học: ${st.university||'……'}; Trên đại học: ${st.postgraduate||'……'}; Chuẩn nghề nghiệp – Tốt: ${st.good||'……'}; Khá: ${st.fair||'……'}; Đạt: ${st.pass||'……'}; Chưa đạt: ${st.fail||'……'}.`});
  blocks.push({type:'paragraph',text:'3. Thiết bị dạy học'});
  blocks.push({type:'table', headers:['STT','Thiết bị dạy học','Số lượng','Cơ sở/Phạm vi sử dụng','Ghi chú'], rows:(state.pl1.equipment||[]).map((x,i)=>[i+1,x.name||'',x.quantity||'',x.site||x.scope||'',x.note||''])});
  blocks.push({type:'paragraph',text:'4. Phòng học bộ môn/phòng đa năng/sân chơi, bãi tập'});
  blocks.push({type:'table', headers:['STT','Tên phòng/không gian','Số lượng','Cơ sở/Phạm vi sử dụng','Ghi chú'], rows:(state.pl1.facilities||[]).map((x,i)=>[i+1,x.name||'',x.quantity||'',x.site||x.scope||'',x.note||''])});
  blocks.push({type:'heading',text:'II. KẾ HOẠCH DẠY HỌC'});
  blocks.push({type:'paragraph',text:'1. Phân phối chương trình'});
  blocks.push({type:'table',headers:['STT','Bài/Chủ đề','Nội dung dạy học','Tiết','Yêu cầu cần đạt','Ghi chú'],rows:curriculumRows(state,false)});
  blocks.push({type:'paragraph',text:'2. Chuyên đề lựa chọn: Không áp dụng đối với môn Ngữ văn cấp THCS.'});
  blocks.push({type:'paragraph',text:'3. Kiểm tra, đánh giá định kỳ'});
  blocks.push({type:'table',headers:['Bài kiểm tra/đánh giá','Thời gian','Thời điểm','Yêu cầu cần đạt','Hình thức'],rows:(state.assessments||[]).map(a=>[a.name||'',a.duration||'',a.time||a.week||'',a.yccd||'',a.form||''])});
  blocks.push({type:'heading',text:'III. CÁC NỘI DUNG KHÁC (NẾU CÓ)'});
  blocks.push({type:'signature',left:'TỔ TRƯỞNG',right:'HIỆU TRƯỞNG',locality:common.locality});
  return { id:'PL1', title:'Phụ lục I', orientation:'landscape', blocks };
}

function buildPL2(state, common){
  const blocks=baseHeader(common,'KẾ HOẠCH TỔ CHỨC CÁC HOẠT ĐỘNG GIÁO DỤC CỦA TỔ CHUYÊN MÔN');
  blocks.push({type:'table',headers:['STT','Chủ đề','Yêu cầu cần đạt','Số tiết','Thời điểm','Địa điểm','Chủ trì','Phối hợp','Điều kiện thực hiện'],rows:(state.pl2.activities||[]).map((a,i)=>[i+1,a.topic||'',a.yccd||'',a.periods||'',a.time||'',a.location||'',a.lead||'',a.coordinate||'',a.conditions||''])});
  blocks.push({type:'signature',left:'TỔ TRƯỞNG',right:'HIỆU TRƯỞNG',locality:common.locality});
  return { id:'PL2', title:'Phụ lục II', orientation:'landscape', blocks };
}

function buildPL3(state, common){
  const blocks=baseHeader(common,'KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN',`MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC: ${common.subject}`);
  blocks.splice(1,0,{type:'paragraph',text:`Họ và tên giáo viên: ${state.pl3.teacherName||'[CHƯA CUNG CẤP]'}`});
  blocks.push({type:'heading',text:'I. KẾ HOẠCH DẠY HỌC'});
  blocks.push({type:'paragraph',text:'1. Phân phối chương trình'});
  blocks.push({type:'table',headers:['STT','Bài học','Số tiết','Thời điểm (Tuần)','Thiết bị dạy học','Địa điểm dạy học'],rows:curriculumRows(state,true)});
  blocks.push({type:'paragraph',text:'2. Chuyên đề lựa chọn: Không áp dụng đối với môn Ngữ văn cấp THCS.'});
  blocks.push({type:'heading',text:'II. NHIỆM VỤ KHÁC (NẾU CÓ)'});
  blocks.push({type:'paragraph',text:state.pl3.otherTasks||'........................................................................................................'});
  blocks.push({type:'signature',left:'TỔ TRƯỞNG',right:'GIÁO VIÊN',locality:common.locality});
  return { id:'PL3', title:'Phụ lục III', orientation:'portrait', blocks };
}
