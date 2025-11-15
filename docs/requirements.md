# 🚀 **PHÁT TRIỂN ỨNG DỤNG PHÂN TÍCH BẤT ĐỘNG SẢN VIỆT NAM**

Bạn là hệ thống phát triển một ứng dụng web phân tích bất động sản tại Việt Nam.
Hãy xây dựng toàn bộ chức năng theo mô tả dưới đây.

---

## **🧩 1. Business Requirements**

### **A. Nhập dữ liệu bất động sản**

* **Tìm kiếm địa chỉ:**
  * Autocomplete search box với Mapbox Geocoding API
  * Gợi ý địa điểm khi người dùng gõ
  * Tự động zoom đến địa điểm khi chọn
  * Tự động tạo polygon rectangle xung quanh điểm được chọn

* **Vẽ polygon thủ công:**
  * Sử dụng Mapbox Draw để vẽ khu đất
  * Hỗ trợ polygon tùy chỉnh

* **Tự động tính toán:**
  * Diện tích (m²)
  * Hướng đất (8 hướng: Bắc, Đông Bắc, Đông, Đông Nam, Nam, Tây Nam, Tây, Tây Bắc)
  * Số mặt tiền (dựa vào số đỉnh polygon)
  * Tọa độ trung tâm (lat/lng)

* **Hiển thị:**
  * Polygon với fill màu xanh transparency
  * Outline nét đứt
  * Center point marker

---

### **B. Tiện ích xung quanh (OpenStreetMap Overpass API)**

**Bán kính tùy chọn:** 100m → 5km (slider + quick presets)

**Nhóm tiện ích:**

#### 1. **Giáo dục** (category: `education`)
* Mầm non: `amenity=kindergarten`
* Tiểu học: `amenity=school` + `school:VI=tiểu học`
* THCS: `amenity=school` + `school:VI=trung học cơ sở`
* THPT: `amenity=school` + `school:VI=trung học phổ thông`
* Đại học: `amenity=university`, `amenity=college`

#### 2. **Y tế** (category: `healthcare`)
* Bệnh viện: `amenity=hospital`
* Phòng khám: `amenity=clinic`, `amenity=doctors`
* Nhà thuốc: `amenity=pharmacy`

#### 3. **Mua sắm** (category: `shopping`)
* Siêu thị: `shop=supermarket`, `shop=department_store`
* Cửa hàng tiện lợi: `shop=convenience`
* Trung tâm thương mại: `shop=mall`

#### 4. **Giải trí** (category: `entertainment`)
* Rạp phim: `amenity=cinema`
* Phòng gym: `leisure=fitness_centre`
* Nhà hàng: `amenity=restaurant`
* Café: `amenity=cafe`

**Output cho mỗi tiện ích:**
```json
{
  "id": "node/123456",
  "name": "Trường TH Lê Quý Đôn",
  "category": "education",
  "type": "school",
  "lat": 10.7769,
  "lon": 106.7009,
  "distance": 450,
  "tags": {
    "amenity": "school",
    "name": "Trường TH Lê Quý Đôn"
  }
}
```

**Hiển thị:**
* Markers với màu sắc theo category
* Icons: 🏫 (giáo dục), 🏥 (y tế), 🛒 (mua sắm), 🎭 (giải trí)
* Popup với tên + khoảng cách
* Clustering khi có nhiều markers

**Statistics Panel:**
* Tổng số tiện ích từng loại
* Top 10 gần nhất
* Biểu đồ phân bố theo khoảng cách
* Average distance per category

---

### **C. Quy hoạch – hạ tầng – rủi ro**

#### **Infrastructure Layers (OSM)**

1. **Đường lớn** (`roads`)
   * `highway=motorway`, `highway=trunk`, `highway=primary`
   * Highlight với màu vàng/cam
   * Tính khoảng cách đến đường lớn gần nhất

2. **Metro** (`metro`)
   * `railway=subway`, `railway=light_rail`
   * Vẽ metro lines
   * Markers cho stations

3. **Khu công nghiệp** (`industrial`)
   * `landuse=industrial`
   * Polygon overlay màu xám
   * Cảnh báo nếu < 500m

4. **Trạm điện** (`power`)
   * `power=plant`, `power=substation`
   * Risk marker màu đỏ
   * Cảnh báo nếu < 200m

5. **Nghĩa trang** (`cemetery`)
   * `landuse=cemetery`
   * Risk marker
   * Cảnh báo nếu < 500m

6. **Sông & kênh** (`water`)
   * `waterway=river`, `waterway=canal`
   * Polygon overlay màu xanh
   * Đánh giá rủi ro ngập lụt

#### **Risk Assessment**

```javascript
{
  "type": "Gần khu công nghiệp",
  "severity": "high", // high, medium, low
  "distance": 350,
  "description": "Khu đất nằm cách khu công nghiệp 350m, có thể ảnh hưởng đến chất lượng không khí",
  "mitigation": "Kiểm tra chất lượng môi trường trước khi quyết định"
}
```

**Risk Categories:**
* Ô nhiễm (industrial zones, highways)
* Tâm linh (cemeteries)
* An toàn (power plants)
* Ngập lụt (rivers, low elevation)
* Giao thông (đường cụt, hẻm nhỏ)

---

### **D. Giá thị trường & lịch sử giá**

#### **Data Sources**

1. **Batdongsan.com.vn**
   * Endpoint: Search by coordinates + radius
   * Parse: title, price, area, price per m², location, posted date
   * Filter: Đất nền, nhà riêng

2. **Chotot.com (Nhà Đất)**
   * Similar parsing
   * Cross-reference với Batdongsan

#### **Data Processing**

```javascript
{
  "marketData": {
    "source": "batdongsan",
    "listingsCount": 45,
    "averagePrice": "45 triệu/m²",
    "priceRange": "30-65 triệu/m²",
    "median": "42 triệu/m²",
    "recentListings": [
      {
        "title": "Bán đất mặt tiền đường Nguyễn Văn Linh",
        "price": "50 triệu/m²",
        "area": 100,
        "totalPrice": "5 tỷ",
        "postedDate": "2024-01-15",
        "link": "https://..."
      }
    ]
  }
}
```

#### **Visualization**
* Price heatmap overlay
* Chart: Price distribution
* Table: Recent comparable listings
* Trend: Price over time (if historical data available)

---

### **E. AI đánh giá – scoring – đề xuất**

**Input to AI (GPT-4o Mini):**
```javascript
{
  "property": {
    "area": 120,
    "orientation": "Đông Nam",
    "frontageCount": 4,
    "location": { lat, lng }
  },
  "amenities": [...],
  "infrastructure": {...},
  "marketData": {...},
  "risks": [...]
}
```

**AI Output:**
```javascript
{
  "scores": {
    "overall": 78,
    "location": 85,
    "amenities": 82,
    "infrastructure": 75,
    "potential": 80,
    "risk": 20
  },
  "estimatedPrice": "45-52 triệu/m²",
  "recommendation": "NÊN MUA", // hoặc "CÂN NHẮC", "KHÔNG NÊN"
  "summary": "Khu đất có vị trí tốt với nhiều tiện ích xung quanh. Hướng Đông Nam thuận lợi. Giá hiện tại hợp lý so với thị trường. Tiềm năng tăng giá trong 2-3 năm tới do quy hoạch metro gần đó.",
  "pros": [
    "Gần trường học và bệnh viện",
    "Có metro station trong bán kính 800m",
    "Hướng Đông Nam tốt cho sinh hoạt",
    "Giá thấp hơn trung bình khu vực 10%"
  ],
  "cons": [
    "Nằm gần đường lớn, có thể ồn",
    "Khu vực đang phát triển, chưa hoàn thiện hạ tầng",
    "Rủi ro ngập nhẹ khi mưa lớn"
  ],
  "investmentPotential": {
    "shortTerm": "medium",
    "longTerm": "high",
    "reasoning": "Khu vực đang phát triển, metro sẽ hoàn thành 2026"
  }
}
```

**AI Prompt Template:**
```
Bạn là chuyên gia phân tích bất động sản tại Việt Nam. Hãy đánh giá khu đất sau:

THÔNG TIN KHU ĐẤT:
- Diện tích: {area} m²
- Hướng: {orientation}
- Số mặt tiền: {frontageCount}

TIỆN ÍCH XUNG QUANH:
{amenities summary}

HẠ TẦNG:
{infrastructure summary}

GIÁ THỊ TRƯỜNG:
{market data summary}

RỦI RO:
{risks list}

Hãy đưa ra:
1. Điểm số chi tiết (0-100)
2. Giá ước tính hợp lý
3. Khuyến nghị mua/không mua
4. Tóm tắt 200 chữ
5. Ưu điểm và nhược điểm
6. Tiềm năng đầu tư

Format JSON theo schema đã định.
```

---

### **F. Báo cáo PDF**

**Cấu trúc PDF:**

1. **Cover Page**
   * Logo
   * Tiêu đề: "BÁO CÁO PHÂN TÍCH BẤT ĐỘNG SẢN"
   * Địa chỉ khu đất
   * Ngày tạo

2. **Thông tin tổng quan**
   * Diện tích, hướng, mặt tiền
   * Tọa độ
   * Screenshot bản đồ với polygon

3. **Tiện ích xung quanh**
   * Biểu đồ phân bố
   * Top 10 tiện ích gần nhất
   * Statistics table

4. **Hạ tầng & Quy hoạch**
   * Map với infrastructure layers
   * Danh sách đường lớn, metro gần đó
   * Risk assessment

5. **Giá thị trường**
   * Average price, range
   * Price heatmap screenshot
   * Comparable listings table

6. **AI Analysis**
   * Scores visualization (bar chart/radar chart)
   * Recommendation (highlight box)
   * Pros & Cons lists
   * Investment potential

7. **Footer**
   * Disclaimer: "Báo cáo mang tính chất tham khảo"
   * Contact info

**Technical:**
* Use jsPDF + html2canvas
* Capture map screenshots
* Generate charts with Recharts
* Vietnamese font support
* File size < 5MB

---

## **🧰 2. Tech Stack Requirements**

### **Frontend**

* **Framework:** Vite + React + TypeScript
* **Styling:** TailwindCSS + Shadcn UI
* **Map:** Mapbox GL JS
  * Mapbox Draw (polygon drawing)
  * Geocoding API (autocomplete search)
* **Charts:** Recharts
* **PDF:** jsPDF + html2canvas
* **State:** React Query (TanStack Query)
* **Router:** Wouter
* **Deploy:** Vercel

---

### **Backend**

* **Runtime:** Node.js + Express + TypeScript
* **Services:**
  * Overpass API client (amenities, infrastructure)
  * Web scraper (Playwright/Cheerio for market data)
  * OpenAI API client (AI analysis)
  * Geospatial calculations (Turf.js)
* **Database:** PostgreSQL (Neon/Railway)
  * Cache amenities
  * Store analysis history
  * Market data cache
* **Deploy:** Railway or Vercel Serverless

---

### **External Services**

1. **Mapbox**
   * Maps API (free: 50k loads/month)
   * Geocoding API (free: 100k requests/month)
   * Directions API (optional)

2. **OpenStreetMap**
   * Overpass API (free, rate limited)
   * Nominatim (geocoding fallback)

3. **OpenAI**
   * GPT-4o Mini (pay per use, cheap)
   * ~$0.15 per 1M input tokens

4. **Government Data**
   * WMS/WFS endpoints for planning data
   * Per-city/province basis

---

## **🎯 3. Implementation Phases**

### **Phase 1: Core Map Functionality** ✅
- [x] Mapbox integration
- [x] Polygon drawing
- [x] Property metrics calculation
- [x] Geocoding search (needs autocomplete)
- [x] Layer switching (satellite/streets)

### **Phase 2: Amenities & Infrastructure** 🔄 IN PROGRESS
- [x] Overpass API integration (backend)
- [ ] Real-time amenity fetching
- [ ] Marker visualization with clustering
- [ ] Filter by category (working backend, need frontend)
- [ ] Statistics dashboard
- [ ] Infrastructure layer overlays

### **Phase 3: Market Data** ✅ COMPLETED
- [x] Batdongsan scraper
- [x] Chotot scraper
- [x] Data parsing & storage
- [x] Price heatmap
- [x] Comparable listings table

### **Phase 4: AI Analysis** ✅
- [x] OpenAI integration
- [x] Scoring algorithm
- [x] Recommendation logic
- [ ] Improved prompts with real data
- [ ] Risk assessment AI

### **Phase 5: PDF Export** ✅
- [x] Basic PDF generation
- [ ] Map screenshots
- [ ] Charts integration
- [ ] Beautiful formatting
- [ ] Vietnamese font

### **Phase 6: Polish & Deploy** 🟡 IN PROGRESS
- [x] Responsive mobile UI
- [ ] Loading states & error handling
- [ ] Performance optimization
- [ ] SEO optimization
- [ ] Deploy to Vercel
- [ ] Analytics integration

---

## **📊 4. Data Flow**

```
User draws polygon
  ↓
Calculate metrics (area, orientation, center)
  ↓
User selects filters (amenities, radius, layers)
  ↓
Fetch amenities from Overpass API
  ↓
Fetch infrastructure from Overpass API
  ↓
Scrape market prices (Batdongsan, Chotot)
  ↓
Assess risks based on infrastructure
  ↓
Send all data to OpenAI for analysis
  ↓
Display results on map + sidebar
  ↓
User exports PDF report
```

---

## **🔧 5. API Endpoints**

### **Backend Routes**

```javascript
POST /api/analyze-property
Body: {
  coordinates: [[lng, lat], ...],
  radius: 1000,
  categories: ['education', 'healthcare'],
  layers: ['roads', 'metro']
}
Response: {
  id: "analysis-123",
  metrics: {...},
  amenities: [...],
  infrastructure: {...},
  marketData: {...},
  aiAnalysis: {...},
  risks: [...]
}

GET /api/analysis/:id
Response: Full analysis object

GET /api/recent-analyses?limit=10
Response: List of recent analyses

GET /api/amenities?lat=...&lng=...&radius=...&category=...
Response: List of amenities (cached)

GET /api/market-data?lat=...&lng=...&radius=...
Response: Market price data
```

---

## **🎨 6. UI/UX Requirements**

### **Layout**
* **Left sidebar** (320px):
  * Property input
  * Amenities filter
  * Infrastructure layers
  * Analyze button

* **Center** (flex-1):
  * Mapbox map
  * Search bar (top-left)
  * Layer controls (bottom-right)
  * Fullscreen button

* **Right sidebar** (320px, appears after analysis):
  * AI scores
  * Market data
  * Amenities list
  * Risk assessment

* **Header** (60px):
  * Logo
  * Export PDF button
  * Theme toggle

### **Color Scheme**
* Primary: Blue (#3B82F6)
* Success: Green (#10B981)
* Warning: Orange (#F59E0B)
* Danger: Red (#EF4444)
* Background: White/Gray

### **Vietnamese Language**
* All UI in Vietnamese
* Number formatting: "45 triệu/m²"
* Date formatting: "15/01/2024"
* Currency: VNĐ

---

## **🚀 7. Performance Targets**

* **Map load:** < 2s
* **Amenity search:** < 3s (with caching)
* **AI analysis:** < 10s
* **PDF generation:** < 5s
* **Bundle size:** < 500KB (gzipped)
* **Lighthouse score:** > 90

---

## **✅ 8. Testing Checklist**

- [ ] Draw polygon và tính metrics chính xác
- [ ] Search autocomplete hoạt động
- [ ] Filters fetch real data từ Overpass
- [ ] Markers hiển thị đúng vị trí
- [ ] Statistics cập nhật real-time
- [ ] Infrastructure layers toggle on/off
- [ ] AI analysis có ý nghĩa
- [ ] PDF export đầy đủ và đẹp
- [x] Mobile responsive
- [ ] Cross-browser (Chrome, Safari, Firefox)

---

## **📝 9. Documentation**

- [ ] README.md với setup instructions
- [ ] API documentation
- [ ] Component documentation
- [ ] Deployment guide
- [ ] User manual (Vietnamese)

---

## **🎯 Success Criteria**

1. ✅ User có thể vẽ polygon hoặc search địa chỉ
2. 🔄 Amenities hiển thị real-time với statistics
3. 🔴 Market data scraping hoạt động
4. ✅ AI analysis đưa ra đánh giá hợp lý
5. ✅ PDF export chuyên nghiệp
6. 🔴 App deployed và accessible
7. 🔄 Performance tốt (< 3s load time)
8. 🔴 Error handling robust

**Legend:** ✅ Done | 🔄 In Progress | 🔴 To Do

---

## **💡 Future Enhancements**

* Historical price tracking
* User accounts & saved analyses
* Comparison mode (multiple properties)
* Mobile app (React Native)
* Email reports
* Integration with real estate agencies
* 3D visualization
* VR/AR property viewing
