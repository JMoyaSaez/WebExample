
(() => {
  const canvas = document.getElementById("space");
  const gl = canvas.getContext("webgl2", { alpha:false, antialias:true });
  if (!gl) return;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  const VS = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos,0.0,1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;

  uniform vec2 uRes;
  uniform float uTime;

  float hash21(vec2 p){
    p = fract(p*vec2(123.34,456.21));
    p += dot(p,p+45.32);
    return fract(p.x*p.y);
  }

  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i+vec2(1,0));
    float c = hash21(i+vec2(0,1));
    float d = hash21(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
  }

  float fbm(vec2 p){
    float v=0.0;
    float a=0.5;
    mat2 m=mat2(1.6,-1.2,1.2,1.6);
    for(int i=0;i<5;i++){
      v+=a*noise(p);
      p=m*p;
      a*=0.5;
    }
    return v;
  }

  mat2 rot(float a){
    float c=cos(a), s=sin(a);
    return mat2(c,-s,s,c);
  }

  void main(){
    vec2 uv = vUv*2.0-1.0;
    uv.x *= uRes.x/uRes.y;

    float time = uTime * 0.05;

    // cámara viva (movimiento leve)
    uv += vec2(sin(time)*0.1, cos(time*0.7)*0.05);

    float r = length(uv);

    // profundidad fake
    float depth = 1.0/(1.0+r*1.5);
    uv *= mix(1.0,0.6,depth);

    uv = rot(time*0.6) * uv;

    vec3 col = vec3(0.01,0.015,0.03);

    // banda galaxia
    float band = exp(-pow(abs(uv.y*0.8+uv.x*0.3),2.0)*2.0);

    float core = exp(-r*r*1.8);
    core += exp(-r*r*6.0)*0.5;

    // nebulosa mejorada
    vec2 p = uv*1.5;
    float dust = fbm(p + fbm(p*0.5));
    dust = smoothstep(0.3,0.8,dust);

    float neb = band*(0.3 + dust);

    vec3 nebCol = mix(
      vec3(0.1,0.2,0.5),
      vec3(0.8,0.6,0.3),
      core
    );

    col += nebCol * neb;

    // ⭐ estrellas cercanas
    vec2 st = uv * 240.0;
    vec2 id = floor(st);
    vec2 gv = fract(st) - 0.5;

    float n = hash21(id);
    vec2 offset = vec2(hash21(id+1.3), hash21(id+2.1)) - 0.5;

    float d = length(gv - offset);
    float size = mix(0.002,0.01,n);

    float star = smoothstep(size,0.0,d);
    star *= step(0.997,n);
    star *= 0.5 + 0.5*sin(uTime*(2.0+n*5.0));

    col += vec3(1.2,1.15,1.05) * star * 2.0;

    // ⭐ estrellas lejanas (segunda capa)
    vec2 stFar = uv * 80.0;
    float hFar = hash21(floor(stFar));
    float starFar = smoothstep(0.999,1.0,hFar);

    col += vec3(0.6,0.7,1.0) * starFar * 0.5;

    // color final
    col *= vec3(0.9,0.95,1.05);
    col += core * vec3(0.8,0.6,0.3)*0.6;

    // viñeta
    float vign = smoothstep(1.2,0.2,r);
    col *= vign;

    // tonemap
    col = 1.0 - exp(-col*1.3);

    o = vec4(col,1.0);
  }`;

  const prog = program(VS, FS);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);

  const uRes = gl.getUniformLocation(prog,"uRes");
  const uTime = gl.getUniformLocation(prog,"uTime");

  let t0 = performance.now();

  function frame(now){
    let t = (now - t0)/1000;

    resize();

    gl.useProgram(prog);
    gl.bindVertexArray(vao);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);

    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
