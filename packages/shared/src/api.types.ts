// ─── API Types ─────────────────────────────────────────────────────────────
// Response shapes returned by the Nest.js API

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

export interface WidgetConfig {
  themeColor: string
  allowedTypes: string[]
  labels?: {
    buttonText?: string
    placeholderText?: string
  }
  captureConsole: boolean
  captureNetwork: boolean
}

export interface PresignedUploadResponse {
  feedbackId: string
  presignedUrl: string
  objectKey: string
}
