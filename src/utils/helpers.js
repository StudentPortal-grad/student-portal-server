"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateUsernameFromEmail = exports.generateHashedOTP = void 0;
var crypto_1 = require("crypto");
var jsonwebtoken_1 = require("jsonwebtoken");
/* global process */
/**
 * Generate a hashed OTP and its original value
 */
function generateHashedOTP() {
    var otp = Math.floor(100000 + Math.random() * 900000).toString();
    var hashedOtp = crypto_1.default.createHash("sha256").update(otp).digest("hex");
    return { otp: otp, hashedOtp: hashedOtp };
}
exports.generateHashedOTP = generateHashedOTP;
/**
 * Generate a unique username from email
 * Takes the part before @ and adds a random string
 */
function generateUsernameFromEmail(email) {
    var baseUsername = email.split("@")[0].toLowerCase();
    var randomString = crypto_1.default.randomBytes(4).toString("hex");
    return "".concat(baseUsername, "-").concat(randomString);
}
exports.generateUsernameFromEmail = generateUsernameFromEmail;
var verifyToken = function (token) {
    return new Promise(function (resolve, reject) {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, function (err, decoded) {
            if (err)
                reject(err);
            resolve(decoded);
        });
    });
};
exports.verifyToken = verifyToken;
