import Role from '../models/Role.js';
import { ROLES } from '../constants/roles.js';

export async function seedRoles() {
  for (const name of ROLES) {
    await Role.findOneAndUpdate({ name }, { name }, { upsert: true });
  }
}
