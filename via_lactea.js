(() => {
  const canvas = document.getElementById("space");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true });

  if (!gl) {
    console.error("WebGL2 no disponible");
    return;
  }

  const uiToggle = document.getElementById("uiToggle");
  const panel = document.getElementById("panel");
  const nebulaSlider = document.getElementById("nebulaSlider");
  const starsSlider = document.getElementById("starsSlider");
  const fxToggle = document.getElementById("fxToggle");
  const nebulaValue = document.getElementById("nebulaValue");
  const starsValue = document.getElementById("starsValue");

  const SETTINGS_KEY = "via_lactea_settings_v1";

  const settings = {
    nebula: 0.65,
    stars: 1.45,
    fx: 1.0
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (typeof saved.nebula === "number") settings.nebula = saved.nebula;
      if (typeof saved.stars === "number") settings.stars = saved.stars;
      if (typeof saved.fx === "number") settings.fx = saved.fx ? 1.0 : 0.0;
    } catch (_) {}
  }

  function saveSettings() {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        nebula: settings.nebula,
        stars: settings.stars,
        fx: settings.fx
      })
    );
  }

  function syncUI() {
    nebulaSlider.value = settings.nebula.toFixed(2);
    starsSlider.value = settings.stars.toFixed(2);
    fxToggle.checked = settings.fx > 0.5;
    nebulaValue.textContent = Number(settings.nebula).toFixed(2);
    starsValue.textContent = Number(settings.stars).toFixed(2);
  }

  loadSettings();
  syncUI();

  uiToggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  nebulaSlider.addEventListener("input", () => {
    settings.nebula = parseFloat(nebulaSlider.value);
    nebulaValue.textContent = settings.nebula.toFixed(2);
    saveSettings();
  });

  starsSlider.addEventListener("input", () => {
    settings.stars = parseFloat(starsSlider.value);
    starsValue.textContent = settings.stars.toFixed(2);
    saveSettings();
  });

  fxToggle.addEventListener("change", () => {
    settings.fx = fxToggle.checked ? 1.0 : 0.0;
    saveSettings();
  });

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
  uniform float uNebulaIntensity;
  uniform float uStarDensity;
  uniform float uFxLevel;

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

  mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
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

  vec3 palette(float t) {
    vec3 a = vec3(0.020, 0.030, 0.070);
    vec3 b = vec3(0.060, 0.100, 0.220);
    vec3 c = vec3(0.300, 0.240, 0.520);
    vec3 d = vec3(0.980, 0.820, 0.520);

    float s1 = smoothstep(0.0, 0.55, t);
    float s2 = smoothstep(0.62, 1.0, t);

    return mix(mix(a, b, s1), mix(c, d, s2), t);
  }

  vec3 starTint(float h) {
    vec3 warm = vec3(1.00, 0.92, 0.82);
    vec3 cold = vec3(0.78, 0.87, 1.00);
    vec3 neutral = vec3(0.98, 0.98, 0.97);
    return mix(mix(warm, neutral, 0.5), cold, smoothstep(0.2, 0.8, h));
  }

  vec3 starCell(vec2 uv, float scale, float threshold, float sizeMul, float seed) {
    vec2 p = uv * scale;
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;

    float h = hash21(id + vec2(seed, seed * 1.37));
    if (h < threshold) return vec3(0.0);

    vec2 rnd = hash22(id + vec2(seed * 7.13, seed * 3.71)) - 0.5;
    vec2 center = rnd * 0.72;

    vec2 d = gv - center;
    float dist = length(d);

    float brightRnd = hash21(id + vec2(seed * 13.7, seed * 11.1));
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.1 + brightRnd * 3.0) + brightRnd * 18.0);

    float radius = mix(0.010, 0.028, brightRnd) * sizeMul;
    float core = exp(-pow(dist / radius, 2.0) * 3.2);
    float halo = exp(-pow(dist / (radius * 4.2), 2.0) * 1.0) * 0.35;

    vec3 tint = starTint(hash21(id + vec2(seed * 19.3, seed * 5.2)));
    return tint * (core + halo) * twinkle;
  }

  vec3 brightStarCell(vec2 uv, float scale, float threshold, float seed) {
    vec2 p = uv * scale;
    vec2 id = floor(p);
    vec2 gv = fract(p) - 0.5;

    float h = hash21(id + vec2(seed, seed * 1.17));
    if (h < threshold) return vec3(0.0);

    vec2 rnd = hash22(id + vec2(seed * 9.71, seed * 4.11)) - 0.5;
    vec2 center = rnd * 0.68;
    vec2 d = gv - center;

    float dist = length(d);
    float ang = atan(d.y, d.x);

    float rnd2 = hash21(id + vec2(seed * 5.33, seed * 2.81));
    float twinkle = 0.82 + 0.18 * sin(uTime * (0.9 + rnd2 * 1.8) + rnd2 * 30.0);

    float radius = mix(0.020, 0.050, rnd2);
    float core = exp(-pow(dist / radius, 2.0) * 3.1);
    float halo = exp(-pow(dist / (radius * 5.5), 2.0) * 1.1) * 0.55;

    float spikes = pow(max(0.0, cos(ang * 4.0)), 18.0);
    spikes *= exp(-dist / (radius * 8.0)) * 0.35;

    vec3 tint = mix(vec3(1.0, 0.95, 0.88), vec3(0.84, 0.91, 1.0), hash21(id + vec2(seed * 3.1, seed * 8.0)));

    return tint * (core * 1.9 + halo + spikes) * twinkle;
  }

  vec3 shootingStarEffect(vec2 uv, float aspect) {
    float period = 11.0;
    float idx = floor(uTime / period);
    float local = mod(uTime, period);

    float active = smoothstep(1.05, 1.20, local) * (1.0 - smoothstep(2.15, 2.70, local));

    vec2 rnd = hash22(vec2(idx + 31.0, 91.0));
    float slopeRnd = hash11(idx + 7.0);

    vec2 start = vec2(
      mix(aspect * 1.15, aspect * 0.20, rnd.x),
      mix(1.05, 0.35, rnd.y)
    );

    vec2 dir = normalize(vec2(-1.0, mix(-0.15, -0.45, slopeRnd)));
    float travel = aspect * 1.45 + 1.4;
    float prog = clamp((local - 1.05) / 1.45, 0.0, 1.0);
    vec2 head = start + dir * prog * travel;

    vec2 rel = uv - head;
    float along = dot(rel, -dir);
    vec2 closest = (-dir) * clamp(along, 0.0, 0.62);
    float perp = length(rel - closest);

    float trail = exp(-perp * 150.0) * exp(-along * 6.0) * step(0.0, along) * step(along, 0.62);
    float headGlow = exp(-length(uv - head) * 90.0) * 2.1;

    return vec3(1.20, 1.08, 0.92) * (trail + headGlow) * active;
  }

  vec3 supernovaEffect(vec2 uv, float aspect) {
    float period = 27.0;
    float idx = floor(uTime / period);
    float local = mod(uTime, period);

    float active = smoothstep(5.0, 5.9, local) * (1.0 - smoothstep(10.0, 13.2, local));
    float burst = clamp((local - 5.0) / 4.0, 0.0, 1.0);

    vec2 rnd = hash22(vec2(idx + 101.0, 7.0));
    vec2 pos = vec2(
      mix(-aspect * 0.75, aspect * 0.75, rnd.x),
      mix(-0.42, 0.42, rnd.y)
    );

    vec2 dvec = uv - pos;
    float d = length(dvec);
    float ang = atan(dvec.y, dvec.x);

    float coreFlicker = 0.90 + 0.10 * sin(uTime * 16.0);
    float core = exp(-pow(d / 0.035, 2.0) * 3.2) * coreFlicker;

    float ringRadius = mix(0.02, 0.22, burst);
    float ringWidth = mix(0.010, 0.028, burst);
    float shell = exp(-pow((d - ringRadius) / ringWidth, 2.0) * 8.0) * burst;

    float rays = pow(max(0.0, cos(ang * 6.0)), 14.0);
    rays *= exp(-d / (0.12 + 0.20 * burst)) * 0.55;

    vec3 c1 = vec3(1.55, 1.20, 0.85) * core * 1.8;
    vec3 c2 = vec3(1.15, 0.75, 1.60) * shell * 1.0;
    vec3 c3 = vec3(1.05, 0.95, 1.10) * rays * 0.9;

    return (c1 + c2 + c3) * active;
  }

  void main() {
    float aspect = uRes.x / uRes.y;

    vec2 suv = vUv * 2.0 - 1.0;
    float vignBase = length(suv);

    vec2 uv = suv;
    uv.x *= aspect;

    float t = uTime * 0.045;
    vec2 guv = rot(t) * uv;

    vec3 col = vec3(0.0015, 0.0025, 0.0085);
    col += vec3(0.004, 0.006, 0.016) * (1.0 - smoothstep(0.0, 1.35, vignBase));

    float bandLine = abs(guv.y * 0.88 + guv.x * 0.22);
    float band = exp(-pow(bandLine, 2.0) * 3.0);

    vec2 corePos = guv - vec2(-0.20, 0.02);
    float core = exp(-dot(corePos, corePos) * 2.35);

    vec2 p1 = rot(0.18 + t * 0.55) * (guv * 1.8);
    vec2 p2 = rot(-0.28 + t * 0.22) * (guv * 2.7);

    float dustA = fbm(p1 * 1.7);
    float dustB = fbm(p2 * 1.1 + 19.0);
    float dust = pow(dustA * dustB, 1.35);

    float filaments = fbm(guv * 5.2 + vec2(0.0, t * 0.35));
    filaments = smoothstep(0.46, 0.84, filaments);

    float neb = band * (0.10 + 0.72 * dust) + core * 0.55;
    vec3 nebCol = palette(clamp(0.15 + neb * 0.95 + core * 0.28, 0.0, 1.0));

    col += nebCol * neb * 0.90 * uNebulaIntensity;
    col += vec3(0.10, 0.09, 0.18) * filaments * band * 0.08 * uNebulaIntensity;

    float darkDust = fbm(guv * 4.1 - vec2(0.0, t * 0.22));
    darkDust = smoothstep(0.38, 0.76, darkDust) * band;
    col *= 1.0 - darkDust * 0.20 * uNebulaIntensity;

    float dens = clamp(uStarDensity, 0.4, 2.5);
    float dn = smoothstep(0.4, 2.5, dens);

    float thA = mix(0.9982, 0.9957, dn);
    float thB = mix(0.9988, 0.9964, dn);
    float thC = mix(0.9992, 0.9973, dn);
    float thBandA = mix(0.9978, 0.9950, dn);
    float thBandB = mix(0.9988, 0.9962, dn);
    float thBright1 = mix(0.9994, 0.9986, dn);
    float thBright2 = mix(0.9996, 0.9990, dn);

    vec3 stars = vec3(0.0);
    stars += starCell(uv, 120.0, thA, 1.05, 11.0);
    stars += starCell(uv, 200.0, thB, 0.90, 23.0);
    stars += starCell(uv, 300.0, thC, 0.72, 37.0);

    vec3 bandStars = vec3(0.0);
    bandStars += starCell(uv + vec2(0.003, -0.001), 170.0, thBandA, 1.00, 51.0);
    bandStars += starCell(uv + vec2(-0.002, 0.002), 260.0, thBandB, 0.82, 67.0);

    vec3 bright = vec3(0.0);
    bright += brightStarCell(uv, 38.0, thBright1, 101.0);
    bright += brightStarCell(uv, 62.0, thBright2, 151.0);

    float microRnd = hash21(floor(uv * 620.0));
    float microStars = smoothstep(mix(0.9996, 0.9989, dn), 1.0, microRnd);
    microStars *= 0.55 + 0.45 * sin(uTime * 1.6 + microRnd * 40.0);

    float bandBoost = mix(0.95, 2.0, clamp(band + core * 0.25, 0.0, 1.0));
    col += stars * mix(0.7, 1.35, dn);
    col += bandStars * bandBoost * mix(0.8, 1.35, dn);
    col += bright * mix(0.85, 1.25, band);
    col += vec3(0.84, 0.87, 1.0) * microStars * mix(0.35, 1.05, band) * mix(0.7, 1.25, dn);

    if (uFxLevel > 0.5) {
      col += shootingStarEffect(uv, aspect) * 0.95;
      col += supernovaEffect(uv, aspect) * 0.85;
    }

    col += vec3(0.18, 0.13, 0.08) * pow(core, 1.8) * 0.20 * uNebulaIntensity;

    float vign = smoothstep(1.25, 0.12, vignBase);
    col *= vign;

    col = 1.0 - exp(-col * 1.18);
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
  const uNebulaIntensityLoc = gl.getUniformLocation(prog, "uNebulaIntensity");
  const uStarDensityLoc = gl.getUniformLocation(prog, "uStarDensity");
  const uFxLevelLoc = gl.getUniformLocation(prog, "uFxLevel");

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
    gl.uniform1f(uNebulaIntensityLoc, settings.nebula);
    gl.uniform1f(uStarDensityLoc, settings.stars);
    gl.uniform1f(uFxLevelLoc, settings.fx);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
