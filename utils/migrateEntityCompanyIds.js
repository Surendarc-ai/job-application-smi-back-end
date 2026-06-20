import User from '../models/User.js';
import Job from '../models/Job.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';

async function backfillModel(Model) {
  const docs = await Model.find({
    $or: [{ company_id: { $exists: false } }, { company_id: null }],
  });

  for (const doc of docs) {
    const user = await User.findById(doc.userId).select('company_id');
    if (user?.company_id) {
      doc.company_id = user.company_id;
      await doc.save();
    }
  }
}

export async function migrateEntityCompanyIds() {
  await Promise.all([
    backfillModel(Job),
    backfillModel(Customer),
    backfillModel(Item),
  ]);
}
