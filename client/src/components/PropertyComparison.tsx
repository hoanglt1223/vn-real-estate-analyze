import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Compare, Plus, X, Check, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PropertyAnalysis } from '@shared/schema';
import { createPropertyComparison } from '@/lib/api';

interface PropertyComparisonProps {
  properties: PropertyAnalysis[];
  onPropertySelect?: (propertyIds: string[]) => void;
}

interface ComparisonData {
  propertyId: string;
  property: PropertyAnalysis;
  metrics: {
    area: number;
    pricePerSqm: number;
    overallScore: number;
    amenityScore: number;
    riskLevel: string;
    frontageCount: number;
  };
}

export default function PropertyComparison({ properties, onPropertySelect }: PropertyComparisonProps) {
  const { toast } = useToast();
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComparisonIcon = (value: number, compareValue: number) => {
    if (value > compareValue) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (value < compareValue) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const handlePropertyToggle = (propertyId: string) => {
    setSelectedProperties(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      }
      if (prev.length >= 4) {
        toast({
          title: 'Giới hạn',
          description: 'Chỉ có thể so sánh tối đa 4 bất động sản',
          variant: 'destructive'
        });
        return prev;
      }
      return [...prev, propertyId];
    });
  };

  const handleCompare = () => {
    if (selectedProperties.length < 2) {
      toast({
        title: 'Thông báo',
        description: 'Vui lòng chọn ít nhất 2 bất động sản để so sánh',
        variant: 'destructive'
      });
      return;
    }

    const selectedPropertiesData = selectedProperties.map(propertyId => {
      const property = properties.find(p => p.id === propertyId);
      if (!property) return null;

      return {
        propertyId,
        property,
        metrics: {
          area: property.area,
          pricePerSqm: property.marketData?.avgPricePerSqm || 0,
          overallScore: property.aiAnalysis?.scores?.overall || 0,
          amenityScore: property.aiAnalysis?.scores?.amenities || 0,
          riskLevel: property.risks?.[0]?.severity || 'low',
          frontageCount: property.frontageCount,
        }
      } as ComparisonData;
    }).filter(Boolean) as ComparisonData[];

    setComparisonData(selectedPropertiesData);
    setIsDialogOpen(true);
  };

  const handleSaveComparison = async () => {
    try {
      const userId = 'demo-user'; // In real app, get from auth
      const comparisonResult = {
        properties: comparisonData.map(data => ({
          id: data.propertyId,
          propertyType: data.property.propertyType,
          area: data.metrics.area,
          pricePerSqm: data.metrics.pricePerSqm,
          score: data.metrics.overallScore,
          riskLevel: data.metrics.riskLevel,
        })),
        summary: {
          totalProperties: comparisonData.length,
          averageScore: comparisonData.reduce((acc, data) => acc + data.metrics.overallScore, 0) / comparisonData.length,
          bestProperty: comparisonData.reduce((best, data) =>
            data.metrics.overallScore > best.metrics.overallScore ? data : best
          ).propertyId,
        },
        createdAt: new Date().toISOString(),
      };

      await createPropertyComparison({
        userId,
        propertyIds: selectedProperties,
        comparisonResult,
      });

      toast({
        title: 'Thành công',
        description: 'Đã lưu kết quả so sánh',
      });

      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu so sánh',
        variant: 'destructive',
      });
    }
  };

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Không có bất động sản nào để so sánh</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compare className="w-5 h-5" />
            So sánh Bất động sản
            {selectedProperties.length > 0 && (
              <Badge variant="secondary">{selectedProperties.length} đã chọn</Badge>
            )}
          </div>
          <Button
            onClick={handleCompare}
            disabled={selectedProperties.length < 2}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            So sánh ({selectedProperties.length}/4)
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {properties.map((property) => (
              <div
                key={property.id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  selectedProperties.includes(property.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    checked={selectedProperties.includes(property.id)}
                    onCheckedChange={() => handlePropertyToggle(property.id)}
                    disabled={!selectedProperties.includes(property.id) && selectedProperties.length >= 4}
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold">{property.propertyType || 'Chưa phân loại'}</h4>
                    <p className="text-sm text-muted-foreground">
                      {property.area.toFixed(0)} m² • Hướng {property.orientation}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`text-sm font-medium ${getScoreColor(property.aiAnalysis?.scores?.overall || 0)}`}>
                        Điểm: {property.aiAnalysis?.scores?.overall || 0}/100
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {property.marketData?.avgPricePerSqm
                          ? formatCurrency(property.marketData.avgPricePerSqm) + '/m²'
                          : 'Chưa có giá'
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePropertyToggle(property.id)}
                  disabled={!selectedProperties.includes(property.id) && selectedProperties.length >= 4}
                >
                  {selectedProperties.includes(property.id) ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Compare className="w-5 h-5" />
                So sánh Chi tiết Bất động sản
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="h-[calc(80vh-120px)]">
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {comparisonData.map((data, index) => (
                    <Card key={data.propertyId} className="text-center">
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-2">
                          {data.property.propertyType || 'BĐS #' + (index + 1)}
                        </h4>
                        <div className={`text-2xl font-bold ${getScoreColor(data.metrics.overallScore)}`}>
                          {data.metrics.overallScore}/100
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Điểm tổng quan
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Comparison Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Tiêu chí</TableHead>
                      {comparisonData.map((data, index) => (
                        <TableHead key={data.propertyId} className="text-center">
                          {data.property.propertyType || 'BĐS #' + (index + 1)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Diện tích (m²)</TableCell>
                      {comparisonData.map((data) => {
                        const avgArea = comparisonData.reduce((acc, d) => acc + d.metrics.area, 0) / comparisonData.length;
                        return (
                          <TableCell key={data.propertyId} className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {data.metrics.area.toFixed(0)}
                              {getComparisonIcon(data.metrics.area, avgArea)}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-medium">Giá/m²</TableCell>
                      {comparisonData.map((data) => {
                        const avgPrice = comparisonData.reduce((acc, d) => acc + d.metrics.pricePerSqm, 0) / comparisonData.length;
                        return (
                          <TableCell key={data.propertyId} className="text-center">
                            {data.metrics.pricePerSqm > 0 ? (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-sm">
                                  {(data.metrics.pricePerSqm / 1000000).toFixed(0)}M
                                </span>
                                {getComparisonIcon(data.metrics.pricePerSqm, avgPrice)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-medium">Điểm AI Tổng quan</TableCell>
                      {comparisonData.map((data) => {
                        const avgScore = comparisonData.reduce((acc, d) => acc + d.metrics.overallScore, 0) / comparisonData.length;
                        return (
                          <TableCell key={data.propertyId} className="text-center">
                            <div className="space-y-1">
                              <div className="flex items-center justify-center gap-2">
                                <span className={`font-semibold ${getScoreColor(data.metrics.overallScore)}`}>
                                  {data.metrics.overallScore}
                                </span>
                                {getComparisonIcon(data.metrics.overallScore, avgScore)}
                              </div>
                              <Progress value={data.metrics.overallScore} className="w-full" />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-medium">Điểm Tiện ích</TableCell>
                      {comparisonData.map((data) => (
                        <TableCell key={data.propertyId} className="text-center">
                          <div className="space-y-1">
                            <span className={`font-semibold ${getScoreColor(data.metrics.amenityScore)}`}>
                              {data.metrics.amenityScore}
                            </span>
                            <Progress value={data.metrics.amenityScore} className="w-full" />
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-medium">Số mặt tiền</TableCell>
                      {comparisonData.map((data) => (
                        <TableCell key={data.propertyId} className="text-center">
                          <Badge variant={data.metrics.frontageCount > 1 ? 'default' : 'secondary'}>
                            {data.metrics.frontageCount}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-medium">Mức độ rủi ro</TableCell>
                      {comparisonData.map((data) => (
                        <TableCell key={data.propertyId} className="text-center">
                          <Badge
                            variant={
                              data.metrics.riskLevel === 'low' ? 'default' :
                              data.metrics.riskLevel === 'medium' ? 'secondary' : 'destructive'
                            }
                            className={getRiskLevelColor(data.metrics.riskLevel)}
                          >
                            {data.metrics.riskLevel === 'low' ? 'Thấp' :
                             data.metrics.riskLevel === 'medium' ? 'Trung bình' : 'Cao'}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>

                    <TableRow>
                      <TableCell className="font-medium">Hướng</TableCell>
                      {comparisonData.map((data) => (
                        <TableCell key={data.propertyId} className="text-center">
                          {data.property.orientation}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Recommendations */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Đề xuất
                  </h4>
                  <div className="grid gap-2 text-sm">
                    {(() => {
                      const bestProperty = comparisonData.reduce((best, data) =>
                        data.metrics.overallScore > best.metrics.overallScore ? data : best
                      );

                      const cheapestProperty = comparisonData
                        .filter(d => d.metrics.pricePerSqm > 0)
                        .reduce((cheapest, data) =>
                          data.metrics.pricePerSqm < cheapest.metrics.pricePerSqm ? data : cheapest
                        );

                      const largestProperty = comparisonData.reduce((largest, data) =>
                        data.metrics.area > largest.metrics.area ? data : largest
                      );

                      return (
                        <>
                          <p>
                            <strong>Tốt nhất tổng quan:</strong> {bestProperty.property.propertyType}
                            ({bestProperty.metrics.overallScore}/100 điểm)
                          </p>
                          {cheapestProperty && cheapestProperty.propertyId !== bestProperty.propertyId && (
                            <p>
                              <strong>Giá tốt nhất:</strong> {cheapestProperty.property.propertyType}
                              ({formatCurrency(cheapestProperty.metrics.pricePerSqm)}/m²)
                            </p>
                          )}
                          {largestProperty.propertyId !== bestProperty.propertyId && (
                            <p>
                              <strong>Lớn nhất:</strong> {largestProperty.property.propertyType}
                              ({largestProperty.metrics.area.toFixed(0)} m²)
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Đóng
              </Button>
              <Button onClick={handleSaveComparison}>
                Lưu kết quả so sánh
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}