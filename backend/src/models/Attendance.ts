import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const AttendanceSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    studentId: { type: String, required: true, ref: 'Student' },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
  },
  { timestamps: false }
)

// Define virtual relation for populate
AttendanceSchema.virtual('student', {
  ref: 'Student',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true
})

AttendanceSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Attendance = mongoose.model('Attendance', AttendanceSchema)
