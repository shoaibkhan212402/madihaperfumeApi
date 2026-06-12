import mongoose from 'mongoose';

const whatsappSessionSchema = new mongoose.Schema({
  sessionName: { type: String, default: 'madiha_master', unique: true }, // Unique index — only one active session allowed
  sessionData: { type: String, required: false }, // Base64 ZIP of Baileys auth folder (optional, since it won't exist initially)
  status: { type: String, default: 'INITIALIZING' },
  qrCode: { type: String, default: null },
  error: { type: String, default: null },
  lastConnectedAt: { type: Date, default: null },
  connectionUpSince: { type: Date, default: null },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsappSessionSchema);
export default WhatsAppSession;
