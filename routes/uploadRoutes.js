import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { uploadToFtp } from '../utils/ftpUploader.js';

const router = express.Router();

// Memory storage for buffer processing
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * Upload single buffer to Cloudinary with WebP compression
 */
function uploadBufferToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'madiha-perfume',
        format: 'webp',
        quality: 'auto',
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
}

// ── Single image upload route ───────────────────────────────────────────────
router.post('/', uploadMemory.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No image provided' });
    }

    // Step 1: Try Cloudinary Upload First
    try {
      const cloudinaryUrl = await uploadBufferToCloudinary(req.file.buffer);
      return res.send({
        message: 'Image Uploaded via Cloudinary',
        image: cloudinaryUrl,
        url: cloudinaryUrl,
        provider: 'cloudinary'
      });
    } catch (cloudinaryErr) {
      console.warn('Cloudinary upload failed, triggering FTP fallback:', cloudinaryErr.message);
    }

    // Step 2: Fallback to Hostinger FTP Upload
    const ftpUrl = await uploadToFtp(req.file.buffer, req.file.originalname);
    return res.send({
      message: 'Image Uploaded via FTP Fallback',
      image: ftpUrl,
      url: ftpUrl,
      provider: 'ftp'
    });

  } catch (error) {
    console.error('Upload Error (Both Cloudinary & FTP failed):', error);
    res.status(500).send({ message: 'Failed to upload image', error: error.message });
  }
});

// ── Multiple image upload route ─────────────────────────────────────────────
router.post('/multiple', uploadMemory.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).send({ message: 'No images provided' });
    }

    // Step 1: Try Cloudinary Upload for all files
    try {
      const uploadPromises = req.files.map((file) => uploadBufferToCloudinary(file.buffer));
      const urls = await Promise.all(uploadPromises);
      return res.send({
        message: 'Images Uploaded via Cloudinary',
        images: urls,
        urls: urls,
        provider: 'cloudinary'
      });
    } catch (cloudinaryErr) {
      console.warn('Multiple Cloudinary upload failed, triggering FTP fallback:', cloudinaryErr.message);
    }

    // Step 2: Fallback to Hostinger FTP Upload for all files
    const ftpPromises = req.files.map((file) => uploadToFtp(file.buffer, file.originalname));
    const ftpUrls = await Promise.all(ftpPromises);

    return res.send({
      message: 'Images Uploaded via FTP Fallback',
      images: ftpUrls,
      urls: ftpUrls,
      provider: 'ftp'
    });

  } catch (error) {
    console.error('Multiple Upload Error (Both Cloudinary & FTP failed):', error);
    res.status(500).send({ message: 'Failed to upload images', error: error.message });
  }
});

export default router;
