// Разположение на света (в метри). X — изток, Z — юг. Фермата е в центъра, пътят минава на юг, селото е на изток.
import { fbm, smooth, clamp } from '../engine/noise';

/** Цялата земя на фермата (с разширенията). */
export const FARM = { minX: -40, maxX: 54, minZ: -30, maxZ: 26 };
/** Мрежа: 1 клетка = 1 метър. */
export const CELL = 1;

/** Главният път (асфалт) минава по z = ROAD_Z от запад на изток. */
export const ROAD_Z = 33;
export const ROAD_W = 7;
/** Отбивката от пътя до фермата. */
export const DRIVE = { x: 6, w: 4.5 };

/** Парцелите в селото (къщи за купуване) — от двете страни на пътя на изток. */
export const VILLAGE_PLOTS: { x: number; z: number; rot: number }[] = [];
for (let i = 0; i < 6; i++) {
  VILLAGE_PLOTS.push({ x: 62 + i * 17, z: ROAD_Z - 13, rot: 0 });
  VILLAGE_PLOTS.push({ x: 70 + i * 17, z: ROAD_Z + 13, rot: Math.PI });
}

/** Езерото с патиците. */
export const POND = { x: -56, z: 0, rx: 8.5, rz: 6 };

/** Плоската зона (ферма + село); извън нея почват родопските хълмове. */
const FLAT = { minX: -75, maxX: 175, minZ: -62, maxZ: 62 };
/** Големият град — на изток, в широката долина след селото. */
export const CITY = { minX: 205, maxX: 472, minZ: -36, maxZ: 112 };
const CITY_FLAT = { minX: 165, maxX: 485, minZ: -66, maxZ: 128 };

/** Теснолинейката минава по северния край на долината (z = RAIL_Z), между два тунела. */
export const RAIL_Z = -52;
export const RAIL = { west: -135, east: 530 };
/** Гарите: до фермата и в града (x на средата на перона). */
export const STATIONS = [
  { x: 28, name: 'РОДОПИ', city: false },
  { x: 330, name: 'ЦЕНТРАЛНА ГАРА', city: true },
];

function rectDist(r: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

function flatDist(x: number, z: number) {
  return Math.min(rectDist(FLAT, x, z), rectDist(CITY_FLAT, x, z));
}

/** Височина на терена. В плоската зона е 0; навън се издигат хълмове и планини. */
export function heightAt(x: number, z: number) {
  const d = flatDist(x, z);
  if (d <= 0) return 0;
  const rise = smooth(0, 70, d);
  const hills = fbm(x * 0.008 + 11.3, z * 0.008 - 4.1, 5);
  const ridge = 1 - Math.abs(fbm(x * 0.0035 - 2, z * 0.0035 + 7, 4) * 2 - 1);
  const far = smooth(60, 420, d);
  const h = rise * (hills * 26 + d * 0.08) + far * (ridge * ridge * 150 + hills * 40);
  // пътят продължава през хълмовете — изравняваме терена около него
  const road = 1 - smooth(ROAD_W * 0.6, ROAD_W * 2.2, Math.abs(z - roadZAt(x)));
  // коридор за релсите — до самите тунели теренът е равен
  const rail = (1 - smooth(9, 30, Math.abs(z - RAIL_Z))) * smooth(RAIL.west - 5, RAIL.west, x) * (1 - smooth(RAIL.east, RAIL.east + 5, x));
  return h * (1 - road * clamp(1 - d / 600, 0, 1) * 0.92) * (1 - rail);
}

/** Височина без коридора на релсите (за да намерим къде планината е достатъчно висока за тунел). */
export function rawHeight(x: number, z: number) {
  const d = flatDist(x, z);
  if (d <= 0) return 0;
  const rise = smooth(0, 70, d);
  const hills = fbm(x * 0.008 + 11.3, z * 0.008 - 4.1, 5);
  const ridge = 1 - Math.abs(fbm(x * 0.0035 - 2, z * 0.0035 + 7, 4) * 2 - 1);
  const far = smooth(60, 420, d);
  return rise * (hills * 26 + d * 0.08) + far * (ridge * ridge * 150 + hills * 40);
}

/** Пътят е прав край фермата и селото, а навън леко криволичи. */
export function roadZAt(x: number) {
  if (x > -80 && x < 480) return ROAD_Z;
  const t = x < -80 ? x + 80 : x - 480;
  return ROAD_Z + Math.sin(t * 0.012) * 26 * smooth(0, 80, Math.abs(t));
}
