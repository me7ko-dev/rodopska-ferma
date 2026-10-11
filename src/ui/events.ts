import { img } from './icons';
import { UI } from './api';
import { S, now } from '../game/state';
import { ITEMS } from '../game/data';
import { sfx } from '../audio/sfx';
import { flyTo } from '../game/fx';
import {
  daily, claimTask, claimChest, loginState, claimLogin, LOGIN_GIFTS, onTasks,
  fair, takeFairTask, finishFairTask, claimMilestone, claimFairEnd, rivals, rankOf, weekStart,
  FAIR_LEVEL, FAIR_TASKS, FAIR_ACTIVE, FAIR_MILESTONES, FAIR_PRIZES, type Task,
} from '../game/tasks';
import type { PanelApi } from './social';

// Задачи за деня, подарък за всеки ден и седмичният Родопски събор.

let P: PanelApi;
const fmt = (n: number) => Math.floor(n).toLocaleString('bg-BG');
const mid = () => ({ x: innerWidth / 2, y: innerHeight / 2 });
function left(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
}
const bar = (got: number, n: number) => `<div class="capbar tbar"><i style="width:${Math.min(100, (got / n) * 100)}%"></i><span class="outl">${fmt(got)} / ${fmt(n)}</span></div>`;

// ---------------------------------------------------------------- значки
export function eventBadges() {
  const d = daily();
  let a = 0;
  if (d) a += d.tasks.filter((t) => !t.done && t.got >= t.n).length + (!d.chest && d.tasks.every((t) => t.done) ? 1 : 0);
  if (loginState().can) a++;
  const f = S.level >= FAIR_LEVEL ? fair() : null;
  let b = 0;
  if (f) {
    b += f.active.filter((t) => t.got >= t.n).length;
    if (FAIR_MILESTONES[f.ms] && f.pts >= FAIR_MILESTONES[f.ms].pts) b++;
    if (f.ended && (f.rank ?? -1) >= 0) b++;
  }
  return { tasks: a, fair: b };
}

function refreshBadges() {
  const b = eventBadges();
  const t = document.getElementById('badge-tasks'), f = document.getElementById('badge-fair');
  if (t) t.textContent = b.tasks ? String(b.tasks) : '';
  if (f) f.textContent = b.fair ? String(b.fair) : '';
  const fb = document.getElementById('btn-fair');
  if (fb) fb.style.display = S.level >= FAIR_LEVEL ? '' : 'none';
  const tb = document.getElementById('btn-tasks');
  if (tb) tb.style.display = S.level >= 2 ? '' : 'none';
}

// ---------------------------------------------------------------- задачи и подарък
function taskRow(t: Task, act: string, i: number, extra = '') {
  const ok = t.got >= t.n;
  return `<div class="trow2 ${t.done ? 'done' : ok ? 'ok' : ''}">${img(t.icon, 'ic-md')}<div class="sp"><b>${t.text}</b>${bar(t.got, t.n)}${extra}</div>
    ${t.done ? '<div class="chk">✓</div>' : `<button class="btn sm ${ok ? 'gold' : 'gray'}" data-act="${act}" data-i="${i}">${ok ? 'Вземи' : '…'}</button>`}</div>`;
}

export function openTasks(tab = 'day') {
  P.open('Задачи', {
    live: true,
    tabs: [{ id: 'day', label: '📅 За деня' }, { id: 'gift', label: '🎁 Подарък' }],
    tab,
    render: () => {
      if (P.tab() === 'gift') {
        const L = loginState();
        let html = `<div class="panel-desc">Влизай всеки ден и взимай подарък! На 7-ия ден — голяма награда. (Взети: ${L.total})</div><div class="gifts">`;
        LOGIN_GIFTS.forEach((g, i) => {
          const got = i < L.next || (!L.can && i === L.next - 1);
          const today = i === L.next && L.can;
          html += `<div class="gift ${got && !today ? 'got' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}"><div class="dnum">Ден ${i + 1}</div>${img(g.icon, 'ic-md')}<div class="sub">${g.text}</div>${got && !today ? '<div class="chk">✓</div>' : ''}</div>`;
        });
        html += `</div><div class="btns">${L.can ? '<button class="btn gold" data-act="login">🎁 Вземи днешния подарък</button>' : '<b>Ела пак утре за следващия подарък! 🌙</b>'}</div>`;
        return html;
      }
      const d = daily();
      if (!d) return '<div class="empty">Задачите за деня се отключват на ниво 2.</div>';
      const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
      let html = `<div class="panel-desc">Нови задачи след ⏱ ${left(tomorrow.getTime() - now())}. Серия дни с изпълнени задачи: <b>${d.streak}</b> 🔥</div><div class="tlist">`;
      d.tasks.forEach((t, i) => (html += taskRow(t, 'claim', i, `<div class="rw">${img('coin', 'ic-xs')}${fmt(t.coins)} ${img('star', 'ic-xs')}${t.xp}</div>`)));
      html += '</div>';
      const all = d.tasks.every((t) => t.done);
      html += `<div class="upbox">${img('gift', 'ic-md')}<b> Изпълни трите и вземи сандъче:</b> диаманти и материали (повече за дълга серия)
        <div class="btns">${d.chest ? '<b>Взето ✓ — утре пак!</b>' : `<button class="btn ${all ? 'gold' : 'gray'}" data-act="chest">Отвори сандъчето</button>`}</div></div>`;
      return html;
    },
    actions: {
      claim: (el) => {
        const t = claimTask(+el.dataset.i!);
        if (!t) return;
        flyTo('coin', mid(), '#hud-coins', 4);
        flyTo('star', mid(), '#hud-xp', 2, 150);
        sfx('coin');
      },
      chest: () => {
        const r = claimChest();
        if (!r) { UI.toast('Първо изпълни трите задачи', 'info'); return; }
        flyTo('diamond', mid(), '#hud-diamonds', r.dia);
        flyTo(r.mat, mid(), '#hud-barn', 2, 300);
        sfx('fanfare');
        UI.toast(`🎁 +${r.dia} диаманта и 2 × ${ITEMS[r.mat].name}! Серия: ${r.streak} дни`, 'ok');
      },
      login: () => {
        const g = claimLogin();
        if (!g) return;
        if (g.coins) flyTo('coin', mid(), '#hud-coins', 6);
        if (g.dia) flyTo('diamond', mid(), '#hud-diamonds', Math.min(6, g.dia), 200);
        for (const k of Object.keys(g.items ?? {})) flyTo(k, mid(), '#hud-barn', 1, 300);
        sfx('fanfare');
        UI.toast(`🎁 Подарък: ${g.text}!`, 'ok');
      },
    },
  });
}

// ---------------------------------------------------------------- Родопски събор
export function openFair() {
  if (S.level < FAIR_LEVEL) { UI.toast(`🏆 Съборът се отключва на ниво ${FAIR_LEVEL}`, 'info'); return; }
  P.open('Родопски събор', {
    live: true,
    render: () => {
      const f = fair()!;
      if (f.ended && (f.rank ?? -1) >= 0) {
        const r = f.rank!;
        return `<div class="center fair-end"><div class="big-ic">${img('trophy', 'ic-lg')}</div><b style="font-size:22px">Съборът свърши!</b><br>Завърши <b>${r + 1}-${r === 0 ? 'ви' : r === 1 ? 'ри' : r === 2 ? 'ти' : 'и'}</b> с ${fmt(f.pts)} точки.
          <div class="btns"><button class="btn gold" data-act="endclaim">Вземи ${img('diamond')} ${FAIR_PRIZES[r] ?? 2}</button></div></div>`;
      }
      const end = weekStart() + 7 * 86400000;
      const rank = rankOf(f);
      const list = [...rivals(f).map((x) => ({ ...x, me: false })), { name: S.name, pts: f.pts, me: true }].sort((a, b) => b.pts - a.pts);
      let html = `<div class="panel-desc">Седмично състезание между фермите от Родопите. Изпълнявай задачи, трупай точки и вземи купата! Край след ⏱ ${left(end - now())}.</div>
        <div class="fairtop"><div class="fpts">${img('trophy', 'ic-md')}<b>${fmt(f.pts)}</b> точки · <b>${rank + 1}</b> място</div></div>`;
      // пътят с награди
      const m = FAIR_MILESTONES[f.ms];
      if (m) {
        const prev = f.ms ? FAIR_MILESTONES[f.ms - 1].pts : 0;
        const what = [m.coins ? `${img('coin', 'ic-xs')}${fmt(m.coins)}` : '', m.dia ? `${img('diamond', 'ic-xs')}${m.dia}` : '', ...Object.entries(m.items ?? {}).map(([k, n]) => `${img(k, 'ic-xs')}${n}`)].join(' ');
        html += `<div class="upbox mstone"><div class="row"><b>Награда при ${fmt(m.pts)} точки:</b> ${what}<span class="sp"></span>${f.pts >= m.pts ? '<button class="btn sm gold" data-act="ms">Вземи</button>' : ''}</div>${bar(Math.max(0, f.pts - prev), m.pts - prev)}</div>`;
      }
      // активни задачи
      html += `<div class="sec">Твоите задачи (${f.active.length}/${FAIR_ACTIVE}) · взети ${f.taken}/${FAIR_TASKS} за седмицата</div><div class="tlist">`;
      if (!f.active.length) html += '<div class="empty">Избери задача отдолу.</div>';
      f.active.forEach((t, i) => {
        const late = !!t.until && now() > t.until && t.got < t.n;
        const ok = t.got >= t.n;
        html += `<div class="trow2 ${ok ? 'ok' : ''} ${late ? 'late' : ''}">${img(t.icon, 'ic-md')}<div class="sp"><b>${t.text}</b> <span class="pts">+${t.pts}</span>${bar(t.got, t.n)}
          <div class="sub">${late ? 'Времето изтече' : `остават ⏱ ${left((t.until ?? 0) - now())}`}</div></div>
          <button class="btn sm ${ok ? 'gold' : 'red'}" data-act="fin" data-i="${i}">${ok ? 'Предай' : 'Откажи'}</button></div>`;
      });
      html += '</div>';
      // предложения
      if (f.taken < FAIR_TASKS) {
        html += `<div class="sec">Избери задача</div><div class="offer">`;
        f.offer.forEach((t, i) => {
          html += `<div class="card" data-act="take" data-i="${i}">${img(t.icon, 'ic')}<div class="nm">${t.text}</div><div class="price">🏆 ${t.pts}</div><div class="sub">за ${2 + Math.round((t.pts ?? 100) / 60)} ч</div></div>`;
        });
        html += '</div>';
      } else html += '<div class="panel-desc mt">Взе всички задачи за седмицата. Довърши започнатите! 💪</div>';
      // класиране
      html += `<div class="sec">Класиране</div><div class="toplist">${list.map((x, i) => `<div class="trow ${x.me ? 'me' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="nm">${x.me ? `<b>${x.name}</b><small>ти</small>` : x.name}</span><span class="val">${fmt(x.pts)}</span></div>`).join('')}</div>
        <div class="panel-desc mt">Награди: 1-во място — ${FAIR_PRIZES[0]} 💎 и 2 динамита, 2-ро — ${FAIR_PRIZES[1]} 💎, 3-то — ${FAIR_PRIZES[2]} 💎.</div>`;
      return html;
    },
    actions: {
      take: (el) => {
        const f = fair()!;
        if (f.active.length >= FAIR_ACTIVE) { UI.toast(`Може да имаш най-много ${FAIR_ACTIVE} задачи наведнъж`, 'warn'); sfx('error'); return; }
        if (takeFairTask(+el.dataset.i!)) sfx('pop');
      },
      fin: (el) => {
        const t = finishFairTask(+el.dataset.i!);
        if (!t) return;
        if (t.got >= t.n) { sfx('fanfare'); flyTo('trophy', mid(), '#btn-fair', 2); flyTo('star', mid(), '#hud-xp', 1, 200); UI.toast(`🏆 +${t.pts} точки за събора!`, 'ok'); }
        else sfx('close');
      },
      ms: () => {
        const m = claimMilestone();
        if (!m) return;
        if (m.coins) flyTo('coin', mid(), '#hud-coins', 6);
        if (m.dia) flyTo('diamond', mid(), '#hud-diamonds', 6, 200);
        for (const k of Object.keys(m.items ?? {})) flyTo(k, mid(), '#hud-barn', 1, 300);
        sfx('fanfare');
      },
      endclaim: () => {
        const r = claimFairEnd();
        if (!r) return;
        flyTo('diamond', mid(), '#hud-diamonds', 6);
        sfx('levelup');
        UI.toast(`🏆 Награда от събора: ${r.dia} диаманта!`, 'ok');
      },
    },
  });
}

export function initEvents(p: PanelApi) {
  P = p;
  const ui = document.getElementById('ui')!;
  const side = document.createElement('div');
  side.id = 'hud-side';
  side.innerHTML = `<div class="sbtn" id="btn-tasks" data-ev="tasks">${img('calendar')}<span class="outl">Задачи</span><div class="badge" id="badge-tasks"></div></div>
    <div class="sbtn" id="btn-fair" data-ev="fair">${img('trophy')}<span class="outl">Събор</span><div class="badge" id="badge-fair"></div></div>`;
  ui.appendChild(side);
  side.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-ev]') as HTMLElement | null;
    if (!b) return;
    sfx('tap');
    if (b.dataset.ev === 'tasks') openTasks(loginState().can ? 'gift' : 'day');
    else openFair();
  });
  onTasks(refreshBadges);
  refreshBadges();
  setInterval(refreshBadges, 4000);
}
