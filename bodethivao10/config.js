/*
 * CẤU HÌNH CÔNG KHAI – LUYỆN THI VÀO LỚP 10 NGỮ VĂN V12
 *
 * Chỉ địa chỉ Cloudflare Worker được phép xuất hiện ở đây.
 * Không đặt URL Apps Script, ID Google Sheet hoặc khóa bí mật trong tệp này.
 */
window.VAN10_API_BASE_URL = "https://luyen-thi-vao-10-secure-api.nddungdn.workers.dev";
window.VAN10_API_TIMEOUT_MS = 20000;

/* Mô hình Gemini dùng với API Key do người học tự nhập. */
window.VAN10_GEMINI_MODEL = "gemini-2.5-flash";

/* Giới hạn ảnh bài viết tay. */
window.VAN10_MAX_IMAGES_PER_WRITING = 8;
window.VAN10_MAX_IMAGE_BYTES = 1500000;
window.VAN10_MAX_IMAGE_SIDE = 1800;
window.VAN10_JPEG_QUALITY = 0.82;

/* Giới hạn ảnh gửi trực tiếp từ trình duyệt tới Gemini khi chấm toàn bài. */
window.VAN10_MAX_AI_IMAGES = 4;
window.VAN10_MAX_AI_IMAGE_TOTAL_BYTES = 8000000;

/* Các khóa chứa dữ liệu đầy đủ của phiên bản cũ phải được xóa khi khởi động. */
window.VAN10_LEGACY_CACHE_KEYS = [
  "van10_exam_data_cache_v1110",
  "van10_exam_data_cache_v1100",
  "van10_student"
];
