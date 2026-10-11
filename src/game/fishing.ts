import * as THREE from 'three';
import { FISH, FISH_LEVEL, ITEMS } from './data';
import { S, save, count, takeAll, addItem, addXP, addCoins, addDiamonds, spaceFor, VISIT } from './state';
import { flyTo, popText, sparkle, marker, type Marker } from './fx';
import { pier } from './buildings3d';
import { instance, animationsOf } from '../engine/assets';
import { itemModel } from './items3d';
import { POND } from '../world/layout';
import { UI } from '../ui/api';
import { img, icon } from '../ui/icons';
import { sfx } from '../audio/sfx';
import type { CameraRig, GameInput, PointerInfo } from '../engine/camera';
import type { Farm } from './world';

// Риболов на езерото: кей, рибар с въдица, плувка. Хвърляш, чакаш да кълве, засичаш и навиваш, без да скъсаш влакното.

const BANK_A = 0.6; // ъгъл на брега, откъдето тръгва кеят (югоизток — там стига пътечката)
const B = new THREE.Vector3(POND.x + Math.cos(BANK_A) * (POND.rx + 0.7), 0, POND.z + Math.sin(BANK_A) * (POND.rz + 0.7));
const DIR = new THREE.Vector3(POND.x - B.x, 0, POND.z - B.z).normalize();
const PIER_LEN = 5.4;
const END = B.clone().addScaledVector(DIR, PIER_LEN - 0.6);
const WATER_Y = 0.17;

type St = 'off' | 'idle' | 'cast' | 'wait' | 'bite' | 'reel' | 'done';

function inPond(x: number, z: number, k = 0.78) {
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) < k;
}

/** Каква риба кълве (по нивото, а нощем сомът е по-чест). */
function pickFish() {
  const h = new Date().getHours();
  const night = h >= 20 || h < 6;
  const list = FISH.filter((f) => f.level <= S.level);
  const w = list.map((f) => f.w * (night && f.id === 'f_catfish' ? 3 : 1) * ((h === 6 || h === 7 || h === 19) && f.id === 'f_pike' ? 2 : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) return list[i];
  return list[0];
}

export class Fishing implements GameInput {
  group = new THREE.Group();
  proxy: THREE.Mesh;
  st: St = 'off';
  private fisher: THREE.Group;
  private mixer: THREE.AnimationMixer | null = null;
  private rod: THREE.Group;
  private tip = new THREE.Object3D();
  private bobber: THREE.Group;
  private line: THREE.Line;
  private rings: { m: THREE.Mesh; t: number }[] = [];
  private ringGeo = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
  private t = 0; // време в текущото състояние
  private waitFor = 0;
  private nibbles: number[] = [];
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private fish: (typeof FISH)[number] | null = null;
  private kg = 0;
  private eff = 0;
  private tension = 0;
  private prog = 0;
  private holding = false;
  private surge = 0;
  private surgeT = 2;
  private wander = new THREE.Vector3();
  private jump: { o: THREE.Object3D; t: number; a: THREE.Vector3; b: THREE.Vector3 } | null = null;
  private prev: { x: number; z: number; d: number; yaw: number } | null = null;
  private ui: HTMLElement;
  private hint: Marker;
  private special: 'treasure' | 'boot' | null = null;

  constructor(scene: THREE.Scene, public farm: Farm, public rig: CameraRig) {
    scene.add(this.group);
    // кеят
    const p = pier(PIER_LEN);
    p.position.copy(B).addScaledVector(DIR, -0.3);
    p.rotation.y = Math.atan2(DIR.x, DIR.z);
    this.group.add(p);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, PIER_LEN + 1.5), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(B).addScaledVector(DIR, PIER_LEN / 2 - 0.5).setY(1);
    this.proxy.rotation.y = p.rotation.y;
    scene.add(this.proxy);
    // рибарят с въдицата (появява се само докато ловиш)
    this.fisher = instance('m_farmer', 1.8, 'y');
    this.fisher.position.copy(END).setY(0.46);
    this.fisher.rotation.y = Math.atan2(DIR.x, DIR.z);
    const anims = animationsOf('m_farmer');
    const idle = anims.find((c) => /idle/i.test(c.name) && !/gun|sword/i.test(c.name));
    if (idle) { this.mixer = new THREE.AnimationMixer(this.fisher); this.mixer.clipAction(idle).play(); }
    this.rod = new THREE.Group();
    const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, 3.2, 6).translate(0, 1.6, 0), new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.6 }));
    rodMesh.castShadow = true;
    this.rod.add(rodMesh);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c0c4c8', metalness: 0.6, roughness: 0.3 }));
    reel.position.set(0.06, 0.35, 0);
    this.rod.add(reel);
    this.tip.position.set(0, 3.2, 0);
    this.rod.add(this.tip);
    this.rod.position.set(0.32, 1.0, 0.25);
    this.rod.rotation.x = 0.85;
    this.fisher.add(this.rod);
    this.fisher.visible = false;
    this.group.add(this.fisher);
    // плувката: червено-бяла
    this.bobber = new THREE.Group();
    const bm = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bm('#e5332a'));
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bm('#ffffff'));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 5).translate(0, 0.12, 0), bm('#e5332a'));
    this.bobber.add(b1, b2, stick);
    this.bobber.visible = false;
    this.group.add(this.bobber);
    const lg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new THREE.Vector3()));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#f4f4f0', transparent: true, opacity: 0.85 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.group.add(this.line);
    // интерфейсът
    this.ui = document.createElement('div');
    this.ui.id = 'fishbar';
    this.ui.innerHTML = `
      <div class="fb-top"><span class="pill outl fb-bait">${img('bait')}<b id="fb-bait">0</b></span><span class="sp"></span>
        <button class="btn sm blue" data-f="log">📖 Дневник</button><button class="btn sm red" data-f="exit">✕ Изход</button></div>
      <div class="fb-msg outl" id="fb-msg"></div>
      <div class="fb-reel" id="fb-reel"><div class="fb-lbl outl">Опъване на влакното</div><div class="fb-bar tension"><i id="fb-t"></i><s></s></div>
        <div class="fb-lbl outl">Рибата идва към теб</div><div class="fb-bar prog"><i id="fb-p"></i></div></div>
      <button class="fb-big" id="fb-big"></button>`;
    document.body.appendChild(this.ui);
    this.ui.addEventListener('click', (e) => {
      const f = (e.target as HTMLElement).closest('[data-f]') as HTMLElement | null;
      if (!f) return;
      sfx('tap');
      if (f.dataset.f === 'exit') this.exit();
      if (f.dataset.f === 'log') UI.openFishLog();
    });
    const big = this.ui.querySelector('#fb-big') as HTMLElement;
    big.addEventListener('pointerdown', (e) => { e.preventDefault(); this.press(); });
    addEventListener('pointerup', () => (this.holding = false));
    addEventListener('pointercancel', () => (this.holding = false));
    addEventListener('keydown', (e) => { if (this.st !== 'off' && e.code === 'Space' && !e.repeat) this.press(); });
    addEventListener('keyup', (e) => { if (e.code === 'Space') this.holding = false; });
    // покана над кея
    this.hint = marker(B.clone().addScaledVector(DIR, 2).setY(2.2), `<img src="${icon('f_carp')}">`, 'mk bubble small');
    this.hint.onClick = () => this.tapPier();
  }

  tapPier() {
    if (VISIT) return;
    if (S.level < FISH_LEVEL) { UI.toast(`🎣 Риболовът на езерото се отключва на ниво ${FISH_LEVEL}`, 'info'); sfx('error'); return; }
    this.enter();
  }

  enter() {
    if (this.st !== 'off') return;
    UI.closeAll();
    this.prev = { x: this.rig.goal.x, z: this.rig.goal.z, d: this.rig.goal.distance, yaw: this.rig.goal.yaw };
    const look = END.clone().addScaledVector(DIR, 3.2);
    this.rig.flyTo(look.x, look.z, 23);
    this.rig.goal.yaw = Math.atan2(-DIR.x, -DIR.z) + 0.45;
    this.rig.input = this;
    this.fisher.visible = true;
    this.st = 'idle';
    document.body.classList.add('fishing');
    this.ui.classList.add('show');
    this.refresh();
    if (count('bait') < 1) this.msg('Нямаш стръв! Направи във Фуражната мелница или купи от Магазина → Инструменти.');
  }

  exit() {
    if (this.st === 'off') return;
    this.st = 'off';
    this.rig.input = this.farm;
    if (this.prev) { this.rig.flyTo(this.prev.x, this.prev.z, this.prev.d); this.rig.goal.yaw = this.prev.yaw; }
    this.fisher.visible = false;
    this.bobber.visible = false;
    this.line.visible = false;
    this.holding = false;
    document.body.classList.remove('fishing');
    this.ui.classList.remove('show');
  }

  private msg(t: string) {
    (this.ui.querySelector('#fb-msg') as HTMLElement).textContent = t;
  }

  private refresh() {
    (this.ui.querySelector('#fb-bait') as HTMLElement).textContent = String(count('bait'));
    const big = this.ui.querySelector('#fb-big') as HTMLElement;
    const label: Record<St, string> = { off: '', idle: '🎣 Хвърли', cast: '…', wait: 'Чакай да кълве…', bite: '❗ Засечи!', reel: '⟳ Навивай (задръж)', done: '🎣 Още веднъж' };
    big.textContent = label[this.st];
    big.className = 'fb-big ' + this.st;
    this.ui.classList.toggle('reeling', this.st === 'reel');
    if (this.st === 'idle') this.msg(count('bait') ? 'Натисни водата (или бутона), за да хвърлиш въдицата.' : 'Нямаш стръв! Направи във Фуражната мелница или купи от Магазина.');
  }

  /** Големият бутон (или интервал). */
  private press() {
    sfx('tap');
    if (this.st === 'idle' || this.st === 'done') this.cast();
    else if (this.st === 'bite') this.hook();
    else if (this.st === 'reel') this.holding = true;
    else if (this.st === 'wait') this.msg('Още не кълве… изчакай плувката да потъне!');
  }

  private cast(at?: THREE.Vector3) {
    if (count('bait') < 1) { UI.toast('Нямаш стръв за риболов', 'warn'); sfx('error'); this.refresh(); return; }
    if (spaceFor('f_carp') < 1) { UI.toast('Хамбарът е пълен! Продай нещо, за да има място за рибата.', 'warn'); sfx('error'); return; }
    takeAll({ bait: 1 });
    let target = at;
    if (!target) {
      for (let k = 0; k < 30; k++) {
        const d = 2.5 + Math.random() * 4.5, a = (Math.random() - 0.5) * 1.4;
        const dir = DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const p = END.clone().addScaledVector(dir, d);
        if (inPond(p.x, p.z)) { target = p; break; }
      }
      target ??= new THREE.Vector3(POND.x, 0, POND.z);
    }
    this.tip.getWorldPosition(this.from);
    this.to.copy(target).setY(WATER_Y);
    this.wander.set(0, 0, 0);
    this.st = 'cast';
    this.t = 0;
    this.bobber.visible = true;
    this.line.visible = true;
    this.special = null;
    sfx('cast');
    this.msg('');
    this.refresh();
  }

  private hook() {
    this.special = Math.random() < 0.05 ? 'treasure' : Math.random() < 0.04 ? 'boot' : null;
    this.fish = pickFish();
    const f = this.fish;
    const r = Math.pow(Math.random(), 2.2);
    this.kg = Math.round((f.min + (f.max - f.min) * r) * 100) / 100;
    this.eff = this.special ? 0.25 : f.power * (0.75 + 0.35 * r);
    this.tension = 0.2;
    this.prog = 0.15;
    this.surge = 0;
    this.surgeT = 1 + Math.random() * 1.5;
    this.st = 'reel';
    this.t = 0;
    this.msg('Хвана се! Навивай, но не скъсвай влакното — пускай, когато стане червено.');
    sfx('reel');
    if (navigator.vibrate) navigator.vibrate(40);
    this.refresh();
  }

  private lose(text: string) {
    this.st = 'done';
    this.bobber.visible = false;
    this.line.visible = false;
    this.msg(text);
    this.refresh();
  }

  private ring(p: THREE.Vector3, big = false) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.copy(p).setY(WATER_Y + 0.02);
    m.scale.setScalar(big ? 0.3 : 0.15);
    m.userData.big = big;
    this.group.add(m);
    this.rings.push({ m, t: 0 });
  }

  private caught() {
    const f = this.fish!;
    const pos = this.bobber.position.clone();
    this.bobber.visible = false;
    this.line.visible = false;
    this.st = 'done';
    sfx('catch');
    this.ring(pos, true);
    sparkle(pos.clone().setY(0.6), 14);
    // изненади: сандъче или стара обувка
    if (this.special === 'treasure') {
      const c = 60 + Math.round(Math.random() * 140) + S.level * 5;
      addCoins(c);
      flyTo('coin', pos.clone().setY(1), '#hud-coins', 5);
      const dia = Math.random() < 0.4 ? 1 + ((Math.random() * 2) | 0) : 0;
      if (dia) { addDiamonds(dia); flyTo('diamond', pos.clone().setY(1), '#hud-diamonds', dia, 300); }
      popText(`Сандъче със съкровище! +${c}${dia ? ` и ${dia} 💎` : ''}`, pos.clone().setY(1.5), '#ffe066', true);
      this.msg('🪙 Извади сандъче със съкровище от дъното!');
      this.refresh();
      save();
      return;
    }
    if (this.special === 'boot') {
      addXP(1);
      popText('Стара обувка 😄', pos.clone().setY(1.5), '#fff', true);
      this.msg('Хм… стара гумена обувка. Пробвай пак!');
      this.refresh();
      return;
    }
    // рибата изскача и полита към кея
    const o = itemModel(f.id);
    o.scale.setScalar(0.7 + Math.min(1.4, Math.sqrt(this.kg / Math.max(0.3, f.max)) * 1.1));
    this.group.add(o);
    this.jump = { o, t: 0, a: pos.clone(), b: END.clone().setY(1.6) };
    const log = (S.fishLog ??= {});
    const e = (log[f.id] ??= { n: 0, max: 0 });
    const record = this.kg > e.max;
    const first = e.n === 0;
    e.n++;
    e.max = Math.max(e.max, this.kg);
    S.stats.fish = (S.stats.fish ?? 0) + 1;
    const xp = ITEMS[f.id].xp + (record ? 3 : 0) + (first ? 5 : 0);
    addXP(xp);
    const got = addItem(f.id, 1);
    setTimeout(() => {
      if (got) flyTo(f.id, END.clone().setY(1.8), '#hud-barn', 1);
      flyTo('star', END.clone().setY(1.8), '#hud-xp', 1, 150);
    }, 900);
    if (f.id === 'f_goldfish') { addDiamonds(5); flyTo('diamond', pos.clone().setY(1), '#hud-diamonds', 5, 600); }
    const rare = ['', ' (рядка)', ' (много рядка!)', ' — ЛЕГЕНДАРНА!'][f.rare];
    popText(`${ITEMS[f.id].name} ${this.kg.toLocaleString('bg-BG')} кг${first ? ' — нова!' : record ? ' — рекорд!' : ''}`, pos.clone().setY(1.6), f.rare >= 2 ? '#ffd23a' : '#fff', true);
    this.msg(`Хвана ${ITEMS[f.id].name.toLowerCase()} — ${this.kg.toLocaleString('bg-BG')} кг${rare}${got ? '' : ' (хамбарът е пълен — пусна я обратно)'}${f.id === 'f_goldfish' ? ' Изпълни желание: +5 диаманта!' : ''}`);
    this.refresh();
    save();
  }

  // ---------- докосвания по време на риболов ----------
  onDown() { return false; }
  onDrag() {}
  onUp() {}
  onTap(p: PointerInfo) {
    if (this.st === 'bite') { this.hook(); return; }
    if (this.st === 'idle' || this.st === 'done') {
      const g = this.rig.groundAt(p.x, p.y);
      if (g && inPond(g.x, g.z, 0.85) && g.distanceTo(END) > 1.5) this.cast(g.setY(0));
    }
  }

  update(dt: number, time: number) {
    // покана над кея — когато риболовът е отключен и не ловим
    this.hint.visible = this.st === 'off' && !VISIT && S.level >= FISH_LEVEL && this.rig.distance < 80;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / (r.m.userData.big ? 1.4 : 0.9);
      r.m.scale.setScalar((r.m.userData.big ? 0.3 : 0.15) + k * (r.m.userData.big ? 1.8 : 0.8));
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      if (k >= 1) { this.group.remove(r.m); (r.m.material as THREE.Material).dispose(); this.rings.splice(i, 1); }
    }
    if (this.jump) {
      const j = this.jump;
      j.t += dt / 0.9;
      const k = Math.min(1, j.t);
      j.o.position.lerpVectors(j.a, j.b, k);
      j.o.position.y += Math.sin(k * Math.PI) * 2.2;
      j.o.rotation.set(0, Math.atan2(DIR.x, DIR.z), Math.sin(time * 18) * 0.5);
      if (j.t >= 1.15) { this.group.remove(j.o); this.jump = null; }
    }
    if (this.st === 'off') return;
    this.mixer?.update(dt);
    this.t += dt;
    const bp = this.bobber.position;
    if (this.st === 'cast') {
      const k = Math.min(1, this.t / 0.75);
      bp.lerpVectors(this.from, this.to, k);
      bp.y += Math.sin(k * Math.PI) * 2.5;
      if (k >= 1) {
        bp.copy(this.to);
        this.ring(bp);
        sfx('splash');
        this.st = 'wait';
        this.t = 0;
        this.waitFor = 2.2 + Math.random() * 5;
        this.nibbles = [];
        for (let i = 0; i < 2; i++) if (Math.random() < 0.6) this.nibbles.push(0.6 + Math.random() * (this.waitFor - 1));
        this.msg('Чакай… когато плувката потъне — натисни бързо!');
        this.refresh();
      }
    } else if (this.st === 'wait') {
      let dip = 0;
      for (const n of this.nibbles) { const d = this.t - n; if (d > 0 && d < 0.35) dip = Math.max(dip, Math.sin((d / 0.35) * Math.PI) * 0.05); }
      if (this.nibbles.some((n) => this.t - n > 0 && this.t - n < dt * 1.5)) this.ring(bp);
      bp.y = WATER_Y + Math.sin(time * 2.4) * 0.015 - dip;
      if (this.t >= this.waitFor) {
        this.st = 'bite';
        this.t = 0;
        sfx('bite');
        this.ring(bp, true);
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        this.msg('Кълве!!! Натисни сега!');
        this.refresh();
      }
    } else if (this.st === 'bite') {
      bp.y = WATER_Y - 0.12 - Math.abs(Math.sin(time * 14)) * 0.06;
      if (this.t > 1.5) this.lose('Рибата изяде стръвта и избяга. Бъди по-бърз!');
    } else if (this.st === 'reel') {
      // рибата дърпа на тласъци; задържаш — навиваш, но влакното се опъва
      this.surgeT -= dt;
      if (this.surgeT <= 0) { this.surgeT = 1.2 + Math.random() * 2.2; this.surge = 0.7; this.ring(bp); sfx('splash'); }
      this.surge = Math.max(0, this.surge - dt);
      const pull = this.eff * (0.55 + 0.45 * Math.sin(time * 2.3)) + (this.surge > 0 ? this.eff * 0.8 : 0);
      if (this.holding) {
        this.prog += dt * (0.3 - this.eff * 0.13);
        this.tension += dt * (0.22 + pull * 0.95);
        if (Math.random() < dt * 8) sfx('reel');
      } else {
        this.tension -= dt * 0.85;
        this.prog -= dt * pull * 0.07;
      }
      this.tension = Math.max(0, this.tension + (this.surge > 0 ? dt * this.eff * 0.5 : 0));
      // плувката (рибата) се мята из водата и идва към кея
      this.wander.x += (Math.random() - 0.5) * dt * 3 * this.eff;
      this.wander.z += (Math.random() - 0.5) * dt * 3 * this.eff;
      this.wander.clampLength(0, 1.6);
      const p = this.to.clone().lerp(END, Math.min(0.85, this.prog * 0.85)).add(this.wander);
      if (!inPond(p.x, p.z, 0.95)) p.lerp(new THREE.Vector3(POND.x, 0, POND.z), 0.2);
      bp.set(p.x, WATER_Y - 0.08 + Math.sin(time * 9) * 0.04, p.z);
      (this.ui.querySelector('#fb-t') as HTMLElement).style.width = `${Math.min(100, this.tension * 100)}%`;
      (this.ui.querySelector('#fb-t') as HTMLElement).className = this.tension > 0.82 ? 'hot' : this.tension > 0.6 ? 'warm' : '';
      (this.ui.querySelector('#fb-p') as HTMLElement).style.width = `${Math.max(0, Math.min(100, this.prog * 100))}%`;
      if (this.tension >= 1) { sfx('snap'); if (navigator.vibrate) navigator.vibrate(120); this.lose('Пук! Влакното се скъса. Пускай бутона, когато опъването стане червено.'); }
      else if (this.prog >= 1) this.caught();
      else if (this.prog <= 0 || this.t > 35) this.lose('Рибата се откачи и отплува…');
    }
    // въдицата се огъва, когато е опъната
    this.rod.rotation.x = 0.85 + (this.st === 'reel' ? this.tension * 0.35 : 0) + (this.st === 'bite' ? 0.15 : 0);
    // влакното: от върха на въдицата до плувката, леко провиснало
    if (this.line.visible) {
      const a = this.tip.getWorldPosition(new THREE.Vector3());
      const b = bp;
      const sag = this.st === 'reel' ? 0.15 * (1 - this.tension) : this.st === 'cast' ? 0.2 : 0.9;
      const pos = this.line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const k = i / (pos.count - 1);
        pos.setXYZ(i, a.x + (b.x - a.x) * k, a.y + (b.y + 0.12 - a.y) * k - Math.sin(k * Math.PI) * sag, a.z + (b.z - a.z) * k);
      }
      pos.needsUpdate = true;
    }
  }
}

/** Наградата за пълния рибарски дневник. */
export const FISHLOG_REWARD = 20;
export function fishLogComplete() {
  return FISH.every((f) => (S.fishLog?.[f.id]?.n ?? 0) > 0);
}
