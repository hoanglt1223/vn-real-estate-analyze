import PropertyInputPanel from '../PropertyInputPanel';

export default function PropertyInputPanelExample() {
  return (
    <div className="p-6 max-w-md">
      <PropertyInputPanel
        area={250}
        orientation="Đông Nam"
        frontageCount={2}
        onCoordinatesSubmit={(lat, lng) => console.log('Coordinates:', lat, lng)}
      />
    </div>
  );
}
