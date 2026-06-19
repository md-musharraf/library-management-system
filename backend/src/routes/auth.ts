import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { Tenant, User, WhatsappConfig, Seat, Shift, Plan } from '../models'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'lms-super-secret-jwt-key'

// Tenant & Admin User Registration
router.post('/register-tenant', async (req: Request, res: Response) => {
  const { libraryName, ownerName, phone, address, email, password } = req.body

  if (!libraryName || !ownerName || !phone || !address || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // 1. Create Tenant with a 30-day Trial License
    const tenant = new Tenant({
      _id: uuidv4(),
      name: libraryName,
      ownerName,
      phone,
      address,
      licenseType: 'TRIAL',
      licenseExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      trialStartedAt: new Date(),
    }) as any
    await tenant.save()

    // 2. Create Admin User
    const user = new User({
      _id: uuidv4(),
      tenantId: tenant._id,
      name: ownerName,
      email,
      password: hashedPassword,
      role: 'ADMIN',
    }) as any
    await user.save()

    // 3. Create Default WhatsApp Config
    await WhatsappConfig.create({
      _id: uuidv4(),
      tenantId: tenant._id,
      apiUrl: 'https://api.ultramsg.com/instance-placeholder',
      token: 'your-auth-token',
      providerType: 'ULTRAMSG',
      templateWelcome: 'Hello {student_name}, welcome to {library_name}! Your registration code is {registration_no}.',
      templateExpiry: 'Dear {student_name}, your seat {seat_number} subscription ({shift} shift) at {library_name} expires on {expiry_date}. Please renew.',
      expiryDaysAlert: 3,
    })

    // 4. Create default 10 seats
    for (let i = 1; i <= 10; i++) {
      await Seat.create({
        _id: uuidv4(),
        tenantId: tenant._id,
        seatNumber: `Seat-${i}`,
        status: 'AVAILABLE',
        areaName: 'General Hall',
      })
    }

    // 5. Create 3 default shifts
    const shiftA = await Shift.create({
      _id: uuidv4(),
      tenantId: tenant._id,
      name: 'Shift A',
      startTime: '06:00',
      endTime: '11:00',
    }) as any
    const shiftB = await Shift.create({
      _id: uuidv4(),
      tenantId: tenant._id,
      name: 'Shift B',
      startTime: '11:00',
      endTime: '16:00',
    }) as any
    const shiftC = await Shift.create({
      _id: uuidv4(),
      tenantId: tenant._id,
      name: 'Shift C',
      startTime: '16:00',
      endTime: '21:00',
    }) as any

    // 6. Create default plans
    await Plan.create([
      { _id: uuidv4(), tenantId: tenant._id, name: 'Monthly Shift A (6-11)', durationDays: 30, price: 800, shiftId: shiftA._id },
      { _id: uuidv4(), tenantId: tenant._id, name: 'Monthly Shift B (11-4)', durationDays: 30, price: 800, shiftId: shiftB._id },
      { _id: uuidv4(), tenantId: tenant._id, name: 'Monthly Shift C (4-9)', durationDays: 30, price: 800, shiftId: shiftC._id },
    ])

    const token = jwt.sign(
      { userId: user._id, tenantId: tenant._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(201).json({
      message: 'Tenant and Admin User registered successfully',
      token,
      tenantId: tenant._id,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({ error: 'Internal server error during registration' })
  }
})

// Unified Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const user = await User.findOne({ email }) as any

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const passwordMatch = await bcrypt.compare(password, user.password as string)
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const tenant = await Tenant.findById(user.tenantId)

    const token = jwt.sign(
      { userId: user._id, tenantId: user.tenantId, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({
      message: 'Login successful',
      token,
      tenantId: user.tenantId,
      tenantName: tenant?.name || '',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Internal server error during login' })
  }
})

export default router
