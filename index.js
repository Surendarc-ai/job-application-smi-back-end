import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './db.js';
import { seedRoles } from './utils/seedRoles.js';

dotenv.config({ path: 'env' });

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectDB();
    await seedRoles();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    if (err.message.includes('bad auth')) {
      console.error('Failed to start server: MongoDB authentication failed. Check the password in env.');
    } else {
      console.error('Failed to start server:', err.message);
    }
    process.exit(1);
  }
}

start();
