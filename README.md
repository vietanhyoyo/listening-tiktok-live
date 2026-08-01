# ON AIR — TikTok Music Room

Ứng dụng nghe nhạc mobile kết nối bình luận TikTok Live. Comment theo cú pháp `@Tên bài hát` để tìm bài trên YouTube, đưa vào hàng đợi và bình chọn realtime.

## Chạy dự án

```bash
npm install
npm run dev
```

- Giao diện Vite: `http://localhost:5173`
- Socket/TikTok server: `http://localhost:3001`

Chạy bản production:

```bash
npm run build
npm start
```

Sau đó mở `http://localhost:3001`.

## Cách hoạt động

- Nhấn phím `Q` để mở popup TikTok Live; popup này cho phép bật kết nối hoặc ngắt kết nối phiên live đang hoạt động.
- Video stream tại `public/assets/videostream1.mp4` tự phát, tắt tiếng và lặp liên tục.
- YouTube IFrame API chỉ phát phần âm thanh; hình ảnh YouTube không xuất hiện trong giao diện.
- Toàn bộ phòng nhạc được nén trong một viewport điện thoại, không cần cuộn dọc; Top 6+ chạy tự động theo băng chuyền ngang.
- Thanh phát nhạc hỗ trợ phát/tạm dừng, tua ±10 giây, chuyển bài, kéo tiến trình và điều chỉnh/tắt âm lượng.
- Bài trùng `videoId` hoặc tiêu đề chuẩn hóa được cộng thêm vote thay vì tạo hàng mới.
- Tìm kiếm phân tích nhiều kết quả YouTube, ưu tiên tên khớp chính xác, loại biến thể ngoài yêu cầu (cover/remix/karaoke...) và chọn video có lượt xem cao nhất trong nhóm phù hợp.
- Khi bài hiện tại kết thúc, bài có vote cao nhất được phát tiếp.
- Khi hàng đợi TikTok trống, ứng dụng tự xoay vòng `public/data/default.json`.
- Tìm YouTube hoạt động không cần API key. Có thể đặt `YOUTUBE_API_KEY` để dùng YouTube Data API chính thức.

## Lưu ý TikTok Live

Tài khoản nhập vào phải đang live. Kết nối có thể phụ thuộc giới hạn vùng, rate limit hoặc thay đổi từ TikTok. Trạng thái lỗi sẽ được hiển thị ngay trong popup kết nối.
