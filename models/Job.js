import mongoose from 'mongoose';

const dcItemSchema = new mongoose.Schema({
  date: { type: Date, default: null },
  billNo: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  billCompleted: { type: Boolean, default: false },
}, { _id: false });

const jobSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  projectName: { type: String, required: true, trim: true },
  model: { type: String, default: '' },
  isDC: { type: Boolean, default: false },
  dc: { type: [dcItemSchema], default: [] },
  pixel: { type: String, default: '' },
  jobNumber: { type: String, default: '' },
  billNo: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  lengthMm: { type: Number, default: 0 },
  widthMm: { type: Number, default: 0 },
  pricePerSqft: { type: Number, default: 0 },
  totSizeSqFt: { type: Number, default: 0 },
  roundedTotSizeSqFt: { type: Number, default: 0 },
  totSqft: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  remainingDeliverQty: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['Non-Billed', 'Billed', 'Paid', 'Partial'],
    default: 'Non-Billed',
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

export default mongoose.model('Job', jobSchema, 'jobs');
