import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const SeatSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    seatNumber: { type: String, required: true },
    status: { type: String, required: true, enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'], default: 'AVAILABLE' },
    areaName: { type: String, required: true, default: 'General Zone' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

SeatSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Seat = mongoose.model('Seat', SeatSchema)
