# TODO - Vietnamese Real Estate Analysis App

## 🔴 CRITICAL - Cần làm ngay

### 1. Fix Mapbox Geocoding Search
- [ ] Thêm autocomplete dropdown cho search box
- [ ] Hiển thị danh sách gợi ý khi gõ (debounce 300ms)
- [ ] Tự động fill thông tin khu đất khi chọn địa điểm
- [ ] Tự động vẽ polygon rectangle quanh điểm được chọn

### 2. Fix Amenity Filters - Hiển thị thực tế
- [ ] Khi chọn filter Giáo dục/Y tế/Mua sắm - phải gọi API thực
- [ ] Hiển thị markers tiện ích lên bản đồ ngay khi có data
- [ ] Thêm statistics panel: số lượng từng loại tiện ích
- [ ] Group markers theo category với màu sắc riêng
- [ ] Popup chi tiết khi click vào marker

### 3. Infrastructure Layers - Hiển thị overlay
- [ ] Khi chọn "Đường lớn" - highlight roads từ OSM
- [ ] Khi chọn "Metro" - vẽ metro lines
- [ ] Khi chọn "Khu công nghiệp" - highlight industrial zones
- [ ] Khi chọn các layer khác - show heatmap/polygons

### 4. Statistics Dashboard
- [ ] Tạo panel thống kê tổng quan
- [ ] Biểu đồ phân bố tiện ích theo khoảng cách
- [ ] Bảng top 10 tiện ích gần nhất
- [ ] Số liệu cụ thể cho từng category

---

## 🟡 IMPORTANT - Cần hoàn thiện

### 5. Real-time Data Integration
- [ ] Kiểm tra Overpass API responses có data thật
- [ ] Cache amenities data để tránh gọi API liên tục
- [ ] Error handling khi API timeout hoặc fail
- [ ] Loading states cho mọi API calls

### 6. Map Improvements
- [ ] Fix "radius-circle" source duplicate error
- [ ] Thêm marker clustering cho nhiều amenities
- [ ] Thêm heatmap layer cho mật độ tiện ích
- [ ] 3D buildings layer (Mapbox feature)

### 7. PDF Export Enhancement
- [ ] Capture map với tất cả markers visible
- [ ] Thêm charts/graphs vào PDF
- [ ] Format đẹp hơn với colors và icons
- [ ] Compress PDF size

### 8. AI Analysis Improvements
- [ ] Thêm context về khoảng cách đến tiện ích
- [ ] Phân tích chi tiết hơn về infrastructure
- [ ] Risk assessment dựa trên real data
- [ ] Price estimation dựa trên market data thực

---

## 🟢 ENHANCEMENTS - Nâng cao

### 9. Market Data Scraping
- [ ] Implement crawler cho Batdongsan.com.vn
- [ ] Implement crawler cho Chotot
- [ ] Parse và store market prices
- [ ] Tạo price heatmap

### 10. UI/UX Polish
- [ ] Responsive design cho mobile
- [ ] Dark mode support
- [ ] Animations cho map transitions
- [ ] Better error messages in Vietnamese

### 11. Performance Optimization
- [ ] Debounce radius slider
- [ ] Lazy load amenity markers
- [ ] Virtual scrolling cho amenity list
- [ ] Optimize bundle size

### 12. Testing & Quality
- [ ] Test full workflow end-to-end
- [ ] Test với nhiều địa điểm khác nhau
- [ ] Test error cases
- [ ] Cross-browser testing

---

## 📋 DONE - Đã hoàn thành

- [x] Basic map với Mapbox GL
- [x] Polygon drawing tool
- [x] Property metrics calculation (area, orientation, frontage)
- [x] Backend API routes
- [x] OpenAI integration
- [x] Basic PDF export
- [x] Geocoding search (cần autocomplete)
- [x] Satellite/streets layer toggle
- [x] Basic amenity markers (cần real data)
- [x] Radius circle visualization

---

## 🐛 BUGS - Cần fix

1. **Mapbox source duplicate error** - "radius-circle" được add nhiều lần khi switch style
2. **Filters không gọi API** - Chọn category nhưng không fetch data mới
3. **Statistics không cập nhật** - Số liệu hardcoded thay vì real-time
4. **Search không autocomplete** - Chỉ search khi click button
5. **Map markers không clear** - Khi thay đổi filters, markers cũ vẫn còn

---

## 📝 NOTES

### API Limits
- Mapbox: 50,000 requests/month (free tier)
- OpenAI: Pay per use
- Overpass API: Rate limited, cần implement caching

### Data Sources
- Amenities: OpenStreetMap Overpass API
- Infrastructure: OSM + local government WMS/WFS
- Market prices: Web scraping (need to implement)
- AI Analysis: OpenAI GPT-4o Mini

### Performance Targets
- Map load time: < 2s
- Amenity search: < 3s
- AI analysis: < 10s
- PDF generation: < 5s
