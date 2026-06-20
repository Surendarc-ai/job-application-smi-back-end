import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import customersRoutes from './routes/customers.js';
import { connectDB } from './db.js';

dotenv.config({ path: 'env' });

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : ['http://localhost:5173', 'http://localhost:5174'];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin)) return true;
  if (normalizedOrigin === 'capacitor://localhost' || normalizedOrigin === 'ionic://localhost') {
    return true;
  }
  return false;
}

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, origin || true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/customers', customersRoutes);
app.get('/api/health', (_, res) => res.json({ ok: true }));

export default app;
