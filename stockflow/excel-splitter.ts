import { Workbook } from 'exceljs';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

// Configuration
const INPUT_FILE = process.argv[2] || './input.xlsx';
const OUTPUT_DIR = process.argv[3] || './output';

async function splitExcelSheets() {
  try {
    // Check if input file exists
    if (!existsSync(INPUT_FILE)) {
      console.error(`Input file not found: ${INPUT_FILE}`);
      process.exit(1);
    }

    // Create output directory if it doesn't exist
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`Created output directory: ${OUTPUT_DIR}`);
    }

    // Load the workbook
    const workbook = new Workbook();
    await workbook.xlsx.readFile(INPUT_FILE);
    
    console.log(`Loaded workbook: ${INPUT_FILE}`);
    console.log(`Number of sheets: ${workbook.worksheets.length}`);

    // Process each worksheet
    for (const worksheet of workbook.worksheets) {
      // Create a new workbook for each sheet
      const newWorkbook = new Workbook();
      const newWorksheet = newWorkbook.addWorksheet(worksheet.name);

      // Copy data from original worksheet to new worksheet
      worksheet.eachRow((row, rowNumber) => {
        newWorksheet.getRow(rowNumber).values = row.values;
      });

      // Copy column widths and properties if needed
      worksheet.eachColumn((col, colNumber) => {
        newWorksheet.getColumn(colNumber).width = col.width;
      });

      // Generate output filename
      const inputBasename = basename(INPUT_FILE, extname(INPUT_FILE));
      const outputFilename = `${inputBasename}_${worksheet.name}.xlsx`;
      const outputPath = join(OUTPUT_DIR, outputFilename);

      // Save the new workbook
      await newWorkbook.xlsx.writeFile(outputPath);
      console.log(`Saved sheet "${worksheet.name}" to: ${outputPath}`);
    }

    console.log('Excel sheet splitting completed successfully!');
  } catch (error) {
    console.error('Error splitting Excel sheets:', error);
    process.exit(1);
  }
}

// Run the function
splitExcelSheets();