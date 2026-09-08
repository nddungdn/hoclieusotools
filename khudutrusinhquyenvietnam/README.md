# 12 Khu dự trữ sinh quyển thế giới ở Việt Nam — V11

## Mục tiêu của V11
V11 được làm lại phần bản đồ để loại bỏ lỗi nền trống của V10.

### Kiến trúc bản đồ mới
- Không Leaflet.
- Không Google Maps / OpenStreetMap / CARTO.
- Không API key.
- Không gọi dịch vụ tile/REST bên ngoài.
- Không nhúng PDF vào lớp bản đồ.
- Nền atlas được đóng gói tại `assets/atlas-region.webp`.
- Pan/zoom/marker được điều khiển bằng JavaScript nội bộ (`app.js`).
- Nhãn địa danh trên bản đồ do chính tiện ích kiểm soát bằng tiếng Việt.
- Có Hoàng Sa, Trường Sa và một số đảo tiêu biểu.
- Có giới hạn pan/zoom để dù thu nhỏ hoặc kéo mạnh cũng không lộ mép trắng quanh bản đồ.

> Bản đồ nền nội bộ phục vụ định vị và học tập, không thay thế bản đồ hành chính có giá trị pháp lý. Nút **Đối chiếu bản đồ chính thức** mở bản đồ 2025 của Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam.

## Kiểm thử trước khi đóng gói
Đã chạy bằng Chromium headless với toàn bộ tài nguyên bản đồ nội bộ:
- 12/12 thẻ khu dự trữ sinh quyển render thành công.
- 12/12 marker render thành công.
- Không có lỗi JavaScript khi khởi tạo.
- Click marker `Cát Bà` mở đúng chi tiết `Cát Bà`.
- Tìm kiếm `Cần Giờ` trả về đúng 1 kết quả.
- Chế độ thử thách khởi tạo được.
- Ảnh nền atlas nội bộ tải đúng kích thước 7200 × 6786 px.
- Thử thu nhỏ liên tục và kéo bản đồ mạnh: không lộ lề trắng ở bốn phía.
- Kiểm tra desktop 1440 px và mobile 390 px.

## Cấu trúc
```text
khudutrusinhquyenvietnam/
├── index.html
├── styles.css
├── data.js
├── app.js
├── README.md
└── assets/
    ├── atlas-region.webp
    └── photo-placeholder.svg
```

## Triển khai
Đặt thư mục tại:

`hoclieusotools/khudutrusinhquyenvietnam/`

Địa chỉ dự kiến:

`https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/`

Không cần build, package manager, backend hay API key.
