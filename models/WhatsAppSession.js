import mongoose from 'mongoose';

const whatsappSessionSchema = new mongoose.Schema({
  sessionName: { type: String, default: 'madiha_master', unique: true }, // Unique index — only one active session allowed
  sessionData: { type: String, required: true }, // Base64 ZIP of Baileys auth folder
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsappSessionSchema);
export default WhatsAppSession;
