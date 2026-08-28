import mongoose from 'mongoose';

const reelSchema = new mongoose.Schema({
  videoUrl: { type: String, required: true },
  thumbnail: { type: String, default: "" },
  caption: { type: String, default: "" },
  instagramLink: { type: String, default: "" },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Reel = mongoose.model('Reel', reelSchema);
export default Reel;
