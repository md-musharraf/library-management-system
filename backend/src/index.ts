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
import { tenantMiddleware } from './middleware/tenant'
import { licenseCheck } from './middleware/licenseCheck'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date(), db: 'MongoDB Atlas' })
})

// Unprotected Auth & Admin routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)

// License check/activate routes (scoped to tenant, but exempt from license expiry check)
app.use('/api/license', tenantMiddleware, licenseRoutes)

// Tenant Scoping + License Enforcement Middleware (Scopes all routes below to a tenant and blocks if expired)
app.use('/api/dashboard', tenantMiddleware, licenseCheck, dashboardRoutes)
app.use('/api/students', tenantMiddleware, licenseCheck, studentRoutes)
app.use('/api/seats', tenantMiddleware, licenseCheck, seatRoutes)
app.use('/api/plans', tenantMiddleware, licenseCheck, planRoutes)
app.use('/api/shifts', tenantMiddleware, licenseCheck, shiftRoutes)
app.use('/api/whatsapp', tenantMiddleware, licenseCheck, whatsappRoutes)
app.use('/api/tenant', tenantMiddleware, licenseCheck, tenantRoutes)
app.use('/api/attendance', tenantMiddleware, licenseCheck, attendanceRoutes)

// Connect to MongoDB Atlas then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 LMS SaaS Server running on http://localhost:${PORT}`)
  })
})
