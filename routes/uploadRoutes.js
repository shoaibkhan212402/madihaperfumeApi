import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'madiha-perfume',
      format: 'webp',
      public_id: `${file.fieldname}-${Date.now()}`,
    };
  },
});

const upload = multer({ storage });

router.post('/', upload.single('image'), (req, res) => {
  if (req.file) {
    res.send({
      message: 'Image Uploaded',
      image: req.file.path,
    });
  } else {
    res.status(400).send({ message: 'No image provided' });
  }
});

router.post('/multiple', upload.array('images', 5), (req, res) => {
  if (req.files && Array.isArray(req.files)) {
    const paths = req.files.map((file) => file.path);
    res.send({
      message: 'Images Uploaded',
      images: paths,
    });
  } else {
    res.status(400).send({ message: 'No images provided' });
  }
});

export default router;
