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
        float foam = smoothstep(0.86, 0.96, r) * (0.6 + 0.4*sin(atan(p.y,p.x)*14.0 + t*1.5));
        col = mix(col, vec3(0.93,0.97,0.98), foam*0.7);
        float a = smoothstep(1.0, 0.95, r);
        gl_FragColor = vec4(col, a * 0.94);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

/** Езеро: бряг, вода и (по желание) водни лилии около него се добавят отвън. */
export function buildPond(x: number, z: number, rx: number, rz: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  // бряг — пръст и пясък
  const bank = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#a88a5c', roughness: 1 }),
  );
  bank.scale.set(rx + 1.3, 1, rz + 1.3);
  bank.position.y = 0.04;
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
