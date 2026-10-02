// Връзка със сървъра на играта (Cloudflare Worker). Всичко онлайн минава оттук.
import type { Save } from '../game/state';

const DEFAULT_API = 'https://ferma-api.metko.uk';
/** Адресът може да се смени за тестове: localStorage rf-api. */
export const API = (() => {
  try { return localStorage.getItem('rf-api') || DEFAULT_API; } catch { return DEFAULT_API; }
})();

export interface Player { id: number; name: string; farm: string; level: number; likes: number; seen: number }
export interface Friend extends Player { helpsLeft: number; mutual: boolean }
export interface CloudMeta { rev: number; saved: number; level: number }
export interface Listing { id: number; item: string; qty: number; price: number; seller: string; friend: number }
export interface MyListing { id: number; item: string; qty: number; price: number; created: number; sold: number; buyerName: string | null }
export interface TopRow { rank: number; name: string; farm: string; level: number; value: number; me: boolean }

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) { super(message); }
}

let token = (() => { try { return localStorage.getItem('rf-token') || ''; } catch { return ''; } })();
export const hasToken = () => !!token;
export function setToken(t: string) {
  token = t;
  try { t ? localStorage.setItem('rf-token', t) : localStorage.removeItem('rf-token'); } catch {}
}

async function call<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new ApiError(0, 'Няма връзка с интернет.');
  }
  let data: Record<string, unknown> = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && path !== '/api/login') setToken('');
    throw new ApiError(r.status, String(data.error || 'Нещо се обърка.'), data);
  }
  return data as T;
}

export const api = {
  register: (name: string, pass: string, farm: string) => call<{ token: string; me: Player; cloud: CloudMeta }>('POST', '/api/register', { name, pass, farm }),
  login: (name: string, pass: string) => call<{ token: string; me: Player; cloud: CloudMeta }>('POST', '/api/login', { name, pass }),
  logout: () => call<{ ok: boolean }>('POST', '/api/logout'),
  me: () => call<{ me: Player; cloud: CloudMeta }>('GET', '/api/me'),
  password: (old: string, pass: string) => call<{ ok: boolean }>('POST', '/api/password', { old, pass }),
  deleteAccount: (pass: string) => call<{ ok: boolean }>('DELETE', '/api/account', { pass }),
  getSave: () => call<{ save: Save | null; rev: number; saved: number }>('GET', '/api/save'),
  putSave: (save: Save, rev: number, force = false, keepalive = false) => call<{ rev: number; saved: number }>('PUT', '/api/save', { save, rev, force }, keepalive),
  players: (q = '') => call<{ rows: Player[] }>('GET', '/api/players?q=' + encodeURIComponent(q)),
  friends: () => call<{ rows: Friend[]; fans: Player[] }>('GET', '/api/friends'),
  addFriend: (name: string) => call<{ friend: Player }>('POST', '/api/friends', { name }),
  removeFriend: (id: number) => call<{ ok: boolean }>('DELETE', '/api/friends/' + id),
  farm: (name: string) => call<{ player: Player; save: Save; helpsLeft: number; likedToday: boolean; friend: boolean }>('GET', '/api/farm/' + encodeURIComponent(name)),
  help: (to: string, uid: number, kind: 'field' | 'animal' | 'tree') => call<{ ok: boolean; helpsLeft: number }>('POST', '/api/help', { to, uid, kind }),
  like: (to: string) => call<{ ok: boolean; likes: number }>('POST', '/api/like', { to }),
  inbox: () => call<{ helps: { id: number; uid: number; kind: string; name: string }[]; sold: { id: number; item: string; qty: number; price: number; buyer: string }[] }>('GET', '/api/inbox'),
  ack: (helps: number[]) => call<{ ok: boolean }>('POST', '/api/inbox/ack', { helps }),
  top: (by: string) => call<{ rows: TopRow[]; me: { rank: number; value: number } }>('GET', '/api/top?by=' + by),
  market: () => call<{ rows: Listing[] }>('GET', '/api/market'),
  myMarket: () => call<{ rows: MyListing[]; max: number }>('GET', '/api/market/mine'),
  list: (item: string, qty: number, price: number) => call<{ id: number }>('POST', '/api/market', { item, qty, price }),
  buy: (id: number) => call<{ item: string; qty: number; price: number }>('POST', `/api/market/${id}/buy`),
  undoBuy: (id: number) => call<{ ok: boolean }>('POST', `/api/market/${id}/undo`),
  collect: (id: number) => call<{ price: number }>('POST', `/api/market/${id}/collect`),
  unlist: (id: number) => call<{ item: string; qty: number }>('DELETE', `/api/market/${id}`),
};
