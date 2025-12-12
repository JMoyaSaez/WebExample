import * as THREE from "three";

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- Scene / Camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 14;

// ---------- Background shader ----------
const bgGeo = new THREE.PlaneGeometry(2, 2);
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    void main(){
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;

    float noise(vec2 p){
      return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / vec2( window.innerWidth, window.innerHeight );
      vec2 p = uv * 2.0 - 1.0;

      float n = noise(p * 4.0 + uTime * 0.05);
      float glow = exp(-length(p) * 1.6);

      vec3 col = vec3(0.02,0.03,0.06)
               + vec3(0.5,0.1,0.2) * glow * 0.4
               + n * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const bg = new THREE.Mesh(bgGeo, bgMat);
bg.frustumCulled = false;
scene.add(bg);

// ---------- Koi (entity style) ----------
const koi = new THREE.Group();
scene.add(koi);

// cuerpo simple (iog-style)
const bodyGeo = new THREE.PlaneGeometry(2.4, 0.9);
const bodyMat = new THREE.MeshBasicMaterial({
  color: 0xff4a4a,
  transparent: true,
  opacity: 0.9
});
const body = new THREE.Mesh(bodyGeo, bodyMat);
koi.add(body);

// cola
const tailGeo = new THREE.PlaneGeometry(1.1, 0.6);
const tail = new THREE.Mesh(tailGeo, bodyMat);
tail.position.x = -1.6;
koi.add(tail);

// ---------- Movimiento ----------
const clock = new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  const t = clock.elapsedTime;

  bgMat.uniforms.uTime.value = t;

  // movimiento tipo iog
  koi.position.x = Math.sin(t * 0.25) * 6;
  koi.position.y = Math.cos(t * 0.33) * 3;
  koi.rotation.z = Math.sin(t * 1.8) * 0.2;

  // ondulación
  tail.rotation.z = Math.sin(t * 6) * 0.5;

  renderer.render(scene, camera);
}

animate();

// ---------- Resize ----------
window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
