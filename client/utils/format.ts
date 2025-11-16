// Format price in VND
export const formatPrice = (price: number): string => {
  if (price >= 1000000000) {
    // For billions
    return `${(price / 1000000000).toFixed(2)} tỷ VNĐ`;
  } else if (price >= 1000000) {
    // For millions
    return `${(price / 1000000).toFixed(0)} triệu VNĐ`;
  } else {
    // For smaller amounts
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }
};

// Format area with units
export const formatArea = (area: number): string => {
  return `${area.toLocaleString('vi-VN')} m²`;
};

// Format date in Vietnamese format
export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
};

// Format relative time
export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const target = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Vừa xong';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} phút trước`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} giờ trước`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ngày trước`;
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} tháng trước`;
  } else {
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} năm trước`;
  }
};

// Format phone number
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format for Vietnamese phone numbers
  if (cleaned.startsWith('84')) {
    // International format
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  } else if (cleaned.startsWith('0')) {
    // Domestic format
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  return phone; // Return original if no pattern matches
};

// Format property status
export const formatPropertyStatus = (status: string): { label: string; color: string } => {
  const statusMap = {
    draft: { label: 'Bản nháp', color: 'bg-gray-100 text-gray-800' },
    active: { label: 'Đang hiển thị', color: 'bg-green-100 text-green-800' },
    expired: { label: 'Hết hạn', color: 'bg-red-100 text-red-800' },
    sold: { label: 'Đã bán', color: 'bg-blue-100 text-blue-800' },
    rented: { label: 'Đã cho thuê', color: 'bg-purple-100 text-purple-800' },
  };

  return statusMap[status as keyof typeof statusMap] || { label: status, color: 'bg-gray-100 text-gray-800' };
};

// Format property type
export const formatPropertyType = (type: string): string => {
  const typeMap = {
    dat: 'Đất',
    can_ho: 'Căn hộ',
    nha_rieng: 'Nhà riêng',
    biet_thu: 'Biệt thự',
    shophouse: 'Shophouse',
    van_phong: 'Văn phòng',
    kho_xuong: 'Kho xưởng',
  };

  return typeMap[type as keyof typeof typeMap] || type;
};

// Format transaction type
export const formatTransactionType = (type: string): string => {
  const typeMap = {
    ban: 'Bán',
    cho_thue: 'Cho thuê',
    ban_cho_thue: 'Bán & Cho thuê',
  };

  return typeMap[type as keyof typeof typeMap] || type;
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Generate slug from title
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Keep only letters, numbers, spaces, and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Vietnamese)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(0|\+84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Calculate price per square meter
export const calculatePricePerSqm = (price: number, area: number): number => {
  if (area <= 0) return 0;
  return Math.round(price / area);
};

// Format price per square meter
export const formatPricePerSqm = (price: number, area: number): string => {
  const pricePerSqm = calculatePricePerSqm(price, area);
  return formatPrice(pricePerSqm) + '/m²';
};