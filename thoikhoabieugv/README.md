# Thời khóa biểu THCS Lê Hồng Phong

Bộ mã nguồn tĩnh để học sinh và giáo viên tra cứu thời khóa biểu của hai điểm trường từ Google Sheet. Giao diện giữ bảng màu tím–xanh–hồng của mẫu, cho phép vuốt ngang để đổi ngày trên điện thoại, tìm nhanh tên giáo viên, tìm giáo viên rảnh theo tổ và địa điểm, về trang chủ, dùng chế độ tối, chia sẻ, in và cài như ứng dụng.

## 1. Cấu trúc dữ liệu đã hỗ trợ

Mã nguồn đọc đúng bốn trang tính trong file Excel mẫu mới:

- `TKBHocSinh`: cột `Lớp | GVCN | Điện thoại | Buổi | Tiết | Thứ Hai ... Thứ Bảy`.
- `TKBGiaoVien`: mỗi giáo viên là một khối gồm tên giáo viên, phần `SÁNG`, phần `CHIỀU`, hàng `TIẾT` và các tiết 1–5.
- `ThoiGianBieu`: cột `Buổi | Tiết | Thời gian bắt đầu | Thời gian kết thúc`; dùng để xác định tiết học hoặc giờ ra chơi hiện tại.
- `DanhMucGiaoVien`: cột `Giáo viên | Tổ chuyên môn | Điểm trường`; dùng để lọc giáo viên rảnh tại Trụ sở hoặc Phân hiệu.

Không đổi tên bốn trang tính. Tên giáo viên trong `DanhMucGiaoVien` phải khớp với tên khối giáo viên trong `TKBGiaoVien` (không phân biệt chữ hoa/thường).

Các giá trị điểm trường được hỗ trợ: `Trụ sở`, `Phân hiệu`, `Cả hai`. Khi chọn Trụ sở hoặc Phân hiệu, giáo viên có giá trị `Cả hai` cũng được đưa vào kết quả.

Trên giao diện, hai địa điểm được trình bày là `Trụ sở Hàn Mặc Tử` và `Phân hiệu Hải Sơn`. Khi chuyển sang tab Giáo viên, nhập một phần tên vào ô `Tìm giáo viên` để thu gọn danh sách lựa chọn.

## 2. Đưa file Excel lên Google Sheet

1. Mở Google Drive, chọn **Mới > Tải tệp lên** và tải file Excel.
2. Mở file vừa tải, chọn **Tệp > Lưu dưới dạng Google Trang tính**.
3. Kiểm tra lại bốn tên trang tính là `TKBHocSinh`, `TKBGiaoVien`, `ThoiGianBieu` và `DanhMucGiaoVien`.

## 3. Tạo API Google Apps Script

1. Trong Google Sheet, chọn **Tiện ích mở rộng > Apps Script**.
2. Mở file `Code.gs`, xóa mã mặc định rồi dán toàn bộ nội dung file `google-apps-script/Code.gs` của dự án này. Bản mã này đã sửa việc lệch giờ sáng–chiều bằng cách ưu tiên giờ đang hiển thị trong sheet.
3. Mở **Cài đặt dự án**, bật tùy chọn hiển thị tệp kê khai `appsscript.json`.
4. Thay nội dung tệp kê khai bằng file `google-apps-script/appsscript.json`.
5. Quay lại `Code.gs`, chọn hàm `setup` và nhấn **Chạy**. Chấp nhận quyền truy cập Google Sheet.
6. Chọn hàm `testApi` và nhấn **Chạy**. Với file mới, nhật ký phải hiển thị 41 lớp, 86 giáo viên, 7 tổ chuyên môn, 2 điểm trường và 12 mốc thời gian hợp lệ.
7. Chọn **Triển khai > Tùy chọn triển khai mới > Ứng dụng web**.
8. Thiết lập:
   - Thực thi với tư cách: **Tôi**.
   - Người có quyền truy cập: **Bất kỳ ai**.
9. Nhấn **Triển khai** rồi sao chép URL kết thúc bằng `/exec`.

Kiểm tra nhanh bằng cách mở:

```text
URL_CUA_BAN?action=ping
```

Kết quả đúng có dạng `{"success":true,...}`.

## 4. Nối giao diện với Google Sheet

File `config.js` trong gói này đã được điền URL Apps Script do nhà trường cung cấp. Khi tạo bản triển khai khác, thay giá trị:

```js
apiUrl: "URL_APPS_SCRIPT_KET_THUC_BANG_EXEC",
```

bằng URL `/exec` mới. Cũng trong file này, có thể sửa `homeUrl`, tên trường, dòng thông báo, ngày áp dụng và lựa chọn hiển thị Thứ Bảy.

Từ ngày 01/6 đến hết ngày 04/9 hằng năm, tiện ích tự hiển thị thông báo nghỉ hè và không thông báo tiết đang diễn ra hoặc tiết sắp tới. Bảng thời khóa biểu vẫn tra cứu bình thường.

## 5. Đưa vào GitHub `hoclieusotools`

1. Tạo thư mục `thoikhoabieugv` trong kho `hoclieusotools`.
2. Sao chép toàn bộ các tệp của dự án vào thư mục này.
3. Commit và push lên GitHub.
4. Nếu Cloudflare Pages đang tự động triển khai kho `hoclieusotools`, chờ bản triển khai hoàn tất.
5. Truy cập:

```text
https://tools.hoclieuso.id.vn/thoikhoabieugv/
```

Đây là trang tĩnh, không cần lệnh build và không cần Node.js.

## 6. Cập nhật thời khóa biểu hằng ngày

Chỉ sửa dữ liệu trong Google Sheet. API lưu tạm dữ liệu tối đa 5 phút và trình duyệt lưu tối đa 30 phút. Nút **Làm mới** bỏ qua bản lưu trên trình duyệt; dữ liệu phía máy chủ có thể cần tối đa 5 phút để cập nhật hoàn toàn.

Khi thay đổi chính mã Apps Script, vào **Triển khai > Quản lý bản triển khai > Chỉnh sửa**, chọn **Phiên bản mới**, rồi nhấn **Triển khai**. URL `/exec` cũ vẫn giữ nguyên.

## 7. Lưu ý bảo mật

- Google Sheet vẫn để **Riêng tư**; không chọn “Công khai trên web”.
- API chỉ chấp nhận các hành động cố định: kiểm tra kết nối, lấy danh sách, lấy một thời khóa biểu và tìm giáo viên rảnh. Người dùng không thể truyền tên trang tính tùy ý.
- Tổ chuyên môn và điểm trường trong chức năng dạy thay được đọc trực tiếp từ `DanhMucGiaoVien`.
- Mặc định API **không trả số điện thoại GVCN**. Nếu thật sự cần hiển thị, đổi `RETURN_STUDENT_PHONE` thành `true` trong `Code.gs` và triển khai phiên bản mới.
- URL Apps Script sẽ xuất hiện trong mã chạy trên trình duyệt; điều này bình thường. Không đặt mật khẩu, API key hoặc dữ liệu bí mật trong `config.js`.
- Bản này cho phép chọn tên giáo viên và xem công khai. Nếu cần đăng nhập riêng cho giáo viên, nên bổ sung một lớp xác thực bằng Cloudflare Worker thay vì lưu mật khẩu trong Google Sheet hoặc JavaScript.

## 8. Liên kết trực tiếp

Ứng dụng tự tạo đường dẫn đến đúng đối tượng đang xem:

```text
?view=student&id=6.7
?view=teacher&id=TÊN_GIÁO_VIÊN
```

Nút **Chia sẻ** sẽ sao chép hoặc gửi đúng liên kết này.
