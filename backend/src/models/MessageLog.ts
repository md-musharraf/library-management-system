import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const MessageLogSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    recipient: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, required: true },
    errorMsg: { type: String },
    sentAt: { type: Date, default: Date.now },
  }
)

MessageLogSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const MessageLog = mongoose.model('MessageLog', MessageLogSchema)
