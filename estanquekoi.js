import * as THREE from "three";

/* ========= Utils ========= */
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

/* ========= Renderer ========= */
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ========= Scene ========= */
const scene = new THREE.Scene();

/* ========= Camera (TOP-DOWN ORTHO) ========= */
let viewSize = 18; // “metros” visibles (ajusta sensación de zoom)
let aspect = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(
  -viewSize*aspect/2, viewSize*aspect/2,
   viewSize/2, -viewSize/2,
  0.1, 100
);
camera.position.set(0, 20, 0);      // arriba
camera.lookAt(0, 0, 0);             // mira al centro
camera.up.set(0, 0, -1);            // orienta “arriba” del mundo hacia -Z

/* ========= Water plane (shader) ========= */
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200, 1, 1),
  new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0,0) },
      uDeep: { value: new THREE.Color("#061018") },
      uShallow: { value: new THREE.Color("#0b3a4d") }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec2 vUv;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1,0));
        float c = hash(i + vec2(0,1));
        float d = hash(i + vec2(1,1));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      void main(){
        vec2 p = vUv;

        // “profundidad” suave
        float depth = smoothstep(0.0, 1.0, p.y);
        vec3 col = mix(uDeep, uShallow, depth);

        // ondas lentas
        float w = 0.0;
        w += sin((p.x*8.0 + uTime*0.7)) * 0.03;
        w += cos((p.y*7.0 - uTime*0.6)) * 0.03;
        w += sin((p.x+p.y)*10.0 + uTime*0.5) * 0.02;

        // caústicas fake (ruido animado)
        float n1 = noise(p*18.0 + vec2(uTime*0.10, -uTime*0.08));
        float n2 = noise(p*26.0 + vec2(-uTime*0.06, uTime*0.12));
        float caust = pow(n1*n2*1.6, 3.0) * 0.35;

        // interacción mouse: pequeño brillo/rizo
        float d = distance(p, uMouse);
        float ripple = exp(-d*10.0) * (0.5 + 0.5*sin(uTime*6.0 - d*40.0)) * 0.08;

        col += (w + caust + ripple);

        // viñeteado suave
        float v = smoothstep(0.95, 0.25, distance(p, vec2(0.5)));
        col *= (0.88 + 0.12*v);

        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
);
water.rotation.x = -Math.PI/2;
water.position.y = 0;
scene.add(water);

/* ========= Mouse mapping to water UV ========= */
const mouseNDC = new THREE.Vector2(0,0);
window.addEventListener("pointermove", (e)=>{
  mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;

  // en ortho cenital, podemos mapear a UV aprox. (0..1)
  const u = (e.clientX / innerWidth);
  const v = 1.0 - (e.clientY / innerHeight);
  water.material.uniforms.uMouse.value.set(u, v);
});

/* ========= Koi (flexible spine made of segments) ========= */
const koi = new THREE.Group();
scene.add(koi);

// Parámetros koi
const SEG = 22;            // segmentos del cuerpo
const L = 6.0;             // longitud total
const headW = 0.65;        // ancho cabeza
const tailW = 0.12;        // ancho cola
const thickness = 0.06;    // “levantado” mínimo para que pille luz (aunque es cenital)

const segMeshes = [];
const segMat = new THREE.MeshStandardMaterial({
  color: 0xf4f1ea, roughness: 0.75, metalness: 0.0
});

const spotMat = new THREE.MeshStandardMaterial({
  color: 0xff3a2e, roughness: 0.8, metalness: 0.0, transparent:true, opacity:0.85
});

// Luces suaves (cenital + relleno)
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const topLight = new THREE.DirectionalLight(0xffffff, 0.9);
topLight.position.set(0, 10, 2);
scene.add(topLight);

// Construimos cada “anillo” como elipse (cuerpo)
for(let i=0;i<SEG;i++){
  const t = i/(SEG-1);
  const w = headW*(1-t) + tailW*t;
  const geo = new THREE.CylinderGeometry(w, w*0.98, thickness, 16, 1, true);
  const m = new THREE.Mesh(geo, segMat);
  // cilindro por defecto vertical; lo tumbamos para que sea “disco” sobre el agua
  m.rotation.x = Math.PI/2;
  koi.add(m);
  segMeshes.push(m);

  // algunas “manchas” en 3-4 segmentos
  if(i===4 || i===8 || i===12){
    const sg = new THREE.CircleGeometry(w*0.65, 18);
    const sm = new THREE.Mesh(sg, spotMat);
    sm.position.y = thickness*0.6;
    sm.rotation.x = -Math.PI/2;
    // desplazamos un poco lateral para que parezca patrón real
    sm.position.z = (i===8 ? 0.15 : -0.12);
    m.add(sm);
  }
}

// cola (triángulo)
const tailGeo = new THREE.PlaneGeometry(0.9, 0.6);
const tailMat = new THREE.MeshStandardMaterial({
  color: 0xf7f5ef, roughness:0.8, side:THREE.DoubleSide, transparent:true, opacity:0.85
});
const tail = new THREE.Mesh(tailGeo, tailMat);
tail.rotation.x = -Math.PI/2;
koi.add(tail);

/* ========= Natural swimming (position + heading + body wave) ========= */
const clock = new THREE.Clock();

// estado del pez (posición y velocidad)
const pos = new THREE.Vector2(-2, 1);
const vel = new THREE.Vector2(1.2, 0.6).normalize().multiplyScalar(1.8);

// límites del “estanque” (en coords mundo XZ)
const bounds = { x: 8.5, z: 5.5 };

// objetivo suave que cambia con el tiempo
function desiredDirection(t){
  // campo de flujo suave (como corriente)
  const a = 0.9, b = 0.6;
  const dx = Math.sin(t*0.35) * a + Math.sin((pos.y+t)*0.6)*0.35;
  const dz = Math.cos(t*0.28) * b + Math.cos((pos.x-t)*0.55)*0.35;
  return new THREE.Vector2(dx, dz).normalize();
}

function animate(){
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  water.material.uniforms.uTime.value = t;

  // dirección deseada + suavizado (movimiento natural)
  const des = desiredDirection(t);
  vel.lerp(des.multiplyScalar(2.0), 0.02);

  // avance
  pos.addScaledVector(vel, 0.016);

  // rebote suave en bordes (sin parecer pinball)
  if(pos.x > bounds.x) vel.x = -Math.abs(vel.x);
  if(pos.x < -bounds.x) vel.x = Math.abs(vel.x);
  if(pos.y > bounds.z) vel.y = -Math.abs(vel.y);
  if(pos.y < -bounds.z) vel.y = Math.abs(vel.y);

  // heading (ángulo) según velocidad
  const heading = Math.atan2(vel.y, vel.x);

  // colocamos el grupo koi en el agua (X,Z)
  koi.position.set(pos.x, 0.02, pos.y);
  koi.rotation.y = -heading; // en Y porque estamos en plano XZ

  // onda viajando por el cuerpo (cabeza estable, cola se mueve más)
  for(let i=0;i<SEG;i++){
    const u = i/(SEG-1);
    const amp = (u*u) * 0.55;          // más en la cola
    const phase = t*6.5 - u*8.0;       // viaja hacia atrás
    const bend = Math.sin(phase) * amp * 0.35;

    // cada segmento se coloca a lo largo de la espina (eje X local)
    const x = (u*L) - (L*0.35);
    const z = bend;

    const seg = segMeshes[i];
    seg.position.set(x, 0.02, z);
    seg.rotation.y = bend * 0.35; // ligera rotación del “anillo”
  }

  // cola al final
  tail.position.set((L*0.65), 0.02, Math.sin(t*6.5 - 1.0*8.0)*0.35);
  tail.rotation.y = Math.sin(t*6.5 - 1.0*8.0) * 0.6;

  renderer.render(scene, camera);
}

animate();

/* ========= Resize ========= */
window.addEventListener("resize", ()=>{
  renderer.setSize(innerWidth, innerHeight);
  aspect = innerWidth/innerHeight;
  camera.left = -viewSize*aspect/2;
  camera.right = viewSize*aspect/2;
  camera.top = viewSize/2;
  camera.bottom = -viewSize/2;
  camera.updateProjectionMatrix();
});
