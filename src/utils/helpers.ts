import crypto from 'crypto';

export const generateHashedOTP = () => {
  const otp = Math.floor(Math.random() * 900000 + 100000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  return { otp, hashedOtp };
};
