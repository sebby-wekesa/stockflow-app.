import { Workbook } from 'exceljs';
import { join } from 'path';

// Create a test Excel file with multiple sheets
async function createTestExcelFile() {
  try {
    const workbook = new Workbook();
    
    // Add first sheet
    const sheet1 = workbook.addWorksheet('Sales_Q1');
    sheet1.columns = [
      { header: 'Product', key: 'product', width: 20 },
      { header: 'January', key: 'jan', width: 15 },
      { header: 'February', key: 'feb', width: 15 },
      { header: 'March', key: 'mar', width: 15 },
      { header: 'Total', key: 'total', width: 15 }
    ];
    
    sheet1.addRow({ product: 'Widget A', jan: 100, feb: 150, mar: 200, total: 450 });
    sheet1.addRow({ product: 'Widget B', jan: 80, feb: 120, mar: 160, total: 360 });
    sheet1.addRow({ product: 'Widget C', jan: 200, feb: 180, mar: 220, total: 600 });
    
    // Add second sheet
    const sheet2 = workbook.addWorksheet('Sales_Q2');
    sheet2.columns = [
      { header: 'Product', key: 'product', width: 20 },
      { header: 'April', key: 'apr', width: 15 },
      { header: 'May', key: 'may', width: 15 },
      { header: 'June', key: 'jun', width: 15 },
      { header: 'Total', key: 'total', width: 15 }
    ];
    
    sheet2.addRow({ product: 'Widget A', apr: 180, may: 200, jun: 220, total: 600 });
    sheet2.addRow({ product: 'Widget B', apr: 140, may: 160, jun: 180, total: 480 });
    sheet2.addRow({ product: 'Widget C', apr: 210, may: 230, jun: 250, total: 690 });
    
    // Add third sheet
    const sheet3 = workbook.addWorksheet('Inventory');
    sheet3.columns = [
      { header: 'Item', key: 'item', width: 20 },
      { header: 'Stock', key: 'stock', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Reorder Level', key: 'reorder', width: 15 }
    ];
    
    sheet3.addRow({ item: 'Widget A', stock: 500, location: 'Warehouse A', reorder: 100 });
    sheet3.addRow({ item: 'Widget B', stock: 300, location: 'Warehouse B', reorder: 75 });
    sheet3.addRow({ item: 'Widget C', stock: 700, location: 'Warehouse A', reorder: 150 });
    
    // Ensure test-input directory exists
    const fs = await import('fs');
    const dir = join(process.cwd(), 'stockflow', 'test-input');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the file
    const filePath = join(dir, 'test-data.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Test Excel file created: ${filePath}`);
    
  } catch (error) {
    console.error('Error creating test Excel file:', error);
    process.exit(1);
  }
}

createTestExcelFile();