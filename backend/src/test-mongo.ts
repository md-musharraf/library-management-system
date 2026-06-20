import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI || ''

console.log('Connecting to database using environment variables...')

async function test() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    console.log('✅ Connected successfully!')
    await mongoose.disconnect()
  } catch (err) {
    console.error('❌ Connection failed:', err)
  }
}

test()
