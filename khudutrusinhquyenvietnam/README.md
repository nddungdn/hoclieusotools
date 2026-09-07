# Atlas 12 Khu dự trữ sinh quyển thế giới ở Việt Nam — V2

Tiện ích web tĩnh hỗ trợ dạy và học Địa lí THCS. Không cần backend, API key hoặc cơ sở dữ liệu. Bản đồ dùng OpenStreetMap nên không xuất hiện watermark yêu cầu API key.

## Điểm mới V2

- Bản đồ Việt Nam tương tác là trung tâm của giao diện.
- 12 khu dự trữ sinh quyển có marker theo vùng và tự zoom khi chọn.
- Hiển thị **Quần đảo Hoàng Sa** và **Quần đảo Trường Sa** ở lớp chính; thêm các đảo tiêu biểu: Cát Bà, Bạch Long Vĩ, Cồn Cỏ, Lý Sơn, Cù Lao Chàm, Phú Quý, Côn Đảo, Phú Quốc, Thổ Chu, Hòn Khoai.
- Ảnh minh họa cho đủ 12 khu từ Wikimedia Commons, có ghi tác giả/giấy phép và liên kết nguồn.
- Video YouTube cho đủ 12 khu; mở trong hộp thoại bằng `youtube-nocookie.com`.
- Bộ lọc theo vùng, kiểu cảnh quan, tìm kiếm và sắp xếp.
- Trang chi tiết: vị trí, năm UNESCO, diện tích, tọa độ, tự nhiên, con người, vai trò, thách thức và kiến thức cần ghi nhớ.
- Dòng thời gian UNESCO.
- Chế độ so sánh 2 khu.
- **Thử thách bản đồ**: 8 câu ngẫu nhiên, học sinh phải bấm đúng marker; trả lời sai được gợi ý vùng/cảnh quan.
- Responsive cho máy tính, máy tính bảng và điện thoại.

## Cấu trúc

- `index.html` – giao diện.
- `styles.css` – toàn bộ trình bày responsive.
- `data.js` – dữ liệu 12 khu, tọa độ, media, đảo/quần đảo và đường bao Việt Nam dùng cho trực quan hóa.
- `app.js` – bản đồ, bộ lọc, chi tiết, media, so sánh, timeline và quiz.

## Triển khai

Có thể đưa nguyên thư mục lên GitHub Pages hoặc Cloudflare Pages. Nếu repo là `hoclieusotools`, đặt thư mục này tại:

```text
hoclieusotools/
└── khudutrusinhquyenvietnam/
    ├── index.html
    ├── styles.css
    ├── data.js
    └── app.js
```

Sau khi deploy, đường dẫn có thể là:

```text
https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/
```

## Kết nối Internet

Tiện ích là web tĩnh nhưng khi chạy cần Internet để tải:

- Leaflet từ CDN `unpkg.com`;
- bản đồ nền OpenStreetMap (không API key), được làm dịu màu để phù hợp dạng atlas học tập;
- ảnh Wikimedia Commons;
- thumbnail/video YouTube.

## Lưu ý bản đồ

- Marker của khu dự trữ sinh quyển là **tọa độ tham chiếu phục vụ học tập**, không phải ranh giới pháp lý.
- Khung nét đứt quanh Hoàng Sa và Trường Sa chỉ nhằm hỗ trợ định hướng không gian trên bản đồ học tập, **không biểu thị ranh giới hành chính hoặc pháp lý**.
- Nếu sau này có GeoJSON chính thức của vùng lõi/vùng đệm/vùng chuyển tiếp, có thể bổ sung polygon vào `app.js` mà không cần đổi cấu trúc giao diện.

## Cập nhật nội dung

Mỗi khu nằm trong mảng `BIOSPHERES` của `data.js`. Có thể thay ảnh, video, nội dung hoặc tọa độ trực tiếp tại đây. Danh sách đảo nằm trong `ISLAND_LABELS`.

## Nguồn chính

- UNESCO Man and the Biosphere Programme (MAB)
- Wikimedia Commons
- YouTube (ưu tiên kênh truyền hình, khoa giáo, du lịch/chính thống phù hợp)
- OpenStreetMap contributors

V2 — 07/09/2026
