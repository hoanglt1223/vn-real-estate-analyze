import Header from '../Header';

export default function HeaderExample() {
  return (
    <div>
      <Header onExportPDF={() => console.log('Export PDF')} />
      <div className="p-6">
        <p className="text-muted-foreground">Content below header...</p>
      </div>
    </div>
  );
}
