# Real Estate Data Integration Guide

## Tích hợp dữ liệu thực từ Batdongsan.com.vn và Chotot.com

### Tình trạng hiện tại

Hiện tại ứng dụng sử dụng **mock data** (dữ liệu giả) dựa trên vị trí địa lý để ước tính giá. Lý do:

1. **Batdongsan.com.vn**: Website có bảo vệ Cloudflare (HTTP 403) chống scraping
2. **Chotot.com**: Cần API key hoặc partnership để truy cập data
3. **Legal concerns**: Scraping trực tiếp có thể vi phạm Terms of Service

### Các phương án tích hợp

#### Option 1: Official API Integration (Recommended)

**Batdongsan.com.vn:**
- Liên hệ phòng kinh doanh: https://batdongsan.com.vn/lien-he
- Yêu cầu API access hoặc data partnership
- Thường có phí theo số lượng requests

**Chotot.com:**
- Developer Portal: https://developers.chotot.com
- API documentation có thể có sẵn
- Đăng ký developer account để lấy API key

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

#### Option 2: Browser Automation (Advanced)

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

#### Option 3: Third-party Data Providers

Một số service cung cấp aggregated real estate data:

- **PropStack**: https://propstack.vn
- **OneHousing**: https://onehousing.com.vn/developer
- **Các công ty dữ liệu bất động sản khác**

#### Option 4: Crowdsourced Data

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
# Real Estate Data APIs
BATDONGSAN_API_KEY=your_api_key_here
CHOTOT_API_KEY=your_api_key_here

# Optional: Third-party aggregators
PROPSTACK_API_KEY=your_key_here
```

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

### Next Steps

1. ✅ Mock data structure đã sẵn sàng
2. ⏳ Liên hệ Batdongsan/Chotot để xin API access
3. ⏳ Implement API integration khi có keys
4. ⏳ Add caching layer
5. ⏳ Monitor API usage và costs

### Contact Information

**Batdongsan.com.vn:**
- Email: contact@batdongsan.com.vn
- Phone: 1900 1881
- Address: Tầng 31, Landmark 81, Vinhomes Central Park, TP.HCM

**Chotot.com:**
- Email: developers@chotot.com
- Developer portal: https://developers.chotot.com

---

**Last Updated:** November 13, 2025
**Status:** Mock data active, awaiting API keys
