# Cấu trúc và cập nhật công cụ phanbienai

## Chức năng mới: Hỗ trợ giám khảo chấm sáng kiến

Tiện ích có hai chế độ độc lập:

1. **Phản biện AI 360°**: giữ nguyên chức năng phản biện tài liệu đa góc nhìn.
2. **Chấm sáng kiến Đà Nẵng 2026**: hỗ trợ một giám khảo đối chiếu hồ sơ theo Quyết định số 465/QĐ-SGDĐT ngày 06/03/2026 của Sở Giáo dục và Đào tạo thành phố Đà Nẵng.

Chế độ chấm sáng kiến thực hiện:

- Kiểm tra bố cục 11 phần của Bản mô tả sáng kiến.
- Kiểm tra điều kiện, thời hạn 01 năm và các minh chứng còn thiếu.
- Phân tích ba tiêu chí: tính mới 40 điểm, khả năng áp dụng 30 điểm, lợi ích thiết thực 30 điểm.
- Đề xuất điểm và trích dẫn để giám khảo tham khảo.
- Cho giám khảo tự nhập ba điểm thành phần; tự động cộng điểm và đối chiếu điều kiện xếp loại A, B, C.
- Xuất phiếu hỗ trợ ra Word, Markdown hoặc in PDF.

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
- GitHub Pages sử dụng `phanbienai/index.html`; mã nguồn trong `phanbienai/source` không ảnh hưởng giao diện.
- Worker Cloudflare vẫn được duy trì tại repository `ho-tro-phan-bien-ai`.
- Google Gemini được gọi trực tiếp từ trình duyệt đến `generativelanguage.googleapis.com` để không phụ thuộc vị trí IP của Cloudflare Worker.
- OpenAI, Claude và OpenRouter vẫn được gọi qua Worker Cloudflare.
- API key chỉ nằm trong bộ nhớ của tab; không ghi vào mã nguồn, GitHub, localStorage hay cơ sở dữ liệu.
