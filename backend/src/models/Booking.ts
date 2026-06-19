import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const BookingSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    studentId: { type: String, required: true },
    seatId: { type: String, required: true },
    planId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    shiftId: { type: String, required: true },
    status: { type: String, required: true, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

// Define virtual relations for populate
BookingSchema.virtual('student', {
  ref: 'Student',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true
})

BookingSchema.virtual('seat', {
  ref: 'Seat',
  localField: 'seatId',
  foreignField: '_id',
  justOne: true
})

BookingSchema.virtual('plan', {
  ref: 'Plan',
  localField: 'planId',
  foreignField: '_id',
  justOne: true
})

BookingSchema.virtual('shift', {
  ref: 'Shift',
  localField: 'shiftId',
  foreignField: '_id',
  justOne: true
})

BookingSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Booking = mongoose.model('Booking', BookingSchema)
