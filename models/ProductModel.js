import mongoose from 'mongoose';

const productModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
}, { timestamps: true });

productModelSchema.index({ company_id: 1, name: 1 }, { unique: true });

export default mongoose.model('ProductModel', productModelSchema, 'product_models');
