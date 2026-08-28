import * as ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';

/**
 * Uploads a file buffer directly to Hostinger FTP server
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} originalName - Original filename
 * @returns {Promise<string>} Public HTTPS URL of uploaded image
 */
export async function uploadToFtp(fileBuffer, originalName) {
  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  const host = process.env.FTP_HOST || '2a02:4780:11:1934:0:1a99:6bb2:9';
  const user = process.env.FTP_USER || 'u446262194.madihaperfume';
  const password = process.env.FTP_PASS || 'Madihaperfume@123';
  const remoteDir = process.env.FTP_REMOTE_DIR || 'uploads';
  const baseUrl = (process.env.FTP_BASE_URL || 'https://madihaperfume.com/uploads').replace(/\/$/, '');

  const ext = path.extname(originalName) || '.jpg';
  const cleanName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanName}-${Date.now()}${ext}`;

  // Temporary local file to stream over FTP
  const tempFilePath = path.join(process.cwd(), 'scratch', filename);

  // Ensure scratch directory exists
  const scratchDir = path.dirname(tempFilePath);
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  try {
    fs.writeFileSync(tempFilePath, fileBuffer);

    await client.access({
      host,
      user,
      password,
      secure: false, // Standard FTP port 21
    });

    // Ensure remote directory exists (public_html/uploads)
    try {
      await client.ensureDir(remoteDir);
    } catch (dirErr) {
      console.warn('FTP ensureDir warning:', dirErr.message);
    }

    // Upload file using basic-ftp uploadFrom method
    await client.uploadFrom(tempFilePath, filename);

    const publicUrl = `${baseUrl}/${filename}`;
    return publicUrl;
  } catch (err) {
    console.error('FTP Upload error:', err);
    throw err;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    client.close();
  }
}

/**
 * Deletes a single file from the Hostinger FTP uploads directory.
 * @param {string} filename - Just the filename (no directory, no URL prefix)
 */
export async function deleteFromFtp(filename) {
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;

  const host = process.env.FTP_HOST || '2a02:4780:11:1934:0:1a99:6bb2:9';
  const user = process.env.FTP_USER || 'u446262194.madihaperfume';
  const password = process.env.FTP_PASS || 'Madihaperfume@123';
  const remoteDir = process.env.FTP_REMOTE_DIR || 'uploads';

  try {
    await client.access({ host, user, password, secure: false });
    await client.cd(remoteDir);
    await client.remove(filename);
  } finally {
    client.close();
  }
}
