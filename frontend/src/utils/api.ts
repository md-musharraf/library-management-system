const BASE_URL = 'http://localhost:5000/api'

interface RequestOptions extends RequestInit {
  body?: any
}

async function request(path: string, options: RequestOptions = {}) {
  const token = localStorage.getItem('lms_token')
  const tenantId = localStorage.getItem('lms_tenant_id')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMsg = errorData.error || `HTTP error! Status: ${response.status}`

    // Automatically handle session eviction on authentication or tenant context failures
    if (
      response.status === 401 || 
      (response.status === 404 && errorMsg.toLowerCase().includes('tenant not found'))
    ) {
      localStorage.removeItem('lms_token')
      localStorage.removeItem('lms_tenant_id')
      localStorage.removeItem('lms_tenant_name')
      window.location.reload()
    }

    // Instantly lock workspace if license is revoked or expired
    if (response.status === 403 && errorData.error === 'LICENSE_EXPIRED') {
      window.location.reload()
    }

    throw new Error(errorMsg)
  }

  return response.json()
}

export const api = {
  get: (path: string, options?: RequestInit) => request(path, { ...options, method: 'GET' }),
  post: (path: string, body: any, options?: RequestInit) => request(path, { ...options, method: 'POST', body }),
  put: (path: string, body: any, options?: RequestInit) => request(path, { ...options, method: 'PUT', body }),
  delete: (path: string, options?: RequestInit) => request(path, { ...options, method: 'DELETE' }),
}
