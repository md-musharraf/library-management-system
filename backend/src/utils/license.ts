import crypto from 'crypto'

// Use a fallback secret if not specified in .env
const getSecret = () => process.env.LICENSE_MASTER_SECRET || 'lms-default-master-secret-key-987654321'

interface LicensePayload {
  tenantId: string
  expiresAt: number // timestamp
  type: '1YEAR' | '2YEAR'
}

/**
 * Generates a tamper-proof license key signed with HMAC-SHA256
 */
export function generateLicenseKey(tenantId: string, expiresAt: Date, type: '1YEAR' | '2YEAR'): string {
  const secret = getSecret()
  const payload: LicensePayload = {
    tenantId,
    expiresAt: expiresAt.getTime(),
    type
  }

  // Base64URL encode the JSON payload
  const payloadStr = JSON.stringify(payload)
  const payloadBase64 = Buffer.from(payloadStr).toString('base64url')

  // Generate signature
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payloadBase64)
  const signature = hmac.digest('hex')

  return `LMS-${payloadBase64}-${signature}`
}

/**
 * Validates a license key's structure and HMAC signature
 */
export function validateLicenseKey(key: string): {
  valid: boolean
  tenantId?: string
  expiresAt?: Date
  type?: '1YEAR' | '2YEAR'
  error?: string
} {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Empty license key' }
  }

  // Format: LMS-<base64url_payload>-<hex_signature>
  // Must NOT use .split('-') naively — base64url alphabet includes '-' as a valid character
  if (!key.startsWith('LMS-')) {
    return { valid: false, error: 'Invalid license key format' }
  }

  const withoutPrefix = key.slice(4) // Remove "LMS-"
  const lastDashIdx = withoutPrefix.lastIndexOf('-')
  if (lastDashIdx === -1) {
    return { valid: false, error: 'Invalid license key format' }
  }

  const payloadBase64 = withoutPrefix.slice(0, lastDashIdx)
  const signature = withoutPrefix.slice(lastDashIdx + 1)

  try {
    const secret = getSecret()

    // Verify signature first
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payloadBase64)
    const expectedSignature = hmac.digest('hex')

    if (signature !== expectedSignature) {
      return { valid: false, error: 'License signature is invalid or tampered with' }
    }

    // Decode payload
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadStr) as LicensePayload

    if (!payload.tenantId || !payload.expiresAt || !payload.type) {
      return { valid: false, error: 'Invalid license payload structure' }
    }

    const expiresAt = new Date(payload.expiresAt)

    // Check if expired
    if (expiresAt.getTime() < Date.now()) {
      return { valid: false, error: 'License key has expired', tenantId: payload.tenantId, expiresAt, type: payload.type }
    }

    return {
      valid: true,
      tenantId: payload.tenantId,
      expiresAt,
      type: payload.type
    }
  } catch (error) {
    return { valid: false, error: 'Failed to decode or parse license key' }
  }
}
