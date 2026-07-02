import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Student, Tenant, Booking, Payment, WhatsappConfig, MessageLog } from '../models'
import { formatTimeTo12h } from '../utils/time'
import { getNextRegNo } from '../utils/regNo'
import { sendNotification } from '../utils/notification'

const router = Router()

// Get all students (with optional search filter)
router.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { search } = req.query

  try {
    let query: any = { tenantId }

    if (search) {
      const s = String(search)
      const escapedSearch = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
        { registrationNo: { $regex: escapedSearch, $options: 'i' } },
      ]
    }

    const students = await Student.find(query).sort({ createdAt: -1 })

    // Bulk fetch all active bookings for this tenant to avoid N+1 query
    const activeBookings = await Booking.find({ tenantId, status: 'ACTIVE' })
      .populate('seat')
      .populate('plan')
      .populate('shift')

    // Map active bookings by studentId
    const bookingByStudentMap: Record<string, any> = {}
    activeBookings.forEach((b: any) => {
      if (b.studentId) {
        bookingByStudentMap[b.studentId.toString()] = b
      }
    })

    // Bulk fetch payments for all active bookings scoped by tenantId
    const activeBookingIds = activeBookings.map(b => b._id.toString())
    const payments = await Payment.find({ tenantId, bookingId: { $in: activeBookingIds } })

    // Group payments by bookingId
    const paymentsByBookingMap: Record<string, any[]> = {}
    payments.forEach((p: any) => {
      if (p.bookingId) {
        const bId = p.bookingId.toString()
        if (!paymentsByBookingMap[bId]) {
          paymentsByBookingMap[bId] = []
        }
        paymentsByBookingMap[bId].push(p)
      }
    })

    const formatted = students.map((s) => {
      const activeBooking = bookingByStudentMap[s._id.toString()] || null

      let hasDues = false
      let dueAmount = 0

      if (activeBooking) {
        const bookingPayments = paymentsByBookingMap[activeBooking._id.toString()] || []
        hasDues = bookingPayments.some(p => p.status === 'DUE')
        dueAmount = bookingPayments.filter(p => p.status === 'DUE').reduce((sum, p) => sum + p.amount, 0)
      } else {
        // If no active booking, consider it as pending/inactive (needs new booking)
        hasDues = true
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
          ? `${formatTimeTo12h(activeBooking.shift?.startTime)}-${formatTimeTo12h(activeBooking.shift?.endTime)}`
          : null,
        hasActiveBooking: !!activeBooking,
        hasDues,
        dueAmount,
      }
    })

    return res.json(formatted)
  } catch (error) {
    console.error('Fetch students error:', error)
    return res.status(500).json({ error: 'Internal server error fetching students' })
  }
})

// Create new student
router.post('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { name, phone, email, registrationNo: customRegNo, aadharNo } = req.body

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and Phone number are required' })
  }

  if (aadharNo && !/^\d{12}$/.test(aadharNo.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Aadhar number must be exactly 12 digits' })
  }

  try {
    let registrationNo: string

    if (customRegNo && customRegNo.trim()) {
      const existing = await Student.findOne({ registrationNo: customRegNo.trim().toUpperCase(), tenantId })
      if (existing) {
        return res.status(400).json({ error: `Registration number '${customRegNo.trim().toUpperCase()}' is already in use` })
      }
      registrationNo = customRegNo.trim().toUpperCase()
    } else {
      const tenant = await Tenant.findById(tenantId) as any
      let candidate = getNextRegNo(tenant?.lastRegNo as string | null)

      let attempts = 0
      while (attempts < 50) {
        const clash = await Student.findOne({ registrationNo: candidate, tenantId })
        if (!clash) break
        candidate = getNextRegNo(candidate)
        attempts++
      }
      registrationNo = candidate
    }

    const student = new Student({
      _id: uuidv4(),
      tenantId,
      name,
      phone,
      email: email || undefined,
      registrationNo,
      aadharNo: aadharNo ? aadharNo.replace(/\s/g, '') : undefined,
      status: 'ACTIVE',
    })
    await student.save()

    // Update lastRegNo
    await Tenant.findByIdAndUpdate(tenantId, { lastRegNo: registrationNo })

    let welcomeMessagePayload = null

    // Try sending welcome Alert
    try {
      const config = await WhatsappConfig.findOne({ tenantId }) as any
      const tenant = await Tenant.findById(tenantId) as any
      const channel = config?.notificationChannel || 'MANUAL_WHATSAPP'

      if (config && config.templateWelcome) {
        const msg = (config.templateWelcome as string)
          .replace('{student_name}', (student as any).name)
          .replace('{registration_no}', (student as any).registrationNo)
          .replace('{library_name}', (tenant?.name as string) || 'Library')

        if (channel === 'MANUAL_WHATSAPP') {
          welcomeMessagePayload = {
            shouldSendManual: true,
            phone: (student as any).phone.replace(/[^0-9]/g, ''),
            message: msg
          }
        } else {
          // Send automatically in background
          sendNotification(tenantId, (student as any).phone, msg).catch((err) => {
            console.error('[AUTO WELCOME ERROR]', err)
          })
        }
      }
    } catch (wsErr) {
      console.error('Failed to trigger welcome message:', wsErr)
    }

    return res.status(201).json({
      ...student.toJSON(),
      welcomeMessage: welcomeMessagePayload
    })
  } catch (error) {
    console.error('Create student error:', error)
    return res.status(500).json({ error: 'Internal server error creating student' })
  }
})

// Get single student details with bookings
router.get('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params

  try {
    const student = await Student.findOne({ _id: id, tenantId })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const bookings = await Booking.find({ tenantId, studentId: id })
      .populate('seat')
      .populate('plan')
      .populate('shift')
      .sort({ startDate: -1 })

    const bookingsWithPayments = await Promise.all(
      bookings.map(async (b) => {
        const payments = await Payment.find({ bookingId: b._id })
        return { ...b.toJSON(), payments }
      })
    )

    return res.json({ ...student.toJSON(), bookings: bookingsWithPayments })
  } catch (error) {
    console.error('Fetch student error:', error)
    return res.status(500).json({ error: 'Internal server error fetching student details' })
  }
})

// Update student details
router.put('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params
  const { name, phone, email, status, registrationNo: customRegNo, aadharNo } = req.body

  if (aadharNo && !/^\d{12}$/.test(aadharNo.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Aadhar number must be exactly 12 digits' })
  }

  try {
    const student = await Student.findOne({ _id: id, tenantId })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    let registrationNo = student.registrationNo
    if (customRegNo && customRegNo.trim() && customRegNo.trim() !== student.registrationNo) {
      const existing = await Student.findOne({ registrationNo: customRegNo.trim(), tenantId, _id: { $ne: id } })
      if (existing) {
        return res.status(400).json({ error: `Registration number '${customRegNo.trim()}' is already in use` })
      }
      registrationNo = customRegNo.trim()
    }

    const updated = await Student.findByIdAndUpdate(
      id,
      {
        name: name !== undefined ? name : student.name,
        phone: phone !== undefined ? phone : student.phone,
        email: email !== undefined ? email : student.email,
        status: status !== undefined ? status : student.status,
        registrationNo,
        aadharNo: aadharNo !== undefined ? (aadharNo ? aadharNo.replace(/\s/g, '') : undefined) : student.aadharNo,
      },
      { new: true }
    )

    return res.json(updated?.toJSON())
  } catch (error) {
    console.error('Update student error:', error)
    return res.status(500).json({ error: 'Internal server error updating student' })
  }
})

// Delete student
router.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { id } = req.params

  try {
    const student = await Student.findOne({ _id: id, tenantId })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const activeBookings = await Booking.find({ tenantId, studentId: id, status: 'ACTIVE' })
    if (activeBookings.length > 0) {
      return res.status(400).json({ error: 'Cannot delete student with active seat bookings.' })
    }

    // Delete all related records
    const bookings = await Booking.find({ tenantId, studentId: id })
    const bookingIds = bookings.map((b) => b._id) as string[]
    await Payment.deleteMany({ bookingId: { $in: bookingIds } } as any)
    await Booking.deleteMany({ tenantId, studentId: id })
    await Student.findByIdAndDelete(id)

    return res.json({ message: 'Student and related records deleted successfully' })
  } catch (error) {
    console.error('Delete student error:', error)
    return res.status(500).json({ error: 'Internal server error deleting student' })
  }
})

export default router
