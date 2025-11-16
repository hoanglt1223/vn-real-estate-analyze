import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { API_ENDPOINTS, searchAnalyses, importProperties, getAnalysisList, updateAnalysis, deleteAnalysis, getAnalysisStatistics } from '@/lib/api';
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
import { Edit, Trash2, MapPin, Calendar, DollarSign, ArrowLeft, Search, FileDown, Plus, Upload, FileText, BarChart3, TrendingUp, Layers } from 'lucide-react';
import type { PropertyAnalysis } from '@shared/schema';
import AdvancedSearchPanel from '@/components/AdvancedSearchPanel';
import PropertyComparison from '@/components/PropertyComparison';
import {
  getArray,
  getString,
  getNumber,
  isValidProperty,
  safeMap
} from '@/lib/typeSafety';

// Helper function for property display validation (more lenient than isValidProperty)
const isValidPropertyForDisplay = (property: any): boolean => {
  // Debug logging to see what properties we're getting
  console.log('Checking property:', property);
  const isValid = (
    property &&
    property.id !== undefined &&
    property.id !== null &&
    (typeof property.id === 'string' || typeof property.id === 'number')
  );
  console.log('Is valid:', isValid, 'Property ID:', property?.id, 'Type:', typeof property?.id);
  return isValid;
};

export default function ManagementPage() {
  const { toast } = useToast();
  const [editingProperty, setEditingProperty] = useState<PropertyAnalysis | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'comparison'>('properties');
  const [searchResults, setSearchResults] = useState<{analyses: PropertyAnalysis[]} | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const { data: analyses, isLoading, refetch } = useQuery<PropertyAnalysis[]>({
    queryKey: ['analysis-list'],
    queryFn: async () => {
      const result = await getAnalysisList();
      return result;
    }
  });

  // Get statistics for the dashboard
  const { data: statistics } = useQuery({
    queryKey: ['analysis-statistics'],
    queryFn: getAnalysisStatistics
  });

  // Fix: Handle searchResults correctly - it has a 'analyses' key
const displayProperties = isSearchMode
  ? getArray(searchResults?.analyses)
  : getArray(analyses);

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PropertyAnalysis> }) => {
      return await updateAnalysis(data.id, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-list'] });
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật thông tin phân tích khu đất'
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
      return await deleteAnalysis(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-list'] });
      toast({
        title: 'Thành công',
        description: 'Đã xóa phân tích khu đất'
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

  const handleSearch = async (criteria: any) => {
  try {
    const results = await searchAnalyses(criteria);
    setSearchResults(results);
    setIsSearchMode(true);

    toast({
      title: 'Tìm kiếm hoàn tất',
      description: `Tìm thấy ${getArray(results.analyses).length} phân tích khu đất phù hợp`,
    });
  } catch (error: any) {
    toast({
      title: 'Lỗi',
      description: error.message || 'Không thể tìm kiếm',
      variant: 'destructive',
    });
  }
};

const handleClearSearch = () => {
  setSearchResults(null);
  setIsSearchMode(false);
};

const handleExport = () => {
  const exportData = getArray(isSearchMode ? searchResults?.analyses : analyses);

  if (exportData.length === 0) {
    toast({
      title: 'Không có dữ liệu',
      description: 'Không có bất động sản nào để xuất',
      variant: 'destructive'
    });
    return;
  }

  // Sanitize and validate data before export using helper functions
  const sanitizedData = safeMap(exportData, (p) => {
    if (!isValidProperty(p)) {
      console.warn('Skipping invalid property during export:', p);
      return null;
    }

    return {
      id: getString(p.id),
      coordinates: getArray(p.coordinates),
      area: getNumber(p.area),
      orientation: getString(p.orientation, 'N/A'),
      frontageCount: getNumber((p as any).frontageCount),
      center: (p as any).center || null,
      propertyType: (p as any).propertyType || null,
      valuation: (p as any).valuation || null,
      askingPrice: (p as any).askingPrice || null,
      notes: getString((p as any).notes),
      aiAnalysis: (p as any).aiAnalysis ? {
        scores: (p as any).aiAnalysis.scores || {},
        recommendation: getString((p as any).aiAnalysis.recommendation),
        summary: getString((p as any).aiAnalysis.summary)
      } : null,
      marketData: (p as any).marketData ? {
        avgPrice: (p as any).marketData.avgPrice || null,
        avgPricePerSqm: (p as any).marketData.avgPricePerSqm || null,
        minPrice: (p as any).marketData.minPrice || null,
        maxPrice: (p as any).marketData.maxPrice || null
      } : null,
      createdAt: (p as any).createdAt || null
    };
  }).filter(Boolean); // Remove null entries

  const dataStr = JSON.stringify(sanitizedData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `properties-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  toast({
    title: 'Đã xuất',
    description: `Đã xuất ${getArray(sanitizedData).length} bất động sản`,
  });
};

const handleImport = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedProperties = JSON.parse(text);

      // Safe array validation using helper function
      const safeImportedProperties = getArray(importedProperties);
      if (safeImportedProperties.length === 0 && importedProperties) {
        throw new Error('File không hợp lệ');
      }

      const result = await importProperties(safeImportedProperties);

      toast({
        title: 'Nhập dữ liệu thành công',
        description: `Đã nhập ${result.imported}/${result.total} bất động sản`,
      });

      // Refresh the properties list
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.propertiesList] });
      refetch();

    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể nhập dữ liệu',
        variant: 'destructive',
      });
    }
  };

  input.click();
};

  // Use searchResults if available, otherwise use properties with type safety
const currentProperties = getArray(isSearchMode ? searchResults : analyses);

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'Chưa cập nhật';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Chưa cập nhật';

    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return 'Ngày không hợp lệ';
      }

      return dateObj.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Ngày không hợp lệ';
    }
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
              <h1 className="text-2xl font-bold">Quản Lý Phân Tích Khu Đất</h1>
              <p className="text-muted-foreground text-sm">
                {isSearchMode
                  ? `Tìm thấy ${getArray(displayProperties).length} phân tích khu đất`
                  : `Hiển thị ${getArray(displayProperties).length} / ${getArray(analyses).length} phân tích khu đất`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isSearchMode && (
              <Button onClick={handleClearSearch} variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Xóa tìm kiếm
              </Button>
            )}
            <Button onClick={handleImport} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Nhập
            </Button>
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
          {/* Statistics Dashboard */}
          {statistics && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Thống Kê Phân Tích</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Tổng số phân tích</p>
                        <p className="text-2xl font-bold">{statistics.totalAnalyses}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Vị trí duy nhất</p>
                        <p className="text-2xl font-bold">{statistics.uniqueLocations}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-8 h-8 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Trung bình phân tích/địa điểm</p>
                        <p className="text-2xl font-bold">{statistics.averageAnalysisCount.toFixed(1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-8 h-8 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phân tích gần đây (30 ngày)</p>
                        <p className="text-2xl font-bold">{statistics.recentAnalyses}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('properties')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'properties'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Danh sách Phân Tích
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'comparison'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              So sánh
            </button>
          </div>

          {activeTab === 'properties' && (
            <>
              <AdvancedSearchPanel onSearch={handleSearch} />

              <ScrollArea className="h-[calc(100vh-200px)]">
                {(() => {
                  const validProperties = displayProperties.filter(isValidPropertyForDisplay);

                  if (validProperties.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground">Chưa có phân tích khu đất nào</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                          {isSearchMode ? 'Không tìm thấy phân tích nào phù hợp với tiêu chí tìm kiếm.' : 'Hãy bắt đầu phân tích khu đất đầu tiên của bạn.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {validProperties.map((property) => (
                    <Card key={getString(property.id)} className="hover-elevate" data-testid={`card-property-${getString(property.id)}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              {getString(property.propertyType, 'Chưa phân loại')}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {formatDate(property.createdAt)}
                              {(property as any).analysisCount && (property as any).analysisCount > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  {(property as any).analysisCount} lần phân tích
                                </Badge>
                              )}
                            </div>
                            {(property as any).lastAnalyzedAt && (
                              <div className="text-xs text-muted-foreground">
                                Phân tích gần đây: {formatDate((property as any).lastAnalyzedAt)}
                              </div>
                            )}
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
                            <p className="font-semibold">{getNumber(property.area).toFixed(0)} m²</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Hướng</p>
                            <p className="font-semibold">{getString(property.orientation, 'Chưa xác định')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Mặt tiền</p>
                            <p className="font-semibold">{getNumber(property.frontageCount)} mặt</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tiện ích</p>
                            <p className="font-semibold">{getArray(property.amenities).length}</p>
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

                        {getString(property.notes) && (
                          <div className="pt-4 border-t">
                            <p className="text-sm text-muted-foreground line-clamp-2">{getString(property.notes)}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                      ))}
                    </div>
                  );
                })()}
              </ScrollArea>
            </>
          )}

          {activeTab === 'comparison' && (
            <div className="h-[calc(100vh-200px)]">
              <PropertyComparison properties={getArray(analyses)} />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh Sửa Thông Tin Phân Tích Khu Đất</DialogTitle>
          </DialogHeader>
          
          {editingProperty && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="propertyType">Loại bất động sản</Label>
                <Select
                  value={editingProperty.propertyType || undefined}
                  onValueChange={(value) => setEditingProperty({ ...editingProperty, propertyType: value || null })}
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
