import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { School, Hospital, ShoppingCart, Dumbbell, MapPin, Star, Store, Clock, Building, Expand, Minimize2 } from 'lucide-react';
import {
  getArray,
  getString,
  getNumber,
  isValidAmenity,
  safeReduce
} from '@/lib/typeSafety';
import { useState } from 'react';

interface Amenity {
  id: string;
  name: string;
  category: string;
  distance: number;
  walkTime: number;
  type?: string;
  subtype?: string;
  isChain?: boolean;
  tags?: {
    amenity?: string;
    shop?: string;
    brand?: string;
    operator?: string;
    name?: string;
    name_vi?: string;
    name_en?: string;
    school_type?: string;
    isced_level?: string;
    operator_type?: string;
    healthcare?: string;
    leisure?: string;
    tourism?: string;
    aeroway?: string;
    railway?: string;
    highway?: string;
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
  entertainment: <Dumbbell className="w-4 h-4" />,
  transport: <MapPin className="w-4 h-4" />,
  infrastructure: <Building className="w-4 h-4" />
};

const categoryNames: Record<string, string> = {
  education: 'Giáo dục',
  healthcare: 'Y tế',
  shopping: 'Mua sắm',
  entertainment: 'Giải trí',
  transport: 'Giao thông',
  infrastructure: 'Hạ tầng'
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

  if (tags.amenity === 'kindergarten') {
    return 'Trường Mầm non';
  }

  if (tags.amenity === 'library') {
    return 'Thư viện';
  }

  return 'Cơ sở giáo dục';
}

function getHealthcareTypeLabel(amenity: Amenity): string {
  if (amenity.category !== 'healthcare') return '';

  const tags = amenity.tags;
  if (!tags) return '';

  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') {
    return 'Bệnh viện';
  }

  if (tags.amenity === 'clinic') {
    return 'Phòng khám';
  }

  if (tags.amenity === 'doctors') {
    return 'Phòng khám bác sĩ';
  }

  if (tags.amenity === 'dentist') {
    return 'Phòng khám nha khoa';
  }

  if (tags.amenity === 'pharmacy') {
    return 'Nhà thuốc';
  }

  return 'Cơ sở y tế';
}

function getShoppingTypeLabel(amenity: Amenity): string {
  if (amenity.category !== 'shopping') return '';

  const tags = amenity.tags;
  if (!tags) return '';

  if (tags.shop === 'supermarket') {
    return 'Siêu thị';
  }

  if (tags.shop === 'mall' || tags.shop === 'department_store') {
    return 'Trung tâm thương mại';
  }

  if (tags.shop === 'convenience') {
    return 'Cửa hàng tiện lợi';
  }

  if (tags.shop === 'electronics' || tags.shop === 'mobile_phone') {
    return 'Điện tử & Điện thoại';
  }

  if (tags.shop === 'furniture') {
    return 'Nội thất';
  }

  if (tags.shop === 'clothing' || tags.shop === 'shoes') {
    return 'Thời trang';
  }

  if (tags.amenity === 'bank') {
    return 'Ngân hàng';
  }

  if (tags.amenity === 'atm') {
    return 'ATM';
  }

  if (tags.amenity === 'post_office') {
    return 'Bưu điện';
  }

  return 'Cửa hàng';
}

function getEntertainmentTypeLabel(amenity: Amenity): string {
  if (amenity.category !== 'entertainment') return '';

  const tags = amenity.tags;
  if (!tags) return '';

  if (tags.amenity === 'cinema') {
    return 'Rạp chiếu phim';
  }

  if (tags.amenity === 'theatre') {
    return 'Nhà hát';
  }

  if (tags.amenity === 'restaurant') {
    return 'Nhà hàng';
  }

  if (tags.amenity === 'cafe') {
    return 'Quán cà phê';
  }

  if (tags.amenity === 'fast_food') {
    return 'Đồ ăn nhanh';
  }

  if (tags.leisure === 'fitness_centre' || tags.leisure === 'sports_centre') {
    return 'Trung tâm thể thao';
  }

  if (tags.leisure === 'stadium') {
    return 'Sân vận động';
  }

  if (tags.leisure === 'park' || tags.leisure === 'garden') {
    return 'Công viên';
  }

  if (tags.tourism === 'hotel') {
    return 'Khách sạn';
  }

  if (tags.tourism === 'museum' || tags.tourism === 'gallery') {
    return 'Bảo tàng & Triển lãm';
  }

  return 'Giải trí';
}

function getTransportTypeLabel(amenity: Amenity): string {
  if (amenity.category !== 'transport') return '';

  const tags = amenity.tags;
  if (!tags) return '';

  if (tags.aeroway === 'aerodrome') {
    return 'Sân bay';
  }

  if (tags.railway === 'station') {
    return 'Nhà ga';
  }

  if (tags.railway === 'halt' || tags.railway === 'tram_stop') {
    return 'Trạm dừng';
  }

  if (tags.amenity === 'bus_station') {
    return 'Bến xe buýt';
  }

  if (tags.amenity === 'bus_stop' || tags.highway === 'bus_stop') {
    return 'Trạm xe buýt';
  }

  if (tags.amenity === 'taxi') {
    return 'Trạm taxi';
  }

  return 'Giao thông';
}

function getTypeLabel(amenity: Amenity): string {
  switch (amenity.category) {
    case 'education': return getEducationTypeLabel(amenity);
    case 'healthcare': return getHealthcareTypeLabel(amenity);
    case 'shopping': return getShoppingTypeLabel(amenity);
    case 'entertainment': return getEntertainmentTypeLabel(amenity);
    case 'transport': return getTransportTypeLabel(amenity);
    default: return '';
  }
}

export default function AmenityList({ amenities = [], onAmenityClick }: AmenityListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Safe array handling with validation
  const safeAmenities = getArray(amenities).filter(isValidAmenity);

  const groupedAmenities = safeReduce(safeAmenities, (acc, amenity) => {
    const category = getString(amenity.category, 'other');
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(amenity);
    return acc;
  }, {} as Record<string, Amenity[]>);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 sm:pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Tiện Ích Gần Nhất</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs" data-testid="badge-amenity-count">
              {safeAmenities.length} địa điểm
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2 text-xs sm:text-sm sm:hidden"
              data-testid="button-expand-amenity-card"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Expand className="w-3 h-3" />}
              <span className="ml-1">{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="px-3 sm:px-6">
            <ScrollArea className="h-[40vh] max-h-[400px] min-h-[300px] sm:h-[50vh] sm:max-h-[500px] sm:min-h-[350px] pr-2 sm:pr-4">
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {Object.entries(groupedAmenities).map(([category, items]) => (
              <div key={category} className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold flex-wrap">
                  <div className="scale-90 sm:scale-100">
                    {categoryIcons[category] || <MapPin className="w-4 h-4" />}
                  </div>
                  <span className="truncate">{categoryNames[category] || category}</span>
                  <Badge variant="outline" className="ml-auto shrink-0 text-[10px] sm:text-xs">
                    {getArray(items).length}
                  </Badge>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  {getArray(items).map((amenity) => {
                    const typeLabel = getTypeLabel(amenity);

                    return (
                      <div
                        key={getString(amenity.id, Math.random().toString())}
                        className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-1.5 sm:p-2 md:p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer border"
                        onClick={() => isValidAmenity(amenity) && onAmenityClick?.(amenity)}
                        data-testid={`amenity-${getString(amenity.id)}`}
                      >
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {getString(amenity.name, 'Không xác định')}
                            </p>
                            {amenity.isChain && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0.5 shrink-0">
                                <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                <span className="hidden sm:inline">Chuỗi</span>
                                <span className="sm:hidden">C</span>
                              </Badge>
                            )}
                          </div>
                          {typeLabel && (
                            <p className="text-[10px] sm:text-xs text-primary font-medium mt-0.5 truncate">
                              {typeLabel}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 mt-1 flex-wrap">
                            <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                              {getNumber(amenity.walkTime, 0)} phút
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                              ({getNumber(amenity.distance, 0) >= 1000
                                ? `${(getNumber(amenity.distance, 0) / 1000).toFixed(1)} km`
                                : `${getNumber(amenity.distance, 0)} m`})
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
