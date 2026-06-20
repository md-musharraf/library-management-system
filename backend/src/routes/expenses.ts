import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Expense } from '../models'

const router = Router()

// Get all expenses sorted by date descending
router.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    const expenses = await Expense.find({ tenantId }).sort({ date: -1 })
    return res.json(expenses)
  } catch (error) {
    console.error('Fetch expenses error:', error)
    return res.status(500).json({ error: 'Internal server error fetching expenses' })
  }
})

// Create an expense
router.post('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { description, category, amount, date } = req.body

  if (!description || !category || amount === undefined) {
    return res.status(400).json({ error: 'Description, category, and amount are required' })
  }

  // Validate category enum
  const validCategories = ['RENT', 'ELECTRICITY', 'INTERNET', 'SALARY', 'MAINTENANCE', 'OTHER']
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` })
  }

  try {
    const expense = await Expense.create({
      _id: uuidv4(),
      tenantId,
      description,
      category,
      amount: Number(amount),
      date: date ? new Date(date) : new Date()
    })

    return res.status(201).json(expense)
  } catch (error) {
    console.error('Create expense error:', error)
    return res.status(500).json({ error: 'Internal server error creating expense' })
  }
})

// Delete an expense
router.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params

  try {
    const expense = await Expense.findOne({ _id: id, tenantId })

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' })
    }

    await Expense.findByIdAndDelete(id)
    return res.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Delete expense error:', error)
    return res.status(500).json({ error: 'Internal server error deleting expense' })
  }
})

export default router
