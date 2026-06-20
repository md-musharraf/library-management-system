import 'dotenv/config'
import mongoose from 'mongoose'
import { 
  Tenant, User, Student, Shift, Plan, Seat, 
  Booking, Payment, WhatsappConfig, MessageLog, 
  Attendance, Expense, Session 
} from './models'
import { connectDB } from './db'

async function clearDatabase() {
  console.log('Connecting to database...')
  await connectDB()

  console.log('Wiping all collections...')

  const results = await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Student.deleteMany({}),
    Shift.deleteMany({}),
    Plan.deleteMany({}),
    Seat.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    WhatsappConfig.deleteMany({}),
    MessageLog.deleteMany({}),
    Attendance.deleteMany({}),
    Expense.deleteMany({}),
    Session.deleteMany({})
  ])

  console.log('\nDatabase Wiped Successfully!')
  console.log(`- Tenants deleted: ${results[0].deletedCount}`)
  console.log(`- Users deleted: ${results[1].deletedCount}`)
  console.log(`- Students deleted: ${results[2].deletedCount}`)
  console.log(`- Shifts deleted: ${results[3].deletedCount}`)
  console.log(`- Plans deleted: ${results[4].deletedCount}`)
  console.log(`- Seats deleted: ${results[5].deletedCount}`)
  console.log(`- Bookings deleted: ${results[6].deletedCount}`)
  console.log(`- Payments deleted: ${results[7].deletedCount}`)
  console.log(`- WhatsappConfigs deleted: ${results[8].deletedCount}`)
  console.log(`- MessageLogs deleted: ${results[9].deletedCount}`)
  console.log(`- Attendances deleted: ${results[10].deletedCount}`)
  console.log(`- Expenses deleted: ${results[11].deletedCount}`)
  console.log(`- Sessions deleted: ${results[12].deletedCount}`)

  await mongoose.disconnect()
  console.log('\nDisconnected from database.')
}

clearDatabase().catch(err => {
  console.error('Error wiping database:', err)
})
