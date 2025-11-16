import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchProperties, createSavedSearch } from '@/lib/api';

interface AdvancedSearchPanelProps {
  onSearch: (criteria: any) => void;
  onSavedSearches?: () => void;
}

export default function AdvancedSearchPanel({ onSearch, onSavedSearches }: AdvancedSearchPanelProps) {
  const { toast } = useToast();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<{
    query: string;
    propertyType: string;
    sortBy: string;
    sortOrder: string;
    minScore: number | undefined;
    maxScore: number | undefined;
    minPrice: number | undefined;
    maxPrice: number | undefined;
    minArea: number | undefined;
    maxArea: number | undefined;
  }>({
    query: '',
    propertyType: '',
    sortBy: 'date',
    sortOrder: 'desc',
    minScore: undefined,
    maxScore: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    minArea: undefined,
    maxArea: undefined,
  });

  const handleSearch = () => {
    const criteria = Object.fromEntries(
      Object.entries(searchCriteria).filter(([_, value]) =>
        value !== '' && value !== undefined && value !== null
      )
    );

    onSearch(criteria);
  };

  const handleSaveSearch = async () => {
    const searchName = prompt('Nhập tên cho bộ tìm kiếm đã lưu:');
    if (!searchName) return;

    try {
      const userId = 'demo-user'; // In real app, get from auth
      const criteria = Object.fromEntries(
        Object.entries(searchCriteria).filter(([_, value]) =>
          value !== '' && value !== undefined && value !== null
        )
      );

      await createSavedSearch({
        userId,
        name: searchName,
        searchCriteria: criteria,
      });

      toast({
        title: 'Thành công',
        description: 'Đã lưu bộ tìm kiếm',
      });

      if (onSavedSearches) {
        onSavedSearches();
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu tìm kiếm',
        variant: 'destructive',
      });
    }
  };

  const handleClear = () => {
    setSearchCriteria({
      query: '',
      propertyType: '',
      sortBy: 'date',
      sortOrder: 'desc',
      minScore: undefined,
      maxScore: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minArea: undefined,
      maxArea: undefined,
    });
  };

  const getActiveFiltersCount = () => {
    return Object.entries(searchCriteria).filter(([key, value]) =>
      key !== 'sortBy' && key !== 'sortOrder' &&
      value !== '' && value !== undefined && value !== null
    ).length;
  };

  return (
    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Tìm kiếm Nâng cao
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary">{getActiveFiltersCount()} bộ lọc</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveSearch}>
              <Save className="w-4 h-4 mr-1" />
              Lưu tìm kiếm
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <X className="w-4 h-4 mr-1" />
              Xóa
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label htmlFor="search-query">Tìm kiếm</Label>
            <Input
              id="search-query"
              placeholder="Tìm kiếm theo ghi chú, loại, hướng..."
              value={searchCriteria.query}
              onChange={(e) => setSearchCriteria({ ...searchCriteria, query: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="property-type">Loại Bất Động Sản</Label>
            <Select value={searchCriteria.propertyType} onValueChange={(value) => setSearchCriteria({ ...searchCriteria, propertyType: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Tất cả loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="Đất nền">Đất nền</SelectItem>
                <SelectItem value="Nhà phố">Nhà phố</SelectItem>
                <SelectItem value="Biệt thự">Biệt thự</SelectItem>
                <SelectItem value="Chung cư">Chung cư</SelectItem>
                <SelectItem value="Đất thương mại">Đất thương mại</SelectItem>
                <SelectItem value="Đất công nghiệp">Đất công nghiệp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sort-by">Sắp xếp theo</Label>
            <Select value={searchCriteria.sortBy} onValueChange={(value) => setSearchCriteria({ ...searchCriteria, sortBy: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Ngày tạo</SelectItem>
                <SelectItem value="score">Điểm AI</SelectItem>
                <SelectItem value="price">Giá/m²</SelectItem>
                <SelectItem value="area">Diện tích</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sort-order">Thứ tự</Label>
            <Select value={searchCriteria.sortOrder} onValueChange={(value) => setSearchCriteria({ ...searchCriteria, sortOrder: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Mới nhất/Cao nhất</SelectItem>
                <SelectItem value="asc">Cũ nhất/Thấp nhất</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

          <CollapsibleContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="min-score">Điểm AI tối thiểu</Label>
                <Input
                  id="min-score"
                  type="number"
                  placeholder="0"
                  min="0"
                  max="100"
                  value={searchCriteria.minScore || ''}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, minScore: e.target.value ? parseInt(e.target.value) as number : undefined })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="max-score">Điểm AI tối đa</Label>
                <Input
                  id="max-score"
                  type="number"
                  placeholder="100"
                  min="0"
                  max="100"
                  value={searchCriteria.maxScore || ''}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, maxScore: e.target.value ? parseInt(e.target.value) as number : undefined })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="min-price">Giá/m² tối thiểu (triệu VNĐ)</Label>
                <Input
                  id="min-price"
                  type="number"
                  placeholder="0"
                  value={searchCriteria.minPrice ? searchCriteria.minPrice / 1000000 : ''}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, minPrice: e.target.value ? parseInt(e.target.value) as number * 1000000 : undefined })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="max-price">Giá/m² tối đa (triệu VNĐ)</Label>
                <Input
                  id="max-price"
                  type="number"
                  placeholder="1000"
                  value={searchCriteria.maxPrice ? searchCriteria.maxPrice / 1000000 : ''}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, maxPrice: e.target.value ? parseInt(e.target.value) as number * 1000000 : undefined })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="min-area">Diện tích tối thiểu (m²)</Label>
                <Input
                  id="min-area"
                  type="number"
                  placeholder="0"
                  value={searchCriteria.minArea || ''}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, minArea: e.target.value ? parseInt(e.target.value) as number : undefined })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="max-area">Diện tích tối đa (m²)</Label>
                <Input
                  id="max-area"
                  type="number"
                  placeholder="1000"
                  value={searchCriteria.maxArea || ''}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, maxArea: e.target.value ? parseInt(e.target.value) as number : undefined })}
                  className="mt-1"
                />
              </div>
            </div>
          </CollapsibleContent>

        <div className="mt-4 flex gap-2">
          <Button onClick={handleSearch} className="flex-1">
            <Search className="w-4 h-4 mr-2" />
            Tìm kiếm
          </Button>
          <Button variant="outline" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
            <Filter className="w-4 h-4 mr-2" />
            Bộ lọc nâng cao
          </Button>
        </div>
      </CardContent>
    </Card>
    </Collapsible>
  );
}
