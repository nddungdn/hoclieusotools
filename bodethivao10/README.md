# Luyện đề vào lớp 10 môn Ngữ văn

Tiện ích HTML tĩnh dành cho GitHub Pages. Dữ liệu được đọc từ Google Sheets
thông qua Google Apps Script.

## 1. Cấu trúc Google Sheets

Tạo sheet tên `Nam2026`, hàng đầu gồm đúng 7 cột:

| ID | TinhThanh | Nam | LoaiDe | DeThi | DapAn | TrangThai |
|---|---|---|---|---|---|---|
| NB2026 | Ninh Bình | 2026 | Chung | Nội dung đề | Nội dung đáp án | HIEN |

- `ID`: mã duy nhất, không trùng giữa các đề.
- `TrangThai`: nhập `HIEN` để hiển thị; nhập `AN` để ẩn.
- `DeThi`, `DapAn`: hỗ trợ Markdown và thẻ `<br>`.

## 2. Tạo Apps Script

1. Trong Google Sheets, chọn **Tiện ích mở rộng → Apps Script**.
2. Xóa mã mẫu và dán nội dung file `apps-script/Code.gs`.
3. Nếu tên sheet khác `Nam2026`, sửa hằng số `TEN_SHEET`.
4. Chọn **Triển khai → Lượt triển khai mới → Ứng dụng web**.
5. Thực thi với tư cách: **Tôi**.
6. Ai có quyền truy cập: **Bất kỳ ai**.
7. Sao chép URL kết thúc bằng `/exec`.

## 3. Kết nối tiện ích

Mở `config.js`, dán URL vừa sao chép:

```js
window.VAN10_APPS_SCRIPT_URL = "https://script.google.com/macros/s/MA_TRIEN_KHAI/exec";
```

## 4. Đưa lên GitHub Pages

Đưa toàn bộ nội dung thư mục `luyendevan10` vào thư mục cùng tên trong kho
GitHub Pages. Địa chỉ dự kiến:

```text
https://tools.hoclieuso.id.vn/luyendevan10/
```

## Chức năng

- Lọc đề theo tỉnh/thành, năm và loại đề.
- Hiển thị Markdown, bảng, chữ đậm/nghiêng và xuống dòng.
- Tự phát hiện các câu hỏi để tạo phiếu trả lời.
- Tự động lưu bài trên thiết bị bằng `localStorage`.
- Hoàn thành bài để mở đáp án và hướng dẫn chấm.
- Tăng/giảm cỡ chữ, chế độ tối, giao diện responsive.
- Chưa gửi bài qua email.
