import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const StudentSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    registrationNo: { type: String, required: true, unique: true },
    aadharNo: { type: String },
    status: { type: String, required: true, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

StudentSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Student = mongoose.model('Student', StudentSchema)
