import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultState } from './default-data.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const defaultDataDir = path.join(rootDir, 'data');
const configuredDataDir = process.env.DATA_DIR || defaultDataDir;
const dataFile = process.env.DATA_FILE || path.join(configuredDataDir, 'app-data.json');
const app = express();
const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || 168);
const revokedTokens = new Set();

app.use(express.json({ limit: '2mb' }));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getConfiguredAuth() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  };
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || 'teamtimer-dev-secret-change-me';
  return String(secret);
}

function sanitizeState(payload) {
  const fallback = createDefaultState();
  const next = payload && typeof payload === 'object' ? payload : {};

  return {
    employees: Array.isArray(next.employees) ? next.employees : clone(fallback.employees),
    locations: Array.isArray(next.locations) ? next.locations : clone(fallback.locations),
    shiftSlots: Array.isArray(next.shiftSlots) ? next.shiftSlots : clone(fallback.shiftSlots),
    assignments: Array.isArray(next.assignments) ? next.assignments : clone(fallback.assignments),
    seasonMonths: Array.isArray(next.seasonMonths) ? next.seasonMonths : clone(fallback.seasonMonths),
    highDemandDays: Array.isArray(next.highDemandDays) ? next.highDemandDays : clone(fallback.highDemandDays),
  };
}

function createToken(username) {
  const payload = {
    sub: username,
    exp: Date.now() + sessionTtlHours * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || revokedTokens.has(token)) return false;

  const [body, signature] = token.split('.');
  if (!body || !signature) return false;

  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return typeof payload?.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function publicStateFrom(fullState) {
  return {
    employees: fullState.employees,
    locations: fullState.locations,
    shiftSlots: fullState.shiftSlots,
    assignments: fullState.assignments,
    seasonMonths: fullState.seasonMonths,
    highDemandDays: fullState.highDemandDays,
  };
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    const initialState = sanitizeState(createDefaultState());
    await fs.writeFile(dataFile, JSON.stringify(initialState, null, 2), 'utf8');
  }
}

async function readFullState() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    return sanitizeState(JSON.parse(raw));
  } catch {
    const fallback = sanitizeState(createDefaultState());
    await writeFullState(fallback);
    return fallback;
  }
}

async function writeFullState(state) {
  await ensureDataFile();
  const clean = sanitizeState(state);
  await fs.writeFile(dataFile, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!verifyToken(token)) {
    return res.status(401).json({ ok: false, message: 'Nicht angemeldet' });
  }
  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/runtime-config', (_req, res) => {
  res.json({
    dataFile,
    port,
    authConfigured: Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD),
    usingDefaultSecret: !process.env.SESSION_SECRET,
  });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const auth = getConfiguredAuth();

  if (username === auth.username && password === auth.password) {
    const token = createToken(auth.username);
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, message: 'Ungültige Anmeldedaten' });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = getBearerToken(req);
  if (token) revokedTokens.add(token);
  res.json({ ok: true });
});

app.get('/api/state', requireAuth, async (_req, res) => {
  const state = await readFullState();
  res.json(publicStateFrom(state));
});

app.put('/api/state', requireAuth, async (req, res) => {
  const next = sanitizeState(req.body);
  const saved = await writeFullState(next);
  res.json({ ok: true, state: publicStateFrom(saved) });
});

app.use(express.static(distDir));
app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  try {
    await fs.access(path.join(distDir, 'index.html'));
    res.sendFile(path.join(distDir, 'index.html'));
  } catch {
    res.status(500).send('Frontend wurde noch nicht gebaut. Bitte zuerst npm run build ausführen.');
  }
});

await ensureDataFile();
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.warn('WARNUNG: ADMIN_USERNAME oder ADMIN_PASSWORD sind nicht gesetzt. Fallback auf admin/admin.');
}
if (!process.env.SESSION_SECRET) {
  console.warn('WARNUNG: SESSION_SECRET ist nicht gesetzt. Bitte für Unraid einen eigenen Secret-Wert setzen.');
}
app.listen(port, () => {
  console.log(`TeamTimer läuft auf http://localhost:${port}`);
  console.log(`Datendatei: ${dataFile}`);
});
