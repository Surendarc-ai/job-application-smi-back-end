import { connectDB } from './db.js';
import { runScheduledBackup } from './utils/scheduledBackup.js';

let initialized = false;

async function initialize() {
  if (initialized) return;
  await connectDB();
  initialized = true;
}

export const handler = async () => {
  await initialize();
  const result = await runScheduledBackup();
  console.log(JSON.stringify(result));
  return result;
};
