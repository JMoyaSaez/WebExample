(() => {
  const canvas = document.getElementById("fluid");
  const info = document.getElementById("info");

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true });
  if (!gl) {
    if (info) info.textContent = "❌ WebGL2 no disponible.";
    return;
  }
  if (info) info.textContent = "✅ Glow test (WebGL2)";

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  window.addEventListener("resize", resize);
  resize();

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(src);
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }
  function createProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  const VS = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  // Glow circular suave. uMouse en UV (0..1), pero el cálculo lo hacemos en "aspect corrected"
  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;

  uniform vec2 uMouse;     // 0..1
  uniform vec2 uRes;       // canvas pixels
  uniform float uTime;     // seconds

  // HSV -> RGB
  vec3 hsv2rgb(vec3 c){
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main(){
    // Corrige aspecto para que el círculo no sea ovalado
    vec2 aspect = vec2(uRes.x / uRes.y, 1.0);

    vec2 p = vUv * aspect;
    vec2 m = uMouse * aspect;

    float d = distance(p, m);

    // Glow: pico fuerte y halo suave
    float core = exp(-d*d * 900.0);   // punto
    float halo = exp(-d*d * 90.0);    // aura

    float h = fract(uTime * 0.12);    // cambia color lento
    vec3 col = hsv2rgb(vec3(h, 0.9, 1.0));

    vec3 c = col * (core * 1.2 + halo * 0.35);

    // fondo negro
    o = vec4(c, 1.0);
  }`;

  const prog = createProgram(VS, FS);

  // Fullscreen quad
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]), gl.STATIC_DRAW);

  const locPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  // Mouse en UV (0..1) usando DPR correctamente
  const mouse = { u: 0.5, v: 0.5 };

  function setMouseFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const xCss = (e.clientX - rect.left);
    const yCss = (e.clientY - rect.top);

    // Convertimos CSS px -> UV directamente con el rect (no con canvas.width)
    mouse.u = xCss / rect.width;
    mouse.v = 1.0 - (yCss / rect.height);
  }

  window.addEventListener("pointermove", (e) => setMouseFromEvent(e), { passive: true });
  window.addEventListener("pointerdown", (e) => setMouseFromEvent(e), { passive: true });

  // Uniform locations
  const uMouseLoc = gl.getUniformLocation(prog, "uMouse");
  const uResLoc   = gl.getUniformLocation(prog, "uRes");
  const uTimeLoc  = gl.getUniformLocation(prog, "uTime");

  let t0 = performance.now();

  function frame(now) {
    const time = (now - t0) / 1000;

    // Si ha cambiado el tamaño por barra, zoom, etc.
    // (GitHub Pages a veces cambia el layout)
    // Re-ajustamos si hace falta:
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) resize();

    gl.useProgram(prog);
    gl.bindVertexArray(vao);

    gl.uniform2f(uMouseLoc, mouse.u, mouse.v);
    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform1f(uTimeLoc, time);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
