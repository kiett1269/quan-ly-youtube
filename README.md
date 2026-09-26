# Quản Lý Nội Dung YouTube

Ứng dụng web giúp bạn quản lý toàn bộ quy trình sản xuất video cho các kênh YouTube faceless: từ ý tưởng, kịch bản, dựng video, đến khi đăng và theo dõi hiệu quả. Chạy hoàn toàn trong trình duyệt, **không cần cài đặt, không cần internet, không cần biết code**.

## 1. Cách mở ứng dụng

- Cách đơn giản nhất: mở file `index.html` bằng cách **double-click** vào nó, hoặc kéo file vào một tab trình duyệt (Chrome, Edge, Cờ Rôm...).
- Dữ liệu được lưu trong chính trình duyệt của bạn (localStorage), gắn với đúng file/địa chỉ bạn mở. Vì vậy:
  - Nên luôn mở ứng dụng từ **cùng một trình duyệt** và **cùng một cách** (ví dụ luôn double-click file, hoặc luôn dùng GitHub Pages) để không bị "mất" dữ liệu.
  - Nếu bạn xóa lịch sử trình duyệt / dữ liệu trang web, dữ liệu ứng dụng cũng sẽ mất — hãy **xuất dữ liệu thường xuyên** (xem mục 6).

Lần đầu mở, ứng dụng sẽ tự tạo sẵn 3 kênh mẫu (VΞRLOX, Mật Mã Dị Thường, Phát Triển Bản Thân) và vài video/ý tưởng demo để bạn xem thử. Vào **Cài đặt → Xóa dữ liệu mẫu** khi bạn muốn bắt đầu với dữ liệu thật của mình.

## 2. Các trang chính

### 🏠 Tổng quan
Xem nhanh: số video theo trạng thái/kênh, video sắp đến hạn hoặc trễ hạn (tô đỏ), tiến độ mục tiêu đăng bài theo tuần/tháng của từng kênh, chuỗi ngày đăng liên tục (streak) và số video đã đăng trong tháng.

### 💡 Kho ý tưởng
Ghi lại nhanh mọi ý tưởng video. Mỗi ý tưởng chấm điểm theo 3 tiêu chí (1–5 điểm): mức hấp dẫn, độ khó sản xuất, tiềm năng view — danh sách tự sắp xếp theo điểm tổng để bạn biết nên làm ý tưởng nào trước. Bấm **"Chuyển thành video"** để đưa ý tưởng vào quy trình sản xuất (ý tưởng gốc sẽ chuyển vào thùng rác).

### 🗂️ Bảng Kanban
Kéo — thả video qua từng bước: Ý tưởng → Nghiên cứu → Viết kịch bản → Thu âm/Voice → Dựng video → Thumbnail → Đã lên lịch → Đã đăng. Dùng thanh lọc phía trên để lọc theo kênh, loại video (dài/Shorts), tag, hoặc gõ từ khóa để tìm kiếm. Trên điện thoại, **nhấn giữ** thẻ video một chút rồi kéo để di chuyển.

### 📅 Lịch
Xem lịch theo tháng hoặc theo tuần. Video có ngày đăng dự kiến hiện với biểu tượng 📤, video có hạn chót hiện với biểu tượng ⏰ — cả hai được tô theo màu kênh. Kéo thẻ sang ngày khác để đổi lịch, hoặc bấm vào một ô ngày trống để thêm video mới với ngày đăng đó.

### 📊 Thống kê
So sánh lượt xem giữa các video/kênh, xem top video tốt nhất của mỗi kênh, số video hoàn thành theo từng tháng, và thời gian trung bình từ lúc tạo ý tưởng đến lúc đăng video. Số liệu lấy từ tab **"Hiệu quả"** mà bạn nhập tay trong từng video.

### 🗑️ Thùng rác
Video/ý tưởng bị xóa sẽ nằm ở đây trong **30 ngày** trước khi bị xóa vĩnh viễn. Bạn có thể **Khôi phục** bất cứ lúc nào trong 30 ngày đó.

### ⚙️ Cài đặt
- Quản lý kênh: đổi tên, màu, mô tả, mục tiêu đăng bài mỗi tuần, lưu trữ (archive) kênh không dùng nữa, hoặc thêm kênh mới.
- Sửa **mẫu checklist** và **mẫu mô tả video** riêng cho từng kênh (bấm nút "Mẫu checklist & mô tả" trên mỗi kênh).
- Xuất / nhập dữ liệu, xem danh sách bản sao lưu tự động, xóa dữ liệu mẫu, đổi giao diện sáng/tối, đổi tốc độ đọc mặc định.
- Bảng phím tắt.

## 3. Thẻ video (bấm vào một video để mở)

Mỗi video có các tab:

| Tab | Nội dung |
|---|---|
| Thông tin | Series, hạn chót, ngày đăng, tag, ghi chú |
| Checklist | Danh sách công việc cần làm, tick hoàn thành, áp dụng lại mẫu của kênh |
| Nghiên cứu | Danh sách nguồn tham khảo (tên, link, ghi chú) |
| Kịch bản | Soạn kịch bản, tự đếm số chữ và ước tính thời lượng đọc, chia phần bằng dấu `#`, sao chép hoặc xuất file .txt, mở **Teleprompter** để chạy chữ khi thu âm |
| Tiêu đề & Thumbnail | Nhiều phương án tiêu đề (cảnh báo khi quá 60 ký tự, chọn phương án ưng ý), ý tưởng chữ trên thumbnail |
| Mô tả & Tag | Điền tiêu đề vào mẫu mô tả của kênh, danh sách chương (chapters) theo mốc thời gian, sao chép một chạm |
| Tài nguyên | Nhạc/hình/footage đã dùng (tên, nguồn, loại giấy phép, link) — tự tạo đoạn credit để dán vào mô tả, tránh gậy bản quyền |
| Liên kết | Link Google Drive, link kịch bản ngoài, link YouTube sau khi đăng |
| Shorts liên quan | Gắn các Shorts được cắt ra từ video dài này, hoặc tạo Short mới liên kết luôn |
| Hiệu quả | Nhập tay lượt xem, lượt thích, bình luận, CTR, thời lượng xem trung bình ở mốc 48 giờ / 7 ngày / 30 ngày |

Nút **"Nhân bản"** ở đầu thẻ giúp sao chép toàn bộ video (hữu ích khi làm series); nút **"Xóa"** chuyển video vào thùng rác.

### Chế độ Teleprompter
Mở từ tab Kịch bản. Chỉnh tốc độ cuộn và cỡ chữ bằng thanh trượt, bấm phím **Space** để tạm dừng/tiếp tục, bấm **Esc** hoặc nút ✕ để đóng.

## 4. Phím tắt

| Phím | Chức năng |
|---|---|
| `N` | Thêm video mới |
| `I` | Thêm ý tưởng mới |
| `/` | Focus vào ô tìm kiếm |
| `Ctrl + Z` | Hoàn tác thao tác vừa làm |
| `Esc` | Đóng hộp thoại / thoát Teleprompter |
| `Space` | Tạm dừng/tiếp tục Teleprompter |

## 5. Sao lưu & khôi phục dữ liệu

Ứng dụng tự động lưu mọi thay đổi vào trình duyệt (localStorage) và tự giữ **5 bản sao lưu gần nhất** (mỗi bản cách nhau ít nhất 10 phút hoạt động). Vào **Cài đặt → Bản sao lưu tự động** để xem và khôi phục nếu cần.

⚠️ **Quan trọng:** bản sao lưu tự động chỉ nằm *trong trình duyệt này*. Nếu đổi máy, đổi trình duyệt, hoặc trình duyệt bị xóa dữ liệu, bạn sẽ mất toàn bộ nội dung nếu chưa xuất file. Vì vậy:

- Vào **Cài đặt → Xuất dữ liệu (.json)** thường xuyên (ứng dụng sẽ tự nhắc nếu đã hơn 7 ngày bạn chưa xuất).
- File xuất ra có dạng `ytcm-backup-YYYY-MM-DD.json` — nên lưu vào Google Drive/USB để an toàn.
- Khi cần khôi phục (máy mới, hoặc lỡ tay xóa): **Cài đặt → Nhập dữ liệu**, chọn file `.json` đã lưu. Ứng dụng sẽ hỏi xác nhận trước khi ghi đè dữ liệu hiện tại.

## 6. Cách bật GitHub Pages (không cần biết code)

Nếu bạn muốn có một địa chỉ web riêng để mở ứng dụng từ bất kỳ đâu (thay vì chỉ mở file trên máy):

1. Tạo một tài khoản GitHub (miễn phí) tại github.com nếu chưa có.
2. Tạo một **repository** mới (ví dụ đặt tên `quan-ly-youtube`), chọn **Public**.
3. Tải lên (upload) 2 file `index.html` và `README.md` trong thư mục này vào repository đó (dùng nút "Add file → Upload files" trên trang GitHub).
4. Vào **Settings → Pages** của repository, ở mục "Branch" chọn `main` (hoặc `master`) và thư mục `/ (root)`, rồi bấm **Save**.
5. Sau khoảng 1–2 phút, GitHub sẽ cung cấp một địa chỉ dạng `https://ten-tai-khoan.github.io/quan-ly-youtube/` — đó chính là ứng dụng của bạn, dùng được trên điện thoại và máy tính.

Lưu ý: vì dữ liệu lưu theo trình duyệt + địa chỉ web, hãy luôn dùng **đúng một địa chỉ** (chỉ file local, hoặc chỉ GitHub Pages) để không bị lẫn dữ liệu giữa hai nơi. Nhớ vẫn xuất file `.json` định kỳ để sao lưu an toàn.

## 7. Câu hỏi thường gặp

**Tôi lỡ xóa nhầm một video, làm sao lấy lại?**
Vào **Thùng rác**, tìm video đó và bấm **Khôi phục** (còn hiệu lực trong 30 ngày). Hoặc bấm **Hoàn tác** (nút ↩️ trên cùng, hoặc `Ctrl+Z`) ngay sau khi xóa.

**Tôi mở ứng dụng trên điện thoại thì dữ liệu có giống trên máy tính không?**
Không tự động — dữ liệu lưu riêng theo từng trình duyệt/thiết bị. Hãy dùng **Xuất/Nhập dữ liệu** để chuyển dữ liệu giữa các thiết bị, hoặc luôn dùng địa chỉ GitHub Pages giống nhau trên mọi thiết bị (dữ liệu vẫn lưu riêng trên từng máy, chỉ là giao diện giống nhau — bạn vẫn cần xuất/nhập để đồng bộ).

**Làm sao xóa hết dữ liệu mẫu để dùng dữ liệu thật của tôi?**
Vào **Cài đặt → Xóa dữ liệu mẫu**.

**Tôi có thể thêm kênh thứ 4, thứ 5 không?**
Có. Vào **Cài đặt → Thêm kênh mới**, đặt tên, chọn màu, mô tả và mục tiêu đăng bài.

---

Chúc bạn sản xuất nội dung năng suất! 🎬
