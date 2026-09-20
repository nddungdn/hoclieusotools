const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const exposed = source.replace(/\}\)\(\);\s*$/, 'globalThis.qualityTest = { optionLengthProblem, buildQualityRules };})();');
assert.notEqual(exposed, source, 'Không tìm thấy điểm kết thúc app.js');
const context = {
  window: { APP_CONFIG: {}, GDCD_DATA: { grades: {} } },
  document: { readyState: 'loading', addEventListener() {} },
};
vm.runInNewContext(exposed, context);
const { optionLengthProblem, buildQualityRules } = context.qualityTest;

test('phương án cân đối không bị báo lỗi', () => {
  const q = { options: [
    'A. Tôn trọng quyền của người khác',
    'B. Tuân thủ quy định của tập thể',
    'C. Giữ gìn tài sản của cộng đồng',
    'D. Lắng nghe ý kiến của bạn bè',
  ] };
  assert.equal(optionLengthProblem(q), null);
});

test('phát hiện phương án dài nổi bật dù chỉ hơn 4 từ', () => {
  const q = { options: [
    'Học sinh biết bảo vệ tài sản của trường và lớp',
    'Học sinh biết bảo vệ tài sản của trường và lớp học',
    'Học sinh biết bảo vệ tài sản của trường và lớp mỗi ngày một cách có trách nhiệm',
    'Học sinh biết bảo vệ tài sản của trường và lớp mình',
  ] };
  assert.ok(optionLengthProblem(q));
});

test('quy tắc gửi AI thống nhất với ngưỡng kiểm tra', () => {
  assert.match(buildQualityRules(), /Chênh lệch tối đa 3 từ/);
});
