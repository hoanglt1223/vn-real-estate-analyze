import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, MapPin } from 'lucide-react';
import { useState } from 'react';

interface Amenity {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  distance?: number;
}

interface AmenityStatisticsProps {
  amenities: Amenity[];
}

const categoryNames: Record<string, string> = {
  education: 'Giáo dục',
  healthcare: 'Y tế',
  shopping: 'Mua sắm',
  entertainment: 'Giải trí',
  transport: 'Giao thông',
  infrastructure: 'Hạ tầng'
};

const categoryColors: Record<string, string> = {
  education: 'bg-blue-500',
  healthcare: 'bg-red-500',
  shopping: 'bg-green-500',
  entertainment: 'bg-orange-500',
  transport: 'bg-purple-500',
  infrastructure: 'bg-gray-500'
};

export default function AmenityStatistics({ amenities }: AmenityStatisticsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const filteredAmenities = selectedCategory === 'all' 
    ? amenities 
    : amenities.filter(a => a.category === selectedCategory);

  const categoryCounts: Record<string, number> = {};
  const categoryAverageDistance: Record<string, number> = {};
  
  amenities.forEach(amenity => {
    categoryCounts[amenity.category] = (categoryCounts[amenity.category] || 0) + 1;
    
    if (amenity.distance) {
      if (!categoryAverageDistance[amenity.category]) {
        categoryAverageDistance[amenity.category] = 0;
      }
      categoryAverageDistance[amenity.category] += amenity.distance;
    }
  });

  Object.keys(categoryAverageDistance).forEach(category => {
    categoryAverageDistance[category] = categoryAverageDistance[category] / categoryCounts[category];
  });

  const topAmenities = filteredAmenities
    .filter(a => a.distance)
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, 10);

  const availableCategories = Object.keys(categoryCounts).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Thống Kê Tiện Ích
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {amenities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Vẽ khu đất và nhấn "Phân Tích Ngay" để xem thống kê
          </p>
        ) : (
          <>
            {availableCategories.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                  data-testid="filter-all"
                >
                  Tất cả ({amenities.length})
                </Button>
                {availableCategories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    data-testid={`filter-${category}`}
                  >
                    {categoryNames[category] || category} ({categoryCounts[category]})
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">Tổng quan</p>
              {Object.entries(categoryCounts).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${categoryColors[category] || 'bg-gray-500'}`} />
                    <span className="text-sm">{categoryNames[category] || category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid={`stat-count-${category}`}>
                      {count}
                    </Badge>
                    {categoryAverageDistance[category] && (
                      <span className="text-xs text-muted-foreground">
                        ~{Math.round(categoryAverageDistance[category])}m
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {topAmenities.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Gần nhất
                </p>
                <div className="space-y-2">
                  {topAmenities.map((amenity, index) => (
                    <div
                      key={amenity.id}
                      className="flex items-start justify-between text-xs p-2 rounded-md bg-muted/50"
                      data-testid={`nearest-amenity-${index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{amenity.name}</p>
                        <p className="text-muted-foreground">
                          {categoryNames[amenity.category] || amenity.category}
                        </p>
                      </div>
                      <Badge variant="outline" className="ml-2 flex-shrink-0">
                        {Math.round(amenity.distance || 0)}m
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
