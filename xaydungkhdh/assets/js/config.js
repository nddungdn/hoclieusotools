export const APP_CONFIG = {
  name: 'Xây dựng KHDH Ngữ văn',
  version: '1.2.2-production',
  basePath: '/xaydungkhdh',
  // Backend Production đã xác nhận /health; không có dấu / ở cuối.
  apiBase: 'https://xaydungkhdh-api.nddungdn.workers.dev',

  academicYearDefault: '2026-2027',
  totalPeriodsDefault: 140,
  semester1Default: 72,
  semester2Default: 68,

  // v1.2.2: KHÔNG gửi cả SGK trong một request. Văn bản/PDF đều được chia theo trang/phần.
  textbookChunkTargetChars: 28000,
  textbookChunkHardMaxChars: 38000,
  textbookChunkMaxPages: 24,
  textbookChunkOverlapPages: 1,
  genericChunkTargetChars: 26000,
  genericChunkHardMaxChars: 36000,
  summaryBatchMaxChars: 70000,
  requestHardMaxChars: 130000,

  // PDF scan được cắt cục bộ bằng pdf-lib rồi gửi từng cụm trang dưới dạng PDF native.
  // 8 trang/cụm là mức khởi đầu cân bằng cho SGK scan; cụm quá lớn sẽ tự chia đôi.
  nativePdfChunkMaxPages: 8,
  nativePdfChunkHardMaxBase64Chars: 7200000,
  nativePdfEstimatedTokensPerPage: 2000,
  scannedPdfCharsPerPageThreshold: 30,

  // Ước lượng bảo thủ khi provider không có API đếm token.
  estimatedCharsPerToken: 3.0,
  safeContextFraction: 0.60,

  // Retry tuần tự để giảm lỗi quota/rate-limit của API cá nhân.
  maxRetries: 3,
  retryBaseMs: 2500,
  interRequestDelayMs: 450,

  // Giới hạn đọc cục bộ. PDF vẫn giữ từng trang để chia nhỏ, không cắt 180k ký tự như v1.1.
  maxPdfPages: 1000,
  maxExtractedCharsPerFile: 1800000,
  maxCombinedTextForSmallJobs: 180000,

  privacyNotice: 'Chỉ cung cấp dữ liệu thật sự cần thiết. Không tải CCCD, số điện thoại, địa chỉ nhà, hồ sơ sức khỏe, tài khoản hoặc dữ liệu nhạy cảm của giáo viên, học sinh, phụ huynh.'
};
