import mongoose from 'mongoose';

const productSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    originalPrice: { type: Number },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Category',
    },
    images: [{ url: String }],
    features: [{ text: String }],
    sizes: [{
      label: { type: String, required: true }, // e.g., '10ml', '50ml'
      price: { type: Number, required: true },
      originalPrice: { type: Number }
    }],
    stock: { type: Number, required: true, default: 0 },
    badge: { type: String },
    isActive: { type: Boolean, required: true, default: true },
    isBestSeller: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
