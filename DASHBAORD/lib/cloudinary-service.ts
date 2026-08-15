/**
 * Cloudinary Image Upload Service
 * Handles direct upload to Cloudinary and returns URLs to store in Django backend
 */

export interface CloudinaryUploadResponse {
  public_id: string
  url: string
  secure_url: string
  format: string
  resource_type: string
  created_at: string
  bytes: number
  width: number
  height: number
}

export interface CloudinaryError {
  error: {
    message: string
  }
}

export class CloudinaryService {
  private cloudName: string
  private uploadPreset: string

  constructor() {
    this.cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
    this.uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''

    if (!this.cloudName || !this.uploadPreset) {
      console.warn('[Cloudinary] Missing environment variables for Cloudinary upload')
    }
  }

  /**
   * Upload image directly to Cloudinary
   * Returns the secure URL to be stored in Django backend
   */
  async uploadImage(
    file: File,
    folder: string = 'seller-admin'
  ): Promise<CloudinaryUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', this.uploadPreset)
    formData.append('folder', folder)
    formData.append('resource_type', 'auto')

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const error: CloudinaryError = await response.json()
        throw new Error(error.error.message || 'Cloudinary upload failed')
      }

      const data: CloudinaryUploadResponse = await response.json()
      console.log('[Cloudinary] Upload successful:', data.public_id)

      return data
    } catch (error) {
      console.error('[Cloudinary] Upload failed:', error)
      throw error
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultiple(
    files: File[],
    folder: string = 'seller-admin'
  ): Promise<CloudinaryUploadResponse[]> {
    try {
      const uploads = files.map(file => this.uploadImage(file, folder))
      return await Promise.all(uploads)
    } catch (error) {
      console.error('[Cloudinary] Bulk upload failed:', error)
      throw error
    }
  }

  /**
   * Get secure URL from upload response
   */
  getSecureUrl(uploadResponse: CloudinaryUploadResponse): string {
    return uploadResponse.secure_url
  }

  /**
   * Transform Cloudinary URL with optimization
   */
  getOptimizedUrl(
    publicId: string,
    width?: number,
    height?: number,
    quality: string = 'auto'
  ): string {
    let url = `https://res.cloudinary.com/${this.cloudName}/image/upload/`

    if (width || height) {
      url += `c_fill,w_${width || 'auto'},h_${height || 'auto'},`
    }

    url += `q_${quality}/${publicId}`
    return url
  }

  /**
   * Validate image before upload
   */
  validateImage(
    file: File,
    maxSizeInMB: number = 10,
    allowedFormats: string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' }
    }

    if (!allowedFormats.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid format. Allowed: ${allowedFormats.join(', ')}`,
      }
    }

    const fileSizeInMB = file.size / (1024 * 1024)
    if (fileSizeInMB > maxSizeInMB) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeInMB}MB limit`,
      }
    }

    return { valid: true }
  }
}

export const cloudinaryService = new CloudinaryService()
