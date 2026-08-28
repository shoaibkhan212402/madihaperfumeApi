import cloudinary from '../config/cloudinary.js';
import { deleteFromFtp } from './ftpUploader.js';

// Matches https://res.cloudinary.com/<cloud>/<image|video>/upload/v123/<public_id>.<ext>
const CLOUDINARY_URL_RE = /res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/;

/**
 * Deletes the file a stored media URL points to, from whichever backend
 * (Cloudinary or the Hostinger FTP store) actually hosts it — so removing a
 * record doesn't leave the underlying file orphaned in storage forever.
 * Never throws: cleanup failures are logged, not surfaced, since the
 * caller's own delete (e.g. removing a DB row) should still succeed.
 */
export async function deleteMediaUrl(url) {
  if (!url || typeof url !== 'string') return;
  try {
    const cloudinaryMatch = url.match(CLOUDINARY_URL_RE);
    if (cloudinaryMatch) {
      const [, resourceType, publicId] = cloudinaryMatch;
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      return;
    }

    const ftpBase = (process.env.FTP_BASE_URL || 'https://madihaperfume.com/uploads').replace(/\/$/, '');
    if (url.startsWith(ftpBase + '/')) {
      const filename = url.slice(ftpBase.length + 1).split('?')[0];
      if (filename) await deleteFromFtp(filename);
    }
  } catch (err) {
    console.warn('[mediaCleanup] Failed to delete media file:', url, '—', err.message);
  }
}

/** Deletes several media URLs (thumbnail + video, etc.), skipping empties/duplicates. */
export async function deleteMediaUrls(urls) {
  const unique = [...new Set((urls || []).filter(Boolean))];
  await Promise.all(unique.map(deleteMediaUrl));
}
