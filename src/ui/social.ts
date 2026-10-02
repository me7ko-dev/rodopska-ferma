// Онлайн интерфейс: профил (вход/регистрация), приятели, класации, пазар между играчите и гостуване.
import { UI } from './api';
import { img } from './icons';
import { S, save, spend, addCoins, addXP, count, takeAll, addItem, spaceFor, VISIT, now } from '../game/state';
import { ITEMS, ANIMALS, TREES } from '../game/data';
import { api, ApiError, API, type Friend, type Player, type Listing, type MyListing, type TopRow } from '../online/api';
import { ON, loggedIn, login, register, logout, deleteAccount, visit, goHome, addPending, checkInbox, syncNow } from '../online/online';
import { sfx } from '../audio/sfx';
import { sparkle, popText, flyTo } from '../game/fx';
import type { View } from '../game/world';

export interface PanelApi {
  open(title: string, p: { render: () => string; actions: Record<string, (el: HTMLElement) => void>; live?: boolean; tabs?: { id: string; label: string }[]; tab?: string; onTab?: (t: string) => void }, small?: boolean): void;
  close(): void;
  rerender(): void;
  isOpen(title?: string): boolean;
  tab(): string | undefined;
}
let P: PanelApi;

const fmt = (n: number) => Math.floor(n).toLocaleString('bg-BG');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends HTMLElement = HTMLInputElement>(sel: string) => document.querySelector(sel) as T;
function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 600) return 'на линия';
  if (s < 3600) return `преди ${Math.round(s / 60)} мин`;
  if (s < 86400) return `преди ${Math.round(s / 3600)} ч`;
  return `преди ${Math.round(s / 86400)} д`;
}
const err = (e: unknown) => UI.toast(e instanceof Error ? e.message : 'Нещо се обърка', 'warn');

// ---------------------------------------------------------------- СЪСЕДИ (профил, приятели, класации)
let friends: { rows: Friend[]; fans: Player[] } | null = null;
let suggested: Player[] | null = null;
let search: Player[] | null = null;
let top: { by: string; rows: TopRow[]; me: { rank: number; value: number } } | null = null;
let topBy = 'level';
let loading = false;
let authMode: 'login' | 'register' = 'register';

async function load(what: 'friends' | 'top') {
  if (!loggedIn() || loading) return;
  loading = true;
  try {
    if (what === 'friends') {
      friends = await api.friends();
      suggested = (await api.players()).rows;
    } else top = { by: topBy, ...(await api.top(topBy)) };
  } catch (e) {
    err(e);
    if (what === 'friends') friends ??= { rows: [], fans: [] };
    else top = { by: topBy, rows: [], me: { rank: 0, value: 0 } };
  } finally { loading = false; }
  if (P.isOpen('Съседи')) P.rerender();
}

function authForm() {
  const reg = authMode === 'register';
  return `<div class="auth">
    <div class="panel-desc">${reg ? 'Направи си профил, за да играеш с приятели: гостуване, помощ, класации и пазар. Фермата ти се пази в облака — същата е на телефона и на компютъра.' : 'Влез с името и паролата си.'}</div>
    <div class="tabs mini"><div class="tab ${reg ? 'on' : ''}" data-act="mode" data-m="register">Нов профил</div><div class="tab ${reg ? '' : 'on'}" data-act="mode" data-m="login">Имам профил</div></div>
    <label>Име на играча<input class="name wide" id="au-name" maxlength="16" autocomplete="username" placeholder="напр. Метко" value="${esc(($('#au-name') as HTMLInputElement | null)?.value ?? '')}"></label>
    <label>Парола<input class="name wide" id="au-pass" type="password" maxlength="64" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="поне 6 знака"></label>
    ${reg ? '<label>Паролата още веднъж<input class="name wide" id="au-pass2" type="password" maxlength="64" autocomplete="new-password"></label>' : ''}
    <div class="btns"><button class="btn" data-act="auth">${reg ? '✓ Направи профил' : '→ Влез'}</button></div>
    <div class="small-note">Пазим само името, паролата (защитена) и фермата ти. Без имейл и без телефон. Другите играчи виждат името ти, нивото и фермата. Няма чат.${reg ? ' Запомни паролата — без имейл тя не може да се възстанови.' : ''}</div>
  </div>`;
}

function profileTab() {
  if (!loggedIn()) return authForm();
  const st = { off: '—', ok: '✓ Записано в облака', saving: '⏳ Записва се…', error: '⚠️ Грешка при записа', offline: '📵 Няма интернет — ще се запише по-късно' }[ON.status];
  return `<div class="center"><div style="font-size:22px;font-weight:800">${esc(ON.me!.name)}</div>
      <div class="sub">Ниво ${S.level} · ❤ ${fmt(ON.me!.likes)} харесвания</div>
      <div class="sub mt">${st}${ON.lastSync ? ` · ${ago(ON.lastSync)}` : ''}</div></div>
    <div class="btns"><button class="btn blue sm" data-act="syncnow">☁️ Запиши сега</button><button class="btn sm" data-act="visitme">🏡 Виж как другите виждат фермата ти</button></div>
    <div class="settings mt">
      <div class="row"><b>Смени паролата</b><span class="sp"></span><input class="name" id="pw-old" type="password" placeholder="стара" style="width:110px"><input class="name" id="pw-new" type="password" placeholder="нова" style="width:110px"><button class="btn xs" data-act="pw">✓</button></div>
      <div class="row"><b>Изход</b><span class="sp"></span><button class="btn xs gray" data-act="logout">Излез от профила</button></div>
      <div class="row"><b>Изтрий профила</b><span class="sp"></span><input class="name" id="del-pass" type="password" placeholder="парола" style="width:120px"><button class="btn xs red" data-act="delacc">Изтрий</button></div>
    </div>
    <div class="small-note">Изтриването маха профила, приятелите и записа в облака. Фермата на това устройство остава.</div>`;
}

function personRow(p: Player | Friend, opts: { friend?: boolean; add?: boolean; remove?: boolean }) {
  const f = p as Friend;
  return `<div class="person">
    <div class="av">${esc(p.name.slice(0, 1).toUpperCase())}</div>
    <div class="info"><b>${esc(p.name)}</b> <span class="lv">ниво ${p.level}</span><div class="sub">${esc(p.farm || 'Ферма')} · ${ago(p.seen)}${opts.friend ? ` · помощи днес: ${f.helpsLeft}/5` : ''}</div></div>
    <button class="btn xs blue" data-act="visit" data-n="${esc(p.name)}">🏡 Гости</button>
    ${opts.add ? `<button class="btn xs" data-act="addf" data-n="${esc(p.name)}">＋</button>` : ''}
    ${opts.remove ? `<button class="btn xs gray" data-act="remf" data-id="${p.id}" title="Махни">✕</button>` : ''}
  </div>`;
}

function friendsTab() {
  if (!loggedIn()) return `<div class="empty">Първо си направи профил (раздел „Профил“).</div>`;
  if (!friends) { load('friends'); return '<div class="empty">Зареждане…</div>'; }
  let html = `<div class="row addrow"><input class="name wide" id="fr-name" maxlength="16" placeholder="Име на приятел"><button class="btn sm" data-act="findf">🔍 Търси</button></div>`;
  if (search) html += `<div class="sec">Резултати</div>${search.length ? search.map((p) => personRow(p, { add: !friends!.rows.some((f) => f.id === p.id) })).join('') : '<div class="empty">Няма такъв играч.</div>'}`;
  html += `<div class="sec">Моите приятели (${friends.rows.length})</div>`;
  html += friends.rows.length ? friends.rows.map((p) => personRow(p, { friend: true, remove: true })).join('') : '<div class="empty">Още нямаш приятели. Добави някого по име или от предложените.</div>';
  if (friends.fans.length) html += `<div class="sec">Добавиха те</div>${friends.fans.map((p) => personRow(p, { add: true })).join('')}`;
  if (suggested?.length) html += `<div class="sec">Предложени съседи</div>${suggested.map((p) => personRow(p, { add: true })).join('')}`;
  return html;
}

function topTab() {
  if (!loggedIn()) return `<div class="empty">Първо си направи профил (раздел „Профил“).</div>`;
  const kinds = [['level', '⭐ Ниво'], ['week', '📅 Седмицата'], ['earned', '🪙 Богатство'], ['likes', '❤ Харесвания']];
  let html = `<div class="tabs mini">${kinds.map(([k, l]) => `<div class="tab ${topBy === k ? 'on' : ''}" data-act="topby" data-k="${k}">${l}</div>`).join('')}</div>`;
  if (!top || top.by !== topBy) { load('top'); return html + '<div class="empty">Зареждане…</div>'; }
  const unit = topBy === 'level' ? '' : topBy === 'likes' ? ' ❤' : ' 🪙';
  html += topBy === 'week' ? '<div class="panel-desc">Кой е спечелил най-много монети от понеделник насам.</div>' : '';
  html += `<div class="toplist">${top.rows.map((r) => `<div class="trow ${r.me ? 'me' : ''}" data-act="${r.me ? '' : 'visit'}" data-n="${esc(r.name)}">
      <span class="rk ${r.rank <= 3 ? 'r' + r.rank : ''}">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
      <span class="nm"><b>${esc(r.name)}</b><small>${esc(r.farm || '')}</small></span>
      <span class="val">${topBy === 'level' ? `ниво ${r.value}` : fmt(r.value) + unit}</span></div>`).join('') || '<div class="empty">Още няма никой.</div>'}</div>`;
  html += `<div class="center mt"><b>Твоето място: ${top.me.rank}</b> (${topBy === 'level' ? 'ниво ' + top.me.value : fmt(top.me.value) + unit})</div>`;
  return html;
}

export function openSocial(tab = loggedIn() ? 'friends' : 'me') {
  if (VISIT) return;
  search = null;
  if (tab === 'friends') friends = null;
  P.open('Съседи', {
    tabs: [{ id: 'me', label: '👤 Профил' }, { id: 'friends', label: '👥 Приятели' }, { id: 'top', label: '🏆 Класации' }],
    tab,
    onTab: (t) => { if (t === 'friends') { friends = null; search = null; } if (t === 'top') top = null; },
    render: () => {
      const t = P.tab();
      return t === 'friends' ? friendsTab() : t === 'top' ? topTab() : profileTab();
    },
    actions: {
      mode: (el) => { authMode = el.dataset.m as 'login' | 'register'; },
      auth: async () => {
        const name = $('#au-name').value.trim(), pass = $('#au-pass').value;
        if (authMode === 'register' && pass !== ($('#au-pass2')?.value ?? '')) { UI.toast('Паролите не са еднакви', 'warn'); return; }
        try {
          if (authMode === 'register') await register(name, pass);
          else await login(name, pass);
          sfx('levelup');
          UI.toast(`Здравей, ${ON.me!.name}! 👋`, 'ok');
          friends = null;
          P.rerender();
        } catch (e) { err(e); sfx('error'); }
      },
      syncnow: async () => { await syncNow(); P.rerender(); UI.toast(ON.status === 'ok' ? 'Записано ✓' : 'Не се записа — провери интернета', ON.status === 'ok' ? 'ok' : 'warn'); },
      visitme: () => visit(ON.me!.name),
      logout: async () => { await logout(); UI.toast('Излезе от профила', 'info'); P.rerender(); },
      pw: async () => {
        try { await api.password($('#pw-old').value, $('#pw-new').value); UI.toast('Паролата е сменена ✓', 'ok'); } catch (e) { err(e); }
      },
      delacc: async () => {
        const pass = $('#del-pass').value;
        if (!pass) { UI.toast('Напиши паролата си', 'warn'); return; }
        UI.choose('Изтриване на профила', 'Сигурен ли си? Профилът, приятелите и записът в облака ще изчезнат завинаги.', [
          { label: 'Да, изтрий', cls: 'red', act: async () => { try { await deleteAccount(pass); UI.toast('Профилът е изтрит', 'info'); } catch (e) { err(e); } } },
          { label: 'Не', cls: 'gray', act: () => {} },
        ]);
      },
      findf: async () => {
        const q = $('#fr-name').value.trim();
        if (!q) { search = null; return; }
        try { search = (await api.players(q)).rows; P.rerender(); } catch (e) { err(e); }
      },
      addf: async (el) => {
        try { await api.addFriend(el.dataset.n!); sfx('heart'); UI.toast(`${el.dataset.n} е твой приятел! 💚`, 'ok'); friends = null; P.rerender(); } catch (e) { err(e); }
      },
      remf: async (el) => {
        try { await api.removeFriend(+el.dataset.id!); friends = null; P.rerender(); } catch (e) { err(e); }
      },
      visit: (el) => { if (el.dataset.n) visit(el.dataset.n); },
      topby: (el) => { topBy = el.dataset.k!; top = null; },
    },
  });
}

// ---------------------------------------------------------------- ПАЗАР МЕЖДУ ИГРАЧИТЕ (раздели в Сергията)
let market: Listing[] | null = null;
let mine: { rows: MyListing[]; max: number } | null = null;
let sellSel = '';
let sellQty = 1;
let sellPrice = 0;
const maxPrice = (id: string, q: number) => Math.max(1, Math.round(ITEMS[id].price * q * 3));
const fairPrice = (id: string, q: number) => Math.max(1, Math.round(ITEMS[id].price * q * 1.5));

export function marketTabs() {
  return [{ id: 'buy', label: '🌍 Купи от играчи' }, { id: 'sell', label: '🏷 Моята сергия' }];
}
export function resetMarket() { market = null; mine = null; sellSel = ''; }

async function loadMarket(which: 'buy' | 'sell') {
  if (!loggedIn() || loading) return;
  loading = true;
  try {
    if (which === 'buy') market = (await api.market()).rows;
    else mine = await api.myMarket();
  } catch (e) {
    err(e);
    if (which === 'buy') market ??= [];
    else mine ??= { rows: [], max: 6 };
  } finally { loading = false; }
  P.rerender();
}

export function marketRender(tab: string) {
  if (!loggedIn()) return `<div class="empty">За да купуваш и продаваш на други играчи, направи си профил.<div class="btns"><button class="btn" data-act="social">👤 Профил</button></div></div>`;
  if (tab === 'buy') {
    if (!market) { loadMarket('buy'); return '<div class="empty">Зареждане…</div>'; }
    let html = `<div class="panel-desc">Стоки, които другите играчи продават. Плащаш с монети — те отиват при продавача.</div><div class="btns" style="margin-top:0"><button class="btn xs blue" data-act="mrefresh">↻ Обнови</button></div>`;
    html += market.length ? `<div class="grid">${market.map((l) => {
      const lk = ITEMS[l.item].level > S.level;
      return `<div class="card ${lk ? 'locked' : ''}">${l.friend ? '<div class="own">приятел</div>' : ''}${img(l.item, 'ic')}<div class="nm">${ITEMS[l.item].name} ×${l.qty}</div><div class="sub">от ${esc(l.seller)}</div>
        <button class="btn sm gold" data-act="mbuy" data-id="${l.id}">${img('coin')}${fmt(l.price)}</button></div>`;
    }).join('')}</div>` : '<div class="empty">Пазарът е празен. Бъди пръв — сложи нещо в своята сергия!</div>';
    return html;
  }
  // моята сергия
  if (!mine) { loadMarket('sell'); return '<div class="empty">Зареждане…</div>'; }
  let html = `<div class="panel-desc">Сложи стоки за продан. Другите играчи ги купуват и монетите идват при теб (вземаш ги оттук).</div><div class="stall">`;
  for (const l of mine.rows) {
    html += l.sold
      ? `<div class="slot done" data-act="mcollect" data-id="${l.id}">${img(l.item, '')}<div>Продадено!</div><b>${img('coin', 'ic-sm')}${fmt(l.price)}</b></div>`
      : `<div class="slot busy">${img(l.item, '')}<div>×${l.qty} · ${fmt(l.price)}🪙</div><button class="btn xs gray" data-act="munlist" data-id="${l.id}">✕</button></div>`;
  }
  for (let i = mine.rows.length; i < mine.max; i++) html += `<div class="slot">празно</div>`;
  html += '</div>';
  if (mine.rows.length < mine.max) {
    const items = Object.entries(S.inv).filter(([k, n]) => n > 0 && ITEMS[k] && ITEMS[k].kind !== 'feed').sort((a, b) => ITEMS[a[0]].level - ITEMS[b[0]].level);
    html += `<div class="sec">Какво да продадеш?</div><div class="inv">${items.map(([k, n]) => `<div class="invi ${sellSel === k ? 'sel' : ''}" data-act="msel" data-k="${k}">${img(k, '')}<b class="outl">${n}</b></div>`).join('') || '<div class="empty">Складът е празен.</div>'}</div>`;
    if (sellSel && count(sellSel) > 0) {
      sellQty = Math.max(1, Math.min(sellQty, count(sellSel), 10));
      sellPrice = Math.max(1, Math.min(sellPrice || fairPrice(sellSel, sellQty), maxPrice(sellSel, sellQty)));
      html += `<div class="sellbox">${img(sellSel, 'ic-md')}<b>${ITEMS[sellSel].name}</b>
        <div class="qty"><button data-act="mq" data-d="-1">−</button><span>${sellQty}</span><button data-act="mq" data-d="1">+</button></div>
        <div class="qty">цена <button data-act="mp" data-d="-1">−</button><span>${fmt(sellPrice)}</span><button data-act="mp" data-d="1">+</button></div>
        <button class="btn gold" data-act="mlist">🏷 Сложи в сергията</button>
        <div class="small-note" style="width:100%">Цена на пазара в селото: ${fmt(ITEMS[sellSel].price * sellQty)} · най-много ${fmt(maxPrice(sellSel, sellQty))}</div></div>`;
    }
  }
  return html;
}

export const marketActions: Record<string, (el: HTMLElement) => void> = {
  social: () => openSocial('me'),
  mrefresh: () => { market = null; },
  mbuy: async (el) => {
    const id = +el.dataset.id!;
    const l = market?.find((x) => x.id === id);
    if (!l) return;
    if (ITEMS[l.item].level > S.level) { UI.toast(`${ITEMS[l.item].name} се отключва на ниво ${ITEMS[l.item].level}`, 'info'); return; }
    if (S.coins < l.price) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return; }
    if (spaceFor(l.item) < l.qty) { UI.toast('Нямаш място в склада', 'warn'); sfx('error'); return; }
    try {
      const r = await api.buy(id);
      if (!spend(r.price) || addItem(r.item, r.qty) < r.qty) { await api.undoBuy(id).catch(() => {}); UI.toast('Не стана — провери монетите и склада', 'warn'); return; }
      flyTo(r.item, { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-barn', Math.min(5, r.qty));
      sfx('coin');
      UI.toast(`Купи ${ITEMS[r.item].name} ×${r.qty} от ${l.seller}!`, 'ok');
      market = market!.filter((x) => x.id !== id);
      save();
    } catch (e) { err(e); market = null; }
    P.rerender();
  },
  msel: (el) => { sellSel = el.dataset.k!; sellQty = 1; sellPrice = 0; sfx('tap'); },
  mq: (el) => { sellQty = Math.max(1, Math.min(10, count(sellSel), sellQty + +el.dataset.d!)); sellPrice = fairPrice(sellSel, sellQty); },
  mp: (el) => {
    const step = Math.max(1, Math.round(ITEMS[sellSel].price * sellQty * 0.1));
    sellPrice = Math.max(1, Math.min(maxPrice(sellSel, sellQty), sellPrice + step * +el.dataset.d!));
  },
  mlist: async () => {
    const item = sellSel, qty = sellQty, price = sellPrice;
    if (!item || count(item) < qty) return;
    if (!takeAll({ [item]: qty })) return;
    try {
      await api.list(item, qty, price);
      sfx('pop');
      UI.toast(`${ITEMS[item].name} ×${qty} е в сергията ти`, 'ok');
      sellSel = '';
      mine = null;
      save();
    } catch (e) { addItem(item, qty, true); err(e); }
    P.rerender();
  },
  munlist: async (el) => {
    try {
      const r = await api.unlist(+el.dataset.id!);
      addItem(r.item, r.qty, true);
      UI.toast(`${ITEMS[r.item].name} ×${r.qty} се върна в склада`, 'info');
      mine = null;
      save();
    } catch (e) { err(e); mine = null; }
    P.rerender();
  },
  mcollect: async (el) => {
    try {
      const r = await api.collect(+el.dataset.id!);
      addCoins(r.price);
      S.stats.traded = (S.stats.traded ?? 0) + 1;
      addXP(Math.max(1, Math.round(r.price / 40)));
      flyTo('coin', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-coins', 5);
      sfx('coin');
      mine = null;
      ON.sold = ON.sold.filter((x) => x.id !== +el.dataset.id!);
      save();
    } catch (e) { err(e); mine = null; }
    P.rerender();
  },
};

// ---------------------------------------------------------------- НА ГОСТИ
let host: { player: Player; helpsLeft: number; likedToday: boolean; friend: boolean } | null = null;
const helped = new Set<number>();

export function visitHUD(info: NonNullable<typeof host>) {
  host = info;
  const ui = document.getElementById('ui')!;
  ui.classList.add('visiting');
  const bar = document.createElement('div');
  bar.id = 'visitbar';
  ui.appendChild(bar);
  const draw = () => {
    bar.innerHTML = `<div class="vtitle outl">🏡 Фермата на <b>${esc(host!.player.name)}</b> · ниво ${host!.player.level}</div>
      <div class="vhint">${host!.helpsLeft > 0 ? `Натисни растяща нива, гладни животни или дърво, за да помогнеш (още ${host!.helpsLeft} днес)` : 'Днес помогна достатъчно тук. Благодарим! 💚'}</div>
      <div class="vbtns">
        <button class="btn red" data-act="vhome">🏠 Вкъщи</button>
        <button class="btn ${host!.likedToday ? 'gray' : 'gold'}" data-act="vlike">❤ ${host!.likedToday ? 'Харесано' : 'Харесай'} (${fmt(host!.player.likes)})</button>
        ${host!.friend || !loggedIn() || ON.me?.name === host!.player.name ? '' : '<button class="btn blue" data-act="vadd">＋ Приятел</button>'}
      </div>`;
  };
  draw();
  bar.addEventListener('click', async (ev) => {
    const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a) return;
    sfx('tap');
    if (a.dataset.act === 'vhome') goHome();
    if (a.dataset.act === 'vlike' && !host!.likedToday) {
      try { const r = await api.like(host!.player.name); host!.likedToday = true; host!.player.likes = r.likes; sfx('heart'); popText('❤', { x: innerWidth / 2, y: innerHeight / 2 }, '#ff6b8a', true); } catch (e) { err(e); }
    }
    if (a.dataset.act === 'vadd') {
      try { await api.addFriend(host!.player.name); host!.friend = true; sfx('heart'); UI.toast(`${host!.player.name} е твой приятел! 💚`, 'ok'); } catch (e) { err(e); }
    }
    draw();
  });
  (visitHUD as unknown as { draw: () => void }).draw = draw;
}

/** Натискане на обект в чужда ферма — помощ. */
export async function visitTap(v: View) {
  if (!host) return;
  const t = now();
  let kind: 'field' | 'animal' | 'tree' | null = null;
  let label = '';
  if (v.def.kind === 'field' && v.e.crop && (v.e.ready ?? 0) > t) { kind = 'field'; label = '💧 Полято!'; }
  else if (v.def.kind === 'animal' && ANIMALS[v.def.animal!]?.feed && (v.e.animals ?? []).some((s) => s.fed == null)) { kind = 'animal'; label = '🌾 Нахранени!'; }
  else if (TREES[v.e.type] && (v.e.ready ?? 0) > t) { kind = 'tree'; label = '💧 Полято!'; }
  if (!kind) { UI.toast(`${v.def.name} — тук сега няма нужда от помощ`, 'info'); return; }
  if (!loggedIn()) { UI.toast('Влез в профила си, за да помагаш', 'info'); return; }
  if (helped.has(v.e.uid)) { UI.toast('Вече помогна тук днес', 'info'); return; }
  if (host.helpsLeft <= 0) { UI.toast(`Днес вече помогна 5 пъти на ${host.player.name}`, 'info'); return; }
  try {
    const r = await api.help(host.player.name, v.e.uid, kind);
    host.helpsLeft = r.helpsLeft;
    helped.add(v.e.uid);
    // показваме ефекта веднага (истинската ферма се обновява, когато домакинът влезе)
    if (kind === 'field') { v.e.ready = t; v.setVisual?.(); }
    if (kind === 'tree') v.e.ready = t;
    if (kind === 'animal') for (const s of v.e.animals ?? []) if (s.fed == null) { s.fed = t; s.ready = t + ANIMALS[v.def.animal!].time * 1000; }
    sparkle(v.root.position.clone().setY(1.5), 20);
    popText(label, v.root.position.clone().setY(2.5), '#bff7ff', true);
    sfx(kind === 'animal' ? 'pop' : 'splash');
    addPending({ coins: 10 + Math.round(S.level * 0.5), xp: 3, helps: 1 });
    (visitHUD as unknown as { draw: () => void }).draw?.();
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) host.helpsLeft = 0;
    err(e);
    (visitHUD as unknown as { draw: () => void }).draw?.();
  }
}

// ---------------------------------------------------------------- общ прозорец с избор
export function choose(title: string, text: string, options: { label: string; cls?: string; act: () => void }[]) {
  P.open(title, {
    render: () => `<div class="panel-desc" style="font-size:15px">${esc(text)}</div><div class="btns col">${options.map((o, i) => `<button class="btn ${o.cls ?? ''}" data-act="ch" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`,
    actions: { ch: (el) => { P.close(); options[+el.dataset.i!].act(); } },
  }, true);
}

export function initSocial(p: PanelApi) {
  P = p;
  ON.onChange = () => {
    const b = document.getElementById('badge-social');
    if (b) b.textContent = ON.sold.length ? String(ON.sold.length) : '';
    if (P.isOpen('Съседи') && P.tab() === 'me') P.rerender();
  };
  void checkInbox;
  void API;
}
