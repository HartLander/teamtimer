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
const defaultDataFile = path.join(rootDir, 'data', 'app-data.json');
const dataFile = process.env.DATA_FILE || defaultDataFile;
const app = express();
const port = Number(process.env.PORT || 3000);
const activeTokens = new Set();

app.use(express.json({ limit: '2mb' }));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeState(payload) {
  const fallback = createDefaultState();
  const next = payload && typeof payload === 'object' ? payload : {};
  const auth = next.auth && typeof next.auth === 'object' ? next.auth : {};

  return {
    auth: {
      username: typeof auth.username === 'string' && auth.username.trim() ? auth.username.trim() : fallback.auth.username,
      password: typeof auth.password === 'string' && auth.password ? auth.password : fallback.auth.password,
    },
    employees: Array.isArray(next.employees) ? next.employees : clone(fallback.employees),
    locations: Array.isArray(next.locations) ? next.locations : clone(fallback.locations),
    shiftSlots: Array.isArray(next.shiftSlots) ? next.shiftSlots : clone(fallback.shiftSlots),
    assignments: Array.isArray(next.assignments) ? next.assignments : clone(fallback.assignments),
    seasonMonths: Array.isArray(next.seasonMonths) ? next.seasonMonths : clone(fallback.seasonMonths),
    highDemandDays: Array.isArray(next.highDemandDays) ? next.highDemandDays : clone(fallback.highDemandDays),
  };
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
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ ok: false, message: 'Nicht angemeldet' });
  }
  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const state = await readFullState();

  if (username === state.auth.username && password === state.auth.password) {
    const token = crypto.randomUUID();
    activeTokens.add(token);
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, message: 'Ungültige Anmeldedaten' });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = getBearerToken(req);
  if (token) activeTokens.delete(token);
  res.json({ ok: true });
});

app.get('/api/state', requireAuth, async (_req, res) => {
  const state = await readFullState();
  res.json(publicStateFrom(state));
});

app.put('/api/state', requireAuth, async (req, res) => {
  const current = await readFullState();
  const next = sanitizeState({
    ...req.body,
    auth: current.auth,
  });
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
app.listen(port, () => {
  console.log(`TeamTimer läuft auf http://localhost:${port}`);
  console.log(`Datendatei: ${dataFile}`);
});
