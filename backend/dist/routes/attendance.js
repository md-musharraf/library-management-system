"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const router = (0, express_1.Router)();
/**
 * POST /api/attendance/check-in
 * Check in a student by registration number
 */
router.post('/check-in', async (req, res) => {
    const tenantId = req.tenantId;
    const { registrationNo } = req.body;
    if (!registrationNo) {
        return res.status(400).json({ error: 'Registration number is required' });
    }
    try {
        // 1. Find active student
        const student = await models_1.Student.findOne({ registrationNo: registrationNo.trim(), tenantId });
        if (!student) {
            return res.status(404).json({ error: 'Registration number not found' });
        }
        if (student.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'This student workspace is marked inactive' });
        }
        // 2. Check if student already has an open check-in today
        const todayStr = new Date().toISOString().split('T')[0];
        const openCheckIn = await models_1.Attendance.findOne({
            tenantId,
            studentId: student._id,
            date: todayStr,
            checkOut: { $exists: false }
        });
        if (openCheckIn) {
            return res.status(400).json({ error: `${student.name} is already checked in.` });
        }
        // 3. Find if student has active booking to display seat info
        const activeBooking = await models_1.Booking.findOne({ tenantId, studentId: student._id, status: 'ACTIVE' }).populate('seat');
        // 4. Create check-in record
        const attendance = new models_1.Attendance({
            _id: (0, uuid_1.v4)(),
            tenantId,
            studentId: student._id,
            checkIn: new Date(),
            date: todayStr
        });
        await attendance.save();
        return res.json({
            success: true,
            message: 'Checked in successfully!',
            studentName: student.name,
            checkInTime: attendance.checkIn,
            seatNumber: activeBooking?.seat?.seatNumber || 'Unassigned',
            shiftName: activeBooking?.shift?.name || 'N/A'
        });
    }
    catch (error) {
        console.error('Check-in error:', error);
        return res.status(500).json({ error: 'Internal server error processing check-in' });
    }
});
/**
 * POST /api/attendance/check-out
 * Check out a student by registration number
 */
router.post('/check-out', async (req, res) => {
    const tenantId = req.tenantId;
    const { registrationNo } = req.body;
    if (!registrationNo) {
        return res.status(400).json({ error: 'Registration number is required' });
    }
    try {
        // 1. Find student
        const student = await models_1.Student.findOne({ registrationNo: registrationNo.trim(), tenantId });
        if (!student) {
            return res.status(404).json({ error: 'Registration number not found' });
        }
        // 2. Find their open check-in record (latest one where checkOut is missing)
        const openLog = await models_1.Attendance.findOne({
            tenantId,
            studentId: student._id,
            checkOut: { $exists: false }
        }).sort({ checkIn: -1 });
        if (!openLog) {
            return res.status(400).json({ error: `${student.name} does not have an active Check-In record.` });
        }
        // 3. Update Check-out timestamp
        const now = new Date();
        openLog.checkOut = now;
        await openLog.save();
        // Calculate duration
        const diffMs = now.getTime() - new Date(openLog.checkIn).getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return res.json({
            success: true,
            message: 'Checked out successfully!',
            studentName: student.name,
            checkOutTime: now,
            duration: `${hours}h ${minutes}m`
        });
    }
    catch (error) {
        console.error('Check-out error:', error);
        return res.status(500).json({ error: 'Internal server error processing check-out' });
    }
});
/**
 * GET /api/attendance/today
 * Get all check-in/out logs for today
 */
router.get('/today', async (req, res) => {
    const tenantId = req.tenantId;
    const todayStr = new Date().toISOString().split('T')[0];
    try {
        const logs = await models_1.Attendance.find({ tenantId, date: todayStr })
            .populate('student')
            .sort({ checkIn: -1 });
        const formatted = await Promise.all(logs.map(async (l) => {
            const activeBooking = await models_1.Booking.findOne({ tenantId, studentId: l.studentId, status: 'ACTIVE' }).populate('seat');
            return {
                id: l._id,
                studentId: l.studentId,
                studentName: l.student?.name || 'Deleted Student',
                registrationNo: l.student?.registrationNo || 'N/A',
                phone: l.student?.phone || 'N/A',
                seatNumber: activeBooking?.seat?.seatNumber || 'Unassigned',
                checkIn: l.checkIn,
                checkOut: l.checkOut || null
            };
        }));
        return res.json(formatted);
    }
    catch (error) {
        console.error('Fetch today attendance error:', error);
        return res.status(500).json({ error: 'Internal server error fetching today logs' });
    }
});
/**
 * GET /api/attendance/history
 * Fetch historical logs with filters
 */
router.get('/history', async (req, res) => {
    const tenantId = req.tenantId;
    const { startDate, endDate, search } = req.query;
    try {
        const query = { tenantId };
        if (startDate && endDate) {
            query.date = { $gte: String(startDate), $lte: String(endDate) };
        }
        const logs = await models_1.Attendance.find(query)
            .populate('student')
            .sort({ checkIn: -1 });
        let formatted = await Promise.all(logs.map(async (l) => {
            const activeBooking = await models_1.Booking.findOne({ tenantId, studentId: l.studentId, status: 'ACTIVE' }).populate('seat');
            return {
                id: l._id,
                studentId: l.studentId,
                studentName: l.student?.name || 'Deleted Student',
                registrationNo: l.student?.registrationNo || 'N/A',
                phone: l.student?.phone || 'N/A',
                seatNumber: activeBooking?.seat?.seatNumber || 'Unassigned',
                checkIn: l.checkIn,
                checkOut: l.checkOut || null,
                date: l.date
            };
        }));
        // Filter by student name/regNo if search is supplied
        if (search) {
            const s = String(search).toLowerCase();
            formatted = formatted.filter(f => f.studentName.toLowerCase().includes(s) || f.registrationNo.toLowerCase().includes(s));
        }
        return res.json(formatted);
    }
    catch (error) {
        console.error('Fetch attendance history error:', error);
        return res.status(500).json({ error: 'Internal server error fetching history logs' });
    }
});
exports.default = router;
