import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { __test } from '../index.js';

const payload = {
  setup: { examCodes: 2 },
  lessons: [{ id: 'lesson-1', number: 1, title: 'Bài kiểm tra', descriptor: {} }],
  matrix: [{ id: 'cfg-1', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'nb', levelName: 'Nhận biết', form: 'TNKQ', subtype: 'single', count: 1, pointsPerQuestion: 10, total: 10 }]
};
const question = {
  configId: 'cfg-1', lessonId: 'lesson-1', level: 'nb', form: 'TNKQ', subtype: 'single', points: 10,
  prompt: 'Em nên làm gì?', answer: 'A', distractor: 'B',
  options: ['Giữ gìn tài sản chung', 'Làm hỏng tài sản chung', 'Lãng phí tài sản chung', 'Bỏ mặc tài sản chung']
};
const env = {
  SYSTEM_PROMPT_A: 'A', SYSTEM_PROMPT_B: 'B', SYSTEM_PROMPT_C: 'C',
  AI: { async run() { return { response: { examCodes: [{ code: 'A', questions: [question] }] } }; } }
};
async function post(path, body) {
  const response = await worker.fetch(new Request(`https://example.com${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), env);
  return { status: response.status, data: await response.json() };
}

test('mỗi phần tạo đề có thể gọi và nhận riêng', async () => {
  const plan = await post('/api/generation-plan', { payload });
  assert.equal(plan.status, 200);
  assert.equal(plan.data.totalChunks, 1);
  const chunk = await post('/api/generate-chunk', { payload, chunkIndex: 0, provider: 'cloudflare' });
  assert.equal(chunk.status, 200, chunk.data.error);
  assert.equal(chunk.data.questions.length, 1);
  assert.equal(chunk.data.aiMeta.workerVersion, '2.5.7');
  const final = await post('/api/finalize-generation', { payload, questions: chunk.data.questions, chunkMeta: [chunk.data.aiMeta] });
  assert.equal(final.status, 200, final.data.error);
  assert.equal(final.data.examCodes.length, 2);
  assert.equal(final.data.examCodes[0].questions.length, 1);
});

test('phần không hợp lệ bị từ chối trước khi gọi AI', async () => {
  const result = await post('/api/generate-chunk', { payload, chunkIndex: 1, provider: 'cloudflare' });
  assert.equal(result.status, 400);
});

test('Worker từ chối phương án trùng và lệch độ dài', () => {
  assert.equal(__test.choiceLengthsBalanced(question.options), true);
  assert.equal(__test.choiceLengthsBalanced(['Một cách ứng xử', 'Một cách ứng xử', 'Một cách hành xử', 'Một cách giải quyết']), false);
  assert.equal(__test.choiceLengthsBalanced(['Giữ tài sản', 'Làm hỏng tài sản', 'Giữ gìn mọi tài sản của trường một cách rất cẩn thận', 'Bảo vệ tài sản']), false);
});

test('phần tự luận 7 điểm được chia nhỏ để không lặp lỗi chỉ nhận 1 điểm', () => {
  const mixedPayload = {
    setup: { examCodes: 1 },
    lessons: [{ id: 'lesson-1', number: 1, title: 'Bài kiểm tra', descriptor: {} }],
    matrix: [
      { id: 'tn-1', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'nb', levelName: 'Nhận biết', form: 'TNKQ', subtype: 'single', count: 3, pointsPerQuestion: 1, total: 3 },
      { id: 'tl-1', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'nb', levelName: 'Nhận biết', form: 'TL', subtype: 'essay', essayType: 'direct', partsCount: 1, partPoints: [1], count: 1, pointsPerQuestion: 1, total: 1 },
      { id: 'tl-2', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'th', levelName: 'Thông hiểu', form: 'TL', subtype: 'essay', essayType: 'direct', partsCount: 1, partPoints: [2], count: 1, pointsPerQuestion: 2, total: 2 },
      { id: 'tl-3', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'vd', levelName: 'Vận dụng', form: 'TL', subtype: 'essay', essayType: 'situation', partsCount: 2, partPoints: [2, 2], count: 1, pointsPerQuestion: 4, total: 4 },
    ],
  };
  const steps = __test.generationSteps(mixedPayload);
  const essays = steps.filter(x => x.form === 'TL');
  assert.equal(steps.length, 4);
  assert.equal(essays.length, 3);
  assert.ok(essays.every(x => x.count === 1 && x.payload.matrix.length === 1));
  assert.deepEqual(essays.map(x => x.payload.matrix[0].total), [1, 2, 4]);
  assert.equal(steps.flatMap(x => x.payload.matrix).reduce((sum, x) => sum + x.total, 0), 10);
});

test('lượt tự luận khóa lại cấu hình và điểm trước khi ghép đề', () => {
  const cfg = { id: 'tl-vd', lessonId: 'lesson-1', level: 'vd', form: 'TL', essayType: 'situation', partsCount: 2, partPoints: [2, 2], pointsPerQuestion: 4, total: 4 };
  const raw = { examCodes: [{ code: 'A', questions: [{ form: 'TL', points: 1, prompt: 'Xử lí tình huống', context: 'Tình huống', parts: [
    { label: 'a', points: 0.5, prompt: 'Ý một', answer: 'Đáp án một', rubric: [{ content: 'Ý một', points: 0.5 }] },
    { label: 'b', points: 0.5, prompt: 'Ý hai', answer: 'Đáp án hai', rubric: [{ content: 'Ý hai', points: 0.5 }] },
  ] }] }] };
  const locked = __test.lockTlChunkToConfig(raw, cfg, 1);
  const q = locked.examCodes[0].questions[0];
  assert.equal(q.configId, 'tl-vd');
  assert.equal(q.lessonId, 'lesson-1');
  assert.equal(q.level, 'vd');
  assert.equal(q.points, 4);
  assert.ok(q.parts.every(p => p.configId === 'tl-vd' && p.level === 'vd'));
});

test('API lượt tự luận sửa dữ liệu AI 1 điểm thành đúng 4 điểm của cấu hình', async () => {
  const payload = {
    setup: { examCodes: 1 },
    lessons: [{ id: 'lesson-1', number: 1, title: 'Bài kiểm tra', descriptor: {} }],
    matrix: [
      { id: 'tn-1', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'nb', levelName: 'Nhận biết', form: 'TNKQ', subtype: 'single', count: 3, pointsPerQuestion: 1, total: 3 },
      { id: 'tl-1', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'nb', levelName: 'Nhận biết', form: 'TL', subtype: 'essay', essayType: 'direct', partsCount: 1, partPoints: [1], count: 1, pointsPerQuestion: 1, total: 1 },
      { id: 'tl-2', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'th', levelName: 'Thông hiểu', form: 'TL', subtype: 'essay', essayType: 'direct', partsCount: 1, partPoints: [2], count: 1, pointsPerQuestion: 2, total: 2 },
      { id: 'tl-3', lessonId: 'lesson-1', lessonTitle: 'Bài kiểm tra', level: 'vd', levelName: 'Vận dụng', form: 'TL', subtype: 'essay', essayType: 'situation', partsCount: 2, partPoints: [2, 2], count: 1, pointsPerQuestion: 4, total: 4 },
    ],
  };
  const essayEnv = {
    SYSTEM_PROMPT_A: 'A', SYSTEM_PROMPT_B: 'B', SYSTEM_PROMPT_C: 'C',
    AI: { async run() { return { response: { examCodes: [{ code: 'A', questions: [{
      form: 'TL', points: 1, prompt: 'Em xử lí tình huống như thế nào?', context: 'H thấy bạn làm hỏng tài sản chung.',
      parts: [
        { label: 'a', points: 0.5, prompt: 'Nhận xét', answer: 'Hành vi chưa đúng.', rubric: [{ content: 'Nhận xét đúng', points: 0.5 }] },
        { label: 'b', points: 0.5, prompt: 'Cách xử lí', answer: 'Khuyên bạn dừng lại.', rubric: [{ content: 'Nêu cách xử lí', points: 0.5 }] },
      ],
    }] }] } }; } },
  };
  const response = await worker.fetch(new Request('https://example.com/api/generate-chunk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, chunkIndex: 3, provider: 'cloudflare' }),
  }), essayEnv);
  const data = await response.json();
  assert.equal(response.status, 200, data.error);
  assert.equal(data.questions.length, 1);
  assert.equal(data.questions[0].configId, 'tl-3');
  assert.equal(data.questions[0].points, 4);
  assert.deepEqual(data.questions[0].parts.map(p => p.points), [2, 2]);
});
