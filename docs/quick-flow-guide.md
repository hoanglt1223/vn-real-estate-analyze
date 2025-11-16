# 🚀 **Quick Flow Guide - Property Analysis**

## **🎯 User Flow (Yêu cầu của bạn)**

### **1. Bấm định vị tại vị trí đất**
- User chọn vị trí trên bản đồ
- System hiển thị thông tin nhanh

### **2. Chọn khu đất hoặc tự chọn**
- User có thể:
  - Vẽ polygon tự do
  - Search địa chỉ
  - Chọn khu vực có sẵn

### **3. Hiển thị thông tin nhanh**
- **Data tức thì**: Metrics, tiện ích cơ bản
- **Background jobs**: Historical data, phân tích sâu

### **4. Export báo cáo**
- Markdown (nhanh)
- PDF (đầy đủ)

---

## **⚡ Quick Flow Implementation**

### **🔥 Quick Mode (< 2 giây)**
```javascript
POST /api?action=analyze-property
{
  "coordinates": [[[lat, lng], ...]],
  "quickMode": true
}
```

**Response (tức thì):**
```json
{
  "id": "analysis-123",
  "step": "basic",
  "coordinates": "...",
  "metrics": {
    "area": 1500,
    "orientation": "Nam",
    "frontageCount": 2,
    "center": {"lat": 21.03, "lng": 105.78}
  },
  "backgroundJobs": [
    {"type": "amenities", "status": "pending"},
    {"type": "infrastructure", "status": "pending"},
    {"type": "marketData", "status": "pending"},
    {"type": "aiAnalysis", "status": "pending"},
    {"type": "historicalPrices", "status": "pending"}
  ],
  "message": "Basic analysis complete. Historical data loading in background."
}
```

### **🔄 Comprehensive Mode (~5-10 giây)**
```javascript
POST /api?action=analyze-property
{
  "coordinates": [[[lat, lng], ...]],
  "quickMode": false, // default
  "radius": 2000,
  "categories": ["school", "hospital"],
  "maxAmenities": 50
}
```

**Response (full analysis):**
```json
{
  "id": "analysis-123",
  "step": "comprehensive",
  "coordinates": "...",
  "metrics": {...},
  "amenities": [...],
  "infrastructure": [...],
  "marketData": {...},
  "aiAnalysis": {
    "score": 75,
    "recommendations": [...],
    "risks": [...]
  },
  "backgroundJobs": [
    {
      "type": "historicalPrices",
      "status": "loading",
      "estimatedTime": "30-60 seconds"
    }
  ],
  "message": "Full analysis complete. Historical data loading in background."
}
```

---

## **📊 Background Job Tracking**

### **Check Analysis Status**
```javascript
GET /api?action=analysis-status&id=analysis-123
```

**Response:**
```json
{
  "analysisId": "analysis-123",
  "status": "loading", // "loading" | "completed"
  "completedSteps": [
    "basic_metrics",
    "amenities",
    "infrastructure",
    "market_data",
    "ai_analysis"
  ],
  "pendingSteps": ["historical_prices"],
  "estimatedTimeRemaining": 30,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### **Polling Strategy**
```javascript
// Frontend polling implementation
const pollAnalysisStatus = async (analysisId) => {
  const maxAttempts = 20; // 10 minutes max
  let attempts = 0;

  const poll = async () => {
    const response = await fetch(`/api?action=analysis-status&id=${analysisId}`);
    const data = await response.json();

    if (data.status === 'completed' || attempts >= maxAttempts) {
      return data;
    }

    attempts++;
    setTimeout(poll, 30000); // Poll every 30 seconds
  };

  return poll();
};
```

---

## **📄 Export Functionality**

### **Export Markdown (Nhanh)**
```javascript
POST /api?action=export-md
{
  "analysisId": "analysis-123",
  "includeHistorical": true
}
```

**Response:**
```json
{
  "content": "# 🏠 Báo Cáo Phân Tích Bất Động Sản...",
  "filename": "property-analysis-123.md",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Export PDF (Đầy đủ)**
```javascript
POST /api?action=export-pdf
{
  "analysisId": "analysis-123",
  "includeHistorical": true
}
```

---

## **🎨 Frontend Implementation**

### **Component Structure**
```typescript
interface QuickAnalysisProps {
  onLocationSelect: (coordinates: number[][]) => void;
}

const QuickAnalysis: React.FC<QuickAnalysisProps> = ({ onLocationSelect }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState<'quick' | 'comprehensive' | 'historical' | null>(null);
  const [backgroundJobs, setBackgroundJobs] = useState([]);

  // Step 1: Quick analysis
  const handleQuickAnalysis = async (coordinates) => {
    setLoading('quick');
    const response = await fetch('/api', {
      method: 'POST',
      body: JSON.stringify({
        action: 'analyze-property',
        coordinates,
        quickMode: true
      })
    });

    const data = await response.json();
    setAnalysis(data);
    setBackgroundJobs(data.backgroundJobs);

    // Step 2: Start comprehensive analysis
    if (!data.quickMode) {
      handleComprehensiveAnalysis(coordinates);
    }
  };

  // Step 2: Comprehensive analysis
  const handleComprehensiveAnalysis = async (coordinates) => {
    setLoading('comprehensive');
    // Poll for updates...
  };

  return (
    <div>
      {/* Map interaction */}
      <Map onSelect={handleQuickAnalysis} />

      {/* Quick results */}
      {analysis && (
        <QuickResults data={analysis} />
      )}

      {/* Loading indicators */}
      {backgroundJobs.map(job => (
        <LoadingIndicator key={job.type} job={job} />
      ))}

      {/* Export options */}
      {analysis && (
        <ExportButtons analysisId={analysis.id} />
      )}
    </div>
  );
};
```

---

## **⚡ Performance Optimization**

### **1. Progressive Loading**
- **Step 1**: Basic metrics (< 500ms)
- **Step 2**: Amenities & Infrastructure (2-3s)
- **Step 3**: Market data & AI (3-5s)
- **Step 4**: Historical data (30-60s background)

### **2. Caching Strategy**
```typescript
// Cache keys structure
const CACHE_KEYS = {
  basic_metrics: `metrics:${coords_hash}`,
  amenities: `amenities:${lat}:${lng}:${radius}`,
  infrastructure: `infra:${lat}:${lng}:${radius}`,
  market_data: `market:${lat}:${lng}:${radius}`,
  historical: `historical:${province}:${district}`
};

// TTL settings
const CACHE_TTL = {
  basic_metrics: 3600,      // 1 hour
  amenities: 1800,          // 30 minutes
  infrastructure: 3600,     // 1 hour
  market_data: 900,         // 15 minutes
  historical: 86400        // 24 hours
};
```

### **3. Background Job Queue**
```typescript
// Job priority
const JOB_PRIORITY = {
  basic_metrics: 1,      // Highest
  amenities: 2,
  infrastructure: 2,
  market_data: 3,
  ai_analysis: 3,
  historical_prices: 4   // Lowest - background only
};
```

---

## **📱 User Experience Flow**

### **Screen 1: Location Selection**
```
┌─────────────────────────────┐
│ 🗺️ Interactive Map          │
│ [+ Click to select location]│
│ [🔍 Search address]         │
│ [✏️ Draw area]              │
└─────────────────────────────┘
```

### **Screen 2: Quick Results (< 2s)**
```
┌─────────────────────────────┐
│ 📊 Quick Analysis           │
│ --------------------------- │
│ 📏 Diện tích: 1,500 m²      │
│ 🧭 Hướng: Nam               │
│ 🚪 Số mặt tiền: 2           │
│                             │
│ 🔄 Loading amenities...     │
│ ⏳ Analyzing infrastructure │
│                             │
│ [📄 Export MD] [📑 Export PDF]│
└─────────────────────────────┘
```

### **Screen 3: Full Analysis (5-10s)**
```
┌─────────────────────────────┐
│ 🏪 15 Schools nearby         │
│ 🏥 8 Hospitals nearby       │
│ 🛣️ 3 Major roads           │
│                             │
│ 🤖 AI Score: 75/100         │
│ 💡 Recommended: INVEST      │
│                             │
│ 📈 Historical: Loading...   │
│ ⏰ Est: 30 seconds remaining │
└─────────────────────────────┘
```

### **Screen 4: Complete Analysis**
```
┌─────────────────────────────┐
│ ✅ All analysis complete!   │
│                             │
│ 📊 Price trends: +12% (6M)  │
│ 🔥 Market: HOT             │
│ 💰 Avg price: 45 triệu/m²   │
│                             │
│ [📄 Export Full MD]         │
│ [📑 Export Full PDF]        │
└─────────────────────────────┘
```

---

## **🚀 API Usage Examples**

### **Quick Analysis Call**
```bash
curl -X POST https://your-app.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "analyze-property",
    "coordinates": [[[21.038, 105.782], [21.039, 105.783], [21.039, 105.782], [21.038, 105.782]]],
    "quickMode": true
  }'
```

### **Full Analysis Call**
```bash
curl -X POST https://your-app.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "analyze-property",
    "coordinates": [[[21.038, 105.782], ...]],
    "radius": 2000,
    "categories": ["school", "hospital", "market"],
    "quickMode": false
  }'
```

### **Check Status**
```bash
curl "https://your-app.vercel.app/api?action=analysis-status&id=analysis-123"
```

### **Export Markdown**
```bash
curl -X POST https://your-app.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{
    "action": "export-md",
    "analysisId": "analysis-123",
    "includeHistorical": true
  }'
```

---

## **🎯 Success Metrics**

### **Performance Targets**
- **Quick Mode**: < 2 seconds response time
- **Full Mode**: < 10 seconds response time
- **Historical Data**: 30-60 seconds background
- **Export MD**: < 1 second
- **Export PDF**: < 5 seconds

### **User Experience**
- ✅ **Instant feedback**: Basic metrics immediate
- ✅ **Progressive loading**: Data appears as ready
- ✅ **Background processing**: Historical data non-blocking
- ✅ **Multiple export formats**: MD + PDF options
- ✅ **Mobile optimized**: Works on all devices

---

## **🔧 Technical Implementation Details**

### **Background Job Architecture**
```typescript
// Background job queue structure
interface BackgroundJob {
  id: string;
  type: 'amenities' | 'infrastructure' | 'market_data' | 'ai_analysis' | 'historical_prices';
  status: 'pending' | 'running' | 'completed' | 'failed';
  analysisId: string;
  data?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

### **Error Handling**
```typescript
// Graceful degradation
if (historicalDataError) {
  return {
    ...analysis,
    historicalData: {
      status: 'unavailable',
      message: 'Historical data temporarily unavailable',
      fallback: 'Using cached market data for analysis'
    }
  };
}
```

### **Rate Limiting**
```typescript
// Prevent abuse of quick mode
const quickModeLimits = {
  perMinute: 10,    // 10 quick analyses per minute
  perHour: 100,     // 100 quick analyses per hour
  perDay: 1000      // 1000 quick analyses per day
};
```

---

**🚀 Quick Flow is ready for implementation! Users get instant feedback with comprehensive analysis loading progressively in the background.**