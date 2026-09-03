/**
 * CẤU HÌNH DUY NHẤT CẦN SỬA KHI TRIỂN KHAI.
 * apiUrl là URL kết thúc bằng /exec của Google Apps Script.
 */
window.TKB_CONFIG = Object.freeze({
  apiUrl: "https://script.google.com/macros/s/AKfycbx4sQgX9fuIN6n4VtTkPxxpjgCC8h9iSBVvQ1ysX1Z1wi4HkfDBO-Nl-l4roWJ64sI/exec",
  schoolName: "TRƯỜNG THCS LÊ HỒNG PHONG",
  authorityName: "THỜI KHÓA BIỂU TRỰC TUYẾN",
  notice:
    "Nhà trường sẽ cập nhật thời khóa biểu tại đây khi có điều chỉnh. Vui lòng nhấn Làm mới để kiểm tra dữ liệu mới nhất.",
  effectiveDate: "Áp dụng theo thông báo của nhà trường",
  timezone: "Asia/Ho_Chi_Minh",
  defaultView: "student",
  showSaturday: true,
  cacheMinutes: 30,
  demoModeWhenApiMissing: true,
});
