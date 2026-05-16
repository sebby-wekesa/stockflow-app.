import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import type { ParsedWorkbookResult } from './specialized-parsers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function saveParsedDataToSupabase(parsedData: ParsedWorkbookResult) {
  const results = {
    productsUpserted: 0,
    salesInserted: 0,
    purchasesInserted: 0,
    errors: [] as string[],
  }

  // 1. Upsert product master (inventory summary)
  if (parsedData.products.length > 0) {
    const { error, count } = await supabase
      .from('products')
      .upsert(parsedData.products, {
        onConflict: 'name,location',
        ignoreDuplicates: false,
      })

    if (error) {
      results.errors.push(`products: ${error.message}`)
    } else {
      results.productsUpserted = count || parsedData.products.length
    }
  }

  // 2. Insert sales transactions
  if (parsedData.sales.length > 0) {
    const { error, count } = await supabase
      .from('sales')
      .insert(parsedData.sales)

    if (error) {
      results.errors.push(`sales: ${error.message}`)
    } else {
      results.salesInserted = count || parsedData.sales.length
    }
  }

  // 3. Insert stock receipts / purchases
  if (parsedData.purchases.length > 0) {
    const { error, count } = await supabase
      .from('stock_receipts')
      .insert(parsedData.purchases)

    if (error) {
      results.errors.push(`stock_receipts: ${error.message}`)
    } else {
      results.purchasesInserted = count || parsedData.purchases.length
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
