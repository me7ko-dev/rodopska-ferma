import * as THREE from 'three';

// Сезони по истинския календар: есен (жълти и червени дървета, падащи листа), зима (сняг по земята, покривите и дърветата),
// пролет (цъфнали дървета, листенца във въздуха) и лято. Всичко става с малка добавка в шейдъра на всички материали,
// управлявана от общи стойности — смяната на сезона е мигновена, без прекомпилиране.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_NAMES: Record<Season, string> = { spring: 'Пролет', summer: 'Лято', autumn: 'Есен', winter: 'Зима' };
export const SEASON_ICONS: Record<Season, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };

/** Общите стойности за шейдъра (0…1). */
export const SEASON_U = { uAutumn: { value: 0 }, uSnow: { value: 0 }, uBloom: { value: 0 } };

/** Сезонни култури — растат с 20% по-бързо в своя сезон. */
export const SEASON_CROPS: Record<Season, string[]> = {
  spring: ['strawberry', 'onion', 'garlic', 'mint', 'rose', 'herbs'],
  summer: ['tomato', 'pepper', 'cucumber', 'watermelon', 'melon', 'sunflower', 'eggplant', 'lavender', 'raspberry', 'blueberry'],
  autumn: ['pumpkin', 'corn', 'potato', 'beet', 'cabbage', 'mushroom', 'saffron', 'beans'],
  winter: ['wheat', 'carrot', 'cabbage', 'onion', 'garlic', 'potato'],
};
export const isSeasonal = (crop: string) => SEASON_CROPS[season].includes(crop);

export function realSeason(d = new Date()): Season {
  const m = d.getMonth();
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}

let mode: 'real' | Season = 'real';
try { mode = (localStorage.getItem('rf-season') as 'real' | Season) || 'real'; } catch { /* без запис */ }
export let season: Season = mode === 'real' ? realSeason() : mode;
export const seasonMode = () => mode;
const listeners: ((s: Season) => void)[] = [];
export const onSeason = (f: (s: Season) => void) => listeners.push(f);

function apply() {
  SEASON_U.uAutumn.value = season === 'autumn' ? 1 : 0;
  SEASON_U.uSnow.value = season === 'winter' ? 1 : 0;
  SEASON_U.uBloom.value = season === 'spring' ? 1 : 0;
}
apply();

export function setSeasonMode(m: 'real' | Season) {
  mode = m;
  try { localStorage.setItem('rf-season', m); } catch { /* */ }
  const next = m === 'real' ? realSeason() : m;
  if (next === season) return;
  season = next;
  apply();
  listeners.forEach((f) => f(season));
}

/** Рисуване без сезона (за иконите — да не са със сняг). */
export function withoutSeason<T>(f: () => T): T {
  const a = SEASON_U.uAutumn.value, s = SEASON_U.uSnow.value, b = SEASON_U.uBloom.value;
  SEASON_U.uAutumn.value = SEASON_U.uSnow.value = SEASON_U.uBloom.value = 0;
  try { return f(); } finally { SEASON_U.uAutumn.value = a; SEASON_U.uSnow.value = s; SEASON_U.uBloom.value = b; }
}

// ---------------------------------------------------------------- шейдър
/** 0 — нищо; 1 — широколистни листа; 2 — бор; 3 — трева; 4 — земя; 5 — всичко друго (сняг по покривите). */
function kindOf(m: THREE.Material): number {
  const u = m.userData;
  if (u.noSnow) return 0;
  if (u.ground) return 4;
  if (u.grass) return 3;
  const n = m.name || '';
  if (/pine/i.test(n)) return 2;
  if (/^grass$/i.test(n)) return 3;
  if (/leaves|tree_green|^green$/i.test(n)) return 1;
  return 5;
}

const VERT_DECL = `#include <common>
varying vec3 vSWP;
varying vec3 vSWN;`;
const VERT_BODY = `#include <fog_vertex>
{
  vec4 sP = vec4( transformed, 1.0 );
  vec3 sN = objectNormal;
#ifdef USE_INSTANCING
  sP = instanceMatrix * sP;
  sN = mat3( instanceMatrix ) * sN;
#endif
  sP = modelMatrix * sP;
  vSWP = sP.xyz;
  vSWN = normalize( mat3( modelMatrix ) * sN );
}`;
const FRAG_DECL = `#include <common>
varying vec3 vSWP;
varying vec3 vSWN;
uniform float uAutumn;
uniform float uSnow;
uniform float uBloom;
float sHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float sNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( sHash( i ), sHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( sHash( i + vec2( 0.0, 1.0 ) ), sHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}`;
const FRAG_BODY = `#include <color_fragment>
{
  vec3 sn = normalize( vSWN );
  float nz = sNoise( vSWP.xz * 0.55 ) * 0.6 + sNoise( vSWP.xz * 2.1 ) * 0.4;
  float lum = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  vec3 snowC = vec3( 0.93, 0.96, 1.0 );
#if SKIND == 1
  float hv = sHash( floor( vSWP.xz * 0.16 + 0.5 ) );
  vec3 aut = hv < 0.28 ? vec3( 1.0, 0.72, 0.15 ) : hv < 0.52 ? vec3( 0.98, 0.45, 0.1 ) : hv < 0.68 ? vec3( 0.82, 0.17, 0.09 ) : hv < 0.84 ? vec3( 0.9, 0.82, 0.25 ) : diffuseColor.rgb / max( lum, 0.05 );
  float vary = 0.8 + 0.4 * sNoise( vSWP.xz * 3.0 + vSWP.y * 2.0 );
  diffuseColor.rgb = mix( diffuseColor.rgb, aut * lum * 1.85 * vary, uAutumn * ( hv < 0.84 ? 0.92 : 0.25 ) );
  float bv = sHash( floor( vSWP.xz * 0.16 + 0.5 ) + 17.0 );
  float petals = smoothstep( 0.38, 0.62, sNoise( vSWP.xz * 4.0 + vSWP.y * 3.0 ) );
  vec3 bl = bv < 0.5 ? vec3( 1.0, 0.72, 0.84 ) : vec3( 1.0, 0.96, 0.97 );
  diffuseColor.rgb = mix( diffuseColor.rgb, bl * ( 0.75 + lum * 0.6 ), uBloom * ( bv < 0.72 ? 0.9 : 0.0 ) * petals );
  vec3 bare = vec3( lum * 0.95, lum * 0.82, lum * 0.7 );
  diffuseColor.rgb = mix( diffuseColor.rgb, bare, uSnow * 0.55 );
  diffuseColor.rgb = mix( diffuseColor.rgb, snowC, uSnow * ( 0.35 + 0.55 * smoothstep( 0.1, 0.8, sn.y ) ) * ( 0.7 + 0.3 * nz ) );
#elif SKIND == 2
  diffuseColor.rgb = mix( diffuseColor.rgb, snowC, uSnow * smoothstep( 0.05, 0.7, sn.y ) * ( 0.55 + 0.45 * nz ) );
#elif SKIND == 3
  diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.45, 1.05, 0.45 ), uAutumn * 0.8 );
  diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.95, 1.1, 0.92 ), uBloom );
  diffuseColor.rgb = mix( diffuseColor.rgb, snowC * 0.95, uSnow * ( 0.55 + 0.35 * nz ) );
#elif SKIND == 4
  float gr = clamp( ( diffuseColor.g - max( diffuseColor.r, diffuseColor.b ) ) * 6.0, 0.0, 1.0 );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.42, 1.02, 0.45 ) * ( 0.92 + 0.16 * nz ), uAutumn * 0.85 * gr );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.96, 1.08, 0.94 ), uBloom * gr );
  float cov = smoothstep( 0.22, 0.42, nz ) * mix( 0.6, 1.0, gr );
  diffuseColor.rgb = mix( diffuseColor.rgb, snowC * ( 0.9 + 0.1 * nz ), uSnow * cov * 0.92 );
#elif SKIND == 5
#ifndef USE_SKINNING
  float up = smoothstep( 0.55, 0.85, sn.y );
  diffuseColor.rgb = mix( diffuseColor.rgb, snowC, uSnow * up * ( 0.72 + 0.28 * nz ) );
#endif
#endif
}`;

function patchShader(sh: THREE.WebGLProgramParametersWithUniforms, kind: number) {
  if (!kind) return;
  sh.uniforms.uAutumn = SEASON_U.uAutumn;
  sh.uniforms.uSnow = SEASON_U.uSnow;
  sh.uniforms.uBloom = SEASON_U.uBloom;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', VERT_DECL).replace('#include <fog_vertex>', VERT_BODY);
  sh.fragmentShader = `#define SKIND ${kind}\n` + sh.fragmentShader.replace('#include <common>', FRAG_DECL).replace('#include <color_fragment>', FRAG_BODY);
}

// Всички MeshStandardMaterial (и наследниците им) минават през тази добавка. Материалите със собствен
// onBeforeCompile (вятър, земя) я викат първо, защото пазят предишната функция.
const proto = THREE.MeshStandardMaterial.prototype as unknown as {
  onBeforeCompile: (sh: THREE.WebGLProgramParametersWithUniforms, r: THREE.WebGLRenderer) => void;
  customProgramCacheKey: () => string;
};
proto.onBeforeCompile = function (this: THREE.Material, sh) { patchShader(sh, kindOf(this)); };
proto.customProgramCacheKey = function (this: THREE.Material) { return this.onBeforeCompile.toString() + '|season' + kindOf(this); };

// ---------------------------------------------------------------- падащи листа / сняг / цветчета
function leafTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(32, 4);
  g.quadraticCurveTo(60, 30, 32, 60);
  g.quadraticCurveTo(4, 30, 32, 4);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(32, 8);
  g.lineTo(32, 58);
  g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function flakeTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

/** Листа (есен), цветчета (пролет) или снежинки (зима), които падат около камерата. */
export class SeasonFx {
  group = new THREE.Group();
  private leaves: THREE.InstancedMesh;
  private lp: { x: number; y: number; z: number; vy: number; ph: number; sp: number; rx: number; ry: number }[] = [];
  private snow: THREE.Points;
  private dummy = new THREE.Object3D();
  heavy = 0; // 0…1 — по-силен снеговалеж (вместо дъжд)

  constructor(scene: THREE.Scene, quality: string) {
    scene.add(this.group);
    const n = quality === 'low' ? 60 : 140;
    const geo = new THREE.PlaneGeometry(0.32, 0.32);
    const mat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    mat.userData.noSnow = true;
    this.leaves = new THREE.InstancedMesh(geo, mat, n);
    this.leaves.frustumCulled = false;
    this.leaves.castShadow = false;
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.lp.push({ x: (Math.random() - 0.5) * 70, y: Math.random() * 22, z: (Math.random() - 0.5) * 70, vy: 0.6 + Math.random() * 0.8, ph: Math.random() * 10, sp: 0.8 + Math.random() * 1.4, rx: Math.random() * 6, ry: Math.random() * 6 });
      this.leaves.setColorAt(i, col.set('#ffffff'));
    }
    this.group.add(this.leaves);
    const sn = quality === 'low' ? 900 : 2200;
    const pos = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) pos.set([(Math.random() - 0.5) * 80, Math.random() * 40, (Math.random() - 0.5) * 80], i * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ map: flakeTexture(), size: 0.35, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.snow.frustumCulled = false;
    this.group.add(this.snow);
    this.recolor();
    onSeason(() => this.recolor());
  }

  private recolor() {
    const col = new THREE.Color();
    const pal = season === 'autumn' ? ['#f2b134', '#e8762a', '#c9382a', '#e0c040', '#b5651d'] : ['#fbd3e2', '#ffffff', '#f7b6cf', '#fff0f5'];
    for (let i = 0; i < this.lp.length; i++) this.leaves.setColorAt(i, col.set(pal[i % pal.length]));
    if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }

  update(dt: number, t: number, cx: number, cz: number, camDist: number) {
    const on = season === 'autumn' || season === 'spring';
    // отдалеч не се виждат — пестим работа
    this.leaves.visible = on && camDist < 120;
    this.snow.visible = season === 'winter' && camDist < 160;
    if (this.leaves.visible) {
      this.dummy.scale.setScalar(season === 'spring' ? 0.55 : 1);
      for (let i = 0; i < this.lp.length; i++) {
        const p = this.lp[i];
        p.ph += dt * p.sp;
        p.y -= p.vy * dt;
        p.x += (Math.sin(p.ph) * 0.9 + 0.5) * dt;
        p.z += Math.cos(p.ph * 0.7) * 0.6 * dt;
        if (p.y < 0.05) { p.y = 14 + Math.random() * 10; p.x = (Math.random() - 0.5) * 70; p.z = (Math.random() - 0.5) * 70; }
        this.dummy.position.set(cx + p.x, p.y, cz + p.z);
        this.dummy.rotation.set(p.rx + p.ph * 1.3, p.ry + p.ph, Math.sin(p.ph * 2) * 0.8);
        this.dummy.updateMatrix();
        this.leaves.setMatrixAt(i, this.dummy.matrix);
      }
      this.leaves.instanceMatrix.needsUpdate = true;
    }
    if (this.snow.visible) {
      const pos = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const a = pos.array as Float32Array;
      const fall = (1.4 + this.heavy * 2.5) * dt;
      const drift = Math.sin(t * 0.3) * 0.4 * dt;
      // при лек снеговалеж — само част от снежинките
      const visibleN = Math.floor(a.length / 3 * (0.35 + 0.65 * this.heavy));
      for (let i = 0; i < a.length; i += 3) {
        a[i + 1] -= fall * (0.7 + ((i * 7) % 10) / 20);
        a[i] += drift + Math.sin(t + i) * 0.15 * dt;
        if (a[i + 1] < 0) { a[i + 1] = 40; a[i] = (Math.random() - 0.5) * 80; a[i + 2] = (Math.random() - 0.5) * 80; }
      }
      pos.needsUpdate = true;
      this.snow.geometry.setDrawRange(0, visibleN);
      this.snow.position.set(cx, 0, cz);
    }
  }
}
