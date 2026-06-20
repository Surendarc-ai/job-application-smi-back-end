import { Router } from 'express';
import Job from '../models/Job.js';
import Customer from '../models/Customer.js';
import { authMiddleware } from '../middleware/auth.js';
import { getScopeFilter, getCompanyIdForSave } from '../utils/companyScope.js';
import { buildJobPayload, getDcQuantityError } from '../utils/jobCalculations.js';

const router = Router();
router.use(authMiddleware);

function jobScope(req) {
  return { _id: req.params.id, ...getScopeFilter(req) };
}

async function validateCustomer(req, customerId) {
  if (!customerId) return false;
  const customer = await Customer.findOne({ _id: customerId, ...getScopeFilter(req) });
  return !!customer;
}

router.get('/models', async (req, res) => {
  try {
    const models = await Job.distinct('model', {
      ...getScopeFilter(req),
      model: { $nin: [null, ''] },
    });
    res.json(models.sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find(getScopeFilter(req))
      .populate('customer', 'firstName lastName')
      .sort({ date: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, customer, projectName } = req.body;

    if (!date || !customer) {
      return res.status(400).json({ error: 'Date and customer are required' });
    }
    if (!projectName?.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    if (!(await validateCustomer(req, customer))) {
      return res.status(400).json({ error: 'Invalid customer' });
    }

    const dcError = getDcQuantityError(req.body.quantity, req.body.dc);
    if (req.body.isDC && dcError) {
      return res.status(400).json({ error: dcError });
    }

    const companyId = getCompanyIdForSave(req);
    if (!companyId) {
      return res.status(400).json({ error: 'Your account has no company. Please contact admin.' });
    }

    const job = await Job.create({
      ...buildJobPayload(req.body),
      userId: req.userId,
      company_id: companyId,
    });

    const populated = await Job.findById(job._id).populate('customer', 'firstName lastName');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { date, customer, projectName } = req.body;

    if (customer && !(await validateCustomer(req, customer))) {
      return res.status(400).json({ error: 'Invalid customer' });
    }

    const existing = await Job.findOne(jobScope(req));
    if (!existing) return res.status(404).json({ error: 'Job not found' });

    const merged = {
      date: existing.date,
      customer: existing.customer,
      projectName: existing.projectName,
      model: existing.model,
      isDC: existing.isDC,
      dc: Array.isArray(existing.dc)
        ? existing.dc.map((item) => ({
          billNo: item.billNo || '',
          quantity: item.quantity || 0,
          amount: item.amount || 0,
        }))
        : [],
      pixel: existing.pixel,
      jobNumber: existing.jobNumber,
      billNo: existing.billNo,
      quantity: existing.quantity,
      lengthMm: existing.lengthMm,
      widthMm: existing.widthMm,
      pricePerSqft: existing.pricePerSqft,
      paymentStatus: existing.paymentStatus,
      ...req.body,
    };

    if (!merged.date || !merged.customer) {
      return res.status(400).json({ error: 'Date and customer are required' });
    }
    if (!String(merged.projectName).trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const dcError = getDcQuantityError(merged.quantity, merged.dc);
    if (merged.isDC && dcError) {
      return res.status(400).json({ error: dcError });
    }

    const updates = buildJobPayload(merged);

    const job = await Job.findOneAndUpdate(jobScope(req), updates, { new: true })
      .populate('customer', 'firstName lastName');

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const job = await Job.findOneAndDelete(jobScope(req));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
