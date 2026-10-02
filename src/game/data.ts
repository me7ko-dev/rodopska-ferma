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

// --- плодове от дървета ---
item('apple', 'Ябълки', 'fruit', 20, 3, 7);
item('plum', 'Сливи', 'fruit', 24, 3, 9);
item('cherry', 'Череши', 'fruit', 30, 4, 12);
item('walnut', 'Орехи', 'fruit', 36, 5, 15);

// --- от животни ---
item('egg', 'Яйца', 'animal', 12, 2, 2);
item('milk', 'Мляко', 'animal', 24, 3, 5);
item('wool', 'Вълна', 'animal', 40, 5, 8);
item('honey', 'Мед', 'animal', 34, 4, 10);
item('goatmilk', 'Козе мляко', 'animal', 46, 6, 13);

// --- фураж ---
item('feed_chicken', 'Храна за кокошки', 'feed', 4, 1, 2);
item('feed_cow', 'Храна за крави', 'feed', 8, 1, 5);
item('feed_sheep', 'Храна за овце', 'feed', 12, 1, 8);
item('feed_goat', 'Храна за кози', 'feed', 14, 1, 13);

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
item('baklava', 'Баклава', 'food', 240, 18, 14);
item('pumpkinpie', 'Тиквеник', 'food', 200, 16, 13);
item('cake', 'Торта с ягоди', 'food', 280, 22, 15);
item('tea', 'Билков чай', 'food', 160, 13, 16);
item('lavoil', 'Лавандулово масло', 'food', 190, 15, 15);
item('applejuice', 'Ябълков сок', 'food', 110, 9, 8);
item('compote', 'Компот от сливи', 'food', 120, 10, 10);

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
] });

b({ id: 'bakery', name: 'Пекарна', desc: 'Хляб, баница и питки.', model: 'house_med1', size: 7.5, foot: [6, 6], level: 2, price: 120, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'bread', qty: 1, needs: { wheat: 3 }, time: 180 },
  { out: 'cornbread', qty: 1, needs: { corn: 2, egg: 2 }, time: 900 },
  { out: 'banitsa', qty: 1, needs: { wheat: 2, egg: 2, cheese: 1 }, time: 2400 },
  { out: 'honeybread', qty: 1, needs: { wheat: 2, honey: 1, egg: 1 }, time: 1800 },
] });

b({ id: 'dairy', name: 'Мандра', desc: 'Родопско кисело мляко, сирене, масло и кашкавал.', model: 'house_red2', size: 7.5, foot: [6, 6], level: 5, price: 600, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'yogurt', qty: 1, needs: { milk: 1 }, time: 600 },
  { out: 'cheese', qty: 1, needs: { milk: 2 }, time: 1200 },
  { out: 'butter', qty: 1, needs: { milk: 2 }, time: 1500 },
  { out: 'kashkaval', qty: 1, needs: { milk: 3 }, time: 3600 },
] });

b({ id: 'sugarmill', name: 'Захарна фабрика', desc: 'Захар и сироп от цвекло.', model: 'sawmill', size: 8, foot: [6, 6], level: 7, price: 1400, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'sugar', qty: 1, needs: { beet: 3 }, time: 900 },
  { out: 'syrup', qty: 1, needs: { beet: 4, sugar: 1 }, time: 1800 },
] });

b({ id: 'juicer', name: 'Сокоизстисквачка', desc: 'Ябълков сок и компот.', model: 'house_wood', size: 6.5, foot: [5, 5], level: 8, price: 1800, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'applejuice', qty: 1, needs: { apple: 3 }, time: 1200 },
  { out: 'compote', qty: 1, needs: { plum: 3, sugar: 1 }, time: 1800 },
] });

b({ id: 'loom', name: 'Тъкачница', desc: 'Прежда, чорапи и родопски одеяла (халища).', model: 'stable', size: 8, foot: [6, 6], level: 9, price: 2600, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'yarn', qty: 1, needs: { wool: 2 }, time: 1500 },
  { out: 'socks', qty: 1, needs: { yarn: 1, wool: 1 }, time: 2400 },
  { out: 'blanket', qty: 1, needs: { yarn: 2, wool: 1 }, time: 5400 },
] });

b({ id: 'oilpress', name: 'Маслобойна', desc: 'Слънчогледово олио.', model: 'mill', size: 9, foot: [6, 6], level: 10, price: 3200, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'oil', qty: 1, needs: { sunflower: 3 }, time: 1800 },
] });

b({ id: 'cannery', name: 'Консервна работилница', desc: 'Лютеница, туршия и сладко — като на баба.', model: 'house_red1', size: 7.5, foot: [6, 6], level: 11, price: 4200, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'lyutenitsa', qty: 1, needs: { tomato: 2, pepper: 2, oil: 1 }, time: 3000 },
  { out: 'pickles', qty: 1, needs: { pepper: 1, carrot: 2, cabbage: 1 }, time: 3600 },
  { out: 'jam', qty: 1, needs: { strawberry: 3, sugar: 1 }, time: 3000 },
] });

b({ id: 'pastry', name: 'Сладкарница', desc: 'Баклава, тиквеник и торти.', model: 'inn', size: 8.5, foot: [7, 6], level: 13, price: 6500, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'pumpkinpie', qty: 1, needs: { pumpkin: 1, wheat: 2, sugar: 1 }, time: 3600 },
  { out: 'baklava', qty: 1, needs: { wheat: 2, walnut: 2, honey: 1, sugar: 1 }, time: 5400 },
  { out: 'cake', qty: 1, needs: { wheat: 2, egg: 2, strawberry: 2, sugar: 1 }, time: 5400 },
] });

b({ id: 'herbal', name: 'Билкарница', desc: 'Мурсалски чай и лавандулово масло.', model: 'blacksmith', size: 8, foot: [6, 6], level: 15, price: 9000, kind: 'production', slots: 2, unique: true, recipes: [
  { out: 'tea', qty: 1, needs: { herbs: 2, honey: 1 }, time: 3600 },
  { out: 'lavoil', qty: 1, needs: { lavender: 3 }, time: 4200 },
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

// плодни дървета
b({ id: 'tree_apple', name: 'Ябълка', desc: 'Дава ябълки всеки час.', model: 'tree_b', size: 4.5, foot: [3, 3], level: 7, price: 220, kind: 'tree' });
b({ id: 'tree_plum', name: 'Слива', desc: 'Дава сливи.', model: 'tree_d', size: 4.5, foot: [3, 3], level: 9, price: 320, kind: 'tree' });
b({ id: 'tree_cherry', name: 'Череша', desc: 'Дава череши.', model: 'tree_b', size: 4.8, foot: [3, 3], level: 12, price: 480, kind: 'tree' });
b({ id: 'tree_walnut', name: 'Орех', desc: 'Дава орехи.', model: 'n_tree5', size: 6, foot: [3, 3], level: 15, price: 700, kind: 'tree' });

export const TREES: Record<string, { fruit: string; time: number; yield: number }> = {
  tree_apple: { fruit: 'apple', time: 3600, yield: 3 },
  tree_plum: { fruit: 'plum', time: 5400, yield: 3 },
  tree_cherry: { fruit: 'cherry', time: 7200, yield: 3 },
  tree_walnut: { fruit: 'walnut', time: 10800, yield: 3 },
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

// любимци — тичат свободно из фермата
const pet = (id: string, name: string, model: string, size: number, level: number, price: number, desc: string) =>
  b({ id, name, desc, model, size, foot: [2, 2], level, price, kind: 'pet' });
pet('pet_dog', 'Куче Шиба', 'dog_shiba', 1.5, 3, 300, 'Весело куче, което тича из фермата.');
pet('pet_husky', 'Хъски', 'dog_husky', 1.7, 6, 700, 'Пухкаво хъски — пази фермата.');
pet('pet_donkey', 'Магаре', 'donkey', 2.4, 5, 900, 'Родопско магаре — пасе край нивите.');
pet('pet_horse', 'Кон', 'horse', 3, 9, 2000, 'Красив кафяв кон.');
pet('pet_whitehorse', 'Бял кон', 'horse_white', 3, 12, 3500, 'Бял кон — гордостта на фермата.');
pet('pet_alpaca', 'Алпака', 'alpaca', 2.4, 14, 4000, 'Смешна алпака.');

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
  { id: 'moto', name: 'Мотор „Лилавата светкавица“', model: 'motorcycle', size: 2.4, level: 3, price: 600, speed: 90, bonus: 'Бърз и забавен за каране из селото.' },
  { id: 'hatch', name: 'Червен хечбек', model: 'car_hatch', size: 4.2, level: 4, price: 1500, speed: 110, bonus: '+5 монети на всяка поръчка.' },
  { id: 'pickup', name: 'Син пикап', model: 'car_pickup', size: 5.4, level: 6, price: 3000, speed: 120, bonus: 'Поръчките носят +5% монети.' },
  { id: 'tractor', name: 'Трактор', model: 'tractor1', size: 4.6, level: 8, price: 5000, speed: 45, bonus: 'Културите растат с 10% по-бързо.' },
  { id: 'sedan', name: 'Седан', model: 'car_sedan1', size: 4.8, level: 10, price: 7000, speed: 160, bonus: '+3 опит на всяка поръчка.' },
  { id: 'suv', name: 'Джип', model: 'car_suv', size: 5, level: 12, price: 11000, speed: 170, bonus: 'Минава навсякъде. Поръчките носят +5% монети.' },
  { id: 'truck', name: 'Камион за доставки', model: 'car_truck', size: 6.8, level: 14, price: 16000, speed: 110, bonus: 'Поръчките носят +10% монети.' },
  { id: 'taxi', name: 'Такси', model: 'car_taxi', size: 4.8, level: 15, price: 14000, speed: 160, bonus: 'Посетителите плащат с 10% повече.' },
  { id: 'sport', name: 'Спортна кола', model: 'car_sport2', size: 4.8, level: 18, price: 40000, speed: 240, bonus: 'Най-бързата кола в Родопите!' },
  { id: 'sport2', name: 'Бяла спортна кола', model: 'car_sport1', size: 4.8, level: 20, price: 10, diamonds: 120, speed: 260, bonus: 'Само за диаманти. Летиш по пътя!' },
];

// --- къщата ти (подобрения) ---
export const HOME_TIERS = [
  { name: 'Малка вила', model: 'house_cottage', size: 8, level: 1, price: 0, daily: 20 },
  { name: 'Родопска къща', model: 'house_red1', size: 8.5, level: 4, price: 1500, daily: 60 },
  { name: 'Каменна къща', model: 'house_med2', size: 9.5, level: 8, price: 6000, daily: 150 },
  { name: 'Голяма къща с веранда', model: 'house_porch', size: 11, level: 12, price: 18000, daily: 320 },
  { name: 'Имение', model: 'townhouse2', size: 12, level: 16, price: 50000, daily: 700 },
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

export const MAX_ANIMALS: Record<string, number> = { chicken: 6, cow: 4, sheep: 4, bee: 3, goat: 4 };
export const ANIMALS: Record<string, { name: string; feed: string | null; product: string; time: number; price: number; model: string; size: number }> = {
  chicken: { name: 'Кокошка', feed: 'feed_chicken', product: 'egg', time: 600, price: 40, model: 'hen', size: 1.3 },
  cow: { name: 'Крава', feed: 'feed_cow', product: 'milk', time: 1800, price: 250, model: 'cow', size: 2.9 },
  sheep: { name: 'Овца', feed: 'feed_sheep', product: 'wool', time: 3600, price: 600, model: 'sheep', size: 2.1 },
  bee: { name: 'Кошер', feed: null, product: 'honey', time: 2700, price: 500, model: '', size: 1 },
  goat: { name: 'Коза', feed: 'feed_goat', product: 'goatmilk', time: 4200, price: 1200, model: 'goat1', size: 1.8 },
};

// --- постижения (всяко има 4 нива; наградата е в диаманти) ---
export interface AchDef { id: string; name: string; desc: string; icon: string; tiers: number[]; reward: number[] }
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'harvested', name: 'Жътвар', desc: 'Ожъни {n} култури', icon: 'wheat', tiers: [20, 150, 800, 3000], reward: [2, 4, 8, 15] },
  { id: 'produced', name: 'Майстор', desc: 'Произведи {n} стоки', icon: 'bread', tiers: [10, 60, 300, 1200], reward: [2, 4, 8, 15] },
  { id: 'orders', name: 'Доставчик', desc: 'Изпълни {n} поръчки', icon: 'b:board', tiers: [5, 30, 120, 500], reward: [2, 5, 10, 20] },
  { id: 'visitors', name: 'Добър съсед', desc: 'Обслужи {n} посетители', icon: 'coin', tiers: [3, 15, 60, 250], reward: [2, 4, 8, 15] },
  { id: 'earned', name: 'Богаташ', desc: 'Спечели {n} монети', icon: 'coin', tiers: [2000, 20000, 200000, 1000000], reward: [3, 6, 12, 25] },
  { id: 'houses', name: 'Хазяин', desc: 'Купи {n} къщи в селото', icon: 'm:house_red2', tiers: [1, 3, 6, 12], reward: [3, 6, 12, 30] },
  { id: 'cars', name: 'Шофьор', desc: 'Купи {n} коли', icon: 'car:pickup', tiers: [1, 3, 6, 10], reward: [3, 6, 12, 30] },
  { id: 'level', name: 'Опитен фермер', desc: 'Стигни ниво {n}', icon: 'star', tiers: [5, 10, 15, 20], reward: [5, 10, 15, 25] },
];
