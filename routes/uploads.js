import express from 'express';
import upload from '../middleware/upload.js';
import { parseFile, generateCSV, generateExcel } from '../utils/csvParser.js';
import Offer from '../models/Offer.js';
import Order from '../models/Order.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SaleOrder from '../models/SaleOrder.js';
import QualityParameter from '../models/QualityParameter.js';
import MandiPrice from '../models/MandiPrice.js';
import LogisticsShipment from '../models/LogisticsShipment.js';
import WeatherData from '../models/WeatherData.js';
import SupplyTransaction from '../models/SupplyTransaction.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware - all routes require authentication
router.use(authenticate);

// Generic upload handler
const handleUpload = async (req, res, model, transformFn, userId = null) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the file
    const records = parseFile(req.file.buffer, req.file.originalname);
    
    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'File is empty or invalid' });
    }

    // Transform records
    const transformedRecords = records.map(record => {
      const transformed = transformFn(record);
      if (userId) {
        transformed.user_id = userId;
      }
      return transformed;
    });

    // Save to database
    const savedRecords = await model.insertMany(transformedRecords, { ordered: false });
    
    res.json({
      success: true,
      message: `Successfully uploaded ${savedRecords.length} records`,
      count: savedRecords.length,
      records: savedRecords
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message || 'Failed to process file'
    });
  }
};

// Upload Offers
router.post('/offers', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, Offer, (record) => ({
    seller_id: req.userId,
    commodity: record.commodity || record.Commodity,
    variety: record.variety || record.Variety,
    quantity_mt: parseFloat(record.quantity_mt || record['Quantity (MT)'] || record.quantity || 0),
    price_per_quintal: parseFloat(record.price_per_quintal || record['Price per Quintal'] || record.price || 0),
    location: record.location || record.Location,
    quality_parameters: record.quality_parameters ? JSON.parse(record.quality_parameters) : {},
    delivery_timeline_days: parseInt(record.delivery_timeline_days || record['Delivery Days'] || 0),
    status: record.status || 'active'
  }));
});

// Upload Orders
router.post('/orders', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, Order, (record) => ({
    offer_id: record.offer_id || record['Offer ID'],
    buyer_id: req.userId,
    quantity_mt: parseFloat(record.quantity_mt || record['Quantity (MT)'] || record.quantity || 0),
    final_price_per_quintal: parseFloat(record.final_price_per_quintal || record['Price per Quintal'] || record.price || 0),
    status: record.status || 'Pending Approval',
    deduction_amount: parseFloat(record.deduction_amount || record['Deduction Amount'] || 0)
  }));
});

// Upload Purchase Orders
router.post('/purchase-orders', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, PurchaseOrder, (record) => ({
    buyer_id: req.userId,
    commodity: record.commodity || record.Commodity,
    variety: record.variety || record.Variety,
    quantity_mt: parseFloat(record.quantity_mt || record['Quantity (MT)'] || record.quantity || 0),
    expected_price_per_quintal: parseFloat(record.expected_price_per_quintal || record['Expected Price'] || 0),
    delivery_location: record.delivery_location || record['Delivery Location'],
    delivery_timeline_days: parseInt(record.delivery_timeline_days || record['Delivery Days'] || 0),
    payment_terms: record.payment_terms || record['Payment Terms'] || 'Against Delivery',
    status: record.status || 'Open'
  }));
});

// Upload Sale Orders
router.post('/sale-orders', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, SaleOrder, (record) => ({
    seller_id: req.userId,
    commodity: record.commodity || record.Commodity,
    variety: record.variety || record.Variety,
    quantity_mt: parseFloat(record.quantity_mt || record['Quantity (MT)'] || record.quantity || 0),
    price_per_quintal: parseFloat(record.price_per_quintal || record['Price per Quintal'] || record.price || 0),
    delivery_location: record.delivery_location || record['Delivery Location'],
    delivery_timeline_days: parseInt(record.delivery_timeline_days || record['Delivery Days'] || 0),
    payment_terms: record.payment_terms || record['Payment Terms'] || 'Against Delivery',
    status: record.status || 'Open'
  }));
});

// Upload Quality Parameters
router.post('/quality', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, QualityParameter, (record) => ({
    order_id: record.order_id || record['Order ID'],
    moisture_content: parseFloat(record.moisture_content || record['Moisture Content'] || 0),
    foreign_matter: parseFloat(record.foreign_matter || record['Foreign Matter'] || 0),
    damaged_grains: parseFloat(record.damaged_grains || record['Damaged Grains'] || 0),
    other_parameters: record.other_parameters ? JSON.parse(record.other_parameters) : {}
  }));
});

// Upload Mandi Prices
router.post('/mandi', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, MandiPrice, (record) => ({
    commodity: record.commodity || record.Commodity,
    variety: record.variety || record.Variety,
    mandi_name: record.mandi_name || record['Mandi Name'],
    location: record.location || record.Location,
    price_per_quintal: parseFloat(record.price_per_quintal || record['Price per Quintal'] || record.price || 0),
    date: record.date ? new Date(record.date) : new Date()
  }));
});

// Upload Logistics Shipments
router.post('/logistics-shipments', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, LogisticsShipment, (record) => ({
    order_id: record.order_id || record['Order ID'],
    transporter_name: record.transporter_name || record['Transporter Name'],
    vehicle_number: record.vehicle_number || record['Vehicle Number'],
    driver_name: record.driver_name || record['Driver Name'],
    driver_contact: record.driver_contact || record['Driver Contact'],
    pickup_location: record.pickup_location || record['Pickup Location'],
    delivery_location: record.delivery_location || record['Delivery Location'],
    pickup_date: record.pickup_date ? new Date(record.pickup_date) : null,
    expected_delivery_date: record.expected_delivery_date ? new Date(record.expected_delivery_date) : null,
    status: record.status || 'pending'
  }));
});

// Upload Weather Data
router.post('/weather', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, WeatherData, (record) => ({
    location: record.location || record.Location,
    latitude: parseFloat(record.latitude || record.Latitude || 0),
    longitude: parseFloat(record.longitude || record.Longitude || 0),
    date: record.date ? new Date(record.date) : new Date(),
    temperature_min: parseFloat(record.temperature_min || record['Min Temperature'] || 0),
    temperature_max: parseFloat(record.temperature_max || record['Max Temperature'] || 0),
    humidity: parseFloat(record.humidity || record.Humidity || 0),
    rainfall: parseFloat(record.rainfall || record.Rainfall || 0),
    wind_speed: parseFloat(record.wind_speed || record['Wind Speed'] || 0),
    weather_condition: record.weather_condition || record['Weather Condition']
  }));
});

// Upload Supply Transactions
router.post('/supply-transactions', upload.single('file'), async (req, res) => {
  await handleUpload(req, res, SupplyTransaction, (record) => {
    // Parse date - handle multiple formats
    let transactionDate = new Date();
    if (record['Date of Transaction'] || record.date_of_transaction || record.transaction_date) {
      const dateStr = record['Date of Transaction'] || record.date_of_transaction || record.transaction_date;
      transactionDate = new Date(dateStr);
      if (isNaN(transactionDate.getTime())) {
        // Try DD/MM/YYYY format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          transactionDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
    }

    return {
      transaction_date: transactionDate,
      state: record.State || record.state || 'Bihar',
      supplier_name: record['Supplier Name'] || record.supplier_name,
      location: record.Location || record.location,
      warehouse_name: record['Warehouse Name'] || record.warehouse_name,
      chamber_no: record['Chamber No.'] || record.chamber_no,
      commodity: record.Commodity || record.commodity,
      variety: record.Variety || record.variety,
      gate_pass_no: record['Gate Pass No.'] || record.gate_pass_no,
      vehicle_no: record['Vehicle No.'] || record.vehicle_no,
      weight_slip_no: record['Weight Slip No.'] || record.weight_slip_no,
      gross_weight_mt: parseFloat(record['Gross Weight in MT (Vehicle + Goods)'] || record.gross_weight_mt || 0) || null,
      tare_weight_mt: parseFloat(record['Tare Weight of Vehicle'] || record.tare_weight_mt || 0) || null,
      no_of_bags: parseInt(record['No. of Bags'] || record.no_of_bags || 0) || null,
      net_weight_mt: parseFloat(record['Net Weight in MT'] || record.net_weight_mt || 0),
      rate_per_mt: parseFloat(record['Rate Per MT'] || record.rate_per_mt || 0),
      gross_amount: parseFloat(record['Gross Amount'] || record.gross_amount || 0),
      hlw_wheat: parseFloat(record['HLW (Hectolitre Weight) in Wheat'] || record.hlw_wheat || 0) || null,
      excess_hlw: parseFloat(record['Excess HLW'] || record.excess_hlw || 0) || null,
      deduction_amount_hlw: parseFloat(record['Deduction Amount Rs. (HLW)'] || record.deduction_amount_hlw || 0) || null,
      moisture_moi: parseFloat(record['Moisture (MOI)'] || record.moisture_moi || 0) || null,
      excess_moisture: parseFloat(record['Excess Moisture'] || record.excess_moisture || 0) || null,
      bddi: parseFloat(record['Broken, Dammage, Discolour, Immature (BDDI)'] || record.bddi || 0) || null,
      excess_bddi: parseFloat(record['Excess BDDI'] || record.excess_bddi || 0) || null,
      moi_bddi: parseFloat(record['MOI+BDDI'] || record.moi_bddi || 0) || null,
      weight_deduction_kg: parseFloat(record['Weight Deduction in KG'] || record.weight_deduction_kg || 0) || null,
      deduction_amount_moi_bddi: parseFloat(record['Deduction Amount Rs. (MOI+BDDI)'] || record.deduction_amount_moi_bddi || 0) || null,
      other_deductions: [
        parseFloat(record['Other Deduction 1'] || 0) || 0,
        parseFloat(record['Other Deduction 2'] || 0) || 0,
        parseFloat(record['Other Deduction 3'] || 0) || 0,
        parseFloat(record['Other Deduction 4'] || 0) || 0,
        parseFloat(record['Other Deduction 5'] || 0) || 0,
        parseFloat(record['Other Deduction 6'] || 0) || 0,
        parseFloat(record['Other Deduction 7'] || 0) || 0,
        parseFloat(record['Other Deduction 8'] || 0) || 0,
        parseFloat(record['Other Deduction 9'] || 0) || 0,
        parseFloat(record['Other Deduction 10'] || 0) || 0,
      ].filter(d => d > 0),
      net_amount: parseFloat(record['Net Amount'] || record.net_amount || 0),
      remarks: record.Remarks || record.remarks || ''
    };
  }, req.userId);
});

// Generate sample CSV/Excel files
router.get('/sample/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const format = req.query.format || 'csv'; // csv or excel
    
    let sampleData = [];
    let headers = [];
    let filename = '';

    switch (type) {
      case 'offers':
        headers = ['Commodity', 'Variety', 'Quantity (MT)', 'Price per Quintal', 'Location', 'Delivery Days', 'Status'];
        sampleData = [
          { 'Commodity': 'Wheat', 'Variety': 'HD-3086', 'Quantity (MT)': 100, 'Price per Quintal': 2200, 'Location': 'Mumbai', 'Delivery Days': 7, 'Status': 'active' },
          { 'Commodity': 'Rice', 'Variety': 'Basmati', 'Quantity (MT)': 50, 'Price per Quintal': 3500, 'Location': 'Delhi', 'Delivery Days': 5, 'Status': 'active' }
        ];
        filename = 'sample_offers';
        break;

      case 'orders':
        headers = ['Offer ID', 'Quantity (MT)', 'Price per Quintal', 'Status', 'Deduction Amount'];
        sampleData = [
          { 'Offer ID': 'offer_id_here', 'Quantity (MT)': 10, 'Price per Quintal': 2200, 'Status': 'Pending Approval', 'Deduction Amount': 0 }
        ];
        filename = 'sample_orders';
        break;

      case 'purchase-orders':
        headers = ['Commodity', 'Variety', 'Quantity (MT)', 'Expected Price', 'Delivery Location', 'Delivery Days', 'Payment Terms', 'Status'];
        sampleData = [
          { 'Commodity': 'Wheat', 'Variety': 'HD-3086', 'Quantity (MT)': 50, 'Expected Price': 2100, 'Delivery Location': 'Mumbai', 'Delivery Days': 7, 'Payment Terms': 'Against Delivery', 'Status': 'Open' }
        ];
        filename = 'sample_purchase_orders';
        break;

      case 'sale-orders':
        headers = ['Commodity', 'Variety', 'Quantity (MT)', 'Price per Quintal', 'Delivery Location', 'Delivery Days', 'Payment Terms', 'Status'];
        sampleData = [
          { 'Commodity': 'Rice', 'Variety': 'Basmati', 'Quantity (MT)': 30, 'Price per Quintal': 3400, 'Delivery Location': 'Delhi', 'Delivery Days': 5, 'Payment Terms': 'Advance', 'Status': 'Open' }
        ];
        filename = 'sample_sale_orders';
        break;

      case 'quality':
        headers = ['Order ID', 'Moisture Content', 'Foreign Matter', 'Damaged Grains'];
        sampleData = [
          { 'Order ID': 'order_id_here', 'Moisture Content': 12.5, 'Foreign Matter': 0.5, 'Damaged Grains': 2.0 }
        ];
        filename = 'sample_quality';
        break;

      case 'mandi':
        headers = ['Commodity', 'Variety', 'Mandi Name', 'Location', 'Price per Quintal', 'Date'];
        sampleData = [
          { 'Commodity': 'Wheat', 'Variety': 'HD-3086', 'Mandi Name': 'APMC Mumbai', 'Location': 'Mumbai', 'Price per Quintal': 2150, 'Date': '2024-12-03' }
        ];
        filename = 'sample_mandi_prices';
        break;

      case 'logistics-shipments':
        headers = ['Order ID', 'Transporter Name', 'Vehicle Number', 'Driver Name', 'Driver Contact', 'Pickup Location', 'Delivery Location', 'Pickup Date', 'Expected Delivery Date', 'Status'];
        sampleData = [
          { 'Order ID': 'order_id_here', 'Transporter Name': 'ABC Transport', 'Vehicle Number': 'MH-01-AB-1234', 'Driver Name': 'John Doe', 'Driver Contact': '9876543210', 'Pickup Location': 'Mumbai', 'Delivery Location': 'Delhi', 'Pickup Date': '2024-12-05', 'Expected Delivery Date': '2024-12-07', 'Status': 'pending' }
        ];
        filename = 'sample_logistics_shipments';
        break;

      case 'weather':
        headers = ['Location', 'Latitude', 'Longitude', 'Date', 'Min Temperature', 'Max Temperature', 'Humidity', 'Rainfall', 'Wind Speed', 'Weather Condition'];
        sampleData = [
          { 'Location': 'Mumbai', 'Latitude': 19.0760, 'Longitude': 72.8777, 'Date': '2024-12-03', 'Min Temperature': 22, 'Max Temperature': 32, 'Humidity': 75, 'Rainfall': 0, 'Wind Speed': 15, 'Weather Condition': 'Partly Cloudy' }
        ];
        filename = 'sample_weather';
        break;

      case 'supply-transactions':
        headers = [
          'Date of Transaction', 'State', 'Supplier Name', 'Location', 'Warehouse Name', 'Chamber No.',
          'Commodity', 'Variety', 'Gate Pass No.', 'Vehicle No.', 'Weight Slip No.',
          'Gross Weight in MT (Vehicle + Goods)', 'Tare Weight of Vehicle', 'No. of Bags', 'Net Weight in MT',
          'Rate Per MT', 'Gross Amount', 'HLW (Hectolitre Weight) in Wheat', 'Excess HLW',
          'Deduction Amount Rs. (HLW)', 'Moisture (MOI)', 'Excess Moisture',
          'Broken, Dammage, Discolour, Immature (BDDI)', 'Excess BDDI', 'MOI+BDDI',
          'Weight Deduction in KG', 'Deduction Amount Rs. (MOI+BDDI)',
          'Other Deduction 1', 'Other Deduction 2', 'Other Deduction 3', 'Other Deduction 4', 'Other Deduction 5',
          'Other Deduction 6', 'Other Deduction 7', 'Other Deduction 8', 'Other Deduction 9', 'Other Deduction 10',
          'Net Amount', 'Remarks'
        ];
        sampleData = [
          {
            'Date of Transaction': '01/05/25',
            'State': 'Bihar',
            'Supplier Name': 'SHRI GANESH ENTERPRISES',
            'Location': 'GULABBAGH',
            'Warehouse Name': 'SATISH KUMAR WAREHOUSE',
            'Chamber No.': '16',
            'Commodity': 'Maize',
            'Variety': 'Hybrid',
            'Gate Pass No.': 'GP001',
            'Vehicle No.': 'BR01AB1234',
            'Weight Slip No.': 'WS001',
            'Gross Weight in MT (Vehicle + Goods)': 6.730,
            'Tare Weight of Vehicle': 2.340,
            'No. of Bags': 220,
            'Net Weight in MT': 4.390,
            'Rate Per MT': 22300,
            'Gross Amount': 97897.00,
            'HLW (Hectolitre Weight) in Wheat': '',
            'Excess HLW': 0.00,
            'Deduction Amount Rs. (HLW)': 0.00,
            'Moisture (MOI)': 13.80,
            'Excess Moisture': 0.00,
            'Broken, Dammage, Discolour, Immature (BDDI)': 4.80,
            'Excess BDDI': 0.00,
            'MOI+BDDI': 0.00,
            'Weight Deduction in KG': 47.20,
            'Deduction Amount Rs. (MOI+BDDI)': 1052.56,
            'Other Deduction 1': '',
            'Other Deduction 2': '',
            'Other Deduction 3': '',
            'Other Deduction 4': '',
            'Other Deduction 5': '',
            'Other Deduction 6': '',
            'Other Deduction 7': '',
            'Other Deduction 8': '',
            'Other Deduction 9': '',
            'Other Deduction 10': '',
            'Net Amount': 96844.44,
            'Remarks': ''
          }
        ];
        filename = 'sample_supply_transactions';
        break;

      default:
        return res.status(400).json({ error: 'Invalid sample type' });
    }

    const upperCaseFields = new Set(['State', 'Commodity', 'Variety']);
    const normalizedSampleData = sampleData.map((row) => {
      const normalizedRow = { ...row };
      for (const fieldName of upperCaseFields) {
        if (normalizedRow[fieldName] !== undefined && normalizedRow[fieldName] !== null) {
          normalizedRow[fieldName] = String(normalizedRow[fieldName]).trim().toUpperCase();
        }
      }
      return normalizedRow;
    });

    if (format === 'excel') {
      const buffer = generateExcel(normalizedSampleData, headers, type);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      const csvContent = generateCSV(normalizedSampleData, headers);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvContent);
    }
  } catch (error) {
    console.error('Generate sample error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate sample file' });
  }
});

export default router;
