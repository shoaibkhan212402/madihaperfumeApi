import nodemailer from 'nodemailer';

export const sendEmailOtp = async (to, otp) => {
  console.log(`[EMAIL] Simulated sending OTP ${otp} to ${to}`);
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[EMAIL] Skipping actual email dispatch (no SMTP_USER/SMTP_PASS in .env)');
    return;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Madiha Perfume" <${process.env.SMTP_USER}>`,
      to,
      subject: "Verification Code - Madiha Perfume",
      text: `Your Madiha Perfume verification code is: ${otp}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #f0f0f0;">
          <div style="background-color: #0e0c08; padding: 30px; text-align: center;">
            <h1 style="color: #c8a96e; margin: 0; font-size: 28px; letter-spacing: 2px; font-family: serif;">MADIHA PERFUME</h1>
            <p style="color: rgba(255,255,255,0.6); font-size: 10px; text-transform: uppercase; margin-top: 5px; letter-spacing: 3px;">Luxury Indian Fragrances</p>
          </div>
          <div style="padding: 40px 30px; background-color: #ffffff; text-align: center;">
            <h2 style="color: #1a1714; margin-bottom: 20px; font-size: 20px;">Verify Your Account</h2>
            <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 30px;">
              Please use the verification code below to complete your sign-in. 
              <br/><span style="font-size: 12px; color: #888;">(This email was sent as a reliable fallback for your request)</span>
            </p>
            
            <div style="background-color: #fdfcf9; border: 2px dashed #c8a96e; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0e0c08;">${otp}</span>
            </div>
            
            <p style="font-size: 13px; color: #999; margin-bottom: 0;">This code is valid for 10 minutes.</p>
            <p style="font-size: 12px; color: #d9534f; margin-top: 10px;">If you did not request this code, please ignore this email.</p>
          </div>
          <div style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="font-size: 11px; color: #aaa; margin: 0;">&copy; 2026 Madiha Perfume. All Rights Reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`[EMAIL] Successfully sent OTP to ${to}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send OTP:', err);
  }
};
