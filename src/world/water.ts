import * as THREE from 'three';
import { windTime } from '../engine/wind';

/** Вода с вълнички, отблясъци и светъл ръб (за езерото). */
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: windTime, deep: { value: new THREE.Color('#2f8fb3') }, shallow: { value: new THREE.Color('#7fd3df') } },
    ]),
    vertexShader: `
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 deep; uniform vec3 shallow;
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main(){
        // разстояние до ръба (uv е в елипса: център 0.5)
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float edge = smoothstep(1.0, 0.72, r);
        vec2 w = vWorld.xz;
        float t = uTime;
        float wave = sin(w.x*1.7 + t*1.3) * sin(w.y*1.3 - t*1.1) + 0.5*sin((w.x+w.y)*2.9 + t*2.2);
        vec3 col = mix(shallow, deep, edge);
        // отблясъци
        float spark = smoothstep(1.05, 1.35, wave + 0.4*sin(w.x*4.1 - t*2.7) * sin(w.y*3.7 + t*1.9));
        col += vec3(1.0) * spark * 0.55 * edge;
        col += vec3(0.08,0.12,0.12) * wave * 0.25;
        // пяна по ръба
        float foam = smoothstep(0.88, 0.97, r) * (0.6 + 0.4*sin(atan(p.y,p.x)*14.0 + t*1.5));
        col = mix(col, vec3(0.86,0.93,0.92), foam*0.35);
        float a = smoothstep(1.0, 0.93, r);
        gl_FragColor = vec4(col, a * 0.94);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

let bankTex: THREE.CanvasTexture | null = null;
function bankTexture() {
  if (bankTex) return bankTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(92,78,52,1)');
  gr.addColorStop(0.78, 'rgba(110,92,60,1)');
  gr.addColorStop(0.86, 'rgba(176,150,104,0.95)');
  gr.addColorStop(0.93, 'rgba(150,140,90,0.55)');
  gr.addColorStop(1, 'rgba(120,140,70,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  // камъчета и неравности по пясъка
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, rr = 100 + Math.random() * 20;
    const v = 120 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v - 10},${v - 30},${0.25 + Math.random() * 0.4})`;
    g.fillRect(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  bankTex = new THREE.CanvasTexture(cv);
  bankTex.colorSpace = THREE.SRGBColorSpace;
  return bankTex;
}

/** Езеро: бряг, вода и (по желание) водни лилии около него се добавят отвън. */
export function buildPond(x: number, z: number, rx: number, rz: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  // бряг — мокра пръст и пясък, който плавно преминава в тревата
  const bank = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: bankTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  );
  bank.scale.set(rx + 2.4, 1, rz + 2.4);
  bank.position.y = 0.04;
  bank.renderOrder = -4;
  bank.receiveShadow = true;
  // тъмно дъно (дава дълбочина)
  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#3d6f62', roughness: 1 }),
  );
  bed.scale.set(rx + 0.2, 1, rz + 0.2);
  bed.position.y = 0.06;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), waterMaterial());
  water.scale.set(rx, 1, rz);
  water.position.y = 0.16;
  water.renderOrder = 2;
  g.add(bank, bed, water);
  return g;
}
