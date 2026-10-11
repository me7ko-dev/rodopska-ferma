import * as THREE from 'three';

// Дъга след дъжда: голяма полупрозрачна дъга в небето, която бавно избледнява.

const COLS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#30b0ff', '#3a5bd9', '#9b59d0'];

export class Rainbow {
  mesh: THREE.Mesh;
  private life = 0;
  private max = 70;

  constructor(scene: THREE.Scene) {
    const R = 62, W = 7, seg = 96, bands = COLS.length;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const c = new THREE.Color();
    for (let b = 0; b <= bands; b++) {
      const r = R - W / 2 + (W * b) / bands;
      c.set(COLS[Math.min(bands - 1, b)]);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI;
        pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        // по краищата и в долния край — прозрачна
        col.push(c.r, c.g, c.b);
      }
    }
    for (let b = 0; b < bands; b++) for (let i = 0; i < seg; i++) {
      const o = b * (seg + 1) + i, n = o + seg + 1;
      idx.push(o, n, o + 1, o + 1, n, n + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } },
      vertexShader: `varying vec3 vC; varying vec3 vP; void main() { vC = color; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uA; varying vec3 vC; varying vec3 vP;
        void main() {
          float h = smoothstep(4.0, 34.0, vP.y);
          gl_FragColor = vec4(vC, uA * 0.3 * h);
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  /** Показва дъгата зад фермата — откъм страната, накъдето гледа камерата. */
  show(cam: THREE.PerspectiveCamera) {
    // камерата гледа отгоре — дъгата е зад фермата, обърната към камерата и минава през целия кадър
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const L = 30;
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * L;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    this.mesh.position.copy(cam.position).addScaledVector(fwd, L).addScaledVector(up, -half * 0.8);
    this.mesh.quaternion.copy(cam.quaternion);
    this.mesh.scale.setScalar((half * 1.55) / 62);
    this.life = this.max;
    this.mesh.visible = true;
  }

  update(dt: number) {
    if (this.life <= 0) { this.mesh.visible = false; return; }
    this.life -= dt;
    const t = this.life / this.max;
    // плавно се появява и бавно изчезва
    const a = Math.min(1, (1 - t) * 6) * Math.min(1, t * 2.5);
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uA.value = a;
  }
}
