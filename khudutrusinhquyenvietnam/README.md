# Atlas 12 Khu dự trữ sinh quyển thế giới ở Việt Nam — V9.1

Thư mục triển khai:

`hoclieusotools/khudutrusinhquyenvietnam/`

Đường dẫn dự kiến:

`https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/`

## Thay đổi V9.1

- Ba nút **Khám phá bản đồ – Thử thách vị trí – Về trang chủ** nằm cố định trên **cùng một hàng**. Ở màn hình hẹp, hàng công cụ cuộn ngang thay vì tự xuống dòng.
- Bốn chỉ số `12 – 2000 – 2026 – 4` vẫn nằm cùng hàng, căn phải ở desktop.
- Xóa hoàn toàn hai khối ghi chú chữ nằm dưới bản đồ.
- Bản đồ cho phép **zoom-out sâu hơn** (tới mức locator map) mà không còn lộ mép trái, phải, trên hoặc dưới của vùng dữ liệu cắt.
- Khi zoom xa, các lớp đất liền/lưới/biên giới khu vực tự ẩn; nền biển của viewport luôn phủ kín toàn bộ khung. Chỉ giữ Việt Nam, Biển Đông, Hoàng Sa và Trường Sa để bản đồ sạch.
- Khi zoom trở lại mức học tập, lớp nền Đông Nam Á tự xuất hiện trở lại.
- Hình Việt Nam có thêm **viền quốc gia liên tục** lấy từ polygon quốc gia, đặt dưới bờ biển/biên giới chi tiết. Vì vậy những đoạn dữ liệu biên giới chi tiết bị chia nhỏ không còn tạo khoảng hở thị giác.
- Ở mức zoom rất xa, marker 12 khu được ẩn để tránh chồng thành một cụm; zoom gần hơn marker tự xuất hiện và cơ chế chống chồng lấn tiếp tục hoạt động.
- Không sử dụng tile Google Maps, OSM hay CARTO và không có API key bản đồ.

## Lưu ý về bản đồ

Bản đồ trong tiện ích là atlas học tập tự chứa. Các nhãn tiếng Việt do chính tiện ích kiểm soát. Hoàng Sa, Trường Sa và các đảo tiêu biểu được thể hiện nhằm hỗ trợ định hướng không gian trong dạy học; các điểm đảo không phải ranh giới pháp lý/hành chính.

Đối với xuất bản bản đồ chính thức hoặc tài liệu cần giá trị pháp lý, cần sử dụng bản đồ/dữ liệu đã được cơ quan có thẩm quyền thẩm định theo quy định về đo đạc và bản đồ của Việt Nam.

## Các file chính

- `index.html` — giao diện.
- `styles.css` — thiết kế responsive.
- `app.js` — bản đồ, lọc, so sánh, quiz và tương tác.
- `atlas-data.js` — dữ liệu vector atlas nội bộ.
- `data.js` — dữ liệu 12 khu dự trữ sinh quyển, ảnh và video.

## Triển khai

Chép toàn bộ nội dung thư mục này vào:

`hoclieusotools/khudutrusinhquyenvietnam/`

Sau đó commit và push lên GitHub/Cloudflare Pages như các tiện ích khác của Học liệu số.


## V9.1.1 — làm sạch đường nét bản đồ
- Bỏ viền liền quanh lãnh thổ Việt Nam.
- Bỏ lớp đường bờ biển Việt Nam tô đậm.
- Giữ nền lãnh thổ nhẹ và biên giới đất liền nét đứt mảnh.
- Mục tiêu: tránh các đoạn nối thẳng/gãy khúc xấu khi zoom.

## V9.1 – bản sửa lỗi bản đồ

- Không gọi trực tiếp lớp VNSDI/ArcGIS REST nữa vì dịch vụ có thể yêu cầu đăng nhập hoặc chặn truy cập ẩn danh.
- Bản đồ nền mặc định là atlas vector nội bộ đi kèm dự án, vì vậy luôn hiển thị và không phụ thuộc API key/token.
- Hoàng Sa, Trường Sa và các đảo tiêu biểu vẫn do tiện ích hiển thị bằng tiếng Việt.
- Bản đồ chính thức của cơ quan nhà nước được dùng để đối chiếu, không bị nhúng theo cách có thể gây lỗi trắng bản đồ.
