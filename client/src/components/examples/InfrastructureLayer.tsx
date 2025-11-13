import { useState } from 'react';
import InfrastructureLayer from '../InfrastructureLayer';

export default function InfrastructureLayerExample() {
  const [selectedLayers, setSelectedLayers] = useState(['roads', 'metro']);

  return (
    <div className="p-6 max-w-md">
      <InfrastructureLayer
        selectedLayers={selectedLayers}
        onLayerChange={setSelectedLayers}
      />
    </div>
  );
}
