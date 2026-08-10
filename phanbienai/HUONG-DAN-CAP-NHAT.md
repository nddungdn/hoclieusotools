# Cấu trúc và cập nhật công cụ phanbienai

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
