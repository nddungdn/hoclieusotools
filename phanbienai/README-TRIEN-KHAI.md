# Giao diện công khai — Phản biện AI 360° bản 3.3

Thư mục này được đặt đúng tại:

`nddungdn/hoclieusotools/phanbienai/`

Địa chỉ sử dụng:

`https://tools.hoclieuso.id.vn/phanbienai/`

Đây là bản đã build, không chứa source React, prompt, quy tắc chấm chi tiết hoặc mã Cloudflare Worker. Phải triển khai Worker riêng tư `ho-tro-phan-bien-ai` thành công trước khi cập nhật thư mục này.

Bản 3.3 có ba chức năng:

1. Phản biện AI 360°.
2. Hỗ trợ một giám khảo chấm sáng kiến.
3. Tự đánh giá và Chat với AI để hoàn thiện tài liệu.

## Sửa chữ trực tiếp trên GitHub

Mở tệp `noi-dung.json`, nhấn **Edit this file**, chỉ sửa phần chữ bên phải dấu hai chấm rồi commit vào nhánh `main`. Không đổi tên trường và không xóa dấu ngoặc kép hoặc dấu phẩy. Tệp này chỉ chứa chữ công khai của giao diện, không chứa prompt hay quy tắc AI.

Khi nâng cấp từ bản 3.2, phải thay đồng thời `index.html`, toàn bộ thư mục `assets` và `noi-dung.json`. Chỉ sửa riêng JSON sẽ không bổ sung được chức năng Chat.
