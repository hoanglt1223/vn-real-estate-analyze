import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Compass, MapPin, Ruler, Home, Info } from 'lucide-react';

interface PropertyInputPanelProps {
  area?: number;
  orientation?: string;
  frontageCount?: number;
  onCoordinatesSubmit?: (lat: number, lng: number) => void;
}

export default function PropertyInputPanel({
  area,
  orientation,
  frontageCount,
  onCoordinatesSubmit
}: PropertyInputPanelProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const lat = parseFloat(formData.get('lat') as string);
    const lng = parseFloat(formData.get('lng') as string);
    onCoordinatesSubmit?.(lat, lng);
  };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            Thông Tin Khu Đất
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-2">
                <Label htmlFor="lat" data-testid="label-latitude" className="text-sm">Vĩ độ (Latitude)</Label>
                <Input
                  id="lat"
                  name="lat"
                  type="number"
                  step="any"
                  placeholder="10.8231"
                  data-testid="input-latitude"
                  className="text-sm"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Nhập tọa độ vĩ độ của khu đất (ví dụ: 10.8231 cho TP.HCM)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-2">
                <Label htmlFor="lng" data-testid="label-longitude" className="text-sm">Kinh độ (Longitude)</Label>
                <Input
                  id="lng"
                  name="lng"
                  type="number"
                  step="any"
                  placeholder="106.6297"
                  data-testid="input-longitude"
                  className="text-sm"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Nhập tọa độ kinh độ của khu đất (ví dụ: 106.6297 cho TP.HCM)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" className="w-full text-sm" size="sm" data-testid="button-submit-coordinates">
                Định Vị
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Đặt marker bản đồ tại tọa độ đã nhập</p>
            </TooltipContent>
          </Tooltip>
        </form>

        {area && area > 0 && (
          <div className="pt-3 sm:pt-4 border-t space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Ruler className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="truncate">Diện tích</span>
              </div>
              <span className="font-semibold text-xs sm:text-sm" data-testid="text-area">
                {area.toLocaleString('vi-VN')} m²
              </span>
            </div>

            {orientation && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Compass className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="truncate">Hướng đất</span>
                </div>
                <span className="font-semibold text-xs sm:text-sm" data-testid="text-orientation">
                  {orientation}
                </span>
              </div>
            )}

            {frontageCount !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="truncate">Số mặt tiền</span>
                </div>
                <span className="font-semibold text-xs sm:text-sm" data-testid="text-frontage">
                  {frontageCount}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
