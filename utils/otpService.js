import { sendEmailOtp } from './emailService.js';
import { sendWhatsAppOtp } from './whatsappService.js';

export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

export const sendOtp = async (user) => {
  const otp = generateOtp();
  
  // Set OTP and expiration (10 minutes)
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  
  let waSent = false;

  /*
  // 1. Try sending via WhatsApp if phone is available and status is READY
  if (user.phone) {
    try {
      waSent = await sendWhatsAppOtp(user.phone, otp);
    } catch (err) {
      console.error("[OTP] WhatsApp delivery failed, falling back to email.");
    }
  }
  */
  
  // 2. Always send via Email if WhatsApp didn't report success, or if no phone provided
  // We actually send Email ALWAYS as a reliable record for the user
  if (user.email) {
    sendEmailOtp(user.email, otp);
  }
  
  return true;
};
