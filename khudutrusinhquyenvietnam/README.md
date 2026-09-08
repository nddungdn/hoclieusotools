# 12 Khu dự trữ sinh quyển thế giới ở Việt Nam — V10

Thư mục triển khai: `hoclieusotools/khudutrusinhquyenvietnam/`

Địa chỉ dự kiến: `https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/`

## Thay đổi lớn ở V10

- Thay **toàn bộ atlas vector tự dựng** bằng bản đồ hành chính chính thức của Việt Nam.
- Nguồn nền chính: **Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam – Bộ Nông nghiệp và Môi trường**.
- Bản đồ sử dụng: **Bản đồ hành chính nước CHXHCN Việt Nam tỷ lệ 1:9.000.000, thành lập năm 2025**.
- PDF chính thức: `https://vnsdi.mae.gov.vn/downloads/hcvn_9tr_2025.pdf`
- Không còn `atlas-data.js`, không còn đường biên tự vẽ, không OSM/CARTO/Google Maps, không API key.
- Leaflet chỉ đảm nhiệm pan/zoom và lớp 12 marker sinh quyển.
- Hoàng Sa, Trường Sa và các đảo tiêu biểu được thể hiện trực tiếp trên bản đồ chính thức.
- Có nút **Nguồn bản đồ** mở thẳng PDF chính thức.
- Trên trình duyệt hỗ trợ nhúng PDF, nền dùng PDF vector nên chữ/đường nét giữ độ sắc khi zoom.
- Không dùng ảnh nền bản đồ từ nguồn không chính thống. Nếu trình duyệt không hỗ trợ nhúng PDF, người dùng vẫn có nút **Nguồn bản đồ** để mở bản đồ chính thức trực tiếp.

## Lưu ý kỹ thuật

Bản đồ 1:9.000.000 có lưới tọa độ 102°E–118°E và 6°N–24°N. Tiện ích dùng chính khung tọa độ này để đặt 12 marker theo tọa độ tham chiếu của UNESCO.

`Toàn cảnh` đưa bản đồ về toàn bộ khung chính thức. Mức zoom tối thiểu được khóa theo toàn cảnh sau khi tính theo kích thước thiết bị để không thể thu nhỏ đến mức lộ phần ngoài tờ bản đồ.

## Nguồn nội dung

- UNESCO Man and the Biosphere Programme (MAB): hồ sơ 12 khu dự trữ sinh quyển.
- Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam: bản đồ hành chính Việt Nam 2025.
- Ảnh: các cổng thông tin chính thống của Việt Nam, đường dẫn nguồn ghi ở từng ảnh.
- Video: YouTube; ưu tiên truyền hình, khoa giáo, du lịch và cơ quan chính thống.
