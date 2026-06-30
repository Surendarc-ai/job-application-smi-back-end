#!/usr/bin/env node
import dotenv from 'dotenv';
import { connectDB } from '../db.js';
import { runScheduledBackup } from '../utils/scheduledBackup.js';

dotenv.config({ path: 'env' });

async function main() {
  await connectDB();
  const result = await runScheduledBackup();

  if (result.skipped) {
    console.error(result.reason);
    process.exit(1);
  }

  console.log(`Emailed ${result.sent} backup file(s)`);
  for (const item of result.results) {
    console.log(`  - ${item.company}: ${item.filename} (${item.counts.customers} customers, ${item.counts.models} models, ${item.counts.jobs} jobs)`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
