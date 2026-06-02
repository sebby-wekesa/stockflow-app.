import type { ProductCategory, ProductType, StockOrigin } from '@prisma/client'

// Display labels for the 5 categories
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  springs: 'Springs',
  ubolts: 'Ubolts',
  trailer_parts: 'Trailer parts',
  break_linings: 'Break linings',
  center_bolts: 'Center bolts',
}

// Short labels for badges and tabs
export const CATEGORY_SHORT: Record<ProductCategory, string> = {
  springs: 'Springs',
  ubolts: 'Ubolts',
  trailer_parts: 'Trailer parts',
  break_linings: 'Break linings',
  center_bolts: 'Center bolts',
}

// Color theme per category
export const CATEGORY_BADGE_CLASS: Record<ProductCategory, string> = {
  springs: 'bg-accent/15 text-accent',
  ubolts: 'bg-purple/15 text-purple',
  trailer_parts: 'bg-surface2 text-muted',
  break_linings: 'bg-teal/15 text-teal',
  center_bolts: 'bg-red/15 text-red',
}

// Display labels for stock origins
export const ORIGIN_LABELS: Record<StockOrigin, string> = {
  FACTORY_MADE: 'Factory Made',
  LOCAL_PURCHASE: 'Local Purchase',
  IMPORTED: 'Imported',
}

// Short labels for origins
export const ORIGIN_SHORT: Record<StockOrigin, string> = {
  FACTORY_MADE: 'Factory',
  LOCAL_PURCHASE: 'Local',
  IMPORTED: 'Imported',
}

// Color theme per origin
export const ORIGIN_BADGE_CLASS: Record<StockOrigin, string> = {
  FACTORY_MADE: 'bg-accent/15 text-accent',
  LOCAL_PURCHASE: 'bg-teal/15 text-teal',
  IMPORTED: 'bg-surface2 text-muted',
}

// Which product types are valid for each category
export const PRODUCT_TYPES_BY_CATEGORY: Record<ProductCategory, ProductType[]> = {
  springs: ['leaf_spring', 'spring_assembly', 'helper_spring', 'auxiliary_spring'],
  ubolts: ['u_bolt', 'body_bolt'],
  trailer_parts: ['bearing', 'seal', 'assembly', 'bush', 'hub', 'clamp', 'equalizer', 'hardware'],
  break_linings: ['brake_lining', 'brake_pad', 'brake_shoe'],
  center_bolts: ['centre_bolt'],
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
    case 'springs': {
      const make = (inputs.vehicle_make ?? '').toUpperCase().replace(/\s+/g, '')
      const pos = (inputs.spring_position ?? 'F')[0]?.toUpperCase() ?? 'F'
      const leaf = (inputs.leaf_position ?? 'ML').toUpperCase().replace(/\s+/g, '')
      return `${make}/${pos}S${leaf}`
    }
    case 'ubolts': {
      const make = (inputs.vehicle_make ?? '').toUpperCase().replace(/\s+/g, '')
      const pos = (inputs.spring_position ?? 'F')[0]?.toUpperCase() ?? 'F'
      return `UB-${make}-${pos}${inputs.shaft_size_mm ?? ''}`
    }
    case 'trailer_parts':
      return `TP-${(inputs.name ?? '').toUpperCase().replace(/\s+/g, '-').slice(0, 20)}`
    case 'break_linings':
      return `BL-${(inputs.name ?? '').toUpperCase().replace(/\s+/g, '-').slice(0, 20)}`
    case 'center_bolts':
      return `CB-${(inputs.name ?? '').toUpperCase().replace(/\s+/g, '-').slice(0, 20)}`
    default:
      return ''
  }
}
