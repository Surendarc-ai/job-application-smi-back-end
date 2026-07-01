#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';
import { connectDB } from '../db.js';
import { runLocalBackup } from '../utils/scheduledBackup.js';

dotenv.config({ path: 'env' });

async function main() {
  const outputDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), 'backups');

  await connectDB();
  const result = await runLocalBackup(outputDir);

  console.log(`Saved ${result.saved} backup file(s) to ${result.outputDir}`);
  for (const item of result.results) {
    const c = item.counts || {};
    console.log(`  - ${item.filePath} (companies ${c.companies ?? 0}, customers ${c.customers ?? 0}, items ${c.items ?? 0}, jobs ${c.jobs ?? 0}, product_models ${c.product_models ?? 0}, roles ${c.roles ?? 0}, users ${c.users ?? 0})`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
