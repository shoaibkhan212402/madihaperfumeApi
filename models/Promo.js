import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  bundleSize: { type: Number, required: true },
  bundlePrice: { type: Number, required: true },
  categorySlugs: [{ type: String }],
  // Explicit product list — when set, only these products are shown on the promo page
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  accentColor: { type: String, default: '#c8a96e' },
  cartLabel: { type: String, default: 'Bundle' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Promo = mongoose.model('Promo', promoSchema);
export default Promo;
