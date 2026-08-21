# Upload lên hoclieusotools

Đặt nguyên thư mục `xaydungkhdh` ở root repository `hoclieusotools`.

Cấu trúc phải là:

```text
hoclieusotools/
└── xaydungkhdh/
    ├── index.html
    ├── README.md
    ├── THIRD-PARTY-NOTICES.md
    ├── UPLOAD-GITHUB.md
    └── assets/
        ├── css/
        └── js/
```

Không tạo `public/`, không tạo `.github/`, không đưa Worker private vào repo này.

Sau khi commit, mở trực tiếp hai tệp để kiểm tra cache và đường dẫn:

```text
https://tools.hoclieuso.id.vn/xaydungkhdh/assets/js/config.js
https://tools.hoclieuso.id.vn/xaydungkhdh/assets/js/pdf-native.js
```

`config.js` phải có `version: '1.2.2-production'` và endpoint Worker chính xác. Sau đó mở tiện ích và nhấn `Ctrl + F5`.
