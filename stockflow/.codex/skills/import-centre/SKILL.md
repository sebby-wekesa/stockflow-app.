---
name: import-centre
description: Use this skill when fixing CSV or Excel imports for products, consumables, raw materials, stock, customers, suppliers, or inventory in StockFlow.
---

# Import Centre Skill

StockFlow imports CSV and Excel data into tenant-scoped ERP tables.

## Import Debugging Steps

1. Identify selected import type.
2. Confirm the uploaded file matches that type.
3. Inspect headers exactly as parsed.
4. Remove empty rows.
5. Normalize unnecessary quotation marks.
6. Trim spaces from headers and cell values.
7. Validate required columns before database insert.
8. Return helpful row-level errors.

## Common Error

### No usable rows found

Likely causes:

- wrong sheet type selected
- headers do not match expected columns
- all rows are empty after parsing
- CSV has malformed quotes
- parser skipped rows because required fields were missing

Fix by logging:

- detected headers
- row count before cleaning
- row count after cleaning
- first 5 normalized rows
- validation errors by row

## CSV Cleaning Rules

- Remove unnecessary surrounding quotes.
- Preserve commas inside valid quoted values.
- Convert blank strings to `null` only where allowed.
- Do not silently drop required fields.
- Keep original row numbers for error reporting.

## Import Safety

- Validate tenant organization before insert.
- Do not import data across organizations.
- Use transactions for multi-row imports where possible.
- Store import batch status and failed row details when supported.
