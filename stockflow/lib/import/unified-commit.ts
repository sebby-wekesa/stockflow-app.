// @ts-nocheck
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { normalizeProductUom } from '@/lib/products'
import type { ParsedWorkbookResult } from './specialized-parsers'
import type { UnifiedDataBundle } from './unified-parser'

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    )
  }
  _supabaseAdmin = createClient(url, key)
  return _supabaseAdmin
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function dedupeByKey<T>(items: T[], keyFn: (t: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of items) map.set(keyFn(item), item) // keep last
  return Array.from(map.values())
}

function toUpperTrim(value: string): string {
  return value.trim().toUpperCase()
}

export function bundleToParsedWorkbookResult(bundle: UnifiedDataBundle): ParsedWorkbookResult {
  const location = bundle.location

  const products = bundle.products.map((p) => ({
    name: toUpperTrim(p.name),
    uom: normalizeProductUom(p.uom) ?? 'KG',
    opening_stock: Number(p.opening_stock) || 0,
    current_stock: Number(p.current_stock) || 0,
    location,
    category: p.category as any,
  }))

  const sales = bundle.sales.map((s) => ({
    product_name: toUpperTrim(s.product_name),
    quantity: Number(s.quantity) || 0,
    transaction_date: s.transaction_date,
    invoice_number: s.invoice_num ? String(s.invoice_num).trim() : null,
    customer_name: s.customer ? String(s.customer).trim() : null,
    location,
  }))

  const purchases = bundle.purchases.map((p) => ({
    product_name: toUpperTrim(p.product_name),
    quantity: Number(p.quantity) || 0,
    transaction_date: p.transaction_date,
    reference_memo: p.memo ? String(p.memo).trim() : null,
    location,
  }))

  return { products, sales, purchases }
}

export async function commitBundleToSupabase(bundle: UnifiedDataBundle) {
  return saveParsedDataToSupabase(bundleToParsedWorkbookResult(bundle))
}

export async function commitBundleWithPrisma(bundle: UnifiedDataBundle) {
  return saveParsedDataWithPrisma(bundleToParsedWorkbookResult(bundle))
}

export async function saveParsedDataToSupabase(parsedData: ParsedWorkbookResult) {
  const supabase = getSupabaseAdmin()
  const results = {
    productsUpserted: 0,
    salesInserted: 0,
    purchasesInserted: 0,
    errors: [] as string[],
  }

  // 1. Upsert product master (inventory summary)
  const products = dedupeByKey(
    parsedData.products,
    (p) => `${String((p as any).name)}@@${String((p as any).location)}`
  )
  if (products.length > 0) {
    for (const batch of chunk(products, 500)) {
      const { error } = await supabase.from('products').upsert(batch as any, {
        onConflict: 'name,location',
        ignoreDuplicates: false,
      })

      if (error) {
        results.errors.push(`products: ${error.message}`)
      } else {
        results.productsUpserted += batch.length
      }
    }
  }

  // 2. Insert sales transactions
  if (parsedData.sales.length > 0) {
    for (const batch of chunk(parsedData.sales, 1000)) {
      const { error } = await supabase.from('sales').insert(batch as any)

      if (error) {
        results.errors.push(`sales: ${error.message}`)
      } else {
        results.salesInserted += batch.length
      }
    }
  }

  // 3. Insert stock receipts / purchases
  if (parsedData.purchases.length > 0) {
    for (const batch of chunk(parsedData.purchases, 1000)) {
      const { error } = await supabase.from('stock_receipts').insert(batch as any)

      if (error) {
        results.errors.push(`stock_receipts: ${error.message}`)
      } else {
        results.purchasesInserted += batch.length
      }
    }
  }

  return results
}

// Prisma-based version (recommended for consistency with the rest of the app)
export async function saveParsedDataWithPrisma(parsedData: ParsedWorkbookResult) {
  const results = {
    productsUpserted: 0,
    salesInserted: 0,
    purchasesInserted: 0,
    errors: [] as string[],
  }

  // 1. Upsert products (ProductMaster table)
  for (const product of parsedData.products) {
    try {
      await prisma.productMaster.upsert({
        where: {
          name_location: {
            name: product.name,
            location: product.location,
          },
        },
        update: {
          current_stock: product.current_stock,
          category: product.category,
        },
        create: {
          name: product.name,
          location: product.location,
          category: product.category,
          opening_stock: product.opening_stock,
          current_stock: product.current_stock,
        },
      })
      results.productsUpserted++
    } catch (err: any) {
      results.errors.push(`Product ${product.name}: ${err.message}`)
    }
  }

  // 2. Insert sales
  for (const sale of parsedData.sales) {
    try {
      await prisma.salesTransaction.create({
        data: {
          product_name: sale.product_name,
          quantity: sale.quantity,
          transaction_date: new Date(sale.transaction_date),
          invoice_number: sale.invoice_number,
          customer_name: sale.customer_name,
          location: sale.location,
        },
      })
      results.salesInserted++
    } catch (err: any) {
      results.errors.push(`Sale ${sale.product_name}: ${err.message}`)
    }
  }

  // 3. Insert stock receipts
  for (const receipt of parsedData.purchases) {
    try {
      await prisma.stockReceipt.create({
        data: {
          product_name: receipt.product_name,
          quantity: receipt.quantity,
          transaction_date: new Date(receipt.transaction_date),
          reference_memo: receipt.reference_memo,
          location: receipt.location,
        },
      })
      results.purchasesInserted++
    } catch (err: any) {
      results.errors.push(`Receipt ${receipt.product_name}: ${err.message}`)
    }
  }

  return results
}
