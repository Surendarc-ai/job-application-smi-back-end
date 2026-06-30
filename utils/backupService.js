import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import Customer from '../models/Customer.js';
import Job from '../models/Job.js';
import ProductModel from '../models/ProductModel.js';
import { getScopeFilter, getCompanyIdForSave } from './companyScope.js';

const SHEETS = {
  customers: 'Customers',
  jobs: 'Jobs',
  models: 'Models',
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toObjectId(value) {
  const id = String(value || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function customerName(customer) {
  if (!customer) return '';
  if (typeof customer === 'object') {
    return [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  }
  return '';
}

export async function exportCompanyBackupByScope(scope) {
  const [customers, jobs, models] = await Promise.all([
    Customer.find(scope).sort({ createdAt: 1 }).lean(),
    Job.find(scope).populate('customer', 'firstName lastName').sort({ date: -1 }).lean(),
    ProductModel.find(scope).sort({ name: 1 }).lean(),
  ]);

  const customerRows = customers.map((c) => ({
    _id: String(c._id),
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    gstNumber: c.gstNumber || '',
    createdAt: formatDate(c.createdAt),
    updatedAt: formatDate(c.updatedAt),
  }));

  const modelRows = models.map((m) => ({
    _id: String(m._id),
    name: m.name || '',
    description: m.description || '',
    createdAt: formatDate(m.createdAt),
    updatedAt: formatDate(m.updatedAt),
  }));

  const jobRows = jobs.map((j) => ({
    _id: String(j._id),
    date: formatDate(j.date),
    customerId: String(j.customer?._id || j.customer || ''),
    customerName: customerName(j.customer),
    projectName: j.projectName || '',
    model: j.model || '',
    isDC: j.isDC ? 'true' : 'false',
    dcJson: JSON.stringify(Array.isArray(j.dc) ? j.dc : []),
    pixel: j.pixel || '',
    jobNumber: j.jobNumber || '',
    billNo: j.billNo || '',
    quantity: j.quantity ?? 0,
    lengthMm: j.lengthMm ?? 0,
    widthMm: j.widthMm ?? 0,
    pricePerSqft: j.pricePerSqft ?? 0,
    totSizeSqFt: j.totSizeSqFt ?? 0,
    roundedTotSizeSqFt: j.roundedTotSizeSqFt ?? 0,
    totSqft: j.totSqft ?? 0,
    totalAmount: j.totalAmount ?? 0,
    remainingDeliverQty: j.remainingDeliverQty ?? 0,
    paymentStatus: j.paymentStatus || 'Non-Billed',
    createdAt: formatDate(j.createdAt),
    updatedAt: formatDate(j.updatedAt),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customerRows), SHEETS.customers);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(modelRows), SHEETS.models);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(jobRows), SHEETS.jobs);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    buffer,
    counts: {
      customers: customerRows.length,
      models: modelRows.length,
      jobs: jobRows.length,
    },
  };
}

export async function exportCompanyBackup(req) {
  return exportCompanyBackupByScope(getScopeFilter(req));
}

async function upsertCustomer(row, req, companyId) {
  const firstName = String(row.firstName || '').trim();
  if (!firstName) return { skipped: true, reason: 'Missing firstName' };

  const id = toObjectId(row._id);
  const payload = {
    firstName,
    lastName: String(row.lastName || '').trim(),
    email: String(row.email || '').trim(),
    phone: String(row.phone || '').trim(),
    address: String(row.address || '').trim(),
    gstNumber: String(row.gstNumber || '').trim(),
    userId: req.userId,
    company_id: companyId,
  };

  if (id) {
    await Customer.findOneAndUpdate(
      { _id: id, ...getScopeFilter(req) },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { id, upserted: true };
  }

  const created = await Customer.create(payload);
  return { id: created._id, upserted: true };
}

async function upsertModel(row, req, companyId) {
  const name = String(row.name || '').trim();
  if (!name) return { skipped: true, reason: 'Missing name' };

  const id = toObjectId(row._id);
  const payload = {
    name,
    description: String(row.description || '').trim(),
    userId: req.userId,
    company_id: companyId,
  };

  if (id) {
    await ProductModel.findOneAndUpdate(
      { _id: id, ...getScopeFilter(req) },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { id, upserted: true };
  }

  const created = await ProductModel.create(payload);
  return { id: created._id, upserted: true };
}

async function upsertJob(row, req, companyId, customerIds) {
  const projectName = String(row.projectName || '').trim();
  if (!projectName) return { skipped: true, reason: 'Missing projectName' };

  const customerId = toObjectId(row.customerId);
  if (!customerId || !customerIds.has(String(customerId))) {
    return { skipped: true, reason: `Invalid customerId for job ${row._id || projectName}` };
  }

  const date = parseDate(row.date);
  if (!date) return { skipped: true, reason: `Invalid date for job ${row._id || projectName}` };

  const dc = parseJson(row.dcJson, []).map((item) => ({
    date: parseDate(item?.date),
    billNo: String(item?.billNo || '').trim(),
    quantity: parseNumber(item?.quantity, 0),
    amount: parseNumber(item?.amount, 0),
  }));

  const id = toObjectId(row._id);
  const payload = {
    date,
    customer: customerId,
    projectName,
    model: String(row.model || '').trim(),
    isDC: parseBool(row.isDC),
    dc,
    pixel: String(row.pixel || '').trim(),
    jobNumber: String(row.jobNumber || '').trim(),
    billNo: String(row.billNo || '').trim(),
    quantity: parseNumber(row.quantity, 0),
    lengthMm: parseNumber(row.lengthMm, 0),
    widthMm: parseNumber(row.widthMm, 0),
    pricePerSqft: parseNumber(row.pricePerSqft, 0),
    totSizeSqFt: parseNumber(row.totSizeSqFt, 0),
    roundedTotSizeSqFt: parseNumber(row.roundedTotSizeSqFt, 0),
    totSqft: parseNumber(row.totSqft, 0),
    totalAmount: parseNumber(row.totalAmount, 0),
    remainingDeliverQty: parseNumber(row.remainingDeliverQty, 0),
    paymentStatus: String(row.paymentStatus || 'Non-Billed').trim() || 'Non-Billed',
    userId: req.userId,
    company_id: companyId,
  };

  if (id) {
    await Job.findOneAndUpdate(
      { _id: id, ...getScopeFilter(req) },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { id, upserted: true };
  }

  const created = await Job.create(payload);
  return { id: created._id, upserted: true };
}

export async function restoreCompanyBackup(req, fileBuffer) {
  const companyId = getCompanyIdForSave(req);
  if (!companyId) {
    throw new Error('Your account has no company. Please contact admin.');
  }

  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const customerRows = sheetRows(workbook, SHEETS.customers);
  const modelRows = sheetRows(workbook, SHEETS.models);
  const jobRows = sheetRows(workbook, SHEETS.jobs);

  const stats = {
    customers: { restored: 0, skipped: 0 },
    models: { restored: 0, skipped: 0 },
    jobs: { restored: 0, skipped: 0 },
    errors: [],
  };

  const customerIds = new Set();

  for (const row of customerRows) {
    try {
      const result = await upsertCustomer(row, req, companyId);
      if (result.skipped) {
        stats.customers.skipped += 1;
        if (result.reason) stats.errors.push(result.reason);
      } else {
        stats.customers.restored += 1;
        customerIds.add(String(result.id));
      }
    } catch (err) {
      stats.customers.skipped += 1;
      stats.errors.push(`Customer ${row._id || row.firstName}: ${err.message}`);
    }
  }

  const existingCustomers = await Customer.find(getScopeFilter(req)).select('_id').lean();
  existingCustomers.forEach((c) => customerIds.add(String(c._id)));

  for (const row of modelRows) {
    try {
      const result = await upsertModel(row, req, companyId);
      if (result.skipped) {
        stats.models.skipped += 1;
        if (result.reason) stats.errors.push(result.reason);
      } else {
        stats.models.restored += 1;
      }
    } catch (err) {
      stats.models.skipped += 1;
      stats.errors.push(`Model ${row._id || row.name}: ${err.message}`);
    }
  }

  for (const row of jobRows) {
    try {
      const result = await upsertJob(row, req, companyId, customerIds);
      if (result.skipped) {
        stats.jobs.skipped += 1;
        if (result.reason) stats.errors.push(result.reason);
      } else {
        stats.jobs.restored += 1;
      }
    } catch (err) {
      stats.jobs.skipped += 1;
      stats.errors.push(`Job ${row._id || row.projectName}: ${err.message}`);
    }
  }

  return stats;
}
