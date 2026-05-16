export interface Design {
  id: string
  name: string
  code: string
  description?: string
  targetDimensions?: string
  targetWeight: number | null
  kgPerUnit: number
  createdAt: Date
  updatedAt: Date
}