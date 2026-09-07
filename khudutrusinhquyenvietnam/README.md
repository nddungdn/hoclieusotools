# Atlas 12 Khu dự trữ sinh quyển thế giới ở Việt Nam — V7

Tiện ích tra cứu và bản đồ học tập tương tác hỗ trợ dạy Địa lí THCS. Thư mục triển khai đề nghị:

`hoclieusotools/khudutrusinhquyenvietnam/`

Đường dẫn dự kiến:

`https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/`

## Thay đổi V7

- Sửa hoàn toàn phần **Dòng thời gian**: nội dung nằm trong khung, cuộn ngang bên trong section và không còn làm vỡ chiều rộng trang.
- Ảnh của **12/12 khu** đã chuyển khỏi Wikimedia Commons. Mỗi ảnh dùng nguồn từ cổng thông tin chính thống của Việt Nam và có liên kết về trang nguồn ngay dưới ảnh.
- Nguồn ảnh hiện dùng gồm: Cục Du lịch Quốc gia Việt Nam (`vietnam.travel`), Cục Bảo tồn thiên nhiên và Đa dạng sinh học (`nbca.gov.vn`), Báo và Phát thanh, Truyền hình Nghệ An, cổng thông tin Khu DTSQ thế giới Cao nguyên Kon Hà Nừng – Gia Lai và các trang/cổng chính thống tương ứng.
- Khung atlas có **vùng pan an toàn**; ở chế độ toàn cảnh khóa thao tác kéo ngang để bản đồ không trôi sang trái/phải. Khi zoom vào, người dùng vẫn có thể kéo trong giới hạn cho phép.
- Tự tính mức zoom tối thiểu theo kích thước màn hình để viewport luôn nằm trong phạm vi atlas.
- Xóa mục **“Gợi ý trên lớp”**.
- Bốn chỉ số tổng quan `12 · 2000 · 2026 · 4` được đưa xuống cùng hàng với nút **Về trang chủ**, căn phải trên desktop và tự thích ứng trên màn hình nhỏ.
- Giữ bản đồ vector nội bộ không nhãn bên thứ ba, không tile Google Maps/OSM/CARTO và không API key bản đồ.

## Bản đồ

Bản đồ dùng Leaflet cho tương tác nhưng nền địa lí được vẽ từ dữ liệu vector đóng gói trong `atlas-data.js`. Không có tile nền từ nhà cung cấp bản đồ bên thứ ba, nên không có nhãn địa danh tự chèn ngoài kiểm soát của tiện ích.

- Hoàng Sa và Trường Sa được hiển thị bằng cụm điểm đảo và nhãn tiếng Việt.
- Các đảo tiêu biểu như Cát Bà, Bạch Long Vĩ, Cồn Cỏ, Lý Sơn, Cù Lao Chàm, Phú Quốc, Côn Đảo... xuất hiện theo mức zoom.
- Marker 12 khu tự tách nhẹ ở toàn cảnh nếu quá gần nhau; đường nối mảnh chỉ về tọa độ tham chiếu thật.
- Khi zoom vào, marker trở về đúng tọa độ gốc.

> Bản đồ phục vụ định hướng không gian trong học tập; marker và cụm điểm đảo không thay thế bản đồ hành chính hoặc tài liệu pháp lý chuyên ngành.

## Ảnh và video

Mỗi khu có:

- 1 ảnh minh họa từ một nguồn thông tin chính thống của Việt Nam;
- liên kết **Xem nguồn** về trang xuất bản ảnh;
- 1 video YouTube tiêu biểu;
- cơ chế ảnh dự phòng bằng thumbnail video nếu máy chủ nguồn ảnh tạm thời không phản hồi.

Ảnh được hiển thị cho mục đích minh họa giáo dục; khi sử dụng lại ngoài tiện ích cần tuân thủ điều kiện bản quyền của cơ quan/tác giả tại trang nguồn.

## Cấu trúc

- `index.html` — giao diện.
- `styles.css` — trình bày responsive.
- `app.js` — bản đồ, tra cứu, timeline, so sánh, quiz, modal media.
- `data.js` — dữ liệu 12 khu, nguồn ảnh và video.
- `atlas-data.js` — dữ liệu vector atlas nội bộ.

## Triển khai GitHub

Chép toàn bộ các file trong thư mục này vào:

```text
hoclieusotools/
└── khudutrusinhquyenvietnam/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── data.js
    ├── atlas-data.js
    └── README.md
```

Sau khi push lên nhánh đang được Cloudflare Pages/GitHub Pages sử dụng, truy cập:

`https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/`

## Nguồn dữ liệu nội dung

Thông tin danh hiệu, năm công nhận và mô tả nền ưu tiên đối chiếu UNESCO Man and the Biosphere Programme (MAB). Phần địa giới hiện nay được trình bày riêng với địa danh trong hồ sơ UNESCO khi cần thiết.

Bản quyền tiện ích được thuộc về **Học liệu số** — https://hoclieuso.id.vn/
