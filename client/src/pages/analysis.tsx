import { useState, useEffect } from 'react';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    setShouldAutoAnalyze(true);
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
    setShouldAutoAnalyze(true);
  };

  const handleLayerChange = (layers: string[]) => {
    setSelectedLayers(layers);
    setShouldAutoAnalyze(true);
  };

  useEffect(() => {
    if (shouldAutoAnalyze && propertyData.area > 0 && propertyData.coordinates.length > 0) {
      const timer = setTimeout(async () => {
        await handleAnalyze(radius, selectedCategories, selectedLayers);
        setShouldAutoAnalyze(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [radius, selectedCategories, selectedLayers, shouldAutoAnalyze, propertyData]);

  const handlePolygonChange = (data: any) => {
    setPropertyData({
      area: data.area,
      orientation: data.orientation,
      frontageCount: data.frontageCount,
      coordinates: data.coordinates,
      center: data.center
    });
  };

  const handleAnalyze = async (forceRadius?: number, forceCategories?: string[], forceLayers?: string[]) => {
    if (!propertyData.coordinates || propertyData.coordinates.length === 0) {
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

    setIsAnalyzing(true);
    
    try {
      const results = await analyzeProperty({
        coordinates: propertyData.coordinates,
        radius: analysisRadius,
        categories: analysisCategories,
        layers: analysisLayers
      });

      setAnalysisResults(results);
      
      toast({
        title: 'Thành công',
        description: 'Đã phân tích xong khu đất'
      });
    } catch (error: any) {
      toast({
        title: 'Lỗi phân tích',
        description: error.message || 'Không thể phân tích khu đất',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
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
              />

              <InfrastructureLayer
                selectedLayers={selectedLayers}
                onLayerChange={handleLayerChange}
              />

              {analysisResults && (
                <AmenityStatistics amenities={analysisResults.amenities || []} />
              )}

              {propertyData.area > 0 && (
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
              amenities={analysisResults?.amenities || []}
              radius={radius}
              selectedCategories={selectedCategories}
              selectedLayers={selectedLayers}
              infrastructure={analysisResults?.infrastructure}
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
                      recommendation={analysisResults.aiAnalysis.recommendation}
                      estimatedPrice={analysisResults.aiAnalysis.estimatedPrice}
                      summary={analysisResults.aiAnalysis.summary}
                    />
                    <MarketPriceCard data={analysisResults.marketData} />
                  </TabsContent>
                  <TabsContent value="amenities" className="p-4">
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
                  recommendation={analysisResults.aiAnalysis.recommendation}
                  estimatedPrice={analysisResults.aiAnalysis.estimatedPrice}
                  summary={analysisResults.aiAnalysis.summary}
                />
                <MarketPriceCard data={analysisResults.marketData} />
                <AmenityStatistics amenities={analysisResults.amenities || []} />
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
