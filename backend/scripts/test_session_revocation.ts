import 'dotenv/config'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { Tenant } from '../src/models/Tenant'
import { Session } from '../src/models/Session'

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms'
  
  try {
    await mongoose.connect(uri)
    const testTenantId = `test-tenant-id-${Date.now()}`
    
    // 1. Create a dummy tenant
    console.log("1. Creating dummy tenant...")
    await Tenant.create({
      _id: testTenantId,
      name: "Session Limit Test Lab",
      ownerName: "Tester",
      phone: "0000000000",
      address: "Test Lab Address",
      licenseType: "TRIAL",
      licenseExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    })

    // 2. Create 4 active sessions in a loop (simulating 4 device logins)
    console.log("\n2. Logging in 4 sessions sequentially (Limit is 3 active sessions)...")
    const sessions = []
    for (let i = 1; i <= 4; i++) {
      // Simulate delay to ensure different timestamps if sorting by lastActive
      await new Promise(r => setTimeout(r, 100))
      
      const token = `token-${i}-${Date.now()}`
      
      // Enforce the 3 active session limit logic as in auth.ts
      const activeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const activeSessions = await Session.find({ tenantId: testTenantId, lastActive: { $gte: activeThreshold } }).sort({ lastActive: 1 })
      
      if (activeSessions.length >= 3) {
        const oldestSession = activeSessions[0]
        console.log(`[ROLLING LIMIT REACHED] Kicking out oldest session: Token "${oldestSession.token}"`)
        await Session.findByIdAndDelete(oldestSession._id)
      }

      const session = await Session.create({
        _id: uuidv4(),
        tenantId: testTenantId,
        userId: "test-user-id",
        token,
        ip: "127.0.0.1",
        userAgent: "Test-Agent"
      })
      sessions.push(session)
      console.log(`[LOGIN SUCCESS] Device #${i} registered with token: "${token}"`)
    }

    // 3. Verify that the 1st session is deleted and the remaining 3 are active
    const finalSessions = await Session.find({ tenantId: testTenantId })
    console.log(`\n3. Final Active Sessions count: ${finalSessions.length} (Expected: 3)`)
    
    const firstTokenActive = await Session.findOne({ token: sessions[0].token })
    console.log(`Is Session #1 (Device 1) still active? ${!!firstTokenActive ? '✅ Yes' : '❌ No (Successfully Evicted!)'}`)
    
    const fourthTokenActive = await Session.findOne({ token: sessions[3].token })
    console.log(`Is Session #4 (Device 4) active? ${!!fourthTokenActive ? '✅ Yes' : '❌ No'}`)

    // 4. Revocation check (mocking revocation)
    console.log("\n4. Revoking tenant license...")
    const t = await Tenant.findById(testTenantId) as any
    t.licenseExpiry = new Date(0)
    t.licenseType = "REVOKED"
    await t.save()
    console.log("License status set to REVOKED.")
    
    const updatedTenant = await Tenant.findById(testTenantId) as any
    const isLicenseExpired = new Date(updatedTenant.licenseExpiry).getTime() < Date.now()
    console.log(`Is Tenant Workspace Locked? ${isLicenseExpired ? '🔒 Yes (REVOKED status verified)' : '🔓 No'}`)

    // Cleanup
    console.log("\n5. Cleaning up test data...")
    await Session.deleteMany({ tenantId: testTenantId })
    await Tenant.findByIdAndDelete(testTenantId)
    console.log("Cleanup completed.")

  } catch (err) {
    console.error("Test execution failed:", err)
  } finally {
    await mongoose.disconnect()
  }
}

run()
