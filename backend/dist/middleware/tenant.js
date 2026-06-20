"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = tenantMiddleware;
const models_1 = require("../models");
async function tenantMiddleware(req, res, next) {
    // Exclude auth routes from tenant check
    if (req.path.startsWith('/api/auth')) {
        return next();
    }
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
        return res.status(400).json({ error: 'X-Tenant-ID header is missing' });
    }
    try {
        const tenantExists = await models_1.Tenant.findById(tenantId);
        if (!tenantExists) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        req.tenantId = tenantId;
        req.tenantDoc = tenantExists; // Attach for downstream middleware to reuse
        next();
    }
    catch (error) {
        console.error('Error validating tenant ID:', error);
        return res.status(500).json({ error: 'Internal server error validating tenant context' });
    }
}
