"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const time_1 = require("../utils/time");
const regNo_1 = require("../utils/regNo");
const notification_1 = require("../utils/notification");
const router = (0, express_1.Router)();
// Get all students (with optional search filter)
router.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { search } = req.query;
    try {
        let query = { tenantId };
        if (search) {
            const s = String(search);
            const escapedSearch = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { phone: { $regex: escapedSearch, $options: 'i' } },
                { registrationNo: { $regex: escapedSearch, $options: 'i' } },
            ];
        }
        const students = await models_1.Student.find(query).sort({ createdAt: -1 });
        // Bulk fetch all active bookings for this tenant to avoid N+1 query
        const activeBookings = await models_1.Booking.find({ tenantId, status: 'ACTIVE' })
            .populate('seat')
            .populate('plan')
            .populate('shift');
        // Map active bookings by studentId
        const bookingByStudentMap = {};
        activeBookings.forEach((b) => {
            if (b.studentId) {
                bookingByStudentMap[b.studentId.toString()] = b;
            }
        });
        // Bulk fetch payments for all active bookings scoped by tenantId
        const activeBookingIds = activeBookings.map(b => b._id.toString());
        const payments = await models_1.Payment.find({ tenantId, bookingId: { $in: activeBookingIds } });
        // Group payments by bookingId
        const paymentsByBookingMap = {};
        payments.forEach((p) => {
            if (p.bookingId) {
                const bId = p.bookingId.toString();
                if (!paymentsByBookingMap[bId]) {
                    paymentsByBookingMap[bId] = [];
                }
                paymentsByBookingMap[bId].push(p);
            }
        });
        const formatted = students.map((s) => {
            const activeBooking = bookingByStudentMap[s._id.toString()] || null;
            let hasDues = false;
            let dueAmount = 0;
            if (activeBooking) {
                const bookingPayments = paymentsByBookingMap[activeBooking._id.toString()] || [];
                hasDues = bookingPayments.some(p => p.status === 'DUE');
                dueAmount = bookingPayments.filter(p => p.status === 'DUE').reduce((sum, p) => sum + p.amount, 0);
            }
            else {
                // If no active booking, consider it as pending/inactive (needs new booking)
                hasDues = true;
            }
            return {
                id: s._id,
                name: s.name,
                phone: s.phone,
                email: s.email,
                registrationNo: s.registrationNo,
                aadharNo: s.aadharNo,
                status: s.status,
                createdAt: s.createdAt,
                activeSeat: activeBooking ? activeBooking.seat?.seatNumber : null,
                activePlan: activeBooking ? activeBooking.plan?.name : null,
                activeShift: activeBooking ? activeBooking.shift?.name : null,
                activeShiftId: activeBooking ? activeBooking.shiftId : null,
                activeShiftTime: activeBooking
                    ? `${(0, time_1.formatTimeTo12h)(activeBooking.shift?.startTime)}-${(0, time_1.formatTimeTo12h)(activeBooking.shift?.endTime)}`
                    : null,
                hasActiveBooking: !!activeBooking,
                hasDues,
                dueAmount,
            };
        });
        return res.json(formatted);
    }
    catch (error) {
        console.error('Fetch students error:', error);
        return res.status(500).json({ error: 'Internal server error fetching students' });
    }
});
// Create new student
router.post('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { name, phone, email, registrationNo: customRegNo, aadharNo } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and Phone number are required' });
    }
    if (aadharNo && !/^\d{12}$/.test(aadharNo.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Aadhar number must be exactly 12 digits' });
    }
    try {
        let registrationNo;
        if (customRegNo && customRegNo.trim()) {
            const existing = await models_1.Student.findOne({ registrationNo: customRegNo.trim().toUpperCase(), tenantId });
            if (existing) {
                return res.status(400).json({ error: `Registration number '${customRegNo.trim().toUpperCase()}' is already in use` });
            }
            registrationNo = customRegNo.trim().toUpperCase();
        }
        else {
            const tenant = await models_1.Tenant.findById(tenantId);
            let candidate = (0, regNo_1.getNextRegNo)(tenant?.lastRegNo);
            let attempts = 0;
            while (attempts < 50) {
                const clash = await models_1.Student.findOne({ registrationNo: candidate, tenantId });
                if (!clash)
                    break;
                candidate = (0, regNo_1.getNextRegNo)(candidate);
                attempts++;
            }
            registrationNo = candidate;
        }
        const student = new models_1.Student({
            _id: (0, uuid_1.v4)(),
            tenantId,
            name,
            phone,
            email: email || undefined,
            registrationNo,
            aadharNo: aadharNo ? aadharNo.replace(/\s/g, '') : undefined,
            status: 'ACTIVE',
        });
        await student.save();
        // Update lastRegNo
        await models_1.Tenant.findByIdAndUpdate(tenantId, { lastRegNo: registrationNo });
        let welcomeMessagePayload = null;
        // Try sending welcome Alert
        try {
            const config = await models_1.WhatsappConfig.findOne({ tenantId });
            const tenant = await models_1.Tenant.findById(tenantId);
            const channel = config?.notificationChannel || 'MANUAL_WHATSAPP';
            if (config && config.templateWelcome) {
                const msg = config.templateWelcome
                    .replace('{student_name}', student.name)
                    .replace('{registration_no}', student.registrationNo)
                    .replace('{library_name}', tenant?.name || 'Library');
                if (channel === 'MANUAL_WHATSAPP') {
                    welcomeMessagePayload = {
                        shouldSendManual: true,
                        phone: student.phone.replace(/[^0-9]/g, ''),
                        message: msg
                    };
                }
                else {
                    // Send automatically in background
                    (0, notification_1.sendNotification)(tenantId, student.phone, msg).catch((err) => {
                        console.error('[AUTO WELCOME ERROR]', err);
                    });
                }
            }
        }
        catch (wsErr) {
            console.error('Failed to trigger welcome message:', wsErr);
        }
        return res.status(201).json({
            ...student.toJSON(),
            welcomeMessage: welcomeMessagePayload
        });
    }
    catch (error) {
        console.error('Create student error:', error);
        return res.status(500).json({ error: 'Internal server error creating student' });
    }
});
// Get single student details with bookings
router.get('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    try {
        const student = await models_1.Student.findOne({ _id: id, tenantId });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const bookings = await models_1.Booking.find({ tenantId, studentId: id })
            .populate('seat')
            .populate('plan')
            .populate('shift')
            .sort({ startDate: -1 });
        const bookingsWithPayments = await Promise.all(bookings.map(async (b) => {
            const payments = await models_1.Payment.find({ bookingId: b._id });
            return { ...b.toJSON(), payments };
        }));
        return res.json({ ...student.toJSON(), bookings: bookingsWithPayments });
    }
    catch (error) {
        console.error('Fetch student error:', error);
        return res.status(500).json({ error: 'Internal server error fetching student details' });
    }
});
// Update student details
router.put('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, phone, email, status, registrationNo: customRegNo, aadharNo } = req.body;
    if (aadharNo && !/^\d{12}$/.test(aadharNo.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Aadhar number must be exactly 12 digits' });
    }
    try {
        const student = await models_1.Student.findOne({ _id: id, tenantId });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        let registrationNo = student.registrationNo;
        if (customRegNo && customRegNo.trim() && customRegNo.trim() !== student.registrationNo) {
            const existing = await models_1.Student.findOne({ registrationNo: customRegNo.trim(), tenantId, _id: { $ne: id } });
            if (existing) {
                return res.status(400).json({ error: `Registration number '${customRegNo.trim()}' is already in use` });
            }
            registrationNo = customRegNo.trim();
        }
        const updated = await models_1.Student.findByIdAndUpdate(id, {
            name: name !== undefined ? name : student.name,
            phone: phone !== undefined ? phone : student.phone,
            email: email !== undefined ? email : student.email,
            status: status !== undefined ? status : student.status,
            registrationNo,
            aadharNo: aadharNo !== undefined ? (aadharNo ? aadharNo.replace(/\s/g, '') : undefined) : student.aadharNo,
        }, { new: true });
        return res.json(updated?.toJSON());
    }
    catch (error) {
        console.error('Update student error:', error);
        return res.status(500).json({ error: 'Internal server error updating student' });
    }
});
// Delete student
router.delete('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    try {
        const student = await models_1.Student.findOne({ _id: id, tenantId });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const activeBookings = await models_1.Booking.find({ tenantId, studentId: id, status: 'ACTIVE' });
        if (activeBookings.length > 0) {
            return res.status(400).json({ error: 'Cannot delete student with active seat bookings.' });
        }
        // Delete all related records
        const bookings = await models_1.Booking.find({ tenantId, studentId: id });
        const bookingIds = bookings.map((b) => b._id);
        await models_1.Payment.deleteMany({ bookingId: { $in: bookingIds } });
        await models_1.Booking.deleteMany({ tenantId, studentId: id });
        await models_1.Student.findByIdAndDelete(id);
        return res.json({ message: 'Student and related records deleted successfully' });
    }
    catch (error) {
        console.error('Delete student error:', error);
        return res.status(500).json({ error: 'Internal server error deleting student' });
    }
});
exports.default = router;
