# Cấu trúc và cập nhật công cụ phanbienai

## Chức năng mới: Hỗ trợ giám khảo chấm sáng kiến

Tiện ích có hai chế độ độc lập:

1. **Phản biện AI 360°**: giữ nguyên chức năng phản biện tài liệu đa góc nhìn.
2. **Hỗ trợ chấm sáng kiến**: hỗ trợ một giám khảo đối chiếu hồ sơ theo mẫu Đà Nẵng 2026 có sẵn hoặc theo văn bản quy định, tiêu chí và bảng điểm do người dùng cung cấp.

Chế độ chấm sáng kiến thực hiện:

- Giữ mẫu Quyết định 465/QĐ-SGDĐT ngày 06/03/2026 của Sở GDĐT Đà Nẵng với thang điểm 40–30–30.
- Cho phép tải công văn, quyết định, hướng dẫn, biểu mẫu hoặc bảng điểm của trường, địa phương và cơ quan khác ở dạng PDF, DOCX, TXT, Markdown hoặc ảnh.
- Tách riêng văn bản chấm và hồ sơ sáng kiến; AI phải trích xuất điều kiện, thành phần hồ sơ, tiêu chí, điểm tối đa, mức điểm và điều kiện công nhận/xếp loại trước khi đánh giá.
- Cho người dùng chọn phạm vi đánh giá tính mới: **Cấp Trường**, **Cấp Phường/xã**, **Cấp Tỉnh/thành phố** hoặc **Cấp Toàn quốc**.
- Nếu phạm vi người dùng chọn khác với văn bản chấm, AI phải cảnh báo và ưu tiên quy định trong văn bản.
- Không coi “không tìm thấy giải pháp trùng” là bằng chứng đã chứng minh tính mới.
- Sau khi AI đọc được bảng điểm, tiện ích tạo phiếu nhập điểm linh hoạt theo đúng số tiêu chí và điểm tối đa đã trích xuất; không áp thang Đà Nẵng cho văn bản khác.
- Nếu văn bản thiếu hoặc không xác định được thang điểm, tiện ích không tự tạo điểm và yêu cầu giám khảo đối chiếu văn bản gốc.
- Xuất phiếu hỗ trợ ra tệp DOCX thật, Markdown hoặc in PDF.
- Tệp DOCX dùng khổ A4 dọc, phông Times New Roman, cỡ chữ thân bài 13 pt, lề 20–20–30–15 mm và số trang ở giữa phía trên (ẩn ở trang đầu), phù hợp yêu cầu trình bày tại Phụ lục I của Nghị định số 30/2020/NĐ-CP.
- Chuyển bảng Markdown trong kết quả AI thành bảng Word thật, tự xuống dòng và nằm trong vùng lề trang.
- Giao diện kết quả, bảng tiêu chí, phần nhập điểm và phiếu hỗ trợ tự co giãn trên máy tính, máy tính bảng và điện thoại.

AI không phải giám khảo và tiện ích không phải hệ thống của Hội đồng sáng kiến. Điểm, nhận xét và quyết định cuối cùng do người sử dụng tự chịu trách nhiệm.

Toàn bộ công cụ nằm trong duy nhất một thư mục:

```text
phanbienai/
├── index.html             # Trang GitHub Pages
├── favicon.svg
├── assets/                # JavaScript, CSS và thư viện đã build
├── source/                # Mã nguồn Vite/React
│   ├── public/
│   ├── scripts/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.ts
└── HUONG-DAN-CAP-NHAT.md
```

## Chạy thử mã nguồn

Mở Terminal tại `phanbienai/source` rồi chạy:

```bash
npm install
npm run dev
```

## Build và đồng bộ vào trang đang chạy

Sau khi sửa mã nguồn, chạy trong `phanbienai/source`:

```bash
npm run publish:local
```

Lệnh này sẽ:

1. Build mã nguồn vào `source/dist`.
2. Thay thư mục `phanbienai/assets` bằng bản mới.
3. Cập nhật `phanbienai/index.html` và `phanbienai/favicon.svg`.
4. Giữ nguyên thư mục `phanbienai/source`.

Sau đó commit toàn bộ thư mục `phanbienai` lên GitHub.

## Lưu ý

- Không tải `source/node_modules` lên GitHub.
- Không cần tải `source/dist` lên GitHub.
- Không đổi `base: "/phanbienai/"` trong `source/vite.config.ts`.
- Chức năng DOCX sử dụng gói `docx` đã khai báo trong `source/package.json`; chạy `npm install` sau khi nhận mã nguồn mới.
- GitHub Pages sử dụng `phanbienai/index.html`; mã nguồn trong `phanbienai/source` không ảnh hưởng giao diện.
- Worker Cloudflare vẫn được duy trì tại repository `ho-tro-phan-bien-ai`.
- Google Gemini được gọi trực tiếp từ trình duyệt đến `generativelanguage.googleapis.com` để không phụ thuộc vị trí IP của Cloudflare Worker.
- OpenAI, Claude và OpenRouter vẫn được gọi qua Worker Cloudflare.
- API key chỉ nằm trong bộ nhớ của tab; không ghi vào mã nguồn, GitHub, localStorage hay cơ sở dữ liệu.
