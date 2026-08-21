const STORAGE_KEY = 'xaydungkhdh_project_v123';
const PREVIOUS_STORAGE_KEY = 'xaydungkhdh_project_v122';
const LEGACY_STORAGE_KEY = 'xaydungkhdh_project_v12';

function stripLargeRuntimeData(copy){
  copy.ai = copy.ai || {};
  copy.ai.apiKey = '';
  copy.documents = (copy.documents || []).map(d => ({
    ...d,
    file: undefined,
    parsedText: '',
    pages: undefined
  }));
  if(copy.analysis?.textbook?.chunks){
    copy.analysis.textbook.chunks = copy.analysis.textbook.chunks.map(c => ({...c, text: undefined}));
  }
  if(copy.analysis?.existing?.chunks){
    copy.analysis.existing.chunks = copy.analysis.existing.chunks.map(c => ({...c, text: undefined}));
  }
  return copy;
}

export function projectForStorage(state) {
  return stripLargeRuntimeData(structuredClone(state));
}

export function saveLocal(state) {
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectForStorage(state)));
  }catch(e){
    console.warn('Không thể lưu checkpoint cục bộ:', e?.message || e);
  }
}

export function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY)||localStorage.getItem(PREVIOUS_STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY);
  return raw ? upgradeProject(JSON.parse(raw)) : null;
}

export function clearLocal(){ localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(PREVIOUS_STORAGE_KEY);localStorage.removeItem(LEGACY_STORAGE_KEY); }

export function downloadProject(state) {
  const copy = stripLargeRuntimeData(structuredClone(state));
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `khdh-nguvan${state.project.grade}-${state.project.academicYear}-v123.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importProjectFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !data.project || !data.school) throw new Error('Tệp dự án không hợp lệ.');
  data.ai = data.ai || {};
  data.ai.apiKey = '';
  data.ai.modelInfo = data.ai.modelInfo || null;
  data.documents = (data.documents || []).map(d => ({ ...d, pdfMode:d.pdfMode||(d.scanned?'SCANNED_PDF':null), parsedText: '', pages: undefined, file: undefined }));
  data.analysis = data.analysis || {textbook:{chunks:[],usage:{}},existing:{chunks:[],usage:{}}};
  return upgradeProject(data);
}

function upgradeProject(data){
  if(!data)return data;
  const fromOlderVersion=String(data.version||'')!=='1.2.3-production';
  if(fromOlderVersion&&data.school?.department==='Tổ Ngữ văn')data.school.department='';
  data.pl1=data.pl1||{staff:{},equipment:[],facilities:[]};
  data.pl1.otherContents=data.pl1.otherContents||'';
  data.pl3=data.pl3||{};
  if(fromOlderVersion&&data.pl3.defaultEquipment==='Laptop; Tivi/máy chiếu; Phiếu học tập')data.pl3.defaultEquipment='';
  if(fromOlderVersion&&data.pl3.defaultLocation==='Lớp học')data.pl3.defaultLocation='';
  data.pl3.defaultEquipment=data.pl3.defaultEquipment||'';
  data.pl3.defaultLocation=data.pl3.defaultLocation||'';
  data.pl3.includeFormativeAssessments=!!data.pl3.includeFormativeAssessments;
  data.pl3.formativeAssessments=Array.isArray(data.pl3.formativeAssessments)?data.pl3.formativeAssessments:[];
  data.version='1.2.3-production';
  return data;
}
