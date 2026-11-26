CÂY ƯỚC NGUYỆN / WISHING TREE
Bản đầy đủ v11 chạy local (EN/VI)

CHẠY TRÊN WINDOWS
1. Giải nén Cay_Uoc_Nguyen_FULL.zip vào thư mục bất kỳ.
2. Nhấp đúp dev.bat. Node.js phải đã được cài đặt.
3. Trình duyệt mở http://127.0.0.1:8080/ (hoặc cổng 8081–8090 nếu bị chiếm).
4. Nhấn Ctrl+C trong cửa sổ lệnh để tắt server.

- app.js, index.html, icon và audio đã nằm trong bản nén.
- Không cần tải ZIP gốc, chạy npm install hay áp dụng bản vá.
- Tiếng Việt mặc định; dùng nút English để đổi ngôn ngữ.
- Tên tiếng Việt: Cây ước nguyện. Tiếng Anh: Wishing Tree.

CẬP NHẬT BIỂN GỖ VÀ ÂM THANH THEO THỜI TIẾT
- Biển GLB thu nhỏ, đặt phía trước tán cây, có chữ Cây ước nguyện và bóng đổ.
  Kéo chuột trái/phải hoặc lên/xuống để camera xoay theo đúng hướng kéo.
- Nút Âm nền (M) bật/tắt âm thanh thiên nhiên mới. Nút Âm thanh (N)
  bật/tắt toàn bộ âm thanh. Bản thu được lặp và chuyển dần âm lượng.
- Ban ngày trời quang: chim hót và lá xào xạc.
- Ban đêm: gió nhẹ, chim và dế.
- Trời mù, nhiều mây hoặc chạng vạng: gió nhẹ.
- Mưa hoặc gió lớn: gió và lá, kết hợp âm mưa có sẵn.
- Mùa thu: gió qua lá khô; tuyết: gió mùa đông và tiếng quạ.
- Bảy bản thu do bạn cung cấp, nằm trong assets/ambience/. Mùa đông
  phối thêm file winter_wind.mp3 (winter-gust.mp3).

CHỌN MÙA
- Ô chọn bên cạnh đồng hồ: Tự động, Mùa xuân, Mùa hạ, Mùa thu, Mùa đông.
- Xuân: lá non, nhiều chim chóc, hoa mọc trong những cụm riêng biệt trên khoảng 40% vùng đồng cỏ; 60% vùng còn lại giữ cỏ xanh thông thoáng. Mỗi bông có cuống nối xuống đất và uốn theo gió.
- Hạ: quả chín mọc trên các cành, đung đưa theo gió rồi rụng, nảy nhẹ và nằm trên mặt cỏ.
- Thu: lá vàng bay dày hơn, theo gió lan khắp đồng cỏ.
- Đông: cây trụi lá, tuyết rơi dày, dấu giày theo từng bước đi.
- Chọn Tự động để trở về chu kỳ sự kiện tự nhiên.

CẬP NHẬT MÙA ĐÔNG
- Chỉ ba gờ rễ ngắn nổi nhẹ, nằm sát mặt đất và chìm dần.
- Cây chính, cây xa và rừng đồi rụng hết lá ở giữa mùa đông.
- Tuyết rơi dày trên vùng rộng quanh người chơi, phủ đồng cỏ, núi, đá và cành cây. Lá cũ biến mất khi mùa đông đến. Dấu giày mờ dần khi tuyết phủ lại.
- Tuyết tan, lá và cỏ mọc trở lại khi mùa đông kết thúc.

KIỂM TRA DATA ĐÃ TẢI
- index.html chứa HTML/CSS, app.js chứa mã client Three.js và dữ liệu tạo cảnh,
  trong đó nhiều ảnh/texture được nhúng, đủ cơ sở để thử chế độ chơi đơn.
- File sculpt-worker.js thiếu. Bản đầy đủ bật cơ chế xử lý trên luồng chính có
  sẵn trong app.js. Nếu máy yếu, tạo hình nhân vật có thể chậm hơn.
- Có 8 file tiếng Anh trong voices/ (ask1–ask4, got1–got4). Bản đầy đủ sửa đường
  dẫn và dùng hiệu ứng âm thanh dự phòng cho các câu chưa có file. Lời thoại
  có phụ đề theo ngôn ngữ chọn; giọng đọc tiếng Việt chưa được thu âm.
- ZIP thiếu mã máy chủ WebSocket /room và API /card, /cards/mine.
  Bản v11 đã có API riêng để người chơi cùng gửi và đọc điều ước.
  Phòng trực tuyến và gửi/nhận bưu thiếp qua mạng vẫn cần backend riêng.
  Xem README.md để triển khai miễn phí trên Render và Supabase.
- Chọn Gửi điều ước, nhập lời nhắn rồi nhấn giữ nút gửi. Điều ước
  được lưu trên trình duyệt trong 7 ngày, tối đa 3 điều ước mỗi ngày.
  Mở lại cùng địa chỉ localhost để đọc các điều ước đã gửi.
- Các file JavaScript phụ của tiện ích trình duyệt và CSS font ngoài không
  được tham chiếu bởi index.html. Máy chủ local phục vụ các tài nguyên
  cần thiết và dùng font hệ thống hỗ trợ dấu tiếng Việt.
- Đã kiểm tra cú pháp JavaScript, hai bảng ngôn ngữ, bước cài bản vá và HTTP
  cho HTML, app.js, icon và audio. Chưa xác nhận kết quả render WebGL thực tế
  do môi trường kiểm tra không có binary Chromium hoạt động.

NGUỒN GỐC
Bản Việt hóa từ các tệp Treegazing do bạn cung cấp. Các ghi công thư viện vẫn
được lưu trong app.js.

Biển gỗ: Wooden Sign - Baked Low Poly của JeffK (CC BY 4.0).
https://sketchfab.com/3d-models/wooden-sign-baked-low-poly-0d2fbde1a0a446a1b3bb808664a7e08a
https://creativecommons.org/licenses/by/4.0/
Đã thêm chữ tiếng Việt và điều chỉnh vị trí, tỷ lệ trong cảnh.
