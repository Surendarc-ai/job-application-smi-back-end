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
    const c = item.counts || {};
    console.log(`  - ${item.filename}: companies ${c.companies ?? 0}, customers ${c.customers ?? 0}, items ${c.items ?? 0}, jobs ${c.jobs ?? 0}, product_models ${c.product_models ?? 0}, roles ${c.roles ?? 0}, users ${c.users ?? 0}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
