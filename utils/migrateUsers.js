import User from '../models/User.js';
import Role from '../models/Role.js';
import Company from '../models/Company.js';
import { ROLE } from '../constants/roles.js';

export async function migrateUsers() {
  const roles = await Role.find();
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r._id]));
  const defaultRoleId = roleByName[ROLE.MEMBER];

  const users = await User.find({
    $or: [
      { role_id: { $exists: false } },
      { role_id: null },
      { role: { $exists: true } },
      { company: { $exists: true, $ne: '' } },
    ],
  });

  for (const user of users) {
    let changed = false;

    if (!user.role_id && defaultRoleId) {
      user.role_id = (user.role && roleByName[user.role]) || defaultRoleId;
      user.set('role', undefined);
      changed = true;
    }

    if (!user.company_id && user.company) {
      const company = await Company.findOne({ name: user.company });
      if (company) {
        user.company_id = company._id;
        user.set('company', undefined);
        changed = true;
      }
    }

    if (changed) {
      await user.save();
    }
  }
}
