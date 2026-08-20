# Xây dựng KHDH Ngữ văn — Frontend v1.2 Production

Thư mục này được thiết kế để đặt nguyên vẹn tại:

`hoclieusotools/xaydungkhdh/`

URL công khai:

`https://tools.hoclieuso.id.vn/xaydungkhdh/`

Backend Production:

`https://xaydungkhdh-api.nddungdn.workers.dev`

## Không cần `.github/`

Bản này không dùng GitHub Actions. Toàn bộ mã do dự án quản lý nằm trong chính thư mục `xaydungkhdh/`.

Các thư viện trình duyệt bên thứ ba được ghim phiên bản cố định và tải qua HTTPS khi chạy:
- PDF.js 3.11.174 — cdnjs
- Mammoth 1.8.0 — cdnjs
- docx 8.5.0 — unpkg

API Key của người dùng không được lưu trong GitHub và không được ghi vào `config.js`.
