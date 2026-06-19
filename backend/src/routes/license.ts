import { Router, Request, Response } from 'express'
import { Tenant } from '../models'
import { validateLicenseKey } from '../utils/license'

const router = Router()

/**
 * GET /api/license/status
 * Check current tenant's license status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const tenant = await Tenant.findById(req.tenantId)
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const t = tenant as any
    const now = new Date()
    const expiry = t.licenseExpiry ? new Date(t.licenseExpiry) : null
    
    if (!expiry) {
      return res.json({
        valid: false,
        type: t.licenseType || 'NONE',
        expiresAt: null,
        daysLeft: 0,
        message: 'No active license found.'
      })
    }

    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isValid = expiry.getTime() > now.getTime()

    return res.json({
      valid: isValid,
      type: t.licenseType || 'TRIAL',
      expiresAt: expiry,
      daysLeft: isValid ? Math.max(0, daysLeft) : 0,
      message: isValid ? 'License is active.' : 'License has expired.'
    })
  } catch (error) {
    console.error('Error fetching license status:', error)
    return res.status(500).json({ error: 'Internal server error checking license status' })
  }
})

/**
 * POST /api/license/activate
 * Activate a license key for this tenant
 */
router.post('/activate', async (req: Request, res: Response) => {
  const { licenseKey } = req.body

  if (!licenseKey) {
    return res.status(400).json({ error: 'License key is required' })
  }

  try {
    const validation = validateLicenseKey(licenseKey)

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error || 'Invalid license key' })
    }

    // Verify key belongs to this tenant
    if (validation.tenantId !== req.tenantId) {
      return res.status(400).json({ error: 'This license key was generated for a different library.' })
    }

    // Update tenant license info
    const tenant = await Tenant.findById(req.tenantId)
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const t = tenant as any
    t.licenseKey = licenseKey
    t.licenseExpiry = validation.expiresAt
    t.licenseType = validation.type
    await tenant.save()

    return res.json({
      success: true,
      message: `License activated successfully! Type: ${validation.type}`,
      type: validation.type,
      expiresAt: validation.expiresAt
    })
  } catch (error) {
    console.error('Error activating license:', error)
    return res.status(500).json({ error: 'Internal server error activating license key' })
  }
})

export default router
