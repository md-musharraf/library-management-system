import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Plan, Shift, Booking } from '../models'

const router = Router()

// Get all plans with their shift info
router.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    const plans = await Plan.find({ tenantId }).populate('shiftId').sort({ price: 1 })

    const formatted = plans.map((p: any) => ({
      id: p._id,
      tenantId: p.tenantId,
      name: p.name,
      durationDays: p.durationDays,
      price: p.price,
      shiftId: p.shiftId?._id || p.shiftId,
      shift: p.shiftId,
      createdAt: p.createdAt,
    }))

    return res.json(formatted)
  } catch (error) {
    console.error('Fetch plans error:', error)
    return res.status(500).json({ error: 'Internal server error fetching plans' })
  }
})

// Create plan
router.post('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { name, durationDays, price, shiftId } = req.body

  if (!name || !durationDays || !price || !shiftId) {
    return res.status(400).json({ error: 'All fields (name, durationDays, price, shiftId) are required' })
  }

  try {
    const plan = await Plan.create({
      _id: uuidv4(),
      tenantId,
      name,
      durationDays: Number(durationDays),
      price: Number(price),
      shiftId,
    })

    const populated = await Plan.findById(plan._id).populate('shiftId')
    const p = populated as any
    return res.status(201).json({
      id: p._id,
      tenantId: p.tenantId,
      name: p.name,
      durationDays: p.durationDays,
      price: p.price,
      shiftId: p.shiftId?._id || p.shiftId,
      shift: p.shiftId,
    })
  } catch (error) {
    console.error('Create plan error:', error)
    return res.status(500).json({ error: 'Internal server error creating plan' })
  }
})

// Delete plan
router.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params

  try {
    const plan = await Plan.findOne({ _id: id, tenantId })

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    const activeBookings = await Booking.countDocuments({ planId: id, tenantId, status: 'ACTIVE' })
    if (activeBookings > 0) {
      return res.status(400).json({ error: 'Cannot delete plan because active students are assigned to it' })
    }

    await Plan.findByIdAndDelete(id)
    return res.json({ message: 'Plan deleted successfully' })
  } catch (error) {
    console.error('Delete plan error:', error)
    return res.status(500).json({ error: 'Internal server error deleting plan' })
  }
})

// Update plan
router.put('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params
  const { name, durationDays, price, shiftId } = req.body

  try {
    const plan = await Plan.findOne({ _id: id, tenantId })

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    if (shiftId) {
      const shiftExists = await Shift.findOne({ _id: shiftId, tenantId })
      if (!shiftExists) {
        return res.status(400).json({ error: 'Selected shift timing not found' })
      }
    }

    const updated = await Plan.findByIdAndUpdate(
      id,
      {
        name: name !== undefined ? name : plan.name,
        durationDays: durationDays !== undefined ? Number(durationDays) : plan.durationDays,
        price: price !== undefined ? Number(price) : plan.price,
        shiftId: shiftId !== undefined ? shiftId : plan.shiftId,
      },
      { new: true }
    ).populate('shiftId')

    const p = updated as any
    return res.json({
      id: p._id,
      tenantId: p.tenantId,
      name: p.name,
      durationDays: p.durationDays,
      price: p.price,
      shiftId: p.shiftId?._id || p.shiftId,
      shift: p.shiftId,
    })
  } catch (error) {
    console.error('Update plan error:', error)
    return res.status(500).json({ error: 'Internal server error updating plan' })
  }
})

export default router
