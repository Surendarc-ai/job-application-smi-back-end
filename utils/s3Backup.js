import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function getBucket() {
  return String(process.env.BACKUP_S3_BUCKET || '').trim();
}

function getPrefix() {
  const raw = String(process.env.BACKUP_S3_PREFIX || 'smi').trim();
  return raw.replace(/^\/+|\/+$/g, '');
}

export function isBackupS3Configured() {
  return Boolean(getBucket());
}

function buildObjectKey(filename) {
  const prefix = getPrefix();
  const safeName = String(filename || 'backup.xlsx').replace(/^\/+/, '');
  return prefix ? `${prefix}/${safeName}` : safeName;
}

export async function uploadBackupToS3({ buffer, filename }) {
  const bucket = getBucket();
  if (!bucket) {
    throw new Error('Backup S3 is not configured. Set BACKUP_S3_BUCKET.');
  }

  const key = buildObjectKey(filename);
  const client = new S3Client({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1',
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: EXCEL_CONTENT_TYPE,
      ServerSideEncryption: 'AES256',
    }),
  );

  return {
    bucket,
    key,
    s3Uri: `s3://${bucket}/${key}`,
  };
}
