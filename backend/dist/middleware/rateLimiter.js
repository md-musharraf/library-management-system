"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
function rateLimiter(windowMs, maxRequests, message) {
    const rateLimitMap = new Map();
    return (req, res, next) => {
        // Get client IP address
        const ip = (req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            'unknown').split(',')[0].trim();
        const now = Date.now();
        const limitInfo = rateLimitMap.get(ip);
        if (!limitInfo) {
            // First request from this IP
            rateLimitMap.set(ip, { count: 1, startTime: now });
            return next();
        }
        // Check if the time window has expired
        if (now - limitInfo.startTime > windowMs) {
            // Reset the window
            rateLimitMap.set(ip, { count: 1, startTime: now });
            return next();
        }
        // Increment count
        limitInfo.count++;
        if (limitInfo.count > maxRequests) {
            console.warn(`[SECURITY ALERT] Rate limit exceeded for IP: ${ip} on path: ${req.path}`);
            return res.status(429).json({
                error: message || 'Too many requests from this IP. Please try again later.'
            });
        }
        next();
    };
}
