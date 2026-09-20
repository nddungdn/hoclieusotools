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
  assert.equal(chunk.data.aiMeta.workerVersion, '2.5.6');
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
