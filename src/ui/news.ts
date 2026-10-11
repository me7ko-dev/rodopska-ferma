import { img } from './icons';
import { UI } from './api';
import { S, save, addItem } from '../game/state';
import { sfx } from '../audio/sfx';
import { confetti } from '../game/fx';
import { season, SEASON_NAMES, SEASON_ICONS } from '../world/seasons';

// „Ново в играта“ — показва се веднъж след голямо обновяване, с подарък за старите ферми.

export const NEWS_VERSION = 2;
const GIFT: Record<string, number> = { axe: 3, saw: 2, shovel: 2, dynamite: 1, bait: 10, pickaxe: 3 };

export function showNews(go: { fishing: () => void; mine: () => void; train: () => void }) {
  if ((S.news ?? 0) >= NEWS_VERSION) return;
  const firstTime = S.stats.harvested < 3 && S.level <= 1;
  S.news = NEWS_VERSION;
  save();
  if (firstTime) return; // новите играчи имат обучение и инструменти от самото начало
  for (const [k, n] of Object.entries(GIFT)) addItem(k, n, true);
  const row = (icon: string, title: string, text: string, btn = '') => `<div class="newsrow">${img(icon, 'ic-md')}<div class="sp"><b>${title}</b><div class="sub">${text}</div></div>${btn}</div>`;
  UI.panel('Ново в Родопска ферма!', `<div class="news">
    ${row('m:tree_autumn', `${SEASON_ICONS[season]} Сезони`, `Сега е ${SEASON_NAMES[season].toLowerCase()}. Природата се сменя с истинския календар — зимата ще има сняг! Сезонните култури растат по-бързо.`)}
    ${row('axe', 'Находки и препятствия', 'При жътва понякога намираш материали и инструменти. Из фермата растат храсти, дървета и камъни — разчисти ги за награди.')}
    ${row('f_carp', 'Риболов (ниво 6)', 'Иди на кея на езерото. Хвани 9 вида риба — и златната рибка!', S.level >= 6 ? '<button class="btn xs blue" data-act="fishing">Иди</button>' : '')}
    ${row('crate_icon', 'Товарен влак (ниво 7)', 'Влакът идва до фермата с 9 сандъка. Напълни ги за голяма награда.', S.level >= 7 ? '<button class="btn xs blue" data-act="train">Виж</button>' : '')}
    ${row('pickaxe', 'Рудник (ниво 9)', 'Копай руда и кристали в скалите. От среброто се правят пафти и гривни.', S.level >= 9 ? '<button class="btn xs blue" data-act="mine">Иди</button>' : '')}
    ${row('calendar', 'Задачи за деня и Родопски събор', 'Нови задачи всеки ден, подарък за всеки ден и седмично състезание със съседите.')}
    <div class="newsgift">🎁 Подарък за теб: ${Object.entries(GIFT).map(([k, n]) => `<span class="need">${img(k, '')}${n}</span>`).join(' ')}</div></div>
    <div class="btns"><button class="btn" data-act="ok">Супер!</button></div>`,
  {
    ok: () => UI.closeAll(),
    fishing: () => { UI.closeAll(); setTimeout(go.fishing, 100); },
    train: () => { UI.closeAll(); setTimeout(go.train, 100); },
    mine: () => { UI.closeAll(); setTimeout(go.mine, 100); },
  });
  confetti(60);
  sfx('fanfare');
}
