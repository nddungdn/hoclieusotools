import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { __test } from '../index.js';

function essay(id, level, count, points, extra = {}) {
  return { id, lessonId: 'gdcd8_b02', lessonTitle: 'Tôn trọng sự đa dạng của các dân tộc',
    level, levelName: level, form: 'TL', subtype: 'essay', essayType: 'direct',
    partsCount: 1, partPoints: [points], count, pointsPerQuestion: points, total: count * points, ...extra };
}
function payloadFor(matrix) {
  return { setup: { grade: '8', examCodes: 2 },
    lessons: [...new Set(matrix.map(x => x.lessonId))].map(id => ({ id, title: id, descriptor: {} })), matrix };
}
const env = {
  SYSTEM_PROMPT_A: 'A', SYSTEM_PROMPT_B: 'B', SYSTEM_PROMPT_C: 'C',
  AI: { async run(model, input) {
    const payload = JSON.parse(input.messages[1].content.slice(input.messages[1].content.indexOf('{')));
    const cfg = payload.matrix[0];
    // Deliberately wrong AI scores and IDs must not change the teacher's matrix.
    return { response: { examCodes: [{ code: 'A', questions: [{
      form: 'TL', configId: 'wrong', level: 'wrong', points: 9,
      context: cfg.essayType === 'situation' ? `Tình huống riêng ${cfg.id}.` : '',
      prompt: `Yêu cầu ${cfg.id} ${cfg.count}`,
      parts: [{ label: 'a', prompt: `Nêu cách ứng xử ${cfg.id}.`, answer: `Đáp án ${cfg.id}.`,
        points: 9, rubric: [{ content: 'Tôn trọng sự khác biệt.', points: 9 }] }],
    }] }] } };
  } }
};
async function post(path, body) {
  const response = await worker.fetch(new Request(`https://example.com/api/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), env);
  const data = await response.json();
  assert.equal(response.status, 200, data.error);
  return data;
}
async function generate(matrix) {
  const payload = payloadFor(matrix);
  const plan = await post('generation-plan', { payload });
  const questions = [];
  for (let chunkIndex = 0; chunkIndex < plan.totalChunks; chunkIndex++) {
    const chunk = await post('generate-chunk', { provider: 'cloudflare', payload, chunkIndex });
    questions.push(...chunk.questions);
  }
  const final = await post('finalize-generation', { payload, questions });
  for (const code of final.examCodes) {
    assert.equal(code.questions.reduce((sum, q) => sum + q.points, 0), 10);
    const contributions = new Map();
    for (const q of code.questions) for (const p of q.parts?.length ? q.parts : [q]) {
      contributions.set(p.configId, (contributions.get(p.configId) || 0) + p.points);
      assert.equal(p.rubric.reduce((sum, r) => sum + r.points, 0), p.points);
    }
    for (const cfg of matrix) assert.equal(contributions.get(cfg.id), cfg.total, cfg.id);
  }
  // Repeated normalization/finalization must not double the half-question scores.
  const again = await post('finalize-generation', { payload, questions: final.examCodes[0].questions });
  assert.deepEqual(again.examCodes, final.examCodes);
  return { plan, final };
}

test('lỗi 0,5 câu trong ảnh: tạo từng ý, ghép khác mức độ, đủ 10 điểm ở cả hai mã', async () => {
  const { plan, final } = await generate([
    essay('whole', 'nb', 3, 2),
    essay('gdcd8_b02_th_tl_0', 'th', 0.5, 2),
    essay('gdcd8_b02_vd_tl_0', 'vd', 0.5, 6),
  ]);
  assert.equal(plan.totalChunks, 5);
  assert.equal(final.examCodes[0].questions.length, 4);
  const merged = final.examCodes[0].questions.at(-1);
  assert.deepEqual(merged.parts.map(p => [p.level, p.points]), [['th', 1], ['vd', 3]]);
});

test('1½ câu được tách 1 câu và ½ câu, giữ đúng điểm khi ghép với cấu hình khác', async () => {
  const { plan, final } = await generate([essay('one-and-half', 'th', 1.5, 4), essay('half', 'vd', 0.5, 8)]);
  assert.equal(plan.totalChunks, 3);
  assert.deepEqual(final.examCodes[0].questions.map(q => q.points), [4, 6]);
  assert.deepEqual(final.examCodes[0].questions[1].parts.map(p => p.points), [2, 4]);
});

test('nửa câu không có ý cùng bài để ghép vẫn giữ nội dung và điểm', async () => {
  const { final } = await generate([
    essay('whole', 'nb', 1, 5),
    essay('half-a', 'th', 0.5, 4),
    essay('half-b', 'vd', 0.5, 6, { lessonId: 'gdcd8_b03' }),
  ]);
  assert.equal(final.examCodes[0].questions.length, 3);
  assert.deepEqual(final.examCodes[0].questions.map(q => q.points), [5, 2, 3]);
});

test('ghép hai nửa câu tình huống không làm mất bối cảnh riêng', async () => {
  const { final } = await generate([
    essay('whole', 'nb', 1, 5),
    essay('half-a', 'th', 0.5, 4, { essayType: 'situation' }),
    essay('half-b', 'vd', 0.5, 6, { essayType: 'situation' }),
  ]);
  const q = final.examCodes[0].questions.at(-1);
  assert.match(q.context, /Tình huống riêng half-a/);
  assert.match(q.context, /Tình huống riêng half-b/);
  assert.equal(q.parts.length, 2);
});

test('không ghép câu trực tiếp và câu tình huống', async () => {
  const { final } = await generate([
    essay('whole', 'nb', 1, 5), essay('half-a', 'th', 0.5, 4),
    essay('half-b', 'vd', 0.5, 6, { essayType: 'situation' }),
  ]);
  assert.equal(final.examCodes[0].questions.length, 3);
});

test('chuẩn hóa câu ½ có một phần từ đường tạo đề cũ không nhân đôi điểm', () => {
  const cfg = essay('half', 'th', 0.5, 2);
  const result = __test.normalizeScoresFromMatrix({ examCodes: [{ code: 'A', questions: [{
    form: 'TL', lessonId: cfg.lessonId, configId: cfg.id, points: 2,
    parts: [{ configId: cfg.id, level: 'th', points: 2, prompt: 'Câu hỏi', answer: 'Đáp án', rubric: [{ content: 'Ý đúng', points: 2 }] }],
  }] }] }, payloadFor([cfg]));
  assert.equal(result.examCodes[0].questions[0].points, 1);
  assert.equal(result.examCodes[0].questions[0].matrixCount, 0.5);
});

test('không tự làm tròn 0,25 câu tự luận hoặc 0,5 câu trắc nghiệm', () => {
  assert.throws(() => __test.generationSteps(payloadFor([essay('quarter', 'th', 0.25, 4)])), /bội số của 0,5/);
  assert.throws(() => __test.generationSteps(payloadFor([essay('tn-half', 'th', 0.5, 4, { form: 'TNKQ' })])), /TNKQ/);
});
