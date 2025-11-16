import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

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
    location: number;
    amenities: number;
    infrastructure: number;
    potential: number;
  };
  scoreExplanations: {
    overall: string;
    location: string;
    amenities: string;
    infrastructure: string;
    potential: string;
  };
  recommendation: 'buy' | 'consider' | 'avoid';
  estimatedPrice: string;
  summary: string;
  amenityAnalysis: {
    explanation: string;
    improvements: string[];
    importance: Record<string, string>;
  };
  areaComparison: {
    similarAreas: string[];
    advantages: string[];
    disadvantages: string[];
  };
  investmentTimeline: {
    shortTerm: string;
    midTerm: string;
    longTerm: string;
  };
}

export async function analyzeProperty(input: AIAnalysisInput): Promise<AIAnalysisResult> {
  const locationScore = calculateLocationScore(input.amenities, input.infrastructure);
  const amenitiesScore = calculateAmenitiesScore(input.amenities);
  const infrastructureScore = calculatePlanningScore(input.infrastructure);
  const potentialScore = calculateInvestmentScore(input.marketData, input.infrastructure, input.area);

  const overall = Math.round(
    (locationScore * 0.25) +
    (amenitiesScore * 0.25) +
    (infrastructureScore * 0.2) +
    (potentialScore * 0.3)
  );

  let recommendation: 'buy' | 'consider' | 'avoid';
  if (overall >= 80) {
    recommendation = 'buy';
  } else if (overall >= 60) {
    recommendation = 'consider';
  } else {
    recommendation = 'avoid';
  }

  const estimatedPrice = input.marketData?.avg ?
    `${input.marketData.avg.toLocaleString('vi-VN')} VNĐ/m²` :
    'Không có dữ liệu';

  const summary = await generateAISummary(input, {
    overall,
    locationScore,
    amenitiesScore,
    infrastructureScore,
    potentialScore
  });

  const scoreObject = {
    overall,
    location: locationScore,
    amenities: amenitiesScore,
    infrastructure: infrastructureScore,
    potential: potentialScore
  };

  const explanations = generateScoreExplanations(input, scoreObject);
  const amenityAnalysis = generateAmenityAnalysis(input);
  const areaComparison = generateAreaComparison(input);
  const investmentTimeline = generateInvestmentTimeline(input, overall);

  return {
    scores: scoreObject,
    scoreExplanations: explanations,
    recommendation,
    estimatedPrice,
    summary,
    amenityAnalysis,
    areaComparison,
    investmentTimeline
  };
}

interface ScoreObject {
  overall: number;
  location: number;
  amenities: number;
  infrastructure: number;
  potential: number;
}

function generateScoreExplanations(input: AIAnalysisInput, scores: ScoreObject) {
  const amenitiesCount = input.amenities?.length || 0;
  const closeAmenities = input.amenities?.filter(a => a.distance < 1000).length || 0;
  const mediumAmenities = input.amenities?.filter(a => a.distance >= 1000 && a.distance < 3000).length || 0;
  
  const roadsCount = input.infrastructure?.roads?.length || 0;
  const metroCount = input.infrastructure?.metro?.length || 0;
  const waterCount = input.infrastructure?.water?.length || 0;
  
  const trend = input.marketData?.trend || 'stable';
  const risksCount = input.risks?.length || 0;
  
  const locationValue = scores.location || 0;
  const amenitiesValue = scores.amenities || 0;
  const infrastructureValue = scores.infrastructure || 0;
  const potentialValue = scores.potential || 0;
  const overallValue = scores.overall || 0;

  // Count amenity types for location explanation
  const educationCount = input.amenities?.filter(a => a.category === 'education').length || 0;
  const healthcareCount = input.amenities?.filter(a => a.category === 'healthcare').length || 0;
  const shoppingCount = input.amenities?.filter(a => a.category === 'shopping').length || 0;
  const transportCount = input.amenities?.filter(a => a.category === 'transport').length || 0;
  
  return {
    overall: `Điểm tổng hợp từ: Vị trí (25%), Tiện ích (25%), Hạ tầng (20%), Tiềm năng (30%). Công thức: (${locationValue}×0.25 + ${amenitiesValue}×0.25 + ${infrastructureValue}×0.2 + ${potentialValue}×0.3) = ${overallValue}`,

    location: `Dựa trên kết nối và đa dạng tiện ích. ${educationCount > 0 ? '+20 (có giáo dục)' : ''} ${healthcareCount > 0 ? '+15 (có y tế)' : ''} ${shoppingCount > 0 ? '+10 (có mua sắm)' : ''} ${transportCount > 0 ? '+15 (có giao thông)' : ''} ${metroCount > 0 ? '+10 (gần metro)' : ''} ${roadsCount >= 3 ? '+5 (nhiều đường)' : ''}.`,

    amenities: `Dựa trên ${amenitiesCount} tiện ích xung quanh. ${closeAmenities} địa điểm trong bán kính 1km (+10 điểm/địa điểm), ${mediumAmenities} địa điểm trong 1-3km (+5 điểm/địa điểm). Tối đa 25 điểm/danh mục.`,

    infrastructure: `Điểm cơ bản 50. ${roadsCount > 0 ? '+15 (có đường lớn)' : ''} ${metroCount > 0 ? '+20 (có metro)' : ''} ${waterCount > 0 ? '+10 (gần sông/kênh)' : ''}. Tối đa 100 điểm.`,

    potential: `Điểm cơ bản 50. ${trend === 'up' ? '+15 (giá tăng)' : trend === 'down' ? '-10 (giá giảm)' : '+0 (giá ổn định)'}. ${metroCount > 0 ? '+20 (có metro)' : ''} ${roadsCount >= 3 ? '+10 (nhiều đường lớn)' : ''} ${input.area > 100 && input.area < 500 ? '+5 (diện tích phù hợp)' : ''}.`
  };
}

function calculateAmenitiesScore(amenities: any[] | undefined): number {
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

function calculatePlanningScore(infrastructure: any | undefined): number {
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

function calculateRiskScore(risks: any[] | undefined): number {
  if (!risks || risks.length === 0) return 10;

  let score = 10;

  risks.forEach(risk => {
    if (risk.type === 'high') score += 30;
    else if (risk.type === 'medium') score += 15;
    else score += 5;
  });

  return Math.min(100, score);
}

function calculateResidentialScore(amenities: any[] | undefined, risks: any[] | undefined, orientation: string): number {
  let score = 60;
  
  if (!amenities) amenities = [];
  if (!risks) risks = [];

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

function calculateInvestmentScore(marketData: any | undefined, infrastructure: any | undefined, area: number): number {
  let score = 50;

  if (marketData?.trend === 'up') {
    score += 15;
  } else if (marketData?.trend === 'down') {
    score -= 10;
  }

  if (infrastructure?.metro && infrastructure.metro.length > 0) {
    score += 20;
  }

  if (infrastructure?.roads && infrastructure.roads.length >= 3) {
    score += 10;
  }

  if (area > 100 && area < 500) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

async function generateAISummary(input: AIAnalysisInput, scores: any): Promise<string> {
  if (!openai) {
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

// New functions for enhanced AI analysis
function calculateLocationScore(amenities: any[] | undefined, infrastructure: any | undefined): number {
  let score = 50;

  if (!amenities) amenities = [];

  // Score based on amenity density and variety
  const educationCount = amenities.filter(a => a.category === 'education').length;
  const healthcareCount = amenities.filter(a => a.category === 'healthcare').length;
  const shoppingCount = amenities.filter(a => a.category === 'shopping').length;
  const transportCount = amenities.filter(a => a.category === 'transport').length;

  score += Math.min(20, educationCount * 3);
  score += Math.min(15, healthcareCount * 3);
  score += Math.min(10, shoppingCount * 2);
  score += Math.min(15, transportCount * 2);

  // Infrastructure bonus
  if (infrastructure?.metro?.length > 0) score += 10;
  if (infrastructure?.roads?.length >= 3) score += 5;

  return Math.min(100, score);
}

function generateAmenityAnalysis(input: AIAnalysisInput): AIAnalysisResult['amenityAnalysis'] {
  const explanation = generateAmenityExplanation(input.amenities);
  const improvements = generateImprovementSuggestions(input.amenities);
  const importance = generateAmenityImportance(input.amenities);

  return {
    explanation,
    improvements,
    importance
  };
}

function generateAmenityExplanation(amenities: any[] | undefined): string {
  if (!amenities || amenities.length === 0) {
    return "Không có tiện ích xung quanh khu vực này. Điều này có thể ảnh hưởng đến sự tiện nghi và giá trị bất động sản.";
  }

  const educationCount = amenities.filter(a => a.category === 'education').length;
  const healthcareCount = amenities.filter(a => a.category === 'healthcare').length;
  const shoppingCount = amenities.filter(a => a.category === 'shopping').length;

  let explanation = `Khu vực có ${amenities.length} tiện ích trong bán kính 1km. `;

  if (educationCount > 0) {
    explanation += `Có ${educationCount} cơ sở giáo dục, thuận lợi cho gia đình có con nhỏ. `;
  }

  if (healthcareCount > 0) {
    explanation += `${healthcareCount} cơ sở y tế gần đó đảm bảo khả năng tiếp cận dịch vụ sức khỏe. `;
  }

  if (shoppingCount > 0) {
    explanation += `${shoppingCount} điểm mua sắm đáp ứng nhu cầu hàng ngày. `;
  }

  return explanation;
}

function generateImprovementSuggestions(amenities: any[] | undefined): string[] {
  const suggestions: string[] = [];
  if (!amenities) amenities = [];

  const education = amenities.filter(a => a.category === 'education');
  const healthcare = amenities.filter(a => a.category === 'healthcare');
  const shopping = amenities.filter(a => a.category === 'shopping');

  if (education.length === 0) {
    suggestions.push("Khu vực thiếu trường học, cần xem xét phương tiện đi lại cho học sinh");
  }

  if (healthcare.length === 0) {
    suggestions.push("Cần phát triển thêm cơ sở y tế để phục vụ cộng đồng");
  }

  if (shopping.length < 2) {
    suggestions.push("Nên có thêm các cửa hàng tiện lợi và chợ/siêu thị");
  }

  suggestions.push("Cải thiện giao thông kết nối các tiện ích hiện có");
  suggestions.push("Phát triển không gian công cộng và công viên xanh");

  return suggestions;
}

function generateAmenityImportance(amenities: any[] | undefined): Record<string, string> {
  const importance: Record<string, string> = {};

  // Education importance
  const education = amenities?.filter(a => a.category === 'education') || [];
  if (education.length > 0) {
    importance['education'] = `Quan trọng cho gia đình có con nhỏ (${education.length} trường nearby)`;
  } else {
    importance['education'] = 'Thiếu trường học, cần xem xét phương tiện di chuyển';
  }

  // Healthcare importance
  const healthcare = amenities?.filter(a => a.category === 'healthcare') || [];
  if (healthcare.length > 0) {
    importance['healthcare'] = `Đảm bảo tiếp cận dịch vụ y tế (${healthcare.length} cơ sở)`;
  } else {
    importance['healthcare'] = 'Cần phát triển thêm cơ sở y tế';
  }

  // Shopping importance
  const shopping = amenities?.filter(a => a.category === 'shopping') || [];
  if (shopping.length > 0) {
    importance['shopping'] = `Tiện lợi cho mua sắm hàng ngày (${shopping.length} điểm)`;
  } else {
    importance['shopping'] = 'Thiếu các cửa hàng tiện lợi';
  }

  return importance;
}

function generateAreaComparison(input: AIAnalysisInput): AIAnalysisResult['areaComparison'] {
  return {
    similarAreas: [
      "Quận 7 - Khu dân cư mới với nhiều tiện ích",
      "Quận 2 - Phát triển mạnh về hạ tầng",
      "Quận Bình Thạnh - Khu vực sôi động, nhiều dịch vụ"
    ],
    advantages: [
      "Vị trí trung tâm, dễ dàng di chuyển",
      "Tiềm năng tăng giá trong tương lai",
      "Cộng đồng dân cư văn minh"
    ],
    disadvantages: [
      "Giá đất tương đối cao",
      "Có thể đông đúc vào giờ cao điểm",
      "Một số tiện ích cần phát triển thêm"
    ]
  };
}

function generateInvestmentTimeline(input: AIAnalysisInput, overallScore: number): AIAnalysisResult['investmentTimeline'] {
  const shortTerm = overallScore >= 70
    ? "Tăng giá ổn định 5-8% trong 1-2 năm"
    : "Giá ổn định, có thể tăng nhẹ 2-4%";

  const midTerm = overallScore >= 70
    ? "Tăng giá tốt 15-20% trong 3-5 năm nhờ hạ tầng phát triển"
    : "Tăng giá tương đương lạm phát 10-15% trong 3-5 năm";

  const longTerm = overallScore >= 70
    ? "Tiềm năng tăng giá 50-80% trong 10 năm nếu khu vực phát triển"
    : "Tăng giá dài hạn 25-40% theo thị trường chung";

  return {
    shortTerm,
    midTerm,
    longTerm
  };
}
