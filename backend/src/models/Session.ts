import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const SessionSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    userId: { type: String, required: true },
    token: { type: String, required: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
    lastActive: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'lastActive' } }
)

SessionSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Session = mongoose.model('Session', SessionSchema)
