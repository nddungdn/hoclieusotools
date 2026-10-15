/* Shared validation for the browser and Worker. No provider credentials or prompts. */
(function (root) {
  'use strict';
  const normalized = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const subtype = value => value === 'mcq' ? 'single' : value;
  function units(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;
    return Math.round(n * 100);
  }
  function hash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let a = 2166136261, b = 5381;
    for (const c of text) { a = Math.imul(a ^ c.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ c.charCodeAt(0); }
    return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${text.length}`;
  }
  function contentHash(q) {
    return hash([q.questionId, q.lessonId, q.form, subtype(q.subtype), q.prompt, q.context || '', q.options || [],
      q.answer, q.distractor, q.optionRationales || [], q.distractorRationale || '']);
  }
  function matrixIssues(matrix = [], lessons = []) {
    const issues = [], ids = new Set(), lessonIds = new Set(lessons.map(l => l.id));
    for (const c of matrix) {
      if (!c.id || ids.has(c.id)) issues.push('Mã cấu hình ma trận bị thiếu hoặc trùng.');
      ids.add(c.id);
      if (!lessonIds.has(c.lessonId)) issues.push(`Cấu hình ${c.id} không thuộc bài đã chọn.`);
      const count = Number(c.count), p = units(c.pointsPerQuestion), total = units(c.total);
      if (!Number.isFinite(count) || count <= 0 || count > 200 || p === null || p <= 0) issues.push(`Số câu/điểm của ${c.id} không hợp lệ.`);
      if (total === null || Math.abs(count * (p ?? 0) - (total ?? 0)) > 1e-6) issues.push(`Tổng điểm ${c.id} không bằng số câu × điểm/câu.`);
      if (!['nb', 'th', 'vd'].includes(c.level) || !['TNKQ', 'TL'].includes(c.form)) issues.push(`Mức độ/dạng của ${c.id} không hợp lệ.`);
      if (c.form === 'TNKQ' && (!Number.isInteger(count) || c.level === 'vd' || !['single','multiple','truefalse','short','matching'].includes(subtype(c.subtype)))) issues.push(`Cấu hình trắc nghiệm ${c.id} không hợp lệ.`);
      if (c.form === 'TL') {
        if (!Number.isInteger(count * 2)) issues.push(`Số câu tự luận ${c.id} phải là bội số của ½.`);
        if (Number(c.partsCount || 1) > 1 && (!Array.isArray(c.partPoints) || c.partPoints.length !== Number(c.partsCount) || c.partPoints.some(x => units(x) === null || units(x) <= 0) || c.partPoints.reduce((s,x) => s + (units(x) ?? 0),0) !== p)) issues.push(`Điểm từng ý của ${c.id} không khớp điểm/câu.`);
      }
    }
    return issues;
  }
  function optionProblem(options) {
    if (!Array.isArray(options) || options.length !== 4 || options.some(x => !String(x || '').trim()) || new Set(options.map(normalized)).size !== 4) return 'Cần bốn phương án có nội dung và không trùng nhau.';
    const words = options.map(x => normalized(x).split(/\s+/).filter(Boolean).length);
    const chars = options.map(x => String(x).replace(/\s+/g,' ').trim().length);
    const lo = Math.min(...words), hi = Math.max(...words), allowed = hi <= 10 ? 3 : Math.max(3, Math.ceil(hi * .25));
    if (hi - lo > allowed || (hi >= 4 && hi - lo >= 2 && hi / Math.max(1,lo) > 1.6) || Math.max(...chars) - Math.min(...chars) > 20 && Math.max(...chars) / Math.max(1,Math.min(...chars)) > 1.5) return `Phương án chưa cân đối về độ dài (${words.join(' – ')} tiếng).`;
    return '';
  }
  function questionIssues(q, configs, { explanations = true, verification = false } = {}) {
    const out = [], add = (category,message) => out.push({category,message});
    const cfg = configs.get(q.configId);
    if (!String(q.prompt || '').trim() && !q.parts?.length) add('Nội dung câu','Câu hỏi thiếu yêu cầu.');
    if (units(q.points) === null || units(q.points) <= 0) add('Điểm câu','Điểm câu không hợp lệ.');
    if (!['TNKQ','TL'].includes(q.form)) add('Cấu trúc đề','Dạng câu không hợp lệ.');
    if (!q.parts?.length || q.form === 'TNKQ') {
      if (!cfg || cfg.lessonId !== q.lessonId || cfg.level !== q.level || cfg.form !== q.form) add('Cấu hình câu','Bài, mức độ hoặc dạng câu không khớp ma trận.');
      if (cfg && q.form === 'TNKQ' && (subtype(cfg.subtype) !== subtype(q.subtype) || units(q.points) !== units(cfg.pointsPerQuestion))) add('Cấu hình câu','Dạng/điểm câu trắc nghiệm không khớp ma trận.');
    }
    if (q.form === 'TNKQ' && ['single','multiple'].includes(subtype(q.subtype))) {
      const problem = optionProblem(q.options);
      if (problem) add('Phương án',problem);
      const answers = subtype(q.subtype) === 'multiple' ? q.answer : [q.answer];
      if (!Array.isArray(answers) || !answers.length || answers.some(x => !/^[A-D]$/.test(String(x))) || new Set(answers).size !== answers.length || subtype(q.subtype) === 'multiple' && (answers.length < 2 || answers.length > 3)) add('Đáp án','Đáp án chưa đúng cấu trúc hoặc không còn phương án sai.');
      if (!/^[A-D]$/.test(String(q.distractor || '')) || Array.isArray(answers) && answers.includes(q.distractor)) add('Phương án nhiễu','Nhiễu phải là một phương án sai khác đáp án đúng.');
      if (explanations && (!Array.isArray(q.optionRationales) || q.optionRationales.length !== 4 || q.optionRationales.some(x => String(x || '').trim().length < 8) || String(q.distractorRationale || '').trim().length < 12)) add('Giải thích phương án','Cần giải thích từng phương án và nhầm lẫn mà nhiễu gần khai thác.');
      if (verification && (q.verification?.status !== 'passed' || q.verification?.contentHash !== contentHash(q))) add('Thẩm định câu','Câu lựa chọn chưa vượt qua lượt thẩm định nội dung sau lần sửa cuối.');
    }
    if (q.form === 'TNKQ' && q.subtype === 'truefalse') {
      if (!Array.isArray(q.statements) || q.statements.length !== 4 || q.statements.some(s => !String(typeof s === 'string' ? s : s?.text || '').trim())) add('Đúng/Sai','Cần bốn nhận định có nội dung.');
      const values = Array.isArray(q.answer) ? q.answer : q.answer && typeof q.answer === 'object' ? Object.values(q.answer) : [];
      if (values.length !== 4 || values.some(x => ![true,false,'Đúng','Sai','Đ','S','D','S','true','false'].includes(x))) add('Đáp án','Đáp án Đúng/Sai phải xác định đủ bốn nhận định.');
    }
    if (q.form === 'TNKQ' && q.subtype === 'short' && !String(q.answer ?? '').trim()) add('Đáp án','Câu trả lời ngắn thiếu đáp án.');
    if (q.form === 'TNKQ' && q.subtype === 'matching' && (!q.pairsLeft?.length || !q.pairsRight?.length || !q.answer || typeof q.answer !== 'object')) add('Đáp án','Câu nối thiếu hai cột hoặc khóa ghép.');
    if (q.form === 'TL' && q.parts?.length) {
      if (q.parts.reduce((s,p) => s + (units(p.points) ?? -100000),0) !== units(q.points)) add('Điểm các ý','Tổng điểm các ý không bằng điểm câu.');
      q.parts.forEach(p => { const c = configs.get(p.configId); if (!c || c.form !== 'TL' || c.lessonId !== q.lessonId || c.level !== p.level) add('Cấu hình câu','Ý tự luận không khớp bài/mức độ trong ma trận.'); });
    }
    return out;
  }
  function usageByConfig(code, configs) {
    const usage = new Map();
    const add = (id,count,points) => {const old = usage.get(id) || {count:0,points:0}; old.count += count; old.points += units(points) ?? -100000; usage.set(id,old);};
    for (const q of code.questions || []) {
      if (q.form === 'TL' && q.parts?.length) {
        const groups = new Map();
        q.parts.forEach(p => {if (!groups.has(p.configId)) groups.set(p.configId,[]); groups.get(p.configId).push(p);});
        for (const [id,parts] of groups) {
          const c = configs.get(id);
          const count = parts.every(p => p.matrixCount != null) ? parts.reduce((s,p) => s + Number(p.matrixCount),0) : groups.size === 1 && Number(c?.partsCount || 1) === parts.length ? 1 : parts.length * .5;
          add(id,count,parts.reduce((s,p) => s + Number(p.points || 0),0));
        }
      } else add(q.configId,Number(q.matrixCount ?? 1),q.points);
    }
    return usage;
  }
  function examIssues(exam,payload,options = {}) {
    const out = [], configs = new Map((payload.matrix || []).map(c => [c.id,c]));
    const wanted = Math.max(1,Math.min(2,Number(payload.setup?.examCodes || 1)));
    if (!Array.isArray(exam?.examCodes) || exam.examCodes.length !== wanted) out.push({category:'Số mã đề',message:`Cần đủ ${wanted} mã đề.`});
    for (const [ci,code] of (exam?.examCodes || []).entries()) {
      const stems = new Set(), ids = new Set();
      let sum = 0;
      for (const [qi,q] of (code.questions || []).entries()) {
        const base = {severity:'block',code:code.code,codeIndex:ci,questionNumber:q.number || qi+1,questionIndex:qi};
        out.push(...questionIssues(q,configs,options).map(x => ({...base,...x})));
        const stem = normalized([q.lessonId,q.context,q.prompt,...(q.parts || []).map(p => p.prompt),...(q.statements || []).map(s => s.text || s)].join(' '));
        if (stems.has(stem) || q.questionId && ids.has(q.questionId)) out.push({...base,category:'Câu trùng',message:'Câu hỏi bị trùng nội dung hoặc mã vị trí.'});
        stems.add(stem); if (q.questionId) ids.add(q.questionId);
        sum += units(q.points) ?? -100000;
      }
      const expected = (payload.matrix || []).reduce((s,c) => s + (units(c.total) ?? -100000),0);
      if (sum !== expected) out.push({severity:'block',category:'Tổng điểm',code:code.code,codeIndex:ci,message:`Tổng điểm đề ${sum/100} không bằng ${expected/100}.`});
      const usage = usageByConfig(code,configs);
      for (const c of payload.matrix || []) {
        const got = usage.get(c.id) || {count:0,points:0};
        if (Math.abs(got.count - Number(c.count)) > 1e-8 || got.points !== units(c.total)) out.push({severity:'block',category:'Số câu/điểm cấu hình',code:code.code,codeIndex:ci,message:`${c.lessonTitle || c.lessonId} · ${c.id}: nhận ${got.count}/${c.count} câu, ${got.points/100}/${c.total} điểm.`});
      }
    }
    return out;
  }
  root.GDCD_RELIABILITY = {units,hash,contentHash,normalized,subtype,matrixIssues,optionProblem,questionIssues,usageByConfig,examIssues};
})(globalThis);
