import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { School, Hospital, ShoppingCart, Dumbbell, MapPin } from 'lucide-react';

interface Amenity {
  id: string;
  name: string;
  category: string;
  distance: number;
  walkTime: number;
  type?: string;
  subtype?: string;
  tags?: {
    amenity?: string;
    school_type?: string;
    isced_level?: string;
    operator_type?: string;
  };
}

interface AmenityListProps {
  amenities?: Amenity[];
  onAmenityClick?: (amenity: Amenity) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  education: <School className="w-4 h-4" />,
  healthcare: <Hospital className="w-4 h-4" />,
  shopping: <ShoppingCart className="w-4 h-4" />,
  entertainment: <Dumbbell className="w-4 h-4" />
};

const categoryNames: Record<string, string> = {
  education: 'Giáo dục',
  healthcare: 'Y tế',
  shopping: 'Mua sắm',
  entertainment: 'Giải trí'
};

function getEducationTypeLabel(amenity: Amenity): string {
  if (amenity.category !== 'education') return '';
  
  const tags = amenity.tags;
  if (!tags) return '';
  
  if (tags.amenity === 'university') {
    return 'Đại học / Cao đẳng';
  }
  
  if (tags.amenity === 'college') {
    return 'Cao đẳng / Trung cấp';
  }
  
  if (tags.amenity === 'school') {
    if (tags.school_type === 'primary' || tags.isced_level === '1') {
      return 'Trường Tiểu học';
    }
    if (tags.school_type === 'secondary' || tags.isced_level === '2') {
      return 'Trường Trung học cơ sở (THCS)';
    }
    if (tags.school_type === 'high' || tags.isced_level === '3') {
      return 'Trường Trung học phổ thông (THPT)';
    }
    if (tags.school_type === 'kindergarten' || tags.isced_level === '0') {
      return 'Trường Mầm non';
    }
    
    if (tags.operator_type === 'government' || tags.operator_type === 'public') {
      return 'Trường Công lập';
    }
    if (tags.operator_type === 'private') {
      return 'Trường Tư thục';
    }
    
    return 'Trường học';
  }
  
  return 'Cơ sở giáo dục';
}

export default function AmenityList({ amenities = [], onAmenityClick }: AmenityListProps) {
  const groupedAmenities = amenities.reduce((acc, amenity) => {
    if (!acc[amenity.category]) {
      acc[amenity.category] = [];
    }
    acc[amenity.category].push(amenity);
    return acc;
  }, {} as Record<string, Amenity[]>);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Tiện Ích Gần Nhất</CardTitle>
          <Badge variant="secondary" data-testid="badge-amenity-count">
            {amenities.length} địa điểm
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedAmenities).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {categoryIcons[category]}
                  <span>{categoryNames[category]}</span>
                  <Badge variant="outline" className="ml-auto">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((amenity) => {
                    const educationType = amenity.category === 'education' ? getEducationTypeLabel(amenity) : '';
                    
                    return (
                      <div
                        key={amenity.id}
                        className="flex items-start gap-3 p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer border"
                        onClick={() => onAmenityClick?.(amenity)}
                        data-testid={`amenity-${amenity.id}`}
                      >
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {amenity.name}
                          </p>
                          {educationType && (
                            <p className="text-xs text-primary font-medium mt-0.5">
                              {educationType}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {amenity.distance >= 1000
                                ? `${(amenity.distance / 1000).toFixed(1)} km`
                                : `${amenity.distance} m`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {amenity.walkTime} phút đi bộ
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
