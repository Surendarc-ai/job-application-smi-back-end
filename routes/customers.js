import { Router } from 'express';
import Customer from '../models/Customer.js';
import { authMiddleware } from '../middleware/auth.js';
import { getScopeFilter, getCompanyIdForSave } from '../utils/companyScope.js';

const router = Router();
router.use(authMiddleware);

function customerScope(req) {
  return { _id: req.params.id, ...getScopeFilter(req) };
}

router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find(getScopeFilter(req)).sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, gstNumber } = req.body;
    if (!firstName) {
      return res.status(400).json({ error: 'First name is required' });
    }

    const companyId = getCompanyIdForSave(req);
    if (!companyId) {
      return res.status(400).json({ error: 'Your account has no company. Please contact admin.' });
    }

    const customer = await Customer.create({
      firstName,
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      address: address || '',
      gstNumber: gstNumber || '',
      userId: req.userId,
      company_id: companyId,
    });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, gstNumber } = req.body;
    const customer = await Customer.findOneAndUpdate(
      customerScope(req),
      {
        ...(firstName != null && { firstName }),
        ...(lastName != null && { lastName }),
        ...(email != null && { email }),
        ...(phone != null && { phone }),
        ...(address != null && { address }),
        ...(gstNumber != null && { gstNumber }),
      },
      { new: true },
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete(customerScope(req));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
