# HƯỚNG DẪN TRIỂN KHAI HO-TRO-PHAN-BIEN-AI

> Bản nguồn này đã có `wrangler.deploy.jsonc`, API route đa nền tảng, CORS cho `https://tools.hoclieuso.id.vn` và cấu hình vùng chạy nhằm khắc phục lỗi Gemini `User location is not supported for the API use`.

## 1. Mô hình triển khai

Mô hình được khuyến nghị:

1. **GitHub** lưu toàn bộ mã nguồn và lịch sử cập nhật.
2. **Cloudflare Workers** xây dựng, chạy giao diện và API route trung chuyển.
3. Người dùng nhập API key cá nhân trực tiếp trên giao diện.
4. Ứng dụng không cần Google Sheets, Apps Script hoặc cơ sở dữ liệu.

Không nên triển khai riêng trên GitHub Pages vì GitHub Pages chỉ phục vụ tệp tĩnh, trong khi công cụ cần API route phía máy chủ để kết nối an toàn và ổn định với nhiều nhà cung cấp AI.

## 2. Chuẩn bị

Cần có:

- Một tài khoản GitHub.
- Một tài khoản Cloudflare đang quản lý tên miền `hoclieuso.id.vn` hoặc tên miền muốn sử dụng.
- Bộ mã nguồn của công cụ đã giải nén.
- Không đưa bất kỳ API key nào vào mã nguồn.

Tên miền gợi ý:

```text
phanbien.hoclieuso.id.vn
```

## 3. Đưa mã nguồn lên GitHub bằng giao diện web

### Bước 1. Tạo kho mã nguồn

1. Đăng nhập GitHub.
2. Nhấn dấu **+** ở góc trên bên phải.
3. Chọn **New repository**.
4. Đặt tên kho, ví dụ:

```text
ho-tro-phan-bien-ai
```

5. Chọn **Private** trong thời gian thử nghiệm. Có thể chuyển sang Public sau khi công cụ ổn định.
6. Không chọn tạo sẵn README, `.gitignore` hoặc giấy phép vì bộ mã nguồn đã có các tệp cần thiết.
7. Nhấn **Create repository**.

### Bước 2. Tải mã nguồn lên

Nếu dùng giao diện GitHub:

1. Mở kho vừa tạo.
2. Chọn **Add file → Upload files**.
3. Kéo toàn bộ tệp và thư mục trong bộ mã nguồn vào vùng tải lên.
4. Kiểm tra phải có các mục quan trọng:

```text
app/
worker/
public/
scripts/
package.json
package-lock.json
vite.config.ts
wrangler.deploy.jsonc
```

5. Nhập nội dung ghi chú, ví dụ `Khởi tạo công cụ phản biện AI 360`.
6. Nhấn **Commit changes**.

GitHub có thể hạn chế tải cả thư mục qua một số trình duyệt. Nếu gặp trường hợp đó, dùng GitHub Desktop hoặc dòng lệnh theo mục tiếp theo.

## 4. Đưa mã nguồn lên GitHub bằng dòng lệnh

Mở Terminal trong thư mục mã nguồn và chạy lần lượt:

```bash
git init
git add .
git commit -m "Khởi tạo Hội đồng phản biện AI 360"
git branch -M main
git remote add origin https://github.com/TEN-TAI-KHOAN/ho-tro-phan-bien-ai.git
git push -u origin main
```

Thay `TEN-TAI-KHOAN` bằng tên tài khoản GitHub thực tế.

Không chạy lệnh nếu trong thư mục có tệp chứa API key. Có thể kiểm tra nhanh trước khi tải lên bằng cách tìm các chuỗi `AIza`, `sk-`, `sk-ant` hoặc `sk-or` trong mã nguồn.

## 5. Triển khai từ GitHub lên Cloudflare

### Bước 1. Tạo ứng dụng Worker

1. Đăng nhập Cloudflare.
2. Vào **Workers & Pages**.
3. Chọn **Create application** hoặc **Create**.
4. Chọn hình thức nhập dự án từ Git/GitHub.
5. Kết nối tài khoản GitHub nếu Cloudflare yêu cầu.
6. Chọn kho `ho-tro-phan-bien-ai`.
7. Chọn nhánh triển khai `main`.

Tên mục có thể thay đổi nhẹ theo giao diện Cloudflare, nhưng cần chọn sản phẩm **Workers**, không triển khai như một trang GitHub Pages tĩnh.

### Bước 2. Cấu hình xây dựng

Điền cấu hình:

| Mục | Giá trị |
|---|---|
| Production branch | `main` |
| Root directory | `/` hoặc để trống |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --config wrangler.deploy.jsonc` |
| Node.js version | `22` hoặc mới hơn |

Nếu Cloudflare có ô biến môi trường, thêm:

| Tên biến | Giá trị |
|---|---|
| `NODE_VERSION` | `22` |

Không thêm khóa Gemini, OpenAI, Claude hoặc OpenRouter vào phần biến môi trường. Công cụ sử dụng khóa cá nhân của từng người dùng.

Cloudflare sẽ tự cài thư viện trước khi chạy Build command. Deploy command bắt buộc dùng đúng tệp `wrangler.deploy.jsonc`; trong tệp này đã có:

```jsonc
"placement": {
  "region": "gcp:us-east4"
}
```

Không xóa phần trên nếu Gemini đang báo lỗi vị trí mạng.

### Bước 3. Triển khai

1. Nhấn **Save and Deploy**.
2. Chờ quá trình cài đặt, xây dựng và tải ứng dụng hoàn tất.
3. Khi thành công, Cloudflare cung cấp một địa chỉ dạng:

```text
https://ten-worker.ten-tai-khoan.workers.dev
```

4. Mở địa chỉ này và kiểm tra:
   - Header hiển thị Học liệu số.
   - Nút **Về trang chủ** mở `www.hoclieuso.id.vn`.
   - Có thể thêm kết nối AI.
   - Có thể dán văn bản và chọn hội đồng.
   - Footer hiển thị đầy đủ thông báo bản quyền.

## 6. Gắn tên miền phụ

Ví dụ dùng `phanbien.hoclieuso.id.vn`:

1. Mở Worker vừa triển khai trên Cloudflare.
2. Vào **Settings → Domains & Routes** hoặc **Triggers → Custom Domains**.
3. Chọn **Add Custom Domain**.
4. Nhập:

```text
phanbien.hoclieuso.id.vn
```

5. Xác nhận thêm tên miền.
6. Chờ Cloudflare cấp chứng chỉ HTTPS và cập nhật DNS.
7. Mở `https://phanbien.hoclieuso.id.vn` để kiểm tra.

Nếu tên miền đang được quản lý tại nhà cung cấp khác, cần chuyển DNS về Cloudflare hoặc tạo bản ghi theo hướng dẫn Cloudflare hiển thị.

## 7. Kiểm tra API đa nền tảng

### Google Gemini

1. Chọn **Google Gemini**.
2. Nhập mã mô hình phù hợp với tài khoản.
3. Dán API key từ Google AI Studio.
4. Nhấn **Kiểm tra**.

### OpenAI

1. Chọn **OpenAI**.
2. Nhập mã mô hình có quyền truy cập.
3. Dán OpenAI API key.
4. Nhấn **Kiểm tra**.

Lưu ý: tài khoản ChatGPT Plus không đồng nghĩa với việc có sẵn hạn mức OpenAI API. API là dịch vụ riêng của nền tảng.

### Anthropic Claude

1. Chọn **Anthropic Claude**.
2. Nhập đúng mã mô hình đang được tài khoản hỗ trợ.
3. Dán Anthropic API key.
4. Nhấn **Kiểm tra**.

### OpenRouter

1. Chọn **OpenRouter**.
2. Nhập mã mô hình theo định dạng của OpenRouter.
3. Dán OpenRouter API key.
4. Nhấn **Kiểm tra**.

Mã mô hình có thể thay đổi theo thời gian. Nếu báo `model not found`, hãy sao chép mã mô hình hiện hành từ trang quản lý của nhà cung cấp và dán vào ô **Mã mô hình**.

## 8. Thiết lập hội đồng đa nền tảng

1. Thêm từ hai kết nối AI trở lên.
2. Nhập và kiểm tra API key cho từng kết nối.
3. Chọn các chuyên gia cần sử dụng.
4. Tại mỗi thẻ chuyên gia, chọn kết nối được phân công.
5. Chọn một kết nối làm **Chủ tịch hội đồng**.
6. Chọn mức **Tiêu chuẩn** hoặc **Chuyên sâu**.
7. Kiểm tra số lượt gọi AI dự kiến.
8. Nhấn **Bắt đầu phản biện**.

Mức **Nhanh** chỉ dùng kết nối được chọn làm Chủ tịch hội đồng và thực hiện một lượt gọi AI.

## 9. Cập nhật công cụ sau này

Sau khi sửa mã nguồn trên máy tính:

```bash
git add .
git commit -m "Cập nhật công cụ"
git push
```

Nếu Cloudflare đã liên kết với nhánh `main`, một đợt triển khai mới sẽ tự động được khởi chạy.

Trước khi cập nhật bản chính thức, nên chạy:

```bash
npm ci
npm run build
npm test
```

## 10. Thiết lập bảo mật nên giữ nguyên

- Không lưu API key bằng `localStorage`.
- Không đưa API key vào URL.
- Không ghi API key hoặc nội dung tài liệu vào nhật ký.
- Không kết nối API tới địa chỉ do người dùng tự nhập.
- Chỉ cho phép bốn nhà cung cấp đã khai báo trong mã nguồn.
- Không bật công cụ thống kê ghi lại nội dung biểu mẫu.
- Dùng HTTPS cho tên miền chính thức.
- Khuyến nghị người dùng tạo khóa riêng, đặt giới hạn sử dụng và có thể thu hồi.
- Hiển thị rõ rằng tài liệu được gửi đến nhà cung cấp AI để xử lý.

Ứng dụng không chủ động lưu API key hoặc tài liệu, nhưng dữ liệu vẫn đi qua hạ tầng Cloudflare và nhà cung cấp AI. Không nên quảng cáo là “an toàn tuyệt đối” hoặc “không có bên thứ ba xử lý dữ liệu”.

## 11. Xử lý lỗi thường gặp

### `API key không hợp lệ` hoặc lỗi 401

- Kiểm tra có dán thừa khoảng trắng không.
- Kiểm tra khóa có bị thu hồi hoặc hết quyền không.
- Tạo khóa mới dành riêng cho công cụ.

### `model not found`

- Mã mô hình không tồn tại hoặc tài khoản chưa được cấp quyền.
- Mở trang mô hình của nhà cung cấp, sao chép đúng ID và dán lại.

### Lỗi 429

- Tài khoản đã vượt hạn mức hoặc gọi quá nhanh.
- Chờ một lúc, giảm số thành viên hội đồng hoặc dùng mức **Nhanh**.

### Lỗi 413 hoặc thông báo tệp quá lớn

- Giảm kích thước ảnh.
- Chia tài liệu thành nhiều phần.
- Chỉ tải những phần cần phản biện.

### PDF không có chữ

PDF có thể là bản scan từ ảnh. Hãy chuyển PDF sang văn bản, tải từng ảnh trang hoặc dùng phần mềm OCR trước khi phản biện.

### Chế độ kiểm chứng không có nguồn

- Kiểm chứng web đã được nối cho Gemini, OpenAI, Anthropic Claude và OpenRouter.
- Mô hình được chọn có thể không hỗ trợ công cụ tìm kiếm.
- Tài khoản hoặc quản trị viên của nhà cung cấp có thể tắt tính năng tìm kiếm web.
- Khi không có nguồn, phải hiểu kết quả là phản biện nội tại và đổi mô hình nếu cần.

### Mở trang được nhưng `/api/review` báo 404

Ứng dụng có thể đã bị triển khai như website tĩnh. Hãy kiểm tra lại:

- Sản phẩm triển khai là Cloudflare Worker.
- Đã chạy `npm run build`.
- Deploy command dùng `wrangler.deploy.jsonc`.
- Tệp `dist/server/index.js` đã được tạo.

## 12. Kiểm tra trước khi công bố

- [ ] Liên kết Học liệu số hoạt động.
- [ ] Nút Về trang chủ hoạt động.
- [ ] Giao diện tốt trên máy tính và điện thoại.
- [ ] API key không xuất hiện trong URL hoặc mã nguồn.
- [ ] Cả bốn nhà cung cấp hiển thị đúng.
- [ ] Tải được PDF, DOCX, TXT và ảnh.
- [ ] Chế độ Nhanh hoạt động.
- [ ] Chế độ Tiêu chuẩn tổng hợp được báo cáo.
- [ ] Sao chép và tải báo cáo hoạt động.
- [ ] Cảnh báo AI có thể sai được hiển thị.
- [ ] Footer và thông báo bản quyền đầy đủ.

## 13. Thông báo nên công khai cho người dùng

> API key không được công cụ chủ động lưu vào cơ sở dữ liệu. Khóa và tài liệu được truyền qua hệ thống trung gian để gửi đến nhà cung cấp AI đã chọn. Không tải tài liệu mật hoặc dữ liệu nhạy cảm nếu chưa được phép. Kết quả AI chỉ mang tính chất tham khảo; người dùng cần kiểm tra lại nguồn dẫn và kết luận quan trọng.
