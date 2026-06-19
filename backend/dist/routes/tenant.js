"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const regNo_1 = require("../utils/regNo");
const router = (0, express_1.Router)();
// Get tenant profile details
router.get('/profile', async (req, res) => {
    const tenantId = req.tenantId;
    try {
        const tenant = await models_1.Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        return res.json(tenant.toJSON());
    }
    catch (error) {
        console.error('Fetch tenant error:', error);
        return res.status(500).json({ error: 'Internal server error fetching tenant profile' });
    }
});
// Update tenant profile details (including lastRegNo)
router.put('/profile', async (req, res) => {
    const tenantId = req.tenantId;
    const { name, ownerName, phone, address, logoUrl, lastRegNo } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Library name is required' });
    }
    try {
        const updateData = { name };
        if (ownerName !== undefined)
            updateData.ownerName = ownerName;
        if (phone !== undefined)
            updateData.phone = phone;
        if (address !== undefined)
            updateData.address = address;
        if (logoUrl !== undefined)
            updateData.logoUrl = logoUrl;
        if (lastRegNo !== undefined)
            updateData.lastRegNo = lastRegNo.trim() || undefined;
        const updated = await models_1.Tenant.findByIdAndUpdate(tenantId, updateData, { new: true });
        return res.json(updated?.toJSON());
    }
    catch (error) {
        console.error('Update tenant error:', error);
        return res.status(500).json({ error: 'Internal server error updating tenant profile' });
    }
});
// Get current registration number settings + preview of next auto-generated reg no
router.get('/reg-settings', async (req, res) => {
    const tenantId = req.tenantId;
    try {
        const tenant = await models_1.Tenant.findById(tenantId).select('lastRegNo');
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        const lastRegNo = tenant.lastRegNo || null;
        const nextRegNo = (0, regNo_1.getNextRegNo)(lastRegNo);
        return res.json({ lastRegNo, nextRegNo });
    }
    catch (error) {
        console.error('Fetch reg settings error:', error);
        return res.status(500).json({ error: 'Internal server error fetching reg settings' });
    }
});
exports.default = router;
