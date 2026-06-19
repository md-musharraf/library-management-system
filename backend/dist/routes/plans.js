"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const router = (0, express_1.Router)();
// Get all plans with their shift info
router.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    try {
        const plans = await models_1.Plan.find({ tenantId }).populate('shiftId').sort({ price: 1 });
        const formatted = plans.map((p) => ({
            id: p._id,
            tenantId: p.tenantId,
            name: p.name,
            durationDays: p.durationDays,
            price: p.price,
            shiftId: p.shiftId?._id || p.shiftId,
            shift: p.shiftId,
            createdAt: p.createdAt,
        }));
        return res.json(formatted);
    }
    catch (error) {
        console.error('Fetch plans error:', error);
        return res.status(500).json({ error: 'Internal server error fetching plans' });
    }
});
// Create plan
router.post('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { name, durationDays, price, shiftId } = req.body;
    if (!name || !durationDays || !price || !shiftId) {
        return res.status(400).json({ error: 'All fields (name, durationDays, price, shiftId) are required' });
    }
    try {
        const plan = await models_1.Plan.create({
            _id: (0, uuid_1.v4)(),
            tenantId,
            name,
            durationDays: Number(durationDays),
            price: Number(price),
            shiftId,
        });
        const populated = await models_1.Plan.findById(plan._id).populate('shiftId');
        const p = populated;
        return res.status(201).json({
            id: p._id,
            tenantId: p.tenantId,
            name: p.name,
            durationDays: p.durationDays,
            price: p.price,
            shiftId: p.shiftId?._id || p.shiftId,
            shift: p.shiftId,
        });
    }
    catch (error) {
        console.error('Create plan error:', error);
        return res.status(500).json({ error: 'Internal server error creating plan' });
    }
});
// Delete plan
router.delete('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    try {
        const plan = await models_1.Plan.findOne({ _id: id, tenantId });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        const activeBookings = await models_1.Booking.countDocuments({ planId: id, tenantId, status: 'ACTIVE' });
        if (activeBookings > 0) {
            return res.status(400).json({ error: 'Cannot delete plan because active students are assigned to it' });
        }
        await models_1.Plan.findByIdAndDelete(id);
        return res.json({ message: 'Plan deleted successfully' });
    }
    catch (error) {
        console.error('Delete plan error:', error);
        return res.status(500).json({ error: 'Internal server error deleting plan' });
    }
});
// Update plan
router.put('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, durationDays, price, shiftId } = req.body;
    try {
        const plan = await models_1.Plan.findOne({ _id: id, tenantId });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        if (shiftId) {
            const shiftExists = await models_1.Shift.findOne({ _id: shiftId, tenantId });
            if (!shiftExists) {
                return res.status(400).json({ error: 'Selected shift timing not found' });
            }
        }
        const updated = await models_1.Plan.findByIdAndUpdate(id, {
            name: name !== undefined ? name : plan.name,
            durationDays: durationDays !== undefined ? Number(durationDays) : plan.durationDays,
            price: price !== undefined ? Number(price) : plan.price,
            shiftId: shiftId !== undefined ? shiftId : plan.shiftId,
        }, { new: true }).populate('shiftId');
        const p = updated;
        return res.json({
            id: p._id,
            tenantId: p.tenantId,
            name: p.name,
            durationDays: p.durationDays,
            price: p.price,
            shiftId: p.shiftId?._id || p.shiftId,
            shift: p.shiftId,
        });
    }
    catch (error) {
        console.error('Update plan error:', error);
        return res.status(500).json({ error: 'Internal server error updating plan' });
    }
});
exports.default = router;
