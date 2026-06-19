import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Shift, Plan, Booking } from '../models'

const router = Router()

// Get all shifts
router.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    const shifts = await Shift.find({ tenantId }).sort({ startTime: 1 })
    return res.json(shifts.map((s) => ({ ...s.toJSON(), id: s._id })))
  } catch (error) {
    console.error('Fetch shifts error:', error)
    return res.status(500).json({ error: 'Internal server error fetching shifts' })
  }
})

// Create a new shift
router.post('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { name, startTime, endTime } = req.body

  if (!name || !startTime || !endTime) {
    return res.status(400).json({ error: 'All fields (name, startTime, endTime) are required' })
  }

  try {
    const shift = await Shift.create({
      _id: uuidv4(),
      tenantId,
      name,
      startTime,
      endTime,
    })
    return res.status(201).json({ ...shift.toJSON(), id: shift._id })
  } catch (error) {
    console.error('Create shift error:', error)
    return res.status(500).json({ error: 'Internal server error creating shift' })
  }
})

// Update a shift
router.put('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params
  const { name, startTime, endTime } = req.body

  try {
    const shift = await Shift.findOne({ _id: id, tenantId })

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' })
    }

    const updated = await Shift.findByIdAndUpdate(
      id,
      {
        name: name !== undefined ? name : shift.name,
        startTime: startTime !== undefined ? startTime : shift.startTime,
        endTime: endTime !== undefined ? endTime : shift.endTime,
      },
      { new: true }
    )

    return res.json({ ...updated?.toJSON(), id: updated?._id })
  } catch (error) {
    console.error('Update shift error:', error)
    return res.status(500).json({ error: 'Internal server error updating shift' })
  }
})

// Delete a shift
router.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params

  try {
    const shift = await Shift.findOne({ _id: id, tenantId })

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' })
    }

    const linkedPlans = await Plan.countDocuments({ shiftId: id, tenantId })
    if (linkedPlans > 0) {
      return res.status(400).json({ error: 'Cannot delete shift because membership plans are linked to it.' })
    }

    const activeBookings = await Booking.countDocuments({ shiftId: id, tenantId, status: 'ACTIVE' })
    if (activeBookings > 0) {
      return res.status(400).json({ error: 'Cannot delete shift because active student bookings are assigned to it.' })
    }

    await Shift.findByIdAndDelete(id)
    return res.json({ message: 'Shift deleted successfully' })
  } catch (error) {
    console.error('Delete shift error:', error)
    return res.status(500).json({ error: 'Internal server error deleting shift' })
  }
})

export default router
