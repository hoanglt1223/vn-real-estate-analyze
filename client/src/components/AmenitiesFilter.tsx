import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { School, Hospital, ShoppingCart, Dumbbell, Plane, Store } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
  includeSmallShops?: boolean;
  onIncludeSmallShopsChange?: (includeSmallShops: boolean) => void;
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
  onCategoryChange,
  includeSmallShops = false,
  onIncludeSmallShopsChange
}: AmenitiesFilterProps) {
  // Debounced radius state for smoother slider interaction
  const [localRadius, setLocalRadius] = useState(radius);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Sync with external radius changes
  useEffect(() => {
    setLocalRadius(radius);
  }, [radius]);

  // Debounced radius change handler
  const handleRadiusSliderChange = (newRadius: number) => {
    setLocalRadius(newRadius);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to call parent after delay
    debounceTimerRef.current = setTimeout(() => {
      onRadiusChange?.(newRadius);
    }, 400);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const updated = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    onCategoryChange?.(updated);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const radiusPresets = [500, 1000, 5000, 10000, 30000];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-base sm:text-lg">Tiện Ích Xung Quanh</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs sm:text-sm font-medium">Bán kính tìm kiếm</Label>
            <span className="text-xs sm:text-sm font-semibold" data-testid="text-radius">
              {localRadius >= 1000 ? `${localRadius / 1000} km` : `${localRadius} m`}
            </span>
          </div>
          <Slider
            value={[localRadius]}
            onValueChange={(value) => handleRadiusSliderChange(value[0])}
            min={100}
            max={30000}
            step={100}
            data-testid="slider-radius"
            className="sm:scale-100 scale-95 origin-left"
          />
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            {radiusPresets.map((preset) => (
              <Badge
                key={preset}
                variant={radius === preset ? "default" : "secondary"}
                className="cursor-pointer hover-elevate active-elevate-2 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5"
                onClick={() => onRadiusChange?.(preset)}
                data-testid={`badge-radius-${preset}`}
              >
                {preset >= 1000 ? `${preset / 1000} km` : `${preset} m`}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <Label htmlFor="include-small-shops" className="text-xs sm:text-sm font-medium cursor-pointer">
                Hiển thị quán nhỏ lẻ
              </Label>
            </div>
            <Switch
              id="include-small-shops"
              checked={includeSmallShops}
              onCheckedChange={onIncludeSmallShopsChange}
              data-testid="switch-include-small-shops"
              className="scale-90 sm:scale-100"
            />
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
            Bao gồm các cửa hàng nhỏ, quán ăn địa phương không phải chuỗi lớn
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Checkbox
                  id={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                  data-testid={`checkbox-${category.id}`}
                  className="scale-90 sm:scale-100"
                />
                <Label
                  htmlFor={category.id}
                  className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm"
                >
                  <div className="scale-90 sm:scale-100">
                    {category.icon}
                  </div>
                  <span className="font-medium">{category.name}</span>
                </Label>
              </div>
              {selectedCategories.includes(category.id) && (
                <div className="ml-5 sm:ml-6 text-[10px] sm:text-xs text-muted-foreground leading-tight">
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
