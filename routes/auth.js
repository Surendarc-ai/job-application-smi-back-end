import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { ROLE } from '../constants/roles.js';
import { userPayload, resolveRoleName } from '../utils/userPayload.js';

async function findUserForLogin(username) {
  const [doc] = await User.aggregate([
    { $match: { username } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'roles',
        localField: 'role_id',
        foreignField: '_id',
        as: 'role_id',
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'companies',
        localField: 'company_id',
        foreignField: '_id',
        as: 'company_id',
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    {
      $addFields: {
        role_id: { $arrayElemAt: ['$role_id', 0] },
        company_id: { $arrayElemAt: ['$company_id', 0] },
      },
    },
    { $project: { username: 1, password: 1, role_id: 1, company_id: 1 } },
  ]);
  return doc || null;
}

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const userPopulate = [
  { path: 'role_id', select: 'name' },
  { path: 'company_id', select: 'name' },
];

function signToken(user) {
  const role = resolveRoleName(user);
  return jwt.sign(
    {
      userId: user._id,
      role,
      roleId: user.role_id?._id,
      companyId: user.company_id?._id ? String(user.company_id._id) : null,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

router.get('/login', (_, res) => {
  res.json({ message: 'Use POST with JSON body: { username, password }' });
});

router.get('/register', (_, res) => {
  res.json({ message: 'Use POST with JSON body: { username, password }' });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const doc = await findUserForLogin(username);
    if (!doc || !(await bcrypt.compare(password, doc.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const sessionUser = {
      _id: doc._id,
      username: doc.username,
      role_id: doc.role_id || null,
      company_id: doc.company_id || null,
    };
    const token = signToken(sessionUser);
    res.json({ token, user: userPayload(sessionUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (await User.findOne({ username })) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const isFirstUser = (await User.countDocuments()) === 0;
    const roleName = isFirstUser ? ROLE.SUPER_ADMIN : ROLE.MEMBER;
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(500).json({ error: 'Roles not initialized' });
    }

    const user = await User.create({
      username,
      password,
      role_id: role._id,
    });
    await user.populate(userPopulate);

    const token = signToken(user);
    res.status(201).json({ token, user: userPayload(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
