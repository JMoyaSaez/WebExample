(() => {
  const canvas = document.getElementById("fluid");
  const info = document.getElementById("info");

  const gl = canvas.getContext("webgl2", { alpha:false, antialias:false, depth:false, stencil:false });
  if (!gl) { info.textContent = "❌ WebGL2 no disponible."; return; }

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) { info.textContent = "❌ Falta EXT_color_buffer_float."; return; }

  info.textContent = "✅ OK";

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);

  // === overlay 2D para crosshair (debug) ===
  const overlay = document.createElement("canvas");
  const octx = overlay.getContext("2d");
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.pointerEvents = "none";
  document.body.appendChild(overlay);

  function resizeAll(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);

    canvas.width = w; canvas.height = h;
    overlay.width = w; overlay.height = h;

    gl.viewport(0,0,w,h);
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(src);
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }
  function program(vs, fs){
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  function tex(w,h, internalFormat, format, type, filter=gl.LINEAR){
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }
  function fbo(texture){
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("FBO incomplete");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
  }
  function DoubleFBO(w,h, internalFormat, format, type, filter){
    const t0 = tex(w,h, internalFormat, format, type, filter);
    const t1 = tex(w,h, internalFormat, format, type, filter);
    const f0 = fbo(t0), f1 = fbo(t1);
    return {
      w,h,
      read:{tex:t0,fbo:f0},
      write:{tex:t1,fbo:f1},
      swap(){ const tmp=this.read; this.read=this.write; this.write=tmp; }
    };
  }

  const VS = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main(){ vUv = aPos*0.5 + 0.5; gl_Position = vec4(aPos,0,1); }`;

  const FS_DISPLAY = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uTex;
  void main(){
    vec3 c = texture(uTex, vUv).rgb;
    c = 1.0 - exp(-c * 2.2);
    o = vec4(c, 1.0);
  }`;

  const FS_ADVECT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 uTexel;
  uniform float uDt;
  uniform float uDissipation;
  void main(){
    vec2 vel = texture(uVelocity, vUv).xy;
    vec2 coord = vUv - uDt * vel * uTexel;
    o = texture(uSource, coord) * uDissipation;
  }`;

  const FS_DIVERGENCE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  void main(){
    float L = texture(uVelocity, vUv - vec2(uTexel.x,0)).x;
    float R = texture(uVelocity, vUv + vec2(uTexel.x,0)).x;
    float B = texture(uVelocity, vUv - vec2(0,uTexel.y)).y;
    float T = texture(uVelocity, vUv + vec2(0,uTexel.y)).y;
    o = vec4(0.5*(R-L + T-B), 0,0,1);
  }`;

  const FS_PRESSURE = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexel;
  void main(){
    float L = texture(uPressure, vUv - vec2(uTexel.x,0)).x;
    float R = texture(uPressure, vUv + vec2(uTexel.x,0)).x;
    float B = texture(uPressure, vUv - vec2(0,uTexel.y)).x;
    float T = texture(uPressure, vUv + vec2(0,uTexel.y)).x;
    float div = texture(uDivergence, vUv).x;
    o = vec4((L+R+B+T - div) * 0.25, 0,0,1);
  }`;

  const FS_GRADIENT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  void main(){
    float L = texture(uPressure, vUv - vec2(uTexel.x,0)).x;
    float R = texture(uPressure, vUv + vec2(uTexel.x,0)).x;
    float B = texture(uPressure, vUv - vec2(0,uTexel.y)).x;
    float T = texture(uPressure, vUv + vec2(0,uTexel.y)).x;
    vec2 vel = texture(uVelocity, vUv).xy;
    vel -= 0.5 * vec2(R-L, T-B);
    o = vec4(vel,0,1);
  }`;

  const FS_CURL = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  void main(){
    float L = texture(uVelocity, vUv - vec2(uTexel.x,0)).y;
    float R = texture(uVelocity, vUv + vec2(uTexel.x,0)).y;
    float B = texture(uVelocity, vUv - vec2(0,uTexel.y)).x;
    float T = texture(uVelocity, vUv + vec2(0,uTexel.y)).x;
    o = vec4(0.5*(R-L - (T-B)), 0,0,1);
  }`;

  const FS_VORT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 uTexel;
  uniform float uDt;
  uniform float uCurlStrength;
  void main(){
    float C = texture(uCurl, vUv).x;
    float L = abs(texture(uCurl, vUv - vec2(uTexel.x,0)).x);
    float R = abs(texture(uCurl, vUv + vec2(uTexel.x,0)).x);
    float B = abs(texture(uCurl, vUv - vec2(0,uTexel.y)).x);
    float T = abs(texture(uCurl, vUv + vec2(0,uTexel.y)).x);
    vec2 grad = vec2(R-L, T-B);
    vec2 N = grad / (length(grad)+1e-5);
    vec2 vel = texture(uVelocity, vUv).xy;
    vel += uDt * uCurlStrength * vec2(N.y, -N.x) * C;
    o = vec4(vel,0,1);
  }`;

  const FS_SPLAT = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uTarget;
  uniform vec2 uPoint;
  uniform float uRadius;
  uniform vec3 uValue;
  void main(){
    vec4 base = texture(uTarget, vUv);
    vec2 d = vUv - uPoint;
    float a = exp(-dot(d,d) / (uRadius*uRadius));
    o = vec4(base.rgb + uValue * a, 1.0);
  }`;

  const P = {
    display: program(VS, FS_DISPLAY),
    advect: program(VS, FS_ADVECT),
    divergence: program(VS, FS_DIVERGENCE),
    pressure: program(VS, FS_PRESSURE),
    gradient: program(VS, FS_GRADIENT),
    curl: program(VS, FS_CURL),
    vort: program(VS, FS_VORT),
    splat: program(VS, FS_SPLAT),
  };

  function bindTex(unit, texture){
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }
  function set1i(prog, name, i){
    const loc = gl.getUniformLocation(prog, name);
    if (loc !== null) gl.uniform1i(loc, i);
  }
  function setUniform(prog, name, v){
    const loc = gl.getUniformLocation(prog, name);
    if (loc === null) return;
    if (typeof v === "number") gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
  }
  function drawTo(fboTarget, prog, uniforms){
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboTarget);
    gl.bindVertexArray(vao);
    for (const [k,v] of Object.entries(uniforms || {})) setUniform(prog, k, v);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const SIM = {
    dyeDissipation: 0.985,
    velDissipation: 0.99,
    pressureIters: 18,
    curlStrength: 24.0,
    splatRadius: 0.013,
    dt: 0.016,
  };

  function simRes(){
    const base = 240;
    const aspect = canvas.width / canvas.height;
    return { w: Math.max(64, Math.floor(base*aspect)), h: base };
  }
  function dyeRes(){
    const base = 512;
    const aspect = canvas.width / canvas.height;
    return { w: Math.max(128, Math.floor(base*aspect)), h: base };
  }

  let velocity, dye, divergence, pressure, curl;

  function init(){
    const s = simRes();
    const d = dyeRes();

    velocity = DoubleFBO(s.w, s.h, gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR);
    dye      = DoubleFBO(d.w, d.h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    divergence = { tex: tex(s.w,s.h, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST) };
    divergence.fbo = fbo(divergence.tex);
    pressure = DoubleFBO(s.w,s.h, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST);
    curl = { tex: tex(s.w,s.h, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST) };
    curl.fbo = fbo(curl.tex);

    gl.clearColor(0,0,0,1);
    [velocity.read.fbo, velocity.write.fbo, dye.read.fbo, dye.write.fbo, pressure.read.fbo, pressure.write.fbo, divergence.fbo, curl.fbo]
      .forEach(f => { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.clear(gl.COLOR_BUFFER_BIT); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  init();

  window.addEventListener("resize", () => { resizeAll(); init(); });

  // === pointer bien calculado en PX reales ===
  const pointer = { down:false, xPx:0, yPx:0, u:0.5, v:0.5, pu:0.5, pv:0.5, du:0, dv:0, color:[1,1,1] };

  function hsv2rgb(h,s,v){
    const f=(n)=>{ const k=(n+h*6)%6; return v - v*s*Math.max(Math.min(k,4-k,1),0); };
    return [f(5),f(3),f(1)];
  }

  function updatePointer(e){
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const x = (e.clientX - r.left) * dpr;
    const y = (e.clientY - r.top)  * dpr;

    pointer.xPx = x;
    pointer.yPx = y;

    pointer.pu = pointer.u;
    pointer.pv = pointer.v;

    pointer.u = x / canvas.width;
    pointer.v = 1.0 - (y / canvas.height);

    pointer.du = pointer.u - pointer.pu;
    pointer.dv = pointer.v - pointer.pv;
  }

  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pointer.down=true; updatePointer(e); });
  canvas.addEventListener("pointermove", (e) => { if(pointer.down) updatePointer(e); });
  window.addEventListener("pointerup", () => pointer.down=false);

  function splat(u,v, du,dv, rgb){
    bindTex(0, velocity.read.tex);
    gl.useProgram(P.splat);
    set1i(P.splat, "uTarget", 0);
    drawTo(velocity.write.fbo, P.splat, {
      uPoint:[u,v],
      uRadius: SIM.splatRadius,
      uValue:[du*140.0, dv*140.0, 0.0]
    });
    velocity.swap();

    bindTex(0, dye.read.tex);
    gl.useProgram(P.splat);
    set1i(P.splat, "uTarget", 0);
    drawTo(dye.write.fbo, P.splat, {
      uPoint:[u,v],
      uRadius: SIM.splatRadius*1.4,
      uValue:[rgb[0]*2.3, rgb[1]*2.3, rgb[2]*2.3]
    });
    dye.swap();
  }

  function step(){
    const texel = [1/velocity.w, 1/velocity.h];
    const dyeTexel = [1/dye.w, 1/dye.h];

    if(pointer.down){
      const sp = Math.hypot(pointer.du, pointer.dv);
      if(sp > 1e-6){
        const t = (Date.now()%12000)/12000;
        pointer.color = hsv2rgb(t, 0.9, 1.0);
        splat(pointer.u, pointer.v, pointer.du, pointer.dv, pointer.color);
      }
    }

    // advect velocity
    bindTex(0, velocity.read.tex);
    bindTex(1, velocity.read.tex);
    gl.useProgram(P.advect);
    set1i(P.advect, "uVelocity", 0);
    set1i(P.advect, "uSource", 1);
    drawTo(velocity.write.fbo, P.advect, {
      uTexel: texel, uDt: SIM.dt, uDissipation: SIM.velDissipation
    });
    velocity.swap();

    // curl
    bindTex(0, velocity.read.tex);
    gl.useProgram(P.curl);
    set1i(P.curl, "uVelocity", 0);
    drawTo(curl.fbo, P.curl, { uTexel: texel });

    // vorticity
    bindTex(0, velocity.read.tex);
    bindTex(1, curl.tex);
    gl.useProgram(P.vort);
    set1i(P.vort, "uVelocity", 0);
    set1i(P.vort, "uCurl", 1);
    drawTo(velocity.write.fbo, P.vort, { uTexel: texel, uDt: SIM.dt, uCurlStrength: SIM.curlStrength });
    velocity.swap();

    // divergence
    bindTex(0, velocity.read.tex);
    gl.useProgram(P.divergence);
    set1i(P.divergence, "uVelocity", 0);
    drawTo(divergence.fbo, P.divergence, { uTexel: texel });

    // pressure reset
    gl.clearColor(0,0,0,1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.read.fbo);  gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.write.fbo); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    for(let i=0;i<SIM.pressureIters;i++){
      bindTex(0, pressure.read.tex);
      bindTex(1, divergence.tex);
      gl.useProgram(P.pressure);
      set1i(P.pressure, "uPressure", 0);
      set1i(P.pressure, "uDivergence", 1);
      drawTo(pressure.write.fbo, P.pressure, { uTexel: texel });
      pressure.swap();
    }

    // subtract gradient
    bindTex(0, pressure.read.tex);
    bindTex(1, velocity.read.tex);
    gl.useProgram(P.gradient);
    set1i(P.gradient, "uPressure", 0);
    set1i(P.gradient, "uVelocity", 1);
    drawTo(velocity.write.fbo, P.gradient, { uTexel: texel });
    velocity.swap();

    // advect dye
    bindTex(0, velocity.read.tex);
    bindTex(1, dye.read.tex);
    gl.useProgram(P.advect);
    set1i(P.advect, "uVelocity", 0);
    set1i(P.advect, "uSource", 1);
    drawTo(dye.write.fbo, P.advect, { uTexel: dyeTexel, uDt: SIM.dt, uDissipation: SIM.dyeDissipation });
    dye.swap();

    // display
    bindTex(0, dye.read.tex);
    gl.useProgram(P.display);
    set1i(P.display, "uTex", 0);
    drawTo(null, P.display, {});

    // crosshair overlay
    octx.clearRect(0,0,overlay.width,overlay.height);
    if(pointer.down){
      octx.strokeStyle = "rgba(255,255,255,0.9)";
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(pointer.xPx - 12, pointer.yPx);
      octx.lineTo(pointer.xPx + 12, pointer.yPx);
      octx.moveTo(pointer.xPx, pointer.yPx - 12);
      octx.lineTo(pointer.xPx, pointer.yPx + 12);
      octx.stroke();
    }
  }

  let last = performance.now();
  function loop(now){
    SIM.dt = Math.min(0.033, (now-last)/1000);
    last = now;
    step();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
