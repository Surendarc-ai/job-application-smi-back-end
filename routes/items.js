import { Router } from 'express';
import Item from '../models/Item.js';
import { authMiddleware } from '../middleware/auth.js';
import { getScopeFilter, getCompanyIdForSave } from '../utils/companyScope.js';

const router = Router();
router.use(authMiddleware);

function itemScope(req) {
  return { _id: req.params.id, ...getScopeFilter(req) };
}

router.get('/', async (req, res) => {
  try {
    const items = await Item.find(getScopeFilter(req)).sort({ material: 1, thickness: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { material, thickness, runningMeterRate, piercingRate } = req.body;
    if (!material || thickness == null || runningMeterRate == null || piercingRate == null) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const item = await Item.create({
      material,
      thickness: Number(thickness),
      runningMeterRate: Number(runningMeterRate),
      piercingRate: Number(piercingRate),
      userId: req.userId,
      company_id: getCompanyIdForSave(req),
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { material, thickness, runningMeterRate, piercingRate } = req.body;
    const item = await Item.findOneAndUpdate(
      itemScope(req),
      {
        ...(material != null && { material }),
        ...(thickness != null && { thickness: Number(thickness) }),
        ...(runningMeterRate != null && { runningMeterRate: Number(runningMeterRate) }),
        ...(piercingRate != null && { piercingRate: Number(piercingRate) }),
      },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await Item.findOneAndDelete(itemScope(req));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
