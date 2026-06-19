import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || ''

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI is not defined in .env\n' +
    'Please add your MongoDB Atlas connection string to backend/.env\n' +
    'Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lms'
  )
}

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    isConnected = true
    console.log('✅ MongoDB Atlas connected successfully')
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error)
    process.exit(1)
  }
}

export default mongoose
