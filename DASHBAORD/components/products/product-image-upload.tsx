'use client'

import React, { useState } from 'react'
import { Upload, X, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cloudinaryService } from '@/lib/cloudinary-service'

interface ProductImageUploadProps {
  onImageUpload: (imageUrl: string) => void
  onError?: (error: string) => void
  maxSizeInMB?: number
}

export function ProductImageUpload({
  onImageUpload,
  onError,
  maxSizeInMB = 10,
}: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate image
    const validation = cloudinaryService.validateImage(file, maxSizeInMB)
    if (!validation.valid) {
      const error = validation.error || 'Invalid image'
      onError?.(error)
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
      setFileName(file.name)
    }
    reader.readAsDataURL(file)

    // Upload to Cloudinary
    setUploading(true)
    try {
      console.log('[ProductImageUpload] Uploading image to Cloudinary...')
      const uploadResponse = await cloudinaryService.uploadImage(file, 'seller-admin/products')
      const imageUrl = cloudinaryService.getSecureUrl(uploadResponse)

      console.log('[ProductImageUpload] Upload successful:', imageUrl)
      onImageUpload(imageUrl)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      console.error('[ProductImageUpload] Upload error:', errorMessage)
      onError?.(errorMessage)
      setPreview('')
      setFileName('')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview('')
    setFileName('')
  }

  return (
    <div className="w-full">
      <div className="space-y-3">
        {/* Upload Area */}
        {!preview ? (
          <label className="flex flex-col items-center justify-center w-full h-40 px-4 py-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors group">
            <div className="flex flex-col items-center justify-center pt-2 pb-2">
              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WEBP up to {maxSizeInMB}MB
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        ) : (
          // Preview Area
          <div className="relative w-full h-40 bg-muted rounded-lg overflow-hidden group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Product preview"
              className="w-full h-full object-cover"
            />

            {/* Upload Loading Overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader className="w-6 h-6 text-white animate-spin mb-2" />
                  <p className="text-xs text-white">Uploading...</p>
                </div>
              </div>
            )}

            {/* Remove Button */}
            {!uploading && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1 bg-destructive/90 hover:bg-destructive text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* File Name Display */}
        {fileName && (
          <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
            File: {fileName}
          </div>
        )}
      </div>
    </div>
  )
}
