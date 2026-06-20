import 'dotenv/config'
import mongoose from 'mongoose'
import { Tenant } from '../src/models/Tenant'

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms'
  
  try {
    await mongoose.connect(uri)
    const tenants = await Tenant.find()
    
    console.log(`\n📋 DATABASE TENANTS: Found ${tenants.length} registered libraries\n`)
    
    tenants.forEach((t: any, idx) => {
      console.log(`[Library #${idx + 1}]`)
      console.log(`Name:        "${t.name}"`)
      console.log(`Owner:       ${t.ownerName}`)
      console.log(`Phone:       ${t.phone}`)
      console.log(`License:     ${t.licenseType || 'TRIAL'}`)
      console.log(`Expires On:  ${t.licenseExpiry ? new Date(t.licenseExpiry).toLocaleDateString() : 'N/A'}`)
      console.log(`Workspace ID: ${t._id}`)
      console.log(`-----------------------------------------`)
    })
  } catch (err) {
    console.error("Database connection failed:", err)
  } finally {
    await mongoose.disconnect()
  }
}

run()
