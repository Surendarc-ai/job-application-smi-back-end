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

function isBackupS3Configured() {
  return Boolean(String(process.env.BACKUP_S3_BUCKET || '').trim());
}

async function uploadFullBackupToS3() {
  const { uploadBackupToS3 } = await import('./s3Backup.js');
  const { buffer, counts } = await exportFullBackup();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `job-app-backup-full-${date}.xlsx`;
  const uploaded = await uploadBackupToS3({ buffer, filename });

  return { filename, counts, ...uploaded };
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
  if (!isBackupS3Configured()) {
    return { skipped: true, reason: 'Backup S3 is not configured. Set BACKUP_S3_BUCKET.' };
  }

  const uploaded = await uploadFullBackupToS3();
  return { uploaded: 1, results: [uploaded] };
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
