import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import './Product.js';
const userSchema = mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    googleId: { type: String },
    isGoogleUser: { type: Boolean, default: false },
    phone: { type: String },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    addresses: [
      {
        type: { type: String, default: 'Home' },
        fullName: String,
        phone: String,
        street: String,
        landmark: String,
        city: String,
        state: String,
        country: { type: String, default: 'India' },
        zipCode: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    cartItems: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        originalPrice: Number,
        image: String,
        qty: { type: Number, default: 1 },
      }
    ],
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
export default User;
