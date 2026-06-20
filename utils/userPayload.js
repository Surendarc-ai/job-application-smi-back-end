import { DEFAULT_ROLE } from '../constants/roles.js';

export function userPayload(user) {
  return {
    id: String(user._id),
    username: user.username,
    role: user.role_id?.name ?? DEFAULT_ROLE,
    roleId: user.role_id?._id ? String(user.role_id._id) : null,
    company: user.company_id?.name ?? '',
    companyId: user.company_id?._id ? String(user.company_id._id) : null,
  };
}

export function resolveRoleName(user) {
  return user.role_id?.name ?? DEFAULT_ROLE;
}
