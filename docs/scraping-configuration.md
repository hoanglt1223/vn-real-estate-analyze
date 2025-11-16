# 🔧 **Scraping Configuration Guide**

## **📋 Overview**

Vietnam Real Estate Analysis Platform sử dụng web scraping để thu thập dữ liệu giá bất động sản từ 3 nguồn chính:
- **batdongsan.com.vn** - Nền tảng BĐS lớn nhất Việt Nam
- **chotot.com** - Thị trường rao vặt nhanh
- **meeymap.com** - Dữ liệu BĐS chất lượng cao

## **🔑 Required API Keys & Environment Variables**

### **🚀 MUST HAVE (Bắt buộc)**

```env
# Core Configuration
NODE_ENV=production
DATA_DIR=./data

# JWT Authentication (Bắt buộc cho security)
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long

# AI Analysis (Bắt buộc cho property insights)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Mapping (Bắt buộc cho geocoding)
MAPBOX_TOKEN=your_mapbox_public_token_here
```

### **🔧 OPTIONAL (Khuyến khuyến)**

```env
# Vercel Storage (Cho production)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token
KV_URL=redis://your-redis-url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_kv_read_only_token

# Webhook Security
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Client Configuration
CLIENT_URL=https://your-domain.vercel.app
BASE_URL=https://your-api-domain.vercel.app
```

### **🤖 OPTIONAL CHO PROXY (Khi scraping bị block)**

```env
# Proxy Configuration (Khi cần anti-scraping)
PROXY_ENABLED=true
PROXY_ROTATION=true
PROXY_API_KEY=your_proxy_service_api_key
PROXY_ENDPOINT=https://proxy-service.com/api

# User Agent Rotation
USER_AGENT_ROTATION=true
SCRAPE_DELAY_MIN=1000
SCRAPE_DELAY_MAX=3000
```

## **🌐 Scraping Sources Details**

### **1. Batdongsan.com.vn**
```typescript
URL Pattern: https://batdongsan.com.vn/ban-{propertyType}-{province}/{district}
Headers: Standard browser headers
Rate Limit: 1-2 seconds/request
Anti-Scraping: Medium difficulty
```

**🔍 No API Key Required** - Public website scraping

**⚠️ Challenges:**
- Cloudflare protection
- Rate limiting
- Dynamic content loading

### **2. Chotot.com**
```typescript
URL Pattern: https://www.chotot.com/mua-ban/nha-dat?q={query}&region={province}
Headers: Standard browser headers
Rate Limit: 1.5-3 seconds/request
Anti-Scraping: Medium-high difficulty
```

**🔍 No API Key Required** - Public website scraping

**⚠️ Challenges:**
- Cloudflare protection
- JavaScript heavy content
- Request validation

### **3. MeeyMap.com**
```typescript
API Endpoint: https://api.meeymap.com/v2
Authentication: None required (public API)
Rate Limit: 100 requests/hour
Data Quality: High reliability
```

**🔍 No API Key Required** - Public API

**✅ Advantages:**
- Structured JSON data
- High data quality
- Reliable API endpoints

## **🛡️ Anti-Scraping Protection**

### **Current Implementation:**
```typescript
// User Agent Rotation
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
];

// Random Delays
await delay(1000 + Math.random() * 1000);

// Header Rotation
const headers = {
  'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};
```

### **Rate Limiting Strategy:**
- **Batdongsan**: 1 request/2 seconds
- **Chotot**: 1 request/3 seconds
- **MeeyMap**: 100 requests/hour
- **Global**: Maximum 10 requests/minute total

## **🔧 Testing API Actions**

### **1. Test Scraping:**
```bash
curl -X POST https://your-app.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "price-scrape",
    "province": "hà nội",
    "district": "cầu giấy",
    "propertyType": "căn hộ",
    "sources": ["meeymap"],
    "maxPages": 1
  }'
```

### **2. Test Price Trends:**
```bash
curl "https://your-app.vercel.app/api?action=price-trends&province=hà nội&district=cầu giấy&period=3months"
```

### **3. Test Price Analysis:**
```bash
curl -X POST https://your-app.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "price-analysis",
    "coordinates": [21.038039, 105.782277],
    "radius": 2000,
    "propertyType": "căn hộ"
  }'
```

## **⚠️ Legal & Compliance**

### **Important Notes:**
- **robots.txt**: Always respect websites' robots.txt
- **Rate Limits**: Never overload target servers
- **Terms of Service**: Check each platform's ToS
- **Data Usage**: Only use for analytics, not commercial redistribution

### **Compliance Features:**
- ✅ Respectful scraping delays
- ✅ User agent identification
- ✅ Rate limiting implementation
- ✅ Graceful error handling
- ✅ Data caching to reduce requests

## **🚀 Production Deployment Checklist**

### **Vercel Environment Variables:**
```bash
# Required
vercel env add JWT_SECRET
vercel env add OPENAI_API_KEY
vercel env add MAPBOX_TOKEN

# Optional but Recommended
vercel env add BLOB_READ_WRITE_TOKEN
vercel env add KV_REST_API_TOKEN

# Optional for Enhanced Scraping
vercel env add PROXY_API_KEY
```

### **Testing Before Production:**
1. ✅ Test individual scrapers locally
2. ✅ Verify rate limiting works
3. ✅ Check data quality and reliability
4. ✅ Monitor error rates
5. ✅ Validate data storage

### **Monitoring:**
- **Scraping Success Rate**: > 80%
- **Data Freshness**: Daily updates
- **Error Handling**: Graceful degradation
- **Rate Limit Compliance**: No blocking

## **🔧 Troubleshooting**

### **Common Issues:**

#### **1. Cloudflare Blocking**
```javascript
// Solution: Add proper headers and delays
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
};
```

#### **2. Rate Limiting**
```javascript
// Solution: Implement exponential backoff
const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
await new Promise(resolve => setTimeout(resolve, delay));
```

#### **3. JSON Parsing Errors**
```javascript
// Solution: Use proper error handling
try {
  const data = JSON.parse(response);
  return data;
} catch (error) {
  console.warn('Invalid JSON response, falling back to HTML parsing');
  return parseHTMLAlternative(response);
}
```

## **📈 Performance Optimization**

### **Caching Strategy:**
- **Price Trends**: Cache 1 hour
- **Location Data**: Cache 24 hours
- **Individual Listings**: Cache 6 hours
- **Failed Requests**: Cache 15 minutes (to avoid retry storms)

### **Memory Management:**
- Process data in batches of 50 listings
- Clean up unused variables
- Use streaming for large responses
- Implement connection pooling

---

## **🎯 Quick Start**

### **Minimum Setup for Testing:**
```bash
# 1. Set required environment variables
export JWT_SECRET="your_secret_here"
export OPENAI_API_KEY="sk-your-key-here"
export MAPBOX_TOKEN="pk.your-mapbox-token"

# 2. Test single source scraping
npm run dev
# POST /api?action=price-scrape with sources=["meeymap"]

# 3. Verify data storage
# GET /api?action=price-trends&province=hà nội
```

**🚀 Ready to start scraping! The system is designed to work with minimal setup and gracefully handle missing optional services.**