import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Tenant, Student } from '../models'
import { generateLicenseKey } from '../utils/license'

const router = Router()

// Admin Secret Config
const getAdminUsername = () => process.env.ADMIN_USERNAME || 'admin'
const getAdminPassword = () => process.env.ADMIN_PASSWORD || 'admin123'
const getJwtSecret = () => process.env.JWT_SECRET || 'jwt-default-secret-key-123456789'

// Admin authentication middleware
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Admin token missing.' })
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin access required.' })
    }
    next()
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired admin token.' })
  }
}

/**
 * POST /api/admin/login
 * Log in as developer admin
 */
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  const adminUser = getAdminUsername()
  const adminPass = getAdminPassword()

  if (username === adminUser && password === adminPass) {
    const token = jwt.sign(
      { role: 'admin', username },
      getJwtSecret(),
      { expiresIn: '7d' }
    )
    return res.json({ success: true, token })
  } else {
    return res.status(401).json({ error: 'Invalid username or password' })
  }
})

/**
 * GET /api/admin/tenants
 * List all tenants with license status and student count
 */
router.get('/tenants', adminAuth, async (req: Request, res: Response) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 })
    const tenantList = []

    for (const tenant of tenants) {
      const t = tenant as any
      
      // Calculate student count
      const studentCount = await Student.countDocuments({ tenantId: t._id })

      // Determine license status
      const now = new Date()
      let expiry = t.licenseExpiry ? new Date(t.licenseExpiry) : null
      
      if (!expiry) {
        // Fallback: 30 days trial from createdAt
        const createdAt = t.createdAt ? new Date(t.createdAt) : now
        expiry = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      }

      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const isExpired = expiry.getTime() < now.getTime()

      tenantList.push({
        id: t._id,
        name: t.name,
        ownerName: t.ownerName,
        phone: t.phone,
        address: t.address,
        logoUrl: t.logoUrl,
        lastRegNo: t.lastRegNo,
        licenseKey: t.licenseKey || null,
        licenseExpiry: expiry,
        licenseType: t.licenseType || 'TRIAL',
        trialStartedAt: t.trialStartedAt || t.createdAt,
        studentCount,
        daysLeft: isExpired ? 0 : daysLeft,
        isExpired
      })
    }

    return res.json({ success: true, tenants: tenantList })
  } catch (error) {
    console.error('Error fetching admin tenants:', error)
    return res.status(500).json({ error: 'Internal server error fetching client dashboard' })
  }
})

/**
 * POST /api/admin/generate-license
 * Generate a license key and auto-apply it to the tenant
 */
router.post('/generate-license', adminAuth, async (req: Request, res: Response) => {
  const { tenantId, type } = req.body

  if (!tenantId || !type) {
    return res.status(400).json({ error: 'Tenant ID and license type are required' })
  }

  if (type !== '1YEAR' && type !== '2YEAR') {
    return res.status(400).json({ error: 'License type must be 1YEAR or 2YEAR' })
  }

  try {
    const tenant = await Tenant.findById(tenantId)
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const t = tenant as any
    const now = new Date()
    let baseDate = now

    // If tenant already has a valid active license, extend it. Otherwise, start from now.
    if (t.licenseExpiry && new Date(t.licenseExpiry).getTime() > now.getTime()) {
      baseDate = new Date(t.licenseExpiry)
    }

    let durationMs = 365 * 24 * 60 * 60 * 1000 // 1 year
    if (type === '2YEAR') {
      durationMs = 2 * 365 * 24 * 60 * 60 * 1000 // 2 years
    }

    const expiresAt = new Date(baseDate.getTime() + durationMs)
    const key = generateLicenseKey(tenantId, expiresAt, type)

    // Save back to database (auto-activate)
    t.licenseKey = key
    t.licenseExpiry = expiresAt
    t.licenseType = type
    await tenant.save()

    return res.json({
      success: true,
      licenseKey: key,
      expiresAt,
      type
    })
  } catch (error) {
    console.error('Error generating license key:', error)
    return res.status(500).json({ error: 'Internal server error generating license key' })
  }
})

// Revoke/Delete License (Locks workspace instantly)
router.post('/revoke-license', adminAuth, async (req: Request, res: Response) => {
  const { tenantId } = req.body

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' })
  }

  try {
    const tenant = await Tenant.findById(tenantId)
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const t = tenant as any
    // Set expiry to past date (Jan 1, 1970) to instantly lock the workspace
    t.licenseExpiry = new Date(0) 
    t.licenseKey = null
    t.licenseType = 'REVOKED'
    await tenant.save()

    return res.json({
      success: true,
      message: 'License revoked successfully. Tenant workspace locked.'
    })
  } catch (error) {
    console.error('Error revoking license:', error)
    return res.status(500).json({ error: 'Internal server error revoking license' })
  }
})

export default router
