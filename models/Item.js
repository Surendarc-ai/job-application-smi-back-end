import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  material: {
    type: String,
    required: true,
    enum: ['MS', 'SS', 'ALUMINIUM', 'GI', 'BRASS'],
  },
  thickness: { type: Number, required: true },
  runningMeterRate: { type: Number, required: true },
  piercingRate: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
