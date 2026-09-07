# Atlas 12 Khu dự trữ sinh quyển thế giới ở Việt Nam — V6

Tiện ích web tĩnh hỗ trợ dạy và học Địa lí THCS. Không cần backend, API key hoặc cơ sở dữ liệu.

## Bản đồ V6 — atlas điện tử nội bộ, không nhãn bên thứ ba

Phiên bản này **không dùng Google Maps, OpenStreetMap tile, CARTO hoặc bất kỳ nền bản đồ trực tuyến có sẵn nào**. Lý do là các nền tile có thể tự hiển thị địa danh theo ngôn ngữ/thiết lập của nhà cung cấp, gây khó kiểm soát trong một tiện ích dùng trong trường học.

Bản đồ được dựng theo kiểu **atlas vector nội bộ**:

- biển là nền màu tĩnh;
- đường bờ và khối đất được đóng gói trong `atlas-data.js`;
- đường bờ Việt Nam được nhấn bằng lớp GSHHG chi tiết hơn, còn polygon ADM0 đơn giản chỉ làm lớp tô nền rất nhẹ để tránh cảm giác đường viền gãy khúc;
- biên giới đất liền chỉ thể hiện nhẹ để định hướng;
- toàn bộ địa danh trên bản đồ do tiện ích tự ghi bằng tiếng Việt;
- không có API key, watermark hoặc chữ ngoại ngữ tự phát sinh;
- Hoàng Sa và Trường Sa được thể hiện bằng cụm điểm đảo + nhãn tiếng Việt, không dùng khung chữ nhật hoặc đường ranh giới pháp lý;
- các đảo tiêu biểu được bổ sung khi zoom để hỗ trợ học sinh định hướng không gian.

Dữ liệu đường bờ của lớp atlas được tạo từ bộ dữ liệu GSHHG đi kèm Basemap. Bản đồ chỉ phục vụ học tập và định hướng; không dùng thay cho bản đồ hành chính/pháp lý chính thức.

## Chức năng chính

- 12 khu dự trữ sinh quyển có marker theo vùng và tự zoom khi chọn.
- **Chống chồng marker thông minh ở toàn cảnh:** các điểm quá gần nhau (đặc biệt Cát Bà – Châu thổ sông Hồng và một số điểm phía Nam) được tách nhẹ trong không gian pixel; đường nối mảnh vẫn chỉ về tọa độ thật.
- Hiển thị **Quần đảo Hoàng Sa** và **Quần đảo Trường Sa** ở lớp chính; thêm Cát Bà, Bạch Long Vĩ, Cồn Cỏ, Lý Sơn, Cù Lao Chàm, Phú Quý, Côn Đảo, Phú Quốc, Thổ Chu, Hòn Khoai.
- Ảnh minh họa cho đủ 12 khu từ Wikimedia Commons, có ghi tác giả/giấy phép và liên kết nguồn.
- Video YouTube cho đủ 12 khu; mở trong hộp thoại bằng `youtube-nocookie.com`.
- Bộ lọc theo vùng, kiểu cảnh quan, tìm kiếm và sắp xếp.
- Trang chi tiết: vị trí, năm UNESCO, diện tích, tọa độ, tự nhiên, con người, vai trò, thách thức và kiến thức cần ghi nhớ.
- Dòng thời gian UNESCO.
- Chế độ so sánh 2 khu.
- **Thử thách bản đồ**: 8 câu ngẫu nhiên, học sinh phải bấm đúng marker; trả lời sai được gợi ý vùng/cảnh quan.
- Responsive cho máy tính, máy tính bảng và điện thoại.
- Nút **Về trang chủ** và chân trang bản quyền Học liệu số.

## Cấu trúc

- `index.html` – giao diện.
- `styles.css` – toàn bộ trình bày responsive.
- `atlas-data.js` – lớp bản đồ vector không nhãn: đất, đường bờ, biên giới định hướng và nhãn tiếng Việt.
- `data.js` – dữ liệu 12 khu, tọa độ, media và danh sách đảo/quần đảo.
- `app.js` – bản đồ, bộ lọc, chi tiết, media, so sánh, timeline và quiz.

## Triển khai

Đặt nguyên thư mục tại:

```text
hoclieusotools/
└── khudutrusinhquyenvietnam/
    ├── index.html
    ├── styles.css
    ├── atlas-data.js
    ├── data.js
    └── app.js
```

Đường dẫn:

```text
https://tools.hoclieuso.id.vn/khudutrusinhquyenvietnam/
```

## Kết nối Internet

Phần **bản đồ nền vector không cần Internet** sau khi mã nguồn đã được tải. Khi chạy trang vẫn cần Internet cho:

- Leaflet từ CDN `unpkg.com`;
- ảnh Wikimedia Commons;
- thumbnail/video YouTube.

Nếu muốn bản đồ hoạt động hoàn toàn offline, có thể đóng gói Leaflet vào thư mục dự án ở phiên bản sau.

## Lưu ý bản đồ

- Marker của khu dự trữ sinh quyển là **tọa độ tham chiếu phục vụ học tập**, không phải ranh giới pháp lý.
- Các điểm của Hoàng Sa, Trường Sa và các đảo tiêu biểu nhằm hỗ trợ định hướng không gian, **không biểu thị ranh giới hành chính hoặc pháp lý**.
- Nếu sau này có GeoJSON chính thức của vùng lõi/vùng đệm/vùng chuyển tiếp, có thể bổ sung polygon mà không cần đổi cấu trúc giao diện.

## Nguồn chính

- UNESCO Man and the Biosphere Programme (MAB)
- Wikimedia Commons
- YouTube (ưu tiên kênh truyền hình, khoa giáo, du lịch/chính thống phù hợp)
- Dữ liệu đường bờ atlas: GSHHG/Basemap

V6 — 07/09/2026


## Nâng cấp bản đồ V6
- Thu gọn khung toàn cảnh để Việt Nam chiếm diện tích lớn hơn trên màn hình, vẫn giữ đầy đủ Hoàng Sa và Trường Sa.
- Nhấn đường bờ Việt Nam bằng dữ liệu GSHHG/Basemap có độ chi tiết cao hơn; giảm lớp tô ADM0 thô xuống mức rất nhẹ.
- Đường bờ biển Việt Nam dùng nét liền; biên giới đất liền dùng nét đứt, trong khi các nước lân cận chỉ làm nền mờ.
- Thuật toán chống va chạm tự động tách các marker gần nhau ở chế độ toàn cảnh và vẽ đường nối về tọa độ gốc.
- Marker trở về đúng tọa độ khi zoom chi tiết; vì vậy phần tương tác/quiz vẫn giữ độ chính xác định vị.
- Nhãn đô thị và nước láng giềng tiếp tục được ẩn ở toàn cảnh; chỉ ưu tiên Việt Nam, Biển Đông, Hoàng Sa, Trường Sa và 12 điểm sinh quyển.
- Giữ giới hạn zoom thích ứng theo kích thước màn hình để người dùng không thể thu nhỏ bản đồ tới mức bố cục bị vỡ.
