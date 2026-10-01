import * as THREE from 'three';

/** Общо време за вятъра (обновява се всеки кадър от main). */
export const windTime = { value: 0 };

/**
 * Добавя полюшване от вятъра към материал: върховете (по-високите точки) се люлеят повече.
 * height — височината (в метри), над която люлеенето е пълно; amp — колко метра се отклонява върхът.
 */
export function addWind(mat: THREE.Material, height = 2, amp = 0.12) {
  const m = mat as THREE.MeshStandardMaterial;
  if (m.userData.wind) return m;
  m.userData.wind = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uTime = windTime;
    sh.uniforms.uWindH = { value: height };
    sh.uniforms.uWindA = { value: amp };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWindH;\nuniform float uWindA;')
      .replace(
        '#include <project_vertex>',
        `vec4 wPos = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  wPos = batchingMatrix * wPos;
#endif
#ifdef USE_INSTANCING
  wPos = instanceMatrix * wPos;
#endif
  wPos = modelMatrix * wPos;
  float hh = clamp( wPos.y / uWindH, 0.0, 1.6 );
  float ph = uTime * 1.55 + wPos.x * 0.23 + wPos.z * 0.19;
  vec2 sway = vec2( sin( ph ) + 0.35 * sin( ph * 2.3 + 1.3 ), cos( ph * 0.83 ) * 0.55 ) * uWindA * hh * hh;
  wPos.xz += sway;
  vec4 mvPosition = viewMatrix * wPos;
  gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + `wind${height}_${amp}`;
  m.needsUpdate = true;
  return m;
}

/** Добавя вятър към всички материали в обект (напр. дърво). */
export function windify(root: THREE.Object3D, height = 4, amp = 0.15, filter?: (m: THREE.Material) => boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) if (!filter || filter(mat)) addWind(mat, height, amp);
  });
}
