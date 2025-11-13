import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { School, Hospital, ShoppingCart, Dumbbell, Plane } from 'lucide-react';

interface AmenityCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  subcategories: string[];
}

interface AmenitiesFilterProps {
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  selectedCategories?: string[];
  onCategoryChange?: (categories: string[]) => void;
}

const categories: AmenityCategory[] = [
  {
    id: 'education',
    name: 'Giáo dục',
    icon: <School className="w-4 h-4" />,
    subcategories: ['Mầm non', 'Tiểu học', 'THCS', 'THPT', 'Đại học']
  },
  {
    id: 'healthcare',
    name: 'Y tế',
    icon: <Hospital className="w-4 h-4" />,
    subcategories: ['Bệnh viện', 'Phòng khám', 'Nhà thuốc']
  },
  {
    id: 'shopping',
    name: 'Mua sắm',
    icon: <ShoppingCart className="w-4 h-4" />,
    subcategories: ['Siêu thị', 'Cửa hàng tiện lợi', 'Trung tâm thương mại']
  },
  {
    id: 'entertainment',
    name: 'Giải trí',
    icon: <Dumbbell className="w-4 h-4" />,
    subcategories: ['Rạp phim', 'Phòng gym', 'Nhà hàng']
  },
  {
    id: 'transport',
    name: 'Giao thông',
    icon: <Plane className="w-4 h-4" />,
    subcategories: ['Sân bay', 'Nhà ga', 'Bến xe buýt', 'Trạm xe buýt']
  }
];

export default function AmenitiesFilter({
  radius = 1000,
  onRadiusChange,
  selectedCategories = [],
  onCategoryChange
}: AmenitiesFilterProps) {
  const handleCategoryToggle = (categoryId: string) => {
    const updated = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    onCategoryChange?.(updated);
  };

  const radiusPresets = [100, 500, 1000, 5000];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Tiện Ích Xung Quanh</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Bán kính tìm kiếm</Label>
            <span className="text-sm font-semibold" data-testid="text-radius">
              {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
            </span>
          </div>
          <Slider
            value={[radius]}
            onValueChange={(value) => onRadiusChange?.(value[0])}
            min={100}
            max={5000}
            step={100}
            data-testid="slider-radius"
          />
          <div className="flex gap-2 flex-wrap">
            {radiusPresets.map((preset) => (
              <Badge
                key={preset}
                variant={radius === preset ? "default" : "secondary"}
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => onRadiusChange?.(preset)}
                data-testid={`badge-radius-${preset}`}
              >
                {preset >= 1000 ? `${preset / 1000} km` : `${preset} m`}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                  data-testid={`checkbox-${category.id}`}
                />
                <Label
                  htmlFor={category.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {category.icon}
                  <span className="font-medium">{category.name}</span>
                </Label>
              </div>
              {selectedCategories.includes(category.id) && (
                <div className="ml-6 text-xs text-muted-foreground">
                  {category.subcategories.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
