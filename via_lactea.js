(() => {
  const canvas = document.getElementById("space");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true });
  if (!gl) {
    console.error("WebGL2 no disponible");
    return;
  }

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

  function program(vsSrc, fsSrc) {
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
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;

  in vec2 vUv;
  out vec4 o;

  uniform vec2 uRes;
  uniform float uTime;

  // ------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x)
         + (c - a) * u.y * (1.0 - u.x)
         + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, -1.2, 1.2, 1.6);

    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }

  vec3 palette(float t) {
    vec3 a = vec3(0.035, 0.045, 0.09);
    vec3 b = vec3(0.08, 0.12, 0.24);
    vec3 c = vec3(0.42, 0.28, 0.62);
    vec3 d = vec3(1.00, 0.78, 0.40);

    float s1 = smoothstep(0.0, 0.55, t);
    float s2 = smoothstep(0.62, 1.0, t);

    return mix(mix(a, b, s1), mix(c, d, s2), t);
  }

  vec3 starTint(float h) {
    vec3 warm = vec3(1.00, 0.92, 0.82);
    vec3 cold = vec3(0.78, 0.86, 1.00);
    vec3 neutral = vec3(1.00, 0.98, 0.95);
    float t = smoothstep(0.2, 0.8, h);
    return mix(mix(warm, neutral, 0.5), cold, t);
  }

  // ------------------------------------------------------------
  // Estrella redonda dentro de una celda
  // ------------------------------------------------------------
  vec3 starCell(vec2 uv, float scale, float threshold, float sizeMul, float seed) {
    vec2 p = uv * scale;
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;

    float h = hash21(id + seed);

    if (h < threshold) return vec3(0.0);

    vec2 rnd = hash22(id + seed * 7.13) - 0.5;
    vec2 center = rnd * 0.72;

    vec2 d = gv - center;
    float dist = length(d);

    float brightRnd = hash21(id + seed * 13.7);
    float twinkle = 0.72 + 0.28 * sin(uTime * (1.4 + brightRnd * 2.7) + brightRnd * 20.0);

    float radius = mix(0.010, 0.030, brightRnd) * sizeMul;
    float core = exp(-pow(dist / radius, 2.0) * 2.8);
    float halo = exp(-pow(dist / (radius * 3.8), 2.0) * 1.1) * 0.35;

    vec3 tint = starTint(hash21(id + seed * 19.3));
    float intensity = (core + halo) * twinkle;

    return tint * intensity;
  }

  // ------------------------------------------------------------
  // Estrella brillante con destello suave
  // ------------------------------------------------------------
  vec3 brightStarCell(vec2 uv, float scale, float threshold, float seed) {
    vec2 p = uv * scale;
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;

    float h = hash21(id + seed);
    if (h < threshold) return vec3(0.0);

    vec2 rnd = hash22(id + seed * 9.71) - 0.5;
    vec2 center = rnd * 0.68;
    vec2 d = gv - center;

    float dist = length(d);
    float ang = atan(d.y, d.x);

    float rnd2 = hash21(id + seed * 5.33);
    float twinkle = 0.82 + 0.18 * sin(uTime * (1.1 + rnd2 * 1.7) + rnd2 * 30.0);

    float radius = mix(0.018, 0.05, rnd2);
    float core = exp(-pow(dist / radius, 2.0) * 3.2);
    float halo = exp(-pow(dist / (radius * 5.0), 2.0) * 1.2) * 0.55;

    float spikes = pow(max(0.0, cos(ang * 4.0)), 18.0);
    spikes *= exp(-dist / (radius * 7.0)) * 0.35;

    vec3 tint = mix(vec3(1.0, 0.95, 0.88), vec3(0.82, 0.90, 1.0), hash21(id + seed * 3.1));
    return tint * (core * 1.8 + halo + spikes) * twinkle;
  }

  void main() {
    // Coordenadas centradas y corregidas por aspecto
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uRes.x / uRes.y;

    float r = length(uv);

    // Rotación lenta global
    float t = uTime * 0.05;
    vec2 guv = rot(t) * uv;

    // Fondo base
    vec3 col = vec3(0.004, 0.006, 0.015);
    col += vec3(0.008, 0.010, 0.020) * (1.0 - smoothstep(0.0, 1.5, r));

    // ------------------------------------------------------------
    // Banda de la Vía Láctea
    // ------------------------------------------------------------
    float bandLine = abs(guv.y * 0.88 + guv.x * 0.22);
    float band = exp(-pow(bandLine, 2.0) * 2.8);

    // Núcleo desplazado un poco para que no quede demasiado centrado
    vec2 corePos = guv - vec2(-0.18, 0.02);
    float core = exp(-dot(corePos, corePos) * 2.2);

    // Polvo y nubes
    vec2 p1 = rot(0.18 + t * 0.55) * (guv * 1.8);
    vec2 p2 = rot(-0.35 + t * 0.25) * (guv * 3.0);

    float dustA = fbm(p1 * 1.8);
    float dustB = fbm(p2 * 0.9 + 17.0);
    float dust = pow(dustA * dustB, 1.25);

    float filaments = fbm(guv * 5.5 + vec2(0.0, t * 0.4));
    filaments = smoothstep(0.45, 0.85, filaments);

    float neb = band * (0.22 + 1.15 * dust) + core * 0.85;
    vec3 nebCol = palette(clamp(0.18 + neb * 0.9 + core * 0.35, 0.0, 1.0));

    col += nebCol * neb * 0.92;
    col += vec3(0.12, 0.10, 0.18) * filaments * band * 0.10;

    // Franjas oscuras de polvo
    float darkDust = fbm(guv * 4.2 - vec2(0.0, t * 0.2));
    darkDust = smoothstep(0.35, 0.75, darkDust) * band;
    col *= 1.0 - darkDust * 0.22;

    // ------------------------------------------------------------
    // Campo estelar mejorado
    // ------------------------------------------------------------
    float bandBoost = mix(0.95, 1.9, clamp(band + core * 0.3, 0.0, 1.0));

    vec3 stars = vec3(0.0);
    stars += starCell(uv, 140.0, 0.9965, 1.0, 11.0);
    stars += starCell(uv, 220.0, 0.9972, 0.85, 23.0);
    stars += starCell(uv, 320.0, 0.9982, 0.65, 37.0);

    vec3 bandStars = vec3(0.0);
    bandStars += starCell(uv + vec2(0.003, -0.001), 180.0, 0.9957, 1.0, 51.0);
    bandStars += starCell(uv + vec2(-0.002, 0.002), 280.0, 0.9970, 0.8, 67.0);

    vec3 bright = vec3(0.0);
    bright += brightStarCell(uv, 40.0, 0.9986, 101.0);
    bright += brightStarCell(uv, 65.0, 0.9991, 151.0);

    col += stars;
    col += bandStars * bandBoost * 0.95;
    col += bright * mix(0.9, 1.25, band);

    // Una ligera nube de estrellas minúsculas, casi polvo luminoso
    float micro = hash21(floor(uv * 600.0));
    float microStars = smoothstep(0.99915, 1.0, micro) * (0.55 + 0.45 * sin(uTime * 1.7 + micro * 30.0));
    col += vec3(0.85, 0.87, 1.0) * microStars * mix(0.4, 1.1, band);

    // ------------------------------------------------------------
    // Acabado
    // ------------------------------------------------------------
    float vign = smoothstep(1.35, 0.18, r);
    col *= vign;

    // Ligero refuerzo del núcleo
    col += vec3(0.22, 0.16, 0.08) * pow(core, 1.8) * 0.35;

    // Tonemap suave
    col = 1.0 - exp(-col * 1.22);

    // Gamma
    col = pow(col, vec3(0.95));

    o = vec4(col, 1.0);
  }`;

  const prog = program(VS, FS);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]),
    gl.STATIC_DRAW
  );

  const locPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  const uResLoc = gl.getUniformLocation(prog, "uRes");
  const uTimeLoc = gl.getUniformLocation(prog, "uTime");

  const t0 = performance.now();

  function frame(now) {
    const time = (now - t0) / 1000;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      resize();
    }

    gl.useProgram(prog);
    gl.bindVertexArray(vao);

    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform1f(uTimeLoc, time);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
