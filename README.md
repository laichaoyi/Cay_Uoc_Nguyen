# Cây ước nguyện / Wishing Tree

Game thư giãn 3D, bốn mùa, tiếng Việt và English. Bản v11 hỗ trợ điều ước dùng chung qua API Node.js.

## Chạy thử trên Windows

- Cài Node.js 20 trở lên.
- Giải nén toàn bộ dự án rồi nhấp `dev.bat` để chạy chế độ local như trước.
- Nhấp `dev-shared.bat` để thử điều ước dùng chung trên localhost. Dữ liệu thử được lưu trong `.data/wishes.json` (đã loại khỏi Git). Mở hai trình duyệt khác nhau để kiểm tra người thứ hai đọc được điều ước của người thứ nhất.

## Đưa lên GitHub

Tạo repository trống `Cay_Uoc_Nguyen` tại https://github.com/new thuộc tài khoản '[CỦA BẠN]'. Có thể đặt Private và cấp Render quyền đọc repository. Không chọn khởi tạo README hoặc .gitignore vì đã có sẵn.

Mở PowerShell tại thư mục dự án, ngang hàng với `package.json`:

```powershell
git init -b main
git add .
git commit -m "Wishing Tree v11 - shared wishes"
git remote add origin https://github.com/'[tên Tài Khoản CỦA BẠN]'/Cay_Uoc_Nguyen.git
git push -u origin main
```

Nếu đã có `origin`, dùng `git remote set-url origin https://github.com/'[Tài Khoản CỦA BẠN]'/Cay_Uoc_Nguyen.git`. Nếu đã có repo/commit, giữ lịch sử và chỉ commit các thay đổi mới. Không đẩy `.env`, khóa Supabase hoặc thư mục `.data` lên GitHub.

## Tạo database miễn phí trên Supabase

1. Đăng nhập https://supabase.com/dashboard và tạo project Free.
2. Mở SQL Editor, tạo truy vấn mới, dán toàn bộ nội dung `supabase.sql`, chọn Run. Đây là schema cho điều ước dùng chung.
3. Trong Connect hoặc Project Settings, lấy **Project URL** `https://<project-ref>.supabase.co` và **Secret key** `sb_secret_...` (hoặc legacy service_role key nếu project chưa có loại mới).
4. Chỉ nhập khóa này vào phần Environment của Render. Nó có quyền truy cập database và phải giữ kín.

## Triển khai Render Free Web Service

1. Vào https://dashboard.render.com, kết nối tài khoản GitHub.
2. Chọn New → Web Service, chọn `'[Tài Khoản h githhub CỦA BẠN]'/Cay_Uoc_Nguyen` (branch `main`).
3. Thiết lập Name `cay-uoc-nguyen`, Runtime Node, Instance Type Free, Build Command `npm ci`, Start Command `npm start`, Health Check Path `/health`.
4. Thêm các Environment Variables:

| Key | Value |
|---|---|
| `WISH_REQUIRE_DB` | `1` |
| `SUPABASE_URL` | Project URL ở bước database |
| `SUPABASE_SECRET_KEY` | Secret key ở bước database |

5. Deploy Web Service. Render sẽ cấp URL `https://<tên-thực-tế>.onrender.com` để chia sẻ cho người chơi. Không cần tạo Static Site riêng hoặc dùng GitHub Pages. Có thể chọn New → Blueprint để dùng `render.yaml` thay cho việc nhập cấu hình Web Service thủ công.
6. Kiểm tra `https://<tên-thực-tế>.onrender.com/health` trả về `{"ok":true,"shared":true}`. Mở game ở hai trình duyệt, gửi một điều ước bên A và đợi tối đa khoảng 20 giây để bên B thấy nó.

Điều ước mới được đồng bộ bằng HTTP polling. Mỗi trình duyệt ẩn danh gửi tối đa ba điều ước mỗi ngày theo giờ Việt Nam. Cây hiển thị tối đa 30 điều ước mới nhất trong vòng bảy ngày; điều ước quá hạn bị loại khỏi danh sách và được dọn khi phát sinh lượt gửi mới. Người đọc khác sẽ thấy nội dung và tên tùy chọn. Bản này đồng bộ điều ước, phòng nhiều người nhìn thấy nhân vật nhau và gửi bưu thiếp trực tuyến vẫn chưa có.

Render Free có thể ngủ sau 15 phút không nhận truy cập. Lượt truy cập đầu sau khi ngủ có thể chờ khoảng một phút. Filesystem Render không giữ các thay đổi khi restart, nên cung cấp database Supabase thay cho file local. Supabase Free có thể tạm dừng project nếu ít hoạt động trong bảy ngày; chủ project có thể khôi phục trong Dashboard nếu cần. Kiểm tra hạn mức miễn phí trên dashboard khi có nhiều người truy cập.

## Cập nhật game sau này

```powershell
git add .
git commit -m "Update Wishing Tree"
git push
```

Render mặc định tự deploy bản commit mới khi kết nối branch main và bật Auto-Deploy. Biến môi trường và database giữ nguyên qua lần cập nhật.


## Liên hệ tác giả: 

Andy Le : me@andyle.one - Facebook: facebook.com/ndle2
