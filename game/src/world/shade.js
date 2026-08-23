// Shared shader augmentation for every Lambert material in the game.
//
// Nothing here adds a render pass. Each feature is a few lines spliced into
// the stock MeshLambertMaterial program through onBeforeCompile, so the cost
// is a handful of ALU per vertex or fragment on the same draw calls the game
// already makes. The features, and what switches each one on:
//
//   sun     per-vertex `sun` attribute (0 = in shadow, 1 = lit), baked by the
//           mesher by marching toward the sun through the voxel grid. It masks
//           the DIRECTIONAL light only, so a shadowed face keeps every bit of
//           its sky and ground bounce and never goes black. Chunk meshes only.
//   sway    per-vertex `sway` attribute (0..1): wind displacement in the
//           vertex stage. Tuft tips bend, canopies breathe, trunks stand still.
//   water   animated normal wobble + a single sun specular on the river.
//   mist    height fog, always compiled in, driven by a uniform; density 0 is
//           a no-op, so scenes that want no mist pay one multiply.
//   clouds  a scrolling noise texture darkening the direct light (moving cloud
//           shadows). Define-gated because it is a texture fetch per fragment:
//           only the Rich tier pays for it.
//
// The mist, cloud and time uniforms are shared objects: the renderer writes
// them once per frame and every enhanced material reads them for free.
import * as THREE from '../../vendor/three.module.js';

// sin() arguments wrap cleanly when time wraps at 200 PI provided every
// frequency below is a multiple of 0.01: k * 200 PI is then an integer number
// of turns. Wrapping matters because a phone session can run for an hour and
// a mediump sin of a four-digit argument has no precision left to sway with.
export const TIME_WRAP = Math.PI * 200;

export const SHADE = {
  time: { value: 0 },
  // x: top of the mist (fully clear above), y: floor (full density at and
  // below), z: strength 0..1, w: distance ramp (1/blocks)
  mist: { value: new THREE.Vector4(0, 0, 0, 0.08) },
  mistColor: { value: new THREE.Color(0xdde6ec) },
  cloudAmt: { value: 0 },
  cloudTex: { value: null },
  wind: { value: 1 },
  sunDir: { value: new THREE.Vector3(40, 60, 20).normalize() },
  sunColor: { value: new THREE.Color(0xffe4b8) },
};

const ENHANCED = new Set();
let cloudsOn = false;

// 128x128 tiling value-noise, three octaves, built once and only on demand.
function cloudTexture() {
  if (SHADE.cloudTex.value) return SHADE.cloudTex.value;
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  const grid = (size, seed) => {
    const g = new Float32Array(size * size);
    let s = seed;
    for (let i = 0; i < g.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; g[i] = (s % 1000) / 1000; }
    return (x, y) => {
      const fx = x * size / N, fy = y * size / N;
      const x0 = Math.floor(fx) % size, y0 = Math.floor(fy) % size;
      const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
      const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
      const a = g[y0 * size + x0], b = g[y0 * size + x1], c = g[y1 * size + x0], d = g[y1 * size + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  };
  const o1 = grid(4, 7), o2 = grid(8, 19), o3 = grid(16, 31);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let n = o1(x, y) * 0.6 + o2(x, y) * 0.28 + o3(x, y) * 0.12;
      // mostly clear sky with soft dark blotches: a cloud shadow, not a
      // checkerboard. 1.0 = full sun.
      n = 1 - Math.max(0, (n - 0.5) * 1.6) * 0.55;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(n * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  SHADE.cloudTex.value = tex;
  return tex;
}

// Replace the stock directional-light loop so light 0 (the sun: it is added
// first and is the only shadow caster, and three sorts casters first) is
// masked by the baked sun term and the cloud term. The fill light at index 1
// is left alone: it is the faint opposite-side bounce that keeps faces that
// point away from the sun from dropping to pure ambient.
const LIGHT_LOOP = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getDirectionalLightInfo( directionalLight, directLight );',
  `getDirectionalLightInfo( directionalLight, directLight );
    #if UNROLLED_LOOP_INDEX == 0
      directLight.color *= towcbSunMask;
    #endif`
);

const VERT_PARS = /* glsl */ `
uniform float uTime;
uniform float uWind;
varying vec3 vWPos;
#ifdef USE_SUNMASK
  attribute float sun;
  varying float vSun;
#endif
#ifdef USE_SWAY
  attribute float sway;
#endif
`;

const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
#ifdef USE_SWAY
  if ( sway > 0.0 ) {
    float ph = position.x * 0.9 + position.z * 0.7;
    float w = sin( uTime * 1.6 + ph ) * 0.65 + sin( uTime * 2.7 + ph * 1.9 ) * 0.35;
    transformed.x += w * 0.09 * sway * uWind;
    transformed.z += sin( uTime * 1.2 + position.z * 0.8 - position.x * 0.4 ) * 0.05 * sway * uWind;
  }
#endif
`;

const VERT_WORLD = /* glsl */ `
#include <worldpos_vertex>
vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#ifdef USE_SUNMASK
  vSun = sun;
#endif
`;

const FRAG_PARS = /* glsl */ `
uniform float uTime;
uniform vec4 uMist;
uniform vec3 uMistColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vWPos;
#ifdef USE_SUNMASK
  varying float vSun;
#endif
#ifdef USE_CLOUDS
  uniform sampler2D uCloudTex;
  uniform float uCloudAmt;
#endif
`;

// the mask is computed once, before the light loop, so it is in scope for
// every directional light iteration
const FRAG_MASK = /* glsl */ `
float towcbSunMask = 1.0;
#ifdef USE_SUNMASK
  towcbSunMask *= smoothstep( 0.05, 0.95, vSun );
#endif
#ifdef USE_CLOUDS
  towcbSunMask *= mix( 1.0, texture2D( uCloudTex, vWPos.xz * 0.011 + uTime * vec2( 0.00637, 0.00318 ) ).r, uCloudAmt );
#endif
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
#ifdef USE_WATER
  {
    vec2 wp = vWPos.xz;
    float nx = sin( wp.x * 2.3 + uTime * 1.7 ) * 0.5 + sin( wp.y * 1.7 - uTime * 1.1 + wp.x * 0.6 ) * 0.5;
    float nz = cos( wp.y * 2.1 + uTime * 1.3 ) * 0.5 + sin( wp.x * 1.9 + uTime * 0.9 ) * 0.5;
    vec3 nW = normalize( vec3( nx * 0.16, 1.0, nz * 0.16 ) );
    normal = normalize( ( viewMatrix * vec4( nW, 0.0 ) ).xyz );
  }
#endif
`;

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
#ifdef USE_WATER
  diffuseColor.rgb *= 0.93 + 0.07 * sin( uTime * 2.0 + vWPos.x * 2.1 + vWPos.z * 1.7 );
#endif
`;

const FRAG_LIGHTS_END = /* glsl */ `
#include <lights_fragment_end>
#ifdef USE_WATER
  {
    vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
    vec3 h = normalize( sunV + geometryViewDir );
    float sp = pow( max( dot( normal, h ), 0.0 ), 42.0 );
    reflectedLight.directSpecular += sp * uSunColor * 0.45;
  }
#endif
`;

const FRAG_FOG = /* glsl */ `
#include <fog_fragment>
#ifdef USE_FOG
  if ( uMist.z > 0.0 ) {
    float mh = 1.0 - smoothstep( uMist.y, uMist.x, vWPos.y );
    float md = 1.0 - exp( - vFogDepth * uMist.w );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, uMistColor, uMist.z * mh * md );
  }
#endif
`;

/**
 * Splice the game's shading features into a Lambert material.
 * @param {THREE.Material} mat
 * @param {{sun?:boolean, sway?:boolean, water?:boolean}} opts
 */
export function enhance(mat, opts = {}) {
  if (!mat || mat.userData.towcb) return mat;
  mat.userData.towcb = { sun: !!opts.sun, sway: !!opts.sway, water: !!opts.water };
  mat.defines = mat.defines || {};
  if (opts.sun) mat.defines.USE_SUNMASK = '';
  if (opts.sway) mat.defines.USE_SWAY = '';
  if (opts.water) mat.defines.USE_WATER = '';
  if (cloudsOn) mat.defines.USE_CLOUDS = '';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHADE.time;
    shader.uniforms.uWind = SHADE.wind;
    shader.uniforms.uMist = SHADE.mist;
    shader.uniforms.uMistColor = SHADE.mistColor;
    shader.uniforms.uSunDir = SHADE.sunDir;
    shader.uniforms.uSunColor = SHADE.sunColor;
    shader.uniforms.uCloudTex = SHADE.cloudTex;
    shader.uniforms.uCloudAmt = SHADE.cloudAmt;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', VERT_BEGIN)
      .replace('#include <worldpos_vertex>', VERT_WORLD);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <normal_fragment_begin>', FRAG_NORMAL)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <lights_fragment_begin>', FRAG_MASK + LIGHT_LOOP)
      .replace('#include <lights_fragment_end>', FRAG_LIGHTS_END)
      .replace('#include <fog_fragment>', FRAG_FOG);
  };
  // three caches programs by this key; without it two materials with
  // different defines could be handed the same compiled program
  const tag = `towcb:${opts.sun ? 's' : ''}${opts.sway ? 'w' : ''}${opts.water ? 'a' : ''}`;
  mat.customProgramCacheKey = () => tag + (mat.defines.USE_CLOUDS !== undefined ? ':c' : '');
  ENHANCED.add(mat);
  return mat;
}

// Cloud shadows on or off for every enhanced material. Forces a recompile,
// so call it on a settings change, never per frame.
export function setClouds(on) {
  on = !!on;
  if (on === cloudsOn) return;
  cloudsOn = on;
  if (on) cloudTexture();
  SHADE.cloudAmt.value = on ? 0.85 : 0;
  for (const m of ENHANCED) {
    if (on) m.defines.USE_CLOUDS = '';
    else delete m.defines.USE_CLOUDS;
    m.needsUpdate = true;
  }
}

// advance the shared clock; the renderer calls this once per rendered frame
export function tickShade(dt) {
  let t = SHADE.time.value + dt;
  if (t > TIME_WRAP) t -= TIME_WRAP;
  SHADE.time.value = t;
}
