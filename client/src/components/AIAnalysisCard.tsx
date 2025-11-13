import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface AIScore {
  overall: number;
  amenities: number;
  planning: number;
  residential: number;
  investment: number;
  risk: number;
}

interface AIAnalysisCardProps {
  scores?: AIScore;
  recommendation?: 'buy' | 'consider' | 'avoid';
  estimatedPrice?: number;
  summary?: string;
}

export default function AIAnalysisCard({
  scores,
  recommendation,
  estimatedPrice,
  summary
}: AIAnalysisCardProps) {
  if (!scores) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getRecommendationConfig = () => {
    switch (recommendation) {
      case 'buy':
        return {
          icon: <CheckCircle2 className="w-5 h-5" />,
          text: 'Nên Mua',
          variant: 'default' as const,
          color: 'bg-green-500'
        };
      case 'consider':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          text: 'Cân Nhắc',
          variant: 'secondary' as const,
          color: 'bg-yellow-500'
        };
      case 'avoid':
        return {
          icon: <XCircle className="w-5 h-5" />,
          text: 'Không Nên Mua',
          variant: 'destructive' as const,
          color: 'bg-red-500'
        };
      default:
        return null;
    }
  };

  const recommendationConfig = getRecommendationConfig();

  const formatPrice = (price: number) => {
    if (price >= 1000000000) {
      return `${(price / 1000000000).toFixed(1)} tỷ VNĐ`;
    }
    return `${(price / 1000000).toFixed(0)} triệu VNĐ`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Phân Tích AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted-foreground/20"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - scores.overall / 100)}`}
                className={getScoreColor(scores.overall)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor(scores.overall)}`} data-testid="text-overall-score">
                {scores.overall}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Điểm Tổng Quan</p>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Tiện ích', value: scores.amenities },
            { label: 'Quy hoạch & Hạ tầng', value: scores.planning },
            { label: 'An cư', value: scores.residential },
            { label: 'Đầu tư', value: scores.investment },
            { label: 'Rủi ro (thấp hơn = tốt)', value: 100 - scores.risk }
          ].map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-semibold ${getScoreColor(item.value)}`}>
                  {item.value}/100
                </span>
              </div>
              <Progress value={item.value} className="h-2" />
            </div>
          ))}
        </div>

        {estimatedPrice && (
          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Giá đề xuất hợp lý</p>
            <p className="text-2xl font-bold" data-testid="text-estimated-price">
              {formatPrice(estimatedPrice)}
            </p>
          </div>
        )}

        {recommendationConfig && (
          <Badge
            variant={recommendationConfig.variant}
            className="w-full justify-center py-2 text-base"
            data-testid="badge-recommendation"
          >
            {recommendationConfig.icon}
            <span className="ml-2">{recommendationConfig.text}</span>
          </Badge>
        )}

        {summary && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Tóm tắt phân tích</p>
            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-summary">
              {summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
