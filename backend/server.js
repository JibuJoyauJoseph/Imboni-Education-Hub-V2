const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const schoolAdminRoutes = require('./routes/schoolAdminRoutes');
const platformAdminRoutes = require('./routes/platformAdminRoutes');
const academicRoutes = require('./routes/academicRoutes');
const studentToolsRoutes = require('./routes/studentToolsRoutes');
const { startEmailReminderJob } = require('./jobs/emailReminderJob');
const { isValidDownload, sendStoredFile, signFilePaths, uploadStorage } = require('./utils/fileStorage');
const pool = require('./config/db');

const app = express();

const production = process.env.NODE_ENV === 'production';
const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(',')
].map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean));
if (!production) allowedOrigins.add('http://localhost:5173');

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.set('trust proxy', trustProxyHops);

if (production) {
  const requiredEnv = [
    ['DB_HOST', 'DB_HOST', 'MYSQLHOST'],
    ['DB_USER', 'DB_USER', 'MYSQLUSER'],
    ['DB_PASSWORD', 'DB_PASSWORD', 'MYSQLPASSWORD'],
    ['DB_NAME', 'DB_NAME', 'MYSQLDATABASE'],
    ['JWT_SECRET', 'JWT_SECRET'],
    ['FRONTEND_URL', 'FRONTEND_URL'],
    ['TRUST_PROXY_HOPS', 'TRUST_PROXY_HOPS'],
    ['EMAIL_HOST', 'EMAIL_HOST'],
    ['EMAIL_USER', 'EMAIL_USER'],
    ['EMAIL_PASS', 'EMAIL_PASS'],
    ['EMAIL_FROM', 'EMAIL_FROM'],
    ['ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY']
  ];
  const missingEnv = requiredEnv
    .filter(([, ...keys]) => !keys.some(key => process.env[key]?.trim()))
    .map(([label]) => label);
  const jwtSecret = process.env.JWT_SECRET || '';
  const databaseHost = process.env.DB_HOST || process.env.MYSQLHOST || '';
  const databaseUser = process.env.DB_USER || process.env.MYSQLUSER || '';
  if (jwtSecret.length < 32 || jwtSecret.includes('change_this')) missingEnv.push('JWT_SECRET (use a unique random value of at least 32 characters)');
  if (databaseHost === 'localhost' || databaseHost === '127.0.0.1') missingEnv.push('DB_HOST (must be a production database host)');
  if (databaseUser.toLowerCase() === 'root') missingEnv.push('DB_USER (use a least-privileged application user)');
  if (process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') missingEnv.push('ANTHROPIC_API_KEY (replace placeholder)');
  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL || '');
    if (frontendUrl.protocol !== 'https:' || frontendUrl.origin !== process.env.FRONTEND_URL.replace(/\/$/, '')) {
      missingEnv.push('FRONTEND_URL (must be an exact HTTPS origin)');
    }
  } catch {
    missingEnv.push('FRONTEND_URL (must be an exact HTTPS origin)');
  }
  if (uploadStorage === 'volume' && !path.isAbsolute(process.env.UPLOAD_DIR || '')) {
    missingEnv.push('UPLOAD_DIR (set an absolute persistent-volume path, such as /data/uploads)');
  } else if (uploadStorage === 's3') {
    for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (!process.env[key]?.trim()) missingEnv.push(key);
    }
  } else if (uploadStorage !== 'volume') {
    missingEnv.push('UPLOAD_STORAGE=volume or s3');
  }
  if (missingEnv.length) throw new Error(`Missing production configuration: ${missingEnv.join(', ')}`);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(null, false);
  }
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = body => sendJson(signFilePaths(body));
  next();
});

app.get('/api/files/:key', (req, res, next) => {
  if (!isValidDownload(req.params.key, req.query.expires, req.query.signature)) {
    return res.status(403).json({ message: 'This download link is invalid or expired.' });
  }
  res.set('Cache-Control', 'private, no-store');
  sendStoredFile(req.params.key, res).catch(next);
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'IMBONI Education Hub API' });
  } catch {
    res.status(503).json({ status: 'unavailable', service: 'IMBONI Education Hub API' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', schoolAdminRoutes);
app.use('/api/platform', platformAdminRoutes);
app.use('/api', academicRoutes);       // courses, teams, resources, assignments, quizzes, sessions, forum
app.use('/api', studentToolsRoutes);   // kanban + ai tutor

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

// Centralized error handler (e.g. Multer file-size errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (production) {
    const [[admins]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_default_password = TRUE THEN 1 ELSE 0 END) AS defaults
       FROM users WHERE role = 'platform_admin'`
    );
    if (Number(admins.total) < 1 || Number(admins.defaults) > 0) {
      throw new Error('Bootstrap all platform admins with `npm run seed` and remove every default password before starting the production API.');
    }
  }

  app.listen(PORT, () => {
    console.log(`IMBONI Education Hub API running on port ${PORT}`);
    startEmailReminderJob();
  });
}

startServer().catch(error => {
  console.error('[startup]', error.message);
  process.exit(1);
});
