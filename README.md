# 👑 TỔ CAM — LOCKET VIP & LOCKET GOLD SYSTEM V2

Hệ thống bán và kích hoạt bản quyền **Locket VIP Pro (Quay 60s & 49+ Bộ Lọc Camera AI)** và **Locket Gold Thường** tự động 100%, thiết kế chuẩn phong cách [heylocket.xyz](https://heylocket.xyz) với trang Quản Trị Admin chuyên nghiệp.

---

## 🌟 Điểm Nổi Bật

### 1. Phân Loại 2 Dòng Sản Phẩm:
* **👑 LOCKET VIP PRO (Độc Quyền 49+ AI Filter):**
  * **Giá Bán:**
    * 1 Năm: **75.000đ**
    * 2 Năm: **95.000đ**
    * Vĩnh Viễn: **150.000đ**
  * **Tính Năng Độc Quyền:**
    * ⏱️ Quay video siêu dài **60 GIÂY** (gấp đôi bản thường)
    * 📸 Filter **Photobooth 4 ô kakka** phong cách Hàn Quốc/Y2K
    * 🎁 Filter **Xé Túi Mù May Mắn** trúng tiền thật 10k - 50k quét mã QR ngân hàng thật
    * 🎵 Tặng kèm **Spotify Premium** nghe nhạc bản quyền
    * 👑 Huy hiệu Vương Miện VIP độc quyền
    * 🔌 Đấu nối trực tiếp hệ thống **Kawaii Locket Gold CTV** (`https://ctv.nodns.vn`); cấu hình API Key riêng trong môi trường deploy.
* **🍊 LOCKET GOLD THƯỜNG (Tiêu Chuẩn):**
  * **Giá Bán:** Test 3 ngày: **9.000đ** • 6 Tháng: **39.000đ** • 1 Năm: **69.000đ** • Vĩnh Viễn: **99.000đ**
  * **Tính Năng:** Quay video 30s, up ảnh/video album, mở khoá bạn bè, đổi icon, không quảng cáo.
  * 🔌 Đấu nối hệ thống **Locket Cụ Cam** (`https://locket.2707226.xyz`).

---

### 2. Trang Quản Trị Admin Chuyên Nghiệp (`/admin`):
* **Đăng nhập bảo mật:** Mật khẩu mặc định `admin123` (có thể đổi tùy ý).
* **📊 Thống kê & Tổng quan:** Doanh thu hôm nay, tổng doanh thu, số đơn VIP/Thường, số dư ví và lượt VIP trực tiếp từ API Kawaii.
* **🛒 Quản lý đơn hàng:** Danh sách đơn, nút **1-Click "Kích Hoạt API"**, duyệt thủ công, link DNS.
* **💰 Quản lý giá & gói cước:** Tùy ý bật/tắt, sửa giá tiền (75k, 95k, 150k, 9k, 39k, 69k, 99k) hoặc tạo mức giá mới.
* **💳 Cấu hình thanh toán:** Đổi ngân hàng, số tài khoản, tên chủ thẻ, tạo mã VietQR Napas 24/7 tự động.
* **🔌 Cấu hình API CTV:** Đổi API Key Kawaii / Cụ Cam, nút **Test Kết Nối API & kiểm tra số dư ví**.
* **🌐 Cài đặt giao diện:** Tên website, slogan, hotline, link Zalo, banner thông báo chạy chữ.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Bước 1: Mở thư mục code
```bash
cd "C:\Users\Admin\Downloads\weblocket\locket víp"
```

### Bước 2: Cài đặt thư viện (nếu chạy lần đầu)
```bash
npm install
```

### Bước 3: Khởi động Server
```bash
npm start
```

* **Trang web khách hàng:** [http://localhost:3000](http://localhost:3000)
* **Trang quản trị Admin:** [http://localhost:3000/admin](http://localhost:3000/admin) *(Mật khẩu mặc định: `admin123`)*

## Deploy Render với PostgreSQL

1. Tạo PostgreSQL database trên Render và lấy **External Database URL**.
2. Nếu cần giữ dữ liệu local, đặt tạm URL này vào `.env` với tên `DATABASE_URL`, bảo đảm database chưa có collection `app_data`, rồi chạy `npm start` tại máy local. Lần khởi động đầu sẽ nhập các file JSON local vào database. Chờ log `[DATABASE] PostgreSQL đã kết nối` rồi dừng server local.
3. Tạo Web Service trên Render từ repository này, dùng Build Command `npm ci` và Start Command `npm start`.
4. Thêm biến `DATABASE_URL` cho Web Service bằng **Internal Database URL** của PostgreSQL. Render cần biến môi trường `PORT` do nền tảng cấp; server đã tự đọc biến này.
5. Deploy Web Service. Server tạo bảng `app_data` khi khởi động; dữ liệu cũ không bị ghi đè nếu collection đã có trong database.

Nếu không cần dữ liệu local, có thể bỏ bước nhập dữ liệu; database sẽ tạo cấu hình từ `data/settings.example.json` và các collection còn lại bắt đầu rỗng. Cấu hình key API trong admin sau khi deploy. Không đưa `.env` hoặc `data/*.json` lên GitHub.

Lưu ý: đơn hàng, settings, tài khoản và dữ liệu CTV được lưu trong PostgreSQL. Ảnh tải lên từ trang admin hiện vẫn ghi vào thư mục `images`; muốn giữ ảnh upload qua các lần deploy cần thêm persistent disk hoặc object storage.

Storage adapter hiện cache các collection trong bộ nhớ của process; giữ Web Service một instance trên Render. Không bật nhiều replica trước khi chuyển các collection sang truy vấn theo từng dòng.

