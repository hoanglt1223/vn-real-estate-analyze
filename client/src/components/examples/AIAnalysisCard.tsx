import AIAnalysisCard from '../AIAnalysisCard';

//todo: remove mock functionality
const mockScores = {
  overall: 78,
  amenities: 85,
  planning: 72,
  residential: 80,
  investment: 75,
  risk: 25
};

const mockSummary = 'Khu đất nằm ở vị trí tốt với nhiều tiện ích xung quanh. Quy hoạch ổn định, phù hợp cho cả mục đích an cư và đầu tư. Giá hiện tại hợp lý so với thị trường. Rủi ro thấp, không có yếu tố bất lợi lớn.';

export default function AIAnalysisCardExample() {
  return (
    <div className="p-6 max-w-md">
      <AIAnalysisCard
        scores={mockScores}
        recommendation="buy"
        estimatedPrice={85000000}
        summary={mockSummary}
      />
    </div>
  );
}
