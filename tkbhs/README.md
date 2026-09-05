# TKB học sinh — GitHub

Đường dẫn dự kiến: `https://tools.hoclieuso.id.vn/tkbhs/`

## 1. Cập nhật Apps Script

Giữ nguyên `Code.gs` đang phục vụ bản giáo viên. Thêm file `google-apps-script/TKBHocSinh.gs`, sau đó chèn đoạn trong `google-apps-script/DOGET-PATCH.txt` ngay đầu hàm `doGet(e)`. Triển khai **Phiên bản mới** trên bản triển khai hiện có để giữ URL `/exec`.

Kiểm tra:

`https://script.google.com/macros/s/AKfycbx4sQgX9fuIN6n4VtTkPxxpjgCC8h9iSBVvQ1ysX1Z1wi4HkfDBO-Nl-l4roWJ64sI/exec?action=studentOnly`

Kết quả đúng có `success:true`, `source:"TKBHocSinh"`, `timeSource:"ThoiGianBieu"`. Nhánh này chỉ đọc hai sheet trên và làm trống cột điện thoại trước khi trả dữ liệu.

## 2. Đưa lên GitHub

1. Giải nén gói nguồn.
2. Mở repo `nddungdn/hoclieusotools` → **Add file → Upload files**.
3. Tạo đúng thư mục `tkbhs`, tải **toàn bộ nội dung bên trong** thư mục này vào đó. Cấu trúc phải là `tkbhs/index.html`, không phải `tkbhs/tkbhs/index.html`.
4. Commit changes. Chờ GitHub/Cloudflare Pages triển khai xong, truy cập `https://tools.hoclieuso.id.vn/tkbhs/`.
5. Nếu vẫn thấy bản cũ, tải lại hai lần hoặc xóa dữ liệu trang do service worker lưu bộ đệm.

## 3. Các tệp

- `index.html`: giao diện học sinh.
- `styles.css`: màu sắc và bố cục responsive.
- `app.js`: tìm/nhớ lớp, vuốt ngày, thông báo giờ học/nghỉ hè, ghi chú, lịch, ảnh, in.
- `config.js`: URL Apps Script, trang chủ, múi giờ.
- `manifest.webmanifest`, `sw.js`, `icons/icon.svg`: cài ứng dụng và hỗ trợ ngoại tuyến.

Lưu lịch tạo file `.ics` cho 15 tuần tới và bỏ thời gian nghỉ hè. Lịch đã nhập không tự đổi khi Google Sheet thay đổi; nên dùng một lịch phụ để dễ xóa và nhập lại.
