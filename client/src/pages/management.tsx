import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, MapPin, Calendar, DollarSign } from 'lucide-react';
import type { PropertyAnalysis } from '@shared/schema';

export default function ManagementPage() {
  const { toast } = useToast();
  const [editingProperty, setEditingProperty] = useState<PropertyAnalysis | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: properties, isLoading } = useQuery<PropertyAnalysis[]>({
    queryKey: ['/api/properties']
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PropertyAnalysis> }) => {
      return apiRequest(`/api/properties/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data.updates)
      });
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
      return apiRequest(`/api/properties/${id}`, {
        method: 'DELETE'
      });
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
          <h1 className="text-2xl font-bold">Quản Lý Bất Động Sản</h1>
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
        <h1 className="text-2xl font-bold">Quản Lý Bất Động Sản</h1>
        <p className="text-muted-foreground mt-1">
          Danh sách các khu đất đã phân tích ({properties?.length || 0})
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto p-6 h-full">
          <ScrollArea className="h-[calc(100vh-160px)]">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {properties?.map((property) => (
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

              {properties?.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">
                    Chưa có bất động sản nào được phân tích
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
