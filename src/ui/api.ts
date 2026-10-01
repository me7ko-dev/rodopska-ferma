// Връзка между света и интерфейса (за да няма кръгови зависимости). ui.ts попълва функциите.
import type { View } from '../game/world';

export interface UIApi {
  toast(text: string, kind?: 'ok' | 'warn' | 'info'): void;
  openSeeds(field: View): void;
  closeSeeds(): void;
  fieldInfo(field: View): void;
  openProduction(v: View): void;
  openStorage(silo: boolean): void;
  openAnimals(v: View): void;
  openTree(v: View): void;
  openDeco(v: View): void;
  openHome(): void;
  openOrders(): void;
  openGarage(): void;
  openMarket(): void;
  openLand(id: string): void;
  openVillageHouse(plot: number): void;
  placing(on: boolean, ok: boolean): void;
  closeAll(): void;
  refresh(): void;
  sowMode(crop: string | null): void;
  openVisitor(v: { item: string; qty: number; coins: number; xp: number; name: string }, accept: () => void, decline: () => void): void;
}

export const UI = {} as UIApi;
