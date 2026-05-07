import express from 'express';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { sendWelcomeEmail } from '../utils/brevo.js';
import Offer from '../models/Offer.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SaleOrder from '../models/SaleOrder.js';
import ConfirmedSalesOrder from '../models/ConfirmedSalesOrder.js';
import ConfirmedPurchaseOrder from '../models/ConfirmedPurchaseOrder.js';
import LocationMaster from '../models/LocationMaster.js';
import WarehouseMaster from '../models/WarehouseMaster.js';
import { authenticate, requireAdmin, isSuperAdmin } from '../middleware/auth.js';
import { createDocumentViewToken } from '../utils/documentViewToken.js';
import { parseCloudinaryUrl, getSignedDeliveryUrl } from '../utils/cloudinary.js';
import { decryptPassword } from '../utils/passwordVault.js';
import { generateReentryToken, buildReentryUrl } from '../utils/reentryToken.js';

const router = express.Router();

const ADMIN_STATS_CACHE_TTL_MS = Number(process.env.ADMIN_STATS_CACHE_TTL_MS || 20000);
const ADMIN_DASHBOARD_CACHE_TTL_MS = Number(process.env.ADMIN_DASHBOARD_CACHE_TTL_MS || 20000);
const ADMIN_DATA_VERSION_CACHE_TTL_MS = Number(process.env.ADMIN_DATA_VERSION_CACHE_TTL_MS || 5000);

const adminStatsCache = { data: null, version: 0, timestamp: 0 };
const adminDashboardCache = { data: null, version: 0, timestamp: 0 };
const adminVersionCache = { value: 0, timestamp: 0 };

const DATA_VERSION_MODELS = [
  User,
  PurchaseOrder,
  SaleOrder,
  ConfirmedSalesOrder,
  ConfirmedPurchaseOrder,
  LocationMaster,
  WarehouseMaster,
];

async function getLatestUpdatedAtMs(model) {
  const doc = await model
    .findOne({})
    .select('updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  if (!doc?.updatedAt) return 0;
  const value = new Date(doc.updatedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

async function getAdminDataVersion({ force = false } = {}) {
  const now = Date.now();
  if (
    !force &&
    now - adminVersionCache.timestamp < ADMIN_DATA_VERSION_CACHE_TTL_MS
  ) {
    return adminVersionCache.value;
  }

  const timestamps = await Promise.all(DATA_VERSION_MODELS.map((model) => getLatestUpdatedAtMs(model)));
  const dataVersion = Math.max(0, ...timestamps);
  adminVersionCache.value = dataVersion;
  adminVersionCache.timestamp = now;
  return dataVersion;
}

async function getTotalNetAmount(model) {
  const result = await model.aggregate([
    { $match: { trash: { $ne: true } } },
    {
      $project: {
        net_amount_for_sum: {
          $cond: [
            { $ne: ['$net_amount', null] },
            { $ifNull: ['$net_amount', 0] },
            {
              $subtract: [
                { $ifNull: ['$gross_amount', 0] },
                { $ifNull: ['$total_deduction', 0] }
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$net_amount_for_sum' }
      }
    }
  ]);

  return Number(result?.[0]?.total || 0);
}

async function fetchCloudinaryAsset(url) {
  let response = await fetch(url, { method: 'GET' });
  if (response.status === 401) {
    const parsed = parseCloudinaryUrl(url);
    if (parsed) {
      const signedUrl = await getSignedDeliveryUrl(parsed.publicId, parsed.resourceType);
      response = await fetch(signedUrl, { method: 'GET' });
    }
  }
  return response;
}

async function issueReentryLinkForUser(userId) {
  const { token, tokenHash, expiresAt } = generateReentryToken();

  await User.findByIdAndUpdate(userId, {
    $set: {
      reentry_token_hash: tokenHash,
      reentry_token_expires_at: expiresAt,
      reentry_link_generated_at: new Date(),
    }
  });

  return {
    reentryLink: buildReentryUrl(token),
    reentryExpiresAt: expiresAt,
  };
}

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Lightweight version endpoint for frontend polling.
// Frontend can call this endpoint frequently and only refresh heavy data when version changes.
router.get('/data-version', async (req, res) => {
  try {
    const dataVersion = await getAdminDataVersion();
    res.json({
      dataVersion,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get admin data version error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch data version' });
  }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const dataVersion = await getAdminDataVersion();
    const now = Date.now();
    const canUseCache =
      adminStatsCache.data &&
      adminStatsCache.version === dataVersion &&
      now - adminStatsCache.timestamp < ADMIN_STATS_CACHE_TTL_MS;

    if (canUseCache) {
      return res.json({
        ...adminStatsCache.data,
        cached: true,
      });
    }

    const [
      totalUsers,
      totalFarmers,
      totalTraders,
      totalCorporates,
      totalFpos,
      totalMillers,
      totalFinancers,
      totalAdmins,
      totalSuperAdmins,
      verifiedUsers,
      pendingApprovalUsers,
      totalPurchaseOrders,
      totalSaleOrders,
      totalConfirmedSalesOrders,
      totalConfirmedPurchaseOrders,
      locationPendingCount,
      locationApprovedCount,
      locationDeclinedCount,
      warehousePendingCount,
      warehouseApprovedCount,
      warehouseDeclinedCount,
      confirmedSalesPendingCount,
      confirmedPurchasePendingCount,
      confirmedSalesApprovedCount,
      confirmedPurchaseApprovedCount,
      confirmedSalesDeclinedCount,
      confirmedPurchaseDeclinedCount
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'trader' }),
      User.countDocuments({ role: 'corporate' }),
      User.countDocuments({ role: 'fpo' }),
      User.countDocuments({ role: 'miller' }),
      User.countDocuments({ role: 'financer' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'super_admin' }),
      User.countDocuments({ kyc_status: 'verified' }),
      User.countDocuments({ approval_status: 'pending' }),
      PurchaseOrder.countDocuments(),
      SaleOrder.countDocuments(),
      ConfirmedSalesOrder.countDocuments({ trash: { $ne: true } }),
      ConfirmedPurchaseOrder.countDocuments({ trash: { $ne: true } }),
      LocationMaster.countDocuments({ approval_status: 'pending' }),
      LocationMaster.countDocuments({ approval_status: 'approved' }),
      LocationMaster.countDocuments({ approval_status: { $in: ['declined', 'rejected'] } }),
      WarehouseMaster.countDocuments({ approval_status: 'pending' }),
      WarehouseMaster.countDocuments({ approval_status: 'approved' }),
      WarehouseMaster.countDocuments({ approval_status: { $in: ['declined', 'rejected'] } }),
      ConfirmedSalesOrder.countDocuments({ trash: { $ne: true }, approval_status: 'pending' }),
      ConfirmedPurchaseOrder.countDocuments({ trash: { $ne: true }, approval_status: 'pending' }),
      ConfirmedSalesOrder.countDocuments({ trash: { $ne: true }, approval_status: 'approved' }),
      ConfirmedPurchaseOrder.countDocuments({ trash: { $ne: true }, approval_status: 'approved' }),
      ConfirmedSalesOrder.countDocuments({ trash: { $ne: true }, approval_status: { $in: ['declined', 'rejected'] } }),
      ConfirmedPurchaseOrder.countDocuments({ trash: { $ne: true }, approval_status: { $in: ['declined', 'rejected'] } })
    ]);

    const confirmedOrdersPendingCount = confirmedSalesPendingCount + confirmedPurchasePendingCount;
    const confirmedOrdersApprovedCount = confirmedSalesApprovedCount + confirmedPurchaseApprovedCount;
    const confirmedOrdersDeclinedCount = confirmedSalesDeclinedCount + confirmedPurchaseDeclinedCount;

    // Aggregate in DB instead of loading all rows into Node memory.
    const [totalConfirmedSalesAmount, totalConfirmedPurchaseAmount] = await Promise.all([
      getTotalNetAmount(ConfirmedSalesOrder),
      getTotalNetAmount(ConfirmedPurchaseOrder),
    ]);

    const payload = {
      totalUsers,
      totalFarmers,
      totalTraders,
      totalCorporates,
      totalFpos,
      totalMillers,
      totalFinancers,
      totalAdmins,
      totalSuperAdmins,
      verifiedUsers,
      pendingApprovalUsers,
      totalPurchaseOrders,
      totalSaleOrders,
      totalConfirmedSalesOrders,
      totalConfirmedPurchaseOrders,
      locationPendingCount,
      locationApprovedCount,
      locationDeclinedCount,
      warehousePendingCount,
      warehouseApprovedCount,
      warehouseDeclinedCount,
      confirmedOrdersPendingCount,
      confirmedOrdersApprovedCount,
      confirmedOrdersDeclinedCount,
      totalConfirmedSalesAmount,
      totalConfirmedPurchaseAmount,
      dataVersion,
      generatedAt: new Date().toISOString()
    };

    adminStatsCache.data = payload;
    adminStatsCache.version = dataVersion;
    adminStatsCache.timestamp = now;

    res.json(payload);
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

// Dashboard: recent confirmed orders + vendor (seller/supplier) performance from confirmed sales/purchase
router.get('/dashboard', async (req, res) => {
  try {
    const dataVersion = await getAdminDataVersion();
    const now = Date.now();
    const canUseCache =
      adminDashboardCache.data &&
      adminDashboardCache.version === dataVersion &&
      now - adminDashboardCache.timestamp < ADMIN_DASHBOARD_CACHE_TTL_MS;

    if (canUseCache) {
      return res.json({
        ...adminDashboardCache.data,
        cached: true,
      });
    }

    const [recentSales, recentPurchase] = await Promise.all([
      ConfirmedSalesOrder.find({ trash: { $ne: true } })
        .select('invoice_number transaction_date commodity seller_name net_weight_mt net_amount createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      ConfirmedPurchaseOrder.find({ trash: { $ne: true } })
        .select('invoice_number transaction_date commodity supplier_name net_weight_mt net_amount createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    const recentOrders = [
      ...recentSales.map(o => ({ ...o, orderType: 'sales', partyName: o.seller_name })),
      ...recentPurchase.map(o => ({ ...o, orderType: 'purchase', partyName: o.supplier_name }))
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Vendor performance: group by seller_name (sales) and supplier_name (purchase), order count + total amount.
    const salesAgg = await ConfirmedSalesOrder.aggregate([
      { $match: { trash: { $ne: true } } },
      { $group: { _id: '$seller_name', totalOrders: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } } } },
      { $match: { _id: { $nin: [null, '', 'N/A'] } } }
    ]);
    const purchaseAgg = await ConfirmedPurchaseOrder.aggregate([
      { $match: { trash: { $ne: true } } },
      { $group: { _id: '$supplier_name', totalOrders: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } } } },
      { $match: { _id: { $nin: [null, '', 'N/A'] } } }
    ]);

    const byParty = new Map();
    salesAgg.forEach(s => {
      const name = s._id || 'Unknown';
      const prev = byParty.get(name) || { totalOrders: 0, totalAmount: 0 };
      byParty.set(name, { name, totalOrders: prev.totalOrders + s.totalOrders, totalAmount: prev.totalAmount + s.totalAmount });
    });
    purchaseAgg.forEach(p => {
      const name = p._id || 'Unknown';
      const prev = byParty.get(name) || { totalOrders: 0, totalAmount: 0 };
      byParty.set(name, { name, totalOrders: prev.totalOrders + p.totalOrders, totalAmount: prev.totalAmount + p.totalAmount });
    });

    const vendorPerformance = Array.from(byParty.values())
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10)
      .map(v => ({ name: v.name, totalOrders: v.totalOrders, totalAmount: v.totalAmount }));

    const payload = {
      recentOrders,
      vendorPerformance,
      dataVersion,
      generatedAt: new Date().toISOString()
    };

    adminDashboardCache.data = payload;
    adminDashboardCache.version = dataVersion;
    adminDashboardCache.timestamp = now;

    res.json(payload);
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch dashboard data' });
  }
});

// Get all users (include view_access for document viewing in admin panel)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password -password_encrypted -__v')
      .sort({ createdAt: -1 })
      .lean();
    const usersOut = users.map(u => {
      const uu = { ...u };
      uu.id = uu._id ? uu._id.toString() : uu._id;
      if (uu.uploaded_document && uu.uploaded_document.view_url) {
        uu.uploaded_document.view_access = createDocumentViewToken(uu.uploaded_document.view_url);
      }
      if (uu.uploaded_documents && Array.isArray(uu.uploaded_documents)) {
        uu.uploaded_documents = uu.uploaded_documents.map(d => ({
          ...d,
          view_access: createDocumentViewToken(d.view_url),
        }));
      }
      return uu;
    });
    res.json(usersOut);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

// Super Admin only: view user's original password (if available)
router.get('/users/:id/password', async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only Super Admin can view user passwords' });
    }

    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findById(id).select('name email mobile_number +password_encrypted');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plainPassword = decryptPassword(user.password_encrypted);
    return res.json({
      success: true,
      available: Boolean(plainPassword),
      password: plainPassword || null,
    });
  } catch (error) {
    console.error('Get user password error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user password' });
  }
});

// Update user (including approval_status; when set to approved, send welcome email if user has email)
router.put('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const existingUser = await User.findById(id).select('approval_status');
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!isSuperAdmin(req.user) && existingUser.approval_status === 'approved') {
      return res.status(403).json({ error: 'Cannot edit user after Super Admin approval' });
    }

    const approvalSensitiveFields = ['approval_status', 'approved_at', 'declined_reason'];
    const approvalUpdateRequested = approvalSensitiveFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    );

    if (approvalUpdateRequested && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only Super Admin can approve or decline user registration' });
    }

    if (approvalUpdateRequested && isSuperAdmin(req.user) && existingUser.approval_status !== 'pending') {
      return res.status(400).json({
        error: 'Approval already decided. Ask Admin to re-submit before reviewing again.'
      });
    }

    const requestedApprovalStatus = Object.prototype.hasOwnProperty.call(req.body, 'approval_status')
      ? String(req.body.approval_status)
      : null;
    const wasApproved = requestedApprovalStatus === 'approved';
    const wasRejected = requestedApprovalStatus === 'rejected';
    const isPendingAgain = requestedApprovalStatus === 'pending';
    const update = { ...req.body };
    let reentryLink = null;
    let reentryExpiresAt = null;

    // Admin can edit and resubmit non-approved user registrations only.
    // Any admin update moves the record back to pending for Super Admin review.
    if (!isSuperAdmin(req.user)) {
      update.approval_status = 'pending';
      update.approved_at = null;
      update.declined_reason = '';
      update.reentry_token_hash = null;
      update.reentry_token_expires_at = null;
      update.reentry_link_generated_at = null;
      update.reentry_last_submitted_at = new Date();
    } else if (wasApproved) {
      update.approved_at = new Date();
      update.declined_reason = '';
      update.reentry_token_hash = null;
      update.reentry_token_expires_at = null;
      update.reentry_link_generated_at = null;
      update.reentry_last_submitted_at = null;
    } else if (wasRejected) {
      const declinedReason = String(update.declined_reason || '').trim();
      if (!declinedReason) {
        return res.status(400).json({ error: 'Decline reason is required' });
      }
      const tokenData = generateReentryToken();
      update.declined_reason = declinedReason;
      update.approved_at = null; // clear so user cannot login until re-approved
      update.reentry_token_hash = tokenData.tokenHash;
      update.reentry_token_expires_at = tokenData.expiresAt;
      update.reentry_link_generated_at = new Date();
      update.reentry_last_submitted_at = null;
      reentryLink = buildReentryUrl(tokenData.token);
      reentryExpiresAt = tokenData.expiresAt;
    } else if (isPendingAgain) {
      update.approved_at = null; // clear so user cannot login until re-approved
      update.declined_reason = '';
      update.reentry_token_hash = null;
      update.reentry_token_expires_at = null;
      update.reentry_link_generated_at = null;
      update.reentry_last_submitted_at = new Date();
    }

    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .select('+password_encrypted');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // When Super Admin approves, send welcome/approval email if user has email
    if (wasApproved && user.email) {
      try {
        const loginId = user.email || user.mobile_number;
        const plainPassword = decryptPassword(user.password_encrypted);
        const passwordNote = plainPassword
          ? `Password: ${plainPassword}`
          : 'Use the password you set during registration.';
        await sendWelcomeEmail(user.email, user.name, loginId, passwordNote);
        console.log(`Approval email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Approval email error:', emailError);
      }
    }

    const out = user.toJSON();
    res.json({
      ...out,
      reentry_link: reentryLink,
      reentry_expires_at: reentryExpiresAt
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

// Admin/Super Admin: generate fresh re-entry link for rejected registration
router.post('/users/:id/reentry-link', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findById(id).select('approval_status');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.approval_status !== 'rejected') {
      return res.status(400).json({ error: 'Re-entry link can be generated only for rejected users' });
    }

    const { reentryLink, reentryExpiresAt } = await issueReentryLinkForUser(user._id);
    return res.json({
      success: true,
      reentry_link: reentryLink,
      reentry_expires_at: reentryExpiresAt
    });
  } catch (error) {
    console.error('Generate re-entry link error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate re-entry link' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (String(req.userId) === String(id)) {
      return res.status(400).json({ error: 'You cannot delete your own account while signed in' });
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Get user verification document(s) – single + full list
router.get('/users/:id/verification-document', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasAnyDoc = (user.uploaded_document && (user.uploaded_document.cloudinary_url || user.uploaded_document.view_url)) ||
      (user.uploaded_documents && user.uploaded_documents.length > 0);
    if (!hasAnyDoc) {
      return res.status(404).json({ error: 'No verification document found for this user' });
    }

    const docList = (user.uploaded_documents && user.uploaded_documents.length)
      ? user.uploaded_documents
      : (user.uploaded_document ? [user.uploaded_document] : []);

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        trade_name: user.trade_name,
        mobile_number: user.mobile_number,
        email: user.email,
        role: user.role,
        kyc_status: user.kyc_status,
        approval_status: user.approval_status,
      },
      document: docList[0] ? {
        document_type: docList[0].document_type,
        document_type_label: docList[0].document_type_label,
        view_url: docList[0].view_url,
        view_access: createDocumentViewToken(docList[0].view_url),
        download_url: docList[0].download_url,
        file_name: docList[0].file_name,
        file_size: docList[0].file_size,
        uploaded_at: docList[0].uploaded_at,
      } : null,
      documents: docList.map(d => ({
        document_type: d.document_type,
        document_type_label: d.document_type_label,
        view_url: d.view_url,
        view_access: createDocumentViewToken(d.view_url),
        download_url: d.download_url,
        file_name: d.file_name,
        file_size: d.file_size,
        uploaded_at: d.uploaded_at,
      })),
    });
  } catch (error) {
    console.error('Get user verification document error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch verification document' });
  }
});

// Proxy PDF/document for inline viewing (avoids iframe "Failed to load PDF" from Cloudinary)
router.get('/documents/view', async (req, res) => {
  try {
    let url = req.query.url;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url query' });
    }
    if (!url.startsWith('http')) url = `https://${url}`;
    if (!url.includes('res.cloudinary.com/')) {
      return res.status(400).json({ error: 'Invalid document URL' });
    }
    const response = await fetchCloudinaryAsset(url);
    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({
          error: 'File blocked in Cloudinary',
          message: 'This file is set to "Blocked for delivery" in Cloudinary. In Cloudinary Console → Media Library → open the file → Summary → set Access control to "Public".',
        });
      }
      return res.status(response.status).send(response.statusText);
    }
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.includes('pdf')) contentType = 'application/pdf';
    res.setHeader('Content-Type', contentType);
    const asDownload = req.query.download === '1' || req.query.download === 'true';
    const filename = (req.query.filename && typeof req.query.filename === 'string')
      ? req.query.filename.replace(/[^\w\s.-]/gi, '_').replace(/"/g, '').trim() || 'document.pdf'
      : 'document.pdf';
    res.setHeader('Content-Disposition', asDownload ? `attachment; filename="${filename}"` : 'inline; filename="document.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Document proxy error:', error);
    res.status(500).json({ error: error.message || 'Failed to load document' });
  }
});

// Get all users with verification documents
router.get('/users-with-documents', async (req, res) => {
  try {
    const users = await User.find({
      'uploaded_document.cloudinary_url': { $exists: true }
    })
    .select('name mobile_number email role kyc_status uploaded_document createdAt')
    .sort({ createdAt: -1 });

    const usersWithDocuments = users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      mobile_number: user.mobile_number,
      email: user.email,
      role: user.role,
      kyc_status: user.kyc_status,
      document: user.uploaded_document ? {
        document_type: user.uploaded_document.document_type,
        view_url: user.uploaded_document.view_url,
        view_access: createDocumentViewToken(user.uploaded_document.view_url),
        download_url: user.uploaded_document.download_url,
        file_name: user.uploaded_document.file_name,
        uploaded_at: user.uploaded_document.uploaded_at,
      } : null,
      registered_at: user.createdAt,
    }));

    res.json({
      success: true,
      count: usersWithDocuments.length,
      users: usersWithDocuments,
    });
  } catch (error) {
    console.error('Get users with documents error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users with documents' });
  }
});

export default router;
