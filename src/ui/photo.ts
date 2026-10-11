import type { Engine } from '../engine/engine';
import type { CameraRig } from '../engine/camera';
import { sfx } from '../audio/sfx';
import { UI } from './api';

// Фото режим: скрива бутоните, позволява по-ниска камера и по-близо, и запазва снимка на фермата.

let E: Engine, R: CameraRig;
let bar: HTMLElement;
let prevMin = 22;

function enter() {
  UI.closeAll();
  document.body.classList.add('photo');
  bar.classList.add('show');
  prevMin = R.minDist;
  R.minDist = 7;
  (bar.querySelector('#ph-tilt') as HTMLInputElement).value = String(R.tilt);
}

function exit() {
  document.body.classList.remove('photo');
  bar.classList.remove('show');
  R.minDist = prevMin;
  R.goal.distance = Math.max(R.goal.distance, prevMin);
  R.tilt = 0;
}

function shoot() {
  const url = E.snapshot();
  sfx('pick');
  const flash = document.createElement('div');
  flash.className = 'ph-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
  const prev = bar.querySelector('#ph-prev') as HTMLElement;
  prev.innerHTML = `<img src="${url}"><div class="row"><button class="btn sm" data-ph="save">💾 Запази</button>${'share' in navigator ? '<button class="btn sm blue" data-ph="share">📤 Сподели</button>' : ''}<button class="btn sm red" data-ph="x">✕</button></div>`;
  prev.classList.add('show');
  prev.dataset.url = url;
}

async function share(url: string, save: boolean) {
  const name = `rodopska-ferma-${new Date().toISOString().slice(0, 10)}.jpg`;
  if (!save && navigator.share) {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Моята ферма в Родопите' }); return; }
    } catch { /* отказано — запазваме */ }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  UI.toast('📷 Снимката е запазена', 'ok');
}

export function initPhoto(engine: Engine, rig: CameraRig) {
  E = engine;
  R = rig;
  const money = document.querySelector('#hud-top .money');
  if (money) {
    const p = document.createElement('div');
    p.className = 'pill outl';
    p.style.padding = '0 8px';
    p.textContent = '📷';
    p.title = 'Фото режим';
    p.onclick = () => { sfx('tap'); enter(); };
    money.insertBefore(p, money.lastElementChild);
  }
  bar = document.createElement('div');
  bar.id = 'photobar';
  bar.innerHTML = `<div class="ph-hint outl">Местѝ и въртѝ камерата, приближи с два пръста. Плъзгачът отдясно снижава камерата.</div>
    <input type="range" id="ph-tilt" min="0" max="0.55" step="0.01" value="0" orient="vertical">
    <button class="ph-shot" data-ph="shot" title="Снимай"></button>
    <button class="btn red ph-close" data-ph="close">✕ Назад</button>
    <div class="ph-prev" id="ph-prev"></div>`;
  document.body.appendChild(bar);
  (bar.querySelector('#ph-tilt') as HTMLInputElement).addEventListener('input', (e) => (R.tilt = +(e.target as HTMLInputElement).value));
  bar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-ph]') as HTMLElement | null;
    if (!b) return;
    const prev = bar.querySelector('#ph-prev') as HTMLElement;
    switch (b.dataset.ph) {
      case 'shot': shoot(); break;
      case 'close': exit(); sfx('close'); break;
      case 'save': share(prev.dataset.url!, true); break;
      case 'share': share(prev.dataset.url!, false); break;
      case 'x': prev.classList.remove('show'); break;
    }
  });
}
