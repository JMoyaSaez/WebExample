(() => {
  const canvas = document.getElementById("fluid");
  const info = document.getElementById("info");

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true });
  if (!gl) { if (info) info.textContent = "❌ WebGL2 no disponible."; return; }

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) { if (info) info.textContent = "❌ Falta EXT_color_buffer_float."; return; }

  if (info) info.textContent = "✅ Glow + Trail (ping-pong)";

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  window.addEventListener("resize", () => { resize(); initBuffers(); });
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

  // Paso A: escribe en un buffer (trail) = (trail anterior * fade) + glow(mouse)
  const FS_TRAIL = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;

  uniform sampler2D uPrev;   // trail anterior
  uniform vec2 uMouse;       // 0..1
  uniform vec2 uRes;         // pixels
  uniform float uTime;       // sec
  uniform float uFade;       // 0.0..1.0 (más alto = estela más larga)

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

    float core = exp(-d*d * 900.0);
    float halo = exp(-d*d * 90.0);

    float h = fract(uTime * 0.12);
    vec3 col = hsv2rgb(vec3(h, 0.9, 1.0));

    vec3 glow = col * (core * 1.2 + halo * 0.35);

    vec3 prev = texture(uPrev, vUv).rgb;

    // Dissipation (estela se desvanece)
    prev *= uFade;

    // Suma (estela + glow actual)
    vec3 outc = prev + glow;

    // Pequeño clamp para evitar quemar blancos
    outc = min(outc, vec3(6.0));

    o = vec4(outc, 1.0);
  }`;

  // Paso B: display del buffer con curva de brillo tipo neón
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
  const progDisp  = createProgram(VS, FS_DISPLAY);

  // Fullscreen quad
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1,1,  1,1
  ]), gl.STATIC_DRAW);

  function bindAttrib(prog){
    const locPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  }
  bindAttrib(progTrail); // mismo VAO sirve para ambos
  gl.bindVertexArray(null);

  // Mouse (UV) desde rect CSS (robusto)
  const mouse = { u: 0.5, v: 0.5 };
  function setMouse(e){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouse.u = x;
    mouse.v = 1.0 - y;
  }
  window.addEventListener("pointermove", setMouse, { passive:true });
  window.addEventListener("pointerdown", setMouse, { passive:true });

  // Ping-pong buffers
  let texA, texB, fboA, fboB;

  function makeTex(w,h){
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
  function makeFbo(t){
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("FBO incomplete");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
  }

  function initBuffers(){
    const w = canvas.width;
    const h = canvas.height;

    texA = makeTex(w,h);
    texB = makeTex(w,h);
    fboA = makeFbo(texA);
    fboB = makeFbo(texB);

    // clear both
    gl.clearColor(0,0,0,1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  initBuffers();

  // uniforms locs
  const uPrevTrail = gl.getUniformLocation(progTrail, "uPrev");
  const uMouseTrail= gl.getUniformLocation(progTrail, "uMouse");
  const uResTrail  = gl.getUniformLocation(progTrail, "uRes");
  const uTimeTrail = gl.getUniformLocation(progTrail, "uTime");
  const uFadeTrail = gl.getUniformLocation(progTrail, "uFade");

  const uTexDisp   = gl.getUniformLocation(progDisp, "uTex");

  function drawFullscreen(targetFbo, prog){
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  let ping = true;
  let t0 = performance.now();

  function frame(now){
    const time = (now - t0) / 1000;

    // auto-resize si cambia layout
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

    // PASS 1: trail update into nextFbo
    gl.useProgram(progTrail);
    gl.bindVertexArray(vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(uPrevTrail, 0);

    gl.uniform2f(uMouseTrail, mouse.u, mouse.v);
    gl.uniform2f(uResTrail, canvas.width, canvas.height);
    gl.uniform1f(uTimeTrail, time);

    // estela: prueba 0.965 (larga) o 0.94 (corta)
    gl.uniform1f(uFadeTrail, 0.965);

    gl.bindFramebuffer(gl.FRAMEBUFFER, nextFbo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.bindVertexArray(null);

    // PASS 2: display nextTex to screen
    gl.useProgram(progDisp);
    gl.bindVertexArray(vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, nextTex);
    gl.uniform1i(uTexDisp, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);

    ping = !ping;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
