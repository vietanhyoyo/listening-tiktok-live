# ON AIR — Phòng nhạc TikTok Live

ON AIR là ứng dụng phát nhạc tương tác dành cho các buổi TikTok Live. Người xem có thể yêu cầu bài hát ngay trong phần bình luận; hệ thống tìm bài trên YouTube, thêm vào hàng đợi và ưu tiên phát các bài nhận được nhiều lượt yêu cầu nhất.

## Tính năng

- Kết nối với phiên TikTok Live bằng TikTok username hoặc đường dẫn hồ sơ.
- Nhận yêu cầu bài hát từ bình luận theo cú pháp `[Tên bài hát]`.
- Tìm kiếm bài hát trên YouTube và chỉ phát phần âm thanh trong giao diện.
- Tự gộp các yêu cầu trùng bài thành lượt bình chọn thay vì thêm nhiều bản sao vào hàng đợi.
- Sắp xếp hàng đợi theo số lượt bình chọn; bài có lượt yêu cầu cao nhất sẽ được phát tiếp.
- Dùng playlist mặc định khi chưa có yêu cầu từ TikTok Live.
- Điều khiển phát/tạm dừng, tua nhanh hoặc lùi 10 giây, chuyển bài, kéo tiến trình và điều chỉnh âm lượng.
- Giao diện tối ưu cho điện thoại và cập nhật trạng thái phòng nhạc theo thời gian thực qua Socket.IO.

## Yêu cầu

- Node.js 20 trở lên
- Một tài khoản TikTok đang phát Live để nhận bình luận

## Cài đặt và chạy local

```bash
npm install
npm run dev
```

Sau khi chạy, truy cập:

- Giao diện: `http://localhost:5173`
- Máy chủ realtime/TikTok: `http://localhost:3001`

## Chạy bản production

```bash
npm run build
npm start
```

Sau đó mở `http://localhost:3001`.

## Cách sử dụng trong buổi live

1. Mở ứng dụng và nhấn phím `Q` để mở hộp kết nối TikTok Live.
2. Nhập TikTok username hoặc dán đường dẫn hồ sơ TikTok của tài khoản đang live.
3. Người xem bình luận theo cú pháp `[Tên bài hát]`, ví dụ: `[Nàng thơ]`.
4. Bài hát được tìm trên YouTube, thêm vào hàng đợi hoặc cộng thêm lượt bình chọn nếu đã tồn tại.
5. Khi bài hiện tại kết thúc, hệ thống phát bài có số lượt bình chọn cao nhất.

## Cấu hình tùy chọn

Mặc định, ứng dụng tìm kiếm YouTube mà không cần API key. Nếu muốn dùng YouTube Data API chính thức, thiết lập biến môi trường `YOUTUBE_API_KEY` trước khi chạy máy chủ:

```bash
YOUTUBE_API_KEY=your_api_key npm start
```

Bạn cũng có thể đổi cổng máy chủ mặc định (3001) bằng biến môi trường `PORT`:

```bash
PORT=4000 npm start
```

## Dữ liệu và tài nguyên

- Danh sách bài hát tự động: `public/data/default.json`
- Video nền của phiên live: `public/assets/videostream1.mp4`

## Lưu ý

- Tài khoản TikTok phải đang Live thì ứng dụng mới có thể nhận bình luận.
- Khả năng kết nối có thể bị ảnh hưởng bởi giới hạn khu vực, rate limit hoặc thay đổi từ TikTok.
- Trạng thái kết nối và lỗi sẽ hiển thị trong hộp kết nối TikTok Live.
