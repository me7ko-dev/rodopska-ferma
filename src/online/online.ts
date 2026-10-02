// Онлайн: профил, запис в облака (на всички устройства една и съща ферма), известия за помощ и продажби.
import { api, ApiError, hasToken, setToken, type Player, type CloudMeta } from './api';
import { S, save, saveCount, setS, writeSave, freezeSave, VISIT, addCoins, addXP, now, type Save } from '../game/state';
import { ANIMALS, ITEMS, TREES } from '../game/data';
import type { Farm } from '../game/world';
import { UI } from '../ui/api';

export const ON = {
  me: null as Player | null,
  status: 'off' as 'off' | 'ok' | 'saving' | 'error' | 'offline',
  lastSync: 0,
  /** Продадени на пазара стоки, чиито монети още не са взети. */
  sold: [] as { id: number; item: string; qty: number; price: number; buyer: string }[],
  onChange: () => {},
};
let farmRef: Farm | null = null;
let uploaded = -1; // saveCount при последното качване
let busy = false;

function cacheMe(me: Player | null) {
  ON.me = me;
  try { me ? localStorage.setItem('rf-me', JSON.stringify(me)) : localStorage.removeItem('rf-me'); } catch {}
  ON.onChange();
}
try { const m = localStorage.getItem('rf-me'); if (m && hasToken()) ON.me = JSON.parse(m); } catch {}

export const loggedIn = () => hasToken() && !!ON.me;

// ---------------------------------------------------------------- наградите от гостуване (взимат се у дома)
interface Pending { coins: number; xp: number; helps: number }
export function addPending(p: Partial<Pending>) {
  const cur = readPending();
  cur.coins += p.coins ?? 0;
  cur.xp += p.xp ?? 0;
  cur.helps += p.helps ?? 0;
  try { localStorage.setItem('rf-pending', JSON.stringify(cur)); } catch {}
}
function readPending(): Pending {
  try { return { coins: 0, xp: 0, helps: 0, ...JSON.parse(localStorage.getItem('rf-pending') || '{}') }; } catch { return { coins: 0, xp: 0, helps: 0 }; }
}
function applyPending() {
  const p = readPending();
  if (!p.coins && !p.xp && !p.helps) return;
  try { localStorage.removeItem('rf-pending'); } catch {}
  S.stats.helps = (S.stats.helps ?? 0) + p.helps;
  if (p.coins) addCoins(p.coins);
  if (p.xp) addXP(p.xp);
  save();
  UI.toast(`Благодарност от съседите: +${p.coins} монети и +${p.xp} опит 💚`, 'ok');
}

// ---------------------------------------------------------------- вход / изход
async function afterLogin(me: Player, cloud: CloudMeta) {
  cacheMe(me);
  await firstSync(cloud);
}
export async function register(name: string, pass: string) {
  const r = await api.register(name, pass, S.name);
  setToken(r.token);
  await afterLogin(r.me, r.cloud);
}
export async function login(name: string, pass: string) {
  const r = await api.login(name, pass);
  setToken(r.token);
  await afterLogin(r.me, r.cloud);
}
export async function logout() {
  await syncNow().catch(() => {});
  try { await api.logout(); } catch {}
  setToken('');
  cacheMe(null);
  ON.status = 'off';
  ON.sold = [];
}
export async function deleteAccount(pass: string) {
  await api.deleteAccount(pass);
  setToken('');
  cacheMe(null);
  delete S.owner;
  delete S.cloudRev;
  save(true);
  ON.status = 'off';
}

// ---------------------------------------------------------------- запис в облака
const isFresh = (s: Save) => s.level <= 1 && s.xp < 5 && s.stats.orders === 0;

/** Сваля фермата от облака и презарежда играта. */
async function download() {
  const r = await api.getSave();
  if (!r.save) return false;
  freezeSave();
  writeSave({ ...r.save, owner: ON.me!.id, cloudRev: r.rev });
  location.reload();
  return true;
}

async function upload(force = false, keepalive = false) {
  if (!ON.me || VISIT) return;
  const n = saveCount;
  S.owner = ON.me.id;
  const body: Save = { ...S, owner: ON.me.id };
  ON.status = 'saving';
  ON.onChange();
  try {
    const r = await api.putSave(body, S.cloudRev ?? 0, force, keepalive);
    S.cloudRev = r.rev;
    save(true);
    uploaded = saveCount;
    if (saveCount !== n + 1) uploaded = n; // докато сме качвали, играчът е направил още нещо
    ON.status = 'ok';
    ON.lastSync = Date.now();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const d = e.data as unknown as CloudMeta;
      // в облака има по-нов запис от друго устройство
      if ((d.saved ?? 0) > S.last + 2000) { ON.status = 'ok'; askConflict(d); return; }
      S.cloudRev = d.rev;
      return upload(true);
    }
    ON.status = e instanceof ApiError && e.status === 0 ? 'offline' : 'error';
  } finally {
    ON.onChange();
  }
}

/** Първото свързване на това устройство с профила. */
async function firstSync(cloud: CloudMeta) {
  if (VISIT) return;
  if (!cloud.rev) { await upload(true); return; } // облакът е празен — качваме тази ферма
  if (S.owner === ON.me!.id) {
    if (cloud.saved > S.last + 2000) { await download(); return; }
    S.cloudRev = cloud.rev;
    await upload(true);
    return;
  }
  // ферма от друг профил или без профил
  if (isFresh(S)) { await download(); return; }
  askConflict(cloud, true);
}

function askConflict(cloud: CloudMeta, first = false) {
  UI.choose(
    first ? 'Коя ферма да остане?' : 'Фермата е играна на друго устройство',
    first
      ? `В профила ти вече има ферма (ниво ${cloud.level}). На това устройство има друга (ниво ${S.level}). Избери коя да остане — другата ще се изтрие.`
      : `На друго устройство има по-нова игра (ниво ${cloud.level}). Коя да остане?`,
    [
      { label: `☁️ Тази от профила (ниво ${cloud.level})`, cls: 'blue', act: () => { download().catch((e) => UI.toast(e.message, 'warn')); } },
      { label: `📱 Тази тук (ниво ${S.level})`, cls: '', act: () => { S.cloudRev = cloud.rev; upload(true); } },
    ],
  );
}

export async function syncNow(keepalive = false) {
  if (!loggedIn() || VISIT || busy) return;
  if (saveCount === uploaded) return;
  busy = true;
  try { await upload(false, keepalive); } finally { busy = false; }
}

// ---------------------------------------------------------------- известия
export async function checkInbox() {
  if (!loggedIn() || VISIT || !farmRef) return;
  let r;
  try { r = await api.inbox(); } catch { return; }
  if (r.helps.length) {
    const by = new Map<string, number>();
    for (const h of r.helps) {
      applyHelp(h.uid, h.kind);
      by.set(h.name, (by.get(h.name) ?? 0) + 1);
    }
    save();
    try { await api.ack(r.helps.map((h) => h.id)); } catch {}
    const who = [...by.entries()].map(([n, c]) => (c > 1 ? `${n} (${c} пъти)` : n)).join(', ');
    UI.toast(`💚 Помогнаха ти: ${who}`, 'ok');
  }
  const fresh = r.sold.filter((x) => !ON.sold.some((y) => y.id === x.id));
  ON.sold = r.sold;
  if (fresh.length) UI.toast(`🏷 Продаде ${fresh.map((x) => `${ITEMS[x.item]?.name ?? x.item} ×${x.qty} на ${x.buyer}`).join(', ')}! Вземи монетите от Сергията.`, 'ok');
  ON.onChange();
}

/** Помощ от приятел: нивата узрява, животните се нахранват, дървото дава плод. */
function applyHelp(uid: number, kind: string) {
  const v = farmRef?.views.get(uid);
  if (!v) return;
  const t = now();
  if (kind === 'field' && v.def.kind === 'field' && v.e.crop && (v.e.ready ?? 0) > t) { v.e.ready = t; v.setVisual?.(); }
  if (kind === 'animal' && v.def.kind === 'animal') {
    const a = ANIMALS[v.def.animal!];
    for (const s of v.e.animals ?? []) if (s.fed == null && a.feed) { s.fed = t; s.ready = t + a.time * 1000; }
  }
  if (kind === 'tree' && TREES[v.e.type] && (v.e.ready ?? 0) > t) v.e.ready = t;
}

// ---------------------------------------------------------------- старт
export function startOnline(farm: Farm) {
  farmRef = farm;
  if (VISIT) return;
  applyPending();
  uploaded = saveCount;
  if (!hasToken()) { cacheMe(null); return; }
  api.me().then(async (r) => {
    cacheMe(r.me);
    await firstSync(r.cloud);
    checkInbox();
  }).catch((e) => {
    if (e instanceof ApiError && e.status === 401) { cacheMe(null); UI.toast('Влез отново в профила си', 'info'); }
    else ON.status = 'offline';
    ON.onChange();
  });
  setInterval(() => { syncNow(); }, 30_000);
  setInterval(() => { checkInbox(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) syncNow(true); else checkInbox(); });
}

/** Отваря фермата на приятел (презарежда играта в режим „гости“). */
export function visit(name: string) {
  syncNow().finally(() => {
    const u = new URL(location.href);
    u.searchParams.set('gost', name);
    location.href = u.toString();
  });
}
export function goHome() {
  const u = new URL(location.href);
  u.searchParams.delete('gost');
  location.href = u.toString();
}

/** Зарежда фермата на приятел за гостуване (преди да се построи светът). */
export async function loadVisit() {
  const r = await api.farm(VISIT);
  const t = now();
  const sv = r.save;
  // в гостите нищо не „чака“ домакина: без дневен подарък и без наем
  sv.lastDaily = t;
  for (const k of Object.keys(sv.village ?? {})) (sv.village as Save['village'])[+k].last = t;
  setS(sv);
  return r;
}
export { setS };
