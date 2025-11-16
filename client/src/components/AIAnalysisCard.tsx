import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Brain, CheckCircle2, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getNumber } from '@/lib/typeSafety';

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
  scoreExplanations?: {
    overall: string;
    amenities: string;
    planning: string;
    residential: string;
    investment: string;
    risk: string;
  };
  recommendation?: 'buy' | 'consider' | 'avoid';
  estimatedPrice?: number;
  summary?: string;
}

export default function AIAnalysisCard({
  scores,
  scoreExplanations,
  recommendation,
  estimatedPrice,
  summary
}: AIAnalysisCardProps) {
  const [isExplanationsOpen, setIsExplanationsOpen] = useState(false);
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

  const formatPrice = (price: any) => {
    const safePrice = getNumber(price);
    if (safePrice >= 1000000000) {
      return `${(safePrice / 1000000000).toFixed(1)} tỷ VNĐ`;
    }
    return `${(safePrice / 1000000).toFixed(0)} triệu VNĐ`;
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
            { label: 'Tiện ích', value: scores.amenities, key: 'amenities' },
            { label: 'Quy hoạch & Hạ tầng', value: scores.planning, key: 'planning' },
            { label: 'An cư', value: scores.residential, key: 'residential' },
            { label: 'Đầu tư', value: scores.investment, key: 'investment' },
            { label: 'Rủi ro (thấp hơn = tốt)', value: 100 - scores.risk, key: 'risk' }
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

        {scoreExplanations && (
          <Collapsible open={isExplanationsOpen} onOpenChange={setIsExplanationsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <ChevronDown className={`w-4 h-4 transition-transform ${isExplanationsOpen ? 'rotate-180' : ''}`} />
              <span>Cách tính điểm chi tiết</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold mb-1">Điểm Tổng Quan:</p>
                <p className="text-xs text-muted-foreground">{scoreExplanations.overall}</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold mb-1">Tiện Ích:</p>
                <p className="text-xs text-muted-foreground">{scoreExplanations.amenities}</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold mb-1">Quy Hoạch:</p>
                <p className="text-xs text-muted-foreground">{scoreExplanations.planning}</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold mb-1">An Cư:</p>
                <p className="text-xs text-muted-foreground">{scoreExplanations.residential}</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold mb-1">Đầu Tư:</p>
                <p className="text-xs text-muted-foreground">{scoreExplanations.investment}</p>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs font-semibold mb-1">Rủi Ro:</p>
                <p className="text-xs text-muted-foreground">{scoreExplanations.risk}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

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
