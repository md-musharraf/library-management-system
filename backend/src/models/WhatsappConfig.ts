import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const WhatsappConfigSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true, unique: true },
    apiUrl: { type: String, default: '' },
    token: { type: String, default: '' },
    providerType: { type: String, default: 'ULTRAMSG' },
    templateWelcome: { type: String, default: 'Hello {student_name}, welcome to {library_name}! Your registration code is {registration_no}.' },
    templateExpiry: { type: String, default: 'Dear {student_name}, your seat {seat_number} subscription ({shift} shift) at {library_name} expires on {expiry_date}. Please renew.' },
    expiryDaysAlert: { type: Number, default: 3 },
  }
)

WhatsappConfigSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const WhatsappConfig = mongoose.model('WhatsappConfig', WhatsappConfigSchema)
