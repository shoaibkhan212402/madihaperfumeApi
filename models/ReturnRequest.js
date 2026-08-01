import mongoose from 'mongoose';

const returnRequestSchema = mongoose.Schema(
  {
    // Optional link to a real Order (only present when the customer ordered via the website)
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
    },
    orderIdText: { type: String },     // free-text order ID/reference as typed by the customer
    orderSource: {
      type: String,
      enum: ['WEBSITE', 'WHATSAPP', 'OTHER'],
      required: true,
      default: 'WEBSITE',
    },

    customerName: { type: String, required: true },
    phone:        { type: String, required: true },
    email:        { type: String },

    deliveredAt: { type: Date, required: true },
    description: { type: String, required: true }, // what's wrong with the order
    images:      [{ type: String }],                // Cloudinary/FTP URLs

    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    resolutionType: {
      type: String,
      enum: ['RETURN', 'REPLACEMENT'],
    },
    adminNote:    { type: String }, // reason shown when rejected
    processedAt:  { type: Date },
  },
  { timestamps: true }
);

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
