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
    username: String(process.env.ADMIN_USERNAME || 'admin'),
    password: String(process.env.ADMIN_PASSWORD || 'admin'),
  };
}

function getSessionSecret() {
  return String(process.env.SESSION_SECRET || 'teamtimer-dev-secret-change-me');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function sanitizeUserAccount(input) {
  if (!input || typeof input !== 'object') return null;

  return {
    id: String(input.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    username: String(input.username || '').trim(),
    displayName: String(input.displayName || '').trim(),
    active: Boolean(input.active),
    canManageKasse: Boolean(input.canManageKasse),
    canManageSupervision: Boolean(input.canManageSupervision),
    passwordHash: String(input.passwordHash || ''),
    createdAt: String(input.createdAt || new Date().toISOString()),
  };
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
    userAccounts: Array.isArray(next.userAccounts)
      ? next.userAccounts.map(sanitizeUserAccount).filter(Boolean)
      : clone(fallback.userAccounts),
  };
}

function buildPermissions({ isAdmin = false, canManageKasse = false, canManageSupervision = false } = {}) {
  if (isAdmin) {
    return {
      canManageKasse: true,
      canManageSupervision: true,
      canManageVacation: true,
      canManageAccounts: true,
      canExportCombined: true,
    };
  }

  return {
    canManageKasse: Boolean(canManageKasse),
    canManageSupervision: Boolean(canManageSupervision),
    canManageVacation: true,
    canManageAccounts: false,
    canExportCombined: false,
  };
}

function buildAdminUser() {
  const auth = getConfiguredAuth();
  return {
    username: auth.username,
    displayName: 'Administrator',
    isAdmin: true,
    permissions: buildPermissions({ isAdmin: true }),
  };
}

function buildAccountUser(account) {
  return {
    username: account.username,
    displayName: account.displayName || account.username,
    isAdmin: false,
    permissions: buildPermissions(account),
  };
}

function createToken(user) {
  const payload = {
    user,
    exp: Date.now() + sessionTtlHours * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || revokedTokens.has(token)) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload?.exp !== 'number' || payload.exp <= Date.now()) return null;
    if (!payload?.user || typeof payload.user !== 'object') return null;
    return payload;
  } catch {
    return null;
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

function publicAccountsFrom(fullState) {
  return fullState.userAccounts.map(account => ({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    active: account.active,
    canManageKasse: account.canManageKasse,
    canManageSupervision: account.canManageSupervision,
    createdAt: account.createdAt,
  }));
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
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, message: 'Nicht angemeldet' });
  }

  req.auth = payload;
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.auth?.user?.isAdmin) {
    return res.status(403).json({ ok: false, message: 'Nur Admin erlaubt' });
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
  const enteredUsername = String(username || '').trim();
  const enteredPassword = String(password || '');

  if (enteredUsername === auth.username && enteredPassword === auth.password) {
    const user = buildAdminUser();
    const token = createToken(user);
    return res.json({ ok: true, token, user });
  }

  const state = await readFullState();
  const account = state.userAccounts.find(item => item.active && item.username === enteredUsername);
  if (account && account.passwordHash === hashPassword(enteredPassword)) {
    const user = buildAccountUser(account);
    const token = createToken(user);
    return res.json({ ok: true, token, user });
  }

  return res.status(401).json({ ok: false, message: 'Ungültige Anmeldedaten' });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = getBearerToken(req);
  if (token) revokedTokens.add(token);
  res.json({ ok: true });
});

app.get('/api/session', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.auth.user });
});

app.get('/api/state', requireAuth, async (_req, res) => {
  const state = await readFullState();
  res.json(publicStateFrom(state));
});

app.put('/api/state', requireAuth, async (req, res) => {
  const current = await readFullState();
  const next = sanitizeState({ ...req.body, userAccounts: current.userAccounts });
  const saved = await writeFullState(next);
  res.json({ ok: true, state: publicStateFrom(saved) });
});

app.get('/api/accounts', requireAuth, requireAdmin, async (_req, res) => {
  const state = await readFullState();
  res.json(publicAccountsFrom(state));
});

app.post('/api/accounts', requireAuth, requireAdmin, async (req, res) => {
  const state = await readFullState();
  const { username, displayName, password, active, canManageKasse, canManageSupervision } = req.body || {};
  const cleanUsername = String(username || '').trim();
  const cleanDisplayName = String(displayName || '').trim();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanDisplayName || !cleanPassword) {
    return res.status(400).json({ ok: false, message: 'Benutzername, Anzeigename und Passwort sind Pflichtfelder.' });
  }

  if (!canManageKasse && !canManageSupervision) {
    return res.status(400).json({ ok: false, message: 'Bitte mindestens Kasse oder Badeaufsicht erlauben.' });
  }

  if (cleanUsername === getConfiguredAuth().username) {
    return res.status(400).json({ ok: false, message: 'Dieser Benutzername ist für den Admin reserviert.' });
  }

  if (state.userAccounts.some(account => account.username === cleanUsername)) {
    return res.status(400).json({ ok: false, message: 'Benutzername existiert bereits.' });
  }

  state.userAccounts.push(sanitizeUserAccount({
    username: cleanUsername,
    displayName: cleanDisplayName,
    active: Boolean(active),
    canManageKasse: Boolean(canManageKasse),
    canManageSupervision: Boolean(canManageSupervision),
    passwordHash: hashPassword(cleanPassword),
    createdAt: new Date().toISOString(),
  }));

  const saved = await writeFullState(state);
  res.json(publicAccountsFrom(saved));
});

app.put('/api/accounts/:id', requireAuth, requireAdmin, async (req, res) => {
  const state = await readFullState();
  const account = state.userAccounts.find(item => item.id === req.params.id);

  if (!account) {
    return res.status(404).json({ ok: false, message: 'Konto nicht gefunden.' });
  }

  const { username, displayName, password, active, canManageKasse, canManageSupervision } = req.body || {};
  const cleanUsername = String(username || '').trim();
  const cleanDisplayName = String(displayName || '').trim();
  const cleanPassword = String(password || '');

  if (!cleanUsername || !cleanDisplayName) {
    return res.status(400).json({ ok: false, message: 'Benutzername und Anzeigename sind Pflichtfelder.' });
  }

  if (!canManageKasse && !canManageSupervision) {
    return res.status(400).json({ ok: false, message: 'Bitte mindestens Kasse oder Badeaufsicht erlauben.' });
  }

  if (cleanUsername === getConfiguredAuth().username) {
    return res.status(400).json({ ok: false, message: 'Dieser Benutzername ist für den Admin reserviert.' });
  }

  if (state.userAccounts.some(item => item.id !== account.id && item.username === cleanUsername)) {
    return res.status(400).json({ ok: false, message: 'Benutzername existiert bereits.' });
  }

  account.username = cleanUsername;
  account.displayName = cleanDisplayName;
  account.active = Boolean(active);
  account.canManageKasse = Boolean(canManageKasse);
  account.canManageSupervision = Boolean(canManageSupervision);
  if (cleanPassword) {
    account.passwordHash = hashPassword(cleanPassword);
  }

  const saved = await writeFullState(state);
  res.json(publicAccountsFrom(saved));
});

app.delete('/api/accounts/:id', requireAuth, requireAdmin, async (req, res) => {
  const state = await readFullState();
  const nextAccounts = state.userAccounts.filter(item => item.id !== req.params.id);
  if (nextAccounts.length === state.userAccounts.length) {
    return res.status(404).json({ ok: false, message: 'Konto nicht gefunden.' });
  }

  state.userAccounts = nextAccounts;
  const saved = await writeFullState(state);
  res.json(publicAccountsFrom(saved));
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
