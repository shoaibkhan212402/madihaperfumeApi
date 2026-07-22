import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  title: {
    first: { type: String, default: "" },
    second: { type: String, default: "" }
  },
  eyebrow: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  image: { type: String, required: true },
  mobileImage: { type: String, default: "" },
  textColor: { type: String, default: "#ffffff" }, // Added to control text color
  ctaLabel: { type: String, default: "" },
  ctaLink: { type: String, default: "" },
  cta2Label: { type: String, default: "" },
  cta2Link: { type: String, default: "" },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
