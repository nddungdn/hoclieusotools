# Luyện đề vào lớp 10 môn Ngữ văn

Tiện ích HTML tĩnh dành cho GitHub Pages. Dữ liệu được đọc từ Google Sheets
thông qua Google Apps Script.

## 1. Cấu trúc Google Sheets

### Sheet đề thi: `Nam2026`

Hàng đầu gồm đúng 7 cột:

| ID | TinhThanh | Nam | LoaiDe | DeThi | DapAn | TrangThai |
|---|---|---|---|---|---|---|
| NB2026 | Ninh Bình | 2026 | Chung | Nội dung đề | Nội dung đáp án | HIEN |

- `ID`: mã duy nhất, không trùng giữa các đề.
- `TrangThai`: nhập `HIEN` để hiển thị; nhập `AN` để ẩn.
- `DeThi`, `DapAn`: hỗ trợ Markdown và HTML định dạng an toàn.
- Khi đã nhập đáp án theo từng câu ở sheet `CauHoi`, cột `DapAn` tại
  `Nam2026` có thể để trống.

### Sheet câu hỏi: `CauHoiNam2026`

Mỗi câu hỏi/đáp án nằm trên một dòng riêng:

| IDDe | MaCau | Phan | TenCau | YeuCau | DapAn | DiemToiDa | ThuTu | TrangThai |
|---|---|---|---|---|---|---:|---:|---|
| NB2026 | DH1 | Đọc hiểu | Câu 1 | Yêu cầu câu 1 | Đáp án câu 1 | 0,5 | 1 | HIEN |
| NB2026 | DH2 | Đọc hiểu | Câu 2 | Yêu cầu câu 2 | Đáp án câu 2 | 1,0 | 2 | HIEN |
| NB2026 | V1 | Viết | Câu 1 | Yêu cầu viết | Hướng dẫn chấm | 2,0 | 3 | HIEN |

- `IDDe` phải trùng với `ID` của đề trong sheet `Nam2026`.
- `MaCau` phải duy nhất trong một đề.
- `DiemToiDa` là điểm tối đa của câu.
- `ThuTu` quyết định thứ tự câu trong khung bài làm.

Apps Script tự động đọc các sheet có tên theo mẫu:

- Đề thi: `Nam2026`, `Nam2027`, `Nam2028`...
- Câu hỏi: `CauHoiNam2026`, `CauHoiNam2027`, `CauHoiNam2028`...

Khi thêm bộ đề năm mới, chỉ cần tạo hai sheet tương ứng; không phải sửa mã.

### Mã định dạng dùng trong nội dung

```html
<b>Chữ đậm</b>
<i>Chữ nghiêng</i>
<br>
<p align="left">Căn trái</p>
<p align="right">Căn phải</p>
<p align="center">Căn giữa</p>
<p align="justify">Căn đều hai lề</p>
```

## 2. Tạo Apps Script

1. Trong Google Sheets, chọn **Tiện ích mở rộng → Apps Script**.
2. Xóa mã mẫu và dán nội dung file `apps-script/Code.gs`.
3. Chọn **Triển khai → Lượt triển khai mới → Ứng dụng web**.
4. Thực thi với tư cách: **Tôi**.
5. Ai có quyền truy cập: **Bất kỳ ai**.
6. Sao chép URL kết thúc bằng `/exec`.

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
- Tạo phiếu trả lời theo từng dòng của sheet `CauHoi`.
- Hiển thị đáp án và điểm tối đa của từng câu.
- Cho học sinh tự nhập điểm hoặc dùng AI nhận xét và chấm thử.
- AI hỗ trợ phương pháp làm bài bằng Gemini API key của người học.
- Tự động lưu bài trên thiết bị bằng `localStorage`.
- Hoàn thành bài để mở đáp án và hướng dẫn chấm.
- Tăng/giảm cỡ chữ, chế độ tối, giao diện responsive.
- Chưa gửi bài qua email.

## Lưu ý về API key

- Không ghi API key vào mã GitHub hoặc Google Sheets.
- Học sinh tự nhập API key trong giao diện.
- Tiện ích chỉ giữ khóa trong phiên trình duyệt hiện tại (`sessionStorage`).
- Điểm AI chấm chỉ có giá trị tham khảo, đặc biệt với câu viết mở.
