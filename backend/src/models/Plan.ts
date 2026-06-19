import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const PlanSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    name: { type: String, required: true },
    durationDays: { type: Number, required: true },
    price: { type: Number, required: true },
    shiftId: { type: String, required: true, ref: 'Shift' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

PlanSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Plan = mongoose.model('Plan', PlanSchema)
