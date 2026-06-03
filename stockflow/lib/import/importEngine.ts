// @ts-nocheck
import { StockOrigin, ProductCategory, StockStatus, SaleStatus, Design, FinishedGoods } from '@prisma/client';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { normalizeProductUom } from '@/lib/products';

/**
 * Normalizes item names to ensure case-sensitive inner joins match 
 * across the central schema database safely.
 */
const cleanProductName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
};

export async function processInventoryAndSalesUpload(fileBuffer: Buffer, filename: string) {
  // 1. Detect branch accurately from the filename string context
  const upperFilename = filename.toUpperCase();
  const branchName = upperFilename.includes('NAIROBI') ? 'Nairobi' : 'Mombasa';

  // 2. Resolve the matching branch unique record identifier from your core tables
  const branch = await prisma.branch.findUnique({
    where: { name: branchName }
  });

  if (!branch) {
    throw new Error(`Branch location matching '${branchName}' could not be found in your database.`);
  }

  const branchId = branch.id;

  // Read upload workbook buffer stream cleanly via SheetJS
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  for (const sheetName of workbook.SheetNames) {
    const upperSheet = sheetName.toUpperCase();
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

    if (rows.length === 0) continue;

    // Categorize elements accurately based on tab headers to match your ProductCategory Enum
    let schemaCategory: ProductCategory = ProductCategory.break_linings;
    if (upperSheet.includes('CONSUMABLE')) schemaCategory = ProductCategory.trailer_parts;
    else if (upperSheet.includes('SPRING') || upperSheet.includes('FINISHED')) schemaCategory = ProductCategory.springs;
    else if (upperSheet.includes('UBOLT')) schemaCategory = ProductCategory.ubolts;
    else if (upperSheet.includes('CENTER') || upperSheet.includes('CENTRE')) schemaCategory = ProductCategory.center_bolts;
    else if (upperSheet.includes('BRAKE') || upperSheet.includes('BREAK')) schemaCategory = ProductCategory.break_linings;
    else if (upperSheet.includes('RAW') || upperSheet.includes('BAR') || upperSheet.includes('BUSHES')) schemaCategory = ProductCategory.trailer_parts;

    // --- ARCHETYPE A: THREE-COLUMN HORIZONTAL MATRIX LEDGER ---
    let headerIdx = -1;
    const map = { inDate: -1, inItem: -1, inQty: -1, outDate: -1, outItem: -1, outQty: -1, balItem: -1, balOp: -1, balCurr: -1, balUom: -1 };

    for (let i = 0; i < rows.length; i++) {
      if (!rows[i]) continue;
      const normCells = rows[i].map((c: any) => String(c || '').trim().toUpperCase());

      // Detect our split triple dataset header indicators
      if ((normCells.includes('PRODUCT DESCRIPTION') || normCells.includes('PRODUCT DESCRIPTION3')) && 
          (normCells.includes('QTY') || normCells.includes('BALANCE STOCK') || normCells.includes('B. STOCK'))) {
        headerIdx = i;
        normCells.forEach((cell: string, idx: number) => {
          // Inbound Grouping Map
          if (cell === 'DATE' && map.inDate === -1) map.inDate = idx;
          if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION2') && map.inItem === -1) map.inItem = idx;
          if ((cell === 'QTY' || cell === 'QUANTITY') && map.inQty === -1) map.inQty = idx;

          // Outbound Grouping Map
          if (cell === 'DATE' && map.inDate !== -1 && idx > map.inDate) map.outDate = idx;
          if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION2') && map.inItem !== -1 && idx > map.inItem) map.outItem = idx;
          if ((cell === 'QTY' || cell === 'QTY2' || cell === 'QUANTITY2') && map.inQty !== -1 && idx > map.inQty) map.outQty = idx;

          // Catalog Balances Map
          if ((cell === 'PRODUCT DESCRIPTION' || cell === 'PRODUCT DESCRIPTION3') && idx > map.outItem) map.balItem = idx;
          if (cell === 'OP. STOCK' || cell === 'OPENING STOCK' || cell === 'OP STOCK') map.balOp = idx;
          if (cell === 'BALANCE STOCK' || cell === 'CURRENT BALANCE' || cell === 'B. STOCK') map.balCurr = idx;
          if (cell === 'UOM' || cell === 'U/M') map.balUom = idx;
        });
        break;
      }
    }

    if (headerIdx !== -1) {
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // 1. Process Master Inventory Stock Balances (Feeds "Stock" View)
        const rawBalItem = row[map.balItem];
        if (rawBalItem && String(rawBalItem).trim() !== "") {
          const product_name = cleanProductName(String(rawBalItem));
          const current_stock = Number(row[map.balCurr]) || 0;
          const uom_string = normalizeProductUom(row[map.balUom]) ?? 'KG';

          if (!['CONSUMABLES', 'DOLL', 'SPRINGTECH', 'TOTAL', 'COLUMN1'].includes(product_name)) {
            // Upsert directly into the main application catalog table
            const targetProduct = await prisma.product.upsert({
              where: { sku: `${branchName}-${product_name}` }, // Creates unique branch variant tracking safely
              update: {
                currentStock: current_stock,
                stockStatus: current_stock <= 0 ? StockStatus.OUT_OF_STOCK : StockStatus.AVAILABLE,
                updatedAt: new Date()
              },
              create: {
                name: product_name,
                sku: `${branchName}-${product_name}`,
                category: schemaCategory,
                uom: uom_string,
                currentStock: current_stock,
                branchId: branchId,
                origin: schemaCategory === ProductCategory.springs || schemaCategory === ProductCategory.ubolts || schemaCategory === ProductCategory.center_bolts ? StockOrigin.FACTORY_MADE : StockOrigin.LOCAL_PURCHASE,
                stockStatus: current_stock <= 0 ? StockStatus.OUT_OF_STOCK : StockStatus.AVAILABLE
              }
            });

            // Generate an inventory tracking audit trace entry
            await prisma.stockMovement.create({
              data: {
                productId: targetProduct.id,
                branchId: branchId,
                movementType: "RECONCILIATION_IMPORT",
                quantity: current_stock,
                notes: `System stock sync initialization via sheet tab: ${sheetName}`
              }
            });
          }
        }

        // 2. Process Dynamic Sales Entries (Feeds "Sales" & "Reports" Dashboard Metrics)
        const rawOutItem = row[map.outItem];
        if (rawOutItem && String(rawOutItem).trim() !== "") {
          const outProductName = cleanProductName(String(rawOutItem));
          const outQty = Number(row[map.outQty]) || 0;
          const outDate = row[map.outDate] ? new Date(row[map.outDate]) : new Date();

          let appProduct = await prisma.product.findFirst({
            where: { name: outProductName, branchId: branchId }
          });

          // Register transient placeholder product if missing inside inventory master rows
          if (!appProduct) {
            appProduct = await prisma.product.create({
              data: {
                name: outProductName,
                sku: `${branchName}-${outProductName}`,
                category: schemaCategory,
                branchId: branchId,
                currentStock: 0
              }
            });
          }

          const invoiceNum = row[map.outDate + 1] ? String(row[map.outDate + 1]).trim() : `XLS-${Date.now()}`;
          const customer = row[map.outDate + 2] ? String(row[map.outDate + 2]).trim() : 'Walk-in Customer';

          // Create the full relation transaction payload to light up chart UI endpoints
          await prisma.saleOrder.create({
            data: {
              customerName: customer,
              totalAmount: 0.00, // Populates historical dashboard analytics records cleanly
              status: SaleStatus.CONFIRMED,
              createdAt: outDate,
              SaleItem: {
                create: {
                  finishedGoodsId: appProduct.id, 
                  quantity: outQty,
                  unitPrice: 0.00,
                  totalPrice: 0.00
                }
              }
            }
          });

          // Register stock variance down to core transaction ledger
          await prisma.stockMovement.create({
            data: {
              productId: appProduct.id,
              branchId: branchId,
              movementType: "SALE",
              quantity: -outQty, // Negative value properly represents stock outflux 
              reference: invoiceNum,
              notes: `Imported via side-ledger transaction matrix`,
              createdAt: outDate
            }
          });
        }
      }
      continue; // Move to next sheet processed
    }

    // --- ARCHETYPE B: QUICKBOOKS TRANSACTION LEDGERS (SALES JAN-APR style layouts) ---
    const row0Str = rows[0]?.toString().toLowerCase() || '';
    if (row0Str.includes('type') && row0Str.includes('date') && row0Str.includes('num')) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 12) continue;

        const txType = String(row[7] || '').trim(); // Position parsing based on row matrix
        if (txType === 'Invoice' || txType === 'Cash Sale') {
          const product_name = cleanProductName(String(row[11] || ''));
          const quantity = Math.abs(Number(row[15])) || 0;
          const txDate = row[9] ? new Date(row[9]) : new Date();
          const invoiceNum = row[13] ? String(row[13]).trim() : `INV-${Date.now()}`;
          const customerName = row[17] ? String(row[17]).trim() : 'Walk-in Customer';
          const rowPrice = Number(row[21]) || 0;
          const rowAmount = Number(row[23]) || 0;

          let appProduct = await prisma.product.findFirst({
            where: { name: product_name, branchId: branchId }
          });

          if (!appProduct) {
            appProduct = await prisma.product.create({
              data: {
                name: product_name,
                sku: `${branchName}-${product_name}`,
                category: ProductCategory.break_linings,
                branchId: branchId,
                currentStock: 0
              }
            });
          }

          // Generate genuine transaction pipelines to feed dashboard graphs 
          await prisma.saleOrder.create({
            data: {
              customerName,
              totalAmount: rowAmount,
              status: SaleStatus.CONFIRMED,
              createdAt: txDate,
              SaleItem: {
                create: {
                  finishedGoodsId: appProduct.id,
                  quantity: quantity,
                  unitPrice: rowPrice,
                  totalPrice: rowAmount
                }
              }
            }
          });

          await prisma.stockMovement.create({
            data: {
              productId: appProduct.id,
              branchId: branchId,
              movementType: "SALE",
              quantity: -quantity,
              reference: invoiceNum,
              createdAt: txDate
            }
          });
        }
      }
    }
  }

  return { success: true, message: `Successfully parsed and synchronized data to active tables for branch ${branchName}` };
}
