import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { API_ENDPOINTS, suggestLocations as apiSuggestLocations, retrieveLocation as apiRetrieveLocation } from '@/lib/api';

interface VNSearchResult {
  name: string;
  fullName: string;
  type: 'province' | 'district' | 'ward' | 'address' | 'place' | 'poi' | 'locality' | 'neighborhood';
  province?: string;
  district?: string;
  code: number;
  geocodeQuery: string;
  mapboxId?: string;
}

interface GeocodedResult {
  id: string;
  place_name: string;
  center: [number, number];
}

interface SearchAutocompleteProps {
  onSelect: (result: GeocodedResult) => void;
}

export default function SearchAutocomplete({ onSelect }: SearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VNSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const [sessionToken] = useState<string>(() => crypto.randomUUID());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const data: VNSearchResult[] = await apiSuggestLocations(query, {
          limit: 10,
          types: 'address,place,poi,locality,neighborhood',
          sessionToken
        });
        
        if (data.length > 0) {
          setResults(data);
          setIsOpen(true);
        } else {
          setResults([]);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Location search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  const handleSelect = async (result: VNSearchResult) => {
    setQuery(result.fullName);
    setIsOpen(false);
    setIsGeocoding(true);

    try {
      const retrieved = result.mapboxId ? await apiRetrieveLocation(result.mapboxId, sessionToken) : await fetch(API_ENDPOINTS.locationsGeocode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: result.geocodeQuery })
      }).then(r => r.json());

      // Transform to expected format for map
      const coords: [number, number] = (retrieved.coordinates as [number, number]) || (retrieved?.coordinates as [number, number]);
      const geocodedResult: GeocodedResult = {
        id: `${result.code}-${result.type}`,
        place_name: result.fullName,
        center: coords
      };

      onSelect(geocodedResult);
    } catch (error) {
      console.error('Geocoding error:', error);
      // Fallback: still try to display the location name even if geocoding fails
      alert('Không thể xác định tọa độ cho địa điểm này. Vui lòng thử lại.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'province':
        return 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/20';
      case 'district':
        return 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-500/20';
      case 'ward':
        return 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 border-gray-500/20';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'province':
        return 'Tỉnh/TP';
      case 'district':
        return 'Quận/Huyện';
      case 'ward':
        return 'Phường/Xã';
      case 'address':
        return 'Địa chỉ';
      case 'place':
        return 'Địa danh';
      case 'poi':
        return 'POI';
      case 'locality':
        return 'Khu vực';
      case 'neighborhood':
        return 'Khu phố';
      default:
        return type;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tìm kiếm tỉnh/thành phố, quận/huyện..."
          className="w-full pl-10 pr-10 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-background"
          data-testid="input-search-address"
          disabled={isGeocoding}
        />
        {(isLoading || isGeocoding) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.code}-${result.type}`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0 ${
                selectedIndex === index ? 'bg-accent' : ''
              }`}
              data-testid={`search-result-${index}`}
            >
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm font-medium truncate">
                      {result.name}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1.5 py-0 ${getTypeBadgeColor(result.type)}`}
                    >
                      {getTypeLabel(result.type)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.fullName}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-4">
          <p className="text-sm text-muted-foreground text-center">
            Không tìm thấy địa điểm nào
          </p>
        </div>
      )}
    </div>
  );
}
