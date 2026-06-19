"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const router = (0, express_1.Router)();
// Get all shifts
router.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    try {
        const shifts = await models_1.Shift.find({ tenantId }).sort({ startTime: 1 });
        return res.json(shifts.map((s) => ({ ...s.toJSON(), id: s._id })));
    }
    catch (error) {
        console.error('Fetch shifts error:', error);
        return res.status(500).json({ error: 'Internal server error fetching shifts' });
    }
});
// Create a new shift
router.post('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { name, startTime, endTime } = req.body;
    if (!name || !startTime || !endTime) {
        return res.status(400).json({ error: 'All fields (name, startTime, endTime) are required' });
    }
    try {
        const shift = await models_1.Shift.create({
            _id: (0, uuid_1.v4)(),
            tenantId,
            name,
            startTime,
            endTime,
        });
        return res.status(201).json({ ...shift.toJSON(), id: shift._id });
    }
    catch (error) {
        console.error('Create shift error:', error);
        return res.status(500).json({ error: 'Internal server error creating shift' });
    }
});
// Update a shift
router.put('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, startTime, endTime } = req.body;
    try {
        const shift = await models_1.Shift.findOne({ _id: id, tenantId });
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        const updated = await models_1.Shift.findByIdAndUpdate(id, {
            name: name !== undefined ? name : shift.name,
            startTime: startTime !== undefined ? startTime : shift.startTime,
            endTime: endTime !== undefined ? endTime : shift.endTime,
        }, { new: true });
        return res.json({ ...updated?.toJSON(), id: updated?._id });
    }
    catch (error) {
        console.error('Update shift error:', error);
        return res.status(500).json({ error: 'Internal server error updating shift' });
    }
});
// Delete a shift
router.delete('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    try {
        const shift = await models_1.Shift.findOne({ _id: id, tenantId });
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        const linkedPlans = await models_1.Plan.countDocuments({ shiftId: id, tenantId });
        if (linkedPlans > 0) {
            return res.status(400).json({ error: 'Cannot delete shift because membership plans are linked to it.' });
        }
        const activeBookings = await models_1.Booking.countDocuments({ shiftId: id, tenantId, status: 'ACTIVE' });
        if (activeBookings > 0) {
            return res.status(400).json({ error: 'Cannot delete shift because active student bookings are assigned to it.' });
        }
        await models_1.Shift.findByIdAndDelete(id);
        return res.json({ message: 'Shift deleted successfully' });
    }
    catch (error) {
        console.error('Delete shift error:', error);
        return res.status(500).json({ error: 'Internal server error deleting shift' });
    }
});
exports.default = router;
