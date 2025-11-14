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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play, FolderOpen } from 'lucide-react';
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
  const [selectedCategories, setSelectedCategories] = useState(['education', 'healthcare']);
  const [selectedLayers, setSelectedLayers] = useState(['roads', 'metro']);
  const [includeSmallShops, setIncludeSmallShops] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  // Performance optimization: Debouncing and cancellation
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const analysisRequestRef = useRef<AbortController>();
  const [pendingAnalysis, setPendingAnalysis] = useState(false);

  // Debounced filter change handlers
  const debouncedAnalyze = useCallback(
    (analysisRadius: number, analysisCategories: string[], analysisLayers: string[], analysisIncludeSmallShops: boolean = false) => {
      // Clear any existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Cancel any ongoing request
      if (analysisRequestRef.current) {
        analysisRequestRef.current.abort();
      }

      // Set pending state for UI feedback
      setPendingAnalysis(true);

      // Set new timer for debounced analysis
      debounceTimerRef.current = setTimeout(async () => {
        await handleAnalyze(analysisRadius, analysisCategories, analysisLayers, analysisIncludeSmallShops);
        setPendingAnalysis(false);
      }, 1200); // Increased debounce time for better performance

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    },
    []
  );

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (propertyData.area > 0 && propertyData.coordinates.length > 0) {
      debouncedAnalyze(newRadius, selectedCategories, selectedLayers, includeSmallShops);
    }
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
    if (propertyData.area > 0 && propertyData.coordinates.length > 0) {
      debouncedAnalyze(radius, categories, selectedLayers, includeSmallShops);
    }
  };

  const handleLayerChange = (layers: string[]) => {
    setSelectedLayers(layers);
    if (propertyData.area > 0 && propertyData.coordinates.length > 0) {
      debouncedAnalyze(radius, selectedCategories, layers, includeSmallShops);
    }
  };

  const handleIncludeSmallShopsChange = (includeSmall: boolean) => {
    setIncludeSmallShops(includeSmall);
    if (propertyData.area > 0 && propertyData.coordinates.length > 0) {
      debouncedAnalyze(radius, selectedCategories, selectedLayers, includeSmall);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
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
      mapRef.current.flyTo({
        center: [amenity.lon, amenity.lat],
        zoom: 17,
        duration: 1000
      });
    }
  };

  const handleAnalyze = async (forceRadius?: number, forceCategories?: string[], forceLayers?: string[], forceIncludeSmallShops?: boolean) => {
    if (!propertyData.coordinates || propertyData.coordinates.length === 0 || propertyData.area <= 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng vẽ khu đất trên bản đồ trước',
        variant: 'destructive'
      });
      return;
    }

    const analysisRadius = forceRadius ?? radius;
    const analysisCategories = forceCategories ?? selectedCategories;
    const analysisLayers = forceLayers ?? selectedLayers;
    const analysisIncludeSmallShops = forceIncludeSmallShops ?? includeSmallShops;

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
        radius: analysisRadius,
        categories: analysisCategories,
        layers: analysisLayers,
        includeSmallShops: analysisIncludeSmallShops,
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
        setPendingAnalysis(false);
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

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-background p-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phân Tích Bất Động Sản</h1>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            data-testid="button-management"
          >
            <Link href="/management">
              <FolderOpen className="w-4 h-4 mr-1" />
              Quản Lý
            </Link>
          </Button>
          <Button
            onClick={handleExportPDF}
            disabled={!analysisResults}
            variant="secondary"
            size="sm"
            data-testid="button-export-pdf"
          >
            Xuất PDF
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden lg:block w-80 xl:w-96 border-r bg-background">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
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

              {propertyData.area > 0 && (
                <Button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className={`w-full ${pendingAnalysis && !isAnalyzing ? 'animate-pulse' : ''}`}
                  size="lg"
                  data-testid="button-analyze"
                >
                  {isAnalyzing ? (
                    <>Đang phân tích...</>
                  ) : pendingAnalysis ? (
                    <>
                      <Play className="w-4 h-4 mr-2 opacity-50" />
                      Đang chờ phân tích...
                    </>
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
              amenities={analysisResults?.amenities || []}
              radius={radius}
              selectedCategories={selectedCategories}
              selectedLayers={selectedLayers}
              infrastructure={analysisResults?.infrastructure}
              mapRef={mapRef}
            />
          </div>

          {analysisResults && (
            <div className="lg:hidden">
              <Tabs defaultValue="analysis" className="w-full">
                <TabsList className="w-full rounded-none">
                  <TabsTrigger value="analysis" className="flex-1">Phân tích</TabsTrigger>
                  <TabsTrigger value="amenities" className="flex-1">Tiện ích</TabsTrigger>
                  <TabsTrigger value="risk" className="flex-1">Rủi ro</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[300px]">
                  <TabsContent value="analysis" className="p-4 space-y-4">
                    <AIAnalysisCard
                      scores={analysisResults.aiAnalysis.scores}
                      scoreExplanations={analysisResults.aiAnalysis.scoreExplanations}
                      recommendation={analysisResults.aiAnalysis.recommendation}
                      estimatedPrice={analysisResults.aiAnalysis.estimatedPrice}
                      summary={analysisResults.aiAnalysis.summary}
                    />
                    <MarketPriceCard data={analysisResults.marketData} />
                  </TabsContent>
                  <TabsContent value="amenities" className="p-4 space-y-4">
                    <AmenityStatistics
                      amenities={analysisResults.amenities}
                      onAmenityClick={handleAmenityClick}
                    />
                    <AmenityList amenities={analysisResults.amenities} />
                  </TabsContent>
                  <TabsContent value="risk" className="p-4">
                    <RiskAssessmentCard risks={analysisResults.risks} overallRiskLevel={analysisResults.overallRiskLevel} />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </div>

        {analysisResults && (
          <div className="hidden lg:block w-80 xl:w-96 border-l bg-background">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <AIAnalysisCard
                  scores={analysisResults.aiAnalysis.scores}
                  scoreExplanations={analysisResults.aiAnalysis.scoreExplanations}
                  recommendation={analysisResults.aiAnalysis.recommendation}
                  estimatedPrice={analysisResults.aiAnalysis.estimatedPrice}
                  summary={analysisResults.aiAnalysis.summary}
                />
                <MarketPriceCard data={analysisResults.marketData} />
                <AmenityStatistics
                  amenities={analysisResults.amenities || []}
                  onAmenityClick={handleAmenityClick}
                />
                <AmenityList amenities={analysisResults.amenities} />
                <RiskAssessmentCard risks={analysisResults.risks} overallRiskLevel={analysisResults.overallRiskLevel} />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
