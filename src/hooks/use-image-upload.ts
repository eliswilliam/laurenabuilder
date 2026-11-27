"use client"

import { useState, useCallback } from "react"

interface ImageUploadOptions {
  /**
   * Maximum file size in bytes before compression is applied
   * If not provided, no compression will be performed
   */
  maxFileSize?: number
  /**
   * Callback function when an error occurs
   */
  onError?: (error: string) => void
  /**
   * Callback function when upload completes successfully
   */
  onSuccess?: (url: string) => void
  /**
   * Quality level for compression (0 to 1)
   * Lower values = smaller file size but lower quality
   * Only used when compression is needed
   */
  quality?: number
  /**
   * The bucket to upload to (defaults to env variable)
   */
  bucket?: string
  /**
   * The folder path within the bucket
   */
  folderPath?: string
}

export function useImageUpload({
  maxFileSize,
  onError = () => {},
  onSuccess = () => {},
  quality = 0.8,
  bucket,
  folderPath = "editor",
}: ImageUploadOptions = {}) {
  const [isDragActive, setIsDragActive] = useState<boolean>(false)
  const [imageData, setImageData] = useState<string | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [file, setFile] = useState<File | null>(null)

  // Compress an image using canvas
  const compressImage = useCallback(
    async (imageFile: File): Promise<File> => {
      // If no maxFileSize or file is already smaller, return original
      if (!maxFileSize || imageFile.size <= maxFileSize) {
        return imageFile
      }

      try {
        // Dynamically import browser-image-compression only when needed
        const browserImageCompression = await import("browser-image-compression").then(
          (module) => module.default
        )

        const options = {
          maxSizeMB: maxFileSize / (1024 * 1024), // Convert bytes to MB
          maxWidthOrHeight: 1920, // Limit dimensions
          useWebWorker: true,
          initialQuality: quality,
        }

        const compressedFile = await browserImageCompression(imageFile, options)
        return compressedFile
      } catch (error) {
        console.error("Image compression failed:", error)
        // Fall back to original file if compression fails
        return imageFile
      }
    },
    [maxFileSize, quality]
  )

  // Process the file upload — compresses, reads preview locally, then uploads to GCS
  const processFile = useCallback(async (selectedFile: File) => {
    try {
      setUploading(true)
      setProgress(0)

      // Read file as data URL for local preview display
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result === "string") {
          setImageData(result)
        }
      }
      reader.readAsDataURL(selectedFile)

      // Compress if needed
      const processedFile = await compressImage(selectedFile)
      setProgress(30)

      // Upload to GCS via server route /api/upload-photo
      const form = new FormData()
      form.append("file", processedFile)

      const res = await fetch("/api/upload-photo", {
        method: "POST",
        body: form,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as {
          error?: string
          bucket?: string
          objectPath?: string
        }
        const details = [
          body.bucket ? `bucket=${body.bucket}` : "",
          body.objectPath ? `objectPath=${body.objectPath}` : "",
        ].filter(Boolean).join(" ")

        const baseError = body.error ?? `Upload failed (${res.status})`
        throw new Error(details ? `${baseError} ${details}` : baseError)
      }

      const { url } = await res.json() as { url: string }
      setProgress(100)
      onSuccess(url)
      setUploading(false)
      return url
    } catch (error) {
      console.error("Upload process failed:", error)
      onError(error instanceof Error ? error.message : "Upload failed")
      setUploading(false)
      setProgress(0)
      return null
    }
  }, [compressImage, onSuccess, onError])

  // Reset the uploader state
  const resetImage = useCallback(() => {
    setImageData(null)
    setFile(null)
    setProgress(0)
  }, [])

  return {
    isDragActive,
    imageData,
    uploading,
    progress,
    file,
    resetImage,
    uploadImage: processFile
  }
}