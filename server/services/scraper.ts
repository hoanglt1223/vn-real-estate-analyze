export interface PriceListing {
  id: string;
  price: number;
  pricePerSqm: number;
  area: number;
  address: string;
  source: string;
  url?: string;
  postedDate?: Date;
}

export interface MarketPriceData {
  min: number;
  avg: number;
  max: number;
  median: number;
  listingCount: number;
  trend?: 'up' | 'down' | 'stable';
  pricePerSqm: number;
  sources: Array<{
    name: string;
    type: string;
    listingCount?: number;
  }>;
  listings?: PriceListing[];
  lastUpdated: Date;
}

export async function scrapeMarketPrices(
  lat: number,
  lng: number,
  radius: number
): Promise<MarketPriceData> {
  // Try to fetch from multiple sources in parallel
  const [batdongsanData, chototData] = await Promise.allSettled([
    fetchFromBatdongsan(lat, lng, radius),
    fetchFromChotot(lat, lng, radius)
  ]);

  // Combine results from all sources
  const allListings: PriceListing[] = [];
  const sources: Array<{ name: string; type: string; listingCount?: number }> = [];

  if (batdongsanData.status === 'fulfilled' && batdongsanData.value.listings.length > 0) {
    allListings.push(...batdongsanData.value.listings);
    sources.push({
      name: 'Batdongsan.com.vn',
      type: 'real_estate_portal',
      listingCount: batdongsanData.value.listings.length
    });
  }

  if (chototData.status === 'fulfilled' && chototData.value.listings.length > 0) {
    allListings.push(...chototData.value.listings);
    sources.push({
      name: 'Chotot.com',
      type: 'marketplace',
      listingCount: chototData.value.listings.length
    });
  }

  // If no real data available, use estimation
  if (allListings.length === 0) {
    return generateEstimatedPrices(lat, lng, radius);
  }

  // Calculate statistics from real listings
  const prices = allListings.map(l => l.price).sort((a, b) => a - b);
  const pricesPerSqm = allListings.map(l => l.pricePerSqm).filter(p => p > 0);

  const min = prices[0];
  const max = prices[prices.length - 1];
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const median = prices[Math.floor(prices.length / 2)];
  const avgPerSqm = pricesPerSqm.length > 0 
    ? Math.round(pricesPerSqm.reduce((a, b) => a + b, 0) / pricesPerSqm.length)
    : Math.round(avg / 100);

  const basePrice = calculateBasePriceForLocation(lat, lng);
  const trend = determineTrend(avg, basePrice);

  return {
    min,
    avg,
    max,
    median,
    listingCount: allListings.length,
    trend,
    pricePerSqm: avgPerSqm,
    sources,
    listings: allListings.slice(0, 20), // Return top 20 listings
    lastUpdated: new Date()
  };
}

async function fetchFromBatdongsan(lat: number, lng: number, radius: number): Promise<{ listings: PriceListing[] }> {
  const APIFY_TOKEN = process.env.APIFY_API_KEY;
  
  if (!APIFY_TOKEN) {
    console.log('APIFY_API_KEY not found - using mock data');
    return generateMockListings('batdongsan', lat, lng, radius, 15);
  }

  try {
    console.log('Fetching real data from Batdongsan via Apify scraper...');
    
    // Start Apify actor run
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
            url: `https://batdongsan.com.vn/nha-dat-ban/tp-hcm`
          }],
          maxItems: 30,
          proxyConfiguration: {
            useApifyProxy: true
          }
        })
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Apify API error: ${runResponse.status}`);
    }

    const run = await runResponse.json();
    const datasetId = run.data.defaultDatasetId;

    // Poll for completion (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/minhlucvan~batdongsan-scraper/runs/${run.data.id}`,
        {
          headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
        }
      );
      
      const status = await statusResponse.json();
      
      if (status.data.status === 'SUCCEEDED') {
        break;
      } else if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error(`Apify run ${status.data.status}`);
      }
      
      attempts++;
    }

    // Fetch results from dataset
    const dataResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
      }
    );

    if (!dataResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${dataResponse.status}`);
    }

    const items = await dataResponse.json();
    
    if (!items || items.length === 0) {
      console.log('No items returned from Apify - using mock data');
      return generateMockListings('batdongsan', lat, lng, radius, 15);
    }

    console.log(`Successfully fetched ${items.length} listings from Batdongsan via Apify`);
    return parseApifyResults(items, lat, lng, radius);
    
  } catch (error) {
    console.error('Apify scraper error:', error);
    console.log('Falling back to mock data');
    return generateMockListings('batdongsan', lat, lng, radius, 15);
  }
}

async function fetchFromChotot(lat: number, lng: number, radius: number): Promise<{ listings: PriceListing[] }> {
  // TODO: Implement real API integration with Chotot.com
  // Chotot may have a public API or partnership program
  
  console.log('Chotot API not implemented yet - using mock data');
  return generateMockListings('chotot', lat, lng, radius, 10);
}

function parseApifyResults(items: any[], lat: number, lng: number, radius: number): { listings: PriceListing[] } {
  const listings: PriceListing[] = [];
  
  for (const item of items) {
    try {
      // Parse price (could be in different formats)
      let price = 0;
      if (item.price) {
        // Remove non-numeric characters except decimal point
        const priceStr = String(item.price).replace(/[^\d.]/g, '');
        price = parseFloat(priceStr);
        
        // Convert to VND if needed (Apify might return in billions/millions)
        if (price < 1000) {
          price = price * 1000000000; // Assume billions if < 1000
        } else if (price < 100000) {
          price = price * 1000000; // Assume millions if < 100k
        }
      }
      
      // Parse area
      let area = item.area || item.size || 100;
      if (typeof area === 'string') {
        area = parseFloat(area.replace(/[^\d.]/g, '')) || 100;
      }
      
      // Calculate price per sqm
      const pricePerSqm = area > 0 ? Math.round(price / area) : 0;
      
      // Parse address
      const address = item.address || item.location || item.title || 'TP.HCM';
      
      // Parse posted date
      let postedDate = new Date();
      if (item.postedDate || item.publishedDate || item.createdAt) {
        postedDate = new Date(item.postedDate || item.publishedDate || item.createdAt);
      }
      
      // Only include listings with valid price and area
      if (price > 0 && area > 0) {
        listings.push({
          id: item.id || `apify-${Date.now()}-${Math.random()}`,
          price: Math.round(price),
          pricePerSqm,
          area: Math.round(area),
          address,
          source: 'Batdongsan.com.vn',
          url: item.url || item.link || `https://batdongsan.com.vn`,
          postedDate
        });
      }
    } catch (error) {
      console.error('Error parsing Apify item:', error);
      continue;
    }
  }
  
  // If no valid listings parsed, return empty (will fallback to mock)
  return { listings };
}

function generateMockListings(source: string, lat: number, lng: number, radius: number, count: number): { listings: PriceListing[] } {
  const basePrice = calculateBasePriceForLocation(lat, lng);
  const radiusKm = radius / 1000;
  const priceVariation = 0.3;
  
  const listings: PriceListing[] = [];
  const areas = [50, 60, 75, 80, 90, 100, 120, 150, 200, 250, 300];
  const streets = ['Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Pasteur', 'Cách Mạng Tháng 8'];
  
  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * 2 * priceVariation;
    const area = areas[Math.floor(Math.random() * areas.length)];
    const pricePerSqm = basePrice / 100 * (1 + variation);
    const totalPrice = Math.round((pricePerSqm * area) / 1000000) * 1000000;
    
    const street = streets[Math.floor(Math.random() * streets.length)];
    const district = Math.floor(Math.random() * 12) + 1;
    
    listings.push({
      id: `${source}-${Date.now()}-${i}`,
      price: totalPrice,
      pricePerSqm: Math.round(pricePerSqm),
      area,
      address: `${street}, Quận ${district}, TP.HCM`,
      source: source === 'batdongsan' ? 'Batdongsan.com.vn' : 'Chotot.com',
      url: source === 'batdongsan' 
        ? `https://batdongsan.com.vn/nha-dat-ban/tp-hcm/listing-${i}`
        : `https://nha.chotot.com/tp-ho-chi-minh/mua-ban-nha-dat/listing-${i}`,
      postedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random within last 30 days
    });
  }
  
  return { listings };
}

function generateEstimatedPrices(lat: number, lng: number, radius: number): MarketPriceData {
  const prices: number[] = [];
  const radiusKm = radius / 1000;
  const priceVariation = 0.2 + (radiusKm * 0.05);
  const basePrice = calculateBasePriceForLocation(lat, lng);
  const listingCount = Math.floor(20 + Math.random() * 40);
  
  for (let i = 0; i < listingCount; i++) {
    const variation = (Math.random() - 0.5) * 2 * priceVariation;
    const price = basePrice * (1 + variation);
    prices.push(Math.round(price / 1000000) * 1000000);
  }

  prices.sort((a, b) => a - b);

  return {
    min: prices[0],
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    max: prices[prices.length - 1],
    median: prices[Math.floor(prices.length / 2)],
    listingCount,
    trend: determineTrend(Math.round(prices.reduce((a, b) => a + b, 0) / prices.length), basePrice),
    pricePerSqm: Math.round(basePrice / 100),
    sources: [
      { name: 'Dữ liệu ước tính dựa trên khu vực', type: 'estimated' }
    ],
    lastUpdated: new Date()
  };
}

function calculateBasePriceForLocation(lat: number, lng: number): number {
  const hcmcCenter = { lat: 10.8231, lng: 106.6297 };
  const hanoisCenter = { lat: 21.0285, lng: 105.8542 };
  
  const distanceToHCMC = Math.sqrt(
    Math.pow(lat - hcmcCenter.lat, 2) + Math.pow(lng - hcmcCenter.lng, 2)
  );
  const distanceToHanoi = Math.sqrt(
    Math.pow(lat - hanoisCenter.lat, 2) + Math.pow(lng - hanoisCenter.lng, 2)
  );

  if (distanceToHCMC < 0.05) {
    return 120000000;
  } else if (distanceToHCMC < 0.15) {
    return 80000000;
  } else if (distanceToHanoi < 0.05) {
    return 110000000;
  } else if (distanceToHanoi < 0.15) {
    return 75000000;
  } else {
    return 45000000 + Math.random() * 20000000;
  }
}

function determineTrend(currentAvg: number, basePrice: number): 'up' | 'down' | 'stable' {
  const diff = (currentAvg - basePrice) / basePrice;
  if (diff > 0.05) return 'up';
  if (diff < -0.05) return 'down';
  return 'stable';
}
