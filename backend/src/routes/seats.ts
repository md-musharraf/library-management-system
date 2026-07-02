import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Seat, Booking, Student, Plan, Shift, WhatsappConfig, Tenant, Payment, MessageLog } from '../models'
import { formatTimeTo12h } from '../utils/time'
import { sendNotification } from '../utils/notification'

const router = Router()

// Helper to update seat status dynamically (occupied only if booked for all shifts)
const updateSeatStatus = async (tenantId: string, seatId: string) => {
  const totalShifts = await Shift.countDocuments({ tenantId })
  const activeBookingsCount = await Booking.countDocuments({ tenantId, seatId, status: 'ACTIVE' })
  const status = totalShifts > 0 && activeBookingsCount >= totalShifts ? 'OCCUPIED' : 'AVAILABLE'
  await Seat.findByIdAndUpdate(seatId, { status })
}

// Get all seats with their active bookings across all shifts
router.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    const seats = await Seat.find({ tenantId })

    // Bulk fetch all active bookings populated with student/plan/shift to avoid N+1 query
    const allActiveBookings = await Booking.find({ tenantId, status: 'ACTIVE' })
      .populate('student')
      .populate('plan')
      .populate('shift')

    // Group bookings by seatId
    const bookingsBySeatMap: Record<string, any[]> = {}
    allActiveBookings.forEach((b: any) => {
      if (b.seatId) {
        const sId = b.seatId.toString()
        if (!bookingsBySeatMap[sId]) {
          bookingsBySeatMap[sId] = []
        }
        bookingsBySeatMap[sId].push(b)
      }
    })

    // Natural sort seats in JS
    const getSeatNum = (numStr: string) => {
      const match = numStr.match(/\d+/)
      return match ? parseInt(match[0], 10) : 0
    }
    const sortedSeats = [...seats].sort((a: any, b: any) => {
      const aPrefix = a.seatNumber.replace(/\d+/g, '')
      const bPrefix = b.seatNumber.replace(/\d+/g, '')
      if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix)
      return getSeatNum(a.seatNumber) - getSeatNum(b.seatNumber)
    })

    const formatted = sortedSeats.map((s) => {
      const bookings = bookingsBySeatMap[s._id.toString()] || []
      const activeBookings = bookings.map((b: any) => ({
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
      }))

      return {
        id: s._id,
        seatNumber: s.seatNumber,
        areaName: s.areaName,
        status: s.status,
        bookings: activeBookings,
      }
    })

    return res.json(formatted)
  } catch (error) {
    console.error('Fetch seats error:', error)
    return res.status(500).json({ error: 'Internal server error fetching seats' })
  }
})

// Create a new seat
router.post('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { seatNumber, areaName } = req.body

  if (!seatNumber) {
    return res.status(400).json({ error: 'Seat number is required' })
  }

  try {
    const seatExists = await Seat.findOne({ tenantId, seatNumber })
    if (seatExists) {
      return res.status(400).json({ error: 'Seat number already exists' })
    }

    const seat = await Seat.create({
      _id: uuidv4(),
      tenantId,
      seatNumber,
      status: 'AVAILABLE',
      areaName: areaName || 'General Zone',
    })

    return res.status(201).json(seat.toJSON())
  } catch (error) {
    console.error('Create seat error:', error)
    return res.status(500).json({ error: 'Internal server error creating seat' })
  }
})

// Create seats in bulk
router.post('/bulk', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { startNumber, endNumber, prefix, areaName } = req.body

  const start = parseInt(startNumber, 10)
  const end = parseInt(endNumber, 10)
  const seatPrefix = prefix !== undefined ? String(prefix) : 'Seat-'
  const area = areaName || 'General Zone'

  if (isNaN(start) || isNaN(end) || start > end) {
    return res.status(400).json({ error: 'Valid startNumber and endNumber are required, and startNumber must be <= endNumber' })
  }

  // Cap bulk creation to 500 at a time to prevent server/database overloading
  if (end - start > 500) {
    return res.status(400).json({ error: 'Bulk creation is limited to 500 seats at a time.' })
  }

  try {
    const createdSeats = []
    const skippedSeats = []

    // Fetch existing seats to prevent duplicates
    const existingSeats = await Seat.find({ tenantId })
    const existingSeatNumbers = new Set<string>(existingSeats.map(s => String(s.seatNumber)))

    for (let i = start; i <= end; i++) {
      const seatNumber = `${seatPrefix}${i}`
      if (existingSeatNumbers.has(seatNumber)) {
        skippedSeats.push(seatNumber)
        continue
      }

      const seat = await Seat.create({
        _id: uuidv4(),
        tenantId,
        seatNumber,
        status: 'AVAILABLE',
        areaName: area,
      })
      createdSeats.push(seat)
    }

    return res.status(201).json({
      message: `Bulk creation complete. Created ${createdSeats.length} seats. Skipped ${skippedSeats.length} duplicates.`,
      createdCount: createdSeats.length,
      skippedCount: skippedSeats.length
    })
  } catch (error) {
    console.error('Bulk create seats error:', error)
    return res.status(500).json({ error: 'Internal server error creating seats in bulk' })
  }
})

// Book a seat (assign student to seat)
router.post('/book', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { studentId, seatId, planId, shiftId, startDate, paymentMode, bookAllShifts } = req.body

  if (!studentId || !seatId || !planId || !paymentMode) {
    return res.status(400).json({ error: 'studentId, seatId, planId, and paymentMode are required' })
  }

  try {
    // 1. Verify seat
    const seat = await Seat.findOne({ _id: seatId, tenantId })
    if (!seat) {
      return res.status(404).json({ error: 'Seat not found' })
    }

    // 2. Get target shifts
    let targetShifts: any[] = []
    if (bookAllShifts) {
      targetShifts = await Shift.find({ tenantId })
      if (targetShifts.length === 0) {
        return res.status(400).json({ error: 'No shifts found for this library to book.' })
      }
    } else {
      if (!shiftId) {
        return res.status(400).json({ error: 'shiftId is required when not booking all shifts.' })
      }
      const shift = await Shift.findOne({ _id: shiftId, tenantId })
      if (!shift) {
        return res.status(404).json({ error: 'Shift not found' })
      }
      targetShifts = [shift]
    }

    // 3. Check seat not already booked in any target shift
    for (const sh of targetShifts) {
      const activeShiftBooking = await Booking.findOne({
        tenantId, seatId, shiftId: sh._id, status: 'ACTIVE',
      })
      if (activeShiftBooking) {
        return res.status(400).json({ error: `Seat is already booked for shift timing: ${sh.name}.` })
      }
    }

    // 4. Verify student
    const student = await Student.findOne({ _id: studentId, tenantId })
    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // 5. Verify plan
    const plan = await Plan.findOne({ _id: planId, tenantId }) as any
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    // 6. Calculate dates
    const start = startDate ? new Date(startDate) : new Date()
    let end: Date
    if (plan.durationDays >= 28) {
      const months = Math.round(plan.durationDays / 30)
      end = new Date(start)
      const expectedDay = start.getDate()
      end.setMonth(start.getMonth() + months)
      if (end.getDate() !== expectedDay) {
        end.setDate(0)
      }
    } else {
      end = new Date(start)
      end.setDate(start.getDate() + plan.durationDays)
    }

    // 7. Create bookings and payments for each shift
    const bookings: any[] = []
    const payments: any[] = []

    for (const sh of targetShifts) {
      const booking = await Booking.create({
        _id: uuidv4(),
        tenantId,
        studentId,
        seatId,
        planId,
        startDate: start,
        endDate: end,
        shiftId: (sh as any)._id,
        status: 'ACTIVE',
      }) as any
      bookings.push(booking)

      const payment = await Payment.create({
        _id: uuidv4(),
        tenantId,
        bookingId: booking._id,
        amount: plan.price,
        paymentDate: new Date(),
        paymentMode,
        status: 'PAID',
      }) as any
      payments.push(payment)
    }

    // 8. Update seat status dynamically (OCCUPIED only if fully booked for all shifts)
    await updateSeatStatus(tenantId, seatId)

    // Try sending booking notification
    try {
      const tenant = await Tenant.findById(tenantId)
      const shiftInfoStr = bookAllShifts
        ? 'All Shifts (Full Seat)'
        : `the ${targetShifts[0].name} shift (${formatTimeTo12h(targetShifts[0].startTime)}-${formatTimeTo12h(targetShifts[0].endTime)})`

      const msg = `Hello ${(student as any).name}, your seat ${(seat as any).seatNumber} has been successfully booked at ${(tenant as any)?.name} for ${shiftInfoStr}. Your membership is valid until ${end.toLocaleDateString()}. Thank you!`
      
      // Dispatch notification in background
      sendNotification(tenantId, (student as any).phone, msg).catch((err) => {
        console.error('[AUTO BOOKING NOTIFICATION ERROR]', err)
      })
    } catch (wsErr) {
      console.error('Failed to trigger booking message:', wsErr)
    }

    return res.status(201).json({ bookings, payments })
  } catch (error) {
    console.error('Booking error:', error)
    return res.status(500).json({ error: 'Internal server error booking seat' })
  }
})

// Change a student's seat/timing booking (Releases old bookings and creates new ones)
router.post('/change-booking', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { studentId, seatId, planId, shiftId, paymentMode, bookAllShifts } = req.body

  if (!studentId || !seatId || !planId || !paymentMode) {
    return res.status(400).json({ error: 'studentId, seatId, planId, and paymentMode are required' })
  }

  try {
    // 1. Find and release all current active bookings for this student
    const activeBookings = await Booking.find({ tenantId, studentId, status: 'ACTIVE' })
    const oldSeatIds = new Set<string>()
    for (const ab of activeBookings) {
      await Booking.findByIdAndUpdate(ab._id, { status: 'COMPLETED' })
      if (ab.seatId) {
        oldSeatIds.add(ab.seatId.toString())
      }
    }

    // Update old seats status dynamically
    for (const oldSeatId of oldSeatIds) {
      await updateSeatStatus(tenantId, oldSeatId)
    }

    // 2. Book the new seat
    const seat = await Seat.findOne({ _id: seatId, tenantId })
    if (!seat) {
      return res.status(404).json({ error: 'Seat not found' })
    }

    // Get target shifts
    let targetShifts: any[] = []
    if (bookAllShifts) {
      targetShifts = await Shift.find({ tenantId })
      if (targetShifts.length === 0) {
        return res.status(400).json({ error: 'No shifts found for this library to book.' })
      }
    } else {
      if (!shiftId) {
        return res.status(400).json({ error: 'shiftId is required when not booking all shifts.' })
      }
      const shift = await Shift.findOne({ _id: shiftId, tenantId })
      if (!shift) {
        return res.status(404).json({ error: 'Shift not found' })
      }
      targetShifts = [shift]
    }

    // Check seat not already booked in target shifts
    for (const sh of targetShifts) {
      const activeShiftBooking = await Booking.findOne({
        tenantId, seatId, shiftId: sh._id, status: 'ACTIVE',
      })
      if (activeShiftBooking) {
        return res.status(400).json({ error: `Seat is already booked for shift timing: ${sh.name}.` })
      }
    }

    const student = await Student.findOne({ _id: studentId, tenantId })
    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const plan = await Plan.findOne({ _id: planId, tenantId }) as any
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    const start = new Date()
    let end: Date
    if (plan.durationDays >= 28) {
      const months = Math.round(plan.durationDays / 30)
      end = new Date(start)
      const expectedDay = start.getDate()
      end.setMonth(start.getMonth() + months)
      if (end.getDate() !== expectedDay) {
        end.setDate(0)
      }
    } else {
      end = new Date(start)
      end.setDate(start.getDate() + plan.durationDays)
    }

    const bookings: any[] = []
    const payments: any[] = []

    for (const sh of targetShifts) {
      const booking = await Booking.create({
        _id: uuidv4(),
        tenantId,
        studentId,
        seatId,
        planId,
        startDate: start,
        endDate: end,
        shiftId: (sh as any)._id,
        status: 'ACTIVE',
      }) as any
      bookings.push(booking)

      const payment = await Payment.create({
        _id: uuidv4(),
        tenantId,
        bookingId: booking._id,
        amount: plan.price,
        paymentDate: new Date(),
        paymentMode,
        status: 'PAID',
      }) as any
      payments.push(payment)
    }

    // Update new seat status dynamically
    await updateSeatStatus(tenantId, seatId)

    // Try sending booking notification
    try {
      const tenant = await Tenant.findById(tenantId)
      const shiftInfoStr = bookAllShifts
        ? 'All Shifts (Full Seat)'
        : `the ${targetShifts[0].name} shift (${formatTimeTo12h(targetShifts[0].startTime)}-${formatTimeTo12h(targetShifts[0].endTime)})`

      const msg = `Hello ${(student as any).name}, your seat ${(seat as any).seatNumber} timings have been updated at ${(tenant as any)?.name} for ${shiftInfoStr}. Valid until ${end.toLocaleDateString()}. Thank you!`
      
      // Dispatch notification in background
      sendNotification(tenantId, (student as any).phone, msg).catch((err) => {
        console.error('[AUTO TIMING UPDATE NOTIFICATION ERROR]', err)
      })
    } catch (wsErr) {
      console.error('Failed to trigger change timing message:', wsErr)
    }

    return res.status(200).json({ message: 'Seat booking timings updated successfully', bookings, payments })
  } catch (error) {
    console.error('Change booking error:', error)
    return res.status(500).json({ error: 'Internal server error changing seat booking' })
  }
})

// Release a seat booking
router.post('/release', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { seatId, bookingId } = req.body

  if (!seatId && !bookingId) {
    return res.status(400).json({ error: 'seatId or bookingId is required' })
  }

  try {
    let activeBooking: any

    if (bookingId) {
      activeBooking = await Booking.findOne({ _id: bookingId, tenantId, status: 'ACTIVE' })
    } else {
      activeBooking = await Booking.findOne({ seatId, tenantId, status: 'ACTIVE' })
    }

    if (!activeBooking) {
      return res.status(404).json({ error: 'No active booking found' })
    }

    const targetSeatId = activeBooking.seatId

    await Booking.findByIdAndUpdate(activeBooking._id, { status: 'COMPLETED' })

    // Update seat status dynamically
    await updateSeatStatus(tenantId, targetSeatId)

    return res.json({ message: 'Seat booking released successfully' })
  } catch (error) {
    console.error('Release seat error:', error)
    return res.status(500).json({ error: 'Internal server error releasing seat' })
  }
})

export default router
