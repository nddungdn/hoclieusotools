# Cập nhật tiện ích ra đề GDCD lên V2.5.9

Bản này sửa quy trình tạo đề cho cả Gemini và Cloudflare. Cần cập nhật **cả Worker và giao diện**, theo thứ tự dưới đây.

## 1. Cập nhật Worker trước

1. Mở Cloudflare → Workers & Pages → Worker `radegdcd-secure-api` đang dùng.
2. Mở Edit code/Quick Edit. Lưu bản sao mã đang chạy để có thể quay lại.
3. Trong gói cập nhật, mở `WORKER/worker.mjs` bằng trình soạn thảo văn bản. Sao chép toàn bộ nội dung để thay mã Worker, rồi Deploy.
4. Giữ nguyên các prompt secrets `SYSTEM_PROMPT_A`, `SYSTEM_PROMPT_B`, `SYSTEM_PROMPT_C`, `SYSTEM_REFINE_PROMPT`, `SYSTEM_REVIEW_PROMPT`; giữ binding `AI`, các biến và cấu hình tên miền đang dùng.

Không dán riêng tệp nguồn `index.js`: bản triển khai một tệp đã được ghép sẵn trong `worker.mjs`.

Nếu làm trực tiếp từ repository, chạy `node radegdcd/worker/build.mjs` để tạo `radegdcd/worker/dist/worker.mjs`. Không cần cài thư viện để build.

## 2. Cập nhật giao diện

Đưa các tệp trong `PUBLIC/radegdcd/` vào đúng thư mục `radegdcd/` trên GitHub/nguồn triển khai website. Tệp mới `reliability.js` phải có cùng các tệp còn lại. Không đưa thư mục `WORKER` vào phần giao diện công khai.

Mở tiện ích rồi nhấn Ctrl+F5. Giao diện cần hiện **V2.5.9**. Nếu máy chủ chưa cùng phiên bản, ứng dụng sẽ báo rõ và giữ cấu hình, không tiếp tục ghép đề bằng hai phiên bản khác nhau.

## 3. Những thay đổi sử dụng

- Điền ma trận 10 điểm như trước. Cả Gemini và Cloudflare đều tạo từng nhóm câu.
- Chương trình giữ các vị trí đã đạt và chỉ yêu cầu bù phần thiếu/sai. Mỗi câu lựa chọn có lượt thẩm định riêng về đáp án và nhiễu.
- Khi dịch vụ hết hạn mức hoặc yêu cầu chờ, tiến độ trong tab được giữ. Sau thời gian báo chờ, bấm Tạo đề để tiếp tục. Có thể tải lại tab, nhập lại key và kiểm tra AI; key không được lưu cùng tiến độ.
- Không xuất Word khi chưa đủ câu, chưa đúng điểm, sai cấu hình hoặc chưa hoàn tất kiểm tra bắt buộc.
- Trong phần xem đề có mục mở rộng giải thích đáp án/nhiễu dành cho giáo viên. Phần này không chèn vào đề Word dành cho học sinh.
- Mã B được tạo từ mã A đã kiểm tra; thứ tự phương án và khóa đáp án được ánh xạ cùng nhau.

## 4. Kiểm tra nhanh sau cập nhật

1. Chọn Gemini, nhập key cá nhân và bấm Kiểm tra AI. Phép thử này thực sự gọi sinh JSON ngắn.
2. Tạo đề mẫu 12 câu TNKQ × 0,25 điểm và tự luận 1 + 2 + 4 điểm; chọn hai mã đề.
3. Kiểm tra cả A/B đủ 12 câu trắc nghiệm, tự luận 7 điểm và tổng 10 điểm.
4. Mở mục giải thích phương án; đọc căn cứ phân biệt đáp án đúng nhất và nhiễu.
5. Tích xác nhận sau khi duyệt; xuất Word và đối chiếu lại đáp án.

Các kiểm thử tự động đã bao gồm sinh thiếu câu, gián đoạn do hạn mức, lỗi đáp án E, nhiễu trùng đáp án, câu trùng, thay đổi ma trận, lưu tiến độ và xuất DOCX. Phản hồi AI được mô phỏng trong kiểm thử; chất lượng chuyên môn và thời gian phản hồi thực tế vẫn cần kiểm tra với key của giáo viên.

## 5. Nguồn SGK

Gói nguồn cũ V2.5.5 không chứa nội dung SGK trong `lesson-sources.js`. Gói triển khai V2.5.9 này đã bổ sung **42 bài GDCD lớp 6–9**, khôi phục từ bốn bản SGK dạng văn bản anh từng cung cấp. Tên bài đã được đối chiếu với danh mục của tiện ích; nội dung trong bảng cũng được trích theo đúng thứ tự.

Học liệu được nhúng riêng trong `WORKER/worker.mjs`; bản `WORKER/lesson-sources.private.json` dùng để lưu và build lại. **Không đưa thư mục WORKER lên kho giao diện công khai.** Không cần tạo KV để dùng các nguồn đã nhúng này. Bản mã GitHub không chứa toàn văn các sách.

Nếu về sau có kho học liệu riêng, có thể gắn KV `LESSON_SOURCE_KV` vào Worker, lưu mỗi bài dưới khóa `lesson:<lessonId>`, giá trị JSON gồm văn bản và thông tin nguồn. Đây là phần tùy chọn để cập nhật học liệu. Các tệp chuyển văn bản có thể chứa lỗi nhận dạng, còn nội dung pháp luật có thể cần đối chiếu quy định mới; giáo viên vẫn cần duyệt trước khi sử dụng.

## 6. Quay lại bản trước nếu cần

Trong Cloudflare, khôi phục phiên bản Worker trước đã lưu; trên nguồn giao diện, khôi phục đồng thời các tệp của V2.5.8. Không giữ giao diện V2.5.9 đi cùng Worker V2.5.8.
