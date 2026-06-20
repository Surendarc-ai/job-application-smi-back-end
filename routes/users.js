import { Router } from 'express';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Company from '../models/Company.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { ROLE } from '../constants/roles.js';
import { userPayload } from '../utils/userPayload.js';

const router = Router();

const userPopulate = [
  { path: 'role_id', select: 'name' },
  { path: 'company_id', select: 'name' },
];

async function resolveRoleId(roleId) {
  if (!roleId) return null;
  const role = await Role.findById(roleId);
  return role ? role._id : undefined;
}

async function resolveCompanyId(companyId) {
  if (!companyId) return null;
  const company = await Company.findById(companyId);
  return company ? company._id : undefined;
}

router.use(authMiddleware);
router.use(requireRole(ROLE.SUPER_ADMIN));

router.get('/', async (_req, res) => {
  try {
    const users = await User.find()
      .populate(userPopulate)
      .sort({ createdAt: -1 })
      .select('-password');
    res.json(users.map(userPayload));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, password, roleId, companyId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (!roleId) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const resolvedRoleId = await resolveRoleId(roleId);
    if (!resolvedRoleId) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const resolvedCompanyId = await resolveCompanyId(companyId);
    if (resolvedCompanyId === undefined) {
      return res.status(400).json({ error: 'Invalid company' });
    }

    if (await User.findOne({ username })) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const user = await User.create({
      username,
      password,
      role_id: resolvedRoleId,
      company_id: resolvedCompanyId,
    });
    await user.populate(userPopulate);

    res.status(201).json(userPayload(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { username, password, roleId, companyId } = req.body;

    if (username !== undefined) {
      if (!username.trim()) {
        return res.status(400).json({ error: 'Username is required' });
      }
      const existing = await User.findOne({ username, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username.trim();
    }

    if (password) {
      user.password = password;
    }

    if (roleId !== undefined) {
      const resolvedRoleId = await resolveRoleId(roleId);
      if (!resolvedRoleId) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      user.role_id = resolvedRoleId;
    }

    if (companyId !== undefined) {
      const resolvedCompanyId = await resolveCompanyId(companyId);
      if (resolvedCompanyId === undefined) {
        return res.status(400).json({ error: 'Invalid company' });
      }
      user.company_id = resolvedCompanyId;
    }

    await user.save();
    await user.populate(userPopulate);
    res.json(userPayload(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.userId)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
