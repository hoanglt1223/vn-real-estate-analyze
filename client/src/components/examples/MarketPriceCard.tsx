import MarketPriceCard from '../MarketPriceCard';

//todo: remove mock functionality
const mockData = {
  min: 45000000,
  avg: 85000000,
  max: 150000000,
  median: 80000000,
  listingCount: 47,
  trend: 'up' as const
};

export default function MarketPriceCardExample() {
  return (
    <div className="p-6 max-w-md">
      <MarketPriceCard data={mockData} />
    </div>
  );
}
