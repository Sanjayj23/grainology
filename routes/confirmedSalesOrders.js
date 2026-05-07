import express from 'express';
import ConfirmedSalesOrder from '../models/ConfirmedSalesOrder.js';
import User from '../models/User.js';
import CommodityMaster from '../models/CommodityMaster.js';
import VarietyMaster from '../models/VarietyMaster.js';
import WarehouseMaster from '../models/WarehouseMaster.js';
import LocationMaster from '../models/LocationMaster.js';
import { authenticate, requireAdmin, isAdminRole, isSuperAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { parseFile } from '../utils/csvParser.js';
import { getMappedValue, parseDate, parseNumeric, toNA, getAvailableColumns } from '../utils/columnMapper.js';

const router = express.Router();

// Test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Confirmed sales orders route is working' });
});

// All routes require authentication
router.use(authenticate);

// Get all confirmed sales orders (admin only) - exclude trashed
router.get('/', requireAdmin, async (req, res) => {
  try {
    const orders = await ConfirmedSalesOrder.find({ trash: { $ne: true } })
      .populate('customer_id', 'name email mobile_number')
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get confirmed sales orders error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch confirmed sales orders' });
  }
});

// Get confirmed sales orders for a specific customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { customerId } = req.params;
    const isAdminUser = isAdminRole(user);

    // Non-admin users can only see their own orders
    if (!isAdminUser && customerId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const query = {
      customer_id: customerId,
      trash: { $ne: true }
    };
    if (!isAdminUser) {
      query.approval_status = 'approved';
    }

    const orders = await ConfirmedSalesOrder.find(query)
      .populate('customer_id', 'name email mobile_number')
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get customer confirmed sales orders error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch confirmed sales orders' });
  }
});

// Get confirmed sales order by ID (exclude trashed)
router.get('/:id', async (req, res) => {
  try {
    const order = await ConfirmedSalesOrder.findOne({
      _id: req.params.id,
      trash: { $ne: true }
    })
      .populate('customer_id', 'name email mobile_number')
      .populate('created_by', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Confirmed sales order not found' });
    }

    const user = await User.findById(req.userId);
    const isAdminUser = isAdminRole(user);
    // Non-admin users can only see their own orders
    if (!isAdminUser && order.customer_id._id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!isAdminUser && order.approval_status !== 'approved') {
      return res.status(404).json({ error: 'Confirmed sales order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get confirmed sales order error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch confirmed sales order' });
  }
});

// Create confirmed sales order (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    console.log('Creating confirmed sales order:', req.body);
    
    // If customer_id is not provided, find customer by seller_name
    let customerId = req.body.customer_id;
    if (!customerId && req.body.seller_name) {
      const customer = await User.findOne({ 
        name: req.body.seller_name,
        role: { $ne: 'admin' }
      });
      if (!customer) {
        return res.status(404).json({ error: `Customer not found with seller name: ${req.body.seller_name}` });
      }
      customerId = customer._id;
    }
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID or Seller Name is required' });
    }

    const orderData = {
      ...req.body,
      customer_id: customerId,
      created_by: req.userId,
      unique_id: req.body.unique_id || `SO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      declined_reason: ''
    };

    // Calculate total deduction
    const otherDeductionsTotal = (orderData.other_deductions || []).reduce((sum, ded) => sum + (ded.amount || 0), 0);
    const totalDeduction = 
      (orderData.deduction_amount_hlw || 0) +
      (orderData.deduction_amount_moi_bdoi || 0) +
      otherDeductionsTotal;

    // Calculate net amount
    orderData.total_deduction = totalDeduction;
    orderData.net_amount = (orderData.gross_amount || 0) - totalDeduction;

    const order = new ConfirmedSalesOrder(orderData);
    await order.save();
    await order.populate('customer_id', 'name email mobile_number');
    await order.populate('created_by', 'name email');
    res.status(201).json(order);
  } catch (error) {
    console.error('Create confirmed sales order error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }
    res.status(500).json({ error: error.message || 'Failed to create confirmed sales order' });
  }
});

// Update confirmed sales order (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const order = await ConfirmedSalesOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Confirmed sales order not found' });
    }
    if (order.approval_status === 'approved' && req.user?.role === 'admin') {
      return res.status(403).json({ error: 'Cannot edit after Super Admin approval' });
    }

    const approvalFields = ['approval_status', 'approved_by', 'approved_at', 'declined_reason'];
    const approvalUpdateRequested = approvalFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    );
    if (approvalUpdateRequested && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only Super Admin can approve or decline confirmed sales orders' });
    }
    if (approvalUpdateRequested && isSuperAdmin(req.user) && order.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    // Recalculate deductions if amounts changed
    if (req.body.gross_amount !== undefined || 
        req.body.deduction_amount_hlw !== undefined ||
        req.body.deduction_amount_moi_bdoi !== undefined ||
        req.body.other_deductions !== undefined) {
      const otherDeductions = req.body.other_deductions !== undefined ? req.body.other_deductions : (order.other_deductions || []);
      const otherDeductionsTotal = otherDeductions.reduce((sum, ded) => sum + (ded.amount || 0), 0);
      
      const totalDeduction = 
        (req.body.deduction_amount_hlw !== undefined ? req.body.deduction_amount_hlw : (order.deduction_amount_hlw || 0)) +
        (req.body.deduction_amount_moi_bdoi !== undefined ? req.body.deduction_amount_moi_bdoi : (order.deduction_amount_moi_bdoi || 0)) +
        otherDeductionsTotal;

      const grossAmount = req.body.gross_amount !== undefined ? req.body.gross_amount : order.gross_amount;
      req.body.total_deduction = totalDeduction;
      req.body.net_amount = grossAmount - totalDeduction;
    }

    if (!isSuperAdmin(req.user)) {
      req.body.approval_status = 'pending';
      req.body.approved_by = null;
      req.body.approved_at = null;
      req.body.declined_reason = '';
    } else if (Object.prototype.hasOwnProperty.call(req.body, 'approval_status')) {
      if (req.body.approval_status === 'approved') {
        req.body.approved_by = req.userId;
        req.body.approved_at = new Date();
        req.body.declined_reason = '';
      } else if (req.body.approval_status === 'declined') {
        const declinedReason = String(req.body.declined_reason || '').trim();
        if (!declinedReason) {
          return res.status(400).json({ error: 'Decline reason is required' });
        }
        req.body.approved_by = null;
        req.body.approved_at = null;
        req.body.declined_reason = declinedReason;
      } else if (req.body.approval_status === 'pending') {
        req.body.approved_by = null;
        req.body.approved_at = null;
        req.body.declined_reason = '';
      }
    }

    const updatedOrder = await ConfirmedSalesOrder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('customer_id', 'name email mobile_number')
      .populate('created_by', 'name email');

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update confirmed sales order error:', error);
    res.status(500).json({ error: error.message || 'Failed to update confirmed sales order' });
  }
});

// Approve/decline confirmed sales order (super admin only)
router.patch('/:id/approval', requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Super Admin access required' });
    }

    const { status, reason } = req.body;
    if (!['approved', 'declined'].includes(String(status))) {
      return res.status(400).json({ error: 'status must be approved or declined' });
    }

    const order = await ConfirmedSalesOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Confirmed sales order not found' });
    }
    if (order.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    const declinedReason = String(reason || '').trim();
    if (status === 'declined' && !declinedReason) {
      return res.status(400).json({ error: 'Decline reason is required' });
    }

    const updatePayload = {
      approval_status: status,
      approved_by: status === 'approved' ? req.userId : null,
      approved_at: status === 'approved' ? new Date() : null,
      declined_reason: status === 'declined' ? declinedReason : ''
    };

    const updatedOrder = await ConfirmedSalesOrder.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    )
      .populate('customer_id', 'name email mobile_number')
      .populate('created_by', 'name email');

    res.json(updatedOrder);
  } catch (error) {
    console.error('Confirmed sales order approval update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update approval status' });
  }
});

// Delete confirmed sales order (admin only) - soft delete (trash in MongoDB, not shown to user)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const existingOrder = await ConfirmedSalesOrder.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Confirmed sales order not found' });
    }
    if (existingOrder.approval_status === 'approved' && req.user?.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete after Super Admin approval' });
    }

    const order = await ConfirmedSalesOrder.findByIdAndUpdate(
      req.params.id,
      { $set: { trash: true } },
      { new: true }
    );
    res.json({ message: 'Confirmed sales order deleted successfully' });
  } catch (error) {
    console.error('Delete confirmed sales order error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete confirmed sales order' });
  }
});

// Get available columns from uploaded file (for column mapping UI)
router.post('/bulk-upload/preview', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the file
    const records = parseFile(req.file.buffer, req.file.originalname);
    
    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'File is empty or invalid' });
    }

    // Get available columns and first few rows for preview
    const columns = getAvailableColumns(records);
    const previewRows = records.slice(0, 5); // First 5 rows for preview

    res.json({
      success: true,
      columns: columns,
      previewRows: previewRows,
      totalRows: records.length
    });
  } catch (error) {
    console.error('Preview file error:', error);
    res.status(500).json({ 
      error: 'Preview failed',
      message: error.message || 'Failed to preview file'
    });
  }
});

// Bulk upload confirmed sales orders from CSV/Excel (admin only)
router.post('/bulk-upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse column mappings from request body (if provided)
    let columnMapping = {};
    try {
      if (req.body.columnMapping) {
        columnMapping = typeof req.body.columnMapping === 'string' 
          ? JSON.parse(req.body.columnMapping) 
          : req.body.columnMapping;
      }
    } catch (e) {
      console.warn('Failed to parse column mapping, using defaults:', e.message);
    }

    // Parse the file
    const records = parseFile(req.file.buffer, req.file.originalname);
    
    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'File is empty or invalid' });
    }

    const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true;
    const toNAVal = (v) => {
      if (v === null || v === undefined || v === '' || v === '-' || String(v).trim() === '') return '';
      return String(v).trim();
    };
    const getVal = (record, mapping, fallbacks, def = '') => {
      if (mapping && record[mapping] !== undefined && record[mapping] !== null && record[mapping] !== '') return String(record[mapping]).trim();
      for (const name of fallbacks) {
        if (record[name] !== undefined && record[name] !== null && record[name] !== '') return String(record[name]).trim();
      }
      return def;
    };
    const buildDuplicateKey = (record) => {
      const state = toNAVal(getVal(record, columnMapping.state, ['State', 'state'], ''));
      const seller = toNAVal(getVal(record, columnMapping.seller_name, ['Seller Name', 'seller_name', 'Seller'], ''));
      const location = toNAVal(getVal(record, columnMapping.location, ['Location', 'location'], ''));
      const warehouse = toNAVal(getVal(record, columnMapping.warehouse_name, ['Warehouse Name', 'warehouse_name', 'Warehouse'], ''));
      const dateVal = getVal(record, columnMapping.transaction_date, ['Date of Transaction', 'transaction_date', 'Date'], '');
      const parsedDateVal = dateVal ? parseDate(dateVal) : { date: '', isValid: true };
      const date = parsedDateVal && parsedDateVal.isValid ? (parsedDateVal.date || '') : '';
      const vehicle = toNAVal(getVal(record, columnMapping.vehicle_no, ['Vehicle No.', 'vehicle_no', 'Vehicle Number'], ''));
      const netWt = getVal(record, columnMapping.net_weight_mt, ['Net Weight in MT', 'net_weight_mt', 'Net Weight'], '');
      const netWtNorm = netWt === '' ? '' : String(parseNumeric(netWt, 0));
      return [state, seller, location, warehouse, date, vehicle, netWtNorm].join('|');
    };
    const keyToRowIndices = new Map();
    records.forEach((record, i) => {
      const key = buildDuplicateKey(record);
      if (!keyToRowIndices.has(key)) keyToRowIndices.set(key, []);
      keyToRowIndices.get(key).push(i + 2);
    });
    const duplicateRowNumbers = [];
    keyToRowIndices.forEach((rowNums) => {
      if (rowNums.length > 1) duplicateRowNumbers.push(...rowNums.slice(1));
    });
    const duplicateCount = duplicateRowNumbers.length;
    const hasDuplicates = duplicateCount > 0;
    if (hasDuplicates && !skipDuplicates) {
      return res.status(200).json({
        success: false,
        requiresDuplicateChoice: true,
        duplicateCount,
        totalRows: records.length,
        duplicateRowNumbers: duplicateRowNumbers.sort((a, b) => a - b),
        message: `${duplicateCount} duplicate row(s) found. Choose "Skip duplicates" to keep first occurrence only, or "Keep all" to upload all rows.`,
      });
    }
    const duplicateSkippedCount = skipDuplicates && hasDuplicates ? duplicateCount : 0;

    // Fetch master data for validation
    const [commodities, varieties, warehouses, allCustomers] = await Promise.all([
      CommodityMaster.find({ is_active: true }),
      VarietyMaster.find({ is_active: true }),
      WarehouseMaster.find({ is_active: true }),
      User.find({ role: { $ne: 'admin' } })
    ]);

    const normalize = (value) => (value === null || value === undefined ? '' : String(value).trim().toUpperCase());

    const validCommodities = new Set(commodities.map((c) => normalize(c.name)));
    const validVarieties = new Map(); // normalized commodity -> Set of normalized varieties
    varieties.forEach((v) => {
      const commodityKey = normalize(v.commodity_name);
      if (!validVarieties.has(commodityKey)) {
        validVarieties.set(commodityKey, new Set());
      }
      validVarieties.get(commodityKey).add(normalize(v.variety_name));
    });
    const validWarehouses = new Set(warehouses.map((w) => normalize(w.name)));
    const validStates = new Set([
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
      'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
      'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
      'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ]);
    const locationDocs = await LocationMaster.find({ is_active: true }).select('name').lean();
    const validLocations = new Set(locationDocs.map((l) => normalize(l.name)));
    const validSellerNames = new Set(allCustomers.map(c => c.name));

    // Transform and validate records - NO VALIDATION for CSV uploader (only warnings)
    const orders = [];
    const errors = [];
    const warnings = []; // For CSV uploader, use warnings instead of errors
    const validationErrors = [];

    // Helper function to sanitize numeric fields in an order object (prevent NaN)
    const sanitizeNumericFields = (order) => {
      const numericFields = [
        'gross_weight_mt', 'tare_weight_mt', 'no_of_bags', 'net_weight_mt', 'rate_per_mt', 'gross_amount',
        'hlw_wheat', 'excess_hlw', 'deduction_amount_hlw', 'moisture_moi', 'excess_moisture',
        'bdoi', 'excess_bdoi', 'moi_bdoi', 'weight_deduction_kg', 'deduction_amount_moi_bdoi',
        'net_amount', 'total_deduction'
      ];
      
      const sanitized = { ...order };
      numericFields.forEach(field => {
        if (sanitized[field] === null || sanitized[field] === undefined || isNaN(sanitized[field])) {
          sanitized[field] = 0;
        } else if (typeof sanitized[field] === 'string') {
          // Remove commas and currency symbols before parsing
          let cleanValue = sanitized[field].replace(/,/g, '').replace(/[₹$€£¥\s]/g, '');
          const parsed = parseFloat(cleanValue);
          sanitized[field] = isNaN(parsed) ? 0 : parsed;
        }
      });
      
      // Special handling for no_of_bags (must be integer)
      if (sanitized.no_of_bags !== undefined) {
        if (typeof sanitized.no_of_bags === 'string') {
          // Remove commas before parsing
          let cleanValue = sanitized.no_of_bags.replace(/,/g, '').replace(/[₹$€£¥\s]/g, '');
          const bags = parseInt(cleanValue);
          sanitized.no_of_bags = isNaN(bags) ? 0 : bags;
        } else {
          const bags = parseInt(sanitized.no_of_bags);
          sanitized.no_of_bags = isNaN(bags) ? 0 : bags;
        }
      }
      
      // Sanitize other_deductions array
      if (sanitized.other_deductions && Array.isArray(sanitized.other_deductions)) {
        sanitized.other_deductions = sanitized.other_deductions.map(ded => {
          let amount = ded.amount;
          if (typeof amount === 'string') {
            amount = parseFloat(amount.replace(/,/g, '').replace(/[₹$€£¥\s]/g, ''));
          }
          return {
            amount: isNaN(amount) ? 0 : amount,
            remarks: ded.remarks || ''
          };
        });
      }
      
      return sanitized;
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
      const rowErrors = [];

      if (skipDuplicates && duplicateRowNumbers.includes(rowNum)) {
        continue;
      }

      try {
        // Map CSV/Excel columns to order fields using column mapping or fallback to default names
        // Parse date using column mapping
        const transactionDateValue = getMappedValue(
          record,
          columnMapping.transaction_date,
          ['Date of Transaction', 'transaction_date', 'Transaction Date', 'Date'],
          ''
        );
        const trimmedDate = String(transactionDateValue || '').trim();
        let transactionDate = '';
        if (trimmedDate) {
          const ddmmyyyy = /^\d{2}\/\d{2}\/\d{4}$/;
          if (!ddmmyyyy.test(trimmedDate)) {
            rowErrors.push(`Row ${rowNum}: Transaction Date \"${transactionDateValue}\" is invalid. Please use DD/MM/YYYY format (dots or dashes are not allowed).`);
          } else {
            const parsed = parseDate(transactionDateValue);
            transactionDate = parsed.date;
            if (!parsed.isValid) {
              rowErrors.push(`Row ${rowNum}: Transaction Date \"${transactionDateValue}\" is invalid. Please use DD/MM/YYYY format.`);
            }
          }
        }

        // Parse other deductions from columns Other Deduction 1-9 (single remark at order level only)
        const otherDeductions = [];
        for (let j = 1; j <= 9; j++) {
          const dedMappingKey = `other_deduction_${j}`;
          const dedAmount = getMappedValue(
            record,
            columnMapping[dedMappingKey],
            [`Other Deduction ${j}`, `other_deduction_${j}`, `Other Deduction ${j} Amount`],
            ''
          );
          
          if (dedAmount && dedAmount !== '-' && dedAmount !== 'Not Available' && String(dedAmount).trim() !== '') {
            const amount = parseNumeric(dedAmount);
            if (amount > 0) {
              otherDeductions.push({
                amount: amount,
                remarks: '' // use only final Remarks column
              });
            }
          }
        }

        // Get customer from CSV - Seller Name column only
        const customerName = toNA(getMappedValue(
          record,
          columnMapping.seller_name,
          ['Seller Name', 'seller_name', 'Seller'],
          ''
        ));
        
        // Seller must exist in master data (match against name, trade_name, or business_name; case/space insensitive)
        const sellerKey = normalize(customerName);
        const customer = allCustomers.find((c) => {
          const names = [c.name, c.trade_name, c.business_name];
          return names.some((n) => normalize(n) === sellerKey && sellerKey !== 'N/A');
        });
        if (!customer) {
          rowErrors.push(`Row ${rowNum}: Seller "${customerName}" is not present in master data. Please add the seller before uploading.`);
        }

        // Get all fields from CSV using column mapping with fallbacks
        const state = toNA(getMappedValue(record, columnMapping.state, ['State', 'state'], ''));
        const sellerName = toNA(getMappedValue(record, columnMapping.seller_name, ['Seller Name', 'seller_name', 'Seller'], customerName));
        const location = toNA(getMappedValue(record, columnMapping.location, ['Location', 'location'], ''));
        const warehouseName = toNA(getMappedValue(record, columnMapping.warehouse_name, ['Warehouse Name', 'warehouse_name', 'Warehouse'], ''));
        const commodity = toNA(getMappedValue(record, columnMapping.commodity, ['Commodity', 'commodity'], 'Paddy'));
        const variety = toNA(getMappedValue(record, columnMapping.variety, ['Variety', 'variety'], ''));

        // Master data validation (fail fast for the requested fields)
        const normalizedLocation = normalize(location);
        if (location && location !== 'N/A' && !validLocations.has(normalizedLocation)) {
          rowErrors.push(`Row ${rowNum}: Location \"${location}\" is not present in master data. Please add the location before uploading.`);
        }

        const normalizedWarehouse = normalize(warehouseName);
        if (warehouseName && warehouseName !== 'N/A' && !validWarehouses.has(normalizedWarehouse)) {
          rowErrors.push(`Row ${rowNum}: Warehouse \"${warehouseName}\" is not present in master data. Please add the warehouse before uploading.`);
        }

        const normalizedCommodity = normalize(commodity);
        if (commodity && commodity !== 'N/A' && !validCommodities.has(normalizedCommodity)) {
          rowErrors.push(`Row ${rowNum}: Commodity \"${commodity}\" is not present in master data. Please add the commodity before uploading.`);
        }

        const normalizedVariety = normalize(variety);
        if (variety && variety !== 'N/A') {
          if (!commodity || commodity === 'N/A') {
            rowErrors.push(`Row ${rowNum}: Variety \"${variety}\" provided but Commodity is missing; please add a valid commodity and variety in master data.`);
          }
          const commodityVarieties = validVarieties.get(normalizedCommodity);
          if (!commodityVarieties || !commodityVarieties.has(normalizedVariety)) {
            rowErrors.push(`Row ${rowNum}: Variety \"${variety}\" is not present for commodity \"${commodity}\" in master data. Please add it before uploading.`);
          }
        }

        // If any validations failed for this row, collect and move on to next row
        if (rowErrors.length > 0) {
          validationErrors.push(...rowErrors);
          continue;
        }

        // Non-blocking checks that can stay warnings
        if (state && !validStates.has(state)) {
          warnings.push(`Row ${rowNum}: State \"${state}\" not in master list, but accepting as-is.`);
        }

        if (sellerName && sellerName !== customerName) {
          warnings.push(`Row ${rowNum}: Seller Name \"${sellerName}\" differs from Customer \"${customerName}\", but accepting as-is.`);
        }

        const orderData = {
          customer_id: customer._id,
          invoice_number: `INV-${Date.now()}-${i}-${rowNum}`, // Auto-generate invoice number (internal)
          unique_id: `SO-${Date.now()}-${i}-${rowNum}`,
          transaction_date: transactionDate,
          state: state,
          seller_name: sellerName,
          location: location,
          warehouse_name: warehouseName,
          chamber_no: toNA(getMappedValue(record, columnMapping.chamber_no, ['Chamber No.', 'Chamber No', 'chamber_no', 'Chamber'], '')),
          commodity: commodity,
          variety: variety,
          gate_pass_no: toNA(getMappedValue(record, columnMapping.gate_pass_no, ['Gate Pass No.', 'Gate Pass No', 'gate_pass_no', 'Gate Pass'], '')),
          vehicle_no: toNA(getMappedValue(record, columnMapping.vehicle_no, ['Vehicle No.', 'Vehicle No', 'vehicle_no', 'Vehicle Number', 'Truck No'], '')),
          weight_slip_no: toNA(getMappedValue(record, columnMapping.weight_slip_no, ['Weight Slip No.', 'Weight Slip No', 'weight_slip_no', 'Weight Slip'], '')),
          gross_weight_mt: parseNumeric(getMappedValue(record, columnMapping.gross_weight_mt, ['Gross Weight in MT (Vehicle + Goods)', 'Gross Weight (MT)', 'gross_weight_mt', 'Gross Weight'], 0)),
          tare_weight_mt: parseNumeric(getMappedValue(record, columnMapping.tare_weight_mt, ['Tare Weight of Vehicle', 'Tare Weight (MT)', 'tare_weight_mt', 'Tare Weight'], 0)),
          no_of_bags: parseInt(getMappedValue(record, columnMapping.no_of_bags, ['No. of Bags', 'No of Bags', 'no_of_bags', 'Bags'], 0) || 0),
          net_weight_mt: parseNumeric(getMappedValue(record, columnMapping.net_weight_mt, ['Net Weight in MT', 'Net Weight (MT)', 'net_weight_mt', 'Net Weight'], 0)),
          rate_per_mt: parseNumeric(getMappedValue(record, columnMapping.rate_per_mt, ['Rate Per MT', 'Rate per MT', 'rate_per_mt', 'Rate'], 0)),
          gross_amount: parseNumeric(getMappedValue(record, columnMapping.gross_amount, ['Gross Amount', 'gross_amount'], 0)),
          // Quality parameters
          hlw_wheat: parseNumeric(getMappedValue(record, columnMapping.hlw_wheat, ['HLW (Hectolitre Weight) in Wheat', 'HLW', 'hlw_wheat', 'Hectolitre Weight'], 0)),
          excess_hlw: parseNumeric(getMappedValue(record, columnMapping.excess_hlw, ['Excess HLW', 'excess_hlw'], 0)),
          deduction_amount_hlw: parseNumeric(getMappedValue(record, columnMapping.deduction_amount_hlw, ['Deduction Amount Rs. (HLW)', 'Deduction Amount HLW', 'deduction_amount_hlw'], 0)),
          moisture_moi: parseNumeric(getMappedValue(record, columnMapping.moisture_moi, ['Moisture (MOI)', 'Moisture', 'moisture_moi'], 0)),
          excess_moisture: parseNumeric(getMappedValue(record, columnMapping.excess_moisture, ['Excess Moisture', 'excess_moisture'], 0)),
          bdoi: parseNumeric(getMappedValue(record, columnMapping.bdoi, ['Broken, Damage, Discolour, Immature (BDOI)', 'BDOI', 'bdoi'], 0)),
          excess_bdoi: parseNumeric(getMappedValue(record, columnMapping.excess_bdoi, ['Excess BDOI', 'excess_bdoi'], 0)),
          moi_bdoi: parseNumeric(getMappedValue(record, columnMapping.moi_bdoi, ['MOI+BDOI', 'moi_bdoi'], 0)),
          weight_deduction_kg: parseNumeric(getMappedValue(record, columnMapping.weight_deduction_kg, ['Weight Deduction in KG (MOI+BDOI)', 'Weight Deduction (KG)', 'weight_deduction_kg'], 0)),
          deduction_amount_moi_bdoi: parseNumeric(getMappedValue(record, columnMapping.deduction_amount_moi_bdoi, ['Deduction Amount Rs. (MOI+BDOI)', 'Deduction Amount MOI+BDOI', 'deduction_amount_moi_bdoi'], 0)),
          other_deductions: otherDeductions,
          quality_report: {},
          delivery_location: toNA(getMappedValue(record, columnMapping.delivery_location, ['Delivery Location', 'delivery_location'], '')),
          remarks: toNA(getMappedValue(record, columnMapping.remarks, ['Remarks', 'remarks'], '')),
          // Net Amount will be calculated below
          created_by: req.userId
        };

        // Calculate total deduction - use mapped value if provided, otherwise calculate from all deductions
        // Calculate total deduction from all deduction sources (HLW + MOI+BDOI + All Other Deductions)
        const otherDeductionsTotal = otherDeductions.reduce((sum, ded) => sum + (ded.amount || 0), 0);
        orderData.total_deduction = orderData.deduction_amount_hlw + orderData.deduction_amount_moi_bdoi + otherDeductionsTotal;

        // Calculate net_amount if not provided or is 0
        const mappedNetAmount = parseNumeric(getMappedValue(record, columnMapping.net_amount, ['Net Amount', 'net_amount'], null));
        if (mappedNetAmount !== null && mappedNetAmount !== 0 && !isNaN(mappedNetAmount)) {
          orderData.net_amount = mappedNetAmount;
        } else {
          // Calculate net_amount from gross_amount and total_deduction
          orderData.net_amount = (orderData.gross_amount || 0) - (orderData.total_deduction || 0);
        }

        // No validation for CSV uploader - ensure required fields have defaults
        if (!orderData.vehicle_no || orderData.vehicle_no === 'N/A') {
          orderData.vehicle_no = `VEH-${rowNum}`;
        }
        if (!orderData.net_weight_mt || orderData.net_weight_mt <= 0) {
          orderData.net_weight_mt = 0;
        }
        if (!orderData.rate_per_mt || orderData.rate_per_mt <= 0) {
          orderData.rate_per_mt = 0;
        }

        // Sanitize all numeric fields before adding to orders
        orders.push(sanitizeNumericFields(orderData));
      } catch (error) {
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Master data validation failed',
        message: 'Some rows use Seller, Location, Warehouse, Commodity, or Variety values that do not exist in master data.',
        errors: validationErrors,
        totalRows: records.length,
        invalidRows: validationErrors.length
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'File contains invalid data',
        message: 'Errors were found while preparing rows; nothing was saved.',
        errors,
        totalRows: records.length,
        invalidRows: errors.length
      });
    }

    if (orders.length === 0) {
      return res.status(400).json({ 
        error: 'No valid orders found in file',
        errors: errors
      });
    }

    // Insert orders in batches to handle silent failures
    let savedOrders = [];
    let insertErrors = [];
    let successCount = 0;
    let failCount = 0;
    
    console.log(`Starting to insert ${orders.length} sales orders...`);
    
    const batchSize = 100;
    for (let batchStart = 0; batchStart < orders.length; batchStart += batchSize) {
      const batch = orders.slice(batchStart, batchStart + batchSize);
      
      try {
        const batchResult = await ConfirmedSalesOrder.insertMany(batch, { 
          ordered: false,
          rawResult: false
        });
        
        savedOrders.push(...batchResult);
        successCount += batchResult.length;
        
        // Check if all documents were inserted
        if (batchResult.length < batch.length) {
          const failedCount = batch.length - batchResult.length;
          console.log(`Sales Batch ${Math.floor(batchStart / batchSize) + 1}: ${batchResult.length} inserted, ${failedCount} failed silently`);
          
          const insertedInvoiceNumbers = new Set(batchResult.map(doc => doc.invoice_number));
          
          for (let j = 0; j < batch.length; j++) {
            const order = batch[j];
            const rowNum = batchStart + j + 2;
            
            if (insertedInvoiceNumbers.has(order.invoice_number)) {
              continue;
            }
            
            try {
              // Sanitize before individual insert
              const sanitizedOrder = sanitizeNumericFields(order);
              const savedOrder = await ConfirmedSalesOrder.create(sanitizedOrder);
              savedOrders.push(savedOrder);
              successCount++;
            } catch (individualError) {
              // Try with more aggressive sanitization
              try {
                const fallbackOrder = sanitizeNumericFields({
                  ...order,
                  invoice_number: `${order.invoice_number}-RETRY-${Date.now()}-${rowNum}`,
                  remarks: `[RETRY: ${individualError.message}] ${order.remarks || ''}`.trim()
                });
                const savedFallback = await ConfirmedSalesOrder.create(fallbackOrder);
                savedOrders.push(savedFallback);
                successCount++;
                console.log(`Row ${rowNum}: Saved with fallback after error: ${individualError.message}`);
              } catch (fallbackError) {
                failCount++;
                insertErrors.push(`Row ${rowNum}: ${individualError.message || 'Insert failed'}`);
                console.log(`Failed to create fallback order for row ${rowNum}: ${fallbackError.message}`);
              }
            }
          }
        } else {
          console.log(`Sales Batch ${Math.floor(batchStart / batchSize) + 1}: Inserted ${batchResult.length} orders`);
        }
      } catch (batchError) {
        console.log(`Sales batch insert failed, trying individual inserts...`);
        for (let j = 0; j < batch.length; j++) {
          const order = batch[j];
          const rowNum = batchStart + j + 2;
          try {
            // Sanitize before individual insert
            const sanitizedOrder = sanitizeNumericFields(order);
            const savedOrder = await ConfirmedSalesOrder.create(sanitizedOrder);
            savedOrders.push(savedOrder);
            successCount++;
          } catch (individualError) {
            // Try fallback with aggressive sanitization
            try {
              const fallbackOrder = sanitizeNumericFields({
                ...order,
                invoice_number: `INV-FALLBACK-${Date.now()}-${rowNum}`,
                remarks: `[FALLBACK: ${individualError.message}] ${order.remarks || ''}`.trim()
              });
              const savedFallback = await ConfirmedSalesOrder.create(fallbackOrder);
              savedOrders.push(savedFallback);
              successCount++;
            } catch (fallbackError) {
              failCount++;
              insertErrors.push(`Row ${rowNum}: ${individualError.message || 'Insert failed'}`);
            }
          }
        }
      }
    }
    
    console.log(`Sales insertion complete: ${successCount} succeeded, ${failCount} failed out of ${orders.length} total`);

    const totalInsertIssues = errors.length + insertErrors.length + failCount;
    if (totalInsertIssues > 0 || successCount < orders.length) {
      // Roll back any inserted docs to ensure all-or-nothing
      if (savedOrders.length > 0) {
        await ConfirmedSalesOrder.deleteMany({ _id: { $in: savedOrders.map((d) => d._id) } });
      }
      return res.status(400).json({
        success: false,
        error: 'Upload failed',
        message: 'At least one row failed validation or insertion. No rows were saved.',
        errors: [...errors, ...insertErrors],
        totalRows: orders.length,
        invalidRows: totalInsertIssues
      });
    }
    
    const dupMsg = duplicateSkippedCount > 0 ? ` (${duplicateSkippedCount} duplicate row(s) skipped)` : '';
    res.json({
      success: true,
      message: `Successfully uploaded ${savedOrders.length} confirmed sales orders${dupMsg}${warnings.length > 0 ? ` (${warnings.length} warnings)` : ''}`,
      count: savedOrders.length,
      totalRows: orders.length,
      duplicateSkipped: duplicateSkippedCount,
      savedRows: savedOrders.length,
      warnings: warnings.length > 0 ? warnings : undefined,
      orders: savedOrders.slice(0, 10) // Return first 10 for preview
    });
  } catch (error) {
    console.error('Bulk upload confirmed sales orders error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message || 'Failed to process file'
    });
  }
});

export default router;
