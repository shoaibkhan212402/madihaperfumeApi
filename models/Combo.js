import mongoose from 'mongoose';

const comboSchema = mongoose.Schema(
  {
    name:         { type: String, required: true },
    slug:         { type: String, required: true, unique: true },
    description:  { type: String, required: true },
    shortDesc:    { type: String },
    price:        { type: Number, required: true, default: 0 },
    originalPrice:{ type: Number },
    image:        { type: String },
    badge:        { type: String },
    includes:     [{ text: String }],
    products:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    stock:        { type: Number, required: true, default: 0 },
    isActive:     { type: Boolean, required: true, default: true },
    isFeatured:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Combo = mongoose.model('Combo', comboSchema);
export default Combo;
