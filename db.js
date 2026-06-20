import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: 'env' });

let connected = false;
let connectPromise = null;

export async function connectDB() {
  if (connected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required. Copy env.example to env and set your database password.');
  }
  if (uri.includes('<db_password>')) {
    throw new Error('Replace <db_password> in env with your MongoDB Atlas password.');
  }

  connectPromise = mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 30000),
  }).then((conn) => {
    connected = true;
    console.log('MongoDB connected to', mongoose.connection.name);
    return conn;
  }).catch((err) => {
    connectPromise = null;
    throw err;
  });

  return connectPromise;
}
