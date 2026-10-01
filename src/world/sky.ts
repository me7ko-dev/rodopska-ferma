import * as THREE from 'three';
import { rng } from '../engine/noise';

export const SKY = {
  top: new THREE.Color('#5aa7f0'),
  horizon: new THREE.Color('#d9eefc'),
  fog: new THREE.Color('#cfe6f7'),
};

/** Небе с плавен преход, слънце и пухкави облаци. */
export function buildSky(scene: THREE.Scene) {
  const geo = new THREE.SphereGeometry(1400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY.top },
      horizon: { value: SKY.horizon },
      sunDir: { value: new THREE.Vector3(-0.45, 0.6, 0.35).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0,0.93,0.75) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.Fog(SKY.fog, 260, 1150);
  scene.background = SKY.horizon;

  // облаци от слепени сфери
  const clouds = new THREE.Group();
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdde8f5, emissiveIntensity: 0.45, flatShading: false });
  const sphere = new THREE.IcosahedronGeometry(1, 2);
  const r = rng(42);
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    const n = 5 + ((r() * 5) | 0);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(sphere, cm);
      const s = 7 + r() * 9;
      m.scale.set(s * 1.3, s * 0.75, s);
      m.position.set((j - n / 2) * 9 + r() * 5, r() * 4, r() * 8 - 4);
      c.add(m);
    }
    const ang = r() * Math.PI * 2, dist = 350 + r() * 600;
    c.position.set(Math.cos(ang) * dist + 50, 150 + r() * 120, Math.sin(ang) * dist);
    c.rotation.y = r() * Math.PI;
    c.userData.speed = 1.5 + r() * 2;
    clouds.add(c);
  }
  scene.add(clouds);
  // звезди (виждат се само нощем)
  const starN = 1400;
  const sp = new Float32Array(starN * 3);
  const sr = rng(77);
  for (let i = 0; i < starN; i++) {
    const th = sr() * Math.PI * 2, ph = Math.acos(1 - sr() * 0.95);
    sp.set([Math.sin(ph) * Math.cos(th) * 1300, Math.cos(ph) * 1300, Math.sin(ph) * Math.sin(th) * 1300], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  scene.add(stars);
  return {
    uniforms: mat.uniforms,
    stars,
    cloudMat: cm,
    update(dt: number) {
      for (const c of clouds.children) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 1000) c.position.x = -900;
      }
    },
  };
}
