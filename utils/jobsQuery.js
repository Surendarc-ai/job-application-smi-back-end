import Customer from '../models/Customer.js';
import { getScopeFilter } from './companyScope.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseExactDimensionPair(term) {
  const match = String(term).trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { widthMm: Number(match[1]), lengthMm: Number(match[2]) };
}

function buildTextSearchOr(term, scope) {
  const regex = new RegExp(escapeRegex(term), 'i');
  return Customer.find({
    ...scope,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phone: regex },
    ],
  }).distinct('_id').then((customerIds) => [
    { projectName: regex },
    { model: regex },
    { billNo: regex },
    { jobNumber: regex },
    { pixel: regex },
    { 'dc.billNo': regex },
    ...(customerIds.length ? [{ customer: { $in: customerIds } }] : []),
  ]);
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
  const { search, from, to, isDC, customer } = req.query;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = parseDayStart(from);
    if (to) filter.date.$lte = parseDayEnd(to);
  }

  if (isDC === 'yes' || isDC === 'true') filter.isDC = true;
  else if (isDC === 'no' || isDC === 'false') filter.isDC = false;

  const customerId = customer?.trim();
  if (customerId) {
    const customerDoc = await Customer.findOne({ _id: customerId, ...scope }).select('_id');
    filter.customer = customerDoc ? customerDoc._id : { $in: [] };
  }

  const term = search?.trim();
  if (term) {
    const exactPair = parseExactDimensionPair(term);
    if (exactPair) {
      filter.widthMm = exactPair.widthMm;
      filter.lengthMm = exactPair.lengthMm;
    } else {
      filter.$or = await buildTextSearchOr(term, scope);
    }
  }

  return filter;
}

export function parseJobsListQuery(req) {
  const isExport = req.query.export === '1' || req.query.export === 'true';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  return { isExport, page, limit, skip: (page - 1) * limit };
}
