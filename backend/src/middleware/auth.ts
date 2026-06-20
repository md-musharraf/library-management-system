import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Session } from '../models'

const JWT_SECRET = process.env.JWT_SECRET || 'lms-super-secret-jwt-key'

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Exclude unprotected auth routes
  if (req.path.startsWith('/api/auth')) {
    return next()
  }

  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.userId = decoded.userId
    req.userRole = decoded.role

    // Verify token tenant matches request tenant to prevent tenant cross-talk (BOLA protection)
    const requestTenantId = req.headers['x-tenant-id'] as string
    if (requestTenantId && decoded.tenantId !== requestTenantId) {
      return res.status(403).json({ error: 'Access denied. Tenant context mismatch.' })
    }

    // Verify that the session is active in the database (enforces device limits & revocation)
    const session = await Session.findOne({ token })
    if (!session) {
      return res.status(401).json({ error: 'Session expired or logged out from another device.' })
    }

    // Keep session alive in the background using updateOne to avoid Mongoose VersionError and database write bottlenecks
    Session.updateOne({ _id: session._id }, { $set: { lastActive: new Date() } }).catch(err => {
      console.error('Failed to update session lastActive:', err)
    })

    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' })
  }
}
