/**
 * Utility to map CSV/Excel columns to database fields using user-provided mappings
 */

/**
 * Get value from record using column mapping or fallback to default column names
 * @param {Object} record - The CSV record
 * @param {Object} columnMapping - User-provided column mapping (e.g., { invoice_number: 'Invoice No' })
 * @param {Array} fallbackNames - Array of possible column names to try
 * @param {*} defaultValue - Default value if not found
 * @returns {*} The mapped value
 */
const normalizeColumnName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/[()]/g, '')
    .trim();

const findMatchingKey = (record, targetColumn) => {
  if (!record || !targetColumn) return null;

  if (Object.prototype.hasOwnProperty.call(record, targetColumn)) {
    return targetColumn;
  }

  const normalizedTarget = normalizeColumnName(targetColumn);
  if (!normalizedTarget) return null;

  return Object.keys(record).find((key) => normalizeColumnName(key) === normalizedTarget) || null;
};

export const getMappedValue = (record, columnMapping, fallbackNames = [], defaultValue = '') => {
  // First try the mapped column name
  if (columnMapping) {
    const mappedColumn = findMatchingKey(record, columnMapping);
    if (mappedColumn && record[mappedColumn] !== undefined && record[mappedColumn] !== null && record[mappedColumn] !== '') {
      return record[mappedColumn];
    }
  }
  
  // Then try fallback names
  for (const name of fallbackNames) {
    const matchedName = findMatchingKey(record, name);
    if (matchedName && record[matchedName] !== undefined && record[matchedName] !== null && record[matchedName] !== '') {
      return record[matchedName];
    }
  }
  
  return defaultValue;
};

/**
 * Parse date from various formats, returning both the normalized value and a validity flag.
 * Accepts: DD/MM/YY, DD/MM/YYYY, YYYY-MM-DD, or any string parsable by Date().
 * Blank / N/A values are treated as today's date and considered valid.
 * @param {string} dateValue - Date value from CSV
 * @returns {{ date: string|null, isValid: boolean }} Normalized date (YYYY-MM-DD) and validity
 */
export const parseDate = (dateValue) => {
  const today = new Date().toISOString().split('T')[0];

  if (!dateValue || dateValue === '' || dateValue === 'N/A' || String(dateValue).trim() === '') {
    return { date: today, isValid: true };
  }

  const raw = String(dateValue).trim();

  // Handle DD/MM/YY or DD/MM/YYYY format
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      const candidate = `${year}-${month}-${day}`;
      const parsed = new Date(candidate);
      return isNaN(parsed.getTime())
        ? { date: null, isValid: false }
        : { date: parsed.toISOString().split('T')[0], isValid: true };
    }
    return { date: null, isValid: false };
  }

  // Handle YYYY-MM-DD format
  if (raw.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime())
      ? { date: null, isValid: false }
      : { date: parsed.toISOString().split('T')[0], isValid: true };
  }

  // Try to parse as Date object (ISO, RFC2822, etc.)
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed.toISOString().split('T')[0], isValid: true };
  }

  return { date: null, isValid: false };
};

/**
 * Parse numeric value, handling various formats including Indian number format with commas
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed number
 */
export const parseNumeric = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '' || value === '-' || 
      value === 'Not Available' || value === 'Not Applicable' || String(value).trim() === '') {
    return defaultValue;
  }
  
  // Convert to string and remove all commas (handles both Indian and Western number formats)
  // Indian format: 1,54,026.00 or 12,34,567.89
  // Western format: 1,540,026.00 or 12,345,678.90
  let cleanValue = String(value).trim();
  
  // Remove all commas (thousands separators)
  cleanValue = cleanValue.replace(/,/g, '');
  
  // Remove any currency symbols or spaces
  cleanValue = cleanValue.replace(/[₹$€£¥\s]/g, '');
  
  // Parse as float and preserve precision (round to 4 decimal places)
  const parsed = parseFloat(cleanValue);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  // Round to 4 decimal places to preserve precision
  return Math.round(parsed * 10000) / 10000;
};

/**
 * Convert value to N/A if empty
 * @param {*} value - Value to convert
 * @returns {string} Value or 'N/A'
 */
export const toNA = (value) => {
  if (value === null || value === undefined || value === '' || value === '-' || 
      value === 'Not Available' || String(value).trim() === '') {
    return 'N/A';
  }
  return String(value).trim();
};

/**
 * Get all available column names from the first record
 * @param {Array} records - Array of CSV records
 * @returns {Array} Array of column names
 */
export const getAvailableColumns = (records) => {
  if (!records || records.length === 0) {
    return [];
  }
  return Object.keys(records[0] || {});
};
