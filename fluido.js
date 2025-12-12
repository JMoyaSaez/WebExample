(() => {
  const canvas = document.getElementById("fluid");
  const info = document.getElementById("info");

  // --- UI (sliders) ---
  const ui = {
    core: document.getElementById("core"),
    halo: document.getElementById("halo"),
    coreVal: document.getElementById("coreVal"),
    haloVal: document.getElementById("haloVal"),
  };

  const LOOK = {
    core: ui.core ? Number(ui.core.value) : 650,
    halo: ui.halo ? Number(ui.halo.value) : 55,
    fade: 0.965, // longitud de la estela (por ahora fijo)
  };

  function syncUI() {
    if (ui.core) LOOK.core = Number(ui.core.value);
    if (ui.halo) LOOK.halo = Number(ui.halo.value);

    if (ui.coreVal) ui.coreVal.textContent = String(LOOK.core);
    if (ui.haloVal) ui.haloVal.textContent = String(LOOK.halo);
  }

  if (ui.core) ui.core.addEventListener("input", syncUI);
  if (ui.halo) ui.halo.addEventListener("input", syncUI);
  syncUI();

  // --- WebGL2 ---
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true });
  if (!gl) {
    if (info) info.textContent = "❌ WebGL2 no disponible.";
    return;
  }

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    if (info) info.textContent = "❌ Falta EXT_color_buffer_float (driver/GPU).";
    return;
  }

  if (info) info.textContent = "✅ Glow + Trail (sliders: Core/Halo)";

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  // shader utils
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

  // Fullscreen quad
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  // Shaders
  const VS = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  // PASS 1: trail = prev * fade + glow(mouse)
  const FS_TRAIL = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;

  uniform sampler2D uPrev;
  uniform vec2 uMouse;     // 0..1
  uniform vec2 uRes;       // pixels
  uniform float uTime;     // sec
  uniform float uFade;     // 0..1
  uniform float uCore;     // core sharpness
  uniform float uHalo;     // halo sharpness

  vec3 hsv2rgb(vec3 c){
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main(){
    vec2 aspect = vec2(uRes.x / uRes.y, 1.0);

    vec2 p = vUv * aspect;
    vec2 m = uMouse * aspect;

    float d = distance(p, m);

    float core = exp(-d*d * uCore);
    float halo = exp(-d*d * uHalo);

    float h = fract(uTime * 0.12);
    vec3 col = hsv2rgb(vec3(h, 0.9, 1.0));

    vec3 glow = col * (core * 1.2 + halo * 0.35);

    vec3 prev = texture(uPrev, vUv).rgb * uFade;

    vec3 outc = prev + glow;
    outc = min(outc, vec3(6.0)); // evita quemar

    o = vec4(outc, 1.0);
  }`;

  // PASS 2: display
  const FS_DISPLAY = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;
  uniform sampler2D uTex;
  void main(){
    vec3 c = texture(uTex, vUv).rgb;
    c = 1.0 - exp(-c * 1.7);
    o = vec4(c, 1.0);
  }`;

  const progTrail = createProgram(VS, FS_TRAIL);
  const progDisp = createProgram(VS, FS_DISPLAY);

  // bind attribute once (same VAO works)
  function bindAttrib(prog) {
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  bindAttrib(progTrail);

  gl.bindVertexArray(null);

  // Mouse in UV via CSS rect (robust)
  const mouse = { u: 0.5, v: 0.5 };
  function setMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouse.u = x;
    mouse.v = 1.0 - y;
  }
  window.addEventListener("pointermove", setMouse, { passive: true });
  window.addEventListener("pointerdown", setMouse, { passive: true });

  // Ping-pong buffers
  let texA, texB, fboA, fboB;

  function makeTex(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  function makeFbo(t) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("FBO incomplete");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
  }

  function initBuffers() {
    const w = canvas.width;
    const h = canvas.height;

    texA = makeTex(w, h);
    texB = makeTex(w, h);
    fboA = makeFbo(texA);
    fboB = makeFbo(texB);

    gl.clearColor(0, 0, 0, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Uniform locations
  const uPrevTrail = gl.getUniformLocation(progTrail, "uPrev");
  const uMouseTrail = gl.getUniformLocation(progTrail, "uMouse");
  const uResTrail = gl.getUniformLocation(progTrail, "uRes");
  const uTimeTrail = gl.getUniformLocation(progTrail, "uTime");
  const uFadeTrail = gl.getUniformLocation(progTrail, "uFade");
  const uCoreTrail = gl.getUniformLocation(progTrail, "uCore");
  const uHaloTrail = gl.getUniformLocation(progTrail, "uHalo");

  const uTexDisp = gl.getUniformLocation(progDisp, "uTex");

  function drawQuad() {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  let ping = true;
  let t0 = performance.now();

  // init once
  resize();
  initBuffers();

  // handle resize
  window.addEventListener("resize", () => {
    resize();
    initBuffers();
  });

  function frame(now) {
    const time = (now - t0) / 1000;

    // auto-resize if layout changes (GitHub Pages sometimes)
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      resize();
      initBuffers();
    }

    const prevTex = ping ? texA : texB;
    const nextFbo = ping ? fboB : fboA;
    const nextTex = ping ? texB : texA;

    // PASS 1: update trail into nextFbo
    gl.useProgram(progTrail);
    gl.bindFramebuffer(gl.FRAMEBUFFER, nextFbo);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(uPrevTrail, 0);

    gl.uniform2f(uMouseTrail, mouse.u, mouse.v);
    gl.uniform2f(uResTrail, canvas.width, canvas.height);
    gl.uniform1f(uTimeTrail, time);
    gl.uniform1f(uFadeTrail, LOOK.fade);

    // sliders:
    gl.uniform1f(uCoreTrail, LOOK.core);
    gl.uniform1f(uHaloTrail, LOOK.halo);

    drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // PASS 2: display nextTex
    gl.useProgram(progDisp);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, nextTex);
    gl.uniform1i(uTexDisp, 0);

    drawQuad();

    ping = !ping;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
