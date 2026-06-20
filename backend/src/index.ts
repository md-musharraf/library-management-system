import 'dotenv/config'
import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')
import express from 'express'
import cors from 'cors'
import { connectDB } from './db'
import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import studentRoutes from './routes/students'
import seatRoutes from './routes/seats'
import planRoutes from './routes/plans'
import shiftRoutes from './routes/shifts'
import whatsappRoutes from './routes/whatsapp'
import tenantRoutes from './routes/tenant'
import licenseRoutes from './routes/license'
import adminRoutes from './routes/admin'
import attendanceRoutes from './routes/attendance'
import expenseRoutes from './routes/expenses'
import { tenantMiddleware } from './middleware/tenant'
import { licenseCheck } from './middleware/licenseCheck'
import { authMiddleware } from './middleware/auth'

import { rateLimiter } from './middleware/rateLimiter'

const app = express()
const PORT = process.env.PORT || 5000

// CORS — allows local dev by default; set CORS_ORIGIN in env for production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173']

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: origin '${origin}' is not permitted`))
    }
  },
  credentials: true
}))

// Basic security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  next()
})

app.use(express.json())

// Apply Rate Limiting Middleware
app.use('/api/auth/login', rateLimiter(60000, 10, 'Too many login attempts from this IP. Please try again after a minute.'))
app.use('/api/auth/register-tenant', rateLimiter(60000, 5, 'Too many registration requests from this IP. Please try again after a minute.'))
app.use(rateLimiter(60000, 150))

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', version: '1.0.1-bulk-seats-v1', timestamp: new Date(), db: 'MongoDB Atlas' })
})

// Unprotected Auth & Admin routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)

// License check/activate routes (scoped to tenant, but exempt from license expiry check)
app.use('/api/license', tenantMiddleware, authMiddleware, licenseRoutes)

// Tenant Scoping + License Enforcement Middleware + JWT Auth
app.use('/api/dashboard', tenantMiddleware, authMiddleware, licenseCheck, dashboardRoutes)
app.use('/api/students', tenantMiddleware, authMiddleware, licenseCheck, studentRoutes)
app.use('/api/seats', tenantMiddleware, authMiddleware, licenseCheck, seatRoutes)
app.use('/api/plans', tenantMiddleware, authMiddleware, licenseCheck, planRoutes)
app.use('/api/shifts', tenantMiddleware, authMiddleware, licenseCheck, shiftRoutes)
app.use('/api/whatsapp', tenantMiddleware, authMiddleware, licenseCheck, whatsappRoutes)
app.use('/api/tenant', tenantMiddleware, authMiddleware, licenseCheck, tenantRoutes)
app.use('/api/attendance', tenantMiddleware, authMiddleware, licenseCheck, attendanceRoutes)
app.use('/api/expenses', tenantMiddleware, authMiddleware, licenseCheck, expenseRoutes)

// Connect to MongoDB Atlas then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 LMS SaaS Server running on http://localhost:${PORT}`)
  })
})
