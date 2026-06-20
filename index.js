import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import customersRoutes from './routes/customers.js';
import itemsRoutes from './routes/items.js';
import usersRoutes from './routes/users.js';
import companiesRoutes from './routes/companies.js';
import rolesRoutes from './routes/roles.js';
import { seedRoles } from './utils/seedRoles.js';
import { migrateUsers } from './utils/migrateUsers.js';
import { migrateEntityCompanyIds } from './utils/migrateEntityCompanyIds.js';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : ['http://localhost:5173', 'http://localhost:5174'];

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) return cb(null, origin);
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

// Fallback CORS header for allowed origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/roles', rolesRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://csurendar8_db_user:eqBz81kmykrZvlLW@jobapplication.fk4wlw8.mongodb.net';

async function start() {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected');
    await seedRoles();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      migrateUsers()
        .then(() => migrateEntityCompanyIds())
        .catch((err) => console.error('Background migration error:', err.message));
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
