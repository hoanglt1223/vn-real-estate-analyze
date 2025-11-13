# Real Estate Data Integration Guide

## Tích hợp dữ liệu thực từ các nguồn bất động sản Việt Nam

### ⚠️ Kết quả nghiên cứu API (November 2025)

**Kết luận:** Không có website bất động sản Việt Nam nào cung cấp **Public API** chính thức cho developers.

#### Batdongsan.com.vn
- ❌ **Không có Public API**
- 🛡️ Cloudflare protection (HTTP 403) chống scraping trực tiếp
- 📧 Có thể liên hệ PropertyGuru Group (chủ sở hữu) để xin data partnership
- ✅ **Giải pháp**: Apify scraper (`minhlucvan/batdongsan-scraper`) - xem bên dưới

#### Chotot.com
- ❌ **Không có Public API** 
- 🔐 Cần login để lấy access token (nhưng không dành cho developers)
- 📧 Có thể liên hệ qua GitHub: https://github.com/ChoTotOSS

#### Các nguồn khác đã kiểm tra
- ✅ **Vietnam Provinces API**: https://provinces.open-api.vn/ (chỉ có data địa danh)
- ❌ Alonhadat.com.vn: Không có public API
- ❌ Muaban.net: Không có public API

### Tình trạng hiện tại

Hiện tại ứng dụng sử dụng **mock data** (dữ liệu giả) dựa trên vị trí địa lý để ước tính giá. Lý do:

1. **Batdongsan.com.vn**: Không có official API, có Cloudflare protection
2. **Chotot.com**: Không có public API cho developers
3. **Legal concerns**: Scraping trực tiếp có thể vi phạm Terms of Service

### Các phương án tích hợp

#### Option 1: Apify Scraper (Recommended - Dễ nhất)

**Apify Batdongsan Scraper** - Ready-to-use service
- **Actor**: `minhlucvan/batdongsan-scraper`
- **Pricing**: Free tier + pay-per-use
- **Setup time**: 5 phút
- **Pros**: Không cần maintain code, bypass Cloudflare tự động
- **Cons**: Có chi phí, phụ thuộc third-party

**Cách dùng:**

1. Đăng ký tài khoản Apify: https://apify.com/
2. Lấy API token từ Settings → Integrations
3. Call API:

```bash
curl "https://api.apify.com/v2/acts/minhlucvan~batdongsan-scraper/runs" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_APIFY_TOKEN" \
  -d '{
    "startUrls": [{
      "url": "https://batdongsan.com.vn/nha-dat-ban/tp-hcm"
    }],
    "maxItems": 100
  }'
```

4. Lấy kết quả:
```bash
curl "https://api.apify.com/v2/datasets/{datasetId}/items" \
  -H "Authorization: Bearer YOUR_APIFY_TOKEN"
```

**Integration vào app:**
```typescript
// server/services/scraper.ts
async function fetchFromBatdongsan(lat: number, lng: number, radius: number) {
  const APIFY_TOKEN = process.env.APIFY_API_KEY;
  
  if (!APIFY_TOKEN) {
    return generateMockListings('batdongsan', lat, lng, radius, 15);
  }

  try {
    // Start actor run
    const runResponse = await fetch(
      'https://api.apify.com/v2/acts/minhlucvan~batdongsan-scraper/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_TOKEN}`
        },
        body: JSON.stringify({
          startUrls: [{
            url: `https://batdongsan.com.vn/nha-dat-ban/tp-hcm?lat=${lat}&lng=${lng}`
          }],
          maxItems: 50
        })
      }
    );

    const run = await runResponse.json();
    const datasetId = run.data.defaultDatasetId;

    // Wait and fetch results
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for scraping
    
    const dataResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
      }
    );

    const items = await dataResponse.json();
    return parseApifyResults(items);
  } catch (error) {
    console.error('Apify error:', error);
    return generateMockListings('batdongsan', lat, lng, radius, 15);
  }
}
```

#### Option 2: Official Partnership (Tốt nhất cho production)

**Batdongsan.com.vn (PropertyGuru Group):**
- Liên hệ: https://batdongsan.com.vn/lien-he
- Email: contact@batdongsan.com.vn
- Phone: 1900 1881
- Yêu cầu data partnership hoặc B2B API access
- Thường có phí theo số lượng requests

**Chotot.com:**
- GitHub: https://github.com/ChoTotOSS
- Liên hệ qua business development team
- Không có public developer portal

**Implementation:**
```typescript
// server/services/scraper.ts

async function fetchFromBatdongsan(lat: number, lng: number, radius: number) {
  const apiKey = process.env.BATDONGSAN_API_KEY;
  if (!apiKey) {
    return generateMockListings('batdongsan', lat, lng, radius, 15);
  }

  try {
    const response = await fetch(`https://api.batdongsan.com.vn/listings?lat=${lat}&lng=${lng}&radius=${radius}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    return parseListings(data);
  } catch (error) {
    console.error('Batdongsan API error:', error);
    return generateMockListings('batdongsan', lat, lng, radius, 15);
  }
}
```

#### Option 3: Vietnam Provinces API (Miễn phí - Chỉ địa danh)

**API chính thức cho địa danh Việt Nam:**
- **URL**: https://provinces.open-api.vn/
- **GitHub**: https://github.com/hongquan/vn-open-api-provinces
- **Tech**: FastAPI (Python)
- **Data**: Tỉnh/thành phố, quận/huyện, phường/xã

**Endpoints:**
```bash
# Lấy danh sách tỉnh
GET https://provinces.open-api.vn/api/p/

# Lấy danh sách quận của tỉnh
GET https://provinces.open-api.vn/api/p/{province_code}

# Lấy danh sách phường của quận
GET https://provinces.open-api.vn/api/d/{district_code}
```

**Use case**: Tạo dropdown filter địa điểm, validate địa chỉ, enrich location data

**Integration:**
```typescript
// Fetch provinces for search filters
const provinces = await fetch('https://provinces.open-api.vn/api/p/').then(r => r.json());

// Validate if address belongs to a specific province
const hcmData = await fetch('https://provinces.open-api.vn/api/p/79').then(r => r.json());
```

#### Option 4: Browser Automation (Advanced - Tự build)

Sử dụng Puppeteer hoặc Playwright để bypass Cloudflare:

```bash
npm install puppeteer
```

```typescript
import puppeteer from 'puppeteer';

async function scrapeBatdongsan(lat: number, lng: number) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport and user agent to appear like real browser
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0...');
  
  // Navigate and wait for content
  await page.goto(`https://batdongsan.com.vn/nha-dat-ban/tp-hcm`, {
    waitUntil: 'networkidle2'
  });
  
  // Extract data
  const listings = await page.evaluate(() => {
    // DOM parsing logic here
  });
  
  await browser.close();
  return listings;
}
```

**Lưu ý:**
- Tốn nhiều tài nguyên (RAM, CPU)
- Chậm hơn API calls
- Vẫn có thể bị block
- Cần respect robots.txt và rate limits

#### Option 5: Commercial Scraping Services

Một số service cung cấp aggregated real estate data:

- **PropStack**: https://propstack.vn
- **OneHousing**: https://onehousing.com.vn/developer
- **Các công ty dữ liệu bất động sản khác**

#### Option 6: Undocumented Endpoints (Rủi ro cao)

**Browser Network Inspection:**
1. Mở https://batdongsan.com.vn
2. F12 → Network tab
3. Tìm các API calls (thường là `https://api.batdongsan.com.vn/...`)
4. Copy request headers, cookies
5. Replicate trong code

**⚠️ Warnings:**
- Endpoints không documented, có thể thay đổi bất kỳ lúc nào
- Cần handle cookies, CSRF tokens
- Rate limiting nghiêm ngặt
- Có thể vi phạm TOS

#### Option 7: Crowdsourced Data

- Cho phép users submit prices họ biết
- Xây dựng database riêng từ community
- Moderate để đảm bảo chất lượng

### Cải thiện Mock Data (Temporary Solution)

Trong khi chờ tích hợp real API, mock data đã được cải thiện:

```typescript
// Includes realistic listings with:
- Price variations based on location
- Different property sizes (50-300 sqm)
- Real street names
- Source attribution
- Posted dates
- Price per square meter
```

### Environment Variables Cần thiết

Thêm vào `.env`:

```bash
# Apify Scraper (Option 1 - Recommended)
APIFY_API_KEY=apify_api_xxxxxxxxxxxxxxxxxxxxx

# Vietnam Provinces API (Option 3 - Free, no key needed)
# No API key required

# Official APIs (Option 2 - Nếu có partnership)
BATDONGSAN_API_KEY=your_official_key_here
CHOTOT_API_KEY=your_official_key_here

# Commercial services (Option 5)
PROPSTACK_API_KEY=your_key_here
```

**Cách lấy Apify API Key:**
1. Đăng ký: https://console.apify.com/sign-up
2. Vào Settings → Integrations
3. Copy "Personal API token"
4. Free tier: 5 USD credit/month (đủ cho ~500-1000 scrapes)

### Testing với Real Data

Khi có API key, test như sau:

```bash
# Set environment variable
export BATDONGSAN_API_KEY=your_key

# Restart server
npm run dev

# Test API endpoint
curl http://localhost:5000/api/analyze-property \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [[106.6297, 10.8231], ...],
    "radius": 1000,
    "categories": ["education"],
    "layers": ["roads"]
  }'
```

### Rate Limiting và Caching

Để tránh spam API và tiết kiệm costs:

```typescript
// Implement caching
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const priceCache = new Map<string, { data: MarketPriceData; timestamp: number }>();

export async function scrapeMarketPrices(lat: number, lng: number, radius: number) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchRealData(lat, lng, radius);
  priceCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}
```

### Legal Considerations

⚠️ **Quan trọng:**

1. **Đọc Terms of Service** của mỗi website
2. **Respect robots.txt**
3. **Rate limiting** - không spam requests
4. **Attribution** - credit nguồn data
5. **Commercial use** - có thể cần license

### Recommended Implementation Path

**Giai đoạn 1: Prototype/MVP (1-2 tuần)**
```
1. ✅ Sử dụng mock data (hiện tại)
2. ⏳ Thêm Vietnam Provinces API cho location autocomplete
3. ⏳ Test Apify scraper với free tier
```

**Giai đoạn 2: Beta/Soft Launch (1 tháng)**
```
4. ⏳ Subscribe Apify (starting $49/month)
5. ⏳ Implement caching (Redis/PostgreSQL)
6. ⏳ Add fallback: Apify → Mock data
```

**Giai đoạn 3: Production (3-6 tháng)**
```
7. ⏳ Liên hệ PropertyGuru/Batdongsan cho official partnership
8. ⏳ Migrate từ Apify → Official API (nếu có)
9. ⏳ Scale với multiple data sources
```

### So sánh các options

| Option | Cost | Setup Time | Reliability | Legal Risk | Best For |
|--------|------|------------|-------------|------------|----------|
| **Mock Data** | Free | ✅ Done | Medium | None | MVP/Demo |
| **Apify Scraper** | $49+/mo | 1 hour | High | Low | Beta/Soft launch |
| **Official API** | $$$$ | 1-3 months | Very High | None | Production |
| **DIY Scraper** | Free/Server | 1-2 weeks | Medium | Medium | Learning/Custom |
| **Provinces API** | Free | 30 mins | High | None | All stages |

### Next Steps

**Ngay bây giờ (15 phút):**
1. ✅ Mock data structure đã sẵn sàng
2. ⬜ Đăng ký Apify free account: https://apify.com/
3. ⬜ Test scraper trong Apify Console
4. ⬜ Thêm APIFY_API_KEY vào `.env`

**Tuần tới:**
5. ⬜ Implement Apify integration trong `scraper.ts`
6. ⬜ Add Vietnam Provinces API cho location search
7. ⬜ Test với real data

**Tháng tới:**
8. ⬜ Liên hệ Batdongsan/Chotot để xin partnership
9. ⬜ Implement caching layer
10. ⬜ Monitor API usage và costs

### Contact Information

**Batdongsan.com.vn:**
- Email: contact@batdongsan.com.vn
- Phone: 1900 1881
- Address: Tầng 31, Landmark 81, Vinhomes Central Park, TP.HCM

**Chotot.com:**
- Email: developers@chotot.com
- Developer portal: https://developers.chotot.com

---

## Quick Start Guide

### Test Apify Scraper (5 phút)

1. **Đăng ký Apify:**
```bash
# Visit https://console.apify.com/sign-up
# Get $5 free credit
```

2. **Test trong Console:**
```
- Go to: https://apify.com/minhlucvan/batdongsan-scraper
- Click "Try for free"
- Input: { "startUrls": [{"url": "https://batdongsan.com.vn/nha-dat-ban/tp-hcm"}] }
- Click "Start"
- Wait 30-60s → View results
```

3. **Lấy API Token:**
```
- Settings → Integrations → Copy "Personal API token"
```

4. **Add to .env:**
```bash
APIFY_API_KEY=apify_api_xxxxxxxxxxxxxxxxxxxxx
```

5. **Restart app:**
```bash
npm run dev
```

### Test Provinces API (ngay lập tức)

```bash
# Lấy danh sách tỉnh
curl https://provinces.open-api.vn/api/p/

# Lấy thông tin TP.HCM
curl https://provinces.open-api.vn/api/p/79

# Lấy quận của TP.HCM
curl https://provinces.open-api.vn/api/p/79?depth=2
```

---

## Resources

**Apify:**
- Batdongsan Scraper: https://apify.com/minhlucvan/batdongsan-scraper
- API Docs: https://docs.apify.com/api/v2
- Pricing: https://apify.com/pricing

**Provinces API:**
- Endpoint: https://provinces.open-api.vn/
- GitHub: https://github.com/hongquan/vn-open-api-provinces
- Free, no authentication

**Official Contacts:**
- Batdongsan: 1900 1881, contact@batdongsan.com.vn
- PropertyGuru: https://www.propertyguru.com.sg/contact
- Chotot GitHub: https://github.com/ChoTotOSS

---

**Last Updated:** November 13, 2025  
**Status:** Mock data active, Apify integration ready, awaiting API keys  
**Research Completed:** All major Vietnamese real estate portals checked - no public APIs available
