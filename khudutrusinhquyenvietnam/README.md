# 12 Khu dự trữ sinh quyển thế giới ở Việt Nam – V9

Tiện ích tra cứu và bản đồ tương tác phục vụ dạy học Địa lí THCS.

## Thay đổi quan trọng ở V9

- Bỏ hoàn toàn atlas biên giới tự dựng (`atlas-data.js`).
- Tiện ích **ưu tiên kết nối** bản đồ hành chính từ **Cổng thông tin không gian địa lý Việt Nam (VNSDI)** của **Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam – Bộ Nông nghiệp và Môi trường** qua ArcGIS REST MapServer.
- Các lớp đường bờ, biên giới, địa danh, biển đảo do nguồn bản đồ chính thức cung cấp; tiện ích không tự vẽ lại đường biên.
- 12 marker khu dự trữ sinh quyển vẫn là lớp tương tác riêng của tiện ích.
- Nếu dịch vụ VNSDI tạm lỗi hoặc yêu cầu xác thực ở một thời điểm/mạng truy cập, trang tự bật nền địa hình **không nhãn**; Hoàng Sa, Trường Sa và một số đảo tiêu biểu được tiện ích ghi bằng tiếng Việt trong lớp dự phòng, marker học tập vẫn dùng được.
- Không nhúng hay lưu token VNSDI vào mã nguồn. Nếu VNSDI thay đổi chính sách truy cập dịch vụ, tiện ích sẽ rơi về chế độ dự phòng thay vì hiện bản đồ lỗi.
- Không sử dụng Google Maps API key, CARTO hay tile OpenStreetMap có nhãn nước ngoài.

## Nguồn bản đồ

- VNSDI: https://vnsdi.mae.gov.vn/
- ArcGIS REST MapServer: `https://vnsdi.mae.gov.vn/server/rest/services/BDHCVN/BanDoHanhChinhVietNam/MapServer`
- Cơ quan: Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam – Bộ Nông nghiệp và Môi trường.

## Triển khai

Đặt thư mục tại:

`hoclieusotools/khudutrusinhquyenvietnam/`

Địa chỉ dự kiến:

`https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/`

Trang tĩnh, không cần backend và không cần API key. Để hiển thị nền VNSDI, thiết bị cần có kết nối Internet và dịch vụ phải cho phép truy cập tại thời điểm sử dụng.
