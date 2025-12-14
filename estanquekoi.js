import * as THREE from "three";

/* =========================
   Renderer / Scene / Camera
========================= */
const canvas = document.getElementById("c") || (() => {
  const c = document.createElement("canvas");
  c.id = "c";
  document.body.appendChild(c);
  return c;
})();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05060a, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.06);

// Ortho zenital
const cam = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.01, 60);
cam.position.set(0, 12, 0.001);
cam.lookAt(0, 0, 0);
scene.add(cam);

// Lights (suaves y creíbles)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(3, 10, 2);
scene.add(sun);

/* =========================
   Water (simple, zenital)
========================= */
const POND_RADIUS = 5.4;
const waterGeo = new THREE.CircleGeometry(POND_RADIUS, 128);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x0b2a3a,
  roughness: 0.22,
  metalness: 0.0,
  transparent: true,
  opacity: 0.95
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
scene.add(water);

// Un “glow” suave alrededor (ayuda a lectura)
const rimGeo = new THREE.RingGeometry(POND_RADIUS * 0.985, POND_RADIUS * 1.02, 128);
const rimMat = new THREE.MeshBasicMaterial({ color: 0x0e3a4e, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
const rim = new THREE.Mesh(rimGeo, rimMat);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.001;
scene.add(rim);

/* =========================
   Koi model (procedural, REALISTA)
   - Silueta correcta + volumen + cola bifurcada + aletas + manchas
========================= */
function makeKoiShape() {
  // Coordenadas en plano XZ (porque estamos cenital)
  const s = new THREE.Shape();

  // Cabeza/nariz (derecha) → cola (izquierda)
  // Puntos diseñados para que el contorno “grite koi”
  s.moveTo(2.65, 0.00);                       // punta nariz
  s.quadraticCurveTo(2.35, 0.65, 1.70, 0.78);  // cráneo -> lomo
  s.quadraticCurveTo(0.70, 0.98, -0.60, 0.70); // cuerpo ancho
  s.quadraticCurveTo(-1.55, 0.50, -2.10, 0.25);// pedúnculo caudal

  // Cola bifurcada (superior)
  s.quadraticCurveTo(-2.55, 0.92, -3.35, 0.55);
  s.quadraticCurveTo(-2.80, 0.25, -2.55, 0.08);

  // Cola bifurcada (inferior)
  s.quadraticCurveTo(-2.80, -0.25, -3.35, -0.55);
  s.quadraticCurveTo(-2.55, -0.92, -2.10, -0.25);

  // Vientre
  s.quadraticCurveTo(-1.55, -0.50, -0.60, -0.70);
  s.quadraticCurveTo(0.70, -0.98, 1.70, -0.78);
  s.quadraticCurveTo(2.35, -0.65, 2.65, 0.00);

  return s;
}

function extrudeTopDown(shape, depth = 0.18) {
  // Extrude crea volumen en +Z (internamente). Luego lo orientamos a XZ con rotaciones.
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 24,
    steps: 1
  });
  geo.computeVertexNormals();
  return geo;
}

function makeFinShape() {
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.0);
  s.quadraticCurveTo(0.55, 0.35, 1.20, 0.05);
  s.quadraticCurveTo(0.65, -0.30, 0.0, 0.0);
  return s;
}

const koi = new THREE.Group();
scene.add(koi);

// Material “piel pez” (sobrio, realista)
const koiMat = new THREE.MeshStandardMaterial({
  color: 0xf6f2ea,
  roughness: 0.55,
  metalness: 0.0
});

// Cuerpo 3D
const koiShape = makeKoiShape();
const koiBodyGeo = extrudeTopDown(koiShape, 0.20);

// Orientación: queremos que el volumen esté vertical (Y arriba), y la silueta en plano XZ.
koiBodyGeo.rotateX(-Math.PI / 2); // Extrude venía en XY+Z; lo pasamos a XZ con Y arriba.
koiBodyGeo.translate(0, 0.10, 0); // levanta un poco del agua

const koiBody = new THREE.Mesh(koiBodyGeo, koiMat);
koi.add(koiBody);

// Manchas (koi pattern) como discos pegados arriba
const spotMat = new THREE.MeshStandardMaterial({
  color: 0xff3b30,
  roughness: 0.62,
  metalness: 0.0,
  transparent: true,
  opacity: 0.92
});

function addSpot(x, z, r, sx = 1.0, sz = 1.0, rot = 0) {
  const g = new THREE.CircleGeometry(r, 28);
  const m = new THREE.Mesh(g, spotMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.205, z);
  m.scale.set(sx, 1, sz);
  m.rotation.z = rot;
  koi.add(m);
}

// Colocación “creíble”: una en cabeza, otra en medio, otra hacia cola
addSpot(1.35, 0.15, 0.42, 1.2, 0.9, 0.3);
addSpot(0.25, -0.22, 0.55, 1.35, 1.0, -0.25);
addSpot(-0.95, 0.12, 0.40, 1.1, 0.85, 0.15);

// Aletas pectorales (semi transparentes)
const finShape = makeFinShape();
const finGeo = extrudeTopDown(finShape, 0.03);
finGeo.rotateX(-Math.PI / 2);
finGeo.translate(0, 0.12, 0);

const finMat = new THREE.MeshStandardMaterial({
  color: 0xf8f6f1,
  roughness: 0.75,
  transparent: true,
  opacity: 0.55
});

const finL = new THREE.Mesh(finGeo, finMat);
finL.position.set(0.85, 0, 0.62);
finL.rotation.y = 0.25;
finL.rotation.z = 0.25;
koi.add(finL);

const finR = new THREE.Mesh(finGeo, finMat);
finR.position.set(0.85, 0, -0.62);
finR.rotation.y = -0.25;
finR.rotation.z = -0.25;
koi.add(finR);

// Aleta dorsal (pequeña)
const dorsalGeo = new THREE.ConeGeometry(0.12, 0.28, 18, 1);
const dorsalMat = finMat.clone();
const dorsal = new THREE.Mesh(dorsalGeo, dorsalMat);
dorsal.position.set(0.10, 0.28, 0);
koi.add(dorsal);

// Centrar koi en el estanque
koi.position.set(0, 0.0, 0);

// Sombra “fake” suave (ayuda mucho a lectura zenital)
const shadowGeo = new THREE.CircleGeometry(1.9, 64);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });
const shadow = new THREE.Mesh(shadowGeo, shadowMat);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.005;
shadow.scale.set(1.25, 1, 0.62);
scene.add(shadow);

/* =========================
   Render loop (SIN movimiento todavía)
========================= */
function render() {
  shadow.position.set(koi.position.x, 0.005, koi.position.z);
  renderer.render(scene, cam);
  requestAnimationFrame(render);
}
render();

/* =========================
   Resize
========================= */
function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);

  const aspect = w / h;
  const view = 6.2;
  cam.left = -view * aspect;
  cam.right = view * aspect;
  cam.top = view;
  cam.bottom = -view;
  cam.updateProjectionMatrix();
}
window.addEventListener("resize", fit);
fit();
