import { ROLE } from '../constants/roles.js';

// company_id is stored in JWT on login and read by auth middleware as req.companyId

export function getScopeFilter(req) {
  if (req.companyId) {
    return { company_id: req.companyId };
  }
  if (req.userRole === ROLE.SUPER_ADMIN) {
    return {};
  }
  return { userId: req.userId };
}

export function getCompanyIdForSave(req) {
  return req.companyId || null;
}
