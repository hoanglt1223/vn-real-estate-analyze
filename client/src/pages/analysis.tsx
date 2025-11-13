import { useState } from 'react';
import Header from '@/components/Header';
import MapView from '@/components/MapView';
import PropertyInputPanel from '@/components/PropertyInputPanel';
import AmenitiesFilter from '@/components/AmenitiesFilter';
import AmenityList from '@/components/AmenityList';
import MarketPriceCard from '@/components/MarketPriceCard';
import AIAnalysisCard from '@/components/AIAnalysisCard';
import RiskAssessmentCard from '@/components/RiskAssessmentCard';
import InfrastructureLayer from '@/components/InfrastructureLayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { analyzeProperty } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function AnalysisPage() {
  const { toast } = useToast();
  const [propertyData, setPropertyData] = useState({
    area: 0,
    orientation: '',
    frontageCount: 0,
    coordinates: [] as number[][]
  });
  const [radius, setRadius] = useState(1000);
  const [selectedCategories, setSelectedCategories] = useState(['education', 'healthcare']);
  const [selectedLayers, setSelectedLayers] = useState(['roads', 'metro']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  const handlePolygonChange = (data: any) => {
    setPropertyData({
      area: data.area,
      orientation: data.orientation,
      frontageCount: data.frontageCount,
      coordinates: data.coordinates
    });
  };

  const handleAnalyze = async () => {
    if (!propertyData.coordinates || propertyData.coordinates.length === 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng vẽ khu đất trên bản đồ trước',
        variant: 'destructive'
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const results = await analyzeProperty({
        coordinates: propertyData.coordinates,
        radius,
        categories: selectedCategories,
        layers: selectedLayers
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

  const handleExportPDF = () => {
    console.log('Exporting PDF report...');
    //todo: implement PDF export functionality
  };

  return (
    <div className="flex flex-col h-screen">
      <Header onExportPDF={handleExportPDF} />
      
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
                onRadiusChange={setRadius}
                selectedCategories={selectedCategories}
                onCategoryChange={setSelectedCategories}
              />

              <InfrastructureLayer
                selectedLayers={selectedLayers}
                onLayerChange={setSelectedLayers}
              />

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
