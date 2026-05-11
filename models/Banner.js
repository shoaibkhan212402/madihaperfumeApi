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
  ctaLabel: { type: String, default: "Explore Collection" },
  ctaLink: { type: String, default: "/collections/all" },
  cta2Label: { type: String, default: "Our Heritage" },
  cta2Link: { type: String, default: "/pages/about-us" },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
