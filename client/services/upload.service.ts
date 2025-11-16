import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Types
export interface UploadResponse {
  message: string;
  data: {
    url: string;
    filename: string;
    size: number;
    type: string;
    propertyId: string;
    uploadedBy: string;
  };
}

export interface UploadError {
  error: string;
  details?: string;
}

// Upload service methods
export const uploadService = {
  // Upload file (image or video)
  async uploadFile(
    file: File,
    propertyId: string,
    type: 'image' | 'video' = 'image'
  ): Promise<UploadResponse> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('propertyId', propertyId);
      formData.append('type', type);

      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as UploadError;
      }
      throw { error: 'Upload failed' } as UploadError;
    }
  },

  // Delete file
  async deleteFile(url: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      await axios.delete(`${API_BASE_URL}/upload`, {
        data: { url },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as UploadError;
      }
      throw { error: 'File deletion failed' } as UploadError;
    }
  },

  // Validate file type and size
  validateFile(file: File, type: 'image' | 'video' = 'image'): { isValid: boolean; error?: string } {
    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/webp'],
      video: ['video/mp4']
    };

    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes[type].includes(file.type)) {
      return {
        isValid: false,
        error: `Only ${allowedTypes[type].join(', ')} files are allowed`
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size must be less than 10MB'
      };
    }

    return { isValid: true };
  }
};

// Helper function to get file preview URL
export const getFilePreviewUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};