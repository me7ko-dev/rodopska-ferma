// Звуци, направени с Web Audio (без файлове): щракане, монети, жътва, ниво, животни и тиха музика.
import { S } from '../game/state';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// звукът тръгва след първото докосване (изискване на браузърите)
addEventListener('pointerdown', () => { ac(); startMusic(); }, { once: true });

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, when = 0, slide = 0) {
  if (!S.sound) return;
  const c = ac();
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol = 0.15, filter = 2000, when = 0, q = 1) {
  if (!S.sound) return;
  const c = ac();
  const t = c.currentTime + when;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}

export type Sfx = 'tap' | 'coin' | 'harvest' | 'plant' | 'levelup' | 'error' | 'pop' | 'build' | 'cluck' | 'moo' | 'baa' | 'buzz' | 'truck' | 'whistle' | 'open' | 'close' | 'collect' | 'quack' | 'oink' | 'splash' | 'heart';

export function sfx(name: Sfx) {
  if (!S.sound) return;
  try {
    switch (name) {
      case 'tap': tone(660, 0.07, 'triangle', 0.12); break;
      case 'open': tone(520, 0.08, 'triangle', 0.1); tone(780, 0.1, 'triangle', 0.1, 0.05); break;
      case 'close': tone(600, 0.08, 'triangle', 0.08); tone(420, 0.1, 'triangle', 0.08, 0.05); break;
      case 'pop': tone(880, 0.09, 'sine', 0.16, 0, 1.6); break;
      case 'coin': tone(1320, 0.08, 'square', 0.06); tone(1760, 0.18, 'square', 0.06, 0.07); break;
      case 'collect': tone(990, 0.07, 'triangle', 0.12); tone(1320, 0.12, 'triangle', 0.12, 0.06); break;
      case 'harvest': noise(0.18, 0.25, 3200, 0, 0.8); tone(700, 0.1, 'triangle', 0.08, 0.05, 1.5); break;
      case 'plant': noise(0.12, 0.18, 900, 0, 1.2); tone(330, 0.08, 'sine', 0.1, 0.02); break;
      case 'build': for (let i = 0; i < 3; i++) noise(0.08, 0.3, 600, i * 0.12, 2); tone(520, 0.3, 'triangle', 0.1, 0.36); break;
      case 'error': tone(220, 0.15, 'square', 0.08); tone(180, 0.2, 'square', 0.08, 0.12); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.13, i * 0.1)); break;
      case 'cluck': for (let i = 0; i < 3; i++) tone(900 + Math.random() * 300, 0.06, 'square', 0.04, i * 0.09, 0.6); break;
      case 'moo': tone(140, 0.9, 'sawtooth', 0.06, 0, 0.75); tone(142, 0.9, 'sine', 0.08, 0, 0.75); break;
      case 'baa': for (let i = 0; i < 5; i++) tone(420 + (i % 2) * 30, 0.09, 'sawtooth', 0.04, i * 0.07); break;
      case 'buzz': tone(210, 0.5, 'sawtooth', 0.03, 0, 1.05); break;
      case 'truck': tone(90, 0.6, 'sawtooth', 0.05, 0, 1.6); noise(0.6, 0.08, 300); break;
      case 'whistle':
        // парна свирка: акорд с лек шум от парата, два пъти
        for (const w of [0, 0.75]) {
          for (const f of [466, 587, 698]) tone(f, w ? 1.1 : 0.45, 'triangle', 0.035, w, 1.004);
          noise(w ? 1.1 : 0.45, 0.05, 2600, w, 3);
        }
        break;
      case 'quack': for (let i = 0; i < 2; i++) { tone(520, 0.12, 'sawtooth', 0.05, i * 0.16, 0.7); noise(0.1, 0.06, 900, i * 0.16, 3); } break;
      case 'oink': for (let i = 0; i < 2; i++) { tone(260, 0.14, 'sawtooth', 0.06, i * 0.18, 0.8); noise(0.12, 0.1, 500, i * 0.18, 2); } break;
      case 'splash': noise(0.35, 0.22, 1400, 0, 0.6); noise(0.2, 0.12, 3000, 0.08, 0.8); break;
      case 'heart': [660, 880, 1100].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, i * 0.08)); break;
    }
  } catch {}
}

// ---------- музика: спокойна мелодия в родопски дух (пентатоника, бавна) ----------
let musicOn = false;
export function startMusic() {
  if (musicOn || !S.music) return;
  musicOn = true;
  const c = ac();
  musicGain!.gain.setTargetAtTime(0.35, c.currentTime, 2);
  const scale = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25]; // ре-пентатоника
  let bar = 0;
  const playBar = () => {
    if (!musicOn) return;
    const t0 = c.currentTime + 0.05;
    const beat = 0.55;
    // бас (дронът на гайдата)
    const drone = c.createOscillator();
    const dg = c.createGain();
    drone.type = 'triangle';
    drone.frequency.value = bar % 4 === 2 ? 110 : 146.83;
    dg.gain.setValueAtTime(0, t0);
    dg.gain.linearRampToValueAtTime(0.05, t0 + 0.3);
    dg.gain.linearRampToValueAtTime(0.0, t0 + beat * 8);
    drone.connect(dg).connect(musicGain!);
    drone.start(t0);
    drone.stop(t0 + beat * 8 + 0.1);
    // мелодия (като кавал)
    let idx = 3 + ((bar * 3) % 3);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.25) continue;
      idx = Math.max(0, Math.min(scale.length - 1, idx + [-2, -1, 1, 2, 0][(Math.random() * 5) | 0]));
      const f = scale[idx] * (Math.random() < 0.15 ? 2 : 1);
      const t = t0 + i * beat;
      const o = c.createOscillator();
      const g = c.createGain();
      const v = c.createOscillator();
      const vg = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      v.frequency.value = 5.5;
      vg.gain.value = f * 0.008;
      v.connect(vg).connect(o.frequency);
      const len = beat * (Math.random() < 0.3 ? 2 : 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(g).connect(musicGain!);
      o.start(t); v.start(t);
      o.stop(t + len + 0.05); v.stop(t + len + 0.05);
    }
    bar++;
    setTimeout(playBar, beat * 8 * 1000);
  };
  playBar();
}

export function stopMusic() {
  musicOn = false;
  if (ctx && musicGain) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
}

// ---------- шум от дъжд ----------
let rainSrc: AudioBufferSourceNode | null = null;
let rainGain: GainNode | null = null;
export function rainSound(on: boolean) {
  if (!S.sound && on) return;
  const c = ac();
  if (on && !rainSrc) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    rainSrc = c.createBufferSource();
    rainSrc.buffer = buf;
    rainSrc.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    rainGain = c.createGain();
    rainGain.gain.value = 0;
    rainGain.gain.setTargetAtTime(0.09, c.currentTime, 2);
    rainSrc.connect(f).connect(rainGain).connect(master!);
    rainSrc.start();
  } else if (!on && rainSrc) {
    const src = rainSrc;
    rainGain!.gain.setTargetAtTime(0, c.currentTime, 1.5);
    setTimeout(() => src.stop(), 5000);
    rainSrc = null;
  }
}
