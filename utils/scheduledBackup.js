import fs from 'fs';
import path from 'path';
import Company from '../models/Company.js';
import { exportCompanyBackupByScope } from './backupService.js';
import { getDefaultBackupRecipients, isBackupEmailConfigured, sendBackupEmail } from './emailService.js';
import { getScopeFilter } from './companyScope.js';

function safeFilenamePart(value) {
  return String(value || 'company')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'company';
}

async function emailCompanyBackup({ companyName, scope, recipients }) {
  const { buffer, counts } = await exportCompanyBackupByScope(scope);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `job-app-backup-${safeFilenamePart(companyName)}-${date}.xlsx`;

  await sendBackupEmail({
    to: recipients.join(', '),
    subject: `Job App backup - ${companyName} - ${date}`,
    text: [
      `Automated backup for ${companyName}.`,
      `Customers: ${counts.customers}`,
      `Models: ${counts.models}`,
      `Jobs: ${counts.jobs}`,
      '',
      'Keep this file safe. You can upload it in the Backup page if data needs to be restored.',
    ].join('\n'),
    attachmentBuffer: buffer,
    attachmentFilename: filename,
  });

  return { company: companyName, filename, counts };
}

async function saveCompanyBackup({ companyName, scope, outputDir }) {
  const { buffer, counts } = await exportCompanyBackupByScope(scope);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `job-app-backup-${safeFilenamePart(companyName)}-${date}.xlsx`;
  const filePath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return { company: companyName, filename, filePath, counts };
}

export async function runLocalBackup(outputDir = path.join(process.cwd(), 'backups')) {
  const companies = await Company.find({}).sort({ name: 1 }).lean();
  const targets = companies.length
    ? companies
    : [{ _id: null, name: 'All Data' }];

  const results = [];
  for (const company of targets) {
    const scope = company._id ? { company_id: company._id } : {};
    const saved = await saveCompanyBackup({
      companyName: company.name,
      scope,
      outputDir,
    });
    results.push(saved);
  }

  return { outputDir, saved: results.length, results };
}

export async function runScheduledBackup() {
  if (!isBackupEmailConfigured()) {
    return { skipped: true, reason: 'Backup email is not configured' };
  }

  const recipients = getDefaultBackupRecipients();
  const companies = await Company.find({}).sort({ name: 1 }).lean();
  const targets = companies.length
    ? companies
    : [{ _id: null, name: 'All Data' }];

  const results = [];
  for (const company of targets) {
    const scope = company._id ? { company_id: company._id } : {};
    const sent = await emailCompanyBackup({
      companyName: company.name,
      scope,
      recipients,
    });
    results.push(sent);
  }

  return { sent: results.length, results };
}

export async function emailBackupForRequest(req) {
  if (!isBackupEmailConfigured()) {
    throw new Error('Backup email is not configured on the server');
  }

  const recipients = getDefaultBackupRecipients();
  const scope = getScopeFilter(req);
  let companyName = 'Your company';
  if (req.companyId) {
    const company = await Company.findById(req.companyId).select('name').lean();
    companyName = company?.name || companyName;
  }

  const sent = await emailCompanyBackup({
    companyName,
    scope,
    recipients,
  });

  return {
    message: `Backup emailed to ${recipients.join(', ')}`,
    ...sent,
  };
}
