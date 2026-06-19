import { Request, Response, NextFunction } from 'express'
import { Tenant } from '../models'

// Extend Express Request interface to include tenantId and user
declare global {
  namespace Express {
    interface Request {
      tenantId?: string
      userId?: string
      userRole?: string
    }
  }
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // Exclude auth routes from tenant check
  if (req.path.startsWith('/api/auth')) {
    return next()
  }

  const tenantId = req.headers['x-tenant-id'] as string

  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is missing' })
  }

  try {
    const tenantExists = await Tenant.findById(tenantId)

    if (!tenantExists) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    req.tenantId = tenantId
    next()
  } catch (error) {
    console.error('Error validating tenant ID:', error)
    return res.status(500).json({ error: 'Internal server error validating tenant context' })
  }
}
