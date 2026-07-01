import fs from 'fs';
import path from 'path';
import Company from '../models/Company.js';
import { exportFullBackup, exportCompanyBackupByScope } from './backupService.js';
import { getDefaultBackupRecipients, isBackupEmailConfigured, sendBackupEmail } from './emailService.js';
import { getScopeFilter } from './companyScope.js';

function safeFilenamePart(value) {
  return String(value || 'backup')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'backup';
}

function formatCounts(counts) {
  return [
    `Companies: ${counts.companies ?? 0}`,
    `Customers: ${counts.customers ?? 0}`,
    `Items: ${counts.items ?? 0}`,
    `Jobs: ${counts.jobs ?? 0}`,
    `Product models: ${counts.product_models ?? 0}`,
    `Roles: ${counts.roles ?? 0}`,
    `Users: ${counts.users ?? 0}`,
  ].join('\n');
}

async function emailFullBackup(recipients) {
  const { buffer, counts } = await exportFullBackup();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `job-app-backup-full-${date}.xlsx`;

  await sendBackupEmail({
    to: recipients.join(', '),
    subject: `Job App full backup - ${date}`,
    text: [
      'Automated full database backup.',
      formatCounts(counts),
      '',
      'Sheets: Companies, Customers, Items, Jobs, Product_Models, Roles, Users',
      'Keep this file safe. User passwords are not included.',
    ].join('\n'),
    attachmentBuffer: buffer,
    attachmentFilename: filename,
  });

  return { filename, counts };
}

async function saveFullBackup(outputDir) {
  const { buffer, counts } = await exportFullBackup();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `job-app-backup-full-${date}.xlsx`;
  const filePath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return { filename, filePath, counts };
}

export async function runLocalBackup(outputDir = path.join(process.cwd(), 'backups')) {
  const saved = await saveFullBackup(outputDir);
  return { outputDir, saved: 1, results: [saved] };
}

export async function runScheduledBackup() {
  if (!isBackupEmailConfigured()) {
    return { skipped: true, reason: 'Backup email is not configured' };
  }

  const recipients = getDefaultBackupRecipients();
  const sent = await emailFullBackup(recipients);
  return { sent: 1, results: [sent] };
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

  const { buffer, counts } = await exportCompanyBackupByScope(scope);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `job-app-backup-${safeFilenamePart(companyName)}-${date}.xlsx`;

  await sendBackupEmail({
    to: recipients.join(', '),
    subject: `Job App backup - ${companyName} - ${date}`,
    text: [
      `Backup for ${companyName}.`,
      formatCounts(counts),
      '',
      'Keep this file safe. You can upload it in the Backup page if data needs to be restored.',
    ].join('\n'),
    attachmentBuffer: buffer,
    attachmentFilename: filename,
  });

  return {
    message: `Backup emailed to ${recipients.join(', ')}`,
    company: companyName,
    filename,
    counts,
  };
}
