import MapView from '../MapView';

export default function MapViewExample() {
  return (
    <div className="h-screen w-full">
      <MapView
        center={[106.6297, 10.8231]}
        zoom={12}
        onPolygonChange={(data) => console.log('Polygon changed:', data)}
      />
    </div>
  );
}
