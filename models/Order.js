import mongoose from 'mongoose';

const orderSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    orderItems: [
      {
        name:  { type: String, required: true },
        qty:   { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,   // optional — bundle/promo items may not have a DB product
          ref: 'Product',
        },
        // For bundle/promo items — store original productId string as reference
        productRef: { type: String },
      },
    ],
    firstName:     { type: String, required: true },
    lastName:      { type: String, required: true },
    phone:         { type: String },
    address:       { type: String, required: true },
    city:          { type: String, required: true },
    state:         { type: String },
    postalCode:    { type: String, required: true },
    country:       { type: String, required: true },
    paymentMethod: { type: String, required: true },
    paymentId:     { type: String },
    paymentStatus: { type: String },
    paymentEmail:  { type: String },
    itemsPrice:    { type: Number, required: true, default: 0.0 },
    taxPrice:      { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    discountAmount:{ type: Number, default: 0.0 },   // coupon discount
    totalPrice:    { type: Number, required: true, default: 0.0 },
    couponCode:    { type: String, default: null },   // applied coupon
    isPaid:        { type: Boolean, required: true, default: false },
    paidAt:        { type: Date },
    isDelivered:   { type: Boolean, required: true, default: false },
    deliveredAt:   { type: Date },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
      default: 'PENDING',
    },
    // Shiprocket shipment reference — set once the order is shipped
    awbCode:              { type: String },
    courierName:          { type: String },
    shiprocketOrderId:    { type: String },
    shiprocketShipmentId: { type: String },

    isReturnRequested: { type: Boolean, default: false },
    returnReason:      { type: String },
    returnStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NONE'
    },
    returnRequestedAt: { type: Date },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
