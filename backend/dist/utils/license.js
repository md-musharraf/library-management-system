"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLicenseKey = generateLicenseKey;
exports.validateLicenseKey = validateLicenseKey;
const crypto_1 = __importDefault(require("crypto"));
// Use a fallback secret if not specified in .env
const getSecret = () => process.env.LICENSE_MASTER_SECRET || 'lms-default-master-secret-key-987654321';
/**
 * Generates a tamper-proof license key signed with HMAC-SHA256
 */
function generateLicenseKey(tenantId, expiresAt, type) {
    const secret = getSecret();
    const payload = {
        tenantId,
        expiresAt: expiresAt.getTime(),
        type
    };
    // Base64URL encode the JSON payload
    const payloadStr = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadStr).toString('base64url');
    // Generate signature
    const hmac = crypto_1.default.createHmac('sha256', secret);
    hmac.update(payloadBase64);
    const signature = hmac.digest('hex');
    return `LMS-${payloadBase64}-${signature}`;
}
/**
 * Validates a license key's structure and HMAC signature
 */
function validateLicenseKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'Empty license key' };
    }
    const parts = key.split('-');
    // Format should be: LMS-<payload>-<signature>
    if (parts.length !== 3 || parts[0] !== 'LMS') {
        return { valid: false, error: 'Invalid license key format' };
    }
    const [, payloadBase64, signature] = parts;
    try {
        const secret = getSecret();
        // Verify signature first
        const hmac = crypto_1.default.createHmac('sha256', secret);
        hmac.update(payloadBase64);
        const expectedSignature = hmac.digest('hex');
        if (signature !== expectedSignature) {
            return { valid: false, error: 'License signature is invalid or tampered with' };
        }
        // Decode payload
        const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadStr);
        if (!payload.tenantId || !payload.expiresAt || !payload.type) {
            return { valid: false, error: 'Invalid license payload structure' };
        }
        const expiresAt = new Date(payload.expiresAt);
        // Check if expired
        if (expiresAt.getTime() < Date.now()) {
            return { valid: false, error: 'License key has expired', tenantId: payload.tenantId, expiresAt, type: payload.type };
        }
        return {
            valid: true,
            tenantId: payload.tenantId,
            expiresAt,
            type: payload.type
        };
    }
    catch (error) {
        return { valid: false, error: 'Failed to decode or parse license key' };
    }
}
