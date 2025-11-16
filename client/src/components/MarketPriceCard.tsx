import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, Expand, Minimize2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getNumber } from '@/lib/typeSafety';
import { useState } from 'react';

interface PriceData {
  min: number;
  avg: number;
  max: number;
  median: number;
  listingCount: number;
  trend?: 'up' | 'down' | 'stable';
  pricePerSqm?: number;
  sources?: Array<{
    name: string;
    type: string;
    listingCount?: number;
  }>;
}

interface MarketPriceCardProps {
  data?: PriceData;
}

export default function MarketPriceCard({ data }: MarketPriceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!data) return null;

  const formatPrice = (price: any) => {
    const safePrice = getNumber(price);
    if (safePrice >= 1000000000) {
      return `${(safePrice / 1000000000).toFixed(1)} tỷ VND`;
    }
    return `${(safePrice / 1000000).toFixed(0)} tr VND`;
  };

  const formatPricePerSqm = (price: any) => {
    const safePrice = getNumber(price);
    if (safePrice >= 1000000) {
      return `${(safePrice / 1000000).toFixed(1)} tr/m²`;
    }
    return `${(safePrice / 1000).toFixed(0)}k/m²`;
  };

  const chartData = [
    { name: 'Thấp nhất', value: getNumber(data.min), color: 'hsl(var(--chart-1))' },
    { name: 'Trung bình', value: getNumber(data.avg), color: 'hsl(var(--chart-3))' },
    { name: 'Cao nhất', value: getNumber(data.max), color: 'hsl(var(--chart-2))' }
  ];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 sm:pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            Giá Thị Trường
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.trend && (
              <Badge variant={data.trend === 'up' ? 'default' : data.trend === 'down' ? 'destructive' : 'secondary'} className="text-xs">
                {data.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {data.trend === 'up' ? 'Tăng' : data.trend === 'down' ? 'Giảm' : 'Ổn định'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2 text-xs sm:text-sm sm:hidden"
              data-testid="button-expand-price-card"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Expand className="w-3 h-3" />}
              <span className="ml-1">{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Thấp nhất</p>
            <p className="text-xs sm:text-sm md:text-lg font-bold break-words" data-testid="text-price-min">
              {formatPrice(data.min)}
            </p>
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Trung bình</p>
            <p className="text-xs sm:text-sm md:text-lg font-bold text-primary break-words" data-testid="text-price-avg">
              {formatPrice(data.avg)}
            </p>
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Cao nhất</p>
            <p className="text-xs sm:text-sm md:text-lg font-bold break-words" data-testid="text-price-max">
              {formatPrice(data.max)}
            </p>
          </div>
        </div>

        {data.pricePerSqm != null && (
          <div className="p-2 sm:p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Giá trung bình/m²</span>
              <span className="text-sm sm:text-base md:text-lg font-bold text-primary" data-testid="text-price-per-sqm">
                {formatPricePerSqm(getNumber(data.pricePerSqm))}
              </span>
            </div>
          </div>
        )}

        <div className="h-24 sm:h-28 md:h-32 lg:h-40 min-h-[96px] sm:min-h-[112px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis
                dataKey="name"
                fontSize={9}
                tick={{ fontSize: 9 }}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis
                fontSize={9}
                tickFormatter={(value) => formatPrice(value)}
                width={60}
              />
              <Tooltip
                formatter={(value) => formatPrice(value as number)}
                contentStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">Số tin đăng</span>
          <Badge variant="outline" data-testid="badge-listing-count">
            {getNumber(data.listingCount)} tin
          </Badge>
        </div>

        {data.sources && data.sources.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold mb-2">Nguồn dữ liệu:</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {data.sources.map((source, idx) => (
                <div key={idx} className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate font-medium">• {source.name}</span>
                    </div>
                    {source.listingCount && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {source.listingCount}
                      </Badge>
                    )}
                  </div>
                  {source.type && (
                    <div className="ml-4">
                      <Badge variant="outline" className="text-[10px] px-2 py-0">
                        {source.type === 'real_estate_portal' ? 'BĐS Portal' :
                         source.type === 'marketplace' ? 'Marketplace' :
                         source.type === 'estimated' ? 'Ước tính' : source.type}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
