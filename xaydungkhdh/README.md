# Xây dựng KHDH Ngữ văn — Frontend v1.2.2 Production

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
- pdf-lib 1.17.1 — unpkg

API Key của người dùng không được lưu trong GitHub và không được ghi vào `config.js`.


## v1.2.2 — Dual PDF Pipeline

- Tự phân biệt `TEXT_PDF` và `SCANNED_PDF` theo lượng chữ trung bình/trang.
- PDF có lớp chữ tiếp tục dùng Text Pipeline theo từng phần.
- PDF scan được cắt cục bộ thành cụm tối đa 8 trang rồi gửi dạng PDF native.
- Hỗ trợ adapter PDF cho Gemini, OpenAI và Anthropic khi model tương ứng hỗ trợ.
- Giữ checkpoint, tạm dừng, tiếp tục và chạy lại phần lỗi.
- Hiển thị rõ “loại người dùng chọn”, “gợi ý từ tên tệp” và trạng thái PDF.
- Cảnh báo khi tên tệp là SGV nhưng người dùng chọn SGK (và ngược lại).

## Kế thừa hotfix v1.2.1

- Thêm lựa chọn loại tài liệu trước khi tải.
- Ở chế độ Tạo mới, mặc định lần tải là SGK.
- Cho phép đổi loại từng tệp sau khi tải.
- Không còn phụ thuộc hoàn toàn vào nhận diện tự động để bước 6 tìm thấy SGK.
