import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { ROLE } from '../constants/roles.js';
import { exportCompanyBackup, restoreCompanyBackup } from '../utils/backupService.js';
import { emailBackupForRequest } from '../utils/scheduledBackup.js';
import { isBackupEmailConfigured, getDefaultBackupRecipients } from '../utils/emailService.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(ROLE.SUPER_ADMIN));

router.get('/export', async (req, res) => {
  try {
    const { buffer, counts } = await exportCompanyBackup(req);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="job-app-backup-${date}.xlsx"`);
    res.setHeader('X-Backup-Counts', JSON.stringify(counts));
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/email/status', (req, res) => {
  const configured = isBackupEmailConfigured();
  res.json({
    configured,
    recipients: configured ? getDefaultBackupRecipients() : [],
  });
});

router.post('/email', async (req, res) => {
  try {
    if (!isBackupEmailConfigured()) {
      return res.status(400).json({ error: 'Backup email is not configured on the server' });
    }
    const result = await emailBackupForRequest(req);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restore', async (req, res) => {
  try {
    const { fileBase64 } = req.body;
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'fileBase64 is required' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    const stats = await restoreCompanyBackup(req, buffer);
    res.json({
      message: 'Backup restored successfully',
      stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
