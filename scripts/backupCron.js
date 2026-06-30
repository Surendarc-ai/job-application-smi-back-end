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
    console.log(`  - ${item.filePath} (${item.counts.customers} customers, ${item.counts.models} models, ${item.counts.jobs} jobs)`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
