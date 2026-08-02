import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import Company from '../models/Company.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import Job from '../models/Job.js';
import ProductModel from '../models/ProductModel.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { getScopeFilter, getCompanyIdForSave } from './companyScope.js';

const SHEETS = {
  companies: 'Companies',
  customers: 'Customers',
  items: 'Items',
  jobs: 'Jobs',
  productModels: 'Product_Models',
  roles: 'Roles',
  users: 'Users',
  // Legacy sheet names used by company restore
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

function refId(value) {
  if (!value) return '';
  return String(value._id || value);
}

export async function exportBackupByScope(scope = {}) {
  const [
    companies,
    customers,
    items,
    jobs,
    models,
    roles,
    users,
  ] = await Promise.all([
    Company.find(scope.company_id ? { _id: scope.company_id } : {}).sort({ name: 1 }).lean(),
    Customer.find(scope).sort({ createdAt: 1 }).lean(),
    Item.find(scope).sort({ createdAt: 1 }).lean(),
    Job.find(scope).populate('customer', 'firstName lastName').sort({ date: -1 }).lean(),
    ProductModel.find(scope).sort({ name: 1 }).lean(),
    Role.find({}).sort({ name: 1 }).lean(),
    User.find(scope.company_id ? { company_id: scope.company_id } : {}).select('-password').sort({ username: 1 }).lean(),
  ]);

  const companyRows = companies.map((c) => ({
    _id: String(c._id),
    name: c.name || '',
    createdAt: formatDate(c.createdAt),
    updatedAt: formatDate(c.updatedAt),
  }));

  const customerRows = customers.map((c) => ({
    _id: String(c._id),
    company_id: refId(c.company_id),
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    gstNumber: c.gstNumber || '',
    userId: refId(c.userId),
    createdAt: formatDate(c.createdAt),
    updatedAt: formatDate(c.updatedAt),
  }));

  const itemRows = items.map((i) => ({
    _id: String(i._id),
    company_id: refId(i.company_id),
    material: i.material || '',
    thickness: i.thickness ?? 0,
    runningMeterRate: i.runningMeterRate ?? 0,
    piercingRate: i.piercingRate ?? 0,
    userId: refId(i.userId),
    createdAt: formatDate(i.createdAt),
    updatedAt: formatDate(i.updatedAt),
  }));

  const modelRows = models.map((m) => ({
    _id: String(m._id),
    company_id: refId(m.company_id),
    name: m.name || '',
    description: m.description || '',
    userId: refId(m.userId),
    createdAt: formatDate(m.createdAt),
    updatedAt: formatDate(m.updatedAt),
  }));

  const jobRows = jobs.map((j) => ({
    _id: String(j._id),
    company_id: refId(j.company_id),
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
    userId: refId(j.userId),
    createdAt: formatDate(j.createdAt),
    updatedAt: formatDate(j.updatedAt),
  }));

  const roleRows = roles.map((r) => ({
    _id: String(r._id),
    name: r.name || '',
    createdAt: formatDate(r.createdAt),
    updatedAt: formatDate(r.updatedAt),
  }));

  const userRows = users.map((u) => ({
    _id: String(u._id),
    username: u.username || '',
    roleId: refId(u.role_id),
    companyId: refId(u.company_id),
    createdAt: formatDate(u.createdAt),
    updatedAt: formatDate(u.updatedAt),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(companyRows), SHEETS.companies);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customerRows), SHEETS.customers);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(itemRows), SHEETS.items);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(jobRows), SHEETS.jobs);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(modelRows), SHEETS.productModels);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(roleRows), SHEETS.roles);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(userRows), SHEETS.users);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    buffer,
    counts: {
      companies: companyRows.length,
      customers: customerRows.length,
      items: itemRows.length,
      jobs: jobRows.length,
      product_models: modelRows.length,
      roles: roleRows.length,
      users: userRows.length,
    },
  };
}

export async function exportFullBackup() {
  return exportBackupByScope({});
}

export async function exportCompanyBackupByScope(scope) {
  return exportBackupByScope(scope);
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
    billCompleted: parseBool(item?.billCompleted),
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
  const modelRows = sheetRows(workbook, SHEETS.productModels).length
    ? sheetRows(workbook, SHEETS.productModels)
    : sheetRows(workbook, SHEETS.models);
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
