import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Layers, Construction, Train, Building2, Zap, Cross, Waves, Bus } from 'lucide-react';

interface InfrastructureItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  count?: number;
}

interface InfrastructureLayerProps {
  selectedLayers?: string[];
  onLayerChange?: (layers: string[]) => void;
}

const infrastructureItems: InfrastructureItem[] = [
  { id: 'roads', name: 'Đường lớn', icon: <Construction className="w-4 h-4" /> },
  { id: 'metro', name: 'Trạm Metro', icon: <Train className="w-4 h-4" /> },
  { id: 'bus_routes', name: 'Tuyến xe buýt', icon: <Bus className="w-4 h-4" /> },
  { id: 'metro_lines', name: 'Tuyến Metro', icon: <Train className="w-4 h-4" /> },
  { id: 'industrial', name: 'Khu công nghiệp', icon: <Building2 className="w-4 h-4" /> },
  { id: 'power', name: 'Trạm điện', icon: <Zap className="w-4 h-4" /> },
  { id: 'cemetery', name: 'Nghĩa trang', icon: <Cross className="w-4 h-4" /> },
  { id: 'water', name: 'Sông & kênh', icon: <Waves className="w-4 h-4" /> }
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Hạ Tầng & Quy Hoạch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {infrastructureItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-md border hover-elevate"
          >
            <div className="flex items-center gap-3">
              <Checkbox
                id={item.id}
                checked={selectedLayers.includes(item.id)}
                onCheckedChange={() => handleLayerToggle(item.id)}
                data-testid={`checkbox-${item.id}`}
              />
              <Label
                htmlFor={item.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                {item.icon}
                <span>{item.name}</span>
              </Label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
