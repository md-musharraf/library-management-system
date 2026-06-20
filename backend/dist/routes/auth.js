"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const models_1 = require("../models");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'lms-super-secret-jwt-key';
// Tenant & Admin User Registration
router.post('/register-tenant', async (req, res) => {
    const { libraryName, ownerName, phone, address, email, password } = req.body;
    if (!libraryName || !ownerName || !phone || !address || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const existingUser = await models_1.User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // 1. Create Tenant with a 30-day Trial License
        const tenant = new models_1.Tenant({
            _id: (0, uuid_1.v4)(),
            name: libraryName,
            ownerName,
            phone,
            address,
            licenseType: 'TRIAL',
            licenseExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            trialStartedAt: new Date(),
        });
        await tenant.save();
        // 2. Create Admin User
        const user = new models_1.User({
            _id: (0, uuid_1.v4)(),
            tenantId: tenant._id,
            name: ownerName,
            email,
            password: hashedPassword,
            role: 'ADMIN',
        });
        await user.save();
        // 3. Create Default WhatsApp Config
        await models_1.WhatsappConfig.create({
            _id: (0, uuid_1.v4)(),
            tenantId: tenant._id,
            apiUrl: 'https://api.ultramsg.com/instance-placeholder',
            token: 'your-auth-token',
            providerType: 'ULTRAMSG',
            templateWelcome: 'Hello {student_name}, welcome to {library_name}! Your registration code is {registration_no}.',
            templateExpiry: 'Dear {student_name}, your seat {seat_number} subscription ({shift} shift) at {library_name} expires on {expiry_date}. Please renew.',
            expiryDaysAlert: 3,
        });
        // 4. Create default 10 seats
        for (let i = 1; i <= 10; i++) {
            await models_1.Seat.create({
                _id: (0, uuid_1.v4)(),
                tenantId: tenant._id,
                seatNumber: `Seat-${i}`,
                status: 'AVAILABLE',
                areaName: 'General Hall',
            });
        }
        // 5. Create 3 default shifts
        const shiftA = await models_1.Shift.create({
            _id: (0, uuid_1.v4)(),
            tenantId: tenant._id,
            name: 'Shift A',
            startTime: '06:00',
            endTime: '11:00',
        });
        const shiftB = await models_1.Shift.create({
            _id: (0, uuid_1.v4)(),
            tenantId: tenant._id,
            name: 'Shift B',
            startTime: '11:00',
            endTime: '16:00',
        });
        const shiftC = await models_1.Shift.create({
            _id: (0, uuid_1.v4)(),
            tenantId: tenant._id,
            name: 'Shift C',
            startTime: '16:00',
            endTime: '21:00',
        });
        // 6. Create default plans
        await models_1.Plan.create([
            { _id: (0, uuid_1.v4)(), tenantId: tenant._id, name: 'Monthly Shift A (6-11)', durationDays: 30, price: 800, shiftId: shiftA._id },
            { _id: (0, uuid_1.v4)(), tenantId: tenant._id, name: 'Monthly Shift B (11-4)', durationDays: 30, price: 800, shiftId: shiftB._id },
            { _id: (0, uuid_1.v4)(), tenantId: tenant._id, name: 'Monthly Shift C (4-9)', durationDays: 30, price: 800, shiftId: shiftC._id },
        ]);
        const token = jsonwebtoken_1.default.sign({ userId: user._id, tenantId: tenant._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        // Register active device session
        await models_1.Session.create({
            _id: (0, uuid_1.v4)(),
            tenantId: tenant._id,
            userId: user._id,
            token,
            ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim(),
            userAgent: req.headers['user-agent'] || 'unknown'
        });
        return res.status(201).json({
            message: 'Tenant and Admin User registered successfully',
            token,
            tenantId: tenant._id,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Internal server error during registration' });
    }
});
// Unified Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const user = await models_1.User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const tenant = await models_1.Tenant.findById(user.tenantId);
        const token = jsonwebtoken_1.default.sign({ userId: user._id, tenantId: user.tenantId, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        // Enforce concurrent session limit (max 3 active concurrent sessions per library)
        const activeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeSessions = await models_1.Session.find({ tenantId: user.tenantId, lastActive: { $gte: activeThreshold } }).sort({ lastActive: 1 });
        if (activeSessions.length >= 3) {
            // Rolling session lock: kick out the oldest active session
            const oldestSession = activeSessions[0];
            await models_1.Session.findByIdAndDelete(oldestSession._id);
        }
        // Save new device session
        await models_1.Session.create({
            _id: (0, uuid_1.v4)(),
            tenantId: user.tenantId,
            userId: user._id,
            token,
            ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim(),
            userAgent: req.headers['user-agent'] || 'unknown'
        });
        return res.json({
            message: 'Login successful',
            token,
            tenantId: user.tenantId,
            tenantName: tenant?.name || '',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
});
exports.default = router;
