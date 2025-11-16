import crypto from 'crypto';

// Types cho Blob Storage
export interface UploadedFile {
  url: string;
  blobUrl: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  propertyId?: string;
  isPrimary?: boolean;
  caption?: string;
}

export interface UploadResult {
  success: boolean;
  file?: UploadedFile;
  error?: string;
}

/**
 * Blob Storage Service cho Vercel Blob Storage
 * Graceful degradation khi không có BLOB_READ_WRITE_TOKEN
 */
export class BlobStorageService {
  private static instance: BlobStorageService;
  private static isConfigured: boolean = false;

  static getInstance(): BlobStorageService {
    if (!BlobStorageService.instance) {
      BlobStorageService.instance = new BlobStorageService();
      BlobStorageService.isConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
    }
    return BlobStorageService.instance;
  }

  /**
   * Upload file cho property
   */
  async uploadPropertyFile(
    propertyId: string,
    fileData: ArrayBuffer,
    originalName: string,
    mimeType: string,
    options?: {
      isPrimary?: boolean;
      caption?: string;
    }
  ): Promise<UploadResult> {
    try {
      if (!BlobStorageService.isConfigured) {
        // Fallback khi không có Vercel Blob
        return this.uploadFileFallback(propertyId, fileData, originalName, mimeType, options);
      }

      // Dynamic import cho Vercel Blob (chỉ khi cần)
      const { put } = await import('@vercel/blob');

      // Generate unique filename
      const fileExtension = originalName.split('.').pop() || '';
      const uniqueFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${fileExtension}`;
      const pathname = `properties/${propertyId}/${uniqueFilename}`;

      // Upload to Vercel Blob
      const blob = await put(pathname, Buffer.from(fileData), {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: mimeType
      });

      const uploadedFile: UploadedFile = {
        url: blob.url,
        blobUrl: blob.url,
        filename: uniqueFilename,
        originalName,
        size: fileData.byteLength,
        mimeType,
        uploadedAt: new Date(),
        propertyId,
        ...options
      };

      return { success: true, file: uploadedFile };

    } catch (error: any) {
      console.error('Blob upload error:', error);
      return {
        success: false,
        error: error.message || 'Upload failed'
      };
    }
  }

  /**
   * Delete file từ storage
   */
  async deleteFile(fileUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!BlobStorageService.isConfigured) {
        // Fallback - không làm gì cả
        console.warn('Blob storage not configured, skipping file deletion');
        return { success: true };
      }

      const { del } = await import('@vercel/blob');
      await del(fileUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      return { success: true };
    } catch (error: any) {
      console.error('Blob delete error:', error);
      return {
        success: false,
        error: error.message || 'Delete failed'
      };
    }
  }

  /**
   * List files cho một property
   */
  async listPropertyFiles(propertyId: string): Promise<UploadedFile[]> {
    try {
      if (!BlobStorageService.isConfigured) {
        return [];
      }

      const { list } = await import('@vercel/blob');
      const { blobs } = await list({
        prefix: `properties/${propertyId}/`,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      return blobs.map(blob => ({
        url: blob.url,
        blobUrl: blob.url,
        filename: blob.pathname,
        originalName: blob.pathname, // Using pathname as fallback since metadata not available
        size: blob.size,
        mimeType: 'application/octet-stream', // Default since contentType not available
        uploadedAt: new Date(), // Current date since uploadedAt not available
        propertyId,
        isPrimary: false, // Default since metadata not available
        caption: undefined // Default since metadata not available
      }));

    } catch (error: any) {
      console.error('Blob list error:', error);
      return [];
    }
  }

  /**
   * Fallback khi không có Vercel Blob Storage
   * Trả về mock data để app vẫn hoạt động
   */
  private uploadFileFallback(
    propertyId: string,
    fileData: ArrayBuffer,
    originalName: string,
    mimeType: string,
    options?: {
      isPrimary?: boolean;
      caption?: string;
    }
  ): UploadResult {
    // Tạo mock URL cho development/testing
    const mockUrl = `https://mock-storage.example.com/properties/${propertyId}/${originalName}`;

    const uploadedFile: UploadedFile = {
      url: mockUrl,
      blobUrl: mockUrl,
      filename: originalName,
      originalName,
      size: fileData.byteLength,
      mimeType,
      uploadedAt: new Date(),
      propertyId,
      ...options
    };

    console.log('Mock upload successful (Blob storage not configured):', uploadedFile);

    return {
      success: true,
      file: uploadedFile,
      error: 'USING_MOCK_STORAGE' // Special error code for client
    };
  }

  /**
   * Validate file type và size
   */
  validateFile(
    file: { type: string; size: number },
    maxSize: number = 10 * 1024 * 1024 // 10MB
  ): { valid: boolean; error?: string } {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
      };
    }

    return { valid: true };
  }

  /**
   * Get storage info
   */
  getStorageInfo(): {
    isConfigured: boolean;
    provider: string;
    maxSize: number;
    allowedTypes: string[];
  } {
    return {
      isConfigured: BlobStorageService.isConfigured,
      provider: BlobStorageService.isConfigured ? 'Vercel Blob Storage' : 'Mock Storage',
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
      ]
    };
  }
}

// Singleton instance
export const blobStorageService = BlobStorageService.getInstance();