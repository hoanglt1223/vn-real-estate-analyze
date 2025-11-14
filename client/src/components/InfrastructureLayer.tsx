import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Layers, Construction, Train, Building2, Zap, Cross, Waves, Bus, AlertTriangle, Info } from 'lucide-react';

interface InfrastructureItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  description?: string;
  risk?: 'low' | 'medium' | 'high';
  count?: number;
}

interface InfrastructureGroup {
  name: string;
  description: string;
  items: InfrastructureItem[];
  icon: React.ReactNode;
}

interface InfrastructureLayerProps {
  selectedLayers?: string[];
  onLayerChange?: (layers: string[]) => void;
}

const infrastructureGroups: InfrastructureGroup[] = [
  {
    name: 'Giao thông',
    description: 'Mạng lưới giao thông và phương tiện công cộng',
    icon: <Construction className="w-4 h-4" />,
    items: [
      {
        id: 'roads',
        name: 'Đường lớn',
        icon: <Construction className="w-4 h-4" />,
        description: 'Các tuyến đường giao thông chính'
      },
      {
        id: 'metro',
        name: 'Trạm Metro',
        icon: <Train className="w-4 h-4" />,
        description: 'Các ga tàu điện ngầm'
      },
      {
        id: 'metro_lines',
        name: 'Tuyến Metro',
        icon: <Train className="w-4 h-4" />,
        description: 'Các tuyến tàu điện ngầm đang hoạt động'
      },
      {
        id: 'bus_routes',
        name: 'Tuyến xe buýt',
        icon: <Bus className="w-4 h-4" />,
        description: 'Các tuyến xe buýt công cộng'
      }
    ]
  },
  {
    name: 'Quy hoạch rủi ro',
    description: 'Các yếu tố hạ tầng có thể ảnh hưởng đến giá trị bất động sản',
    icon: <AlertTriangle className="w-4 h-4" />,
    items: [
      {
        id: 'industrial',
        name: 'Khu công nghiệp',
        icon: <Building2 className="w-4 h-4" />,
        description: 'Khu vực sản xuất công nghiệp, có thể gây ô nhiễm',
        risk: 'medium'
      },
      {
        id: 'power',
        name: 'Trạm điện',
        icon: <Zap className="w-4 h-4" />,
        description: 'Trạm biến thế và các công trình điện lực',
        risk: 'medium'
      },
      {
        id: 'cemetery',
        name: 'Nghĩa trang',
        icon: <Cross className="w-4 h-4" />,
        description: 'Nghĩa trang và khu vực an táng',
        risk: 'low'
      }
    ]
  },
  {
    name: 'Thiên nhiên',
    description: 'Đặc điểm tự nhiên và địa hình khu vực',
    icon: <Waves className="w-4 h-4" />,
    items: [
      {
        id: 'water',
        name: 'Sông & kênh',
        icon: <Waves className="w-4 h-4" />,
        description: 'Các tuyến sông, kênh, mương thủy lợi'
      }
    ]
  }
];

export default function InfrastructureLayer({
  selectedLayers = [],
  onLayerChange
}: InfrastructureLayerProps) {
  const handleLayerToggle = (layerId: string) => {
    const updated = selectedLayers.includes(layerId)
      ? selectedLayers.filter(id => id !== layerId)
      : [...selectedLayers, layerId];
    onLayerChange?.(updated);
  };

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-blue-600 dark:text-blue-400';
      default: return '';
    }
  };

  const getRiskBadgeColor = (risk?: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getRiskLabel = (risk?: string) => {
    switch (risk) {
      case 'high': return 'Cao';
      case 'medium': return 'Trung bình';
      case 'low': return 'Thấp';
      default: return '';
    }
  };

  const totalSelected = selectedLayers.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Hạ Tầng & Quy Hoạch
          </CardTitle>
          {totalSelected > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalSelected} đã chọn
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Xem các lớp hạ tầng và yếu tố quy hoạch ảnh hưởng đến bất động sản
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {infrastructureGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            <div className="flex items-center gap-2">
              {group.icon}
              <div className="flex-1">
                <h3 className="text-sm font-medium">{group.name}</h3>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
            </div>

            <div className="space-y-2 pl-6">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-md border hover-elevate transition-all cursor-pointer ${
                    selectedLayers.includes(item.id)
                      ? 'bg-primary/10 border-primary/30 shadow-sm'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleLayerToggle(item.id)}
                  data-testid={`layer-item-${item.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      id={item.id}
                      checked={selectedLayers.includes(item.id)}
                      onCheckedChange={() => handleLayerToggle(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-${item.id}`}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={getRiskColor(item.risk)}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium select-none">
                          {item.name}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 select-none">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                    {item.risk && (
                      <Badge
                        variant={getRiskBadgeColor(item.risk)}
                        className="text-xs"
                        data-testid={`risk-${item.id}`}
                      >
                        {getRiskLabel(item.risk)}
                      </Badge>
                    )}
                    {item.count && (
                      <Badge variant="outline" className="text-xs">
                        {item.count}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {groupIndex < infrastructureGroups.length - 1 && (
              <Separator className="mt-4" />
            )}
          </div>
        ))}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Lưu ý quan trọng:</p>
              <ul className="space-y-1">
                <li>• Các yếu tố "Quy hoạch rủi ro" có thể ảnh hưởng đến giá trị bất động sản</li>
                <li>• Khoảng cách an toàn đề xuất: Công nghiệp (&gt;500m), Trạm điện (&gt;200m), Nghĩa trang (&gt;300m)</li>
                <li>• Hạ tầng giao thông tốt sẽ tăng giá trị và tiện ích khu vực</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
