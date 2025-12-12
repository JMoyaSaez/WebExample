import * as THREE from "three";

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- Scene / Camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 0, 18);

// ---------- Background (iog-ish) ----------
const bgGeo = new THREE.PlaneGeometry(2, 2);
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTime;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

    float star(vec2 uv, vec2 p){
      float d = length(uv - p);
      return 0.002 / (d*d + 0.0002);
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / vec2(${innerWidth.toFixed(1)}, ${innerHeight.toFixed(1)});
      vec2 p = uv*2.0 - 1.0;
      p.x *= ${ (innerWidth/innerHeight).toFixed(6) };

      // Nebulosa suave
      float r = length(p);
      float haze = exp(-r*1.2);

      // Ruido sutil
      float n = hash(p*12.0 + uTime*0.05) * 0.05;

      vec3 col = vec3(0.02,0.03,0.06);
      col += vec3(0.45,0.10,0.18) * haze * 0.65;
      col += vec3(0.05,0.10,0.18) * haze * 0.35;
      col += n;

      // Estrellitas
      float s = 0.0;
      for(int i=0;i<9;i++){
        vec2 sp = vec2(hash(vec2(float(i),1.2)), hash(vec2(2.7,float(i))));
        sp = sp*2.0 - 1.0;
        sp.x *= ${ (innerWidth/innerHeight).toFixed(6) };
        s += star(p, sp) * (0.2 + 0.8*hash(sp));
      }
      col += vec3(0.7,0.8,1.0) * s * 0.35;

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const bg = new THREE.Mesh(bgGeo, bgMat);
bg.frustumCulled = false;
scene.add(bg);

// ---------- Koi silhouette (shape) ----------
function makeKoiSilhouette(){
  // Perfil lateral estilizado (cuerpo + cola)
  const shape = new THREE.Shape();
  shape.moveTo(2.6, 0.0);         // nariz
  shape.quadraticCurveTo(2.2, 0.65, 1.2, 0.85);   // lomo
  shape.quadraticCurveTo(0.2, 1.05, -1.1, 0.72);  // lomo hacia cola
  shape.quadraticCurveTo(-1.9, 0.55, -2.3, 0.20); // base cola
  // cola (dos lóbulos)
  shape.quadraticCurveTo(-2.8, 0.90, -3.4, 0.45);
  shape.quadraticCurveTo(-2.9, 0.10, -3.4, -0.45);
  shape.quadraticCurveTo(-2.8, -0.90, -2.3, -0.20); // vuelve base cola
  // vientre
  shape.quadraticCurveTo(-1.9, -0.55, -1.1, -0.72);
  shape.quadraticCurveTo(0.2, -1.05, 1.2, -0.85);
  shape.quadraticCurveTo(2.2, -0.65, 2.6, 0.0);

  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.computeVertexNormals();
  return geo;
}

function makeFin(){
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.0);
  s.quadraticCurveTo(0.5, 0.35, 1.1, 0.0);
  s.quadraticCurveTo(0.55, -0.25, 0.0, 0.0);
  const geo = new THREE.ShapeGeometry(s, 10);
  return geo;
}

const koi = new THREE.Group();
scene.add(koi);

// Base koi (blanco perla)
const koiGeo = makeKoiSilhouette();
const koiMat = new THREE.MeshStandardMaterial({
  color: 0xf7f3ef,
  roughness: 0.55,
  metalness: 0.0,
  emissive: new THREE.Color(0x12070a),
  emissiveIntensity: 0.15
});
const koiBody = new THREE.Mesh(koiGeo, koiMat);
koi.add(koiBody);

// Manchas (rojas) como otra malla encima (ligeramente offset)
const spotMat = new THREE.MeshStandardMaterial({
  color: 0xff3b30,
  roughness: 0.6,
  metalness: 0.0,
  transparent: true,
  opacity: 0.75
});
const spots = new THREE.Group();
koi.add(spots);

function addSpot(x,y,rx,ry,rot=0){
  const g = new THREE.CircleGeometry(1, 24);
  const m = new THREE.Mesh(g, spotMat);
  m.scale.set(rx, ry, 1);
  m.position.set(x,y,0.01);
  m.rotation.z = rot;
  spots.add(m);
}
// patrón “koi”
addSpot(1.3, 0.20, 0.55, 0.38, 0.2);
addSpot(0.3, -0.15, 0.65, 0.45, -0.4);
addSpot(-0.8, 0.10, 0.45, 0.30, 0.3);

// Aletas (semi transparentes)
const finMat = new THREE.MeshStandardMaterial({
  color: 0xfaf7f2,
  roughness: 0.7,
  transparent: true,
  opacity: 0.65,
  side: THREE.DoubleSide
});
const finGeo = makeFin();
const finL = new THREE.Mesh(finGeo, finMat);
finL.position.set(0.6, -0.15, 0.02);
finL.rotation.z = 0.25;
koi.add(finL);

const finR = new THREE.Mesh(finGeo, finMat);
finR.position.set(0.6, 0.15, 0.02);
finR.rotation.z = -0.25;
finR.scale.y = -1;
koi.add(finR);

// Luz para que tenga “volumen”
scene.add(new THREE.AmbientLight(0x7aa9ff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(6, 10, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffa0c0, 0.55);
rim.position.set(-10, 6, -10);
scene.add(rim);

// ---------- Motion (iog-style smooth) ----------
const clock = new THREE.Clock();

// “campo” de nado
function swimPose(t){
  const a = 7.2;
  const s = t * 0.22;
  const x = a * Math.sin(s);
  const y = 3.2 * Math.sin(s*1.33) * 0.65;
  return { x, y };
}

function animate(){
  requestAnimationFrame(animate);
  const t = clock.elapsedTime;
  bgMat.uniforms.uTime.value = t;

  const p = swimPose(t);
  koi.position.set(p.x, p.y, 0);

  // orientación hacia el futuro (look-ahead)
  const p2 = swimPose(t + 0.15);
  const dir = new THREE.Vector2(p2.x - p.x, p2.y - p.y);
  const ang = Math.atan2(dir.y, dir.x);
  koi.rotation.z = ang;

  // ondulación (cola + cuerpo) -> deformación simple con escala/rotación de grupo
  const wiggle = Math.sin(t*6.0) * 0.12;
  koiBody.rotation.z = wiggle * 0.35;
  spots.rotation.z = wiggle * 0.45;

  // aletas
  finL.rotation.z = 0.25 + Math.sin(t*10.0) * 0.25;
  finR.rotation.z = -0.25 - Math.sin(t*10.0) * 0.25;

  // “respira” un pelín (da vida)
  const breathe = 1.0 + Math.sin(t*1.7)*0.01;
  koi.scale.set(breathe, breathe, 1);

  renderer.render(scene, camera);
}
animate();

// ---------- Resize ----------
window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
