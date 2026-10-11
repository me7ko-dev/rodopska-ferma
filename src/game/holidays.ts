import { S, save, addCoins, addDiamonds, addItem } from './state';

// Празници: поздрав с подарък, празнична украса над входа на фермата и по-добри цени на поръчките.

export interface Holiday { id: string; name: string; greet: string; deco: 'bulbs' | 'lanterns' | 'martenitsa'; gift: { coins?: number; dia?: number; items?: Record<string, number> }; fireworks?: boolean; bonus: number }

const NEW_YEAR: Holiday = { id: 'newyear', name: 'Нова година', greet: 'Честита Нова година! Здраве, щастие и богата реколта!', deco: 'bulbs', gift: { coins: 1000, dia: 10 }, fireworks: true, bonus: 0.2 };
const BABA_MARTA: Holiday = { id: 'martenitsa', name: 'Баба Марта', greet: 'Честита Баба Марта! Бъдете здрави и румени като мартеничка!', deco: 'martenitsa', gift: { dia: 5, items: { bait: 10 } }, bonus: 0.1 };
const RAMAZAN: Holiday = { id: 'ramazan', name: 'Рамазан Байрам', greet: 'Честит Рамазан Байрам! Мир, здраве и сладки празници на всички!', deco: 'lanterns', gift: { dia: 10, items: { baklava: 3, lokum: 2 } }, bonus: 0.25 };
const KURBAN: Holiday = { id: 'kurban', name: 'Курбан Байрам', greet: 'Честит Курбан Байрам! Благодат и берекет за дома и фермата!', deco: 'lanterns', gift: { dia: 10, coins: 800 }, bonus: 0.25 };

// първият ден на байрамите (по изчисленията — може да се различава с ден)
const RAMAZAN_DAYS = ['2027-03-10', '2028-02-27', '2029-02-15', '2030-02-05', '2031-01-25', '2032-01-15'];
const KURBAN_DAYS = ['2027-05-17', '2028-05-05', '2029-04-24', '2030-04-13', '2031-04-02', '2032-03-22'];

function within(d: Date, startIso: string, days: number) {
  const s = new Date(startIso + 'T00:00:00');
  const e = new Date(s.getTime() + days * 86400000);
  return d >= s && d < e;
}

/** Кой празник е днес (ако има). За проба: ?praznik=newyear|martenitsa|ramazan|kurban */
export function holidayToday(d = new Date()): Holiday | null {
  const test = new URLSearchParams(location.search).get('praznik');
  if (test) return [NEW_YEAR, BABA_MARTA, RAMAZAN, KURBAN].find((h) => h.id === test) ?? null;
  const m = d.getMonth(), day = d.getDate();
  if ((m === 11 && day === 31) || (m === 0 && day <= 2)) return NEW_YEAR;
  if (m === 2 && day <= 3) return BABA_MARTA;
  if (RAMAZAN_DAYS.some((s) => within(d, s, 3))) return RAMAZAN;
  if (KURBAN_DAYS.some((s) => within(d, s, 4))) return KURBAN;
  return null;
}

/** Ключ за тази година (подаръкът се дава веднъж на празник). */
const key = (h: Holiday) => {
  const d = new Date();
  // новогодишните дни от 31 декември се броят към следващата година
  const y = h.id === 'newyear' && d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  return `${h.id}${y}`;
};

export function holidayGiftReady(h: Holiday) {
  return !(S.holidays ?? []).includes(key(h));
}

export function claimHolidayGift(h: Holiday) {
  if (!holidayGiftReady(h)) return false;
  (S.holidays ??= []).push(key(h));
  if (h.gift.coins) addCoins(h.gift.coins);
  if (h.gift.dia) addDiamonds(h.gift.dia);
  for (const [k, n] of Object.entries(h.gift.items ?? {})) addItem(k, n, true);
  save();
  return true;
}

/** Колко повече плащат поръчките днес. */
export function holidayBonus() {
  return holidayToday()?.bonus ?? 0;
}
