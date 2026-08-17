# soankhbdnv — phần công khai

Thư mục này được phép đặt trong repository công khai `nddungdn/hoclieusotools/soankhbdnv`.

## Có thể công khai
- HTML/CSS/JS giao diện.
- Google OAuth Client ID (đây không phải secret).
- URL Cloudflare Worker.

## Tuyệt đối không đưa vào thư mục/repository công khai
- Nội dung prompt/skill.
- Thư mục `PRIVATE_CLOUDFLARE_WORKER/skills`.
- Gemini API Key của bất kỳ ai.
- File tài liệu người dùng tải lên.
- Bản sao database D1.

Cấu hình hai giá trị trong `assets/js/config.js` trước khi xuất bản.

## V1.1
- Sidebar trái cố định trên desktop, có nút Thu gọn.
- Menu dạng drawer trên điện thoại.
- Đã chừa sẵn module Ra đề kiểm tra: Ma trận, Đặc tả, Đề, Hướng dẫn chấm.
- Chức năng tương lai chưa kết nối backend và không phát sinh request AI.
