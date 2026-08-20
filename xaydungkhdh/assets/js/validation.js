const KNOWN_NLS_CODES = new Set([
  '1.1.TC1b','1.1.TC1c','1.1.TC2b','1.1.TC2c','1.2.TC2a','1.2.TC2b',
  '2.1.TC2b','2.2.TC1c','2.2.TC2c','2.4.TC2a','2.5.TC2a','2.5.TC2b',
  '3.1.TC1a','3.1.TC1b','3.1.TC2a','3.1.TC2b','3.2.TC1a','3.2.TC2a',
  '3.3.TC1a','3.3.TC2a','4.2.TC1b','5.4.TC2a'
]);

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }

export function validateState(state) {
  const errors=[], warnings=[], passed=[];
  const curriculum=state.curriculum||[];
  const expected=n(state.project.totalPeriods);
  const sum=curriculum.reduce((a,r)=>a+n(r.periodCount || inferCount(r)),0);
  if (!curriculum.length) errors.push('Chưa có phân phối chương trình.');
  else if (expected && sum!==expected) errors.push(`Tổng số tiết PPCT là ${sum}, chưa khớp ${expected} tiết/năm.`);
  else if (curriculum.length) passed.push(`Tổng số tiết PPCT: ${sum}/${expected || sum}.`);

  const missingLesson=curriculum.filter(r=>!(r.lesson||r.content||r.unit)).length;
  if (missingLesson) errors.push(`${missingLesson} dòng PPCT chưa có tên bài/nội dung.`);

  const nlsCodes=[];
  for (const row of curriculum) {
    const list=Array.isArray(row.digitalCompetency)?row.digitalCompetency:[row.nls].filter(Boolean);
    for (const item of list) {
      const code=typeof item==='string' ? (item.match(/\d+\.\d+\.TC[12][a-z]/i)||[])[0] : item?.code;
      if (code) nlsCodes.push(code);
    }
  }
  const unknown=[...new Set(nlsCodes.filter(c=>!KNOWN_NLS_CODES.has(c)))];
  if (unknown.length) warnings.push(`Có mã NLS chưa nằm trong bộ mã Ngữ văn đã nạp sẵn: ${unknown.join(', ')}. Cần đối chiếu bảng mã chính thức trước khi xác nhận.`);
  else if (nlsCodes.length) passed.push(`Đã kiểm tra ${nlsCodes.length} lượt mã NLS trong bộ mã đã nạp.`);

  const sites=state.school.sites||[];
  const siteClasses=sites.reduce((a,s)=>a+n(s.classCount),0);
  const siteStudents=sites.reduce((a,s)=>a+n(s.studentCount),0);
  if (state.school.organizationMode==='multi') {
    if (state.school.totalClassesManual && n(state.school.totalClassesManual)!==siteClasses) warnings.push(`Tổng số lớp nhập tay (${state.school.totalClassesManual}) khác tổng tại các cơ sở (${siteClasses}).`);
    if (state.school.totalStudentsManual && n(state.school.totalStudentsManual)!==siteStudents) warnings.push(`Tổng số học sinh nhập tay (${state.school.totalStudentsManual}) khác tổng tại các cơ sở (${siteStudents}).`);
  }

  const st=state.pl1.staff||{};
  const degree=n(st.college)+n(st.university)+n(st.postgraduate);
  if (st.total && degree && n(st.total)!==degree) warnings.push(`Tổng giáo viên (${st.total}) chưa khớp tổng theo trình độ (${degree}).`);
  const rating=n(st.good)+n(st.fair)+n(st.pass)+n(st.fail);
  if (st.total && rating && n(st.total)!==rating) warnings.push(`Tổng giáo viên (${st.total}) chưa khớp tổng theo chuẩn nghề nghiệp (${rating}).`);

  if (!state.school.officialName) warnings.push('Chưa nhập tên trường.');
  if (state.appendices.pl3 && !state.pl3.teacherName) warnings.push('Phụ lục III chưa có họ tên giáo viên.');
  if (state.appendices.pl2 && !(state.pl2.activities||[]).length) warnings.push('Phụ lục II chưa có hoạt động giáo dục; nếu không có hoạt động, cần xác nhận trước khi xuất.');

  if (state.meta.curriculumSource==='AI_DRAFT') warnings.push('PPCT đang ở trạng thái dự thảo do AI đề xuất; cần giáo viên/tổ chuyên môn rà soát.');

  if (!errors.length) passed.push('Không phát hiện lỗi đỏ trong các kiểm tra hiện tại.');
  state.validation={errors,warnings,passed};
  return state.validation;
}

function inferCount(row){
  const a=n(row.periodStart), b=n(row.periodEnd);
  return a && b && b>=a ? b-a+1 : 0;
}

export function knownNlsCodes(){ return [...KNOWN_NLS_CODES]; }
