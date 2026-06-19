"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const time_1 = require("../utils/time");
const router = (0, express_1.Router)();
// Get all seats with their active bookings across all shifts
router.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    try {
        const seats = await models_1.Seat.find({ tenantId }).sort({ seatNumber: 1 });
        const formatted = await Promise.all(seats.map(async (s) => {
            const bookings = await models_1.Booking.find({ tenantId, seatId: s._id, status: 'ACTIVE' })
                .populate('student')
                .populate('plan')
                .populate('shift');
            const activeBookings = bookings.map((b) => ({
                id: b._id,
                studentId: b.studentId,
                studentName: b.student?.name,
                studentPhone: b.student?.phone,
                studentRegNo: b.student?.registrationNo,
                planName: b.plan?.name,
                shiftId: b.shiftId,
                shiftName: b.shift?.name,
                shiftStartTime: b.shift?.startTime,
                shiftEndTime: b.shift?.endTime,
                startDate: b.startDate,
                endDate: b.endDate,
            }));
            return {
                id: s._id,
                seatNumber: s.seatNumber,
                areaName: s.areaName,
                status: s.status,
                bookings: activeBookings,
            };
        }));
        return res.json(formatted);
    }
    catch (error) {
        console.error('Fetch seats error:', error);
        return res.status(500).json({ error: 'Internal server error fetching seats' });
    }
});
// Create a new seat
router.post('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { seatNumber, areaName } = req.body;
    if (!seatNumber) {
        return res.status(400).json({ error: 'Seat number is required' });
    }
    try {
        const seatExists = await models_1.Seat.findOne({ tenantId, seatNumber });
        if (seatExists) {
            return res.status(400).json({ error: 'Seat number already exists' });
        }
        const seat = await models_1.Seat.create({
            _id: (0, uuid_1.v4)(),
            tenantId,
            seatNumber,
            status: 'AVAILABLE',
            areaName: areaName || 'General Zone',
        });
        return res.status(201).json(seat.toJSON());
    }
    catch (error) {
        console.error('Create seat error:', error);
        return res.status(500).json({ error: 'Internal server error creating seat' });
    }
});
// Book a seat (assign student to seat)
router.post('/book', async (req, res) => {
    const tenantId = req.tenantId;
    const { studentId, seatId, planId, shiftId, startDate, paymentMode, bookAllShifts } = req.body;
    if (!studentId || !seatId || !planId || !paymentMode) {
        return res.status(400).json({ error: 'studentId, seatId, planId, and paymentMode are required' });
    }
    try {
        // 1. Verify seat
        const seat = await models_1.Seat.findOne({ _id: seatId, tenantId });
        if (!seat) {
            return res.status(404).json({ error: 'Seat not found' });
        }
        // 2. Get target shifts
        let targetShifts = [];
        if (bookAllShifts) {
            targetShifts = await models_1.Shift.find({ tenantId });
            if (targetShifts.length === 0) {
                return res.status(400).json({ error: 'No shifts found for this library to book.' });
            }
        }
        else {
            if (!shiftId) {
                return res.status(400).json({ error: 'shiftId is required when not booking all shifts.' });
            }
            const shift = await models_1.Shift.findOne({ _id: shiftId, tenantId });
            if (!shift) {
                return res.status(404).json({ error: 'Shift not found' });
            }
            targetShifts = [shift];
        }
        // 3. Check seat not already booked in any target shift
        for (const sh of targetShifts) {
            const activeShiftBooking = await models_1.Booking.findOne({
                tenantId, seatId, shiftId: sh._id, status: 'ACTIVE',
            });
            if (activeShiftBooking) {
                return res.status(400).json({ error: `Seat is already booked for shift timing: ${sh.name}.` });
            }
        }
        // 4. Verify student
        const student = await models_1.Student.findOne({ _id: studentId, tenantId });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // 5. Verify plan
        const plan = await models_1.Plan.findOne({ _id: planId, tenantId });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        // 6. Calculate dates
        const start = startDate ? new Date(startDate) : new Date();
        let end;
        if (plan.durationDays >= 28) {
            const months = Math.round(plan.durationDays / 30);
            end = new Date(start);
            const expectedDay = start.getDate();
            end.setMonth(start.getMonth() + months);
            if (end.getDate() !== expectedDay) {
                end.setDate(0);
            }
        }
        else {
            end = new Date(start);
            end.setDate(start.getDate() + plan.durationDays);
        }
        // 7. Create bookings and payments for each shift
        const bookings = [];
        const payments = [];
        for (const sh of targetShifts) {
            const booking = await models_1.Booking.create({
                _id: (0, uuid_1.v4)(),
                tenantId,
                studentId,
                seatId,
                planId,
                startDate: start,
                endDate: end,
                shiftId: sh._id,
                status: 'ACTIVE',
            });
            bookings.push(booking);
            const payment = await models_1.Payment.create({
                _id: (0, uuid_1.v4)(),
                tenantId,
                bookingId: booking._id,
                amount: plan.price,
                paymentDate: new Date(),
                paymentMode,
                status: 'PAID',
            });
            payments.push(payment);
        }
        // 8. Mark seat occupied
        await models_1.Seat.findByIdAndUpdate(seatId, { status: 'OCCUPIED' });
        // Try sending booking WhatsApp
        try {
            const config = await models_1.WhatsappConfig.findOne({ tenantId });
            const tenant = await models_1.Tenant.findById(tenantId);
            if (config && config.apiUrl && config.token) {
                const shiftInfoStr = bookAllShifts
                    ? 'All Shifts (Full Seat)'
                    : `the ${targetShifts[0].name} shift (${(0, time_1.formatTimeTo12h)(targetShifts[0].startTime)}-${(0, time_1.formatTimeTo12h)(targetShifts[0].endTime)})`;
                const msg = `Hello ${student.name}, your seat ${seat.seatNumber} has been successfully booked at ${tenant?.name} for ${shiftInfoStr}. Your membership is valid until ${end.toLocaleDateString()}. Thank you!`;
                console.log(`[WHATSAPP AUTOMATION] Sending booking success message: ${msg}`);
                await models_1.MessageLog.create({
                    _id: (0, uuid_1.v4)(),
                    tenantId,
                    recipient: student.phone,
                    message: msg,
                    status: 'SENT',
                });
            }
        }
        catch (wsErr) {
            console.error('Failed to trigger booking WhatsApp message:', wsErr);
        }
        return res.status(201).json({ bookings, payments });
    }
    catch (error) {
        console.error('Booking error:', error);
        return res.status(500).json({ error: 'Internal server error booking seat' });
    }
});
// Release a seat booking
router.post('/release', async (req, res) => {
    const tenantId = req.tenantId;
    const { seatId, bookingId } = req.body;
    if (!seatId && !bookingId) {
        return res.status(400).json({ error: 'seatId or bookingId is required' });
    }
    try {
        let activeBooking;
        if (bookingId) {
            activeBooking = await models_1.Booking.findOne({ _id: bookingId, tenantId, status: 'ACTIVE' });
        }
        else {
            activeBooking = await models_1.Booking.findOne({ seatId, tenantId, status: 'ACTIVE' });
        }
        if (!activeBooking) {
            return res.status(404).json({ error: 'No active booking found' });
        }
        const targetSeatId = activeBooking.seatId;
        await models_1.Booking.findByIdAndUpdate(activeBooking._id, { status: 'COMPLETED' });
        // Check if any other bookings remain on this seat
        const remainingBookings = await models_1.Booking.countDocuments({ seatId: targetSeatId, tenantId, status: 'ACTIVE' });
        if (remainingBookings === 0) {
            await models_1.Seat.findByIdAndUpdate(targetSeatId, { status: 'AVAILABLE' });
        }
        return res.json({ message: 'Seat booking released successfully' });
    }
    catch (error) {
        console.error('Release seat error:', error);
        return res.status(500).json({ error: 'Internal server error releasing seat' });
    }
});
exports.default = router;
