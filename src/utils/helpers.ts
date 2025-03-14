import crypto from "crypto";
import jwt from "jsonwebtoken";

/* global process */

/**
 * Generate a hashed OTP and its original value
 */
export function generateHashedOTP() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    return { otp, hashedOtp };
}

/**
 * Generate a unique username from email
 * Takes the part before @ and adds a random string
 */
export function generateUsernameFromEmail(email: string): string {
    const baseUsername = email.split("@")[0].toLowerCase();
    const randomString = crypto.randomBytes(4).toString("hex");
    return `${baseUsername}-${randomString}`;
}

export const verifyToken = (token: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
            if (err) reject(err);
            resolve(decoded);
        });
    });
};
