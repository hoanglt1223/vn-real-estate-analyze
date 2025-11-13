import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PriceData {
  min: number;
  avg: number;
  max: number;
  median: number;
  listingCount: number;
  trend?: 'up' | 'down' | 'stable';
}

interface MarketPriceCardProps {
  data?: PriceData;
}

export default function MarketPriceCard({ data }: MarketPriceCardProps) {
  if (!data) return null;

  const formatPrice = (price: number) => {
    if (price >= 1000000000) {
      return `${(price / 1000000000).toFixed(1)} tỷ`;
    }
    return `${(price / 1000000).toFixed(0)} tr`;
  };

  const chartData = [
    { name: 'Thấp nhất', value: data.min, color: 'hsl(var(--chart-1))' },
    { name: 'Trung bình', value: data.avg, color: 'hsl(var(--chart-3))' },
    { name: 'Cao nhất', value: data.max, color: 'hsl(var(--chart-2))' }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Giá Thị Trường
          </CardTitle>
          {data.trend && (
            <Badge variant={data.trend === 'up' ? 'default' : data.trend === 'down' ? 'destructive' : 'secondary'}>
              {data.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {data.trend === 'up' ? 'Tăng' : data.trend === 'down' ? 'Giảm' : 'Ổn định'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Thấp nhất</p>
            <p className="text-xl font-bold" data-testid="text-price-min">
              {formatPrice(data.min)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Trung bình</p>
            <p className="text-xl font-bold text-primary" data-testid="text-price-avg">
              {formatPrice(data.avg)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Cao nhất</p>
            <p className="text-xl font-bold" data-testid="text-price-max">
              {formatPrice(data.max)}
            </p>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(value) => formatPrice(value)} />
              <Tooltip formatter={(value) => formatPrice(value as number)} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
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
            {data.listingCount} tin
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
