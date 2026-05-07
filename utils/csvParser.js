import { parse } from 'csv-parse/sync';
import XLSX from 'xlsx';

/**
 * Parse CSV or Excel file and return array of objects
 */
export const parseFile = (buffer, filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    return parseCSV(buffer);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(buffer);
  } else {
    throw new Error('Unsupported file format. Please use CSV or Excel files.');
  }
};

/**
 * Parse CSV file
 */
const parseCSV = (buffer) => {
  try {
    const records = parse(buffer.toString(), {
      columns: true,
      skip_empty_lines: false, // PRESERVE ALL ROWS - don't skip empty lines
      trim: true,
      cast: true,
      relax_column_count: true // Allow rows with different column counts
    });
    // DO NOT FILTER - Return ALL rows as-is to preserve sequence and ensure no rows are missed
    // Even completely empty rows will be processed and stored with N/A values
    return records || [];
  } catch (error) {
    throw new Error(`CSV parsing error: ${error.message}`);
  }
};

/**
 * Parse Excel file
 */
const parseExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    // Parse with defval: null to preserve empty cells, and blankRows: false to include all rows
    const records = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false,
      blankrows: true // Include blank rows to preserve all rows from Excel
    });
    // DO NOT FILTER - Return ALL rows as-is to preserve sequence and ensure no rows are missed
    return records || [];
  } catch (error) {
    throw new Error(`Excel parsing error: ${error.message}`);
  }
};

/**
 * Generate CSV content from data array
 */
export const generateCSV = (data, headers) => {
  if (!data || data.length === 0) {
    return '';
  }
  
  // Use provided headers or get from first object
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create CSV rows
  const rows = data.map(row => {
    return csvHeaders.map(header => {
      const value = row[header];
      // Handle null/undefined and escape quotes
      if (value == null) return '';
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
  });
  
  // Combine headers and rows
  const csvContent = [
    csvHeaders.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
};

/**
 * Generate Excel file buffer from data array
 */
export const generateExcel = (data, headers, sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers || []]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
  
  const excelHeaders = headers || Object.keys(data[0]);
  const worksheet = XLSX.utils.json_to_sheet(data, { header: excelHeaders });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

