import { UI } from './api';
import { icon, img } from './icons';
import { S, on, save, spend, spendDiamonds, addCoins, addDiamonds, addXP, count, used, cap, isSiloItem, takeAll, now, skipCost, resetSave, emit, achValue, achReady } from '../game/state';
import { ITEMS, CROPS, BUILDINGS, CARS, HOME_TIERS, VILLAGE_HOUSES, LANDS, ANIMALS, TREES, MAX_ANIMALS, ACHIEVEMENTS, xpForLevel, unlocksAt, type BuildingDef } from '../game/data';
import { refillOrders, canDeliver, deliver, trash, carBonus, makeable } from '../game/orders';
import { rentDue, RENT_CAP_H } from '../game/village';
import { sfx, startMusic, stopMusic } from '../audio/sfx';
import { sparkle, flyTo, toScreen } from '../game/fx';
import type { Farm, View } from '../game/world';
import { centerOf } from '../game/world';
import type { Village } from '../game/village';
import type { Vehicles } from '../game/vehicles';
import type { People } from '../game/npc';
import type { Engine } from '../engine/engine';
import { loadModel } from '../engine/assets';
import * as THREE from 'three';

interface Ctx { farm: Farm; village: Village; vehicles: Vehicles; people: People; engine: Engine }
let C: Ctx;
let DN: { mode: 'real' | 'day'; setMode(m: 'real' | 'day'): void } | null = null;
export function bindDayNight(d: typeof DN) {
  DN = d;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const fmt = (n: number) => Math.floor(n).toLocaleString('bg-BG');

export function fmtTime(sec: number) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec} сек`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s && m < 10 ? `${m} мин ${s} сек` : `${m} мин`;
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return mm ? `${h} ч ${mm} мин` : `${h} ч`;
  const d = Math.floor(h / 24);
  return `${d} д ${h % 24} ч`;
}
const coinsHtml = (n: number) => `<span class="price">${img('coin', 'ic-sm')}${fmt(n)}</span>`;
const diaHtml = (n: number) => `<span class="price">${img('diamond', 'ic-sm')}${fmt(n)}</span>`;

// =====================================================================
// HUD
function buildHUD() {
  const ui = $('#ui');
  ui.innerHTML = `
  <div id="hud-top">
    <div class="lvl" data-open="profile">
      <div class="lvl-star">${img('star')}<b class="outl" id="hud-level">1</b><div class="badge" id="badge-ach" style="position:absolute;top:-4px;right:-6px;min-width:22px;height:22px;border-radius:11px;background:#e5533d;border:2px solid #fff;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center"></div></div>
      <div class="xpbar" id="hud-xp"><i id="hud-xpfill"></i><span class="outl" id="hud-xptext">0/10</span></div>
      <div class="farmname outl" id="hud-name"></div>
    </div>
    <div class="money">
      <div class="pill outl" id="hud-coins" data-open="coins">${img('coin')}<span id="hud-coin-n">0</span></div>
      <div class="pill outl" id="hud-diamonds" data-open="diamonds">${img('diamond')}<span id="hud-dia-n">0</span></div>
      <div class="pill outl" data-open="settings" style="padding:0 8px">⚙️</div>
    </div>
  </div>
  <div id="hud-bottom">
    <div>
      <div class="rbtn" id="hud-barn" data-open="storage">${img('b:barn')}<span class="outl">Склад</span><i id="hud-silo" style="position:absolute;inset:0"></i></div>
      <div class="rbtn" id="btn-orders" data-open="orders">${img('b:board')}<span class="outl">Поръчки</span><div class="badge" id="badge-orders"></div></div>
      <div class="rbtn" id="btn-home" data-open="home">${img('m:house_red1')}<span class="outl">Имоти</span><div class="badge" id="badge-home"></div></div>
      <div class="rbtn" id="btn-garage" data-open="garage">${img('car:pickup')}<span class="outl">Коли</span></div>
    </div>
    <div>
      <div class="rbtn" id="btn-travel" data-open="travel">${img('m:townhouse1')}<span class="outl">Град</span></div>
      <div class="rbtn big" id="btn-shop" data-open="shop">${img('b:market')}<span class="outl">Магазин</span></div>
    </div>
  </div>
  <div id="seeds"><div class="bar"></div></div>
  <div id="sowhint"><span id="sowhint-t"></span><button class="btn sm" data-act="sowdone">Готово</button></div>
  <div id="tip"></div>
  <div id="placebar"><button class="btn red" data-act="pcancel">✕</button><button class="btn blue" data-act="prot">⟳</button><button class="btn" data-act="pok" id="pok">✓</button></div>
  <div id="toasts"></div>
  <div id="guide"></div>
  <div id="drivebar">
    <div id="joy"><i></i></div>
    <div id="speedo" class="outl">0 км/ч</div>
    <div id="drive-btns">
      <button class="btn gold" data-act="honk">📯 Клаксон</button>
      <button class="btn red" data-act="exitdrive">Слез от колата</button>
    </div>
    <div class="keys-hint">Карай със стрелките или W A S D</div>
  </div>
  <div id="panel-wrap"><div class="panel" id="panel"><div class="panel-x" data-act="close">✕</div><div class="panel-title outl" id="panel-title"></div><div class="tabs" id="panel-tabs"></div><div class="panel-body" id="panel-body"></div></div></div>
  `;
  ui.addEventListener('click', onClick);
  $('#panel-wrap').addEventListener('pointerdown', (e) => { if (e.target === $('#panel-wrap')) close(); });
  setupJoystick();
}

function refreshHUD() {
  $('#hud-level').textContent = String(S.level);
  const need = xpForLevel(S.level);
  $('#hud-xpfill').style.width = `${Math.min(100, (S.xp / need) * 100)}%`;
  $('#hud-xptext').textContent = `${fmt(S.xp)} / ${fmt(need)}`;
  $('#hud-coin-n').textContent = fmt(S.coins);
  $('#hud-dia-n').textContent = fmt(S.diamonds);
  $('#hud-name').textContent = S.name;
  const ready = S.orders.filter((o) => canDeliver(o)).length;
  $('#badge-orders').textContent = ready ? String(ready) : '';
  const rent = Object.keys(S.village).reduce((a, k) => a + rentDue(+k), 0);
  const daily = new Date(S.lastDaily).toDateString() !== new Date().toDateString();
  $('#badge-home').textContent = daily ? '!' : rent > 0 ? '🪙' : '';
  $('#btn-garage').style.display = C.farm.byType('garage').length ? '' : 'none';
  const ach = achReady();
  const ab = $('#badge-ach');
  ab.textContent = ach ? String(ach) : '';
  ab.style.display = ach ? 'flex' : 'none';
}

// =====================================================================
// ПРОЗОРЦИ
let current: null | { render: () => string; actions: Record<string, (el: HTMLElement) => void>; live?: boolean; tabs?: { id: string; label: string }[]; tab?: string; onTab?: (t: string) => void } = null;

function open(title: string, p: NonNullable<typeof current>, small = false) {
  closeTip();
  current = p;
  $('#panel-title').textContent = title;
  $('#panel').classList.toggle('small', small);
  renderTabs();
  rerender(true);
  $('#panel-wrap').classList.add('show');
  document.body.classList.add('panel-open');
  sfx('open');
}

function renderTabs() {
  const t = $('#panel-tabs');
  if (!current?.tabs) { t.innerHTML = ''; t.style.display = 'none'; return; }
  t.style.display = '';
  t.innerHTML = current.tabs.map((x) => `<div class="tab ${x.id === current!.tab ? 'on' : ''}" data-tab="${x.id}">${x.label}</div>`).join('');
}

function rerender(reset = false) {
  if (!current) return;
  const body = $('#panel-body');
  const st = body.scrollTop;
  body.innerHTML = current.render();
  body.scrollTop = reset ? 0 : st;
}

function close() {
  if (!current) return;
  current = null;
  $('#panel-wrap').classList.remove('show');
  document.body.classList.remove('panel-open');
  sfx('close');
}

function onClick(ev: MouseEvent) {
  const t = ev.target as HTMLElement;
  const tab = t.closest('[data-tab]') as HTMLElement | null;
  if (tab && current?.tabs) {
    current.tab = tab.dataset.tab;
    current.onTab?.(current.tab!);
    renderTabs();
    rerender(true);
    sfx('tap');
    return;
  }
  const opener = t.closest('[data-open]') as HTMLElement | null;
  if (opener) {
    sfx('tap');
    const what = opener.dataset.open!;
    ({ storage: () => UI.openStorage(true), orders: () => UI.openOrders(), home: () => UI.openHome(), garage: () => UI.openGarage(), travel: () => travel(), shop: () => openShop(), settings: () => openSettings(), profile: () => openProfile(), coins: () => openProfile(), diamonds: () => openProfile() } as Record<string, () => void>)[what]?.();
    return;
  }
  const act = t.closest('[data-act]') as HTMLElement | null;
  if (!act) return;
  const a = act.dataset.act!;
  if ((act as HTMLButtonElement).disabled) return;
  // общи действия
  switch (a) {
    case 'close': close(); return;
    case 'sowdone': C.farm.tool = null; UI.sowMode(null); return;
    case 'pok': C.farm.confirmPlace(); return;
    case 'pcancel': C.farm.cancelPlace(); return;
    case 'prot': C.farm.rotateGhost(); sfx('tap'); return;
    case 'honk': C.vehicles.honk(); return;
    case 'exitdrive': C.vehicles.stopDrive(); return;
  }
  if (a.startsWith('seed:')) { chooseSeed(a.slice(5)); return; }
  if (a.startsWith('tip:')) { tipAction?.(a.slice(4)); return; }
  current?.actions[a]?.(act);
  if (current) rerender();
}

/** Камерата прелита между фермата и града. */
function inCity() {
  return C.farm.rig.goal.x > 190;
}
function travel() {
  sfx('tap');
  const portrait = innerWidth < innerHeight;
  if (inCity()) C.farm.rig.flyTo(0, -1, portrait ? 50 : 38);
  else C.farm.rig.flyTo(330, 22, portrait ? 110 : 90);
  setTimeout(travelLabel, 50);
}
function travelLabel() {
  const b = document.getElementById('btn-travel');
  if (!b) return;
  const city = inCity();
  if (b.dataset.city === String(city)) return;
  b.dataset.city = String(city);
  b.innerHTML = city ? `${img('b:barn')}<span class="outl">Ферма</span>` : `${img('m:townhouse1')}<span class="outl">Град</span>`;
}

// =====================================================================
// СЕМЕНА
let seedField: View | null = null;
function openSeeds(f: View) {
  seedField = f;
  close();
  closeTip();
  const crops = Object.values(CROPS).sort((a, b) => a.level - b.level);
  const sel = C.farm.tool?.kind === 'sow' ? C.farm.tool.crop : '';
  $('#seeds .bar').innerHTML = crops.map((c) => {
    const lk = c.level > S.level;
    return `<div class="seed ${lk ? 'locked' : ''} ${sel === c.id ? 'on' : ''}" data-act="seed:${c.id}">
      ${lk ? `<div class="lk">Ниво ${c.level}</div>` : ''}
      ${img(c.id, '')}<div class="n">${ITEMS[c.id].name}</div>
      <div class="s">⏱ ${fmtTime(c.time * (S.cars.includes('tractor') ? 0.9 : 1))} · 🪙${c.seed}</div></div>`;
  }).join('');
  $('#seeds').classList.add('show');
  guideStep('seeds');
}
function chooseSeed(id: string) {
  const c = CROPS[id];
  if (c.level > S.level) { UI.toast(`${ITEMS[id].name} се отключва на ниво ${c.level}`, 'info'); sfx('error'); return; }
  C.farm.tool = { kind: 'sow', crop: id };
  if (seedField?.isEmpty?.()) seedField.plant!(id);
  seedField = null;
  $('#seeds').classList.remove('show');
  UI.sowMode(id);
  guideStep('planted');
}

// =====================================================================
// МАЛКО ПРОЗОРЧЕ НАД НИВА / ДЪРВО
let tipTimer = 0;
let tipAction: ((a: string) => void) | null = null;
function closeTip() {
  $('#tip')?.classList.remove('show');
  clearInterval(tipTimer);
  tipAction = null;
}
function fieldInfo(v: View) {
  closeTip();
  const tip = $('#tip');
  const draw = () => {
    if (!v.e.crop) { closeTip(); return; }
    const left = ((v.e.ready ?? 0) - now()) / 1000;
    if (left <= 0) { closeTip(); return; }
    const s = toScreen(v.root.position.clone().setY(1.5));
    tip.style.left = s.x + 'px';
    tip.style.top = s.y + 'px';
    const cost = skipCost(left);
    tip.innerHTML = `${img(v.e.crop, '')}<div><div>${ITEMS[v.e.crop].name}</div><div style="font-size:13px;color:#8a6440">⏱ ${fmtTime(left)}</div></div><button class="btn xs blue" data-act="tip:skip">${img('diamond', 'ic-sm')}${cost}</button>`;
  };
  tipAction = (a) => {
    if (a === 'skip') {
      const left = ((v.e.ready ?? 0) - now()) / 1000;
      if (spendDiamonds(skipCost(left))) { v.e.ready = now(); save(); closeTip(); sfx('pop'); }
      else { UI.toast('Нямаш достатъчно диаманти', 'warn'); sfx('error'); }
    }
  };
  draw();
  tip.classList.add('show');
  tipTimer = window.setInterval(draw, 250);
  setTimeout(() => { if (tipAction) closeTip(); }, 4000);
}

// =====================================================================
// РАБОТИЛНИЦА
function openProduction(v: View) {
  const def = v.def;
  open(def.name, {
    live: true,
    render: () => {
      const q = v.e.queue!, d = v.e.done!;
      const slots = def.slots ?? 2;
      let html = `<div class="panel-desc">${def.desc}</div><div class="queue">`;
      for (const it of d) html += `<div class="slot done" data-act="collect">${img(it.out, '')}<div>Готово!</div></div>`;
      q.forEach((it, i) => {
        const t = now();
        const p = i === 0 ? Math.min(1, (t - it.start) / (it.end - it.start)) : 0;
        const left = (it.end - t) / 1000;
        html += `<div class="slot busy"><div class="t">${i === 0 ? fmtTime(left) : 'чака'}</div>${img(it.out, '')}<div class="bar"><i style="width:${p * 100}%"></i></div>
          ${i === 0 ? `<button class="btn xs blue skip" data-act="skip">${img('diamond', 'ic-sm')}${skipCost(left)}</button>` : ''}</div>`;
      });
      for (let i = q.length; i < slots; i++) html += `<div class="slot">празно</div>`;
      html += `</div><div class="recipes">`;
      def.recipes!.forEach((r, i) => {
        const it = ITEMS[r.out];
        const lk = it.level > S.level;
        const ok = Object.entries(r.needs).every(([k, n]) => count(k) >= n);
        html += `<div class="recipe ${lk ? 'locked' : ''}">${img(r.out, '')}<div class="info">
          <div class="nm">${it.name}${r.qty > 1 ? ` ×${r.qty}` : ''}</div>
          <div class="needs">${Object.entries(r.needs).map(([k, n]) => `<span class="need ${count(k) < n ? 'miss' : ''}" title="${ITEMS[k].name}">${img(k, '')}${count(k)}/${n}</span>`).join('')}</div>
          <div class="tm">⏱ ${fmtTime(r.time)} · ⭐ ${it.xp * r.qty}</div></div>
          ${lk ? `<b style="font-size:12px">Ниво ${it.level}</b>` : `<button class="btn sm ${ok && q.length < slots ? '' : 'gray'}" data-act="make" data-i="${i}">Направи</button>`}</div>`;
      });
      html += `</div><div class="btns"><button class="btn sm blue" data-act="move">✥ Премести</button></div>`;
      return html;
    },
    actions: {
      make: (el) => {
        const r = def.recipes![+el.dataset.i!];
        if (v.e.queue!.length >= (def.slots ?? 2)) { UI.toast('Опашката е пълна', 'warn'); return; }
        const miss = Object.entries(r.needs).filter(([k, n]) => count(k) < n).map(([k]) => ITEMS[k].name);
        if (miss.length) { UI.toast('Липсва: ' + miss.join(', '), 'warn'); sfx('error'); return; }
        v.start!(r);
        guideStep('made');
      },
      collect: () => v.collect!(),
      skip: () => {
        const it = v.e.queue![0];
        if (!it) return;
        const left = (it.end - now()) / 1000;
        if (!spendDiamonds(skipCost(left))) { UI.toast('Нямаш достатъчно диаманти', 'warn'); sfx('error'); return; }
        const dt = it.end - now();
        for (const x of v.e.queue!) { x.end -= dt; x.start -= dt; }
        save();
        sfx('pop');
      },
      move: () => { close(); C.farm.beginPlace(v.e.type, undefined, v); },
    },
  });
}

// =====================================================================
// СКЛАД
function openStorage(silo: boolean) {
  let sel = '';
  let qty = 1;
  open('Склад', {
    tabs: [{ id: 'silo', label: '🌾 Силоз (реколта)' }, { id: 'barn', label: '🏠 Хамбар (продукти)' }],
    tab: silo ? 'silo' : 'barn',
    onTab: () => { sel = ''; qty = 1; },
    render: () => {
      const isSilo = current!.tab === 'silo';
      const u = used(isSilo), c = cap(isSilo);
      const items = Object.entries(S.inv).filter(([k, n]) => n > 0 && isSiloItem(k) === isSilo).sort((a, b) => ITEMS[a[0]].level - ITEMS[b[0]].level);
      let html = `<div class="capbar ${u >= c ? 'full' : ''}"><i style="width:${Math.min(100, (u / c) * 100)}%"></i><span class="outl">${u} / ${c}</span></div>`;
      if (!items.length) html += `<div class="empty">Празно е. ${isSilo ? 'Ожъни нивите!' : 'Събери продукти от животните и работилниците.'}</div>`;
      html += `<div class="inv">${items.map(([k, n]) => `<div class="invi ${sel === k ? 'sel' : ''}" data-act="sel" data-k="${k}" title="${ITEMS[k].name}">${img(k, '')}<b class="outl">${n}</b></div>`).join('')}</div>`;
      if (sel && count(sel) > 0) {
        qty = Math.min(qty, count(sel));
        const it = ITEMS[sel];
        html += `<div class="sellbox">${img(sel, 'ic-md')}<b>${it.name}</b>
          <div class="qty"><button data-act="qm">−</button><span>${qty}</span><button data-act="qp">+</button><button data-act="qa" style="width:auto;padding:0 10px;border-radius:12px;font-size:14px">всички</button></div>
          <button class="btn gold" data-act="sell">Продай за ${img('coin')}${fmt(it.price * qty)}</button></div>`;
      }
      const up = upgradeCost(isSilo);
      html += `<div class="btns"><button class="btn blue" data-act="upgrade">Увеличи с 25 за ${img('coin')}${fmt(up)}</button></div>`;
      return html;
    },
    actions: {
      sel: (el) => { sel = el.dataset.k!; qty = 1; sfx('tap'); },
      qm: () => { qty = Math.max(1, qty - 1); },
      qp: () => { qty = Math.min(count(sel), qty + 1); },
      qa: () => { qty = count(sel); },
      sell: () => {
        const it = ITEMS[sel];
        if (!takeAll({ [sel]: qty })) return;
        addCoins(it.price * qty);
        flyTo('coin', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-coins', Math.min(6, qty));
        sfx('coin');
        if (count(sel) <= 0) sel = '';
        qty = 1;
      },
      upgrade: () => {
        const isSilo = current!.tab === 'silo';
        const up = upgradeCost(isSilo);
        if (!spend(up)) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return; }
        if (isSilo) S.siloCap += 25; else S.barnCap += 25;
        addXP(Math.round(up / 40));
        save();
        sfx('build');
        UI.toast(isSilo ? 'Силозът е по-голям!' : 'Хамбарът е по-голям!', 'ok');
      },
    },
  });
}
function upgradeCost(silo: boolean) {
  const n = ((silo ? S.siloCap : S.barnCap) - 50) / 25;
  return Math.round(150 * Math.pow(1.55, n));
}

// =====================================================================
// ПОРЪЧКИ
function openOrders() {
  refillOrders();
  open('Поръчки от селото', {
    live: true,
    render: () => {
      const b = carBonus();
      let html = `<div class="panel-desc">Изпълни поръчка — пикапът ще я откара. ${b.pct ? `Колите ти дават +${b.pct}% монети.` : 'Купи кола за бонус монети!'}</div><div class="orders">`;
      S.orders.forEach((o, i) => {
        if (o.wait) {
          html += `<div class="order wait">Нова поръчка след<br>⏱ ${fmtTime((o.wait - now()) / 1000)}</div>`;
          return;
        }
        const ok = canDeliver(o);
        html += `<div class="order ${ok ? 'ok' : ''}"><div class="who">${o.who}</div>
          <div class="its">${Object.entries(o.items).map(([k, n]) => `<span class="need ${count(k) < n ? 'miss' : ''}" title="${ITEMS[k].name}">${img(k, '')}${count(k)}/${n}</span>`).join('')}</div>
          <div class="rew">${coinsHtml(Math.round(o.coins * (1 + b.pct / 100)) + b.flat)} <span class="price">${img('star', 'ic-sm')}${o.xp + b.xp}</span></div>
          <div class="row"><button class="btn sm ${ok ? '' : 'gray'}" data-act="send" data-i="${i}">🚚 Изпрати</button><span class="sp"></span><button class="btn xs red" data-act="trash" data-i="${i}" title="Махни">🗑</button></div></div>`;
      });
      return html + '</div>';
    },
    actions: {
      send: (el) => {
        const o = S.orders[+el.dataset.i!];
        if (!canDeliver(o)) {
          const miss = Object.entries(o.items).filter(([k, n]) => count(k) < n).map(([k, n]) => `${ITEMS[k].name} (${n - count(k)})`);
          UI.toast('Липсва: ' + miss.join(', '), 'warn');
          sfx('error');
          return;
        }
        const r = deliver(o);
        if (!r) return;
        flyTo('coin', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-coins', 6);
        flyTo('star', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-xp', 2, 200);
        C.vehicles.deliverAnim();
        sfx('coin');
        UI.toast(`+${fmt(r.coins)} монети, +${r.xp} опит`, 'ok');
        guideStep('order');
      },
      trash: (el) => { trash(S.orders[+el.dataset.i!]); sfx('close'); },
    },
  });
}

// =====================================================================
// МАГАЗИН
function fieldPrice() {
  const n = C.farm.byType('field').length;
  return n < 6 ? 0 : Math.round(8 + Math.pow(n - 5, 1.6) * 6);
}
function maxFields() {
  return 6 + S.level * 2;
}
function openShop() {
  close();
  const tabs = [
    { id: 'build', label: '🏭 Сгради' },
    { id: 'animal', label: '🐄 Животни' },
    { id: 'field', label: '🌾 Ниви и дървета' },
    { id: 'deco', label: '🌸 Украса' },
  ];
  open('Магазин', {
    tabs,
    tab: 'build',
    render: () => {
      const tab = current!.tab;
      let list: BuildingDef[] = [];
      if (tab === 'build') list = Object.values(BUILDINGS).filter((b) => (b.kind === 'production' || b.kind === 'special') && b.price > 0);
      if (tab === 'animal') list = Object.values(BUILDINGS).filter((b) => b.kind === 'animal' || b.kind === 'pet');
      if (tab === 'field') list = Object.values(BUILDINGS).filter((b) => b.kind === 'field' || b.kind === 'tree');
      if (tab === 'deco') list = Object.values(BUILDINGS).filter((b) => b.kind === 'deco');
      list.sort((a, b) => a.level - b.level);
      return `<div class="grid">${list.map((b) => {
        const lk = b.level > S.level;
        const owned = C.farm.byType(b.id).length;
        const price = b.kind === 'field' ? fieldPrice() : b.price;
        const soldOut = (b.unique && owned > 0) || (b.kind === 'field' && owned >= maxFields());
        const ic = b.kind === 'field' ? img('wheat', 'ic') : b.kind === 'animal' ? img('animal:' + b.animal, 'ic') : b.kind === 'pet' ? img('m:' + b.model, 'ic') : img('b:' + b.id, 'ic');
        return `<div class="card ${lk || soldOut ? 'locked' : ''}" data-act="buy" data-id="${b.id}">
          ${lk ? `<div class="lock">Ниво ${b.level}</div>` : ''}${owned ? `<div class="own">${b.kind === 'field' ? `${owned}/${maxFields()}` : owned}</div>` : ''}
          ${ic}<div class="nm">${b.name}</div>
          ${soldOut ? `<div class="sub">${b.kind === 'field' ? 'Нужно е по-високо ниво' : 'Вече имаш'}</div>` : `<div class="price">${price ? `${img('coin')}${fmt(price)}` : 'Безплатно'}</div>`}</div>`;
      }).join('')}</div>`;
    },
    actions: {
      buy: (el) => {
        const b = BUILDINGS[el.dataset.id!];
        if (b.level > S.level) { UI.toast(`Отключва се на ниво ${b.level}`, 'info'); sfx('error'); return; }
        const owned = C.farm.byType(b.id).length;
        if (b.unique && owned) { UI.toast('Вече го имаш', 'info'); return; }
        if (b.kind === 'field' && owned >= maxFields()) { UI.toast(`Повече ниви — на ниво ${Math.ceil((owned - 5) / 2)}`, 'info'); return; }
        const price = b.kind === 'field' ? fieldPrice() : b.price;
        if (S.coins < price) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return; }
        close();
        UI.toast('Плъзни, за да го наместиш, и натисни ✓', 'info');
        C.farm.beginPlace(b.id, (ok) => {
          if (!ok) return;
          spend(price);
          addXP(Math.max(1, Math.round(price / 25)));
          if (b.id === 'garage') C.vehicles.refresh();
          refreshHUD();
          guideStep('bought:' + b.id);
        });
      },
    },
  });
}

// =====================================================================
// ЖИВОТНИ
function openAnimals(v: View) {
  const a = ANIMALS[v.def.animal!];
  open(v.def.name, {
    live: true,
    render: () => {
      const list = v.e.animals!;
      const max = MAX_ANIMALS[v.def.animal!] ?? 6;
      let html = `<div class="panel-desc">${v.def.desc}</div><div class="grid">`;
      list.forEach((s, i) => {
        const ready = s.ready != null && now() >= s.ready;
        const status = ready ? 'Готово! Натисни за събиране' : s.fed != null ? `⏱ ${fmtTime(((s.ready ?? 0) - now()) / 1000)}` : a.feed ? 'Гладно — нахрани' : '';
        html += `<div class="card">${img(ready ? a.product : 'animal:' + v.def.animal, 'ic')}<div class="nm">${a.name} ${i + 1}</div><div class="sub">${status}</div></div>`;
      });
      if (list.length < max) html += `<div class="card" data-act="buyan">${img('animal:' + v.def.animal, 'ic')}<div class="nm">Купи ${a.name.toLowerCase()}</div><div class="price">${img('coin')}${fmt(a.price)}</div></div>`;
      html += '</div><div class="btns">';
      if (a.feed) html += `<button class="btn" data-act="feed">${img(a.feed)} Нахрани (${count(a.feed)})</button>`;
      html += `<button class="btn gold" data-act="collect">${img(a.product)} Събери</button><button class="btn sm blue" data-act="move">✥ Премести</button></div>`;
      if (a.feed && count(a.feed) === 0) html += `<div class="panel-desc mt">Храната се прави във Фуражната мелница.</div>`;
      return html;
    },
    actions: {
      buyan: () => v.buyAnimal!(),
      feed: () => { if (!v.feedAll!()) UI.toast(count(a.feed!) ? 'Всички са нахранени' : 'Нямаш храна — направи във Фуражната мелница', 'info'); },
      collect: () => { if (!v.collect!()) UI.toast('Още няма нищо за събиране', 'info'); },
      move: () => { close(); C.farm.beginPlace(v.e.type, undefined, v); },
    },
  });
}

// =====================================================================
// ДЪРВО / УКРАСА
function openTree(v: View) {
  const t = TREES[v.e.type];
  open(v.def.name, {
    live: true,
    small: true,
    render: () => {
      const left = ((v.e.ready ?? 0) - now()) / 1000;
      return `<div class="big-ic">${img(t.fruit, 'ic-lg')}</div><div class="center"><b>${ITEMS[t.fruit].name}</b> ×${t.yield}<br>⏱ ${fmtTime(left)}</div>
        <div class="btns"><button class="btn blue" data-act="skip">${img('diamond')} ${skipCost(left)} Веднага</button><button class="btn sm blue" data-act="move">✥ Премести</button></div>`;
    },
    actions: {
      skip: () => { const left = ((v.e.ready ?? 0) - now()) / 1000; if (spendDiamonds(skipCost(left))) { v.e.ready = now(); save(); close(); } else UI.toast('Нямаш достатъчно диаманти', 'warn'); },
      move: () => { close(); C.farm.beginPlace(v.e.type, undefined, v); },
    },
  } as any, true);
}

function openDeco(v: View) {
  const refund = Math.floor(v.def.price / 2);
  open(v.def.name, {
    render: () => `<div class="big-ic">${img('b:' + v.def.id, 'ic-lg')}</div><div class="panel-desc">${v.def.desc}</div>
      <div class="btns"><button class="btn blue" data-act="move">✥ Премести</button>${refund ? `<button class="btn red" data-act="sell">Продай за ${img('coin')}${refund}</button>` : ''}</div>`,
    actions: {
      move: () => { close(); C.farm.beginPlace(v.e.type, undefined, v); },
      sell: () => { C.farm.remove(v.e.uid); addCoins(refund); sfx('coin'); close(); },
    },
  }, true);
}

// =====================================================================
// ИМОТИ: КЪЩАТА + СЕЛОТО
function openHome() {
  open('Имоти', {
    tabs: [{ id: 'home', label: '🏡 Моята къща' }, { id: 'village', label: '🏘 Къщи в селото' }],
    tab: 'home',
    render: () => {
      if (current!.tab === 'home') {
        const tier = HOME_TIERS[S.home];
        const next = HOME_TIERS[S.home + 1];
        const daily = new Date(S.lastDaily).toDateString() !== new Date().toDateString();
        let html = `<div class="big-ic">${img('m:' + tier.model, 'ic-lg')}</div><div class="center"><b style="font-size:20px">${tier.name}</b><br>Всеки ден носи ${coinsHtml(tier.daily)}</div>`;
        html += `<div class="btns"><button class="btn gold ${daily ? '' : 'gray'}" data-act="daily">${daily ? `Вземи днешните ${fmt(tier.daily)} монети` : 'Днешните монети са взети ✓'}</button></div>`;
        if (next) {
          const lk = next.level > S.level;
          html += `<div class="card mt" style="flex-direction:row;cursor:default;text-align:left">${img('m:' + next.model, 'ic')}<div class="sp"><div class="nm">Следваща: ${next.name}</div><div class="sub">Носи ${fmt(next.daily)} монети на ден</div></div>
            ${lk ? `<b>Ниво ${next.level}</b>` : `<button class="btn" data-act="upgrade">Построй за ${img('coin')}${fmt(next.price)}</button>`}</div>`;
        } else html += `<div class="panel-desc mt">Имаш най-хубавата къща в Родопите! 🏆</div>`;
        return html;
      }
      let html = `<div class="panel-desc">Купи къща в селото и тя ще ти носи наем всеки час (трупа се до ${RENT_CAP_H} часа).</div><div class="grid">`;
      VILLAGE_HOUSES.forEach((h, i) => {
        const owned = !!S.village[i];
        const lk = h.level > S.level;
        html += `<div class="card ${lk && !owned ? 'locked' : ''}" data-act="vh" data-i="${i}">${lk && !owned ? `<div class="lock">Ниво ${h.level}</div>` : ''}${owned ? '<div class="own">Твоя</div>' : ''}
          ${img('m:' + h.model, 'ic')}<div class="nm">${h.name}</div><div class="sub">${fmt(h.rent)} 🪙 на час</div>
          ${owned ? `<div class="price">Наем: ${img('coin')}${fmt(rentDue(i))}</div>` : `<div class="price">${img('coin')}${fmt(h.price)}</div>`}</div>`;
      });
      html += `</div><div class="btns"><button class="btn blue" data-act="go">🗺 Иди в селото</button><button class="btn gold" data-act="rentall">Събери целия наем</button></div>`;
      return html;
    },
    actions: {
      daily: () => {
        const daily = new Date(S.lastDaily).toDateString() !== new Date().toDateString();
        if (!daily) return;
        S.lastDaily = now();
        const tier = HOME_TIERS[S.home];
        addCoins(tier.daily);
        flyTo('coin', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-coins', 6);
        sfx('coin');
        save();
      },
      upgrade: () => {
        const next = HOME_TIERS[S.home + 1];
        if (!next || next.level > S.level) return;
        if (!spend(next.price)) { UI.toast('Нямаш достатъчно монети', 'warn'); sfx('error'); return; }
        S.home++;
        addXP(Math.round(next.price / 25));
        save();
        const hv = C.farm.byType('house')[0];
        loadModel(next.model).then(() => hv?.setVisual?.());
        if (hv) { sparkle(centerOf(hv.e).setY(4), 40); C.farm.rig.flyTo(hv.root.position.x, hv.root.position.z, 40); }
        sfx('build');
        close();
        UI.toast(`Новата ти къща: ${next.name}! 🎉`, 'ok');
      },
      vh: (el) => { close(); UI.openVillageHouse(+el.dataset.i!); },
      go: () => { close(); C.farm.rig.flyTo(110, 30, 70); },
      rentall: () => {
        let tot = 0;
        for (const k of Object.keys(S.village)) tot += C.village.collect(+k);
        if (!tot) UI.toast('Още няма натрупан наем', 'info');
      },
    },
  });
}

function openVillageHouse(i: number) {
  const h = VILLAGE_HOUSES[i];
  open(h.name, {
    live: true,
    render: () => {
      const owned = !!S.village[i];
      let html = `<div class="big-ic">${img('m:' + h.model, 'ic-lg')}</div><div class="center">Носи <b>${fmt(h.rent)}</b> монети на час</div>`;
      if (owned) html += `<div class="center mt">Натрупан наем: ${coinsHtml(rentDue(i))}</div><div class="btns"><button class="btn gold" data-act="collect">Събери наема</button></div>`;
      else if (h.level > S.level) html += `<div class="center mt"><b>Отключва се на ниво ${h.level}</b></div>`;
      else html += `<div class="btns"><button class="btn" data-act="buy">Купи за ${img('coin')}${fmt(h.price)}</button></div>`;
      return html;
    },
    actions: {
      buy: () => { if (C.village.buy(i)) { close(); UI.toast(`Купи ${h.name}! 🎉`, 'ok'); } },
      collect: () => { if (!C.village.collect(i)) UI.toast('Още няма натрупан наем', 'info'); },
    },
  }, true);
}

function openLand(id: string) {
  const l = LANDS.find((x) => x.id === id)!;
  const w = l.rect[2] - l.rect[0], d = l.rect[3] - l.rect[1];
  open('Нова земя', {
    render: () => `<div class="panel-desc">Разчисти земята и ще имаш място за още ниви, животни и сгради.</div>
      <div class="center"><b style="font-size:20px">${w} × ${d} м</b></div>
      ${l.level > S.level ? `<div class="center mt"><b>Отключва се на ниво ${l.level}</b></div>` : `<div class="btns"><button class="btn" data-act="buy">Купи за ${img('coin')}${fmt(l.price)}</button></div>`}`,
    actions: { buy: () => { if (C.farm.buyLand(id)) { close(); UI.toast('Земята е твоя! 🎉', 'ok'); } } },
  }, true);
}

// =====================================================================
// ГАРАЖ
function openGarage() {
  if (!C.farm.byType('garage').length) {
    UI.toast(S.level >= 3 ? 'Първо купи гараж от Магазина' : 'Гаражът се отключва на ниво 3', 'info');
    return;
  }
  open('Гараж', {
    render: () => `<div class="panel-desc">Купи кола и я покарай из селото! Всяка кола дава и бонус.</div><div class="grid">${CARS.map((c) => {
      const owned = S.cars.includes(c.id);
      const lk = c.level > S.level;
      return `<div class="card ${lk && !owned ? 'locked' : ''}">${lk && !owned ? `<div class="lock">Ниво ${c.level}</div>` : ''}${owned ? '<div class="own">Твоя</div>' : ''}
        ${img('car:' + c.id, 'ic')}<div class="nm">${c.name}</div><div class="sub">${c.bonus}</div><div class="sub">до ${c.speed} км/ч</div>
        ${owned ? `<button class="btn sm" data-act="drive" data-id="${c.id}">🚗 Карай</button>` : lk ? '' : `<button class="btn sm gold" data-act="buy" data-id="${c.id}">${c.diamonds ? `${img('diamond')}${c.diamonds}` : `${img('coin')}${fmt(c.price)}`}</button>`}</div>`;
    }).join('')}</div>`,
    actions: {
      buy: (el) => {
        const c = CARS.find((x) => x.id === el.dataset.id)!;
        const ok = c.diamonds ? spendDiamonds(c.diamonds) : spend(c.price);
        if (!ok) { UI.toast(c.diamonds ? 'Нямаш достатъчно диаманти' : 'Нямаш достатъчно монети', 'warn'); sfx('error'); return; }
        S.cars.push(c.id);
        addXP(Math.round(c.price / 30) + (c.diamonds ? 50 : 0));
        save();
        C.vehicles.refresh();
        sfx('build');
        UI.toast(`Купи ${c.name}! Натисни „Карай“ 🚗`, 'ok');
      },
      drive: (el) => { close(); C.vehicles.startDrive(el.dataset.id!); },
    },
  });
}

// =====================================================================
// СЕРГИЯ (пазарът днес)
function marketDeals() {
  const hour = Math.floor(now() / 3600000);
  let s = hour * 2654435761;
  const r = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
  const pool = makeable().filter((id) => ITEMS[id].kind !== 'feed');
  const deals: { id: string; qty: number; mult: number }[] = [];
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    const id = pool[Math.floor(r() * pool.length)];
    if (deals.some((d) => d.id === id)) continue;
    deals.push({ id, qty: 2 + Math.floor(r() * 6), mult: 1.6 + Math.round(r() * 4) / 10 });
  }
  return { hour, deals };
}
function openMarket() {
  open('Сергия — пазарът днес', {
    live: true,
    render: () => {
      const { hour, deals } = marketDeals();
      const sold = (S as any).marketSold?.[hour] ?? {};
      const left = 3600 - ((now() / 1000) % 3600);
      return `<div class="panel-desc">Хората на пазара в Гърмен търсят тези стоки и плащат повече! Нови след ⏱ ${fmtTime(left)}.</div><div class="orders">${deals.map((d, i) => {
        const rest = d.qty - (sold[d.id] ?? 0);
        const it = ITEMS[d.id];
        return `<div class="order ${rest > 0 && count(d.id) > 0 ? 'ok' : ''}"><div class="row">${img(d.id, 'ic-md')}<div><b>${it.name}</b><div class="sub">×${d.mult.toFixed(1)} цена · търсят още ${Math.max(0, rest)}</div></div></div>
          <div class="rew">1 бр. = ${coinsHtml(Math.round(it.price * d.mult))}</div>
          <button class="btn sm ${rest > 0 && count(d.id) > 0 ? '' : 'gray'}" data-act="sell" data-i="${i}">Продай 1 (имаш ${count(d.id)})</button></div>`;
      }).join('') || '<div class="empty">Още няма какво да продаваш. Ожъни нещо!</div>'}</div>`;
    },
    actions: {
      sell: (el) => {
        const { hour, deals } = marketDeals();
        const d = deals[+el.dataset.i!];
        const ms = ((S as any).marketSold ??= {});
        for (const k of Object.keys(ms)) if (+k !== hour) delete ms[k];
        const sold = (ms[hour] ??= {});
        if ((sold[d.id] ?? 0) >= d.qty || count(d.id) < 1) { sfx('error'); return; }
        takeAll({ [d.id]: 1 });
        sold[d.id] = (sold[d.id] ?? 0) + 1;
        addCoins(Math.round(ITEMS[d.id].price * d.mult));
        addXP(1);
        flyTo('coin', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-coins', 2);
        sfx('coin');
        save();
      },
    },
  });
}

// =====================================================================
// ПОСЕТИТЕЛ
function openVisitor(v: { item: string; qty: number; coins: number; xp: number; name: string }, accept: () => void, decline: () => void) {
  open(v.name, {
    render: () => `<div class="center">Здравей! Ще ми продадеш ли</div><div class="big-ic">${img(v.item, 'ic-lg')}</div>
      <div class="center"><b style="font-size:20px">${ITEMS[v.item].name} × ${v.qty}</b><br>Имаш: ${count(v.item)}</div>
      <div class="center mt">Плащам ${coinsHtml(v.coins)} и ${img('star', 'ic-sm')} ${v.xp}</div>
      <div class="btns"><button class="btn ${count(v.item) >= v.qty ? '' : 'gray'}" data-act="yes">Продай</button><button class="btn red" data-act="no">Не, благодаря</button></div>`,
    actions: {
      yes: () => { if (count(v.item) < v.qty) { UI.toast('Нямаш достатъчно', 'warn'); sfx('error'); return; } accept(); close(); },
      no: () => { decline(); close(); },
    },
  }, true);
}

// =====================================================================
// НАСТРОЙКИ / ПРОФИЛ
function openSettings() {
  open('Настройки', {
    render: () => `<div class="settings">
      <div class="row"><b>Име на фермата</b><span class="sp"></span><input class="name" id="farmname" value="${S.name.replace(/"/g, '&quot;')}" maxlength="24"><button class="btn xs" data-act="name">✓</button></div>
      <div class="row"><b>Звуци</b><span class="sp"></span><button class="btn sm ${S.sound ? '' : 'gray'}" data-act="sound">${S.sound ? 'Вкл.' : 'Изкл.'}</button></div>
      <div class="row"><b>Музика</b><span class="sp"></span><button class="btn sm ${S.music ? '' : 'gray'}" data-act="music">${S.music ? 'Вкл.' : 'Изкл.'}</button></div>
      <div class="row"><b>Ден и нощ</b><span class="sp"></span><button class="btn xs ${DN?.mode !== 'day' ? '' : 'gray'}" data-act="dn" data-m="real">Истинско време</button> <button class="btn xs ${DN?.mode === 'day' ? '' : 'gray'}" data-act="dn" data-m="day">Винаги ден</button></div>
      <div class="row"><b>Графика</b><span class="sp"></span>${(['low', 'medium', 'high'] as const).map((q) => `<button class="btn xs ${C.engine.quality === q ? '' : 'gray'}" data-act="q" data-q="${q}">${{ low: 'Бърза', medium: 'Средна', high: 'Най-хубава' }[q]}</button>`).join(' ')}</div>
      <div class="row"><b>Как се играе</b><span class="sp"></span><button class="btn sm blue" data-act="help">Покажи</button></div>
      <div class="mt"><b>Автори на 3D моделите</b><div class="credits" id="credits">Зареждане…</div></div>
      <div class="btns"><button class="btn red sm" data-act="reset">Започни отначало</button></div>
    </div>`,
    actions: {
      name: () => { const v = ($('#farmname') as HTMLInputElement).value.trim(); if (v) { S.name = v; save(); refreshHUD(); UI.toast('Записано', 'ok'); } },
      sound: () => { S.sound = !S.sound; save(); },
      music: () => { S.music = !S.music; save(); S.music ? startMusic() : stopMusic(); },
      q: (el) => C.engine.setQuality(el.dataset.q as any),
      dn: (el) => DN?.setMode(el.dataset.m as 'real' | 'day'),
      help: () => { close(); showHelp(); },
      reset: () => {
        if (!confirmTwice()) return;
        resetSave();
        location.reload();
      },
    },
  });
  fetch(import.meta.env.BASE_URL + 'models/credits.json').then((r) => r.json()).then((c: Record<string, { title: string; creator: string; licence: string }>) => {
    const el = $('#credits');
    if (!el) return;
    const rows = Object.values(c);
    const by = rows.filter((x) => x.licence !== 'CC0 1.0');
    el.innerHTML = `Повечето модели са от <b>Quaternius</b> (CC0). С лиценз CC-BY 3.0: ${by.map((x) => `${x.title} — ${x.creator}`).join('; ')}. Всички модели: poly.pizza.`;
  }).catch(() => {});
}
let resetClicks = 0;
function confirmTwice() {
  resetClicks++;
  if (resetClicks < 3) { UI.toast(`Натисни още ${3 - resetClicks} пъти, за да изтриеш фермата`, 'warn'); return false; }
  return true;
}

function openProfile() {
  open(S.name, {
    render: () => {
      let html = `<div class="center"><b style="font-size:20px">Ниво ${S.level}</b> · ${fmt(S.xp)} / ${fmt(xpForLevel(S.level))} опит</div>
      <div class="panel-desc">Постижения — вземи диамантите, когато изпълниш целта. С диаманти се ускорява всичко.</div><div class="orders">`;
      for (const a of ACHIEVEMENTS) {
        const got = S.ach[a.id] ?? 0;
        const done = got >= a.tiers.length;
        const goal = a.tiers[Math.min(got, a.tiers.length - 1)];
        const val = achValue(a.id);
        const ready = !done && val >= goal;
        const stars = '★'.repeat(got) + '☆'.repeat(a.tiers.length - got);
        html += `<div class="order ${ready ? 'ok' : ''}"><div class="row">${img(a.icon, 'ic-md')}<div><b>${a.name}</b> <span style="color:#e0a800">${stars}</span>
          <div class="sub" style="font-size:12.5px;color:#8a6440">${a.desc.replace('{n}', fmt(goal))}</div></div></div>
          <div class="capbar" style="margin:2px 0"><i style="width:${Math.min(100, (val / goal) * 100)}%"></i><span class="outl">${fmt(Math.min(val, goal))} / ${fmt(goal)}</span></div>
          ${done ? '<b class="center">Завършено! 🏆</b>' : `<button class="btn sm ${ready ? 'gold' : 'gray'}" data-act="claim" data-id="${a.id}">Вземи ${img('diamond')} ${a.reward[got]}</button>`}</div>`;
      }
      html += `</div><div class="grid mt">
        <div class="card">${img('wheat', 'ic')}<div class="nm">Ожънато</div><b>${fmt(S.stats.harvested)}</b></div>
        <div class="card">${img('bread', 'ic')}<div class="nm">Произведено</div><b>${fmt(S.stats.produced)}</b></div>
        <div class="card">${img('b:board', 'ic')}<div class="nm">Поръчки</div><b>${fmt(S.stats.orders)}</b></div>
        <div class="card">${img('coin', 'ic')}<div class="nm">Спечелени монети</div><b>${fmt(S.stats.earned)}</b></div>
      </div>`;
      return html;
    },
    actions: {
      claim: (el) => {
        const a = ACHIEVEMENTS.find((x) => x.id === el.dataset.id)!;
        const got = S.ach[a.id] ?? 0;
        if (got >= a.tiers.length || achValue(a.id) < a.tiers[got]) { sfx('error'); return; }
        S.ach[a.id] = got + 1;
        addDiamonds(a.reward[got]);
        flyTo('diamond', { x: innerWidth / 2, y: innerHeight / 2 }, '#hud-diamonds', Math.min(6, a.reward[got]));
        sfx('levelup');
        save();
        refreshHUD();
      },
    },
  });
}

function showHelp() {
  open('Как се играе', {
    render: () => `<div style="line-height:1.55;font-size:15px">
      🌾 <b>Ниви:</b> натисни празна нива и избери семе. Плъзни пръст по другите празни ниви — засяват се всички. Когато узреят, плъзни по тях, за да ги ожънеш.<br>
      🏭 <b>Работилници:</b> натисни мелницата или пекарната и избери какво да се прави. Натисни я отново, когато е готово.<br>
      🐔 <b>Животни:</b> натисни заграждението, за да ги нахраниш, а после — за да събереш яйцата, млякото или вълната.<br>
      📋 <b>Поръчки:</b> хората от селото искат стоки. Изпрати поръчката с пикапа и вземи монети и опит.<br>
      🏡 <b>Имоти:</b> подобри къщата си и купувай къщи в селото — носят наем всеки час.<br>
      🚗 <b>Коли:</b> купи гараж и кола, после я карай из селото и Родопите.<br>
      🖐 <b>Камера:</b> местиш с пръст, приближаваш с два пръста (или колелцето), въртиш с два пръста (или десния бутон / Q и E).
    </div>`,
    actions: {},
  });
}

// =====================================================================
// НИВО
function levelUp() {
  const lv = S.level;
  const unl = unlocksAt(lv);
  const dia = lv % 5 === 0 ? 5 : 2;
  addDiamonds(dia);
  addCoins(lv * 15);
  sfx('levelup');
  sparkle(C.farm.rig.target.clone().setY(3), 50);
  setTimeout(() => {
    open('Ново ниво!', {
      render: () => `<div class="lvlup"><div class="big outl">Ниво ${lv}</div>
        <div class="center">Награда: ${diaHtml(dia)} и ${coinsHtml(lv * 15)}</div>
        ${unl.length ? `<div class="mt"><b>Отключено:</b></div><div class="unl">${unl.map((u) => `<div>${img(u.icon === 'home' ? 'm:house_red1' : u.icon === 'land' ? 'm:n_tree5' : u.icon, '')}<br>${u.name}</div>`).join('')}</div>` : ''}
        <div class="btns"><button class="btn" data-act="close">Супер!</button></div></div>`,
      actions: {},
    }, true);
    C.farm.buildLands();
    C.village.build();
  }, 600);
}

// =====================================================================
// ДЖОЙСТИК
function setupJoystick() {
  const joy = $('#joy'), knob = $('#joy i');
  let id = -1;
  const R = 60;
  const move = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const dv = C.vehicles.drive;
    if (dv) { dv.joy.x = dx / R; dv.joy.y = -dy / R; dv.joy.active = true; }
  };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); move(e); e.stopPropagation(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    knob.style.transform = '';
    const dv = C.vehicles.drive;
    if (dv) { dv.joy.active = false; dv.joy.x = dv.joy.y = 0; }
  };
  joy.addEventListener('pointerup', up);
  joy.addEventListener('pointercancel', up);
}

// =====================================================================
// ОБУЧЕНИЕ (кратки подсказки отгоре)
const GUIDE = [
  { id: 'start', text: 'Натисни празна нива, за да засееш пшеница.', icon: 'wheat' },
  { id: 'seeds', text: 'Избери пшеница отдолу. После плъзни пръст по другите празни ниви.', icon: 'wheat' },
  { id: 'planted', text: 'Браво! Пшеницата расте 1 минута. Когато пожълтее — плъзни по нивите, за да ожънеш.', icon: 'wheat' },
  { id: 'harvested', text: 'Натисни Фуражната мелница (вятърната мелница) и направи храна за кокошки.', icon: 'feed_chicken' },
  { id: 'made', text: 'Супер! Отвори „Поръчки“ долу и изпълни поръчка, щом имаш нужните стоки.', icon: 'b:board' },
  { id: 'order', text: 'Отлично! Купувай нови сгради и животни от Магазина. Приятна игра! 🌄', icon: 'b:market' },
];
function guideStep(ev: string) {
  const i = GUIDE.findIndex((g) => g.id === ev);
  if (i > S.tut && S.tut < GUIDE.length) { S.tut = i; save(); }
  showGuide();
}
function showGuide() {
  const g = $('#guide');
  if (S.tut >= GUIDE.length) { g.classList.remove('show'); return; }
  const step = GUIDE[Math.max(0, S.tut)];
  g.innerHTML = `${img(step.icon, '')}<span>${step.text}</span>`;
  g.classList.add('show');
  if (S.tut === GUIDE.length - 1) setTimeout(() => { if (S.tut === GUIDE.length - 1) { S.tut = GUIDE.length; save(); g.classList.remove('show'); } }, 9000);
}

// =====================================================================
export function bindUI(ctx: Ctx) {
  C = ctx;
  buildHUD();
  Object.assign(UI, {
    toast(text: string, kind: 'ok' | 'warn' | 'info' = 'info') {
      const el = document.createElement('div');
      el.className = 'toast ' + kind;
      el.textContent = text;
      $('#toasts').appendChild(el);
      setTimeout(() => el.remove(), 2700);
      const all = $('#toasts').children;
      if (all.length > 3) all[0].remove();
    },
    openSeeds,
    closeSeeds: () => $('#seeds').classList.remove('show'),
    fieldInfo,
    openProduction,
    openStorage,
    openAnimals,
    openTree,
    openDeco,
    openHome,
    openOrders,
    openGarage,
    openMarket,
    openLand,
    openVillageHouse,
    openVisitor,
    placing(on: boolean, ok: boolean) {
      $('#placebar').classList.toggle('show', on);
      ($('#pok') as HTMLButtonElement).classList.toggle('gray', !ok);
      $('#hud-bottom').style.display = on ? 'none' : '';
      if (on) { close(); $('#seeds').classList.remove('show'); }
    },
    closeAll() {
      close();
      closeTip();
      $('#seeds').classList.remove('show');
    },
    refresh: refreshHUD,
    sowMode(crop: string | null) {
      const h = $('#sowhint');
      if (crop) {
        $('#sowhint-t').innerHTML = `${img(crop, 'ic-sm')} Плъзни по празните ниви, за да засееш ${ITEMS[crop].name.toLowerCase()}`;
        h.classList.add('show');
      } else h.classList.remove('show');
    },
  });
  ctx.vehicles.onDriveChange = (on) => {
    $('#drivebar').classList.toggle('show', on);
    $('#hud-bottom').style.display = on ? 'none' : '';
    if (on) UI.toast('Карай с джойстика (или със стрелките на клавиатурата)', 'info');
  };
  on((what) => {
    if (what === 'levelup') levelUp();
    if (what === 'inv' && S.tut === 2 && S.stats.harvested > 0) guideStep('harvested');
    refreshHUD();
  });
  refreshHUD();
  showGuide();
  // жив прозорец (таймери)
  setInterval(() => {
    if (current?.live && !$('#panel-body').matches(':active')) rerender();
    travelLabel();
    const sp = $('#speedo');
    if (C.vehicles.drive && sp) sp.textContent = `${C.vehicles.speedKmh()} км/ч`;
  }, 500);
  setInterval(refreshHUD, 3000);
  void emit;
  void THREE;
}
