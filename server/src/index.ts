// Родопска ферма — онлайн сървър (Cloudflare Worker + D1).
// Регистрация с име и парола, запис на фермата в облака, приятели, гостуване и помощ,
// класации и пазар между играчите. Без чат и без имейли.
import { ITEMS } from '../../src/game/data';

interface D1Result<T = unknown> { results: T[]; meta: { changes: number; last_row_id: number } }
interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1 { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<D1Result[]> }
interface Env { DB: D1 }

type User = { id: number; name: string; farm: string; level: number; xp: number; earned: number; orders: number; likes: number; rev: number; saved: number; seen: number; week: string; week_earned: number };

const MAX_SAVE = 600_000; // байта
const HELPS_PER_FRIEND = 5; // на ден, от един приятел на друг
const HELPS_PER_DAY = 40; // общо на ден от един играч
const MAX_LISTINGS = 6;
const MAX_FRIENDS = 100;

// ---------------------------------------------------------------- помощни
class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}
const fail = (status: number, msg: string, extra: Record<string, unknown> = {}) => { throw new HttpError(status, msg, extra); };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
function randomHex(n: number) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}
async function sha256(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
async function hashPass(pass: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return b64(bits);
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Денят и седмицата по българско време (за лимитите и седмичната класация). */
function dayKey(t = Date.now()) {
  return new Date(t + 3 * 3600_000).toISOString().slice(0, 10);
}
function weekKey(t = Date.now()) {
  const d = new Date(t + 3 * 3600_000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = d.getUTCFullYear();
  const w1 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((d.getTime() - w1.getTime()) / 86400_000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

// груби думи — не се допускат в имена на играчи и ферми (сравнява се без интервали и с латиницата като кирилица)
const BAD = ['путк', 'пичк', 'хуй', 'еба', 'ебе', 'шиба', 'курв', 'педал', 'мамка', 'мамицата', 'задник', 'лайн', 'гъз', 'сперм', 'секс', 'порн', 'нацист', 'хитлер',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'porn', 'sex', 'nazi', 'hitler', 'nigg', 'whore', 'slut', 'asshole'];
const LAT2CYR: Record<string, string> = { a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'у', z: 'з', '0': 'о', '3': 'з', '4': 'ч', '6': 'б' };
function isRude(s: string) {
  const low = s.toLowerCase().replace(/[\s._\-]+/g, '');
  const cyr = [...low].map((c) => LAT2CYR[c] ?? c).join('');
  return BAD.some((w) => low.includes(w) || cyr.includes(w));
}
function cleanName(raw: unknown) {
  const s = String(raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (s.length < 3 || s.length > 16) fail(400, 'Името трябва да е от 3 до 16 знака.');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(s)) fail(400, 'Името може да съдържа само букви, цифри, интервал, точка, тире и долна черта.');
  if (isRude(s)) fail(400, 'Избери по-хубаво име.');
  return s;
}
function cleanFarm(raw: unknown) {
  let s = String(raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, 24);
  s = s.replace(/[<>]/g, '');
  if (!s || isRude(s)) return 'Ферма';
  return s;
}
function cleanPass(raw: unknown) {
  const s = String(raw ?? '');
  if (s.length < 6) fail(400, 'Паролата трябва да е поне 6 знака.');
  if (s.length > 64) fail(400, 'Паролата е твърде дълга.');
  return s;
}

/** Ограничение: най-много n пъти за sec секунди по даден ключ. */
async function limit(env: Env, key: string, n: number, sec: number) {
  const t = Date.now();
  const row = await env.DB.prepare('SELECT n, until FROM limits WHERE key = ?').bind(key).first<{ n: number; until: number }>();
  if (!row || row.until < t) {
    await env.DB.prepare('INSERT OR REPLACE INTO limits (key, n, until) VALUES (?, 1, ?)').bind(key, t + sec * 1000).run();
    return;
  }
  if (row.n >= n) fail(429, 'Твърде много опити. Опитай пак малко по-късно.');
  await env.DB.prepare('UPDATE limits SET n = n + 1 WHERE key = ?').bind(key).run();
}

async function body(req: Request): Promise<Record<string, unknown>> {
  const len = +(req.headers.get('Content-Length') || 0);
  if (len > MAX_SAVE + 4096) fail(413, 'Записът е твърде голям.');
  const txt = await req.text();
  if (txt.length > MAX_SAVE + 4096) fail(413, 'Записът е твърде голям.');
  try { return txt ? JSON.parse(txt) : {}; } catch { fail(400, 'Грешни данни.'); }
  return {};
}

const USER_COLS = 'id, name, farm, level, xp, earned, orders, likes, rev, saved, seen, week, week_earned';
function pub(u: User) {
  return { id: u.id, name: u.name, farm: u.farm, level: u.level, likes: u.likes, seen: u.seen };
}

async function auth(env: Env, req: Request): Promise<User> {
  const h = req.headers.get('Authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!/^[0-9a-f]{64}$/.test(tok)) fail(401, 'Влез отново в профила си.');
  const th = await sha256(tok);
  const u = await env.DB.prepare(`SELECT ${USER_COLS.split(', ').map((c) => 'u.' + c).join(', ')}, s.seen AS sseen FROM sessions s JOIN users u ON u.id = s.user WHERE s.token = ?`).bind(th).first<User & { sseen: number }>();
  if (!u) fail(401, 'Влез отново в профила си.');
  const t = Date.now();
  // „видян“ обновяваме най-много веднъж на 5 минути
  if (t - u!.sseen > 300_000) {
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET seen = ? WHERE token = ?').bind(t, th),
      env.DB.prepare('UPDATE users SET seen = ? WHERE id = ?').bind(t, u!.id),
    ]);
  }
  return u!;
}

async function newSession(env: Env, user: number) {
  const tok = randomHex(32);
  const t = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token, user, created, seen) VALUES (?, ?, ?, ?)').bind(await sha256(tok), user, t, t).run();
  return tok;
}

async function userByName(env: Env, name: unknown) {
  const key = String(name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) fail(400, 'Няма име.');
  const u = await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE name_key = ?`).bind(key).first<User>();
  if (!u) fail(404, 'Няма такъв играч.');
  return u!;
}

/** Само видимата част от фермата (без склада, парите и поръчките) — за гостуване. */
function publicSave(save: Record<string, unknown>) {
  const keep = ['v', 'name', 'level', 'entities', 'lands', 'home', 'cars', 'village', 'created', 'last'];
  const out: Record<string, unknown> = {};
  for (const k of keep) if (k in save) out[k] = save[k];
  out.inv = {};
  out.orders = [];
  return out;
}

// ---------------------------------------------------------------- маршрути
type Handler = (env: Env, req: Request, m: RegExpMatchArray, url: URL) => Promise<unknown>;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, path: string, h: Handler) => routes.push([method, new RegExp('^' + path + '$'), h]);

route('GET', '/api/ping', async () => ({ ok: true, t: Date.now() }));

route('POST', '/api/register', async (env, req) => {
  const b = await body(req);
  const name = cleanName(b.name);
  const pass = cleanPass(b.pass);
  const ip = req.headers.get('CF-Connecting-IP') || 'x';
  await limit(env, 'reg:' + ip, 8, 3600);
  const key = name.toLowerCase();
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE name_key = ?').bind(key).first();
  if (exists) fail(409, 'Това име е заето. Избери друго.');
  const salt = randomHex(16);
  const t = Date.now();
  const r = await env.DB.prepare('INSERT INTO users (name, name_key, pass, salt, created, seen, farm) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(name, key, await hashPass(pass, salt), salt, t, t, cleanFarm(b.farm)).run();
  const id = r.meta.last_row_id;
  const token = await newSession(env, id);
  return { token, me: { id, name, farm: cleanFarm(b.farm), level: 1, likes: 0 }, cloud: { rev: 0, saved: 0, level: 0 } };
});

route('POST', '/api/login', async (env, req) => {
  const b = await body(req);
  const key = String(b.name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  const pass = String(b.pass ?? '');
  if (!key || !pass) fail(400, 'Напиши име и парола.');
  await limit(env, 'login:' + key, 12, 900);
  const u = await env.DB.prepare(`SELECT ${USER_COLS}, pass, salt FROM users WHERE name_key = ?`).bind(key).first<User & { pass: string; salt: string }>();
  if (!u || !safeEqual(await hashPass(pass, u.salt), u.pass)) fail(401, 'Грешно име или парола.');
  const token = await newSession(env, u!.id);
  return { token, me: pub(u!), cloud: { rev: u!.rev, saved: u!.saved, level: u!.level } };
});

route('POST', '/api/logout', async (env, req) => {
  const h = req.headers.get('Authorization') || '';
  const tok = h.slice(7).trim();
  if (/^[0-9a-f]{64}$/.test(tok)) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha256(tok)).run();
  return { ok: true };
});

route('GET', '/api/me', async (env, req) => {
  const u = await auth(env, req);
  return { me: pub(u), cloud: { rev: u.rev, saved: u.saved, level: u.level } };
});

route('POST', '/api/password', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const row = await env.DB.prepare('SELECT pass, salt FROM users WHERE id = ?').bind(u.id).first<{ pass: string; salt: string }>();
  if (!row || !safeEqual(await hashPass(String(b.old ?? ''), row.salt), row.pass)) fail(401, 'Старата парола е грешна.');
  const salt = randomHex(16);
  await env.DB.prepare('UPDATE users SET pass = ?, salt = ? WHERE id = ?').bind(await hashPass(cleanPass(b.pass), salt), salt, u.id).run();
  return { ok: true };
});

route('DELETE', '/api/account', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const row = await env.DB.prepare('SELECT pass, salt FROM users WHERE id = ?').bind(u.id).first<{ pass: string; salt: string }>();
  if (!row || !safeEqual(await hashPass(String(b.pass ?? ''), row.salt), row.pass)) fail(401, 'Грешна парола.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user = ?').bind(u.id),
    env.DB.prepare('DELETE FROM friends WHERE user = ? OR friend = ?').bind(u.id, u.id),
    env.DB.prepare('DELETE FROM helps WHERE helper = ? OR owner = ?').bind(u.id, u.id),
    env.DB.prepare('DELETE FROM likes WHERE liker = ? OR owner = ?').bind(u.id, u.id),
    env.DB.prepare('DELETE FROM listings WHERE seller = ?').bind(u.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id),
  ]);
  return { ok: true };
});

// ---------- запис в облака
route('GET', '/api/save', async (env, req) => {
  const u = await auth(env, req);
  const row = await env.DB.prepare('SELECT save, rev, saved FROM users WHERE id = ?').bind(u.id).first<{ save: string | null; rev: number; saved: number }>();
  return { save: row?.save ? JSON.parse(row.save) : null, rev: row?.rev ?? 0, saved: row?.saved ?? 0 };
});

route('PUT', '/api/save', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const save = b.save as Record<string, unknown> | undefined;
  if (!save || typeof save !== 'object' || save.v !== 1 || !Array.isArray(save.entities)) fail(400, 'Грешен запис.');
  const txt = JSON.stringify(save);
  if (txt.length > MAX_SAVE) fail(413, 'Записът е твърде голям.');
  const base = Number(b.rev ?? -1);
  if (!b.force && base !== u.rev) fail(409, 'В облака има по-нов запис.', { rev: u.rev, saved: u.saved, level: u.level });
  const s = save as { level?: number; xp?: number; name?: string; last?: number; stats?: { earned?: number; orders?: number } };
  const level = Math.max(1, Math.min(99, Math.floor(Number(s.level) || 1)));
  const xp = Math.max(0, Math.floor(Number(s.xp) || 0));
  const earned = Math.max(0, Math.floor(Number(s.stats?.earned) || 0));
  const orders = Math.max(0, Math.floor(Number(s.stats?.orders) || 0));
  // седмична класация: прибавяме спечеленото от последния запис насам
  const wk = weekKey();
  const delta = Math.max(0, Math.min(earned - u.earned, 5_000_000));
  const weekEarned = (u.week === wk ? u.week_earned : 0) + (earned >= u.earned ? delta : 0);
  const rev = u.rev + 1;
  const saved = Math.min(Date.now() + 60_000, Math.floor(Number(s.last) || Date.now()));
  await env.DB.prepare('UPDATE users SET save = ?, rev = ?, saved = ?, level = ?, xp = ?, earned = ?, orders = ?, farm = ?, week = ?, week_earned = ? WHERE id = ?')
    .bind(txt, rev, saved, level, xp, earned, orders, cleanFarm(s.name), wk, weekEarned, u.id).run();
  return { rev, saved };
});

// ---------- играчи и приятели
route('GET', '/api/players', async (env, req, _m, url) => {
  const u = await auth(env, req);
  const q = (url.searchParams.get('q') || '').normalize('NFC').trim().toLowerCase().slice(0, 16);
  let rows;
  if (q) {
    rows = await env.DB.prepare('SELECT id, name, farm, level, likes, seen FROM users WHERE name_key LIKE ? AND id != ? ORDER BY seen DESC LIMIT 20').bind(q.replace(/[%_]/g, '') + '%', u.id).all<User>();
  } else {
    // предложени съседи: активни напоследък, близо до моето ниво
    rows = await env.DB.prepare('SELECT id, name, farm, level, likes, seen FROM users WHERE id != ? AND save IS NOT NULL AND id NOT IN (SELECT friend FROM friends WHERE user = ?) ORDER BY seen DESC LIMIT 60').bind(u.id, u.id).all<User>();
    rows.results.sort((a, b) => Math.abs(a.level - u.level) - Math.abs(b.level - u.level));
    rows.results = rows.results.slice(0, 12);
  }
  return { rows: rows.results.map(pub) };
});

route('GET', '/api/friends', async (env, req) => {
  const u = await auth(env, req);
  const day = dayKey();
  const rows = await env.DB.prepare(`SELECT u.id, u.name, u.farm, u.level, u.likes, u.seen,
      (SELECT COUNT(*) FROM helps h WHERE h.helper = ? AND h.owner = u.id AND h.day = ?) AS helped,
      EXISTS (SELECT 1 FROM friends f2 WHERE f2.user = u.id AND f2.friend = ?) AS mutual
    FROM friends f JOIN users u ON u.id = f.friend WHERE f.user = ? ORDER BY u.seen DESC`).bind(u.id, day, u.id, u.id).all<User & { helped: number; mutual: number }>();
  // кои са ме добавили, но аз тях — не
  const fans = await env.DB.prepare('SELECT u.id, u.name, u.farm, u.level, u.likes, u.seen FROM friends f JOIN users u ON u.id = f.user WHERE f.friend = ? AND f.user NOT IN (SELECT friend FROM friends WHERE user = ?) ORDER BY f.created DESC LIMIT 20').bind(u.id, u.id).all<User>();
  return {
    rows: rows.results.map((r) => ({ ...pub(r), helpsLeft: Math.max(0, HELPS_PER_FRIEND - r.helped), mutual: !!r.mutual })),
    fans: fans.results.map(pub),
  };
});

route('POST', '/api/friends', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const f = await userByName(env, b.name);
  if (f.id === u.id) fail(400, 'Това си ти 🙂');
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM friends WHERE user = ?').bind(u.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_FRIENDS) fail(400, `Можеш да имаш най-много ${MAX_FRIENDS} приятели.`);
  await env.DB.prepare('INSERT OR IGNORE INTO friends (user, friend, created) VALUES (?, ?, ?)').bind(u.id, f.id, Date.now()).run();
  return { friend: pub(f) };
});

route('DELETE', '/api/friends/(\\d+)', async (env, req, m) => {
  const u = await auth(env, req);
  await env.DB.prepare('DELETE FROM friends WHERE user = ? AND friend = ?').bind(u.id, +m[1]).run();
  return { ok: true };
});

// ---------- гостуване
route('GET', '/api/farm/([^/]+)', async (env, req, m) => {
  const u = await auth(env, req);
  const f = await userByName(env, decodeURIComponent(m[1]));
  const row = await env.DB.prepare('SELECT save FROM users WHERE id = ?').bind(f.id).first<{ save: string | null }>();
  if (!row?.save) fail(404, 'Този играч още няма ферма в облака.');
  const day = dayKey();
  const helped = await env.DB.prepare('SELECT COUNT(*) AS n FROM helps WHERE helper = ? AND owner = ? AND day = ?').bind(u.id, f.id, day).first<{ n: number }>();
  const liked = await env.DB.prepare('SELECT 1 FROM likes WHERE liker = ? AND owner = ? AND day = ?').bind(u.id, f.id, day).first();
  const friend = await env.DB.prepare('SELECT 1 FROM friends WHERE user = ? AND friend = ?').bind(u.id, f.id).first();
  return {
    player: pub(f),
    save: publicSave(JSON.parse(row.save)),
    helpsLeft: f.id === u.id ? 0 : Math.max(0, HELPS_PER_FRIEND - (helped?.n ?? 0)),
    likedToday: !!liked,
    friend: !!friend,
  };
});

route('POST', '/api/help', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const f = await userByName(env, b.to);
  if (f.id === u.id) fail(400, 'Не можеш да помагаш сам на себе си.');
  const kind = String(b.kind);
  if (!['field', 'animal', 'tree'].includes(kind)) fail(400, 'Грешна помощ.');
  const uid = Math.floor(Number(b.uid));
  if (!(uid > 0)) fail(400, 'Грешна помощ.');
  const day = dayKey();
  const same = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(uid = ?) AS dup FROM helps WHERE helper = ? AND owner = ? AND day = ?').bind(uid, u.id, f.id, day).first<{ n: number; dup: number }>();
  if ((same?.dup ?? 0) > 0) fail(400, 'Вече помогна тук днес.');
  if ((same?.n ?? 0) >= HELPS_PER_FRIEND) fail(429, `Днес вече помогна ${HELPS_PER_FRIEND} пъти на ${f.name}. Ела утре!`);
  const all = await env.DB.prepare('SELECT COUNT(*) AS n FROM helps WHERE helper = ? AND day = ?').bind(u.id, day).first<{ n: number }>();
  if ((all?.n ?? 0) >= HELPS_PER_DAY) fail(429, 'Днес помогна достатъчно. Ела утре!');
  await env.DB.prepare('INSERT INTO helps (helper, owner, uid, kind, day, created) VALUES (?, ?, ?, ?, ?, ?)').bind(u.id, f.id, uid, kind, day, Date.now()).run();
  return { ok: true, helpsLeft: HELPS_PER_FRIEND - (same?.n ?? 0) - 1 };
});

route('POST', '/api/like', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const f = await userByName(env, b.to);
  if (f.id === u.id) fail(400, 'Не можеш да харесаш собствената си ферма 🙂');
  const r = await env.DB.prepare('INSERT OR IGNORE INTO likes (liker, owner, day) VALUES (?, ?, ?)').bind(u.id, f.id, dayKey()).run();
  if (r.meta.changes) await env.DB.prepare('UPDATE users SET likes = likes + 1 WHERE id = ?').bind(f.id).run();
  return { ok: true, likes: f.likes + (r.meta.changes ? 1 : 0) };
});

// ---------- известия: кой ми помогна, какво продадох
route('GET', '/api/inbox', async (env, req) => {
  const u = await auth(env, req);
  const helps = await env.DB.prepare('SELECT h.id, h.uid, h.kind, u.name AS name FROM helps h JOIN users u ON u.id = h.helper WHERE h.owner = ? AND h.done = 0 ORDER BY h.id LIMIT 100').bind(u.id).all();
  const sold = await env.DB.prepare('SELECT l.id, l.item, l.qty, l.price, COALESCE(u.name, ?) AS buyer FROM listings l LEFT JOIN users u ON u.id = l.buyer WHERE l.seller = ? AND l.buyer IS NOT NULL AND l.collected = 0').bind('играч', u.id).all();
  return { helps: helps.results, sold: sold.results };
});

route('POST', '/api/inbox/ack', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const ids = (Array.isArray(b.helps) ? b.helps : []).map(Number).filter((x) => x > 0).slice(0, 100);
  if (ids.length) await env.DB.prepare(`UPDATE helps SET done = 1 WHERE owner = ? AND id IN (${ids.map(() => '?').join(',')})`).bind(u.id, ...ids).run();
  return { ok: true };
});

// ---------- класации
route('GET', '/api/top', async (env, req, _m, url) => {
  const u = await auth(env, req);
  const by = url.searchParams.get('by') || 'level';
  const wk = weekKey();
  const q: Record<string, [string, string, (x: User) => number]> = {
    level: ['save IS NOT NULL', 'level DESC, xp DESC', (x) => x.level],
    earned: ['save IS NOT NULL', 'earned DESC', (x) => x.earned],
    week: [`week = '${wk}'`, 'week_earned DESC', (x) => x.week_earned],
    likes: ['likes > 0', 'likes DESC', (x) => x.likes],
  };
  const [where, order, val] = q[by] ?? q.level;
  const rows = await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE ${where} ORDER BY ${order} LIMIT 50`).all<User>();
  let myRank = 0;
  const idx = rows.results.findIndex((r) => r.id === u.id);
  if (idx >= 0) myRank = idx + 1;
  else {
    const mine = val(u);
    const col = by === 'week' ? 'week_earned' : by === 'earned' ? 'earned' : by === 'likes' ? 'likes' : 'level';
    const ahead = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE ${where} AND ${col} > ?`).bind(by === 'week' && u.week !== wk ? 0 : mine).first<{ n: number }>();
    myRank = (ahead?.n ?? 0) + 1;
  }
  return {
    rows: rows.results.map((r, i) => ({ rank: i + 1, name: r.name, farm: r.farm, level: r.level, value: val(r), me: r.id === u.id })),
    me: { rank: myRank, value: by === 'week' && u.week !== wk ? 0 : val(u) },
  };
});

// ---------- пазар между играчите
function maxPrice(item: string, qty: number) {
  return Math.max(1, Math.round(ITEMS[item].price * qty * 3));
}

route('GET', '/api/market', async (env, req) => {
  const u = await auth(env, req);
  // първо стоките на приятелите, после на всички (най-новите)
  const fr = await env.DB.prepare(`SELECT l.id, l.item, l.qty, l.price, u.name AS seller, 1 AS friend FROM listings l JOIN users u ON u.id = l.seller
    WHERE l.buyer IS NULL AND l.seller IN (SELECT friend FROM friends WHERE user = ?) ORDER BY l.created DESC LIMIT 30`).bind(u.id).all();
  const all = await env.DB.prepare(`SELECT l.id, l.item, l.qty, l.price, u.name AS seller, 0 AS friend FROM listings l JOIN users u ON u.id = l.seller
    WHERE l.buyer IS NULL AND l.seller != ? ORDER BY l.created DESC LIMIT 60`).bind(u.id).all<{ id: number }>();
  const seen = new Set(fr.results.map((r) => (r as { id: number }).id));
  return { rows: [...fr.results, ...all.results.filter((r) => !seen.has(r.id))].slice(0, 60) };
});

route('GET', '/api/market/mine', async (env, req) => {
  const u = await auth(env, req);
  const rows = await env.DB.prepare('SELECT l.id, l.item, l.qty, l.price, l.created, l.buyer IS NOT NULL AS sold, b.name AS buyerName FROM listings l LEFT JOIN users b ON b.id = l.buyer WHERE l.seller = ? AND l.collected = 0 ORDER BY l.id').bind(u.id).all();
  return { rows: rows.results, max: MAX_LISTINGS };
});

route('POST', '/api/market', async (env, req) => {
  const u = await auth(env, req);
  const b = await body(req);
  const item = String(b.item);
  const it = ITEMS[item];
  if (!it || it.kind === 'feed') fail(400, 'Това не може да се продава.');
  const qty = Math.floor(Number(b.qty));
  if (!(qty >= 1 && qty <= 10)) fail(400, 'Количеството е от 1 до 10.');
  const price = Math.floor(Number(b.price));
  if (!(price >= 1 && price <= maxPrice(item, qty))) fail(400, `Цената е от 1 до ${maxPrice(item, qty)} монети.`);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM listings WHERE seller = ? AND collected = 0').bind(u.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_LISTINGS) fail(400, `Сергията ти има само ${MAX_LISTINGS} места.`);
  await limit(env, 'list:' + u.id, 60, 3600);
  const r = await env.DB.prepare('INSERT INTO listings (seller, item, qty, price, created) VALUES (?, ?, ?, ?, ?)').bind(u.id, item, qty, price, Date.now()).run();
  return { id: r.meta.last_row_id };
});

route('POST', '/api/market/(\\d+)/buy', async (env, req, m) => {
  const u = await auth(env, req);
  const id = +m[1];
  await limit(env, 'buy:' + u.id, 120, 3600);
  const r = await env.DB.prepare('UPDATE listings SET buyer = ?, sold = ? WHERE id = ? AND buyer IS NULL AND seller != ?').bind(u.id, Date.now(), id, u.id).run();
  if (!r.meta.changes) fail(409, 'Някой друг го купи преди теб.');
  const l = await env.DB.prepare('SELECT item, qty, price FROM listings WHERE id = ?').bind(id).first<{ item: string; qty: number; price: number }>();
  return l;
});

/** Ако купувачът не е успял да вземе стоката (няма място/монети) — връща обявата. */
route('POST', '/api/market/(\\d+)/undo', async (env, req, m) => {
  const u = await auth(env, req);
  await env.DB.prepare('UPDATE listings SET buyer = NULL, sold = NULL WHERE id = ? AND buyer = ? AND collected = 0 AND sold > ?').bind(+m[1], u.id, Date.now() - 120_000).run();
  return { ok: true };
});

route('POST', '/api/market/(\\d+)/collect', async (env, req, m) => {
  const u = await auth(env, req);
  const id = +m[1];
  const r = await env.DB.prepare('UPDATE listings SET collected = 1 WHERE id = ? AND seller = ? AND buyer IS NOT NULL AND collected = 0').bind(id, u.id).run();
  if (!r.meta.changes) fail(409, 'Вече е взето.');
  const l = await env.DB.prepare('SELECT price FROM listings WHERE id = ?').bind(id).first<{ price: number }>();
  return { price: l?.price ?? 0 };
});

route('DELETE', '/api/market/(\\d+)', async (env, req, m) => {
  const u = await auth(env, req);
  const id = +m[1];
  const l = await env.DB.prepare('SELECT item, qty FROM listings WHERE id = ? AND seller = ? AND buyer IS NULL').bind(id, u.id).first<{ item: string; qty: number }>();
  if (!l) fail(409, 'Вече е продадено.');
  const r = await env.DB.prepare('DELETE FROM listings WHERE id = ? AND seller = ? AND buyer IS NULL').bind(id, u.id).run();
  if (!r.meta.changes) fail(409, 'Вече е продадено.');
  return l;
});

// ---------------------------------------------------------------- вход
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      for (const [method, re, h] of routes) {
        if (method !== req.method) continue;
        const m = url.pathname.match(re);
        if (m) {
          const out = await h(env, req, m, url);
          // понякога чистим старите сесии и лимити
          if (Math.random() < 0.01) {
            const t = Date.now();
            await env.DB.batch([
              env.DB.prepare('DELETE FROM sessions WHERE seen < ?').bind(t - 90 * 86400_000),
              env.DB.prepare('DELETE FROM limits WHERE until < ?').bind(t),
              env.DB.prepare('DELETE FROM helps WHERE done = 1 AND created < ?').bind(t - 30 * 86400_000),
              env.DB.prepare('DELETE FROM likes WHERE day < ?').bind(dayKey(t - 3 * 86400_000)),
            ]);
          }
          return json(out);
        }
      }
      if (url.pathname === '/' || url.pathname === '') return new Response('Родопска ферма — сървър. Играта: https://me7ko-dev.github.io/rodopska-ferma/', { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
      return json({ error: 'Няма такова нещо.' }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json({ error: 'Сървърът има проблем. Опитай пак.' }, 500);
    }
  },
};
