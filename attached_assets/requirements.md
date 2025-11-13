# 🚀 **PHÁT TRIỂN ỨNG DỤNG PHÂN TÍCH BẤT ĐỘNG SẢN VIỆT NAM**

Bạn là hệ thống phát triển một ứng dụng web phân tích bất động sản tại Việt Nam.
Hãy xây dựng toàn bộ chức năng theo mô tả dưới đây.

---

## **🧩 1. Business Requirements**

### **A. Nhập dữ liệu bất động sản**

* Người dùng nhập tọa độ (lat/lng) hoặc vẽ polygon khu đất.
* Tự tính:

  * diện tích
  * hướng đất
  * số mặt tiền (dựa vào đường OSM)
* Hiển thị khu đất trên bản đồ.

---

### **B. Tiện ích xung quanh (ưu tiên dữ liệu miễn phí)**

Quét tiện ích theo bán kính tùy chọn (100m → 5km).

Nhóm tiện ích:

* **Giáo dục:** mầm non, tiểu học, THCS, THPT, đại học.
* **Y tế:** bệnh viện, phòng khám, nhà thuốc.
* **Mua sắm:** siêu thị, cửa hàng tiện lợi, trung tâm thương mại.
* **Giải trí – dịch vụ:** rạp phim, gym, chuỗi quán ăn lớn.

Dữ liệu ưu tiên:

* OpenStreetMap Overpass API (miễn phí)
* Google Places API (chỉ fallback khi thiếu)

---

### **C. Quy hoạch – hạ tầng – rủi ro**

* Overlay quy hoạch từ cổng thông tin tỉnh/thành (WMS/WFS).
* Tìm và hiển thị:

  * đường lớn, metro, cầu
  * khu công nghiệp
  * trạm điện
  * nghĩa trang
  * sông, kênh rạch
* Phát hiện rủi ro:

  * đất nằm gần khu ô nhiễm
  * sát nghĩa trang
  * sát trạm điện cao thế
  * đường cụt, hẻm nhỏ < 3m

---

### **D. Giá thị trường & lịch sử giá**

* Thu thập giá bất động sản xung quanh qua crawler:

  * Batdongsan.com.vn
  * Chotot Nhà Đất
* Trích xuất:

  * giá rao trung bình theo loại tài sản
  * min – max – median
  * mật độ tin đăng khu vực
  * biểu đồ biến động giá (nếu crawl theo thời gian)
* Tạo **heatmap giá** trên bản đồ.

---

### **E. AI đánh giá – scoring – đề xuất**

Dùng AI phân tích dữ liệu đã thu thập.

AI output:

* Điểm tổng quan 0–100
* Điểm tiện ích
* Điểm quy hoạch – hạ tầng
* Điểm an cư vs đầu tư
* Điểm rủi ro
* Giá đề xuất hợp lý (ước tính)
* Gợi ý “nên mua / không nên mua”
* Tóm tắt ngắn gọn (≤ 200 chữ)

---

### **F. Báo cáo PDF**

* Tạo báo cáo đầy đủ:

  * bản đồ khu đất
  * tiện ích
  * quy hoạch
  * giá thị trường
  * biểu đồ
  * AI phân tích
* Cho phép tải xuống hoặc chia sẻ qua link.

---

## **🧰 2. Tech Stack Requirements**

### **Frontend**

* **Vite + React**
* **TailwindCSS**
* **Shadcn UI**
* Map:

  * **Mapbox GL JS** (free plan)
  * Mapbox Draw plugin (vẽ đất)
* Deploy: **Vercel** (static hosting)

---

### **Backend**

* **Express.js** (REST API)
* Deploy:

  * Vercel Serverless
  * hoặc Railway Free Tier

### **Dịch vụ phụ trợ**

* Cron Job: Vercel Cron / Railway Cron (free)
* Crawler: Playwright hoặc Cheerio

---

### **Database (tùy chọn)**

* **Vercel Postgres free**
* Hoặc **Railway PostgreSQL free**
* Cache tạm bằng JSON hoặc Vercel KV

---

### **External Services**

* Mapbox API
* OpenStreetMap Overpass API (tiện ích, giao thông, hạ tầng)
* Google Places API (fallback)
* Cổng thông tin quy hoạch tỉnh/thành (WMS/WFS)
* GPT-4o Mini cho phân tích AI

---

## **🎯 Output mong muốn**

* Ứng dụng web chạy trên Vercel
* Bản đồ tương tác Mapbox
* Tìm tiện ích – hạ tầng – quy hoạch dựa trên OSM + API quy hoạch
* Crawl dữ liệu giá theo bán kính
* AI phân tích theo mô hình scoring
* Báo cáo PDF xuất đẹp
* UI sạch, nhanh, dễ xem (Tailwind + Shadcn)

---