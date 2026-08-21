function siteTotals(state){
  const sites=state.school.sites||[];
  const sum=(k)=>sites.reduce((a,s)=>a+(Number(s[k])||0),0);
  return {classes:sum('classCount'),students:sum('studentCount')};
}

function valueOrDots(value){
  if(value===0||value==='0')return value;
  return String(value??'').trim()?value:'……';
}

function formatPeriods(r){
  if(r.periodStart&&r.periodEnd&&Number(r.periodStart)!==Number(r.periodEnd))return `${r.periodStart}–${r.periodEnd}`;
  return r.periodStart||r.periodEnd||r.periodCount||'';
}

function buildNote(r){
  const bits=[];
  const nls=Array.isArray(r.digitalCompetency)?r.digitalCompetency:[];
  for(const x of nls)bits.push(typeof x==='string'?x:`NLS ${x.code||''}: ${x.objective||x.description||''}`.trim());
  const q=Array.isArray(r.defenseSecurity)?r.defenseSecurity:[];
  for(const x of q)bits.push(typeof x==='string'?x:`GDQP&AN: ${x.content||x.objective||''}`);
  return bits.join('\n');
}

function semesterOf(row,state){
  const explicit=String(row.semester||'').toUpperCase().replace(/\s/g,'');
  if(['2','II','HKII','HỌCKỲII','HOCKYII'].includes(explicit))return 2;
  if(['1','I','HKI','HỌCKỲI','HOCKYI'].includes(explicit))return 1;
  const first=Number(row.periodStart||row.periodEnd||0);
  return first&&first>Number(state.project.semester1Periods||72)?2:1;
}

function semesterRows(state,semester,forPl3=false){
  return (state.curriculum||[]).map((r,i)=>({r,i})).filter(({r})=>semesterOf(r,state)===semester).map(({r,i})=>forPl3?[
    i+1,r.unit||'',r.lesson||r.content||'',r.periodCount||'',r.week||'',
    r.equipment||state.pl3.defaultEquipment||'',r.location||state.pl3.defaultLocation||''
  ]:[
    i+1,r.unit||'',r.lesson||r.content||'',formatPeriods(r),r.yccd||'',buildNote(r)
  ]);
}

function addSemesterTables(blocks,state,{forPl3=false}={}){
  const headers=forPl3
    ?['STT','Bài/Chủ đề','Nội dung dạy học','Số tiết','Thời điểm (Tuần)','Thiết bị dạy học','Địa điểm dạy học']
    :['STT','Bài/Chủ đề','Nội dung dạy học','Tiết PPCT','Yêu cầu cần đạt','Ghi chú'];
  const widths=forPl3?[5,16,28,7,10,23,11]:[5,16,23,8,34,14];
  const rows1=semesterRows(state,1,forPl3),rows2=semesterRows(state,2,forPl3);
  if(!rows1.length&&!rows2.length){blocks.push({type:'table',headers,rows:[],widths});return;}
  if(rows1.length){
    blocks.push({type:'subheading',text:`HỌC KỲ I (${Number(state.project.semester1Periods||72)} tiết)`});
    blocks.push({type:'table',headers,rows:rows1,widths});
  }
  if(rows2.length){
    blocks.push({type:'subheading',text:`HỌC KỲ II (${Number(state.project.semester2Periods||68)} tiết)`});
    blocks.push({type:'table',headers,rows:rows2,widths});
  }
}

function siteDetail(state){
  const rows=(state.school.sites||[]).filter(s=>s.name||s.classCount||s.studentCount).map(s=>`${s.name||'Cơ sở chưa đặt tên'}: ${valueOrDots(s.classCount)} lớp, ${valueOrDots(s.studentCount)} học sinh`);
  return rows.length?`Theo cơ sở: ${rows.join('; ')}.`:'';
}

export function buildDocumentModel(state){
  const sections=[];
  const totals=siteTotals(state);
  const common={
    school:state.school.officialName||'[TÊN TRƯỜNG]',
    department:state.school.department||'[TỔ CHUYÊN MÔN]',
    year:state.project.academicYear,
    subject:`NGỮ VĂN ${state.project.grade}`,
    locality:state.school.locality||'[ĐỊA DANH]'
  };
  if(state.appendices.pl1)sections.push(buildPL1(state,common,totals));
  if(state.appendices.pl2)sections.push(buildPL2(state,common));
  if(state.appendices.pl3)sections.push(buildPL3(state,common));
  return {meta:{title:'Kế hoạch dạy học Ngữ văn',academicYear:state.project.academicYear},sections};
}

function baseHeader(common,title,subtitle=''){
  return [
    {type:'twoColumnHeader',left:`TRƯỜNG: ${common.school}\nTỔ: ${common.department}`,right:'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc'},
    {type:'title',text:title},
    ...(subtitle?[{type:'subtitle',text:subtitle}]:[]),
    {type:'subtitle',text:`(Năm học ${common.year})`}
  ];
}

function buildPL1(state,common,totals){
  const st=state.pl1.staff;
  const blocks=baseHeader(common,'KẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN',`MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC: ${common.subject}`);
  blocks.push({type:'heading',text:'I. ĐẶC ĐIỂM TÌNH HÌNH'});
  const totalClasses=String(state.school.totalClassesManual??'').trim()?state.school.totalClassesManual:(totals.classes||'……');
  const totalStudents=String(state.school.totalStudentsManual??'').trim()?state.school.totalStudentsManual:(totals.students||'……');
  blocks.push({type:'paragraph',text:`1. Số lớp: ${totalClasses}; Số học sinh: ${totalStudents}.`});
  const detail=siteDetail(state);if(detail)blocks.push({type:'paragraph',text:detail});
  blocks.push({type:'paragraph',text:`2. Tình hình đội ngũ: Số giáo viên: ${valueOrDots(st.total)}; Cao đẳng: ${valueOrDots(st.college)}; Đại học: ${valueOrDots(st.university)}; Trên đại học: ${valueOrDots(st.postgraduate)}; Chuẩn nghề nghiệp – Tốt: ${valueOrDots(st.good)}; Khá: ${valueOrDots(st.fair)}; Đạt: ${valueOrDots(st.pass)}; Chưa đạt: ${valueOrDots(st.fail)}.`});
  blocks.push({type:'paragraph',text:'3. Thiết bị dạy học'});
  blocks.push({type:'table',headers:['STT','Thiết bị dạy học','Số lượng','Các bài/chủ đề sử dụng','Ghi chú'],rows:(state.pl1.equipment||[]).map((x,i)=>[i+1,x.name||'',x.quantity||'',x.scope||x.site||'',x.note||'']),widths:[5,29,9,35,22]});
  blocks.push({type:'paragraph',text:'4. Phòng học bộ môn/phòng đa năng/sân chơi, bãi tập'});
  blocks.push({type:'table',headers:['STT','Tên phòng/không gian','Số lượng','Phạm vi và nội dung sử dụng','Ghi chú'],rows:(state.pl1.facilities||[]).map((x,i)=>[i+1,x.name||'',x.quantity||'',x.scope||x.site||'',x.note||'']),widths:[5,29,9,35,22]});
  blocks.push({type:'heading',text:'II. KẾ HOẠCH DẠY HỌC'});
  blocks.push({type:'paragraph',text:'1. Phân phối chương trình'});
  addSemesterTables(blocks,state);
  blocks.push({type:'paragraph',text:'2. Chuyên đề lựa chọn: Không áp dụng đối với môn Ngữ văn cấp THCS.'});
  blocks.push({type:'paragraph',text:'3. Kiểm tra, đánh giá định kỳ'});
  blocks.push({type:'table',headers:['Bài kiểm tra/đánh giá','Thời gian','Thời điểm','Yêu cầu cần đạt','Hình thức'],rows:(state.assessments||[]).map(a=>[a.name||'',a.duration||'',a.time||a.week||'',a.yccd||'',a.form||'']),widths:[18,10,11,45,16]});
  blocks.push({type:'heading',text:'III. CÁC NỘI DUNG KHÁC (NẾU CÓ)'});
  blocks.push({type:'paragraph',text:state.pl1.otherContents||'........................................................................................................'});
  blocks.push({type:'signature',left:'TỔ TRƯỞNG',right:'HIỆU TRƯỞNG',locality:common.locality});
  return {id:'PL1',title:'Phụ lục I',orientation:'landscape',blocks};
}

function buildPL2(state,common){
  const blocks=baseHeader(common,'KẾ HOẠCH TỔ CHỨC CÁC HOẠT ĐỘNG GIÁO DỤC CỦA TỔ CHUYÊN MÔN');
  blocks.push({type:'table',headers:['STT','Chủ đề','Yêu cầu cần đạt','Số tiết','Thời điểm','Địa điểm','Chủ trì','Phối hợp','Điều kiện thực hiện'],rows:(state.pl2.activities||[]).map((a,i)=>[i+1,a.topic||'',a.yccd||'',a.periods||'',a.time||'',a.location||'',a.lead||'',a.coordinate||'',a.conditions||'']),widths:[4,14,21,6,9,10,10,10,16]});
  blocks.push({type:'signature',left:'TỔ TRƯỞNG',right:'HIỆU TRƯỞNG',locality:common.locality});
  return {id:'PL2',title:'Phụ lục II',orientation:'landscape',blocks};
}

function buildPL3(state,common){
  const blocks=baseHeader(common,'KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN',`MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC: ${common.subject}`);
  blocks[0].left+=`\nHọ và tên giáo viên: ${state.pl3.teacherName||'[CHƯA CUNG CẤP]'}`;
  const assignments=(state.pl3.assignments||[]).filter(a=>a.className||a.site).map(a=>[a.className||`Khối ${a.grade||state.project.grade}`,a.site].filter(Boolean).join(' – '));
  if(assignments.length)blocks.push({type:'paragraph',text:`Lớp được phân công: ${assignments.join('; ')}.`});
  blocks.push({type:'heading',text:'I. KẾ HOẠCH DẠY HỌC'});
  blocks.push({type:'paragraph',text:'1. Phân phối chương trình'});
  addSemesterTables(blocks,state,{forPl3:true});
  blocks.push({type:'paragraph',text:'2. Chuyên đề lựa chọn: Không áp dụng đối với môn Ngữ văn cấp THCS.'});
  blocks.push({type:'heading',text:'II. NHIỆM VỤ KHÁC (NẾU CÓ)'});
  blocks.push({type:'paragraph',text:state.pl3.otherTasks||'........................................................................................................'});
  const formative=state.pl3.formativeAssessments||[];
  if(state.pl3.includeFormativeAssessments||formative.length){
    blocks.push({type:'heading',text:'III. KẾ HOẠCH KIỂM TRA THƯỜNG XUYÊN'});
    blocks.push({type:'table',headers:['Bài/Chủ đề','Năng lực','Tên bài/Nội dung','Yêu cầu cần đạt','Lần','Thời gian','Hình thức','Đối tượng','Công cụ'],rows:formative.map(x=>[x.unit||'',x.competency||'',x.content||'',x.yccd||'',x.attempt||'',x.time||'',x.form||'',x.target||'',x.tool||'']),widths:[13,8,16,25,5,9,8,8,8]});
  }
  blocks.push({type:'signature',left:'TỔ TRƯỞNG',right:'GIÁO VIÊN',locality:common.locality});
  return {id:'PL3',title:'Phụ lục III',orientation:'landscape',blocks};
}

export {semesterOf};
