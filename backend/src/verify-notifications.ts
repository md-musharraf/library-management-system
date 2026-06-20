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
  const testLibraryName = `Test Notification Lib ${timestamp}`
  const testEmail = `test_notify_${timestamp}@example.com`
  const testPassword = 'Password123'
  const ownerName = 'Test Owner'
  const phone = '919999999999' // 12 digit phone number for clean testing
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
  const token = regData.token
  console.log(`Tenant registered successfully. ID: ${tenantId}`)

  console.log('\n--- 2. Registering Student under MANUAL_WHATSAPP (Default) ---')
  const regStudentManualRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      name: 'Rohan Sharma',
      phone: '919876543211'
    })
  })
  if (!regStudentManualRes.ok) {
    throw new Error(`Failed to register student: ${await regStudentManualRes.text()}`)
  }
  const studentManualData = await regStudentManualRes.json()
  console.log(`Registered Student: ${JSON.stringify(studentManualData)}`)
  console.log(`Welcome Message Response Payload: ${JSON.stringify(studentManualData.welcomeMessage)}`)

  if (!studentManualData.welcomeMessage || studentManualData.welcomeMessage.shouldSendManual !== true) {
    throw new Error('Expected shouldSendManual to be true for default configuration!')
  }

  console.log('\n--- 3. Fetching Config to Verify Default Fields ---')
  const getConfigRes = await fetch(`${BASE_URL}/whatsapp/config`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    }
  })
  const configData = await getConfigRes.json()
  console.log(`Fetched Config: ${JSON.stringify(configData)}`)
  if (configData.notificationChannel !== 'MANUAL_WHATSAPP' || configData.fast2smsApiKey !== '') {
    throw new Error('Config default values are incorrect!')
  }

  console.log('\n--- 4. Updating Config to SMS Mode ---')
  const updateConfigRes = await fetch(`${BASE_URL}/whatsapp/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      notificationChannel: 'SMS',
      fast2smsApiKey: 'mock-fast2sms-api-key-xyz'
    })
  })
  const updatedConfigData = await updateConfigRes.json()
  console.log(`Updated Config: ${JSON.stringify(updatedConfigData)}`)
  if (updatedConfigData.notificationChannel !== 'SMS' || updatedConfigData.fast2smsApiKey !== 'mock-fast2sms-api-key-xyz') {
    throw new Error('Config failed to update to SMS!')
  }

  console.log('\n--- 5. Registering a student under SMS mode (should run auto-dispatch background mock) ---')
  const regStudentSMSRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      name: 'Ramesh Kumar',
      phone: '919876543210'
    })
  })
  const studentSMSData = await regStudentSMSRes.json()
  console.log(`Registered Student: ${JSON.stringify(studentSMSData)}`)
  
  // Under SMS mode, welcomeMessage should be null (since it was sent via API)
  if (studentSMSData.welcomeMessage && studentSMSData.welcomeMessage.shouldSendManual === true) {
    throw new Error('Expected shouldSendManual to be false or null under SMS mode!')
  }

  console.log('\n--- 6. Triggering manual custom message under SMS mode (should fail due to mock key) ---')
  const sendCustomRes = await fetch(`${BASE_URL}/whatsapp/send-custom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      studentId: studentSMSData.id,
      message: 'Hello Ramesh, this is a test notification.'
    })
  })
  console.log(`Send Custom response status: ${sendCustomRes.status} (Expected: 500/400 due to mock key)`)
  const customErrorData = await sendCustomRes.json()
  console.log(`Response error details: ${JSON.stringify(customErrorData)}`)
  if (sendCustomRes.status === 200) {
    throw new Error('Expected custom alert to fail with invalid mock API key!')
  }

  console.log('\n--- 7. Reverting to MANUAL_WHATSAPP and testing manual alert trigger ---')
  await fetch(`${BASE_URL}/whatsapp/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      notificationChannel: 'MANUAL_WHATSAPP'
    })
  })

  const sendManualCustomRes = await fetch(`${BASE_URL}/whatsapp/send-custom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': tenantId
    },
    body: JSON.stringify({
      studentId: studentSMSData.id,
      message: 'Hello Ramesh, this is a manual WhatsApp test notification.'
    })
  })
  console.log(`Send Custom (Manual) response status: ${sendManualCustomRes.status} (Expected: 200)`)
  const manualCustomData = await sendManualCustomRes.json()
  console.log(`Manual WhatsApp response details: ${JSON.stringify(manualCustomData)}`)
  if (sendManualCustomRes.status !== 200 || manualCustomData.mode !== 'MANUAL') {
    throw new Error('Expected manual custom message to succeed (200) with mode MANUAL!')
  }

  console.log('\n--- 8. Cleaning up test data from Database ---')
  const deleteSessions = await Session.deleteMany({ tenantId })
  console.log(`Deleted ${deleteSessions.deletedCount} sessions`)

  const deleteUser = await User.deleteMany({ tenantId })
  console.log(`Deleted ${deleteUser.deletedCount} users`)

  const deleteWhatsapp = await WhatsappConfig.deleteMany({ tenantId })
  console.log(`Deleted ${deleteWhatsapp.deletedCount} configs`)

  const deleteSeats = await Seat.deleteMany({ tenantId })
  console.log(`Deleted ${deleteSeats.deletedCount} seats`)

  const deleteShifts = await Shift.deleteMany({ tenantId })
  console.log(`Deleted ${deleteShifts.deletedCount} shifts`)

  const deletePlans = await Plan.deleteMany({ tenantId })
  console.log(`Deleted ${deletePlans.deletedCount} plans`)

  const deleteTenant = await Tenant.deleteOne({ _id: tenantId })
  console.log(`Deleted ${deleteTenant.deletedCount} tenant`)

  console.log('\n✅ All notification test scenarios verified successfully!')
}

runTest()
  .catch(err => {
    console.error('\n❌ Test execution failed:', err)
  })
  .finally(async () => {
    await mongoose.disconnect()
    console.log('Database disconnected.')
  })
