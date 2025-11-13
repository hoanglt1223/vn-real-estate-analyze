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

//todo: remove mock functionality
const mockAmenities = [
  { id: '1', name: 'Trường Tiểu học Lê Quý Đôn', category: 'education', distance: 350, walkTime: 5 },
  { id: '2', name: 'Trường THCS Trần Đại Nghĩa', category: 'education', distance: 800, walkTime: 10 },
  { id: '3', name: 'Bệnh viện Quận 1', category: 'healthcare', distance: 1200, walkTime: 15 },
  { id: '4', name: 'Nhà thuốc Long Châu', category: 'healthcare', distance: 200, walkTime: 3 },
  { id: '5', name: 'Siêu thị CoopMart', category: 'shopping', distance: 500, walkTime: 7 },
  { id: '6', name: 'Circle K', category: 'shopping', distance: 150, walkTime: 2 },
  { id: '7', name: 'Rạp CGV', category: 'entertainment', distance: 2000, walkTime: 25 },
  { id: '8', name: 'Phòng gym California', category: 'entertainment', distance: 600, walkTime: 8 }
];

const mockPriceData = {
  min: 45000000,
  avg: 85000000,
  max: 150000000,
  median: 80000000,
  listingCount: 47,
  trend: 'up' as const
};

const mockAIScores = {
  overall: 78,
  amenities: 85,
  planning: 72,
  residential: 80,
  investment: 75,
  risk: 25
};

const mockSummary = 'Khu đất nằm ở vị trí tốt với nhiều tiện ích xung quanh. Quy hoạch ổn định, phù hợp cho cả mục đích an cư và đầu tư. Giá hiện tại hợp lý so với thị trường. Rủi ro thấp, không có yếu tố bất lợi lớn. Khu vực có tiềm năng tăng giá trong tương lai do hạ tầng đang phát triển.';

const mockRisks = [
  { id: '1', type: 'medium' as const, title: 'Gần khu công nghiệp', description: 'Khu đất nằm trong bán kính 2km từ khu công nghiệp, có thể ảnh hưởng đến chất lượng không khí và tiếng ồn.', distance: 1800, icon: <></> },
  { id: '2', type: 'low' as const, title: 'Gần trạm điện', description: 'Có trạm điện trong bán kính 500m. Khoảng cách đủ an toàn nhưng cần lưu ý.', distance: 450, icon: <></> }
];

export default function AnalysisPage() {
  const [propertyData, setPropertyData] = useState({
    area: 0,
    orientation: '',
    frontageCount: 0
  });
  const [radius, setRadius] = useState(1000);
  const [selectedCategories, setSelectedCategories] = useState(['education', 'healthcare']);
  const [selectedLayers, setSelectedLayers] = useState(['roads', 'metro']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handlePolygonChange = (data: any) => {
    setPropertyData({
      area: data.area,
      orientation: data.orientation,
      frontageCount: data.frontageCount
    });
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    //todo: remove mock functionality - replace with real API call
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 2000);
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

              {propertyData.area > 0 && !showResults && (
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
                      Phân Tích Ngay
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

          {showResults && (
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
                      scores={mockAIScores}
                      recommendation="buy"
                      estimatedPrice={85000000}
                      summary={mockSummary}
                    />
                    <MarketPriceCard data={mockPriceData} />
                  </TabsContent>
                  <TabsContent value="amenities" className="p-4">
                    <AmenityList amenities={mockAmenities} />
                  </TabsContent>
                  <TabsContent value="risk" className="p-4">
                    <RiskAssessmentCard risks={mockRisks} overallRiskLevel="medium" />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </div>

        {showResults && (
          <div className="hidden lg:block w-80 xl:w-96 border-l bg-background">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <AIAnalysisCard
                  scores={mockAIScores}
                  recommendation="buy"
                  estimatedPrice={85000000}
                  summary={mockSummary}
                />
                <MarketPriceCard data={mockPriceData} />
                <AmenityList amenities={mockAmenities} />
                <RiskAssessmentCard risks={mockRisks} overallRiskLevel="medium" />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
