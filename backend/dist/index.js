"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const dns_1 = __importDefault(require("dns"));
dns_1.default.setDefaultResultOrder('ipv4first');
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const students_1 = __importDefault(require("./routes/students"));
const seats_1 = __importDefault(require("./routes/seats"));
const plans_1 = __importDefault(require("./routes/plans"));
const shifts_1 = __importDefault(require("./routes/shifts"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const tenant_1 = __importDefault(require("./routes/tenant"));
const license_1 = __importDefault(require("./routes/license"));
const admin_1 = __importDefault(require("./routes/admin"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const tenant_2 = require("./middleware/tenant");
const licenseCheck_1 = require("./middleware/licenseCheck");
const auth_2 = require("./middleware/auth");
const rateLimiter_1 = require("./middleware/rateLimiter");
// Strict environment validation for production ready LMS
const JWT_SECRET_VAL = process.env.JWT_SECRET;
const ADMIN_PASSWORD_VAL = process.env.ADMIN_PASSWORD;
const LICENSE_MASTER_SECRET_VAL = process.env.LICENSE_MASTER_SECRET;
const isInsecureJwt = !JWT_SECRET_VAL || JWT_SECRET_VAL === 'lms-super-secret-jwt-key';
const isInsecureAdminPass = !ADMIN_PASSWORD_VAL || ADMIN_PASSWORD_VAL === 'change-this-password' || ADMIN_PASSWORD_VAL === 'admin123';
const isInsecureLicenseSecret = !LICENSE_MASTER_SECRET_VAL || LICENSE_MASTER_SECRET_VAL === 'change-this-license-secret' || LICENSE_MASTER_SECRET_VAL === 'lms-default-master-secret-key-987654321';
if (process.env.NODE_ENV === 'production') {
    if (isInsecureJwt || isInsecureAdminPass || isInsecureLicenseSecret) {
        console.error('❌ CRITICAL SECURITY ERROR: Missing or insecure environment variables in production!');
        if (isInsecureJwt)
            console.error('   - JWT_SECRET is not configured or using development fallback.');
        if (isInsecureAdminPass)
            console.error('   - ADMIN_PASSWORD is not configured or using default password.');
        if (isInsecureLicenseSecret)
            console.error('   - LICENSE_MASTER_SECRET is not configured or using fallback key.');
        console.error('   Please define secure values in your .env file before starting the application in production mode.');
        process.exit(1);
    }
}
else {
    // Prominent security warnings in development
    if (isInsecureJwt || isInsecureAdminPass || isInsecureLicenseSecret) {
        console.warn('\n⚠️  SECURITY WARNING: Development default credentials/secrets are active!');
        if (isInsecureJwt)
            console.warn('   - JWT_SECRET is using a weak development default key.');
        if (isInsecureAdminPass)
            console.warn('   - ADMIN_PASSWORD is using default "admin123" password.');
        if (isInsecureLicenseSecret)
            console.warn('   - LICENSE_MASTER_SECRET is using a weak fallback key.');
        console.warn('   Make sure to define secure values in backend/.env for production deployment.\n');
    }
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// CORS — allows local dev by default; set CORS_ORIGIN in env for production
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS blocked: origin '${origin}' is not permitted`));
        }
    },
    credentials: true
}));
// Basic security headers
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});
app.use(express_1.default.json());
// Apply Rate Limiting Middleware
app.use('/api/auth/login', (0, rateLimiter_1.rateLimiter)(60000, 10, 'Too many login attempts from this IP. Please try again after a minute.'));
app.use('/api/auth/register-tenant', (0, rateLimiter_1.rateLimiter)(60000, 5, 'Too many registration requests from this IP. Please try again after a minute.'));
app.use('/api/admin/login', (0, rateLimiter_1.rateLimiter)(60000, 10, 'Too many admin login attempts from this IP. Please try again after a minute.'));
app.use((0, rateLimiter_1.rateLimiter)(60000, 150));
// Request Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', version: '1.0.1-bulk-seats-v1', timestamp: new Date(), db: 'MongoDB Atlas' });
});
// Unprotected Auth & Admin routes
app.use('/api/auth', auth_1.default);
app.use('/api/admin', admin_1.default);
// License check/activate routes (scoped to tenant, but exempt from license expiry check)
app.use('/api/license', tenant_2.tenantMiddleware, auth_2.authMiddleware, license_1.default);
// Tenant Scoping + License Enforcement Middleware + JWT Auth
app.use('/api/dashboard', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, dashboard_1.default);
app.use('/api/students', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, students_1.default);
app.use('/api/seats', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, seats_1.default);
app.use('/api/plans', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, plans_1.default);
app.use('/api/shifts', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, shifts_1.default);
app.use('/api/whatsapp', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, whatsapp_1.default);
app.use('/api/tenant', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, tenant_1.default);
app.use('/api/attendance', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, attendance_1.default);
app.use('/api/expenses', tenant_2.tenantMiddleware, auth_2.authMiddleware, licenseCheck_1.licenseCheck, expenses_1.default);
// Connect to MongoDB Atlas then start server
(0, db_1.connectDB)().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 LMS SaaS Server running on http://localhost:${PORT}`);
    });
});
