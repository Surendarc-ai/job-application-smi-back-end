import { Router } from 'express';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { ROLE } from '../constants/roles.js';

const router = Router();

function sanitizeCompany(company) {
  return {
    id: String(company._id),
    name: company.name,
    createdAt: company.createdAt,
  };
}

router.use(authMiddleware);

router.get('/', async (_req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 });
    res.json(companies.map(sanitizeCompany));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole(ROLE.SUPER_ADMIN), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (await Company.findOne({ name })) {
      return res.status(400).json({ error: 'Company already exists' });
    }
    const company = await Company.create({ name });
    res.status(201).json(sanitizeCompany(company));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireRole(ROLE.SUPER_ADMIN), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const duplicate = await Company.findOne({ name, _id: { $ne: company._id } });
    if (duplicate) {
      return res.status(400).json({ error: 'Company already exists' });
    }

    const oldName = company.name;
    company.name = name;
    await company.save();

    if (oldName !== name) {
      await Job.updateMany({ officeBranch: oldName }, { officeBranch: name });
    }

    res.json(sanitizeCompany(company));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireRole(ROLE.SUPER_ADMIN), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const [userCount, jobCount] = await Promise.all([
      User.countDocuments({ company_id: company._id }),
      Job.countDocuments({ officeBranch: company.name }),
    ]);

    if (userCount > 0 || jobCount > 0) {
      return res.status(400).json({
        error: `Cannot delete: company is used by ${userCount} user(s) and ${jobCount} job(s)`,
      });
    }

    await company.deleteOne();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
