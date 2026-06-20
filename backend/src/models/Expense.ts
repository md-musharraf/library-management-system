import mongoose, { Schema } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const ExpenseSchema = new Schema(
  {
    _id: { type: String, default: uuidv4 },
    tenantId: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['RENT', 'ELECTRICITY', 'INTERNET', 'SALARY', 'MAINTENANCE', 'OTHER'],
      default: 'OTHER'
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
)

ExpenseSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id
    return ret
  },
})

export const Expense = mongoose.model('Expense', ExpenseSchema)
