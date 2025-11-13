import RiskAssessmentCard from '../RiskAssessmentCard';
import { Factory, Zap, Cross } from 'lucide-react';

//todo: remove mock functionality
const mockRisks = [
  {
    id: '1',
    type: 'medium' as const,
    title: 'Gần khu công nghiệp',
    description: 'Khu đất nằm trong bán kính 2km từ khu công nghiệp, có thể ảnh hưởng đến chất lượng không khí và tiếng ồn.',
    distance: 1800,
    icon: <Factory className="w-4 h-4" />
  },
  {
    id: '2',
    type: 'low' as const,
    title: 'Gần trạm điện',
    description: 'Có trạm điện trong bán kính 500m. Khoảng cách đủ an toàn nhưng cần lưu ý.',
    distance: 450,
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: '3',
    type: 'high' as const,
    title: 'Gần nghĩa trang',
    description: 'Khu đất nằm rất gần nghĩa trang (dưới 300m), có thể ảnh hưởng đến tâm lý và giá trị bất động sản.',
    distance: 250,
    icon: <Cross className="w-4 h-4" />
  }
];

export default function RiskAssessmentCardExample() {
  return (
    <div className="p-6 max-w-md">
      <RiskAssessmentCard
        risks={mockRisks}
        overallRiskLevel="medium"
      />
    </div>
  );
}
