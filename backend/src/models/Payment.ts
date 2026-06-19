import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const PaymentSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    bookingId: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMode: { type: String, required: true, enum: ['CASH', 'UPI', 'CARD'] },
    status: { type: String, required: true, enum: ['PAID', 'DUE', 'PARTIAL'], default: 'PAID' },
  }
)

PaymentSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Payment = mongoose.model('Payment', PaymentSchema)
