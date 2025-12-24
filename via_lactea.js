(() => {
  const canvas = document.getElementById("space");
  const gl = canvas.getContext("webgl2", { alpha:false, antialias:true });
  if (!gl) { console.error("WebGL2 no disponible"); return; }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    canvas.width = w; canvas.height = h;
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
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  const VS = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;

  uniform vec2 uRes;
  uniform float uTime;

  // --- hash/noise helpers ---
  float hash21(vec2 p){
    p = fract(p*vec2(123.34, 456.21));
    p += dot(p, p+45.32);
    return fract(p.x*p.y);
  }

  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1,0));
    float c = hash21(i + vec2(0,1));
    float d = hash21(i + vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }

  float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, -1.2, 1.2, 1.6);
    for(int i=0;i<5;i++){
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  mat2 rot(float a){
    float c = cos(a), s = sin(a);
    return mat2(c,-s,s,c);
  }

  vec3 palette(float t){
    // paleta espacial (azules/violáceos + algo cálido en núcleo)
    vec3 a = vec3(0.04, 0.06, 0.10);
    vec3 b = vec3(0.10, 0.14, 0.26);
    vec3 c = vec3(0.55, 0.35, 0.70);
    vec3 d = vec3(0.95, 0.75, 0.35);
    return mix(mix(a,b, smoothstep(0.0,0.6,t)), mix(c,d, smoothstep(0.65,1.0,t)), t);
  }

  void main(){
    // coord centrada en [-1..1], corregida por aspecto
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uRes.x / uRes.y;

    // rotación lenta global (la “galaxia gira”)
    float t = uTime * 0.06;
    uv = rot(t) * uv;

    // base space gradient (más oscuro en bordes)
    float r = length(uv);
    vec3 col = vec3(0.01, 0.015, 0.03) * (1.0 - 0.35*r);

    // --- banda de la Vía Láctea ---
    // una banda diagonal + “core” más brillante
    float band = exp(-pow(abs(uv.y*0.85 + uv.x*0.25), 2.0) * 2.2);
    float core = exp(-r*r * 0.9);
    band *= (0.35 + 0.65*core);

    // textura de polvo/nebulosa dentro de la banda
    vec2 p = uv * 1.6;
    p = rot(0.2 + t*0.6) * p;
    float dust = fbm(p*2.2) * fbm(p*1.1 + 10.0);
    dust = pow(dust, 1.3);

    float neb = band * (0.25 + 1.25*dust);

    // color de nebulosa (más violeta/azul con núcleo cálido)
    vec3 nebCol = palette(clamp(0.25 + 0.75*neb, 0.0, 1.0));
    col += nebCol * neb * 0.9;

    // --- estrellas ---
    // estrellas finas: umbral de hash a alta frecuencia
    vec2 st = (uv * 220.0);
    float h = hash21(floor(st));
    float star = smoothstep(0.995, 1.0, h);          // pocas estrellas
    float tw = 0.6 + 0.4*sin(uTime*2.0 + h*6.2831);  // twinkle
    star *= tw;

    // estrellas más densas dentro de la banda
    float starBoost = mix(1.0, 2.2, band);
    col += vec3(1.2, 1.15, 1.05) * star * 1.4 * starBoost;

    // algunas estrellas grandes “raras”
    vec2 st2 = uv * 60.0;
    float h2 = hash21(floor(st2 + 7.0));
    float big = smoothstep(0.9988, 1.0, h2) * (0.6 + 0.4*sin(uTime*1.3 + h2*40.0));
    col += vec3(1.4, 1.35, 1.25) * big * 2.2;

    // viñeta suave
    float vign = smoothstep(1.25, 0.2, r);
    col *= vign;

    // tonemap suave
    col = 1.0 - exp(-col * 1.25);

    o = vec4(col, 1.0);
  }`;

  const prog = program(VS, FS);

  // Fullscreen quad
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const locPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  const uResLoc = gl.getUniformLocation(prog, "uRes");
  const uTimeLoc = gl.getUniformLocation(prog, "uTime");

  let t0 = performance.now();
  function frame(now){
    const time = (now - t0) / 1000;

    // auto-resize por cambios de layout
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) resize();

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
