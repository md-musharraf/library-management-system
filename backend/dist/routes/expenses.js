"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const models_1 = require("../models");
const router = (0, express_1.Router)();
// Get all expenses sorted by date descending
router.get('/', async (req, res) => {
    const tenantId = req.tenantId;
    try {
        const expenses = await models_1.Expense.find({ tenantId }).sort({ date: -1 });
        return res.json(expenses);
    }
    catch (error) {
        console.error('Fetch expenses error:', error);
        return res.status(500).json({ error: 'Internal server error fetching expenses' });
    }
});
// Create an expense
router.post('/', async (req, res) => {
    const tenantId = req.tenantId;
    const { description, category, amount, date } = req.body;
    if (!description || !category || amount === undefined) {
        return res.status(400).json({ error: 'Description, category, and amount are required' });
    }
    // Validate category enum
    const validCategories = ['RENT', 'ELECTRICITY', 'INTERNET', 'SALARY', 'MAINTENANCE', 'OTHER'];
    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }
    try {
        const expense = await models_1.Expense.create({
            _id: (0, uuid_1.v4)(),
            tenantId,
            description,
            category,
            amount: Number(amount),
            date: date ? new Date(date) : new Date()
        });
        return res.status(201).json(expense);
    }
    catch (error) {
        console.error('Create expense error:', error);
        return res.status(500).json({ error: 'Internal server error creating expense' });
    }
});
// Delete an expense
router.delete('/:id', async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    try {
        const expense = await models_1.Expense.findOne({ _id: id, tenantId });
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        await models_1.Expense.findByIdAndDelete(id);
        return res.json({ message: 'Expense deleted successfully' });
    }
    catch (error) {
        console.error('Delete expense error:', error);
        return res.status(500).json({ error: 'Internal server error deleting expense' });
    }
});
exports.default = router;
