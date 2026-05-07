import dotenv from 'dotenv';

dotenv.config();

// Lazy-load cloudinary so server can start on Render even if package is not installed
let cloudinary = null;
let cloudinaryConfig = null;

async function loadCloudinary() {
  if (cloudinaryConfig) return cloudinaryConfig;
  try {
    const mod = await import('cloudinary');
    cloudinary = mod.default;
    cloudinaryConfig = cloudinary.v2;
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim().replace(/^dbtrvqifra$/, 'dbtrvqifr');
    cloudinaryConfig.config({
      cloud_name: cloudName,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return cloudinaryConfig;
  } catch (err) {
    console.warn('Cloudinary package not found. Install it with: npm install cloudinary. Document upload/view will be disabled.');
    throw new Error('Cloudinary is not installed. Add "cloudinary" to package.json dependencies and redeploy.');
  }
}

const isPdf = (fileName) => (fileName || '').toLowerCase().endsWith('.pdf');

/**
 * Parse a Cloudinary delivery URL to get public_id and resource_type.
 * @param {string} url - e.g. https://res.cloudinary.com/cloud/image/upload/v123/folder/file.pdf
 * @returns {{ publicId: string, resourceType: string } | null}
 */
export function parseCloudinaryUrl(url) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com/')) return null;
  try {
    const match = url.match(/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/(upload|authenticated)\/(v\d+\/)?(.+)$/);
    if (!match) return null;
    const [, resourceType, , , path] = match;
    const publicId = path.replace(/%2F/g, '/').replace(/%20/g, ' ');
    return { publicId, resourceType: resourceType || 'image' };
  } catch {
    return null;
  }
}

/**
 * Generate a signed delivery URL for an asset (use when account has authenticated delivery / 401).
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - 'image' | 'raw' | 'video'
 * @returns {Promise<string>} signed URL
 */
export async function getSignedDeliveryUrl(publicId, resourceType = 'image') {
  const c = await loadCloudinary();
  return cloudinary.url(publicId, {
    type: 'upload',
    resource_type: resourceType,
    sign_url: true,
    secure: true,
  });
}

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - Original file name
 * @param {String} folder - Folder path in Cloudinary (optional)
 * @returns {Promise<Object>} Upload result with URL and public_id
 */
export async function uploadToCloudinary(fileBuffer, fileName, folder = 'grainology/documents') {
  const c = await loadCloudinary();
  try {
    const useRawForPdf = isPdf(fileName);
    return new Promise((resolve, reject) => {
      const uploadStream = c.uploader.upload_stream(
        {
          folder: folder,
          resource_type: useRawForPdf ? 'raw' : 'auto',
          allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
          format: useRawForPdf ? 'pdf' : 'auto',
          access_control: [{ access_type: 'anonymous' }],
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
              format: result.format,
              bytes: result.bytes,
              created_at: result.created_at,
              view_url: result.secure_url,
              download_url: result.secure_url.replace('/upload/', '/upload/fl_attachment/'),
            });
          }
        }
      );
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public_id
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteFromCloudinary(publicId) {
  const c = await loadCloudinary();
  try {
    const result = await c.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
}

export default { loadCloudinary, get v2() { return cloudinaryConfig; } };
