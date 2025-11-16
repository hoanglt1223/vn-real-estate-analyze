import React, { useState, useEffect } from 'react';
import { useProperties } from '../hooks/useProperties';
import { uploadService } from '../services/upload.service';
import { PropertyDetails } from '../services/property.service';
import { MapPin, Upload, X, DollarSign, Square, Home } from 'lucide-react';

interface PropertyFormProps {
  property?: PropertyDetails;
  onSave: (property: PropertyDetails) => void;
  onCancel: () => void;
}

export const PropertyForm: React.FC<PropertyFormProps> = ({
  property,
  onSave,
  onCancel
}) => {
  const { createProperty, updateProperty, isCreating, isUpdating } = useProperties();

  const [formData, setFormData] = useState<Partial<PropertyDetails>>({
    propertyType: property?.propertyType || '',
    transactionType: property?.transactionType || '',
    title: property?.title || '',
    description: property?.description || '',
    area: property?.area || 0,
    price: property?.price || 0,
    address: property?.address || '',
    province: property?.province || '',
    district: property?.district || '',
    ward: property?.ward || '',
    contactName: property?.contactName || '',
    contactPhone: property?.contactPhone || '',
    contactEmail: property?.contactEmail || '',
    status: property?.status || 'draft',
    images: property?.images || []
  });

  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const propertyTypes = [
    { value: 'dat', label: 'Đất' },
    { value: 'can_ho', label: 'Căn hộ' },
    { value: 'nha_rieng', label: 'Nhà riêng' },
    { value: 'biet_thu', label: 'Biệt thự' },
    { value: 'shophouse', label: 'Shophouse' },
  ];

  const transactionTypes = [
    { value: 'ban', label: 'Bán' },
    { value: 'cho_thue', label: 'Cho thuê' },
  ];

  const statusOptions = [
    { value: 'draft', label: 'Bản nháp' },
    { value: 'active', label: 'Đang hiển thị' },
    { value: 'expired', label: 'Hết hạn' },
    { value: 'sold', label: 'Đã bán' },
    { value: 'rented', label: 'Đã cho thuê' },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // Validate files
    for (const file of files) {
      const validation = uploadService.validateFile(file, 'image');
      if (!validation.isValid) {
        setError(validation.error!);
        return;
      }
    }

    setIsUploading(true);
    setError('');

    try {
      const newUploadedImages = [...uploadedImages, ...files];
      const newPreviewImages = [
        ...previewImages,
        ...await Promise.all(files.map(uploadService.getFilePreviewUrl))
      ];

      setUploadedImages(newUploadedImages);
      setPreviewImages(newPreviewImages);
    } catch (err) {
      setError('Failed to preview images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const newUploadedImages = uploadedImages.filter((_, i) => i !== index);
    const newPreviewImages = previewImages.filter((_, i) => i !== index);
    setUploadedImages(newUploadedImages);
    setPreviewImages(newPreviewImages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.propertyType || !formData.transactionType || !formData.title ||
        !formData.description || !formData.area || !formData.price ||
        !formData.address || !formData.province || !formData.district ||
        !formData.contactName || !formData.contactPhone) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.area <= 0 || formData.price <= 0) {
      setError('Area and price must be greater than 0');
      return;
    }

    try {
      // Create property data
      const propertyData = {
        ...formData,
        area: Number(formData.area),
        price: Number(formData.price),
        images: formData.images || []
      } as PropertyDetails;

      let savedProperty: PropertyDetails;

      if (property?.id) {
        // Update existing property
        savedProperty = await updateProperty({ id: property.id, updates: propertyData });
      } else {
        // Create new property
        savedProperty = await createProperty(propertyData);
      }

      // Upload images if any
      if (uploadedImages.length > 0 && savedProperty.id) {
        const uploadPromises = uploadedImages.map(file =>
          uploadService.uploadFile(file, savedProperty.id, 'image')
        );

        const uploadedResults = await Promise.all(uploadPromises);

        // Update property with image URLs
        const imageData = uploadedResults.map((result, index) => ({
          url: result.data.url,
          filename: result.data.filename,
          size: result.data.size,
          isPrimary: index === 0,
          caption: `Image ${index + 1}`
        }));

        const updatedProperty = await updateProperty({
          id: savedProperty.id,
          updates: { images: imageData }
        });

        onSave(updatedProperty);
      } else {
        onSave(savedProperty);
      }
    } catch (err: any) {
      setError(err.error || 'Failed to save property');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">
        {property ? 'Edit Property' : 'Create New Property'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loại Bất động sản
            </label>
            <select
              name="propertyType"
              value={formData.propertyType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Type</option>
              {propertyTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loại giao dịch
            </label>
            <select
              name="transactionType"
              value={formData.transactionType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Type</option>
              {transactionTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiêu đề
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập tiêu đề tin đăng"
              required
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mô tả chi tiết
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mô tả chi tiết về bất động sản"
              required
            />
          </div>

          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diện tích (m²)
            </label>
            <div className="relative">
              <Square className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="number"
                name="area"
                value={formData.area}
                onChange={handleInputChange}
                min="0"
                step="0.1"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Giá (VNĐ)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                min="0"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Địa chỉ
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Số nhà, tên đường"
                required
              />
            </div>
          </div>

          {/* Province */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tỉnh/Thành phố
            </label>
            <input
              type="text"
              name="province"
              value={formData.province}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Hà Nội"
              required
            />
          </div>

          {/* District */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quận/Huyện
            </label>
            <input
              type="text"
              name="district"
              value={formData.district}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Hoàn Kiếm"
              required
            />
          </div>

          {/* Ward */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phường/Xã (Optional)
            </label>
            <input
              type="text"
              name="ward"
              value={formData.ward}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Phương Đồng"
            />
          </div>

          {/* Contact Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên liên hệ
            </label>
            <input
              type="text"
              name="contactName"
              value={formData.contactName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nguyễn Văn A"
              required
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Số điện thoại
            </label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="09xxxxxxxx"
              required
            />
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email (Optional)
            </label>
            <input
              type="email"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="email@example.com"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trạng thái
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Image Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hình ảnh
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {isUploading ? 'Đang tải lên...' : 'Click để chọn hình ảnh'}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  JPG, PNG, WebP up to 10MB each
                </span>
              </label>
            </div>

            {/* Preview Images */}
            {previewImages.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {previewImages.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isCreating || isUpdating || isUploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating || isUpdating ? 'Đang lưu...' : property ? 'Cập nhật' : 'Tạo mới'}
          </button>
        </div>
      </form>
    </div>
  );
};