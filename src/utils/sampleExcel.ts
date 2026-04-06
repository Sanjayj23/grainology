import ExcelJS from 'exceljs';

export interface MasterListForExcel {
  locations: string[];
  warehouses: string[];
  commodities: string[];
  customers: string[];
  varieties?: string[]; // optional, flat list (used when no varietiesByCommodityKey)
  states?: string[]; // optional; if not provided, default Indian states are used
  /** State → location names for dependent Location dropdown (State → Location). */
  locationsByState?: Record<string, string[]>;
  /** Location key (name with spaces removed) → warehouse names for dependent Warehouse dropdown (Location → Warehouse). */
  warehousesByLocationKey?: Record<string, string[]>;
  /** Commodity key (name with spaces removed) → variety names for dependent Variety dropdown (Commodity → Variety). */
  varietiesByCommodityKey?: Record<string, string[]>;
}

/** Column index (1-based). Use either masterListRow (fixed list) or formula (dependent list e.g. INDIRECT). */
export interface DropdownColumn {
  columnIndex: number;
  masterListRow?: number;
  /** Excel formula for dependent dropdown, e.g. INDIRECT("Locations_"&SUBSTITUTE(B2," ","")). */
  formula?: string;
}

/** Get Excel column letter from 1-based column index (1=A, 2=B, ..., 27=AA). */
function getColumnLetter(colIndex: number): string {
  let s = '';
  let i = colIndex;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s || 'A';
}

const DEFAULT_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/** Safe key for Excel defined names: remove spaces. */
function excelKey(s: string): string {
  return String(s || '').replace(/\s+/g, '');
}

function normalizeUpperText(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeUpperList(values: string[] = []): string[] {
  return values
    .map((value) => normalizeUpperText(value))
    .filter(Boolean);
}

/**
 * Generate sample Excel file with Master List sheet + Sample Data sheet.
 * Dropdowns: State (fixed); Location by State; Warehouse by Location; Commodity (fixed); Variety by Commodity; Customer (fixed).
 * When locationsByState/warehousesByLocationKey/varietiesByCommodityKey are provided, dependent dropdowns use INDIRECT.
 */
export async function generateSampleExcel(
  options: {
    headers: string[];
    sampleRows: (string | number)[][];
    masterList: MasterListForExcel;
    sheetName?: string;
    filename?: string;
    dropdownColumns?: DropdownColumn[];
  }
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Grainology';
  workbook.created = new Date();

  const ml = options.masterList;
  const states = normalizeUpperList((ml.states && ml.states.length > 0) ? ml.states : DEFAULT_STATES);
  const commodities = normalizeUpperList(ml.commodities);
  const varieties = normalizeUpperList(ml.varieties || []);
  const varietiesByCommodityKey = ml.varietiesByCommodityKey
    ? Object.fromEntries(
        Object.entries(ml.varietiesByCommodityKey).map(([commodityKey, commodityVarieties]) => [
          excelKey(normalizeUpperText(commodityKey)),
          normalizeUpperList(commodityVarieties || []),
        ])
      )
    : undefined;
  const useCascaded = !!(ml.locationsByState && ml.warehousesByLocationKey);

  const upperCaseColumnIndexes = new Set(
    options.headers
      .map((header, index) => {
        const normalizedHeader = normalizeUpperText(header);
        return normalizedHeader === 'STATE' || normalizedHeader === 'COMMODITY' || normalizedHeader === 'VARIETY'
          ? index
          : -1;
      })
      .filter((index) => index >= 0)
  );

  const normalizedSampleRows = options.sampleRows.map((row) =>
    row.map((cell, index) => (upperCaseColumnIndexes.has(index) ? normalizeUpperText(cell) : cell))
  );

  // Build Master List sheet (add as second sheet so Sample Data can be first)
  const dataSheetName = options.sheetName || 'Sample Data';
  const dataSheet = workbook.addWorksheet(dataSheetName, {
    state: 'visible',
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
  });
  const headerRow = dataSheet.addRow(options.headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });
  normalizedSampleRows.forEach((row) => dataSheet.addRow(row));
  options.headers.forEach((h, i) => {
    const col = dataSheet.getColumn(i + 1);
    col.width = Math.min(36, Math.max(14, String(h).length + 2));
  });

  const masterSheet = workbook.addWorksheet('Master List', { state: 'visible' });
  masterSheet.getColumn(1).width = 28;
  for (let c = 2; c <= 26; c++) masterSheet.getColumn(c).width = 18;
  masterSheet.addRow(['Use only these values in the Sample Data sheet.']);
  masterSheet.getRow(1).getCell(1).font = { bold: true };
  masterSheet.addRow([]);

  let currentRow = 3;
  const rowMap: Record<string, number> = {}; // e.g. States -> 3, Locations_Bihar -> 4

  if (useCascaded && ml.locationsByState) {
    // Row: States (India)
    masterSheet.addRow(['States (India)', ...states]);
    rowMap['States'] = currentRow++;
    // Single "Locations" row with ALL locations (fixed list - works in all Excel, no INDIRECT)
    const allLocations = [...new Set((Object.values(ml.locationsByState) as string[][]).flat())];
    masterSheet.addRow(['Locations', ...allLocations.length ? allLocations : ml.locations]);
    rowMap['Locations'] = currentRow++;
    // Single "Warehouses" row with ALL warehouses (fixed list - works in all Excel, no INDIRECT)
    const allWarehouses = ml.warehousesByLocationKey
      ? [...new Set((Object.values(ml.warehousesByLocationKey) as string[][]).flat())]
      : ml.warehouses;
    masterSheet.addRow(['Warehouses', ...(allWarehouses.length ? allWarehouses : ml.warehouses)]);
    rowMap['Warehouses'] = currentRow++;
  } else {
    masterSheet.addRow(['Locations', ...ml.locations]);
    rowMap['Locations'] = currentRow++;
    masterSheet.addRow(['Warehouses', ...ml.warehouses]);
    rowMap['Warehouses'] = currentRow++;
  }

  masterSheet.addRow(['Commodities', ...commodities]);
  rowMap['Commodities'] = currentRow++;
  masterSheet.addRow(['Customers / Sellers', ...ml.customers]);
  rowMap['Customers'] = currentRow++;

  if (useCascaded && varietiesByCommodityKey) {
    // Single "Varieties" row with ALL varieties (fixed list - works in all Excel)
    const allVarieties = [...new Set((Object.values(varietiesByCommodityKey) as string[][]).flat())];
    masterSheet.addRow(['Varieties', ...(allVarieties.length ? allVarieties : varieties)]);
    rowMap['Varieties'] = currentRow++;
  } else if (varieties.length > 0) {
    masterSheet.addRow(['Varieties (sample)', ...varieties]);
    rowMap['Varieties'] = currentRow++;
  }

  if (!useCascaded) {
    masterSheet.addRow([]);
    masterSheet.addRow(['States (India)', ...states]);
    rowMap['States'] = currentRow++;
  }

  // Defined names for dropdowns (dependent and fixed)
  const masterName = "'Master List'";
  if (useCascaded && rowMap['States'] != null) {
    workbook.definedNames.add('States', `${masterName}!$B$${rowMap['States']}:$Z$${rowMap['States']}`);
  }
  if (rowMap['Commodities'] != null) {
    workbook.definedNames.add('Commodities', `${masterName}!$B$${rowMap['Commodities']}:$Z$${rowMap['Commodities']}`);
  }
  if (rowMap['Customers'] != null) {
    workbook.definedNames.add('Customers', `${masterName}!$B$${rowMap['Customers']}:$Z$${rowMap['Customers']}`);
  }
  if (useCascaded && ml.locationsByState) {
    for (const stateName of states) {
      const key = 'Locations_' + excelKey(stateName);
      const r = rowMap[key];
      if (r != null) workbook.definedNames.add(key, `${masterName}!$B$${r}:$Z$${r}`);
    }
    if (ml.warehousesByLocationKey) {
      for (const locKey of Object.keys(ml.warehousesByLocationKey)) {
        const key = 'Warehouses_' + locKey;
        const r = rowMap[key];
        if (r != null) workbook.definedNames.add(key, `${masterName}!$B$${r}:$Z$${r}`);
      }
    }
  }
  if (useCascaded && varietiesByCommodityKey) {
    for (const commKey of Object.keys(varietiesByCommodityKey)) {
      const key = 'Varieties_' + commKey;
      const r = rowMap[key];
      if (r != null) workbook.definedNames.add(key, `${masterName}!$B$${r}:$Z$${r}`);
    }
  }

  // Dropdown validations: use direct range ref for fixed lists (reliable in all Excel), formula with = for named/INDIRECT
  const dropdownColumns = options.dropdownColumns || [];
  const maxDataRow = Math.max(2 + normalizedSampleRows.length, 300);
  const resolveFormula = (dc: DropdownColumn): string | null => {
    if (dc.masterListRow != null) {
      return `='Master List'!$B$${dc.masterListRow}:$Z$${dc.masterListRow}`;
    }
    if (!dc.formula) return null;
    const f = dc.formula.trim();
    if (f === 'States' && rowMap['States'] != null) {
      return `='Master List'!$B$${rowMap['States']}:$Z$${rowMap['States']}`;
    }
    if (f === 'Commodities' && rowMap['Commodities'] != null) {
      return `='Master List'!$B$${rowMap['Commodities']}:$Z$${rowMap['Commodities']}`;
    }
    if (f === 'Customers' && rowMap['Customers'] != null) {
      return `='Master List'!$B$${rowMap['Customers']}:$Z$${rowMap['Customers']}`;
    }
    if (f === 'Locations' && rowMap['Locations'] != null) {
      return `='Master List'!$B$${rowMap['Locations']}:$Z$${rowMap['Locations']}`;
    }
    if (f === 'Warehouses' && rowMap['Warehouses'] != null) {
      return `='Master List'!$B$${rowMap['Warehouses']}:$Z$${rowMap['Warehouses']}`;
    }
    if (f === 'Varieties' && rowMap['Varieties'] != null) {
      return `='Master List'!$B$${rowMap['Varieties']}:$Z$${rowMap['Varieties']}`;
    }
    if (f.startsWith('INDIRECT') || f.startsWith('=')) {
      return f.startsWith('=') ? f : '=' + f;
    }
    return '=' + f;
  };
  for (const dc of dropdownColumns) {
    const formula = resolveFormula(dc);
    if (!formula) continue;
    for (let r = 2; r <= maxDataRow; r++) {
      const cell = dataSheet.getCell(r, dc.columnIndex);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: 'Invalid value',
        error: 'Please select a value from the dropdown (use only values from Master List sheet).',
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Trigger download of Excel file in browser
 */
export function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
