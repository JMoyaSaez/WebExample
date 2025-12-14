import * as THREE from "three";

const canvas = document.getElementById("c");
const statsEl = document.getElementById("stats");

const DPR = Math.min(2, window.devicePixelRatio || 1);
const clock = new THREE.Clock();

let paused = false;

// ===== Scene / Camera (ZENITAL) =====
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x03040a, 0.05);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x05060a, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const cam = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.01, 50);
cam.position.set(0, 10.5, 0.001); // casi 100% arriba
cam.lookAt(0, 0, 0);
scene.add(cam);

// ===== Lights (suaves) =====
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(2, 8, 3);
scene.add(sun);

// ===== Pond params =====
const POND_RADIUS = 5.2;
const WATER_Y = 0.02;

// ===== Mouse / Interaction =====
const pointerNDC = new THREE.Vector2(0, 0);
const pointerWorld = new THREE.Vector3(0, 0, 0);
let pointerHasWorld = false;

let attractMode = false; // click = comida
let attractTimer = 0;

window.addEventListener("mousemove", (e) => {
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("mousedown", () => {
  attractMode = true;
  attractTimer = 2.5;
});

window.addEventListener("mouseup", () => {
  // deja que decaiga suave
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") paused = !paused;
});

// ===== Helpers =====
function clampLen(v, maxLen) {
  const l = v.length();
  if (l > maxLen) v.multiplyScalar(maxLen / (l + 1e-9));
  return v;
}

function randInCircle(r) {
  const t = Math.random() * Math.PI * 2;
  const u = Math.random() + Math.random();
  const rr = u > 1 ? 2 - u : u;
  return new THREE.Vector2(Math.cos(t) * rr * r, Math.sin(t) * rr * r);
}

// ===== Water plane (shader: caustics + ripples + distortion) =====
const waterGeo = new THREE.CircleGeometry(POND_RADIUS, 128);

const waterMat = new THREE.ShaderMaterial({
  transparent: false,
  depthWrite: true,
  depthTest: true,
  uniforms: {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerStrength: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth * DPR, window.innerHeight * DPR) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vPos;
    void main(){
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vPos;

    uniform float uTime;
    uniform vec2 uPointer;
    uniform float uPointerStrength;

    // hash / noise
    float hash(vec2 p){
      p = fract(p*vec2(123.34, 345.45));
      p += dot(p,p+34.345);
      return fract(p.x*p.y);
    }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0,0.0));
      float c = hash(i + vec2(0.0,1.0));
      float d = hash(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }

    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      for(int i=0;i<5;i++){
        v += a*noise(p);
        p *= 2.02;
        a *= 0.5;
      }
      return v;
    }

    void main(){
      // base water tone
      vec2 uv = vUv;
      vec2 p = (vPos.xz) / 6.0;

      // gentle distortion
      float n1 = fbm(p*3.0 + vec2(uTime*0.05, -uTime*0.04));
      float n2 = fbm(p*6.0 + vec2(-uTime*0.06, uTime*0.03));
      vec2 distort = vec2(n1 - 0.5, n2 - 0.5) * 0.06;

      // caustics (fake)
      float c = fbm((p + distort)*10.0 + uTime*0.08);
      c = smoothstep(0.55, 0.92, c);

      // ripple around pointer (in pond-space: xz)
      vec2 d = (vPos.xz - uPointer);
      float dist = length(d);
      float ripple = 0.0;
      if(uPointerStrength > 0.001){
        ripple = sin(dist*10.0 - uTime*6.0) * exp(-dist*1.8);
        ripple *= uPointerStrength;
      }

      // combine
      vec3 deep = vec3(0.03, 0.06, 0.10);
      vec3 mid  = vec3(0.05, 0.10, 0.14);
      vec3 hi   = vec3(0.12, 0.20, 0.24);

      float vign = smoothstep(1.0, 0.0, length(vPos.xz)/5.2);
      vec3 col = mix(deep, mid, 0.55 + 0.35*n1);
      col = mix(col, hi, c*0.35);
      col += vec3(0.08,0.10,0.10) * ripple;

      // spec-like glitter
      float glitter = pow(max(0.0, noise((p+distort)*90.0 + uTime*0.2)), 18.0) * 0.45;
      col += glitter;

      col *= 0.8 + 0.2*vign;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2; // plano XZ
water.position.y = WATER_Y;
scene.add(water);

// ===== Fish (Instanced + shader swim) =====
const FISH_COUNT = 24;

// simple fish geometry (capsule-ish + tail)
function makeFishGeometry() {
  // Body as lathe (2D profile revolved)
  const pts = [];
  const L = 1.6;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = (t - 0.5) * L;
    const r =
      0.12 *
      Math.sin(Math.PI * t) *
      (0.65 + 0.35 * Math.sin(Math.PI * t)); // fat mid, thin ends
    pts.push(new THREE.Vector2(r, x));
  }
  const body = new THREE.LatheGeometry(pts, 24);
  body.rotateZ(Math.PI / 2); // make forward axis +X

  // Tail (simple plane)
  const tail = new THREE.PlaneGeometry(0.35, 0.22, 1, 1);
  tail.rotateY(Math.PI / 2);
  tail.translate(-L * 0.5 - 0.12, 0, 0);

  // Merge
  const geom = THREE.BufferGeometryUtils
    ? null
    : null;
  // We can merge without BufferGeometryUtils by manual merge:
  const merged = mergeGeometries([body, tail]);

  // "along" attribute: 0 (tail) -> 1 (head) for swim wave
  const pos = merged.attributes.position;
  const along = new Float32Array(pos.count);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    // x spans roughly [-0.9 .. +0.9]
    const a = THREE.MathUtils.clamp((tmp.x + 0.9) / 1.8, 0, 1);
    along[i] = a;
  }
  merged.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  merged.computeVertexNormals();
  return merged;
}

// Minimal geometry merge helper (no addons)
function mergeGeometries(geoms) {
  // assumes non-indexed OK; convert all to non-indexed
  const converted = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of converted) total += g.attributes.position.count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);

  let o3 = 0;
  let o2 = 0;
  for (const g of converted) {
    pos.set(g.attributes.position.array, o3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o2);
    o3 += g.attributes.position.array.length;
    o2 += g.attributes.uv ? g.attributes.uv.array.length : 0;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (o2 > 0) out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

const fishGeom = makeFishGeometry();

const fishMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uTintA: { value: new THREE.Color("#ffffff") },
    uTintB: { value: new THREE.Color("#ff3b30") },
    uOpacity: { value: 0.90 },
  },
  vertexShader: /* glsl */ `
    precision highp float;
    attribute float aAlong;
    varying vec3 vN;
    varying vec3 vP;
    varying float vAlong;

    uniform float uTime;

    void main(){
      vAlong = aAlong;
      vec3 p = position;

      // swim wave (stronger at tail)
      float tail = pow(1.0 - aAlong, 1.6);
      float w = sin(uTime*7.0 + aAlong*10.0) * 0.08 * tail;
      p.z += w;

      // tiny fin flutter
      p.y += sin(uTime*9.0 + aAlong*14.0) * 0.01 * tail;

      vN = normalMatrix * normal;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec3 vN;
    varying vec3 vP;
    varying float vAlong;

    uniform vec3 uTintA;
    uniform vec3 uTintB;
    uniform float uOpacity;

    // simple procedural "koi pattern"
    float hash(vec2 p){
      p = fract(p*vec2(123.34, 345.45));
      p += dot(p,p+34.345);
      return fract(p.x*p.y);
    }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0,0.0));
      float c = hash(i + vec2(0.0,1.0));
      float d = hash(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }

    void main(){
      vec3 N = normalize(vN);
      float ndl = clamp(dot(N, normalize(vec3(0.25, 1.0, 0.35))), 0.0, 1.0);

      // body base
      vec3 col = uTintA;

      // red patches
      float m = noise(vP.xz*2.8) * 0.6 + noise(vP.xz*6.0) * 0.4;
      m = smoothstep(0.58, 0.82, m);

      // more patches mid-body, less at head
      float mid = smoothstep(0.05, 0.55, vAlong) * smoothstep(0.98, 0.60, vAlong);
      m *= (0.25 + 0.75*mid);

      col = mix(col, uTintB, m);

      // subtle rim
      float rim = pow(1.0 - clamp(dot(N, vec3(0.0,1.0,0.0)), 0.0, 1.0), 2.0);
      col += rim * 0.08;

      // lighting
      col *= 0.55 + 0.75*ndl;

      // depth fade (fog-ish)
      float depth = clamp((vP.y + 0.35) / 0.6, 0.0, 1.0);
      float alpha = uOpacity * (0.75 + 0.25*depth);

      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const fishMesh = new THREE.InstancedMesh(fishGeom, fishMat, FISH_COUNT);
fishMesh.frustumCulled = false;
scene.add(fishMesh);

// ===== Fish simulation (boids-lite + wander + bounds) =====
const fish = [];
for (let i = 0; i < FISH_COUNT; i++) {
  const p2 = randInCircle(POND_RADIUS * 0.82);
  const pos = new THREE.Vector3(p2.x, 0.0, p2.y);

  const a = Math.random() * Math.PI * 2;
  const vel = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.6 + Math.random() * 0.5);

  fish.push({
    pos,
    vel,
    phase: Math.random() * 10,
    depth: -0.12 - Math.random() * 0.28, // bajo agua
    scale: 0.70 + Math.random() * 0.55,
  });
}

const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function updatePointerWorld() {
  // Raycast to plane y=0 in world
  const ray = new THREE.Raycaster();
  ray.setFromCamera(pointerNDC, cam);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ok = ray.ray.intersectPlane(plane, hit);
  if (ok) {
    pointerWorld.copy(hit);
    pointerHasWorld = true;
  } else {
    pointerHasWorld = false;
  }
}

function stepFish(dt) {
  // decay attract
  if (attractMode) {
    attractTimer -= dt;
    if (attractTimer <= 0) attractMode = false;
  }

  const sepW = 1.25;
  const aliW = 0.35;
  const cohW = 0.28;
  const wanW = 0.55;
  const ptrW = attractMode ? 1.15 : 0.60;

  const sepRad = 0.55;
  const neighRad = 1.35;

  for (let i = 0; i < FISH_COUNT; i++) {
    const a = fish[i];

    // neighbors
    const sep = new THREE.Vector3();
    const ali = new THREE.Vector3();
    const coh = new THREE.Vector3();
    let neigh = 0;

    for (let j = 0; j < FISH_COUNT; j++) {
      if (i === j) continue;
      const b = fish[j];
      const d = a.pos.distanceTo(b.pos);
      if (d < neighRad) {
        neigh++;
        ali.add(b.vel);
        coh.add(b.pos);
        if (d < sepRad) {
          const push = a.pos.clone().sub(b.pos);
          push.multiplyScalar(1.0 / (d + 1e-3));
          sep.add(push);
        }
      }
    }

    if (neigh > 0) {
      ali.multiplyScalar(1 / neigh).normalize().sub(a.vel.clone().normalize());
      coh.multiplyScalar(1 / neigh).sub(a.pos).normalize();
    }

    // wander (smooth)
    const t = clock.elapsedTime;
    const w = new THREE.Vector3(
      Math.sin(t * 0.35 + a.phase),
      0,
      Math.cos(t * 0.33 + a.phase * 1.7)
    ).normalize();

    // pointer influence + boundary
    const steer = new THREE.Vector3();
    steer.add(sep.multiplyScalar(sepW));
    steer.add(ali.multiplyScalar(aliW));
    steer.add(coh.multiplyScalar(cohW));
    steer.add(w.multiplyScalar(wanW));

    // boundary: keep inside circle
    const r = Math.sqrt(a.pos.x * a.pos.x + a.pos.z * a.pos.z);
    if (r > POND_RADIUS * 0.92) {
      steer.add(a.pos.clone().multiplyScalar(-1).normalize().multiplyScalar(1.2));
    }

    // pointer: repel by default (como “mano”), attract on click (“comida”)
    if (pointerHasWorld) {
      const toPtr = pointerWorld.clone().sub(a.pos);
      const d = toPtr.length();
      const dir = toPtr.normalize();
      const influence = Math.exp(-d * 0.7);

      if (attractMode) {
        steer.add(dir.multiplyScalar(ptrW * influence));
      } else {
        steer.add(dir.multiplyScalar(-ptrW * 0.65 * influence));
      }
    }

    // integrate
    clampLen(steer, 2.2);
    a.vel.add(steer.multiplyScalar(dt));
    clampLen(a.vel, 1.35);
    a.pos.add(a.vel.clone().multiplyScalar(dt));

    // depth bob (very subtle)
    a.depth += Math.sin((t + a.phase) * 0.8) * 0.0006;
    a.depth = THREE.MathUtils.clamp(a.depth, -0.45, -0.08);
  }
}

function renderFish(t) {
  for (let i = 0; i < FISH_COUNT; i++) {
    const a = fish[i];

    // orientation from velocity
    const dir = a.vel.clone().normalize();
    const yaw = Math.atan2(dir.x, dir.z); // zenital: yaw around Y
    tmpQuat.setFromAxisAngle(up, yaw);

    tmpPos.set(a.pos.x, a.depth, a.pos.z);
    tmpScale.setScalar(a.scale);

    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    fishMesh.setMatrixAt(i, tmpMat);
  }
  fishMesh.instanceMatrix.needsUpdate = true;
}

// ===== Main loop =====
let frames = 0;
let acc = 0;

function tick() {
  requestAnimationFrame(tick);

  const dt = Math.min(0.033, clock.getDelta());
  const t = clock.elapsedTime;

  updatePointerWorld();

  // update uniforms
  waterMat.uniforms.uTime.value = t;
  fishMat.uniforms.uTime.value = t;

  // pointer ripples (only if inside pond)
  if (pointerHasWorld) {
    const r = Math.sqrt(pointerWorld.x * pointerWorld.x + pointerWorld.z * pointerWorld.z);
    const inside = r <= POND_RADIUS;
    waterMat.uniforms.uPointer.value.set(pointerWorld.x, pointerWorld.z);
    waterMat.uniforms.uPointerStrength.value = inside ? 1.0 : 0.0;
  } else {
    waterMat.uniforms.uPointerStrength.value = 0.0;
  }

  if (!paused) {
    stepFish(dt);
    renderFish(t);
  }

  renderer.render(scene, cam);

  // stats
  frames++;
  acc += dt;
  if (acc >= 0.5) {
    const fps = Math.round(frames / acc);
    statsEl.textContent = `FPS: ${fps} · Koi: ${FISH_COUNT} · Mode: ${paused ? "PAUSA" : attractMode ? "COMIDA" : "NORMAL"}`;
    frames = 0;
    acc = 0;
  }
}

tick();

// ===== Resize =====
function fitCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setPixelRatio(DPR);
  renderer.setSize(w, h, false);

  // ortho fit: keep pond always visible, adapt aspect
  const aspect = w / h;
  const view = 6.2;
  cam.left = -view * aspect;
  cam.right = view * aspect;
  cam.top = view;
  cam.bottom = -view;
  cam.updateProjectionMatrix();

  waterMat.uniforms.uResolution.value.set(w * DPR, h * DPR);
}
window.addEventListener("resize", fitCamera);
fitCamera();
