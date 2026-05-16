"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import ExcelJS from 'exceljs';
import { z } from 'zod';

// Define the data structure for Excel import rows
interface ExcelImportRow {
  data: any[];
  rowNumber: number;
}

// Validation schemas for different import types
const supplierImportSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional()
});

const customerImportSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional()
});

const rawMaterialImportSchema = z.object({
  materialName: z.string().min(1),
  diameter: z.string().min(1),
  supplierCode: z.string().optional(),
  availableKg: z.number().min(0).default(0),
  reservedKg: z.number().min(0).default(0)
});

const stockCountImportSchema = z.object({
  materialCode: z.string().min(1), // Could be barcode or material name + diameter
  location: z.string().optional(),
  countedKg: z.number().min(0),
  batchNumber: z.string().optional(),
  notes: z.string().optional()
});

export interface ImportResult {
  success: boolean;
  totalRows: number;
  processedRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    message: string;
  }>;
}

export async function importMasterData(filePath: string, importType: 'suppliers' | 'customers' | 'materials'): Promise<ImportResult> {
  const user = await requireAuth();

  if (user.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only admins can import master data');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const result: ImportResult = {
    success: false,
    totalRows: 0,
    processedRows: 0,
    errors: [],
    warnings: []
  };

  // Skip header row
  const rows: ExcelImportRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const values = row.values as any[];
      // Remove first empty value (ExcelJS includes empty cell at index 0)
      values.shift();
      rows.push({ data: values, rowNumber });
    }
  });

  result.totalRows = rows.length;

  await prisma.$transaction(async (tx) => {
    for (const { data, rowNumber } of rows) {
      try {
        switch (importType) {
          case 'suppliers':
            await importSupplier(tx, data, rowNumber, result);
            break;
          case 'customers':
            await importCustomer(tx, data, rowNumber, result);
            break;
          case 'materials':
            await importRawMaterial(tx, data, rowNumber, result);
            break;
        }
        result.processedRows++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'general',
          message: error.message
        });
      }
    }
  });

  result.success = result.errors.length === 0;
  return result;
}

export async function importStockCounts(filePath: string): Promise<ImportResult> {
  const user = await requireAuth();

  if (!['ADMIN', 'WAREHOUSE'].includes(user.role)) {
    throw new Error('Unauthorized: Only admins and warehouse staff can import stock counts');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const result: ImportResult = {
    success: false,
    totalRows: 0,
    processedRows: 0,
    errors: [],
    warnings: []
  };

  // Skip header row
  const rows: ExcelImportRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const values = row.values as any[];
      values.shift(); // Remove empty first cell
      rows.push({ data: values, rowNumber });
    }
  });

  result.totalRows = rows.length;

  await prisma.$transaction(async (tx) => {
    for (const { data, rowNumber } of rows) {
      try {
        await importStockCount(tx, data, rowNumber, result);
        result.processedRows++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'general',
          message: error.message
        });
      }
    }
  });

  result.success = result.errors.length === 0;
  return result;
}

async function importSupplier(tx: any, data: any[], rowNumber: number, result: ImportResult) {
  const supplierData = {
    code: data[0]?.toString().trim(),
    name: data[1]?.toString().trim(),
    contactName: data[2]?.toString().trim() || undefined,
    email: data[3]?.toString().trim() || '',
    phone: data[4]?.toString().trim() || undefined,
    address: data[5]?.toString().trim() || undefined,
    taxId: data[6]?.toString().trim() || undefined
  };

  const validatedData = supplierImportSchema.parse(supplierData);

  // Check for duplicates
  const existing = await tx.supplier.findUnique({
    where: { code: validatedData.code }
  });

  if (existing) {
    result.warnings.push({
      row: rowNumber,
      message: `Supplier with code ${validatedData.code} already exists, skipping`
    });
    return;
  }

  await tx.supplier.create({
    data: validatedData
  });
}

async function importCustomer(tx: any, data: any[], rowNumber: number, result: ImportResult) {
  const customerData = {
    code: data[0]?.toString().trim(),
    name: data[1]?.toString().trim(),
    contactName: data[2]?.toString().trim() || undefined,
    email: data[3]?.toString().trim() || '',
    phone: data[4]?.toString().trim() || undefined,
    address: data[5]?.toString().trim() || undefined,
    taxId: data[6]?.toString().trim() || undefined
  };

  const validatedData = customerImportSchema.parse(customerData);

  // Check for duplicates
  const existing = await tx.customer.findUnique({
    where: { code: validatedData.code }
  });

  if (existing) {
    result.warnings.push({
      row: rowNumber,
      message: `Customer with code ${validatedData.code} already exists, skipping`
    });
    return;
  }

  await tx.customer.create({
    data: validatedData
  });
}

async function importRawMaterial(tx: any, data: any[], rowNumber: number, result: ImportResult) {
  const materialData = {
    materialName: data[0]?.toString().trim(),
    diameter: data[1]?.toString().trim(),
    supplierCode: data[2]?.toString().trim() || undefined,
    availableKg: parseFloat(data[3]?.toString()) || 0,
    reservedKg: parseFloat(data[4]?.toString()) || 0
  };

  const validatedData = rawMaterialImportSchema.parse(materialData);

  // Find supplier if supplierCode provided
  let supplierId = null;
  if (validatedData.supplierCode) {
    const supplier = await tx.supplier.findUnique({
      where: { code: validatedData.supplierCode }
    });
    if (!supplier) {
      result.warnings.push({
        row: rowNumber,
        message: `Supplier with code ${validatedData.supplierCode} not found`
      });
    } else {
      supplierId = supplier.id;
    }
  }

  await tx.rawMaterial.create({
    data: {
      materialName: validatedData.materialName,
      diameter: validatedData.diameter,
      supplierId,
      availableKg: validatedData.availableKg,
      reservedKg: validatedData.reservedKg
    }
  });
}

async function importStockCount(tx: any, data: any[], rowNumber: number, result: ImportResult) {
  const stockData = {
    materialCode: data[0]?.toString().trim(),
    location: data[1]?.toString().trim() || undefined,
    countedKg: parseFloat(data[2]?.toString()),
    batchNumber: data[3]?.toString().trim() || undefined,
    notes: data[4]?.toString().trim() || undefined
  };

  const validatedData = stockCountImportSchema.parse(stockData);

  // Find material by barcode or by name+diameter combination
  let material = await tx.rawMaterial.findUnique({
    where: { barcode: validatedData.materialCode }
  });

  if (!material) {
    // Try to find by material name and diameter (assuming format "Name-Diameter")
    const parts = validatedData.materialCode.split('-');
    if (parts.length >= 2) {
      const materialName = parts.slice(0, -1).join('-');
      const diameter = parts[parts.length - 1];

      material = await tx.rawMaterial.findFirst({
        where: {
          materialName: { contains: materialName },
          diameter: diameter
        }
      });
    }
  }

  if (!material) {
    throw new Error(`Material with code/barcode ${validatedData.materialCode} not found`);
  }

  // Create stock count record (this would be a new model in production)
  // For now, update the material stock and create a receipt
  const difference = validatedData.countedKg - Number(material.availableKg);

  if (Math.abs(difference) > 0.001) { // Only create receipt if there's a difference
    await tx.materialReceipt.create({
      data: {
        materialId: material.id,
        kgReceived: difference,
        reference: `STOCK-COUNT-${Date.now()}`,
        notes: `Stock count adjustment. Location: ${validatedData.location || 'Unknown'}. Notes: ${validatedData.notes || 'None'}`
      }
    });

    await tx.rawMaterial.update({
      where: { id: material.id },
      data: {
        availableKg: validatedData.countedKg,
        batchNumber: validatedData.batchNumber || material.batchNumber,
        updatedAt: new Date()
      }
    });
  }
}

// Generate Excel template for import
export async function generateImportTemplate(importType: 'suppliers' | 'customers' | 'materials' | 'stock-counts'): Promise<Buffer> {
  const user = await requireAuth();

  if (user.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only admins can generate import templates');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Import Template');

  // Add headers based on import type
  switch (importType) {
    case 'suppliers':
      worksheet.columns = [
        { header: 'Supplier Code*', key: 'code', width: 15 },
        { header: 'Supplier Name*', key: 'name', width: 25 },
        { header: 'Contact Name', key: 'contactName', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Tax ID', key: 'taxId', width: 15 }
      ];
      break;

    case 'customers':
      worksheet.columns = [
        { header: 'Customer Code*', key: 'code', width: 15 },
        { header: 'Customer Name*', key: 'name', width: 25 },
        { header: 'Contact Name', key: 'contactName', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Tax ID', key: 'taxId', width: 15 }
      ];
      break;

    case 'materials':
      worksheet.columns = [
        { header: 'Material Name*', key: 'materialName', width: 25 },
        { header: 'Diameter*', key: 'diameter', width: 15 },
        { header: 'Supplier Code', key: 'supplierCode', width: 15 },
        { header: 'Available KG', key: 'availableKg', width: 15 },
        { header: 'Reserved KG', key: 'reservedKg', width: 15 }
      ];
      break;

    case 'stock-counts':
      worksheet.columns = [
        { header: 'Material Code/Barcode*', key: 'materialCode', width: 25 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Counted KG*', key: 'countedKg', width: 15 },
        { header: 'Batch Number', key: 'batchNumber', width: 15 },
        { header: 'Notes', key: 'notes', width: 30 }
      ];
      break;
  }

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4A90E2' }
  };

  // Add sample data row
  switch (importType) {
    case 'suppliers':
      worksheet.addRow(['SUP001', 'ABC Steel Corp', 'John Doe', 'john@abcsteel.com', '+1234567890', '123 Steel St, City, State', 'TAX123456']);
      break;
    case 'customers':
      worksheet.addRow(['CUST001', 'XYZ Manufacturing', 'Jane Smith', 'jane@xyz.com', '+1234567890', '456 Industry Rd, City, State', 'TAX789012']);
      break;
    case 'materials':
      worksheet.addRow(['High-Tensile Steel', 'M12', 'SUP001', 1000, 0]);
      break;
    case 'stock-counts':
      worksheet.addRow(['RM-HIGM12-001', 'Warehouse A', 950, 'BATCH001', 'Physical count']);
      break;
  }

  // Add instructions sheet
  const instructionsSheet = workbook.addWorksheet('Instructions');
  instructionsSheet.getColumn(1).width = 50;

  instructionsSheet.addRow(['IMPORT INSTRUCTIONS']);
  instructionsSheet.getRow(1).font = { bold: true, size: 14 };

  instructionsSheet.addRow(['']);
  instructionsSheet.addRow(['1. Do not modify the header row']);
  instructionsSheet.addRow(['2. Fields marked with * are required']);
  instructionsSheet.addRow(['3. Ensure data types match the expected format']);
  instructionsSheet.addRow(['4. Codes must be unique across the system']);
  instructionsSheet.addRow(['5. Email addresses must be valid if provided']);
  instructionsSheet.addRow(['6. Numeric fields should not contain text']);
  instructionsSheet.addRow(['']);

  switch (importType) {
    case 'suppliers':
      instructionsSheet.addRow(['SUPPLIER IMPORT REQUIREMENTS:']);
      instructionsSheet.addRow(['- Supplier Code: Unique identifier (max 20 chars)']);
      instructionsSheet.addRow(['- Supplier Name: Full company name']);
      instructionsSheet.addRow(['- Email: Must be valid email format or empty']);
      break;
    case 'customers':
      instructionsSheet.addRow(['CUSTOMER IMPORT REQUIREMENTS:']);
      instructionsSheet.addRow(['- Customer Code: Unique identifier (max 20 chars)']);
      instructionsSheet.addRow(['- Customer Name: Full company name']);
      instructionsSheet.addRow(['- Email: Must be valid email format or empty']);
      break;
    case 'materials':
      instructionsSheet.addRow(['RAW MATERIAL IMPORT REQUIREMENTS:']);
      instructionsSheet.addRow(['- Material Name: Descriptive name']);
      instructionsSheet.addRow(['- Diameter: Size specification (e.g., M12, 1/2")']);
      instructionsSheet.addRow(['- Supplier Code: Must match existing supplier']);
      instructionsSheet.addRow(['- Available/Reserved KG: Numeric values only']);
      break;
    case 'stock-counts':
      instructionsSheet.addRow(['STOCK COUNT IMPORT REQUIREMENTS:']);
      instructionsSheet.addRow(['- Material Code: Barcode or "Name-Diameter" format']);
      instructionsSheet.addRow(['- Counted KG: Physical count result']);
      instructionsSheet.addRow(['- Location: Warehouse location identifier']);
      break;
  }

  return (await workbook.xlsx.writeBuffer()) as any;
}