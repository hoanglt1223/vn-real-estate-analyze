import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import MapView from '@/components/MapView';
import PropertyInputPanel from '@/components/PropertyInputPanel';
import AmenitiesFilter from '@/components/AmenitiesFilter';
import AmenityList from '@/components/AmenityList';
import AmenityStatistics from '@/components/AmenityStatistics';
import MarketPriceCard from '@/components/MarketPriceCard';
import AIAnalysisCard from '@/components/AIAnalysisCard';
import RiskAssessmentCard from '@/components/RiskAssessmentCard';
import InfrastructureLayer from '@/components/InfrastructureLayer';
import AmenityHeatmap from '@/components/AmenityHeatmap';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play, FolderOpen, Settings, X, MapPin } from 'lucide-react';
import { analyzeProperty } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { generatePDF } from '@/lib/pdfExport';

export default function AnalysisPage() {
  const { toast } = useToast();
  const mapRef = useRef<any>(null);
  const [propertyData, setPropertyData] = useState({
    area: 0,
    orientation: '',
    frontageCount: 0,
    coordinates: [] as number[][],
    center: { lat: 0, lng: 0 }
  });
  const [radius, setRadius] = useState(1000);
  // Set all categories and layers by default
  const [selectedCategories, setSelectedCategories] = useState(['education', 'healthcare', 'shopping', 'entertainment', 'transport']);
  const [selectedLayers, setSelectedLayers] = useState(['roads', 'metro', 'metro_lines', 'bus_routes', 'industrial', 'power', 'cemetery', 'water']);
  const [includeSmallShops, setIncludeSmallShops] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Performance optimization: Request cancellation
  const analysisRequestRef = useRef<AbortController>();

  // Simple filter change handlers (no automatic analysis)
  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
  };

  const handleLayerChange = (layers: string[]) => {
    setSelectedLayers(layers);
  };

  const handleIncludeSmallShopsChange = (includeSmall: boolean) => {
    setIncludeSmallShops(includeSmall);
  };

  // Convert infrastructure data to amenities format for statistics
  const convertInfrastructureToAmenities = (infrastructure: any): any[] => {
    if (!infrastructure) return [];

    const infrastructureAmenities: any[] = [];
    const layerNames: Record<string, string> = {
      roads: 'Đường lớn',
      metro: 'Trạm Metro',
      metro_lines: 'Tuyến Metro',
      bus_routes: 'Tuyến xe buýt',
      industrial: 'Khu công nghiệp',
      power: 'Trạm điện',
      cemetery: 'Nghĩa trang',
      water: 'Sông & kênh'
    };

    Object.entries(infrastructure).forEach(([layer, items]: [string, any]) => {
      if (Array.isArray(items) && layerNames[layer]) {
        items.forEach((item: any, index: number) => {
          if (item.lat && item.lon) {
            infrastructureAmenities.push({
              id: `infra-${layer}-${index}`,
              name: item.name || layerNames[layer] || layer,
              category: 'infrastructure',
              lat: item.lat,
              lon: item.lon,
              distance: item.distance
            });
          }
        });
      }
    });

    return infrastructureAmenities;
  };

  // Combine regular amenities with infrastructure data for statistics
  const getAllAmenities = () => {
    const regularAmenities = analysisResults?.amenities || [];
    const infrastructureAmenities = convertInfrastructureToAmenities(analysisResults?.infrastructure);
    return [...regularAmenities, ...infrastructureAmenities];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisRequestRef.current) {
        analysisRequestRef.current.abort();
      }
    };
  }, []);

  const handlePolygonChange = (data: any) => {
    setPropertyData({
      area: data.area,
      orientation: data.orientation,
      frontageCount: data.frontageCount,
      coordinates: data.coordinates,
      center: data.center
    });
  };

  const handleAmenityClick = (amenity: any) => {
    if (mapRef.current && mapRef.current.flyTo) {
      // Validate coordinates before flying to amenity
      if (
        typeof amenity?.lon === 'number' &&
        typeof amenity?.lat === 'number' &&
        !isNaN(amenity.lon) &&
        !isNaN(amenity.lat) &&
        amenity.lon >= -180 &&
        amenity.lon <= 180 &&
        amenity.lat >= -90 &&
        amenity.lat <= 90
      ) {
        mapRef.current.flyTo({
          center: [amenity.lon, amenity.lat],
          zoom: 17,
          duration: 1000
        });
      } else {
        console.error('Invalid amenity coordinates for flyTo:', amenity);
      }
    }
  };

  const handleAnalyze = async () => {
    // Enhanced validation for polygon data
    if (!propertyData.coordinates || propertyData.coordinates.length === 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng vẽ khu đất trên bản đồ trước',
        variant: 'destructive'
      });
      return;
    }

    if (!propertyData.area || propertyData.area <= 0) {
      toast({
        title: 'Lỗi',
        description: 'Khu đất có diện tích không hợp lệ. Vui lòng vẽ lại khu đất.',
        variant: 'destructive'
      });
      return;
    }

    // Additional validation: check if coordinates form a valid polygon
    if (propertyData.coordinates.length < 3) {
      toast({
        title: 'Lỗi',
        description: 'Khu đất không hợp lệ. Cần ít nhất 3 điểm để tạo khu đất. Vui lòng vẽ lại.',
        variant: 'destructive'
      });
      return;
    }

    // Validate coordinate format
    const hasValidCoordinates = propertyData.coordinates.every(coord =>
      Array.isArray(coord) &&
      coord.length >= 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
    );

    if (!hasValidCoordinates) {
      toast({
        title: 'Lỗi',
        description: 'Dữ liệu tọa độ không hợp lệ. Vui lòng vẽ lại khu đất.',
        variant: 'destructive'
      });
      return;
    }

    // Cancel any ongoing request
    if (analysisRequestRef.current) {
      analysisRequestRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    analysisRequestRef.current = abortController;

    setIsAnalyzing(true);

    try {
      const results = await analyzeProperty({
        coordinates: propertyData.coordinates,
        radius: radius,
        categories: selectedCategories,
        layers: selectedLayers,
        includeSmallShops: includeSmallShops,
        signal: abortController.signal
      });

      // Only update results if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setAnalysisResults(results);

        toast({
          title: 'Thành công',
          description: 'Đã phân tích xong khu đất'
        });
      }
    } catch (error: any) {
      // Don't show error toast for aborted requests
      if (!abortController.signal.aborted) {
        toast({
          title: 'Lỗi phân tích',
          description: error.message || 'Không thể phân tích khu đất',
          variant: 'destructive'
        });
      }
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setIsAnalyzing(false);
      }
    }
  };

  const handleExportPDF = async () => {
    if (!analysisResults) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng phân tích khu đất trước khi xuất báo cáo',
        variant: 'destructive'
      });
      return;
    }

    try {
      toast({
        title: 'Đang xuất PDF...',
        description: 'Vui lòng đợi trong giây lát'
      });

      await generatePDF({
        propertyData,
        analysisResults
      });

      toast({
        title: 'Thành công',
        description: 'Đã xuất báo cáo PDF thành công'
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi xuất PDF',
        description: error.message || 'Không thể xuất báo cáo PDF',
        variant: 'destructive'
      });
    }
  };

  // Mobile filters overlay
  const MobileFiltersOverlay = () => (
    <div className={`md:hidden fixed inset-0 z-[200] bg-background ${showMobileFilters ? 'block' : 'hidden'}`}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Bộ lọc</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileFilters(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <PropertyInputPanel
              area={propertyData.area}
              orientation={propertyData.orientation}
              frontageCount={propertyData.frontageCount}
              onCoordinatesSubmit={(lat, lng) => console.log('Coordinates:', lat, lng)}
            />

            <AmenitiesFilter
              radius={radius}
              onRadiusChange={handleRadiusChange}
              selectedCategories={selectedCategories}
              onCategoryChange={handleCategoryChange}
              includeSmallShops={includeSmallShops}
              onIncludeSmallShopsChange={handleIncludeSmallShopsChange}
            />

            <InfrastructureLayer
              selectedLayers={selectedLayers}
              onLayerChange={handleLayerChange}
            />

            {/* Heatmap Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Heatmap mật độ tiện ích
                </label>
                <Button
                  variant={showHeatmap ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className="px-3 py-1"
                >
                  {showHeatmap ? 'Bật' : 'Tắt'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Hiển thị mật độ tiện ích xung quanh khu đất
              </p>
            </div>

            {propertyData.area > 0 && propertyData.coordinates.length > 0 && (
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>Đang phân tích...</>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {analysisResults ? 'Phân Tích Lại' : 'Phân Tích Ngay'}
                  </>
                )}
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  // Mobile floating action button
  const MobileFAB = () => (
    <div className="md:hidden fixed bottom-4 right-4 z-[150]">
      <Button
        onClick={() => setShowMobileFilters(true)}
        size="lg"
        className="rounded-full w-14 h-14 shadow-lg"
      >
        <Settings className="w-6 h-6" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-background p-2 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold truncate">Phân Tích Bất Động Sản</h1>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            data-testid="button-management"
            className="px-2 sm:px-3"
          >
            <Link href="/management">
              <FolderOpen className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Quản Lý</span>
            </Link>
          </Button>
          <Button
            onClick={handleExportPDF}
            disabled={!analysisResults}
            variant="secondary"
            size="sm"
            data-testid="button-export-pdf"
            className="px-2 sm:px-3"
          >
            <span className="hidden sm:inline">Xuất PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block w-72 lg:w-80 xl:w-96 border-r bg-background">
          <ScrollArea className="h-full">
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <PropertyInputPanel
                area={propertyData.area}
                orientation={propertyData.orientation}
                frontageCount={propertyData.frontageCount}
                onCoordinatesSubmit={(lat, lng) => console.log('Coordinates:', lat, lng)}
              />
              
              <AmenitiesFilter
                radius={radius}
                onRadiusChange={handleRadiusChange}
                selectedCategories={selectedCategories}
                onCategoryChange={handleCategoryChange}
                includeSmallShops={includeSmallShops}
                onIncludeSmallShopsChange={handleIncludeSmallShopsChange}
              />

              <InfrastructureLayer
                selectedLayers={selectedLayers}
                onLayerChange={handleLayerChange}
              />

              {/* Heatmap Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Heatmap mật độ tiện ích
                  </label>
                  <Button
                    variant={showHeatmap ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className="px-3 py-1"
                  >
                    {showHeatmap ? 'Bật' : 'Tắt'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Hiển thị mật độ tiện ích xung quanh khu đất
                </p>
              </div>

              {propertyData.area > 0 && propertyData.coordinates.length > 0 && (
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full"
                  size="lg"
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <>Đang phân tích...</>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      {analysisResults ? 'Phân Tích Lại' : 'Phân Tích Ngay'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <MapView
              center={[106.6297, 10.8231]}
              zoom={12}
              onPolygonChange={handlePolygonChange}
              amenities={getAllAmenities()}
              radius={radius}
              selectedCategories={selectedCategories}
              selectedLayers={selectedLayers}
              infrastructure={analysisResults?.infrastructure}
              mapRef={mapRef}
              showHeatmap={showHeatmap}
            />
          </div>

          {analysisResults && (
            <div className="md:hidden">
              <Tabs defaultValue="analysis" className="w-full">
                <TabsList className="w-full rounded-none h-12">
                  <TabsTrigger value="analysis" className="flex-1 text-xs sm:text-sm">Phân tích</TabsTrigger>
                  <TabsTrigger value="amenities" className="flex-1 text-xs sm:text-sm">Tiện ích</TabsTrigger>
                  <TabsTrigger value="risk" className="flex-1 text-xs sm:text-sm">Rủi ro</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[40vh] min-h-[300px] max-h-[60vh]">
                  <TabsContent value="analysis" className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    <AIAnalysisCard
                      scores={analysisResults.aiAnalysis.scores}
                      scoreExplanations={analysisResults.aiAnalysis.scoreExplanations}
                      recommendation={analysisResults.aiAnalysis.recommendation}
                      estimatedPrice={analysisResults.aiAnalysis.estimatedPrice}
                      summary={analysisResults.aiAnalysis.summary}
                    />
                    <MarketPriceCard data={analysisResults.marketData} />
                  </TabsContent>
                  <TabsContent value="amenities" className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    <AmenityStatistics
                      amenities={getAllAmenities()}
                      onAmenityClick={handleAmenityClick}
                    />
                    <AmenityList amenities={getAllAmenities()} />
                  </TabsContent>
                  <TabsContent value="risk" className="p-3 sm:p-4">
                    <RiskAssessmentCard risks={analysisResults.risks} overallRiskLevel={analysisResults.overallRiskLevel} />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </div>

        {analysisResults && (
          <div className="hidden md:block w-72 lg:w-80 xl:w-96 border-l bg-background">
            <ScrollArea className="h-full">
              <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                <AIAnalysisCard
                  scores={analysisResults.aiAnalysis.scores}
                  scoreExplanations={analysisResults.aiAnalysis.scoreExplanations}
                  recommendation={analysisResults.aiAnalysis.recommendation}
                  estimatedPrice={analysisResults.aiAnalysis.estimatedPrice}
                  summary={analysisResults.aiAnalysis.summary}
                />
                <MarketPriceCard data={analysisResults.marketData} />
                <AmenityStatistics
                  amenities={getAllAmenities()}
                  onAmenityClick={handleAmenityClick}
                />
                <AmenityList amenities={getAllAmenities()} />
                <RiskAssessmentCard risks={analysisResults.risks} overallRiskLevel={analysisResults.overallRiskLevel} />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Mobile components */}
      <MobileFiltersOverlay />
      <MobileFAB />
    </div>
  );
}
