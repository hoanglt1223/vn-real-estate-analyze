import { useState } from 'react';
import AmenitiesFilter from '../AmenitiesFilter';

export default function AmenitiesFilterExample() {
  const [radius, setRadius] = useState(1000);
  const [categories, setCategories] = useState(['education', 'healthcare']);

  return (
    <div className="p-6 max-w-md">
      <AmenitiesFilter
        radius={radius}
        onRadiusChange={setRadius}
        selectedCategories={categories}
        onCategoryChange={setCategories}
      />
    </div>
  );
}
