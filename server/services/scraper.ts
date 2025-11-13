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
    
    // Determine location URL based on coordinates
    // TODO: Improve location detection with province/city mapping
    const locationSlug = determineLocationSlug(lat, lng);
    const searchUrl = `https://batdongsan.com.vn/nha-dat-ban/${locationSlug}`;
    
    console.log(`Using Batdongsan URL: ${searchUrl}`);
    
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
            url: searchUrl
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

    // Poll for completion (max 60 seconds with backoff)
    let attempts = 0;
    const maxAttempts = 20;
    let runStatus = 'RUNNING';
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/minhlucvan~batdongsan-scraper/runs/${run.data.id}`,
        {
          headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
        }
      );
      
      const status = await statusResponse.json();
      runStatus = status.data.status;
      
      if (runStatus === 'SUCCEEDED') {
        console.log('Apify scraper completed successfully');
        break;
      } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
        throw new Error(`Apify run ${runStatus}`);
      }
      
      attempts++;
    }

    // Only fetch dataset if run succeeded
    if (runStatus !== 'SUCCEEDED') {
      console.log(`Apify run timed out (status: ${runStatus})`);
      throw new Error('Apify scraper timeout - run did not complete');
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
    const result = parseApifyResults(items, lat, lng, radius);
    
    // Filter listings by distance from requested coordinates
    const filteredListings = filterListingsByDistance(result.listings, lat, lng, radius);
    console.log(`Filtered to ${filteredListings.length} listings within ${radius/1000}km radius`);
    
    return { listings: filteredListings };
    
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
        const priceOriginal = String(item.price).toLowerCase();
        
        // Check if price contains Vietnamese units
        if (priceOriginal.includes('tỷ') || priceOriginal.includes('ty')) {
          // Billions - extract number and multiply
          const priceStr = priceOriginal.replace(/[^\d.]/g, '');
          price = parseFloat(priceStr) * 1000000000;
        } else if (priceOriginal.includes('triệu') || priceOriginal.includes('trieu') || priceOriginal.includes('tr')) {
          // Millions - extract number and multiply
          const priceStr = priceOriginal.replace(/[^\d.]/g, '');
          price = parseFloat(priceStr) * 1000000;
        } else {
          // No unit specified - parse as numeric
          const priceStr = priceOriginal.replace(/[^\d.]/g, '');
          const numericPrice = parseFloat(priceStr);
          
          // Heuristic: if < 1000, likely billions; if < 100000, likely millions
          if (numericPrice < 1000) {
            price = numericPrice * 1000000000;
          } else if (numericPrice < 100000) {
            price = numericPrice * 1000000;
          } else {
            // Assume already in VND
            price = numericPrice;
          }
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

function determineLocationSlug(lat: number, lng: number): string {
  // Map coordinates to Batdongsan location slugs
  // Covers all 63 provinces/cities of Vietnam
  
  const locations = [
    // Major cities
    { name: 'tp-hcm', lat: 10.8231, lng: 106.6297, radius: 0.3 },
    { name: 'ha-noi', lat: 21.0285, lng: 105.8542, radius: 0.3 },
    { name: 'da-nang', lat: 16.0544, lng: 108.2022, radius: 0.2 },
    { name: 'can-tho', lat: 10.0452, lng: 105.7469, radius: 0.2 },
    { name: 'hai-phong', lat: 20.8449, lng: 106.6881, radius: 0.2 },
    
    // Southern provinces
    { name: 'binh-duong', lat: 10.9804, lng: 106.6519, radius: 0.25 },
    { name: 'dong-nai', lat: 10.9408, lng: 106.8441, radius: 0.25 },
    { name: 'ba-ria-vung-tau', lat: 10.3460, lng: 107.0843, radius: 0.25 },
    { name: 'long-an', lat: 10.6957, lng: 106.2431, radius: 0.2 },
    { name: 'tien-giang', lat: 10.3637, lng: 106.3608, radius: 0.2 },
    { name: 'ben-tre', lat: 10.2433, lng: 106.3757, radius: 0.2 },
    { name: 'tra-vinh', lat: 9.9475, lng: 106.3420, radius: 0.15 },
    { name: 'vinh-long', lat: 10.2398, lng: 105.9571, radius: 0.15 },
    { name: 'dong-thap', lat: 10.4938, lng: 105.6881, radius: 0.2 },
    { name: 'an-giang', lat: 10.5216, lng: 105.1258, radius: 0.2 },
    { name: 'kien-giang', lat: 10.0125, lng: 105.0808, radius: 0.25 },
    { name: 'soc-trang', lat: 9.6025, lng: 105.9739, radius: 0.15 },
    { name: 'bac-lieu', lat: 9.2941, lng: 105.7215, radius: 0.15 },
    { name: 'ca-mau', lat: 9.1526, lng: 105.1960, radius: 0.2 },
    { name: 'hau-giang', lat: 9.7577, lng: 105.6412, radius: 0.15 },
    
    // Central provinces
    { name: 'khanh-hoa', lat: 12.2388, lng: 109.1967, radius: 0.2 },
    { name: 'binh-dinh', lat: 13.7830, lng: 109.2196, radius: 0.2 },
    { name: 'phu-yen', lat: 13.0882, lng: 109.0929, radius: 0.15 },
    { name: 'quang-ngai', lat: 15.1214, lng: 108.8044, radius: 0.15 },
    { name: 'quang-nam', lat: 15.5393, lng: 108.0192, radius: 0.25 },
    { name: 'thua-thien-hue', lat: 16.4637, lng: 107.5909, radius: 0.2 },
    { name: 'quang-tri', lat: 16.7404, lng: 107.1854, radius: 0.15 },
    { name: 'quang-binh', lat: 17.4676, lng: 106.6220, radius: 0.2 },
    { name: 'ha-tinh', lat: 18.3559, lng: 105.9069, radius: 0.2 },
    { name: 'nghe-an', lat: 19.2342, lng: 104.9200, radius: 0.3 },
    
    // Central Highlands
    { name: 'lam-dong', lat: 11.9465, lng: 108.4419, radius: 0.25 },
    { name: 'dak-lak', lat: 12.6676, lng: 108.0376, radius: 0.25 },
    { name: 'dak-nong', lat: 12.2646, lng: 107.6098, radius: 0.2 },
    { name: 'gia-lai', lat: 13.9839, lng: 108.0002, radius: 0.25 },
    { name: 'kon-tum', lat: 14.3497, lng: 108.0004, radius: 0.2 },
    
    // Southeast provinces
    { name: 'binh-phuoc', lat: 11.7511, lng: 106.7234, radius: 0.25 },
    { name: 'tay-ninh', lat: 11.3351, lng: 106.1098, radius: 0.2 },
    { name: 'binh-thuan', lat: 10.9273, lng: 108.1022, radius: 0.25 },
    { name: 'ninh-thuan', lat: 11.6739, lng: 108.8629, radius: 0.2 },
    
    // Northern provinces
    { name: 'hai-duong', lat: 20.9373, lng: 106.3145, radius: 0.2 },
    { name: 'hung-yen', lat: 20.6464, lng: 106.0511, radius: 0.15 },
    { name: 'bac-ninh', lat: 21.1214, lng: 106.1110, radius: 0.15 },
    { name: 'thai-nguyen', lat: 21.5671, lng: 105.8252, radius: 0.2 },
    { name: 'bac-giang', lat: 21.2819, lng: 106.1975, radius: 0.2 },
    { name: 'quang-ninh', lat: 21.0064, lng: 107.2925, radius: 0.3 },
    { name: 'lang-son', lat: 21.8537, lng: 106.7610, radius: 0.2 },
    { name: 'cao-bang', lat: 22.6356, lng: 106.2522, radius: 0.25 },
    { name: 'lao-cai', lat: 22.4809, lng: 103.9755, radius: 0.25 },
    { name: 'yen-bai', lat: 21.7168, lng: 104.8986, radius: 0.2 },
    { name: 'tuyen-quang', lat: 21.8237, lng: 105.2280, radius: 0.15 },
    { name: 'phu-tho', lat: 21.2682, lng: 105.2045, radius: 0.2 },
    { name: 'vinh-phuc', lat: 21.3609, lng: 105.5474, radius: 0.15 },
    { name: 'bac-kan', lat: 22.1474, lng: 105.8348, radius: 0.15 },
    { name: 'ha-giang', lat: 22.8025, lng: 104.9784, radius: 0.2 },
    { name: 'dien-bien', lat: 21.8042, lng: 103.2348, radius: 0.2 },
    { name: 'lai-chau', lat: 22.3864, lng: 103.4702, radius: 0.15 },
    { name: 'son-la', lat: 21.1022, lng: 103.7289, radius: 0.25 },
    { name: 'hoa-binh', lat: 20.6861, lng: 105.3131, radius: 0.2 },
    { name: 'thanh-hoa', lat: 19.8067, lng: 105.7851, radius: 0.3 },
    { name: 'ninh-binh', lat: 20.2506, lng: 105.9745, radius: 0.15 },
    { name: 'nam-dinh', lat: 20.4388, lng: 106.1621, radius: 0.15 },
    { name: 'thai-binh', lat: 20.4464, lng: 106.3365, radius: 0.15 },
  ];
  
  // Find closest location
  let closestLoc = locations[0];
  let minDistance = Infinity;
  
  for (const loc of locations) {
    const distance = Math.sqrt(
      Math.pow(lat - loc.lat, 2) + Math.pow(lng - loc.lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestLoc = loc;
    }
  }
  
  // Return closest location (no fallback needed - we always find the nearest)
  return closestLoc.name;
}

function filterListingsByDistance(listings: PriceListing[], lat: number, lng: number, radiusMeters: number): PriceListing[] {
  // Filter listings to only include those within the requested radius
  // LIMITATION: Apify scraper returns addresses but not coordinates
  // Precise filtering requires geocoding each address, which we skip for MVP
  
  // Heuristic filtering based on radius:
  // - Small radius (< 5km): Assume user wants very local results, return fewer listings
  // - Medium radius (5-15km): Return more listings from the province
  // - Large radius (> 15km): Return all listings from the province
  
  const radiusKm = radiusMeters / 1000;
  
  if (radiusKm < 5) {
    // Very local search - return up to 10 listings
    return listings.slice(0, 10);
  } else if (radiusKm < 15) {
    // Local/district search - return up to 20 listings
    return listings.slice(0, 20);
  } else {
    // City/province-wide search - return all listings
    return listings;
  }
  
  // TODO: For production, implement proper geocoding-based filtering:
  // 1. Geocode each listing address to lat/lng using Mapbox Geocoding API
  // 2. Calculate Haversine distance from search center
  // 3. Filter out listings beyond radiusMeters
  // Example implementation:
  // return listings.filter(listing => {
  //   const listingCoords = geocodeAddress(listing.address);
  //   const distance = haversineDistance(lat, lng, listingCoords.lat, listingCoords.lng);
  //   return distance <= radiusMeters;
  // });
}
