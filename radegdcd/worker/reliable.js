import '../reliability.js';
const R = globalThis.GDCD_RELIABILITY;
export const PIPELINE_VERSION = '2.5.9';
export function aiError(code,message,extra = {}) {return Object.assign(new Error(message),{code,...extra});}
export function generationSchema(payload) {
  const task = payload._task || 'generate';
  const str = {type:'string'}, arr = (items,n) => ({type:'array',items,...(n == null ? {} : {minItems:n,maxItems:n})});
  const obj = (properties,required = Object.keys(properties)) => ({type:'object',properties,required});
  if (task === 'verify') return obj({results:arr(obj({questionId:str,passed:{type:'boolean'},correctAnswers:arr(str),unambiguous:{type:'boolean'},distractorPlausible:{type:'boolean'},reason:str}),payload.questions.length)});
  if (task !== 'generate' || !payload.requestedSlots?.length) return null;
  const cfg = payload.matrix[0], count = payload.requestedSlots.length;
  const properties = {questionId:{type:'string',enum:payload.requestedSlots.map(x => x.questionId)},prompt:str,context:str};
  if (cfg.form === 'TNKQ') {
    if (['single','mcq','multiple'].includes(cfg.subtype)) Object.assign(properties,{
      options:arr(str,4),answer:cfg.subtype === 'multiple' ? {type:'array',items:{type:'string',enum:['A','B','C','D']},minItems:2,maxItems:3} : {type:'string',enum:['A','B','C','D']},
      distractor:{type:'string',enum:['A','B','C','D']},optionRationales:arr(str,4),distractorRationale:str
    });
    else if (cfg.subtype === 'truefalse') Object.assign(properties,{statements:arr(obj({label:str,text:str}),4),answer:arr({type:'boolean'},4)});
    else if (cfg.subtype === 'matching') Object.assign(properties,{pairsLeft:arr(str,4),pairsRight:arr(str,4),answer:obj(Object.fromEntries(['1','2','3','4'].map(k => [k,{type:'string',enum:['A','B','C','D']}])))});
    else properties.answer = str;
  } else {
    const rubric = arr(obj({content:str,points:{type:'number'}}));
    if (Number(cfg.partsCount || 1) > 1) properties.parts = arr(obj({label:str,prompt:str,answer:str,rubric}),Number(cfg.partsCount));
    else Object.assign(properties,{answer:str,rubric});
  }
  return obj({examCodes:arr(obj({code:{type:'string',enum:['A']},questions:arr(obj(properties),count)}),1)});
}
export function googleConfig(model,payload,maxTokens) {
  const config = {responseMimeType:'application/json',maxOutputTokens:maxTokens};
  const schema = generationSchema(payload); if (schema) config.responseSchema = schema;
  // Sampling controls differ between model families. Keep defaults on Gemini 3+.
  if (/^gemini-[12]\./.test(model)) config.temperature = .2;
  if (/^gemini-2\.5-(flash|flash-lite)(?:-|$)/.test(model)) config.thinkingConfig = {thinkingBudget:payload._task === 'verify' ? 512 : 0};
  if (/^gemini-3/.test(model)) config.thinkingConfig = {thinkingLevel:'low'};
  return config;
}
export function googleText(data) {
  const candidate = data?.candidates?.[0], finish = String(candidate?.finishReason || '');
  if (data?.promptFeedback?.blockReason) throw aiError('AI_BLOCKED','Yêu cầu bị dịch vụ AI chặn; hãy kiểm tra nội dung câu hỏi.',{httpStatus:422});
  if (finish === 'MAX_TOKENS') throw aiError('AI_TRUNCATED','Đầu ra AI bị cắt do giới hạn token; hệ thống sẽ chia nhỏ phần chưa hoàn tất.',{httpStatus:422,usage:data.usageMetadata || {}});
  if (finish && !['STOP','FINISH_REASON_UNSPECIFIED'].includes(finish)) throw aiError('AI_BLOCKED',`AI chưa hoàn tất nội dung (${finish}). Hãy kiểm tra lại phạm vi câu hỏi.`,{httpStatus:422});
  return (candidate?.content?.parts || []).filter(p => p.thought !== true).map(p => p.text || '').join('');
}
export function classifyGoogleError(error,data = {}) {
  const details = data.error?.details || [];
  const quota = details.flatMap(d => d.violations || []);
  if (Number(error.httpStatus) === 429) {
    error.quotaKind = quota.some(x => /perday|per_day|daily/i.test(`${x.quotaId} ${x.quotaMetric}`)) ? 'day' : quota.length ? 'minute' : 'capacity';
    error.code = error.quotaKind === 'day' ? 'GOOGLE_DAILY_LIMIT' : 'GOOGLE_RATE_LIMIT';
    if (error.quotaKind === 'day') error.message = 'Dự án Gemini đã hết hạn mức ngày. Tiến độ được giữ lại; có thể tiếp tục sau khi hạn mức được đặt lại hoặc chọn dịch vụ dự phòng.';
  }
  return error;
}
export async function fetchWithDeadline(url,options,ms = 75000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(),ms);
  try {const response = await fetch(url,{...options,signal:controller.signal});const text = await response.text();return {response,text};}
  catch (error) {if (error.name === 'AbortError') throw aiError('AI_TIMEOUT','Dịch vụ AI vượt thời gian xử lí một nhóm câu. Tiến độ trước đó được giữ lại.',{httpStatus:504}); throw error;}
  finally {clearTimeout(timer);}
}
export async function hydrateSources(payload,env) {
  if (env.LESSON_SOURCE_KV?.get) {
    for (const lesson of payload.lessons) {
      const value = await env.LESSON_SOURCE_KV.get(`lesson:${lesson.id}`,{type:'json'});
      if (value) payload.source[lesson.id] = value;
    }
  }
  return payload;
}
export function addSlotIds(steps) {
  const offsets = new Map();
  return steps.map((item,index) => {
    const offset = offsets.get(item.cfg.id) || 0;
    const slots = Array.from({length:item.count},(_,i) => ({questionId:`${item.cfg.id}::${offset+i+1}`,configId:item.cfg.id}));
    offsets.set(item.cfg.id,offset+item.count);
    return {...item,index,slots};
  });
}
export const questionKey = q => R.normalized([q.lessonId,q.context,q.prompt,...(q.parts || []).map(p => p.prompt),...(q.statements || []).map(s => s.text || s)].join(' '));
export function lockQuestion(raw,item,slot) {
  const q = JSON.parse(JSON.stringify(raw));
  delete q.verification;
  Object.assign(q,{questionId:slot.questionId,configId:item.cfg.id,lessonId:item.cfg.lessonId,level:item.cfg.level,form:item.form,
    subtype:item.form === 'TL' ? 'essay' : R.subtype(item.cfg.subtype),points:item.cfg.pointsPerQuestion,
    ...(item.form === 'TL' ? {essayType:item.cfg.essayType || 'direct',matrixCount:Number(item.payload.matrix[0].count) === .5 ? .5 : 1} : {})});
  if (item.form === 'TL' && q.parts?.length) q.parts = q.parts.map((p,i) => ({...p,configId:item.cfg.id,level:item.cfg.level,label:String.fromCharCode(97+i)}));
  return q;
}
export async function verifyChoices(questions,payload,run) {
  const choices = questions.filter(q => q.form === 'TNKQ' && ['single','multiple'].includes(q.subtype));
  if (!choices.length) return {passed:questions,issues:[]};
  const prompt = `Bạn là người thẩm định độc lập câu hỏi GDCD THCS. Dựa trên học liệu/đặc tả được cung cấp, tự xác định đáp án trước khi đối chiếu khóa. Kiểm tra tính đúng, đúng mức độ và duy nhất đáp án đúng nhất (hoặc tập đáp án với câu nhiều lựa chọn). Cả ba phương án sai phải hợp lí; ít nhất một nhiễu khai thác nhầm lẫn kiến thức thật, không chỉ gần chữ. Kiểm tra diễn đạt, tính song song, độ dài và không gợi lộ đáp án. Nếu thiếu căn cứ hoặc có hai đáp án cùng đúng thì passed=false. Mỗi kết quả phải có questionId, passed, correctAnswers là mảng chữ cái, unambiguous, distractorPlausible, reason giải thích cụ thể. Không mặc nhiên tin các lí giải do người viết câu tự khai.`;
  const lessonIds=new Set(choices.map(q=>q.lessonId));
  const result = await run(prompt,{_task:'verify',questions:choices,lessons:payload.lessons.filter(l=>lessonIds.has(l.id)),source:Object.fromEntries(Object.entries(payload.source||{}).filter(([id])=>lessonIds.has(id)))},Math.min(5000,1000+choices.length*700),'verify');
  const rows = result.data?.results;
  if (!Array.isArray(rows)) throw aiError('AI_REVIEW_INVALID','Lượt thẩm định chưa trả đủ kết quả theo từng câu.',{httpStatus:422});
  const passed = [], issues = [];
  for (const q of questions) {
    if (!choices.includes(q)) {passed.push(q);continue;}
    const matches = rows.filter(x => x.questionId === q.questionId), row = matches[0];
    const answer = (Array.isArray(q.answer) ? q.answer : [q.answer]).slice().sort();
    const sameAnswer = Array.isArray(row?.correctAnswers) && JSON.stringify(row.correctAnswers.slice().sort()) === JSON.stringify(answer);
    if (matches.length === 1 && row.passed === true && row.unambiguous === true && row.distractorPlausible === true && sameAnswer && String(row.reason || '').trim().length >= 12) {
      q.verification = {status:'passed',contentHash:R.contentHash(q),model:result.resolved?.model || '',scope:payload.source?.[q.lessonId] ? 'learning-source' : 'descriptor',reason:String(row.reason).slice(0,1200)};
      passed.push(q);
    } else issues.push({questionId:q.questionId,category:'Thẩm định câu',message:String(row?.reason || 'Chưa đủ kết quả thẩm định, khóa đáp án không thống nhất hoặc nhiễu chưa đạt.').slice(0,1200)});
  }
  return {passed,issues};
}
export async function generateReliableChunk({item,payload,accepted = [],pending = [],previous = [],feedback = '',systemPrompt,run,normalize,validate}) {
  const slotMap = new Map(item.slots.map(s => [s.questionId,s]));
  const kept = new Map(), candidates = new Map(), issues = [], signatures = new Set(previous.map(questionKey));
  const configs = new Map(item.payload.matrix.map(c => [c.id,c]));
  function ingest(rows,isPending = false) {
    for (const raw of rows) {
      const slot = slotMap.get(raw?.questionId); if (!slot || kept.has(slot.questionId) || candidates.has(slot.questionId)) continue;
      const locked = normalize({examCodes:[{code:'A',questions:[lockQuestion(raw,item,slot)]}]},item.payload).examCodes[0]?.questions[0];
      if (!locked) continue;
      const key = questionKey(locked);
      const bad = R.questionIssues(locked,configs,{explanations:true});
      if (!bad.length) {try {validate({examCodes:[{code:'A',questions:[locked]}]},{...item.payload,matrix:[{...item.payload.matrix[0],count:locked.matrixCount || 1,total:locked.points}],setup:{...payload.setup,examCodes:1}},{softQuestionQuality:false});} catch(e) {bad.push({category:'Cấu trúc câu',message:e.message});}}
      if (signatures.has(key)) bad.push({category:'Câu trùng',message:'Câu hỏi bị lặp trong nhóm.'});
      if (bad.length) {issues.push(...bad.map(x => ({questionId:slot.questionId,...x})));continue;}
      signatures.add(key);
      if (!isPending && (!['single','multiple'].includes(locked.subtype) || raw.verification?.status === 'passed' && raw.verification.contentHash === R.contentHash(locked))) {locked.verification=raw.verification;kept.set(slot.questionId,locked);}
      else candidates.set(slot.questionId,locked);
    }
  }
  ingest(accepted); ingest(pending,true);
  const missing = item.slots.filter(s => !kept.has(s.questionId) && !candidates.has(s.questionId));
  if (missing.length) {
    const work = JSON.parse(JSON.stringify(item.payload));
    work.requestedSlots = missing;
    work._task = 'generate';
    work.matrix[0].count = Number(item.payload.matrix[0].count) === .5 ? .5 : missing.length;
    work.matrix[0].total = Math.round(work.matrix[0].count * item.cfg.pointsPerQuestion * 100)/100;
    work.setup.extraNotes += `\nLƯỢT NÀY CHỈ ĐIỀN ${missing.length} VỊ TRÍ: ${missing.map(s => s.questionId).join(', ')}. Không thêm câu ngoài danh sách. Không tạo lại các câu đã đạt. ${feedback}\nCÂU ĐÃ CÓ, KHÔNG LẶP: ${[...previous,...kept.values(),...candidates.values()].map(q => `${q.context || ''} ${q.prompt || ''}`).join(' | ')}\nVới câu lựa chọn: trả optionRationales gồm bốn lí giải đúng/sai theo thứ tự phương án, distractorRationale nêu nhầm lẫn cụ thể và dấu hiệu làm nhiễu sai. Mọi phương án phải có vẻ hợp lí; không dùng nhiễu vô lí/khác chủ đề. Không nhắc chữ A/B/C/D trong các lí giải vì hệ thống có thể hoán vị.`;
    work.setup.extraNotes += `\nĐÂY LÀ NHÓM CÂU, KHÔNG PHẢI TOÀN ĐỀ: lượt này đúng ${work.matrix[0].count} câu và ${work.matrix[0].total} điểm theo matrix hiện tại. Quy tắc tổng 10 điểm chỉ áp dụng khi ghép toàn đề; không áp dụng cho lượt này. Thông tin lượt này thay thế số câu/điểm của các lượt trước.`;
    try {
      let rows;
      const tokenBudget = item.form === 'TL' ? Math.min(6500,2600+Number(item.cfg.partsCount||1)*900) : Math.min(6500,2200+missing.length*1100);
      try {
        const generated = await run(systemPrompt,work,tokenBudget,'generate');
        rows = generated.data?.examCodes?.[0]?.questions || [];
      } catch(error) {
        // A truncated group is retried as one slot, without replaying accepted groups.
        if (error.code !== 'AI_TRUNCATED' || missing.length < 2 && tokenBudget >= 6500) throw error;
        if(missing.length>1){
          work.requestedSlots = [missing[0]];work.matrix[0].count=1;work.matrix[0].total=item.cfg.pointsPerQuestion;
          work.setup.extraNotes += `\nCHIA NHỎ TIẾP: chỉ viết MỘT vị trí ${missing[0].questionId}, ${item.cfg.pointsPerQuestion} điểm. Danh sách vị trí và số câu của lượt trước đã được thay thế.`;
        }
        work.setup.extraNotes += '\nViết ngắn gọn nhưng đủ ý; không lặp câu dẫn và hướng dẫn chung trong đáp án.';
        const generated = await run(systemPrompt,work,6500,'generate');
        rows = generated.data?.examCodes?.[0]?.questions || [];
      }
      const used = new Set();
      const bound = rows.map((q,i) => {
        const id = q.questionId || work.requestedSlots[i]?.questionId;
        if (!work.requestedSlots.some(s => s.questionId === id) || used.has(id)) return null;
        used.add(id); return {...q,questionId:id};
      }).filter(Boolean);
      ingest(bound,true);
    } catch(error) {error.partialQuestions=[...kept.values()];error.pendingQuestions=[...candidates.values()];throw error;}
  }
  if (candidates.size) {
    try {const checked = await verifyChoices([...candidates.values()],payload,run);checked.passed.forEach(q => kept.set(q.questionId,q));issues.push(...checked.issues);}
    catch(error) {error.partialQuestions=[...kept.values()];error.pendingQuestions=[...candidates.values()];throw error;}
  }
  return {questions:item.slots.map(s => kept.get(s.questionId)).filter(Boolean),missingSlots:item.slots.filter(s => !kept.has(s.questionId)).map(s => s.questionId),issues};
}
