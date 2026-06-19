import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const TenantSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    logoUrl: { type: String },
    lastRegNo: { type: String },
    licenseKey: { type: String },
    licenseExpiry: { type: Date },
    licenseType: { type: String, enum: ['TRIAL', '1YEAR', '2YEAR'], default: 'TRIAL' },
    trialStartedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

TenantSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Tenant = mongoose.model('Tenant', TenantSchema)
