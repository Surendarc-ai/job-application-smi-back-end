import { Router } from 'express';
import Job from '../models/Job.js';
import Customer from '../models/Customer.js';
import { authMiddleware } from '../middleware/auth.js';
import { getScopeFilter, getCompanyIdForSave } from '../utils/companyScope.js';

const router = Router();
router.use(authMiddleware);

async function buildJobFilter(req, query) {
  const { search, fromDate, toDate, company, status } = query;
  const filter = { ...getScopeFilter(req) };

  if (status) filter.paymentStatus = status;

  if (company) {
    filter.$or = [{ officeBranch: company }, { company }];
  }

  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = new Date(fromDate);
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filter.date.$lte = to;
    }
  }

  if (search?.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const matchingCustomers = await Customer.find({
      ...getScopeFilter(req),
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
    }).select('_id');
    const customerIds = matchingCustomers.map((c) => c._id);
    const searchOr = [
      { materialType: regex },
      { paymentStatus: regex },
      { description: regex },
      { officeBranch: regex },
    ];
    if (customerIds.length) searchOr.push({ customer: { $in: customerIds } });

    if (filter.$or) {
      const companyOr = filter.$or;
      delete filter.$or;
      filter.$and = [{ $or: companyOr }, { $or: searchOr }];
    } else {
      filter.$or = searchOr;
    }
  }

  return filter;
}

function buildJobSort(query) {
  const { sortBy, sortOrder } = query;
  if (sortBy === 'date') {
    return { date: sortOrder === 'asc' ? 1 : -1 };
  }
  return { date: -1 };
}

function jobScope(req) {
  return { _id: req.params.id, ...getScopeFilter(req) };
}

async function validateCustomerCompany(req, customerId) {
  if (!customerId) return true;
  const customer = await Customer.findOne({ _id: customerId, ...getScopeFilter(req) });
  return !!customer;
}

router.get('/', async (req, res) => {
  try {
    const all = req.query.all === 'true';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const filter = await buildJobFilter(req, req.query);
    const sort = buildJobSort(req.query);

    const baseQuery = Job.find(filter)
      .populate('customer', 'firstName lastName')
      .sort(sort);

    if (all) {
      const jobs = await baseQuery;
      return res.json(jobs);
    }

    const total = await Job.countDocuments(filter);
    const jobs = await baseQuery.skip((page - 1) * limit).limit(limit);

    res.json({
      jobs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      date, customer, officeBranch, description, paymentStatus, isDC,
      materialType, thickness, rateMode,
      runningMeter, piercingCount, ratePerPiece, quantity,
      addMaterialCost, materialKg, materialRatePerKg,
      runningMeterRate, piercingRate, totalAmount,
    } = req.body;

    if ((!date || !customer) && !isDC) {
      return res.status(400).json({ error: 'Date and customer are required' });
    }
    if (!isDC && (!materialType || thickness === null || thickness === undefined || thickness === '')) {
      return res.status(400).json({ error: 'Material type and thickness are required' });
    }
    if (customer && !(await validateCustomerCompany(req, customer))) {
      return res.status(400).json({ error: 'Invalid customer for your company' });
    }

    const job = await Job.create({
      date: new Date(date),
      customer,
      officeBranch: officeBranch || '',
      description: description || '',
      paymentStatus: paymentStatus || 'Non-Billed',
      isDC: !!isDC,
      materialType: materialType || '',
      thickness: thickness != null && thickness !== '' ? Number(thickness) : 0,
      rateMode: rateMode || 'runningMeterPiercing',
      runningMeter: Number(runningMeter) || 0,
      piercingCount: Number(piercingCount) || 0,
      ratePerPiece: Number(ratePerPiece) || 0,
      quantity: Number(quantity) || 1,
      addMaterialCost: !!addMaterialCost,
      materialKg: Number(materialKg) || 0,
      materialRatePerKg: Number(materialRatePerKg) || 0,
      runningMeterRate: Number(runningMeterRate) || 0,
      piercingRate: Number(piercingRate) || 0,
      totalAmount: Number(totalAmount) || 0,
      userId: req.userId,
      company_id: getCompanyIdForSave(req),
    });

    const populated = await Job.findById(job._id).populate('customer', 'firstName lastName');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findOne(jobScope(req))
      .populate('customer', 'firstName lastName');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (req.body.customer && !(await validateCustomerCompany(req, req.body.customer))) {
      return res.status(400).json({ error: 'Invalid customer for your company' });
    }

    const updates = {};
    const fields = [
      'date', 'customer', 'officeBranch', 'description', 'paymentStatus', 'isDC',
      'materialType', 'thickness', 'rateMode',
      'runningMeter', 'piercingCount', 'ratePerPiece', 'quantity',
      'addMaterialCost', 'materialKg', 'materialRatePerKg',
      'runningMeterRate', 'piercingRate', 'totalAmount',
    ];
    for (const f of fields) {
      if (req.body[f] != null) {
        if (f === 'date') updates[f] = new Date(req.body[f]);
        else updates[f] = req.body[f];
      }
    }

    const job = await Job.findOneAndUpdate(jobScope(req), updates, { new: true })
      .populate('customer', 'firstName lastName');

    if (!job) return res.status(404).json({ error: 'Job not found' });
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
