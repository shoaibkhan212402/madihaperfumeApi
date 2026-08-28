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

// ── Single file upload route (image or video) ───────────────────────────────
router.post('/', uploadMemory.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No image provided' });
    }

    // Step 1: Hostinger FTP is the primary store now — own infrastructure,
    // no per-upload cost, and (unlike the Cloudinary path below) handles
    // video files as-is instead of forcing a webp image transform.
    try {
      const ftpUrl = await uploadToFtp(req.file.buffer, req.file.originalname);
      return res.send({
        message: 'Image Uploaded via FTP',
        image: ftpUrl,
        url: ftpUrl,
        provider: 'ftp'
      });
    } catch (ftpErr) {
      console.warn('FTP upload failed, falling back to Cloudinary:', ftpErr.message);
    }

    // Step 2: Fallback to Cloudinary if FTP is unreachable
    const cloudinaryUrl = await uploadBufferToCloudinary(req.file.buffer);
    return res.send({
      message: 'Image Uploaded via Cloudinary Fallback',
      image: cloudinaryUrl,
      url: cloudinaryUrl,
      provider: 'cloudinary'
    });

  } catch (error) {
    console.error('Upload Error (Both FTP & Cloudinary failed):', error);
    res.status(500).send({ message: 'Failed to upload image', error: error.message });
  }
});

// ── Multiple file upload route ───────────────────────────────────────────────
router.post('/multiple', uploadMemory.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).send({ message: 'No images provided' });
    }

    // Step 1: FTP primary
    try {
      const ftpUrls = await Promise.all(req.files.map((file) => uploadToFtp(file.buffer, file.originalname)));
      return res.send({
        message: 'Images Uploaded via FTP',
        images: ftpUrls,
        urls: ftpUrls,
        provider: 'ftp'
      });
    } catch (ftpErr) {
      console.warn('Multiple FTP upload failed, falling back to Cloudinary:', ftpErr.message);
    }

    // Step 2: Fallback to Cloudinary if FTP is unreachable
    const urls = await Promise.all(req.files.map((file) => uploadBufferToCloudinary(file.buffer)));
    return res.send({
      message: 'Images Uploaded via Cloudinary Fallback',
      images: urls,
      urls: urls,
      provider: 'cloudinary'
    });

  } catch (error) {
    console.error('Multiple Upload Error (Both FTP & Cloudinary failed):', error);
    res.status(500).send({ message: 'Failed to upload images', error: error.message });
  }
});

export default router;
