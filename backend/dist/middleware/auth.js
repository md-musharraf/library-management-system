"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const JWT_SECRET = process.env.JWT_SECRET || 'lms-super-secret-jwt-key';
async function authMiddleware(req, res, next) {
    // Exclude unprotected auth routes
    if (req.path.startsWith('/api/auth')) {
        return next();
    }
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        // Verify token tenant matches request tenant to prevent tenant cross-talk (BOLA protection)
        const requestTenantId = req.headers['x-tenant-id'];
        if (requestTenantId && decoded.tenantId !== requestTenantId) {
            return res.status(403).json({ error: 'Access denied. Tenant context mismatch.' });
        }
        // Verify that the session is active in the database (enforces device limits & revocation)
        const session = await models_1.Session.findOne({ token });
        if (!session) {
            return res.status(401).json({ error: 'Session expired or logged out from another device.' });
        }
        // Keep session alive
        session.lastActive = new Date();
        await session.save();
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
}
