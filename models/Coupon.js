import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: '' },

    // ── Discount type
    discountType: {
      type: String,
      enum: ['PERCENT', 'FLAT'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },

    // ── Free shipping override
    freeShipping: { type: Boolean, default: false },

    // ── Conditions
    minOrderAmount: { type: Number, default: 0 },   // 0 = no minimum
    maxUses:        { type: Number, default: 0 },   // 0 = unlimited
    usedCount:      { type: Number, default: 0 },

    // ── Validity
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },        // null = never expires

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual: is this coupon currently valid (not expired, not used up)?
couponSchema.virtual('isValid').get(function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.startsAt && this.startsAt > now) return false;
  if (this.expiresAt && this.expiresAt < now) return false;
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) return false;
  return true;
});
couponSchema.set('toJSON', { virtuals: true });

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
