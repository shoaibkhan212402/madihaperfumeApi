import mongoose from 'mongoose';

const whatsappSessionSchema = new mongoose.Schema({
  sessionName: { type: String, default: 'madiha_master' },
  sessionData: { type: String, required: true }, // Store as Base64 ZIP or JSON
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsappSessionSchema);
export default WhatsAppSession;
