import React, { useState } from 'react';
import { useProperties } from '../hooks/useProperties';
import { PropertyDetails, PropertyFilters } from '../services/property.service';
import { formatPrice } from '../utils/format';
import { MapPin, Home, Building, Land, Eye, Phone, MessageSquare } from 'lucide-react';

interface PropertyListProps {
  filters?: PropertyFilters;
  onPropertySelect?: (property: PropertyDetails) => void;
}

const propertyTypeIcons = {
  dat: Land,
  can_ho: Building,
  nha_rieng: Home,
  biet_thu: Building,
  shophouse: Building,
};

const propertyTypeLabels = {
  dat: 'Đất',
  can_ho: 'Căn hộ',
  nha_rieng: 'Nhà riêng',
  biet_thu: 'Biệt thự',
  shophouse: 'Shophouse',
};

export const PropertyList: React.FC<PropertyListProps> = ({
  filters = {},
  onPropertySelect
}) => {
  const { properties, isLoading, error } = useProperties(filters);
  const [contactingProperty, setContactingProperty] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load properties</p>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-8">
        <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No properties found</p>
        <p className="text-gray-500 text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  const handleContact = async (propertyId: string) => {
    setContactingProperty(propertyId);
    try {
      // This would open a contact modal or navigate to contact page
      console.log('Contact property:', propertyId);
    } catch (error) {
      console.error('Contact error:', error);
    } finally {
      setContactingProperty(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => {
        const TypeIcon = propertyTypeIcons[property.propertyType as keyof typeof propertyTypeIcons] || Home;

        return (
          <div
            key={property.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onPropertySelect?.(property)}
          >
            {/* Image */}
            <div className="relative h-48 bg-gray-200">
              {property.images && property.images.length > 0 ? (
                <img
                  src={property.images[0].url}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <TypeIcon className="h-16 w-16 text-gray-400" />
                </div>
              )}

              {/* Property Type Badge */}
              <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                {propertyTypeLabels[property.propertyType as keyof typeof propertyTypeLabels]}
              </div>

              {/* Transaction Type Badge */}
              <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                {property.transactionType === 'ban' ? 'Bán' : 'Cho thuê'}
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Title */}
              <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                {property.title}
              </h3>

              {/* Price */}
              <div className="text-xl font-bold text-blue-600 mb-2">
                {formatPrice(property.price)}
              </div>

              {/* Area */}
              <div className="flex items-center text-gray-600 text-sm mb-2">
                <span className="font-medium">{property.area} m²</span>
              </div>

              {/* Location */}
              <div className="flex items-center text-gray-600 text-sm mb-3">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="truncate">
                  {property.address}, {property.district}, {property.province}
                </span>
              </div>

              {/* Description */}
              <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                {property.description}
              </p>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <div className="flex items-center">
                  <Eye className="h-3 w-3 mr-1" />
                  <span>{property.views || 0}</span>
                </div>
                <div className="flex items-center">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  <span>{property.contactClicks || 0}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContact(property.id!);
                  }}
                  disabled={contactingProperty === property.id}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Phone className="h-4 w-4 mr-1" />
                  {contactingProperty === property.id ? 'Đang gửi...' : 'Liên hệ'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPropertySelect?.(property);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                >
                  Chi tiết
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};