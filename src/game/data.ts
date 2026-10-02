// Всичко в играта: стоки, култури, животни, сгради, рецепти, коли, къщи, нива.
// Времената са в секунди.

export type ItemKind = 'crop' | 'animal' | 'feed' | 'food' | 'fruit';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number; // цена при продажба на пазара
  xp: number; // опит при събиране/производство
  level: number; // от кое ниво се отключва
}

export interface CropDef {
  id: string; // = id на стоката
  time: number;
  seed: number; // цена на семената (монети)
  yield: number;
  level: number;
}

export const ITEMS: Record<string, ItemDef> = {};
const item = (id: string, name: string, kind: ItemKind, price: number, xp: number, level: number) => (ITEMS[id] = { id, name, kind, price, xp, level });

// --- култури ---
item('wheat', 'Пшеница', 'crop', 3, 1, 1);
item('corn', 'Царевица', 'crop', 6, 1, 2);
item('potato', 'Картофи', 'crop', 9, 2, 3);
item('carrot', 'Моркови', 'crop', 8, 2, 4);
item('beet', 'Цвекло', 'crop', 10, 2, 5);
item('beans', 'Смилянски фасул', 'crop', 16, 3, 6);
item('tomato', 'Домати', 'crop', 14, 3, 7);
item('pepper', 'Чушки', 'crop', 15, 3, 8);
item('sunflower', 'Слънчоглед', 'crop', 17, 3, 9);
item('pumpkin', 'Тиква', 'crop', 22, 4, 10);
item('cabbage', 'Зеле', 'crop', 18, 3, 11);
item('strawberry', 'Ягоди', 'crop', 26, 4, 12);
item('lavender', 'Лавандула', 'crop', 30, 5, 14);
item('herbs', 'Мурсалски чай', 'crop', 38, 6, 16);
item('onion', 'Лук', 'crop', 24, 4, 17);
item('cucumber', 'Краставици', 'crop', 26, 4, 18);
item('garlic', 'Чесън', 'crop', 30, 5, 19);
item('raspberry', 'Малини', 'crop', 34, 5, 21);
item('blueberry', 'Родопски боровинки', 'crop', 40, 6, 23);
item('watermelon', 'Дини', 'crop', 46, 7, 25);
item('eggplant', 'Патладжан', 'crop', 44, 6, 27);
item('rose', 'Маслодайна роза', 'crop', 52, 8, 29);
item('mint', 'Мента', 'crop', 48, 7, 32);
item('melon', 'Пъпеши', 'crop', 58, 8, 35);
item('mushroom', 'Гъби', 'crop', 62, 9, 38);
item('saffron', 'Шафран', 'crop', 90, 12, 43);

export const CROPS: Record<string, CropDef> = {};
const crop = (id: string, time: number, seed: number, yld: number) => (CROPS[id] = { id, time, seed, yield: yld, level: ITEMS[id].level });
crop('wheat', 60, 1, 2);
crop('corn', 180, 2, 2);
crop('potato', 420, 3, 2);
crop('carrot', 300, 3, 2);
crop('beet', 600, 4, 2);
crop('beans', 1200, 6, 2);
crop('tomato', 900, 5, 2);
crop('pepper', 1080, 5, 2);
crop('sunflower', 1500, 6, 2);
crop('pumpkin', 2400, 8, 2);
crop('cabbage', 1800, 6, 2);
crop('strawberry', 2700, 9, 2);
crop('lavender', 3600, 10, 2);
crop('herbs', 5400, 13, 2);
crop('onion', 2100, 7, 2);
crop('cucumber', 1500, 8, 2);
crop('garlic', 3000, 9, 2);
crop('raspberry', 3600, 11, 2);
crop('blueberry', 4500, 12, 2);
crop('watermelon', 5400, 14, 2);
crop('eggplant', 4200, 13, 2);
crop('rose', 6300, 16, 2);
crop('mint', 3600, 14, 2);
crop('melon', 6000, 17, 2);
crop('mushroom', 4800, 18, 2);
crop('saffron', 9000, 25, 2);

// --- плодове от дървета ---
item('apple', 'Ябълки', 'fruit', 20, 3, 7);
item('plum', 'Сливи', 'fruit', 24, 3, 9);
item('cherry', 'Череши', 'fruit', 30, 4, 12);
item('walnut', 'Орехи', 'fruit', 36, 5, 15);
item('pear', 'Круши', 'fruit', 34, 5, 20);
item('peach', 'Праскови', 'fruit', 40, 6, 24);
item('apricot', 'Кайсии', 'fruit', 44, 6, 28);
item('quince', 'Дюли', 'fruit', 52, 7, 34);
item('hazelnut', 'Лешници', 'fruit', 60, 8, 40);

// --- от животни ---
item('egg', 'Яйца', 'animal', 12, 2, 1);
item('milk', 'Мляко', 'animal', 24, 3, 5);
item('wool', 'Вълна', 'animal', 40, 5, 8);
item('honey', 'Мед', 'animal', 34, 4, 10);
item('goatmilk', 'Козе мляко', 'animal', 46, 6, 13);
item('duckegg', 'Патешки яйца', 'animal', 40, 5, 18);
item('truffle', 'Трюфели', 'animal', 85, 9, 22);
item('buffmilk', 'Биволско мляко', 'animal', 62, 8, 26);
item('llamawool', 'Вълна от лама', 'animal', 90, 10, 31);
item('trout', 'Пъстърва', 'animal', 95, 11, 36);

// --- фураж ---
item('feed_chicken', 'Храна за кокошки', 'feed', 4, 1, 1);
item('feed_cow', 'Храна за крави', 'feed', 8, 1, 5);
item('feed_sheep', 'Храна за овце', 'feed', 12, 1, 8);
item('feed_goat', 'Храна за кози', 'feed', 14, 1, 13);
item('feed_duck', 'Храна за патици', 'feed', 16, 1, 18);
item('feed_pig', 'Храна за прасета', 'feed', 18, 1, 22);
item('feed_buffalo', 'Храна за биволи', 'feed', 22, 1, 26);
item('feed_llama', 'Храна за лами', 'feed', 24, 1, 31);
item('feed_fish', 'Храна за риби', 'feed', 26, 1, 36);

// --- храни и стоки ---
item('bread', 'Хляб', 'food', 22, 3, 2);
item('cornbread', 'Царевичен хляб', 'food', 60, 6, 4);
item('banitsa', 'Баница', 'food', 140, 12, 7);
item('honeybread', 'Питка с мед', 'food', 110, 9, 10);
item('yogurt', 'Кисело мляко', 'food', 50, 5, 5);
item('cheese', 'Сирене', 'food', 70, 7, 6);
item('butter', 'Масло', 'food', 80, 7, 6);
item('kashkaval', 'Кашкавал', 'food', 120, 10, 9);
item('sugar', 'Захар', 'food', 45, 4, 7);
item('syrup', 'Сироп', 'food', 90, 7, 8);
item('yarn', 'Прежда', 'food', 95, 8, 9);
item('blanket', 'Родопско одеяло', 'food', 260, 20, 11);
item('socks', 'Вълнени чорапи', 'food', 170, 14, 10);
item('lyutenitsa', 'Лютеница', 'food', 120, 10, 11);
item('pickles', 'Туршия', 'food', 130, 11, 12);
item('jam', 'Сладко от ягоди', 'food', 150, 12, 13);
item('oil', 'Слънчогледово олио', 'food', 80, 7, 10);
item('baklava', 'Баклава', 'food', 240, 18, 15);
item('pumpkinpie', 'Тиквеник', 'food', 200, 16, 13);
item('cake', 'Торта с ягоди', 'food', 280, 22, 15);
item('tea', 'Билков чай', 'food', 160, 13, 16);
item('lavoil', 'Лавандулово масло', 'food', 190, 15, 15);
item('applejuice', 'Ябълков сок', 'food', 110, 9, 8);
item('compote', 'Компот от сливи', 'food', 120, 10, 10);
item('goatcheese', 'Козе сирене', 'food', 150, 12, 14);
item('walnutoil', 'Орехово масло', 'food', 180, 14, 17);
item('shopska', 'Шопска салата', 'food', 230, 18, 19);
item('tarator', 'Таратор', 'food', 220, 17, 20);
item('pearjuice', 'Крушов сок', 'food', 140, 11, 20);
item('patatnik', 'Пататник', 'food', 260, 20, 21);
item('kozunak', 'Козунак', 'food', 260, 20, 21);
item('icecream', 'Ягодов сладолед', 'food', 240, 19, 22);
item('raspcake', 'Малинова торта', 'food', 330, 26, 22);
item('kachamak', 'Качамак', 'food', 240, 19, 23);
item('bluejam', 'Сладко от боровинки', 'food', 190, 15, 23);
item('blueice', 'Боровинков сладолед', 'food', 260, 20, 23);
item('peachnectar', 'Прасковен нектар', 'food', 190, 15, 24);
item('muffins', 'Боровинкови мъфини', 'food', 260, 20, 24);
item('candle', 'Восъчна свещ', 'food', 120, 10, 24);
item('aromacandle', 'Ароматна свещ', 'food', 380, 28, 25);
item('sorbet', 'Динен сорбет', 'food', 210, 16, 25);
item('buffyogurt', 'Биволско кисело мляко', 'food', 110, 9, 26);
item('goatsoap', 'Сапун с козе мляко', 'food', 210, 16, 26);
item('kyopolu', 'Кьопоолу', 'food', 200, 16, 27);
item('imam', 'Имам баялдъ', 'food', 280, 22, 27);
item('lavsoap', 'Лавандулов сапун', 'food', 330, 25, 27);
item('apricotjam', 'Мармалад от кайсии', 'food', 200, 16, 28);
item('roseoil', 'Розово масло', 'food', 330, 25, 29);
item('rosewater', 'Розова вода', 'food', 150, 12, 29);
item('lokum', 'Локум с рози', 'food', 300, 23, 30);
item('rosesoap', 'Розов сапун', 'food', 420, 32, 30);
item('scarf', 'Шал от лама', 'food', 280, 22, 31);
item('sweater', 'Пуловер', 'food', 520, 40, 32);
item('minttea', 'Ментов чай', 'food', 200, 16, 32);
item('lemonade', 'Ментова лимонада', 'food', 180, 14, 32);
item('minticecream', 'Ментов сладолед', 'food', 270, 21, 32);
item('halva', 'Халва', 'food', 220, 17, 33);
item('jelly', 'Желирани бонбони', 'food', 200, 16, 33);
item('quincejam', 'Сладко от дюли', 'food', 230, 18, 34);
item('costume', 'Родопска носия', 'food', 900, 65, 36);
item('grilledtrout', 'Пъстърва на скара', 'food', 230, 18, 36);
item('fishsoup', 'Рибена чорба', 'food', 270, 21, 37);
item('mushsoup', 'Гъбена супа', 'food', 300, 23, 38);
item('truffleoil', 'Трюфелово масло', 'food', 260, 20, 39);
item('pralines', 'Бонбони с лешници', 'food', 340, 26, 40);
item('trufflepasta', 'Паста с трюфели', 'food', 420, 32, 41);
item('saffrontea', 'Шафранов чай', 'food', 320, 25, 43);
item('perfume', 'Розов парфюм', 'food', 950, 70, 44);
item('saffronoil', 'Шафраново масло', 'food', 360, 27, 45);
item('giftbasket', 'Подаръчна кошница', 'food', 1100, 80, 46);

export interface Recipe {
  out: string;
  qty: number;
  needs: Record<string, number>;
  time: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  model: string;
  size: number; // големина на модела (м)
  foot: [number, number]; // заемани клетки (ш × д)
  level: number;
  price: number;
  slots?: number; // колко неща може да се правят на опашка
  recipes?: Recipe[];
  kind: 'production' | 'storage' | 'animal' | 'special' | 'deco' | 'tree' | 'field' | 'pet';
  animal?: string;
  unique?: boolean;
  tint?: string; // пребоядисване на покрива/стените
}

export const BUILDINGS: Record<string, BuildingDef> = {};
const b = (d: BuildingDef) => (BUILDINGS[d.id] = d);

b({ id: 'field', name: 'Нива', desc: 'Тук се сее. Плъзни пръст по нивите, за да засееш или ожънеш много наведнъж.', model: '', size: 3, foot: [3, 3], level: 1, price: 0, kind: 'field' });

b({ id: 'feedmill', name: 'Фуражна мелница', desc: 'Прави храна за животните.', model: 'windmill', size: 8.5, foot: [6, 6], level: 1, price: 0, kind: 'production', slots: 3, unique: true, recipes: [
  { out: 'feed_chicken', qty: 3, needs: { wheat: 2, corn: 1 }, time: 120 },
  { out: 'feed_cow', qty: 3, needs: { corn: 2, potato: 1 }, time: 300 },
  { out: 'feed_sheep', qty: 3, needs: { wheat: 2, carrot: 2 }, time: 480 },
  { out: 'feed_goat', qty: 3, needs: { corn: 2, beet: 1 }, time: 600 },
  { out: 'feed_duck', qty: 3, needs: { corn: 2, cucumber: 1 }, time: 720 },
  { out: 'feed_pig', qty: 3, needs: { potato: 2, corn: 2 }, time: 840 },
  { out: 'feed_buffalo', qty: 3, needs: { corn: 2, cabbage: 1, wheat: 2 }, time: 900 },
  { out: 'feed_llama', qty: 3, needs: { carrot: 2, wheat: 2, beet: 1 }, time: 960 },
  { out: 'feed_fish', qty: 3, needs: { wheat: 2, corn: 2, carrot: 1 }, time: 1080 },
] });

b({ id: 'bakery', name: 'Пекарна', desc: 'Хляб, баница и питки.', model: 'house_med1', size: 7.5, foot: [6, 6], level: 2, price: 120, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'bread', qty: 1, needs: { wheat: 3 }, time: 180 },
  { out: 'cornbread', qty: 1, needs: { corn: 2, egg: 2 }, time: 900 },
  { out: 'banitsa', qty: 1, needs: { wheat: 2, egg: 2, cheese: 1 }, time: 2400 },
  { out: 'honeybread', qty: 1, needs: { wheat: 2, honey: 1, egg: 1 }, time: 1800 },
  { out: 'kozunak', qty: 1, needs: { wheat: 3, egg: 3, butter: 1, sugar: 1 }, time: 4800 },
] });

b({ id: 'dairy', name: 'Мандра', desc: 'Родопско кисело мляко, сирене, масло и кашкавал.', model: 'house_red2', size: 7.5, foot: [6, 6], level: 5, price: 600, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'yogurt', qty: 1, needs: { milk: 1 }, time: 600 },
  { out: 'cheese', qty: 1, needs: { milk: 2 }, time: 1200 },
  { out: 'butter', qty: 1, needs: { milk: 2 }, time: 1500 },
  { out: 'kashkaval', qty: 1, needs: { milk: 3 }, time: 3600 },
  { out: 'goatcheese', qty: 1, needs: { goatmilk: 2 }, time: 3000 },
  { out: 'buffyogurt', qty: 1, needs: { buffmilk: 1 }, time: 1500 },
] });

b({ id: 'sugarmill', name: 'Захарна фабрика', desc: 'Захар и сироп от цвекло.', model: 'sawmill', size: 8, foot: [6, 6], level: 7, price: 1400, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'sugar', qty: 1, needs: { beet: 3 }, time: 900 },
  { out: 'syrup', qty: 1, needs: { beet: 4, sugar: 1 }, time: 1800 },
] });

b({ id: 'juicer', name: 'Сокоизстисквачка', desc: 'Ябълков сок и компот.', model: 'house_wood', size: 6.5, foot: [5, 5], level: 8, price: 1800, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'applejuice', qty: 1, needs: { apple: 3 }, time: 1200 },
  { out: 'compote', qty: 1, needs: { plum: 3, sugar: 1 }, time: 1800 },
  { out: 'pearjuice', qty: 1, needs: { pear: 3 }, time: 1800 },
  { out: 'peachnectar', qty: 1, needs: { peach: 3, sugar: 1 }, time: 2400 },
  { out: 'lemonade', qty: 1, needs: { mint: 2, sugar: 1, honey: 1 }, time: 2400 },
] });

b({ id: 'loom', name: 'Тъкачница', desc: 'Прежда, чорапи и родопски одеяла (халища).', model: 'stable', size: 8, foot: [6, 6], level: 9, price: 2600, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'yarn', qty: 1, needs: { wool: 2 }, time: 1500 },
  { out: 'socks', qty: 1, needs: { yarn: 1, wool: 1 }, time: 2400 },
  { out: 'blanket', qty: 1, needs: { yarn: 2, wool: 1 }, time: 5400 },
] });

b({ id: 'oilpress', name: 'Маслобойна', desc: 'Слънчогледово олио.', model: 'mill', size: 9, foot: [6, 6], level: 10, price: 3200, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'oil', qty: 1, needs: { sunflower: 3 }, time: 1800 },
  { out: 'walnutoil', qty: 1, needs: { walnut: 3 }, time: 3000 },
] });

b({ id: 'cannery', name: 'Консервна работилница', desc: 'Лютеница, туршия и сладко — като на баба.', model: 'house_red1', size: 7.5, foot: [6, 6], level: 11, price: 4200, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'lyutenitsa', qty: 1, needs: { tomato: 2, pepper: 2, oil: 1 }, time: 3000 },
  { out: 'pickles', qty: 1, needs: { pepper: 1, carrot: 2, cabbage: 1 }, time: 3600 },
  { out: 'jam', qty: 1, needs: { strawberry: 3, sugar: 1 }, time: 3000 },
  { out: 'bluejam', qty: 1, needs: { blueberry: 3, sugar: 1 }, time: 3600 },
  { out: 'kyopolu', qty: 1, needs: { eggplant: 2, pepper: 2, garlic: 1 }, time: 3600 },
  { out: 'apricotjam', qty: 1, needs: { apricot: 3, sugar: 1 }, time: 3600 },
  { out: 'quincejam', qty: 1, needs: { quince: 2, sugar: 2 }, time: 4200 },
] });

b({ id: 'pastry', name: 'Сладкарница', desc: 'Баклава, тиквеник и торти.', model: 'inn', size: 8.5, foot: [7, 6], level: 13, price: 6500, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'pumpkinpie', qty: 1, needs: { pumpkin: 1, wheat: 2, sugar: 1 }, time: 3600 },
  { out: 'baklava', qty: 1, needs: { wheat: 2, walnut: 2, honey: 1, sugar: 1 }, time: 5400 },
  { out: 'cake', qty: 1, needs: { wheat: 2, egg: 2, strawberry: 2, sugar: 1 }, time: 5400 },
  { out: 'raspcake', qty: 1, needs: { wheat: 2, egg: 2, raspberry: 3, sugar: 1 }, time: 5400 },
  { out: 'muffins', qty: 1, needs: { wheat: 2, duckegg: 1, blueberry: 2, butter: 1 }, time: 3600 },
] });

b({ id: 'herbal', name: 'Билкарница', desc: 'Мурсалски чай и лавандулово масло.', model: 'blacksmith', size: 8, foot: [6, 6], level: 15, price: 9000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'tea', qty: 1, needs: { herbs: 2, honey: 1 }, time: 3600 },
  { out: 'lavoil', qty: 1, needs: { lavender: 3 }, time: 4200 },
  { out: 'minttea', qty: 1, needs: { mint: 2, honey: 1 }, time: 3600 },
  { out: 'saffrontea', qty: 1, needs: { saffron: 1, honey: 1, herbs: 1 }, time: 5400 },
] });

b({ id: 'kitchen', name: 'Механа', desc: 'Шопска салата, таратор, пататник и качамак — родопска кухня.', model: 'hut2', size: 8, foot: [6, 6], level: 19, price: 12000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'shopska', qty: 1, needs: { tomato: 2, cucumber: 2, onion: 1, cheese: 1 }, time: 2400 },
  { out: 'tarator', qty: 1, needs: { cucumber: 2, yogurt: 1, garlic: 1, walnut: 1 }, time: 2400 },
  { out: 'patatnik', qty: 1, needs: { potato: 3, egg: 2, onion: 1, butter: 1 }, time: 3600 },
  { out: 'kachamak', qty: 1, needs: { corn: 3, cheese: 1, butter: 1 }, time: 3000 },
  { out: 'imam', qty: 1, needs: { eggplant: 2, tomato: 2, onion: 1, oil: 1 }, time: 4200 },
] });

b({ id: 'icecream', name: 'Сладоледена', desc: 'Сладолед от прясно мляко и плодове.', model: 'house_toy', size: 6.5, foot: [6, 6], level: 22, price: 16000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'icecream', qty: 1, needs: { milk: 2, sugar: 1, strawberry: 2 }, time: 2400 },
  { out: 'blueice', qty: 1, needs: { milk: 2, sugar: 1, blueberry: 2 }, time: 2400 },
  { out: 'sorbet', qty: 1, needs: { watermelon: 2, sugar: 1 }, time: 1800 },
  { out: 'minticecream', qty: 1, needs: { milk: 2, sugar: 1, mint: 2 }, time: 2400 },
] });

b({ id: 'candles', name: 'Свещарница', desc: 'Свещи от пчелен восък.', model: 'b_kay2', size: 6, foot: [5, 5], level: 24, price: 20000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'candle', qty: 1, needs: { honey: 2 }, time: 1800 },
  { out: 'aromacandle', qty: 1, needs: { honey: 2, lavoil: 1 }, time: 3000 },
] });

b({ id: 'soap', name: 'Сапунарница', desc: 'Ръчно правени сапуни с козе мляко.', model: 'k_small', size: 6.5, foot: [6, 6], level: 26, price: 24000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'goatsoap', qty: 1, needs: { goatmilk: 2, oil: 1 }, time: 2400 },
  { out: 'lavsoap', qty: 1, needs: { goatmilk: 1, oil: 1, lavoil: 1 }, time: 3000 },
  { out: 'rosesoap', qty: 1, needs: { goatmilk: 1, oil: 1, roseoil: 1 }, time: 3600 },
] });

b({ id: 'rosedist', name: 'Розоварна', desc: 'Българско розово масло и розова вода.', model: 'structure', size: 8, foot: [6, 6], level: 29, price: 32000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'roseoil', qty: 1, needs: { rose: 4 }, time: 4800 },
  { out: 'rosewater', qty: 1, needs: { rose: 2 }, time: 1800 },
  { out: 'lokum', qty: 1, needs: { sugar: 2, rosewater: 1, walnut: 1 }, time: 3600 },
] });

b({ id: 'tailor', name: 'Шивачница', desc: 'Топли дрехи от вълна на лама и родопски носии.', model: 'houses_q', size: 8.5, foot: [7, 7], level: 31, price: 38000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'scarf', qty: 1, needs: { llamawool: 1, yarn: 1 }, time: 2400 },
  { out: 'sweater', qty: 1, needs: { llamawool: 2, yarn: 2 }, time: 5400 },
  { out: 'costume', qty: 1, needs: { blanket: 1, yarn: 2, llamawool: 1 }, time: 9000 },
] });

b({ id: 'sweets', name: 'Бонбонена фабрика', desc: 'Халва, желирани бонбони и бонбони с лешници.', model: 'b_kay1', size: 7, foot: [6, 6], level: 33, price: 45000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'halva', qty: 1, needs: { sunflower: 3, sugar: 1, honey: 1 }, time: 3000 },
  { out: 'jelly', qty: 1, needs: { raspberry: 2, sugar: 2 }, time: 2400 },
  { out: 'pralines', qty: 1, needs: { hazelnut: 2, milk: 1, sugar: 2 }, time: 4200 },
] });

b({ id: 'fishhouse', name: 'Рибна скара', desc: 'Родопска пъстърва на скара и рибена чорба.', model: 'hut3', size: 6.5, foot: [6, 6], level: 36, price: 52000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'grilledtrout', qty: 1, needs: { trout: 1, garlic: 1, oil: 1 }, time: 2400 },
  { out: 'fishsoup', qty: 1, needs: { trout: 1, potato: 2, carrot: 1, onion: 1 }, time: 3000 },
] });

b({ id: 'deli', name: 'Деликатеси', desc: 'Гъбена супа, трюфелово масло и паста с трюфели.', model: 'house_fantasy', size: 8.5, foot: [6, 6], level: 38, price: 62000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'mushsoup', qty: 1, needs: { mushroom: 3, onion: 1, butter: 1 }, time: 3000 },
  { out: 'truffleoil', qty: 1, needs: { truffle: 1, oil: 1 }, time: 3600 },
  { out: 'trufflepasta', qty: 1, needs: { wheat: 3, duckegg: 2, truffle: 1, cheese: 1 }, time: 5400 },
] });

b({ id: 'perfume', name: 'Парфюмерия', desc: 'Розов парфюм, шафраново масло и подаръчни кошници.', model: 'b_quat', size: 9, foot: [6, 6], level: 44, price: 90000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'perfume', qty: 1, needs: { roseoil: 2, lavoil: 1 }, time: 7200 },
  { out: 'saffronoil', qty: 1, needs: { saffron: 2, oil: 1 }, time: 5400 },
  { out: 'giftbasket', qty: 1, needs: { jam: 1, honey: 1, tea: 1, goatsoap: 1 }, time: 7200 },
] });

// склад
b({ id: 'barn', name: 'Хамбар', desc: 'Тук се пазят продуктите и храните.', model: 'barn_red', size: 9, foot: [7, 7], level: 1, price: 0, kind: 'storage', unique: true });
b({ id: 'silo', name: 'Силоз', desc: 'Тук се пазят зърното и зеленчуците.', model: 'silo_house', size: 9, foot: [5, 5], level: 1, price: 0, kind: 'storage', unique: true });

// специални
b({ id: 'house', name: 'Твоята къща', desc: 'Колкото по-хубава е къщата, толкова повече монети носи всеки ден.', model: 'house_cottage', size: 8, foot: [8, 8], level: 1, price: 0, kind: 'special', unique: true });
b({ id: 'board', name: 'Табло за поръчки', desc: 'Хората от селото поръчват стоки.', model: 'sign', size: 2.4, foot: [3, 2], level: 1, price: 0, kind: 'special', unique: true });
b({ id: 'market', name: 'Сергия', desc: 'Продавай стоките си на минувачите.', model: 'market2', size: 4.5, foot: [5, 4], level: 3, price: 150, kind: 'special', unique: true });
b({ id: 'garage', name: 'Гараж', desc: 'Колите ти. Купи нова кола и я покарай из селото!', model: 'barn_open', size: 7, foot: [7, 6], level: 3, price: 250, kind: 'special', unique: true });

// животни
b({ id: 'coop', name: 'Кокошарник', desc: 'Кокошките снасят яйца, когато са нахранени.', model: 'coop', size: 4.6, foot: [9, 8], level: 2, price: 80, kind: 'animal', animal: 'chicken' });
b({ id: 'cowshed', name: 'Обор', desc: 'Кравите дават мляко.', model: 'barn_small', size: 6.5, foot: [11, 9], level: 5, price: 500, kind: 'animal', animal: 'cow' });
b({ id: 'sheepfold', name: 'Кошара', desc: 'Овцете дават вълна.', model: 'hut', size: 5, foot: [10, 9], level: 8, price: 1200, kind: 'animal', animal: 'sheep' });
b({ id: 'beehive', name: 'Пчелин', desc: 'Пчелите правят мед сами — не искат храна.', model: 'water_tank', size: 0, foot: [6, 5], level: 10, price: 1800, kind: 'animal', animal: 'bee' });
b({ id: 'goatpen', name: 'Козарник', desc: 'Козите дават козе мляко.', model: 'cabin', size: 5.5, foot: [10, 9], level: 13, price: 3500, kind: 'animal', animal: 'goat' });
b({ id: 'duckpond', name: 'Патешко езеро', desc: 'Патиците плуват и снасят големи яйца.', model: '', size: 0, foot: [10, 9], level: 18, price: 9000, kind: 'animal', animal: 'duck' });
b({ id: 'pigsty', name: 'Кочина', desc: 'Прасетата ровят и намират скъпи трюфели!', model: 'barn', size: 6, foot: [11, 9], level: 22, price: 14000, kind: 'animal', animal: 'pig' });
b({ id: 'buffalopen', name: 'Биволарник', desc: 'Биволите дават гъсто биволско мляко.', model: 'barn_big', size: 7, foot: [12, 10], level: 26, price: 20000, kind: 'animal', animal: 'buffalo' });
b({ id: 'llamafarm', name: 'Лама ферма', desc: 'Ламите дават мека и топла вълна.', model: 'farm_q', size: 6, foot: [12, 10], level: 31, price: 30000, kind: 'animal', animal: 'llama' });
b({ id: 'fishpond', name: 'Рибарник', desc: 'Родопска пъстърва в студена планинска вода.', model: '', size: 0, foot: [10, 8], level: 36, price: 42000, kind: 'animal', animal: 'fish' });

// плодни дървета
b({ id: 'tree_apple', name: 'Ябълка', desc: 'Дава ябълки всеки час.', model: 'tree_b', size: 4.5, foot: [3, 3], level: 7, price: 220, kind: 'tree' });
b({ id: 'tree_plum', name: 'Слива', desc: 'Дава сливи.', model: 'tree_d', size: 4.5, foot: [3, 3], level: 9, price: 320, kind: 'tree' });
b({ id: 'tree_cherry', name: 'Череша', desc: 'Дава череши.', model: 'tree_b', size: 4.8, foot: [3, 3], level: 12, price: 480, kind: 'tree' });
b({ id: 'tree_walnut', name: 'Орех', desc: 'Дава орехи.', model: 'n_tree5', size: 6, foot: [3, 3], level: 15, price: 700, kind: 'tree' });
b({ id: 'tree_pear', name: 'Круша', desc: 'Дава сочни круши.', model: 'tree_a', size: 5, foot: [3, 3], level: 20, price: 1000, kind: 'tree' });
b({ id: 'tree_peach', name: 'Праскова', desc: 'Дава праскови.', model: 'tree_c', size: 4.8, foot: [3, 3], level: 24, price: 1400, kind: 'tree' });
b({ id: 'tree_apricot', name: 'Кайсия', desc: 'Дава кайсии.', model: 'tree_d', size: 4.6, foot: [3, 3], level: 28, price: 1800, kind: 'tree' });
b({ id: 'tree_quince', name: 'Дюля', desc: 'Дава ароматни дюли.', model: 'tree_autumn', size: 5, foot: [3, 3], level: 34, price: 2400, kind: 'tree' });
b({ id: 'tree_hazel', name: 'Лешник', desc: 'Дава лешници.', model: 'tree_b', size: 4.4, foot: [3, 3], level: 40, price: 3200, kind: 'tree' });

export const TREES: Record<string, { fruit: string; time: number; yield: number }> = {
  tree_apple: { fruit: 'apple', time: 3600, yield: 3 },
  tree_plum: { fruit: 'plum', time: 5400, yield: 3 },
  tree_cherry: { fruit: 'cherry', time: 7200, yield: 3 },
  tree_walnut: { fruit: 'walnut', time: 10800, yield: 3 },
  tree_pear: { fruit: 'pear', time: 5400, yield: 3 },
  tree_peach: { fruit: 'peach', time: 7200, yield: 3 },
  tree_apricot: { fruit: 'apricot', time: 7200, yield: 3 },
  tree_quince: { fruit: 'quince', time: 9000, yield: 3 },
  tree_hazel: { fruit: 'hazelnut', time: 10800, yield: 3 },
};

// украса
const deco = (id: string, name: string, model: string, size: number, foot: [number, number], level: number, price: number) =>
  b({ id, name, desc: 'Украса за фермата.', model, size, foot, level, price, kind: 'deco' });
deco('d_bench', 'Пейка', 'bench1', 2.4, [3, 2], 1, 30);
deco('d_well', 'Кладенец', 'well', 3.2, [3, 3], 2, 90);
deco('d_hay', 'Бали сено', 'hay', 1.6, [2, 2], 1, 15);
deco('d_barrel', 'Бъчва', 'barrel', 1.2, [1, 1], 1, 12);
deco('d_crate', 'Каса', 'crate', 1.1, [1, 1], 1, 10);
deco('d_cart', 'Каручка', 'cart', 3.4, [4, 2], 4, 160);
deco('d_fountain', 'Чешма-фонтан', 'fountain', 3.6, [4, 4], 6, 400);
deco('d_gazebo', 'Беседка', 'gazebo', 3.6, [4, 4], 5, 350);
deco('d_mailbox', 'Пощенска кутия', 'mailbox2', 1.4, [1, 1], 1, 25);
deco('d_flowers1', 'Лехa с цветя', 'n_flower_group1', 1.2, [2, 2], 1, 20);
deco('d_bush', 'Цъфнал храст', 'n_bush_flowers', 2, [2, 2], 2, 35);
deco('d_pine', 'Бор', 'n_pine4', 7, [3, 3], 3, 60);
deco('d_rock', 'Камък', 'n_rock1', 1.6, [2, 2], 1, 15);
deco('d_lavender', 'Лавандулов храст', 'n_plant_big2', 1.4, [2, 2], 4, 40);
deco('d_scarecrow', 'Плашило', 'm_farmer', 2.2, [1, 1], 3, 70);
deco('d_bench2', 'Дървена пейка', 'bench2', 2.4, [3, 2], 3, 60);
deco('d_bench3', 'Пейка в парка', 'bench3', 2.4, [3, 2], 5, 90);
deco('d_berries', 'Храст с плодове', 'bush_berries', 1.8, [2, 2], 6, 120);
deco('d_tent', 'Палатка', 'tent', 3, [3, 3], 7, 500);
deco('d_mushroom', 'Горски гъби', 'n_mushroom', 1, [1, 1], 8, 60);
deco('d_autumn', 'Есенно дърво', 'tree_autumn', 5, [3, 3], 10, 250);
deco('d_wagon', 'Каручка за сено', 'wagon', 3.4, [4, 2], 12, 900);
deco('d_windmill', 'Малка мелница', 'windmill2', 5, [4, 4], 18, 3000);
deco('d_stalls', 'Пазарни сергии', 'stalls', 8, [8, 6], 25, 8000);
deco('d_castle', 'Крепост', 'castle', 16, [16, 16], 45, 120000);

// любимци — тичат свободно из фермата
const pet = (id: string, name: string, model: string, size: number, level: number, price: number, desc: string) =>
  b({ id, name, desc, model, size, foot: [2, 2], level, price, kind: 'pet' });
pet('pet_dog', 'Куче Шиба', 'dog_shiba', 1.5, 3, 300, 'Весело куче, което тича из фермата.');
pet('pet_husky', 'Хъски', 'dog_husky', 1.7, 6, 700, 'Пухкаво хъски — пази фермата.');
pet('pet_donkey', 'Магаре', 'donkey', 2.4, 5, 900, 'Родопско магаре — пасе край нивите.');
pet('pet_horse', 'Кон', 'horse', 3, 9, 2000, 'Красив кафяв кон.');
pet('pet_whitehorse', 'Бял кон', 'horse_white', 3, 12, 3500, 'Бял кон — гордостта на фермата.');
pet('pet_alpaca', 'Алпака', 'alpaca', 2.4, 14, 4000, 'Смешна алпака.');
pet('pet_rooster', 'Петел', 'rooster', 1.2, 4, 150, 'Гордият петел на фермата — кукурига сутрин.');
pet('pet_goose', 'Гъска', 'goose', 1.3, 16, 1500, 'Важна гъска, която се разхожда навсякъде.');
pet('pet_deer', 'Сърна', 'deer', 2.2, 28, 6000, 'Кротка сърна от родопските гори.');
pet('pet_stag', 'Елен', 'stag', 3, 38, 12000, 'Величествен елен с големи рога.');
pet('pet_fox', 'Лисица', 'fox', 1.6, 44, 15000, 'Хитра, но добра лисица.');

// --- коли ---
export interface CarDef {
  id: string;
  name: string;
  model: string;
  size: number;
  level: number;
  price: number;
  speed: number; // макс. скорост км/ч (за каране)
  bonus: string;
  diamonds?: number;
  color?: string;
}
export const CARS: CarDef[] = [
  { id: 'moto', name: 'Стар мотор с кош', model: 'retro_moto', size: 2.39, level: 3, price: 600, speed: 90, bonus: 'Бърз и забавен за каране из селото.' },
  { id: 'hatch', name: 'Малка кола „Бръмбарче“', model: 'retro_mini', size: 3.78, level: 4, price: 1500, speed: 100, bonus: '+5 монети на всяка поръчка.' },
  { id: 'pickup', name: 'Стар син пикап', model: 'retro_pickup', size: 5.28, level: 6, price: 3000, speed: 120, bonus: 'Поръчките носят +5% монети.' },
  { id: 'tractor', name: 'Трактор', model: 'tractor1', size: 4.6, level: 8, price: 5000, speed: 45, bonus: 'Културите растат с 10% по-бързо.' },
  { id: 'pickup_red', name: 'Червен пикап с дървена каросерия', model: 'retro_pickup_red', size: 5.28, level: 9, price: 4500, speed: 115, bonus: 'Поръчките носят +5% монети.' },
  { id: 'sedan', name: 'Стар седан', model: 'retro_sedan', size: 4.37, level: 10, price: 7000, speed: 140, bonus: '+3 опит на всяка поръчка.' },
  { id: 'van', name: 'Ретро бусче', model: 'retro_van', size: 4.54, level: 11, price: 9000, speed: 110, bonus: '+5 монети на всяка поръчка.' },
  { id: 'suv', name: 'Стар джип', model: 'retro_jeep', size: 4.43, level: 12, price: 11000, speed: 130, bonus: 'Минава навсякъде. Поръчките носят +5% монети.' },
  { id: 'truck', name: 'Стар камион', model: 'retro_truck', size: 6.77, level: 14, price: 16000, speed: 100, bonus: 'Поръчките носят +10% монети.' },
  { id: 'taxi', name: 'Жълто такси', model: 'retro_taxi', size: 4.37, level: 15, price: 14000, speed: 140, bonus: 'Посетителите плащат с 10% повече.' },
  { id: 'classic', name: 'Голям седан от 50-те', model: 'retro_classic', size: 5.21, level: 16, price: 22000, speed: 160, bonus: '+3 опит на всяка поръчка.' },
  { id: 'bus', name: 'Стар автобус', model: 'retro_bus', size: 9.78, level: 17, price: 30000, speed: 90, bonus: 'Посетителите плащат с 5% повече.' },
  { id: 'sport', name: 'Червен кабриолет', model: 'retro_roadster', size: 4.51, level: 18, price: 40000, speed: 200, bonus: 'Най-бързата кола в Родопите!' },
  { id: 'sport2', name: 'Бял кабриолет', model: 'retro_roadster_white', size: 4.51, level: 20, price: 10, diamonds: 120, speed: 220, bonus: 'Само за диаманти. Летиш по пътя!' },
  { id: 'classic_red', name: 'Червен седан от 50-те', model: 'retro_classic_red', size: 5.21, level: 22, price: 20000, speed: 160, bonus: '+10 монети на всяка поръчка.' },
  { id: 'van_blue', name: 'Синьо бусче за пикник', model: 'retro_van_blue', size: 4.54, level: 26, price: 28000, speed: 110, bonus: 'Поръчките носят +5% монети.' },
  { id: 'jeep_white', name: 'Бял джип за сафари', model: 'retro_jeep_white', size: 4.43, level: 30, price: 36000, speed: 140, bonus: '+5 опит на всяка поръчка.' },
  { id: 'bus_blue', name: 'Синият автобус на селото', model: 'retro_bus_blue', size: 9.78, level: 34, price: 50000, speed: 95, bonus: 'Поръчките носят +5% монети.' },
  { id: 'truck_red', name: 'Червен камион', model: 'retro_truck_red', size: 6.77, level: 38, price: 70000, speed: 105, bonus: 'Поръчките носят +10% монети.' },
  { id: 'sport_gold', name: 'Златен кабриолет', model: 'retro_roadster_gold', size: 4.51, level: 45, price: 10, diamonds: 250, speed: 240, bonus: 'Само за диаманти. Най-лъскавата кола в Родопите!' },
];

// --- къщата ти (подобрения) ---
export const HOME_TIERS = [
  { name: 'Малка вила', model: 'house_cottage', size: 8, level: 1, price: 0, daily: 20 },
  { name: 'Родопска къща', model: 'house_red1', size: 8.5, level: 4, price: 1500, daily: 60 },
  { name: 'Каменна къща', model: 'house_med2', size: 9.5, level: 8, price: 6000, daily: 150 },
  { name: 'Голяма къща с веранда', model: 'house_porch', size: 11, level: 12, price: 18000, daily: 320 },
  { name: 'Имение', model: 'townhouse2', size: 12, level: 16, price: 50000, daily: 700 },
  { name: 'Приказна къща', model: 'house_fantasy', size: 11, level: 21, price: 80000, daily: 1100 },
  { name: 'Бяла вила', model: 'house_white', size: 11, level: 27, price: 140000, daily: 1800 },
  { name: 'Голям дом', model: 'townhouse1', size: 12.5, level: 33, price: 230000, daily: 2800 },
  { name: 'Градски дом', model: 'b_quat', size: 13, level: 40, price: 380000, daily: 4200 },
  { name: 'Дворец', model: 'b_quat_big', size: 13, level: 48, price: 600000, daily: 6500 },
];

/** Ремонти на къщите в селото — всеки вдига наема. Ниво = нивото на къщата + lvAdd. */
export const VILLAGE_UPGRADES = [
  { name: 'Ремонт', mult: 1.4, cost: 0.6, lvAdd: 6 },
  { name: 'Нова фасада и покрив', mult: 1.8, cost: 1.2, lvAdd: 12 },
  { name: 'Луксозен ремонт', mult: 2.4, cost: 2.2, lvAdd: 18 },
];

// --- къщи в селото (купуваш и взимаш наем) ---
export const VILLAGE_HOUSES = [
  { name: 'Малка къщичка', model: 'house_wood', size: 7, level: 3, price: 900, rent: 30 },
  { name: 'Къща с червен покрив', model: 'house_red2', size: 8.5, level: 5, price: 2200, rent: 70 },
  { name: 'Дървена вила', model: 'cabin', size: 8, level: 6, price: 3500, rent: 100 },
  { name: 'Къща за гости', model: 'house_fantasy', size: 9, level: 8, price: 6000, rent: 160 },
  { name: 'Родопска къща', model: 'house_red1', size: 8.5, level: 9, price: 8000, rent: 210 },
  { name: 'Каменна къща', model: 'house_med2', size: 9.5, level: 11, price: 12000, rent: 300 },
  { name: 'Странноприемница', model: 'inn', size: 10, level: 12, price: 16000, rent: 400 },
  { name: 'Бяла къща', model: 'house_white', size: 10, level: 13, price: 22000, rent: 520 },
  { name: 'Голяма къща', model: 'house_porch', size: 11, level: 15, price: 30000, rent: 700 },
  { name: 'Градска къща', model: 'townhouse2', size: 11, level: 17, price: 45000, rent: 1000 },
  { name: 'Хотел', model: 'townhouse1', size: 13, level: 19, price: 70000, rent: 1500 },
  { name: 'Камбанария', model: 'bell_tower', size: 13, level: 20, price: 100000, rent: 2100 },
];

// --- земя за разширяване ---
export interface LandDef {
  id: string;
  rect: [number, number, number, number]; // minX, minZ, maxX, maxZ
  level: number;
  price: number;
}
export const START_LAND: [number, number, number, number] = [-22, -16, 24, 26];
export const LANDS: LandDef[] = [
  { id: 'east', rect: [24, -16, 40, 26], level: 3, price: 400 },
  { id: 'west', rect: [-40, -16, -22, 26], level: 5, price: 1200 },
  { id: 'north', rect: [-22, -30, 24, -16], level: 7, price: 3000 },
  { id: 'ne', rect: [24, -30, 40, -16], level: 9, price: 5000 },
  { id: 'nw', rect: [-40, -30, -22, -16], level: 11, price: 8000 },
  // на север е гарата на теснолинейката — фермата расте на изток, към селото
  { id: 'e2n', rect: [40, -30, 54, -10], level: 14, price: 12000 },
  { id: 'e2', rect: [40, -10, 54, 8], level: 20, price: 22000 },
  { id: 'e2s', rect: [40, 8, 54, 26], level: 28, price: 40000 },
];

// --- нива ---
export function xpForLevel(lv: number) {
  return Math.round(12 * Math.pow(lv, 1.85) + 15 * lv);
}

/** Какво се отключва на всяко ниво (за прозореца „Ново ниво!“). */
export function unlocksAt(lv: number) {
  const out: { name: string; icon: string }[] = [];
  for (const it of Object.values(ITEMS)) if (it.level === lv && (it.kind === 'crop' || it.kind === 'fruit')) out.push({ name: it.name, icon: it.id });
  for (const bd of Object.values(BUILDINGS)) if (bd.level === lv && bd.price > 0) out.push({ name: bd.name, icon: 'b:' + bd.id });
  for (const c of CARS) if (c.level === lv) out.push({ name: c.name, icon: 'car:' + c.id });
  for (const h of HOME_TIERS) if (h.level === lv && h.price > 0) out.push({ name: h.name, icon: 'home' });
  for (const l of LANDS) if (l.level === lv) out.push({ name: 'Нова земя', icon: 'land' });
  return out;
}

export const MAX_ANIMALS: Record<string, number> = { chicken: 6, cow: 4, sheep: 4, bee: 3, goat: 4, duck: 6, pig: 4, buffalo: 4, llama: 4, fish: 6 };
export const ANIMALS: Record<string, { name: string; feed: string | null; product: string; time: number; price: number; model: string; size: number }> = {
  chicken: { name: 'Кокошка', feed: 'feed_chicken', product: 'egg', time: 600, price: 40, model: 'hen', size: 1.3 },
  cow: { name: 'Крава', feed: 'feed_cow', product: 'milk', time: 1800, price: 250, model: 'cow', size: 2.9 },
  sheep: { name: 'Овца', feed: 'feed_sheep', product: 'wool', time: 3600, price: 600, model: 'sheep', size: 2.1 },
  bee: { name: 'Кошер', feed: null, product: 'honey', time: 2700, price: 500, model: '', size: 1 },
  goat: { name: 'Коза', feed: 'feed_goat', product: 'goatmilk', time: 4200, price: 1200, model: 'goat1', size: 1.8 },
  duck: { name: 'Патица', feed: 'feed_duck', product: 'duckegg', time: 2400, price: 1600, model: 'duck', size: 1.0 },
  pig: { name: 'Прасе', feed: 'feed_pig', product: 'truffle', time: 4800, price: 2500, model: 'pig', size: 1.8 },
  buffalo: { name: 'Бивол', feed: 'feed_buffalo', product: 'buffmilk', time: 5400, price: 3800, model: 'bull', size: 3.0 },
  llama: { name: 'Лама', feed: 'feed_llama', product: 'llamawool', time: 6600, price: 5000, model: 'llama', size: 2.4 },
  fish: { name: 'Пъстърва', feed: 'feed_fish', product: 'trout', time: 7200, price: 4000, model: 'fish', size: 0.9 },
};

// --- постижения (всяко има 4 нива; наградата е в диаманти) ---
export interface AchDef { id: string; name: string; desc: string; icon: string; tiers: number[]; reward: number[] }
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'harvested', name: 'Жътвар', desc: 'Ожъни {n} култури', icon: 'wheat', tiers: [20, 150, 800, 3000, 10000, 30000], reward: [2, 4, 8, 15, 25, 40] },
  { id: 'produced', name: 'Майстор', desc: 'Произведи {n} стоки', icon: 'bread', tiers: [10, 60, 300, 1200, 4000, 12000], reward: [2, 4, 8, 15, 25, 40] },
  { id: 'orders', name: 'Доставчик', desc: 'Изпълни {n} поръчки', icon: 'b:board', tiers: [5, 30, 120, 500, 1500, 4000], reward: [2, 5, 10, 20, 30, 50] },
  { id: 'visitors', name: 'Добър съсед', desc: 'Обслужи {n} посетители', icon: 'coin', tiers: [3, 15, 60, 250, 800, 2000], reward: [2, 4, 8, 15, 25, 40] },
  { id: 'earned', name: 'Богаташ', desc: 'Спечели {n} монети', icon: 'coin', tiers: [2000, 20000, 200000, 1000000, 5000000, 20000000], reward: [3, 6, 12, 25, 40, 60] },
  { id: 'houses', name: 'Хазяин', desc: 'Купи {n} къщи в селото', icon: 'm:house_red2', tiers: [1, 3, 6, 12], reward: [3, 6, 12, 30] },
  { id: 'cars', name: 'Шофьор', desc: 'Купи {n} коли', icon: 'car:pickup', tiers: [1, 3, 6, 10, 14], reward: [3, 6, 12, 30, 50] },
  { id: 'level', name: 'Опитен фермер', desc: 'Стигни ниво {n}', icon: 'star', tiers: [5, 10, 15, 20, 30, 40, 50], reward: [5, 10, 15, 25, 40, 60, 100] },
  { id: 'helps', name: 'Добър приятел', desc: 'Помогни на приятели {n} пъти', icon: 'heart', tiers: [5, 25, 100, 400], reward: [3, 6, 12, 25] },
  { id: 'traded', name: 'Търговец', desc: 'Продай {n} пъти на други играчи', icon: 'b:market', tiers: [3, 15, 60, 200], reward: [3, 6, 12, 25] },
];
