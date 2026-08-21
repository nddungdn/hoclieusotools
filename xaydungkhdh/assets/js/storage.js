const STORAGE_KEY = 'xaydungkhdh_project_v122';
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
  const raw = localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearLocal(){ localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_STORAGE_KEY); }

export function downloadProject(state) {
  const copy = stripLargeRuntimeData(structuredClone(state));
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `khdh-nguvan${state.project.grade}-${state.project.academicYear}-v122.json`;
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
  return data;
}
