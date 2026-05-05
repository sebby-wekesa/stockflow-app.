import type { ProductCategory, ProductType } from '@prisma/client'

// Display labels for the 5 categories
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  manufactured_spring: 'Manufactured spring',
  manufactured_ubolt: 'Manufactured U-bolt',
  imported: 'Imported',
  local_purchase: 'Local purchase',
  service: 'Service',
}

// Short labels for badges and tabs
export const CATEGORY_SHORT: Record<ProductCategory, string> = {
  manufactured_spring: 'Spring',
  manufactured_ubolt: 'U-bolt',
  imported: 'Imported',
  local_purchase: 'Local purch',
  service: 'Service',
}

// Color theme per category
export const CATEGORY_BADGE_CLASS: Record<ProductCategory, string> = {
  manufactured_spring: 'bg-accent/15 text-accent',
  manufactured_ubolt: 'bg-purple/15 text-purple',
  imported: 'bg-surface2 text-muted',
  local_purchase: 'bg-teal/15 text-teal',
  service: 'bg-red/15 text-red',
}

// Which product types are valid for each category
export const PRODUCT_TYPES_BY_CATEGORY: Record<ProductCategory, ProductType[]> = {
  manufactured_spring: ['leaf_spring', 'spring_assembly', 'helper_spring', 'auxiliary_spring'],
  manufactured_ubolt: ['u_bolt', 'body_bolt', 'centre_bolt'],
  imported: ['bearing', 'seal', 'assembly', 'bush', 'hub'],
  local_purchase: ['brake_lining', 'brake_pad', 'brake_shoe', 'clamp', 'equalizer', 'hardware'],
  service: ['repair', 'retention', 'rebonding', 'riveting', 'straightening', 'other_service'],
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  leaf_spring: 'Leaf spring',
  spring_assembly: 'Spring assembly',
  helper_spring: 'Helper spring',
  auxiliary_spring: 'Auxiliary spring',
  u_bolt: 'U-bolt',
  body_bolt: 'Body bolt',
  centre_bolt: 'Centre bolt',
  bearing: 'Bearing',
  seal: 'Seal',
  assembly: 'Assembly',
  bush: 'Bush',
  hub: 'Hub',
  brake_lining: 'Brake lining',
  brake_pad: 'Brake pad',
  brake_shoe: 'Brake shoe',
  clamp: 'Clamp',
  equalizer: 'Equalizer',
  hardware: 'Hardware',
  repair: 'Repair',
  retention: 'Retention',
  rebonding: 'Rebonding',
  riveting: 'Riveting',
  straightening: 'Straightening',
  other_service: 'Other service',
}

// Generate a code suggestion based on category and inputs
export function suggestProductCode(
  category: ProductCategory,
  inputs: {
    vehicle_make?: string
    spring_position?: string
    leaf_position?: string
    shaft_size_mm?: number
    name?: string
  }
): string {
  switch (category) {
    case 'manufactured_spring': {
      const make = (inputs.vehicle_make ?? '').toUpperCase().replace(/\s+/g, '')
      const pos = (inputs.spring_position ?? 'F')[0]?.toUpperCase() ?? 'F'
      const leaf = (inputs.leaf_position ?? 'ML').toUpperCase().replace(/\s+/g, '')
      return `${make}/${pos}S${leaf}`
    }
    case 'manufactured_ubolt': {
      const make = (inputs.vehicle_make ?? '').toUpperCase().replace(/\s+/g, '')
      const pos = (inputs.spring_position ?? 'F')[0]?.toUpperCase() ?? 'F'
      return `UB-${make}-${pos}${inputs.shaft_size_mm ?? ''}`
    }
    case 'imported':
      return `IMP-${(inputs.name ?? '').toUpperCase().replace(/\s+/g, '-').slice(0, 20)}`
    case 'local_purchase':
      return `BL-${(inputs.name ?? '').toUpperCase().replace(/\s+/g, '-').slice(0, 20)}`
    case 'service':
      return `SVC-${(inputs.name ?? '').toUpperCase().replace(/\s+/g, '-').slice(0, 15)}`
    default:
      return ''
  }
}