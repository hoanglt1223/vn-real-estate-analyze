import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Factory, Zap, Cross, Wind, MapPinOff } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface RiskItem {
  id: string;
  type: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  distance?: number;
  icon: React.ReactNode;
}

interface RiskAssessmentCardProps {
  risks?: RiskItem[];
  overallRiskLevel?: 'high' | 'medium' | 'low';
}

const riskIcons: Record<string, React.ReactNode> = {
  pollution: <Factory className="w-4 h-4" />,
  power: <Zap className="w-4 h-4" />,
  cemetery: <Cross className="w-4 h-4" />,
  flood: <Wind className="w-4 h-4" />,
  deadend: <MapPinOff className="w-4 h-4" />
};

export default function RiskAssessmentCard({ risks = [], overallRiskLevel = 'low' }: RiskAssessmentCardProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'secondary';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Cao';
      case 'medium': return 'Trung bình';
      case 'low': return 'Thấp';
      default: return 'Không rõ';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Đánh Giá Rủi Ro
          </CardTitle>
          <Badge variant={getRiskColor(overallRiskLevel)} data-testid="badge-risk-level">
            Mức độ: {getRiskLabel(overallRiskLevel)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Không phát hiện rủi ro đáng kể</p>
          </div>
        ) : (
          risks.map((risk) => <RiskItemCard key={risk.id} risk={risk} />)
        )}
      </CardContent>
    </Card>
  );
}

function RiskItemCard({ risk }: { risk: RiskItem }) {
  const [isOpen, setIsOpen] = useState(false);

  const getBgColor = (type: string) => {
    switch (type) {
      case 'high': return 'bg-destructive/10 border-destructive/20';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-muted';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={`p-4 rounded-lg border cursor-pointer hover-elevate ${getBgColor(risk.type)}`}
          data-testid={`risk-${risk.id}`}
        >
          <div className="flex items-start gap-3">
            <div className={risk.type === 'high' ? 'text-destructive' : risk.type === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}>
              {risk.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{risk.title}</p>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              {risk.distance && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cách {risk.distance}m
                </p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 py-2">
        <p className="text-sm text-muted-foreground">{risk.description}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
