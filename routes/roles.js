import { Router } from 'express';
import Role from '../models/Role.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json(roles.map((r) => ({ id: String(r._id), name: r.name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
