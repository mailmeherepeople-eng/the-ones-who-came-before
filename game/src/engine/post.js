// One merged full-screen pass for the Rich graphics tier.
//
// The scene renders into a single half-float target and this pass writes it
// to the canvas with, in order: a light FXAA (the only anti-aliasing the game
// has; the renderer runs antialias:false for fill rate), a colour grade (warm
// lift in the shadows, a cool pull in the highlights, a little saturation),
// film grain, then the ACES tone map and the sRGB transfer that three.js
// skips when rendering into a target. It is deliberately ONE pass: every
// extra full-screen pass is another few million fragment invocations, which
// is exactly the budget a midrange Android GPU does not have (GAME-OVERVIEW
// section 12). On the Lite tier none of this runs and the CSS vignette and
// the in-material tone map stand in for it.
//
// Hand-rolled rather than vendoring EffectComposer or pmndrs/postprocessing:
// there is no build step here, the pass is forty lines of GLSL, and both
// libraries would add a render pass per effect.
import * as THREE from '../../vendor/three.module.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;     // 1 / render size
uniform float uTime;
uniform float uGrain;
uniform float uSat;
uniform vec3 uLift;      // added to the darks (warm)
uniform vec3 uGain;      // multiplied in (cool highlights)
varying vec2 vUv;
// three prepends the tone-mapping and colour-space helpers to every
// ShaderMaterial on its own; only the apply chunks go at the end of main()

float luma( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }

// FXAA, the short console variant: blend along the dominant luma edge only
// when the local contrast says there is an edge worth blending. Five taps.
vec3 fxaa( vec2 uv ) {
  vec3 rgbM  = texture2D( tDiffuse, uv ).rgb;
  vec3 rgbNW = texture2D( tDiffuse, uv + vec2( -1.0, -1.0 ) * uTexel ).rgb;
  vec3 rgbNE = texture2D( tDiffuse, uv + vec2(  1.0, -1.0 ) * uTexel ).rgb;
  vec3 rgbSW = texture2D( tDiffuse, uv + vec2( -1.0,  1.0 ) * uTexel ).rgb;
  vec3 rgbSE = texture2D( tDiffuse, uv + vec2(  1.0,  1.0 ) * uTexel ).rgb;
  float lM = luma( rgbM ), lNW = luma( rgbNW ), lNE = luma( rgbNE ), lSW = luma( rgbSW ), lSE = luma( rgbSE );
  float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
  float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
  if ( lMax - lMin < max( 0.05, lMax * 0.12 ) ) return rgbM;
  vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( ( lNW + lSW ) - ( lNE + lSE ) ) );
  float dirReduce = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 0.0078125 );
  float rcp = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + dirReduce );
  dir = clamp( dir * rcp, -4.0, 4.0 ) * uTexel;
  vec3 a = 0.5 * ( texture2D( tDiffuse, uv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb + texture2D( tDiffuse, uv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb );
  vec3 b = 0.5 * a + 0.25 * ( texture2D( tDiffuse, uv + dir * -0.5 ).rgb + texture2D( tDiffuse, uv + dir * 0.5 ).rgb );
  float lB = luma( b );
  return ( lB < lMin || lB > lMax ) ? a : b;
}

float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }

void main() {
  vec3 col = fxaa( vUv );
  // grade, in linear light before the tone curve
  col = col * uGain + uLift;
  float l = luma( col );
  col = mix( vec3( l ), col, uSat );
  // grain: fine, monochrome, strongest in the mid-darks
  float g = hash( vUv * 1731.0 + fract( uTime ) * 97.0 ) - 0.5;
  col += g * uGrain * ( 1.0 - smoothstep( 0.0, 1.2, l ) );
  gl_FragColor = vec4( max( col, 0.0 ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(gl) {
    this.gl = gl;
    this.scale = 1;
    const useHalf = gl.capabilities.isWebGL2 && !!gl.extensions.get('EXT_color_buffer_float');
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      type: useHalf ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uTexel: { value: new THREE.Vector2(1 / 4, 1 / 4) },
        uTime: { value: 0 },
        uGrain: { value: 0.035 },
        uSat: { value: 1.12 },
        uLift: { value: new THREE.Vector3(0.01, 0.006, 0.0) },
        uGain: { value: new THREE.Vector3(1.06, 1.06, 1.095) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: true, // the renderer's tone map is applied HERE, once
    });
    // one triangle covering the screen: no diagonal seam, one fewer vertex
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  // `scale` is the render-size fraction: 1 on desktop, under 1 on phones,
  // where a 0.8 target with FXAA on top reads sharper than a native one
  // without, for 64% of the fill
  setSize(w, h, scale = this.scale) {
    this.scale = scale;
    const tw = Math.max(2, Math.round(w * scale)), th = Math.max(2, Math.round(h * scale));
    if (this.target.width !== tw || this.target.height !== th) this.target.setSize(tw, th);
    this.material.uniforms.uTexel.value.set(1 / tw, 1 / th);
  }

  render(scene, camera, time) {
    const gl = this.gl;
    this.material.uniforms.uTime.value = time;
    gl.setRenderTarget(this.target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
