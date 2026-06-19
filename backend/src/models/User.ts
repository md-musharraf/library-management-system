import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const UserSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['ADMIN', 'STAFF'] },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

UserSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    delete ret.password
    return ret
  },
})

export const User = mongoose.model('User', UserSchema)
