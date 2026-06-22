import Customer from '../models/Customer.js';
import { getScopeFilter } from './companyScope.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDayStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDayEnd(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export async function buildJobsFilter(req) {
  const scope = getScopeFilter(req);
  const filter = { ...scope };
  const { search, from, to, isDC } = req.query;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = parseDayStart(from);
    if (to) filter.date.$lte = parseDayEnd(to);
  }

  if (isDC === 'yes' || isDC === 'true') filter.isDC = true;
  else if (isDC === 'no' || isDC === 'false') filter.isDC = false;

  const term = search?.trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    const customerIds = await Customer.find({
      ...scope,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
      ],
    }).distinct('_id');

    filter.$or = [
      { projectName: regex },
      { model: regex },
      { billNo: regex },
      { jobNumber: regex },
      { pixel: regex },
      { 'dc.billNo': regex },
      ...(customerIds.length ? [{ customer: { $in: customerIds } }] : []),
    ];
  }

  return filter;
}

export function parseJobsListQuery(req) {
  const isExport = req.query.export === '1' || req.query.export === 'true';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  return { isExport, page, limit, skip: (page - 1) * limit };
}
