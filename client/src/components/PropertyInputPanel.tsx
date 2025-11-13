import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Compass, MapPin, Ruler, Home } from 'lucide-react';

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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Thông Tin Khu Đất
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lat" data-testid="label-latitude">Vĩ độ (Latitude)</Label>
            <Input
              id="lat"
              name="lat"
              type="number"
              step="any"
              placeholder="10.8231"
              data-testid="input-latitude"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng" data-testid="label-longitude">Kinh độ (Longitude)</Label>
            <Input
              id="lng"
              name="lng"
              type="number"
              step="any"
              placeholder="106.6297"
              data-testid="input-longitude"
            />
          </div>
          <Button type="submit" className="w-full" data-testid="button-submit-coordinates">
            Định Vị
          </Button>
        </form>

        {area && area > 0 && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ruler className="w-4 h-4" />
                <span>Diện tích</span>
              </div>
              <span className="font-semibold" data-testid="text-area">
                {area.toLocaleString('vi-VN')} m²
              </span>
            </div>

            {orientation && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Compass className="w-4 h-4" />
                  <span>Hướng đất</span>
                </div>
                <span className="font-semibold" data-testid="text-orientation">
                  {orientation}
                </span>
              </div>
            )}

            {frontageCount !== undefined && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Home className="w-4 h-4" />
                  <span>Số mặt tiền</span>
                </div>
                <span className="font-semibold" data-testid="text-frontage">
                  {frontageCount}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
