import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import offerRoutes from './routes/offers.js';
import orderRoutes from './routes/orders.js';
import qualityRoutes from './routes/quality.js';
import adminRoutes from './routes/admin.js';
import adminOrderRoutes from './routes/adminOrders.js';
import kycRoutes from './routes/kyc.js';
import mandiRoutes from './routes/mandi.js';
import weatherRoutes from './routes/weather.js';
import logisticsRoutes from './routes/logistics.js';
import logisticsShipmentRoutes from './routes/logisticsShipments.js';
import varietyMasterRoutes from './routes/varietyMaster.js';
import commodityMasterRoutes from './routes/commodityMaster.js';
import warehouseMasterRoutes from './routes/warehouseMaster.js';
import locationMasterRoutes from './routes/locationMaster.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import saleOrderRoutes from './routes/saleOrders.js';
import confirmedSalesOrderRoutes from './routes/confirmedSalesOrders.js';
import confirmedPurchaseOrderRoutes from './routes/confirmedPurchaseOrders.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/uploads.js';
import supplyTransactionRoutes from './routes/supplyTransactions.js';
// COMMENTED OUT: Cashfree and Aadhaar verification APIs - using simple registration now
// import cashfreeKYCRoutes from './routes/cashfreeKYC.js';
// import sandboxKYCRoutes from './routes/sandboxKYC.js';
import registrationRoutes from './routes/registration.js';
import analyticsRoutes from './routes/analytics.js';
import documentViewRoutes from './routes/documentView.js';
import siteSettingsRoutes from './routes/siteSettings.js';
import contactInquiryRoutes from './routes/contactInquiries.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DB_RETRY_INTERVAL_MS = Number(process.env.DB_RETRY_INTERVAL_MS || 10000);
let dbRetryTimer = null;

// -----------------------------
// CORS CONFIG
// -----------------------------

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://grainologyagri.com',
  'https://www.grainologyagri.com',
  'https://grainology-rmg1.onrender.com', // backend itself (e.g. server-side fetches)
  process.env.FRONTEND_URL
].filter(Boolean);

console.log("CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin(origin, callback) {
      // allow requests with no origin (mobile apps / curl / postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('❌ Blocked CORS origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// trust render proxy for cookies
app.set('trust proxy', 1);

// handle OPTIONS preflight
app.options('*', cors());

// -----------------------------
// BODY PARSER
// -----------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -----------------------------
// DB CONNECT
// -----------------------------
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in .env file');
      console.error('💡 Please add MONGODB_URI to your .env file');
      console.error('   Example: MONGODB_URI=mongodb://localhost:27017/grainology');
      console.error('   Or MongoDB Atlas: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/grainology');
      if (IS_PRODUCTION) process.exit(1);
      return false;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    if (dbRetryTimer) {
      clearTimeout(dbRetryTimer);
      dbRetryTimer = null;
    }

    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed!');
    console.error('Error:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Check your MONGODB_URI in .env file');
    console.error('   2. If using MongoDB Atlas: Check IP whitelist (allow 0.0.0.0/0 for testing)');
    console.error('   3. If using local MongoDB: Ensure MongoDB service is running');
    console.error('   4. Verify your connection string format');
    console.error('   5. Check your network connection');
    if (IS_PRODUCTION) {
      process.exit(1);
    }
    return false;
  }
};

const scheduleDbReconnect = () => {
  if (dbRetryTimer) return;
  dbRetryTimer = setTimeout(async () => {
    dbRetryTimer = null;
    console.log(`🔁 Retrying MongoDB connection in dev mode...`);
    const connected = await connectDB();
    if (!connected) {
      scheduleDbReconnect();
    }
  }, DB_RETRY_INTERVAL_MS);
};

(async () => {
  const connected = await connectDB();
  if (!connected && !IS_PRODUCTION) {
    console.warn('⚠️  Starting API without DB connection (dev mode).');
    scheduleDbReconnect();
  }
})();

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// -----------------------------
// API ROUTES
// -----------------------------
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/mandi', mandiRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/logistics-shipments', logisticsShipmentRoutes);
app.use('/api/variety-master', varietyMasterRoutes);
app.use('/api/commodity-master', commodityMasterRoutes);
app.use('/api/warehouse-master', warehouseMasterRoutes);
app.use('/api/location-master', locationMasterRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sale-orders', saleOrderRoutes);
app.use('/api/confirmed-sales-orders', confirmedSalesOrderRoutes);
app.use('/api/confirmed-purchase-orders', confirmedPurchaseOrderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/supply-transactions', supplyTransactionRoutes);
// COMMENTED OUT: Cashfree and Aadhaar verification APIs - using simple registration now
// app.use('/api/cashfree/kyc', cashfreeKYCRoutes);
// app.use('/api/sandbox/kyc', sandboxKYCRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/documents', documentViewRoutes);
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/contact-inquiries', contactInquiryRoutes);

// -----------------------------
// ERROR HANDLER
// -----------------------------
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// -----------------------------
// 404
// -----------------------------
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on ${PORT}`);
});
