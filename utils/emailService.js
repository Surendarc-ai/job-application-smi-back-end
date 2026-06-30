import nodemailer from 'nodemailer';

function getBackupRecipients() {
  return String(process.env.BACKUP_EMAIL_TO || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

export function isBackupEmailConfigured() {
  const recipients = getBackupRecipients();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const placeholderUser = !user || user.includes('your-email') || user.includes('example.com');
  return !!(recipients.length && process.env.SMTP_HOST && user && pass && !placeholderUser);
}

export async function sendBackupEmail({ to, subject, text, attachmentBuffer, attachmentFilename }) {
  if (!isBackupEmailConfigured()) {
    throw new Error('Backup email is not configured. Set BACKUP_EMAIL_TO, SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  const transporter = nodemailer.createTransport(
    process.env.SMTP_HOST === 'smtp.gmail.com'
      ? {
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }
      : {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          ...(process.env.SMTP_SECURE !== 'true' ? { requireTLS: true } : {}),
        }
  );

  try {
    await transporter.sendMail({
      from: process.env.BACKUP_EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments: [
        {
          filename: attachmentFilename,
          content: attachmentBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
  } catch (err) {
    if (err.code === 'EAUTH') {
      throw new Error(
        'SMTP login failed. For Gmail, enable 2-Step Verification and use an App Password in SMTP_PASS (not your normal password).'
      );
    }
    throw err;
  }
}

export function getDefaultBackupRecipients() {
  return getBackupRecipients();
}
