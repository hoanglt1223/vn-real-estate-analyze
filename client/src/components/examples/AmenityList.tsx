import AmenityList from '../AmenityList';

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

export default function AmenityListExample() {
  return (
    <div className="p-6 max-w-md">
      <AmenityList
        amenities={mockAmenities}
        onAmenityClick={(amenity) => console.log('Clicked:', amenity)}
      />
    </div>
  );
}
