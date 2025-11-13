import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIAnalysisInput {
  area: number;
  orientation: string;
  frontageCount: number;
  amenities: any[];
  infrastructure: any;
  marketData: any;
  risks: any[];
}

export interface AIAnalysisResult {
  scores: {
    overall: number;
    amenities: number;
    planning: number;
    residential: number;
    investment: number;
    risk: number;
  };
  recommendation: 'buy' | 'consider' | 'avoid';
  estimatedPrice: number;
  summary: string;
}

export async function analyzeProperty(input: AIAnalysisInput): Promise<AIAnalysisResult> {
  const amenitiesScore = calculateAmenitiesScore(input.amenities);
  const planningScore = calculatePlanningScore(input.infrastructure);
  const riskScore = calculateRiskScore(input.risks);
  const residentialScore = calculateResidentialScore(input.amenities, input.risks, input.orientation);
  const investmentScore = calculateInvestmentScore(input.marketData, input.infrastructure, input.area);

  const overall = Math.round(
    (amenitiesScore * 0.25) +
    (planningScore * 0.2) +
    ((100 - riskScore) * 0.2) +
    (residentialScore * 0.2) +
    (investmentScore * 0.15)
  );

  let recommendation: 'buy' | 'consider' | 'avoid';
  if (overall >= 70 && riskScore < 30) {
    recommendation = 'buy';
  } else if (overall >= 50 || riskScore < 50) {
    recommendation = 'consider';
  } else {
    recommendation = 'avoid';
  }

  const estimatedPrice = input.marketData.avg || 0;

  const summary = await generateAISummary(input, {
    overall,
    amenitiesScore,
    planningScore,
    residentialScore,
    investmentScore,
    riskScore
  });

  return {
    scores: {
      overall,
      amenities: amenitiesScore,
      planning: planningScore,
      residential: residentialScore,
      investment: investmentScore,
      risk: riskScore
    },
    recommendation,
    estimatedPrice,
    summary
  };
}

function calculateAmenitiesScore(amenities: any[]): number {
  if (!amenities || amenities.length === 0) return 30;

  const categories = ['education', 'healthcare', 'shopping', 'entertainment'];
  const categoryScores = categories.map(cat => {
    const items = amenities.filter(a => a.category === cat);
    if (items.length === 0) return 0;
    
    const closeItems = items.filter(a => a.distance < 1000).length;
    const mediumItems = items.filter(a => a.distance >= 1000 && a.distance < 3000).length;
    
    return Math.min(25, (closeItems * 10) + (mediumItems * 5));
  });

  return Math.round(categoryScores.reduce((a, b) => a + b, 0));
}

function calculatePlanningScore(infrastructure: any): number {
  if (!infrastructure) return 50;

  let score = 50;

  if (infrastructure.roads && infrastructure.roads.length > 0) {
    score += 15;
  }

  if (infrastructure.metro && infrastructure.metro.length > 0) {
    score += 20;
  }

  if (infrastructure.water && infrastructure.water.length > 0) {
    const distance = infrastructure.water[0].distance;
    if (distance > 100 && distance < 2000) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

function calculateRiskScore(risks: any[]): number {
  if (!risks || risks.length === 0) return 10;

  let score = 10;

  risks.forEach(risk => {
    if (risk.type === 'high') score += 30;
    else if (risk.type === 'medium') score += 15;
    else score += 5;
  });

  return Math.min(100, score);
}

function calculateResidentialScore(amenities: any[], risks: any[], orientation: string): number {
  let score = 60;

  const educationNearby = amenities.filter(a => a.category === 'education' && a.distance < 1000).length;
  const healthcareNearby = amenities.filter(a => a.category === 'healthcare' && a.distance < 2000).length;
  const shoppingNearby = amenities.filter(a => a.category === 'shopping' && a.distance < 1000).length;

  score += Math.min(15, educationNearby * 5);
  score += Math.min(10, healthcareNearby * 3);
  score += Math.min(10, shoppingNearby * 3);

  const highRisks = risks.filter(r => r.type === 'high').length;
  score -= highRisks * 15;

  const goodOrientations = ['Đông', 'Đông Nam', 'Nam'];
  if (goodOrientations.includes(orientation)) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateInvestmentScore(marketData: any, infrastructure: any, area: number): number {
  let score = 50;

  if (marketData.trend === 'up') {
    score += 15;
  } else if (marketData.trend === 'down') {
    score -= 10;
  }

  if (infrastructure.metro && infrastructure.metro.length > 0) {
    score += 20;
  }

  if (infrastructure.roads && infrastructure.roads.length >= 3) {
    score += 10;
  }

  if (area > 100 && area < 500) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

async function generateAISummary(input: AIAnalysisInput, scores: any): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackSummary(input, scores);
  }

  try {
    const prompt = `Bạn là chuyên gia phân tích bất động sản Việt Nam. Hãy tóm tắt phân tích khu đất sau đây trong tối đa 200 từ bằng tiếng Việt:

Thông tin khu đất:
- Diện tích: ${input.area}m²
- Hướng: ${input.orientation}
- Số mặt tiền: ${input.frontageCount}

Điểm đánh giá:
- Tổng quan: ${scores.overall}/100
- Tiện ích: ${scores.amenitiesScore}/100
- Quy hoạch: ${scores.planningScore}/100
- An cư: ${scores.residentialScore}/100
- Đầu tư: ${scores.investmentScore}/100
- Rủi ro: ${scores.riskScore}/100

Tiện ích xung quanh: ${input.amenities.length} địa điểm
Giá trung bình khu vực: ${formatPrice(input.marketData.avg)}

Hãy viết tóm tắt ngắn gọn, rõ ràng, tập trung vào ưu điểm, nhược điểm và khuyến nghị.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || generateFallbackSummary(input, scores);
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return generateFallbackSummary(input, scores);
  }
}

function generateFallbackSummary(input: AIAnalysisInput, scores: any): string {
  const parts = [];

  if (scores.overall >= 70) {
    parts.push(`Khu đất có vị trí tốt với điểm tổng quan ${scores.overall}/100.`);
  } else if (scores.overall >= 50) {
    parts.push(`Khu đất ở vị trí khá với điểm tổng quan ${scores.overall}/100.`);
  } else {
    parts.push(`Khu đất cần cân nhắc kỹ với điểm tổng quan ${scores.overall}/100.`);
  }

  if (scores.amenitiesScore >= 70) {
    parts.push(`Tiện ích xung quanh phong phú với ${input.amenities.length} địa điểm trong bán kính tìm kiếm.`);
  } else if (scores.amenitiesScore >= 50) {
    parts.push(`Tiện ích xung quanh ở mức trung bình.`);
  } else {
    parts.push(`Tiện ích xung quanh còn hạn chế.`);
  }

  if (scores.riskScore < 30) {
    parts.push(`Rủi ro thấp, không có yếu tố bất lợi lớn.`);
  } else if (scores.riskScore < 50) {
    parts.push(`Có một số rủi ro cần lưu ý nhưng ở mức chấp nhận được.`);
  } else {
    parts.push(`Có nhiều rủi ro cần cân nhắc kỹ.`);
  }

  if (input.marketData.trend === 'up') {
    parts.push(`Giá khu vực đang có xu hướng tăng, trung bình ${formatPrice(input.marketData.avg)}.`);
  } else {
    parts.push(`Giá khu vực ổn định ở mức ${formatPrice(input.marketData.avg)}.`);
  }

  if (scores.overall >= 70) {
    parts.push(`Phù hợp cho cả mục đích an cư và đầu tư.`);
  } else if (scores.overall >= 50) {
    parts.push(`Cần đánh giá thêm dựa trên mục đích sử dụng.`);
  }

  return parts.join(' ');
}

function formatPrice(price: number): string {
  if (price >= 1000000000) {
    return `${(price / 1000000000).toFixed(1)} tỷ VNĐ`;
  }
  return `${(price / 1000000).toFixed(0)} triệu VNĐ`;
}
