import 'dotenv/config'
import mongoose from 'mongoose'
import { Tenant, User, Session, WhatsappConfig, Seat, Shift, Plan } from './models'
import { connectDB } from './db'

const BASE_URL = 'http://localhost:5000/api'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runTest() {
  console.log('Connecting to database...')
  await connectDB()

  const timestamp = Date.now()
  const testLibraryName = `Test Verification Lib ${timestamp}`
  const testEmail = `test_${timestamp}@example.com`
  const testPassword = 'Password123'
  const ownerName = 'Test Owner'
  const phone = '9999999999'
  const address = '123 Test Street'

  console.log('\n--- 1. Testing Registration of Tenant ---')
  const regResponse = await fetch(`${BASE_URL}/auth/register-tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      libraryName: testLibraryName,
      ownerName,
      phone,
      address,
      email: testEmail,
      password: testPassword
    })
  })

  if (!regResponse.ok) {
    throw new Error(`Failed to register tenant: ${await regResponse.text()}`)
  }

  const regData = await regResponse.json()
  const tenantId = regData.tenantId
  const token1 = regData.token
  console.log(`Registered tenant successfully. ID: ${tenantId}`)
  console.log(`First token (Token 1) received: ${token1.substring(0, 20)}...`)

  // Log in 2 more times to reach the 3-device limit
  console.log('\n--- 2. Creating Session 2 and Session 3 ---')
  await sleep(1000) // 1 second delay to ensure different JWT iat timestamps!

  const login2Response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  })
  const login2Data = await login2Response.json()
  const token2 = login2Data.token
  console.log(`Session 2 logged in successfully. Token: ${token2.substring(0, 20)}...`)

  await sleep(1000) // 1 second delay to ensure different JWT iat timestamps!
  const login3Response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  })
  const login3Data = await login3Response.json()
  const token3 = login3Data.token
  console.log(`Session 3 logged in successfully. Token: ${token3.substring(0, 20)}...`)

  // Verify all 3 sessions are active in DB
  const sessionsCount = await Session.countDocuments({ tenantId })
  console.log(`Active sessions in DB: ${sessionsCount} (Expected: 3)`)
  if (sessionsCount !== 3) {
    throw new Error(`Expected 3 active sessions, found ${sessionsCount}`)
  }

  console.log('\n--- 3. Logging in a 4th Session (Should evict Session 1) ---')
  await sleep(1000) // 1 second delay
  const login4Response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  })
  const login4Data = await login4Response.json()
  const token4 = login4Data.token
  console.log(`Session 4 logged in successfully. Token: ${token4.substring(0, 20)}...`)

  // Verify Token 1 is kicked out (should return 401)
  console.log('\n--- 4. Verifying Token 1 is now Invalid/Evicted ---')
  const checkToken1Evicted = await fetch(`${BASE_URL}/tenant/profile`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'X-Tenant-ID': tenantId
    }
  })
  console.log(`Token 1 access status: ${checkToken1Evicted.status} (Expected: 401)`)
  const errorData = await checkToken1Evicted.json()
  console.log(`Token 1 error message: ${JSON.stringify(errorData)}`)
  if (checkToken1Evicted.status !== 401) {
    throw new Error(`Expected Token 1 to be evicted (401), got status ${checkToken1Evicted.status}`)
  }

  // Verify Token 2 is still active (should return 200)
  console.log('\n--- 5. Verifying Token 2 is still Active ---')
  const checkToken2Active = await fetch(`${BASE_URL}/tenant/profile`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'X-Tenant-ID': tenantId
    }
  })
  console.log(`Token 2 validity check status: ${checkToken2Active.status} (Expected: 200)`)
  if (checkToken2Active.status !== 200) {
    throw new Error(`Expected Token 2 to be active (200), got status ${checkToken2Active.status}`)
  }

  console.log('\n--- 6. Logging in Developer Admin and Revoking License ---')
  const adminLoginRes = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  })
  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${await adminLoginRes.text()}`)
  }
  const adminData = await adminLoginRes.json()
  const adminToken = adminData.token
  console.log(`Admin logged in successfully. Admin Token: ${adminToken.substring(0, 20)}...`)

  const revokeRes = await fetch(`${BASE_URL}/admin/revoke-license`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ tenantId })
  })
  if (!revokeRes.ok) {
    throw new Error(`Revoke license failed: ${await revokeRes.text()}`)
  }
  const revokeData = await revokeRes.json()
  console.log(`Revoke license API response: ${JSON.stringify(revokeData)}`)

  console.log('\n--- 7. Verifying Workspace is Locked (Token 2 should get 403 LICENSE_EXPIRED) ---')
  const checkToken2Locked = await fetch(`${BASE_URL}/tenant/profile`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'X-Tenant-ID': tenantId
    }
  })
  console.log(`Token 2 status after revocation: ${checkToken2Locked.status} (Expected: 403)`)
  const lockedData = await checkToken2Locked.json()
  console.log(`Token 2 error after revocation: ${JSON.stringify(lockedData)}`)
  if (checkToken2Locked.status !== 403 || lockedData.error !== 'LICENSE_EXPIRED') {
    throw new Error(`Expected 403 LICENSE_EXPIRED, got status ${checkToken2Locked.status} and error ${JSON.stringify(lockedData)}`)
  }

  console.log('\n--- 8. Cleaning up test data from Database ---')
  const deleteSessions = await Session.deleteMany({ tenantId })
  console.log(`Deleted ${deleteSessions.deletedCount} sessions`)

  const deleteUser = await User.deleteMany({ tenantId })
  console.log(`Deleted ${deleteUser.deletedCount} users`)

  const deleteWhatsapp = await WhatsappConfig.deleteMany({ tenantId })
  console.log(`Deleted ${deleteWhatsapp.deletedCount} whatsapp configs`)

  const deleteSeats = await Seat.deleteMany({ tenantId })
  console.log(`Deleted ${deleteSeats.deletedCount} seats`)

  const deleteShifts = await Shift.deleteMany({ tenantId })
  console.log(`Deleted ${deleteShifts.deletedCount} shifts`)

  const deletePlans = await Plan.deleteMany({ tenantId })
  console.log(`Deleted ${deletePlans.deletedCount} plans`)

  const deleteTenant = await Tenant.deleteOne({ _id: tenantId })
  console.log(`Deleted ${deleteTenant.deletedCount} tenant`)

  console.log('\n✅ All tests passed successfully! Workspace locking and session limit functions verified.')
}

runTest()
  .catch(err => {
    console.error('\n❌ Test execution failed:', err)
  })
  .finally(async () => {
    await mongoose.disconnect()
    console.log('Database disconnected.')
  })
