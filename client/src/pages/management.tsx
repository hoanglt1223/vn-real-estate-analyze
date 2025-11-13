import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, MapPin, Calendar, DollarSign, ArrowLeft, Search, FileDown, Plus } from 'lucide-react';
import type { PropertyAnalysis } from '@shared/schema';

export default function ManagementPage() {
  const { toast } = useToast();
  const [editingProperty, setEditingProperty] = useState<PropertyAnalysis | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');

  const { data: properties, isLoading } = useQuery<PropertyAnalysis[]>({
    queryKey: ['/api/properties']
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PropertyAnalysis> }) => {
      const res = await apiRequest('PUT', `/api/properties/${data.id}`, data.updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin bất động sản'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/properties/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: 'Thành công',
        description: 'Đã xóa bất động sản'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa',
        variant: 'destructive'
      });
    }
  });

  const handleEdit = (property: PropertyAnalysis) => {
    setEditingProperty({
      ...property,
      propertyType: property.propertyType || '',
      valuation: property.valuation || null,
      askingPrice: property.askingPrice || null,
      notes: property.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingProperty) return;

    updateMutation.mutate({
      id: editingProperty.id,
      updates: {
        propertyType: editingProperty.propertyType || null,
        valuation: editingProperty.valuation,
        askingPrice: editingProperty.askingPrice,
        notes: editingProperty.notes || null
      }
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bất động sản này?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = () => {
    if (!properties || properties.length === 0) {
      toast({
        title: 'Không có dữ liệu',
        description: 'Không có bất động sản nào để xuất',
        variant: 'destructive'
      });
      return;
    }
    
    // Sanitize and validate data before export
    const exportData = properties.map(p => ({
      id: p.id,
      coordinates: p.coordinates,
      area: p.area,
      orientation: p.orientation || 'N/A',
      frontageCount: p.frontageCount,
      center: p.center,
      propertyType: p.propertyType || null,
      valuation: p.valuation || null,
      askingPrice: p.askingPrice || null,
      notes: p.notes || null,
      aiAnalysis: p.aiAnalysis ? {
        scores: p.aiAnalysis.scores,
        recommendation: p.aiAnalysis.recommendation,
        summary: p.aiAnalysis.summary
      } : null,
      marketData: p.marketData ? {
        avgPrice: p.marketData.avgPrice,
        avgPricePerSqm: p.marketData.avgPricePerSqm,
        minPrice: p.marketData.minPrice,
        maxPrice: p.marketData.maxPrice
      } : null,
      createdAt: p.createdAt
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `properties-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Đã xuất',
      description: `Đã xuất ${exportData.length} bất động sản`,
    });
  };

  const filteredProperties = properties
    ?.filter(p => {
      // Search filter - handle undefined/null values
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNotes = p.notes?.toLowerCase().includes(query) || false;
        const matchesType = p.propertyType?.toLowerCase().includes(query) || false;
        const matchesOrientation = p.orientation?.toLowerCase().includes(query) || false;
        if (!matchesNotes && !matchesType && !matchesOrientation) return false;
      }

      // Score filter - only filter if property has aiAnalysis
      if (scoreFilter !== 'all') {
        const score = p.aiAnalysis?.scores?.overall || 0;
        if (scoreFilter === 'high' && score < 70) return false;
        if (scoreFilter === 'medium' && (score < 40 || score >= 70)) return false;
        if (scoreFilter === 'low' && score >= 40) return false;
      }

      // Price filter - only filter if property has price data
      if (priceFilter !== 'all') {
        const pricePerSqm = p.marketData?.avgPricePerSqm;
        if (!pricePerSqm) return false; // Skip properties without price data when filtering by price
        if (priceFilter === 'high' && pricePerSqm < 100000000) return false;
        if (priceFilter === 'medium' && (pricePerSqm < 50000000 || pricePerSqm >= 100000000)) return false;
        if (priceFilter === 'low' && pricePerSqm >= 50000000) return false;
      }

      return true;
    })
    ?.sort((a, b) => {
      switch (sortBy) {
        case 'date': {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }
        case 'score': {
          const scoreA = a.aiAnalysis?.scores?.overall || 0;
          const scoreB = b.aiAnalysis?.scores?.overall || 0;
          return scoreB - scoreA;
        }
        case 'price': {
          const priceA = a.marketData?.avgPricePerSqm || 0;
          const priceB = b.marketData?.avgPricePerSqm || 0;
          return priceB - priceA;
        }
        case 'area': {
          const areaA = a.area || 0;
          const areaB = b.area || 0;
          return areaB - areaA;
        }
        default:
          return 0;
      }
    });

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'Chưa cập nhật';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRiskBadgeVariant = (riskLevel: string | undefined) => {
    switch (riskLevel?.toLowerCase()) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="border-b bg-background p-4">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              data-testid="button-back"
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Quay lại
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Quản Lý Bất Động Sản</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              data-testid="button-back"
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Quay lại
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Quản Lý Bất Động Sản</h1>
              <p className="text-muted-foreground text-sm">
                Hiển thị {filteredProperties?.length || 0} / {properties?.length || 0} bất động sản
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" data-testid="button-export">
              <FileDown className="w-4 h-4 mr-2" />
              Xuất
            </Button>
            <Link href="/">
              <Button data-testid="button-new-analysis">
                <Plus className="w-4 h-4 mr-2" />
                Tạo mới
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto p-6 h-full">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Bộ lọc & Tìm kiếm</CardTitle>
              <CardDescription>Lọc và sắp xếp danh sách bất động sản</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-properties"
                  />
                </div>
                
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger data-testid="select-score-filter">
                    <SelectValue placeholder="Lọc theo điểm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả điểm</SelectItem>
                    <SelectItem value="high">Cao (≥70)</SelectItem>
                    <SelectItem value="medium">Trung bình (40-69)</SelectItem>
                    <SelectItem value="low">Thấp (&lt;40)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger data-testid="select-price-filter">
                    <SelectValue placeholder="Lọc theo giá" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả mức giá</SelectItem>
                    <SelectItem value="high">Cao (≥100 triệu/m²)</SelectItem>
                    <SelectItem value="medium">Trung bình (50-100 triệu/m²)</SelectItem>
                    <SelectItem value="low">Thấp (&lt;50 triệu/m²)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger data-testid="select-sort-by">
                    <SelectValue placeholder="Sắp xếp theo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Mới nhất</SelectItem>
                    <SelectItem value="score">Điểm cao nhất</SelectItem>
                    <SelectItem value="price">Giá cao nhất</SelectItem>
                    <SelectItem value="area">Diện tích lớn nhất</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProperties?.map((property) => (
                <Card key={property.id} className="hover-elevate" data-testid={`card-property-${property.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {property.propertyType || 'Chưa phân loại'}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatDate(property.createdAt)}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(property)}
                          data-testid={`button-edit-${property.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(property.id)}
                          data-testid={`button-delete-${property.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Diện tích</p>
                        <p className="font-semibold">{property.area.toFixed(0)} m²</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hướng</p>
                        <p className="font-semibold">{property.orientation}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Mặt tiền</p>
                        <p className="font-semibold">{property.frontageCount} mặt</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tiện ích</p>
                        <p className="font-semibold">{property.amenities?.length || 0}</p>
                      </div>
                    </div>

                    {(property.valuation || property.askingPrice) && (
                      <div className="space-y-2 pt-4 border-t">
                        {property.valuation && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Định giá:</span>
                            <span className="font-semibold">{formatCurrency(property.valuation)}</span>
                          </div>
                        )}
                        {property.askingPrice && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Giá chào:</span>
                            <span className="font-semibold">{formatCurrency(property.askingPrice)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {property.notes && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground line-clamp-2">{property.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {filteredProperties?.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">
                    {searchQuery || scoreFilter !== 'all' || priceFilter !== 'all'
                      ? 'Không tìm thấy bất động sản phù hợp với bộ lọc'
                      : 'Chưa có bất động sản nào được phân tích'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh Sửa Thông Tin Bất Động Sản</DialogTitle>
          </DialogHeader>
          
          {editingProperty && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="propertyType">Loại bất động sản</Label>
                <Select
                  value={editingProperty.propertyType || ''}
                  onValueChange={(value) => setEditingProperty({ ...editingProperty, propertyType: value })}
                >
                  <SelectTrigger id="propertyType" data-testid="select-property-type">
                    <SelectValue placeholder="Chọn loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Đất nền">Đất nền</SelectItem>
                    <SelectItem value="Nhà phố">Nhà phố</SelectItem>
                    <SelectItem value="Biệt thự">Biệt thự</SelectItem>
                    <SelectItem value="Chung cư">Chung cư</SelectItem>
                    <SelectItem value="Đất thương mại">Đất thương mại</SelectItem>
                    <SelectItem value="Đất công nghiệp">Đất công nghiệp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valuation">Định giá (VNĐ)</Label>
                  <Input
                    id="valuation"
                    type="number"
                    placeholder="0"
                    value={editingProperty.valuation || ''}
                    onChange={(e) => setEditingProperty({ 
                      ...editingProperty, 
                      valuation: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    data-testid="input-valuation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="askingPrice">Giá chào (VNĐ)</Label>
                  <Input
                    id="askingPrice"
                    type="number"
                    placeholder="0"
                    value={editingProperty.askingPrice || ''}
                    onChange={(e) => setEditingProperty({ 
                      ...editingProperty, 
                      askingPrice: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    data-testid="input-asking-price"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  placeholder="Nhập ghi chú về bất động sản..."
                  value={editingProperty.notes || ''}
                  onChange={(e) => setEditingProperty({ ...editingProperty, notes: e.target.value })}
                  rows={4}
                  data-testid="textarea-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
