"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseCheck = licenseCheck;
const models_1 = require("../models");
async function licenseCheck(req, res, next) {
    const tenantId = req.tenantId;
    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context is missing for license check' });
    }
    try {
        const tenant = await models_1.Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        const t = tenant;
        const now = new Date();
        // Determine expiration date (default to 30 days after creation if not explicitly set)
        let expiry = t.licenseExpiry ? new Date(t.licenseExpiry) : null;
        if (!expiry) {
            // Fallback: 30 days trial from createdAt date
            const createdAt = t.createdAt ? new Date(t.createdAt) : now;
            expiry = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        if (expiry.getTime() < now.getTime()) {
            return res.status(403).json({
                error: 'LICENSE_EXPIRED',
                message: 'Your library license has expired. Please renew your license or enter a new license key to continue using the application.',
                expiresAt: expiry
            });
        }
        next();
    }
    catch (error) {
        console.error('Error in license check middleware:', error);
        return res.status(500).json({ error: 'Internal server error validating library license' });
    }
}
