import express from 'express';
import { verifyDocumentViewToken } from '../utils/documentViewToken.js';
import { parseCloudinaryUrl, getSignedDeliveryUrl } from '../utils/cloudinary.js';

const router = express.Router();

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

/**
 * Public document view (no auth). Requires valid signed access token.
 * Used so the PDF viewer can load documents without relying on Authorization header.
 * GET /api/documents/view?url=...&access=...
 */
router.get('/view', async (req, res) => {
  try {
    const url = req.query.url;
    const access = req.query.access;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url query' });
    }
    if (!access || typeof access !== 'string') {
      return res.status(400).json({ error: 'Missing access token' });
    }
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    if (!fullUrl.includes('res.cloudinary.com/')) {
      return res.status(400).json({ error: 'Invalid document URL' });
    }
    if (!verifyDocumentViewToken(fullUrl, access)) {
      return res.status(403).json({
        error: 'Invalid or expired view link',
        message: 'This view link has expired. Click "Get fresh link" below to load the document without closing.',
      });
    }
    const response = await fetchCloudinaryAsset(fullUrl);
    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({
          error: 'File blocked in Cloudinary',
          message: 'This file is set to "Blocked for delivery" in Cloudinary. In Cloudinary Console → Media Library → open the file → Summary → set Access control to "Public" or remove the block.',
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
    console.error('Document view error:', error);
    res.status(500).json({ error: error.message || 'Failed to load document' });
  }
});

export default router;
