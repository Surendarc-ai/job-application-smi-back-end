import { Router } from 'express';
import ProductModel from '../models/ProductModel.js';
import { authMiddleware } from '../middleware/auth.js';
import { getScopeFilter, getCompanyIdForSave } from '../utils/companyScope.js';

const router = Router();
router.use(authMiddleware);

function modelScope(req) {
  return { _id: req.params.id, ...getScopeFilter(req) };
}

router.get('/', async (req, res) => {
  try {
    const models = await ProductModel.find(getScopeFilter(req)).sort({ name: 1 });
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    const companyId = getCompanyIdForSave(req);
    if (!companyId) {
      return res.status(400).json({ error: 'Your account has no company. Please contact admin.' });
    }

    const existing = await ProductModel.findOne({
      ...getScopeFilter(req),
      name: name.trim(),
    });
    if (existing) {
      return res.status(400).json({ error: 'Model name already exists' });
    }

    const model = await ProductModel.create({
      name: name.trim(),
      description: String(description || '').trim(),
      userId: req.userId,
      company_id: companyId,
    });
    res.status(201).json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (name != null && !String(name).trim()) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    if (name?.trim()) {
      const duplicate = await ProductModel.findOne({
        ...getScopeFilter(req),
        name: name.trim(),
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Model name already exists' });
      }
    }

    const model = await ProductModel.findOneAndUpdate(
      modelScope(req),
      {
        ...(name != null && { name: String(name).trim() }),
        ...(description != null && { description: String(description).trim() }),
      },
      { new: true },
    );
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const model = await ProductModel.findOneAndDelete(modelScope(req));
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
