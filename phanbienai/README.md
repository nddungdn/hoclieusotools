# Hỗ trợ phản biện và chấm sáng kiến bằng AI

Công cụ của **Học liệu số** hỗ trợ phản biện tài liệu đa góc nhìn và hỗ trợ một giám khảo chấm sáng kiến theo Quyết định 465/QĐ-SGDĐT ngày 06/03/2026 của Sở GDĐT Đà Nẵng.

## Chức năng chính

- Dùng API key cá nhân của Google Gemini, OpenAI, Anthropic Claude hoặc OpenRouter.
- Một nền tảng nhiều vai trò hoặc hội đồng đa nền tảng.
- Đọc PDF, DOCX, TXT, Markdown và ảnh.
- Chọn chuyên gia nội dung, lập luận, nguồn dẫn, phương pháp, dữ liệu, thực tiễn, đạo đức–pháp lý và đại diện người đọc.
- Ba mức phản biện: nhanh, tiêu chuẩn và chuyên sâu.
- Chế độ phản biện nội tại hoặc có kiểm chứng khi nền tảng hỗ trợ.
- Tổng hợp điểm thống nhất, bất đồng, vấn đề cốt lõi và kế hoạch cải thiện.
- Sao chép, tải Word, Markdown hoặc in/lưu PDF.
- Chế độ hỗ trợ một giám khảo: kiểm tra hồ sơ, đối chiếu tiêu chí 40–30–30, đề xuất điểm tham khảo và cho phép giám khảo tự nhập điểm cuối cùng.
- Không tự nhận là Hội đồng sáng kiến và không thay giám khảo đưa ra quyết định chuyên môn.

## Chạy thử trên máy tính

Yêu cầu Node.js từ phiên bản 22.13 trở lên.

```bash
npm ci
npm run dev
```

Mở địa chỉ được hiển thị trong cửa sổ lệnh.

## Kiểm tra bản dựng

```bash
npm run build
npm test
```

## Triển khai

Đọc tài liệu [HUONG-DAN-TRIEN-KHAI.md](./HUONG-DAN-TRIEN-KHAI.md) để triển khai từng bước bằng GitHub và Cloudflare.

Repository đã có sẵn `wrangler.deploy.jsonc`. Cấu hình `placement.region` đặt Worker gần `gcp:us-east4` nhằm hạn chế lỗi Google Gemini nhận diện sai vị trí mạng của Cloudflare.

## Lưu ý bảo mật

- Không ghi API key vào mã nguồn, GitHub, Google Sheets hoặc cơ sở dữ liệu.
- Ứng dụng giữ khóa trong bộ nhớ của tab, sau đó gửi qua API route cùng nguồn để chuyển tiếp đến nhà cung cấp AI.
- Không có cơ chế lưu tài liệu người dùng.
- Không nên tải tài liệu mật, dữ liệu cá nhân nhạy cảm hoặc tài liệu chưa được phép xử lý bằng dịch vụ AI.
- Nên tạo API key riêng cho công cụ, đặt giới hạn chi tiêu và thu hồi khóa khi không còn sử dụng.

## Bản quyền

Công cụ được xây dựng bởi Học liệu số. Mọi kết quả chỉ mang tính chất tham khảo. Bản quyền công cụ thuộc về Học liệu số.
