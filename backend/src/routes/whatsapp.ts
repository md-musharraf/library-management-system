import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { WhatsappConfig, MessageLog, Booking, Tenant, Payment, Student } from '../models'
import { formatTimeTo12h } from '../utils/time'
import { sendNotification } from '../utils/notification'

const router = Router()

// Get config (creates default if not exists)
router.get('/config', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    let config = await WhatsappConfig.findOne({ tenantId })

    if (!config) {
      config = await WhatsappConfig.create({
        _id: uuidv4(),
        tenantId,
        apiUrl: '',
        token: '',
        providerType: 'ULTRAMSG',
        notificationChannel: 'MANUAL_WHATSAPP',
        fast2smsApiKey: '',
        templateWelcome: 'Hello {student_name}, welcome to {library_name}! Your registration code is {registration_no}.',
        templateExpiry: 'Dear {student_name}, your seat {seat_number} subscription ({shift} shift) at {library_name} expires on {expiry_date}. Please renew.',
        expiryDaysAlert: 3,
      })
    }

    return res.json(config.toJSON())
  } catch (error) {
    console.error('Fetch whatsapp config error:', error)
    return res.status(500).json({ error: 'Internal server error fetching config' })
  }
})

// Update config (upsert)
router.post('/config', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { 
    apiUrl, token, providerType, templateWelcome, 
    templateExpiry, expiryDaysAlert, notificationChannel, fast2smsApiKey 
  } = req.body

  if (notificationChannel && !['MANUAL_WHATSAPP', 'API_WHATSAPP', 'SMS'].includes(notificationChannel)) {
    return res.status(400).json({ error: 'Invalid notification channel selected' })
  }

  try {
    const updated = await WhatsappConfig.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          apiUrl: apiUrl ?? '',
          token: token ?? '',
          providerType: providerType ?? 'ULTRAMSG',
          notificationChannel: notificationChannel ?? 'MANUAL_WHATSAPP',
          fast2smsApiKey: fast2smsApiKey ?? '',
          templateWelcome: templateWelcome ?? '',
          templateExpiry: templateExpiry ?? '',
          expiryDaysAlert: expiryDaysAlert ? Number(expiryDaysAlert) : 3,
        },
        $setOnInsert: { _id: uuidv4(), tenantId },
      },
      { upsert: true, new: true }
    )

    return res.json(updated?.toJSON())
  } catch (error) {
    console.error('Update whatsapp config error:', error)
    return res.status(500).json({ error: 'Internal server error updating config' })
  }
})

// Get message logs
router.get('/logs', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!

  try {
    const logs = await MessageLog.find({ tenantId }).sort({ sentAt: -1 }).limit(50)
    return res.json(logs.map((l) => l.toJSON()))
  } catch (error) {
    console.error('Fetch logs error:', error)
    return res.status(500).json({ error: 'Internal server error fetching logs' })
  }
})

// Send manual expiry alert
router.post('/send-manual', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { bookingId } = req.body

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' })
  }

  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId })
      .populate('student')
      .populate('seat')
      .populate('plan')
      .populate('shift')

    if (!booking) {
      return res.status(404).json({ error: 'Active booking not found' })
    }

    const config = await WhatsappConfig.findOne({ tenantId })

    const tenant = await Tenant.findById(tenantId)
    const b = booking as any

    const payments = await Payment.find({ bookingId })
    const paid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0)
    const due = Math.max(0, b.plan?.price - paid)

    const formattedExpiryDate = new Date(b.endDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    const compiledMessage = (config as any || { templateExpiry: '' }).templateExpiry
      .replace('{student_name}', b.student?.name || '')
      .replace('{seat_number}', b.seat?.seatNumber || '')
      .replace('{shift}', `${b.shift?.name} (${formatTimeTo12h(b.shift?.startTime)}-${formatTimeTo12h(b.shift?.endTime)})`)
      .replace('{expiry_date}', formattedExpiryDate)
      .replace('{due_amount}', due.toFixed(2))
      .replace('{library_name}', ((tenant as any)?.name as string) || 'Library')

    const dispatchResult = await sendNotification(tenantId, b.student?.phone, compiledMessage)

    return res.json({
      message: dispatchResult.mode === 'MANUAL' 
        ? 'Manual WhatsApp prepared' 
        : `${dispatchResult.mode} message sent successfully`,
      ...dispatchResult
    })
  } catch (error: any) {
    console.error('Manual expiry alert send error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error triggering message alert' })
  }
})

// Send custom manual alert to any student
router.post('/send-custom', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const { studentId, message } = req.body

  if (!studentId || !message) {
    return res.status(400).json({ error: 'studentId and message are required' })
  }

  try {
    const student = await Student.findOne({ _id: studentId, tenantId }) as any
    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const dispatchResult = await sendNotification(tenantId, student.phone, message)

    return res.json({
      message: dispatchResult.mode === 'MANUAL' 
        ? 'Manual WhatsApp prepared' 
        : `${dispatchResult.mode} message sent successfully`,
      ...dispatchResult
    })
  } catch (error: any) {
    console.error('Custom alert send error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error triggering message alert' })
  }
})

export default router
