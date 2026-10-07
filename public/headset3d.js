/* Headset Solutech em 3D — WebGL puro, sem dependências.
   Arraste para girar em qualquer ângulo, role/pinça para zoom, duplo clique reseta. */
(() => {
  "use strict";
  const canvas = document.getElementById("hs3d");
  if (!canvas) return;
  const stage = canvas.parentElement;
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) { stage.classList.add("no3d"); return; }

  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- matemática ---------- */
  const M = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
      return o;
    },
    translate(x, y, z) { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
    rotZ(a) { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
    fromQuat([x, y, z, w]) {
      const m = M.ident();
      const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
      m[0] = 1 - 2 * (yy + zz); m[1] = 2 * (xy + wz); m[2] = 2 * (xz - wy);
      m[4] = 2 * (xy - wz); m[5] = 1 - 2 * (xx + zz); m[6] = 2 * (yz + wx);
      m[8] = 2 * (xz + wy); m[9] = 2 * (yz - wx); m[10] = 1 - 2 * (xx + yy);
      return m;
    },
    persp(fov, asp, n, f) {
      const t = 1 / Math.tan(fov / 2), m = new Float32Array(16);
      m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
      return m;
    }
  };
  const Q = {
    mul(a, b) {
      return [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
      ];
    },
    axis(x, y, z, ang) { const s = Math.sin(ang / 2); return [x * s, y * s, z * s, Math.cos(ang / 2)]; },
    norm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map(v => v / l); },
    slerp(a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      if (d < 0) { b = b.map(v => -v); d = -d; }
      if (d > 0.9995) return Q.norm(a.map((v, i) => v + (b[i] - v) * t));
      const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return a.map((v, i) => v * wa + b[i] * wb);
    }
  };

  /* ---------- geometria ---------- */
  function computeNormals(p, idx) {
    const n = new Float32Array(p.length);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, c]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
      if (l > 1e-12) { n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    }
    return n;
  }
  function merge(geos) {
    const p = [], idx = [], uv = [];
    for (const g of geos) {
      const off = p.length / 3;
      p.push(...g.p); idx.push(...g.idx.map(i => i + off));
      uv.push(...(g.uv || new Array(g.p.length / 3 * 2).fill(0)));
    }
    return { p, idx, uv };
  }
  function lathe(strip, segs = 72) {
    const p = [], idx = [], n = strip.length;
    for (let j = 0; j < n; j++) for (let i = 0; i < segs; i++) {
      const a = i / segs * Math.PI * 2;
      p.push(strip[j][0] * Math.cos(a), strip[j][1], strip[j][0] * Math.sin(a));
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < segs; i++) {
      const i2 = (i + 1) % segs, a = j * segs + i, b = j * segs + i2, c = (j + 1) * segs + i, d = (j + 1) * segs + i2;
      idx.push(a, c, b, b, c, d);
    }
    return { p, idx };
  }
  function arc(cx, cy, r, a0, a1, steps) {
    const out = [];
    for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  // toro em torno de Y; seção (raio, Y) com Y escalado por sy
  function torus(R, r, U = 72, V = 20, sy = 1) {
    const p = [], idx = [];
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const u = i / U * Math.PI * 2, v = j / V * Math.PI * 2;
      const rad = R + r * Math.cos(v);
      p.push(rad * Math.cos(u), r * Math.sin(v) * sy, rad * Math.sin(u));
    }
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const i2 = (i + 1) % U, j2 = (j + 1) % V;
      const a = i * V + j, b = i2 * V + j, c = i * V + j2, d = i2 * V + j2;
      idx.push(a, b, c, b, d, c);
    }
    return { p, idx };
  }
  function catmull(pts, per = 10) {
    const out = [], P = [pts[0], ...pts, pts[pts.length - 1]];
    for (let i = 1; i < P.length - 2; i++) for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t, v = [];
      for (let k = 0; k < 3; k++) {
        v.push(0.5 * ((2 * P[i][k]) + (-P[i - 1][k] + P[i + 1][k]) * t +
          (2 * P[i - 1][k] - 5 * P[i][k] + 4 * P[i + 1][k] - P[i + 2][k]) * t2 +
          (-P[i - 1][k] + 3 * P[i][k] - 3 * P[i + 1][k] + P[i + 2][k]) * t3));
      }
      out.push(v);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  // tubo de seção elíptica: rad(i) -> [raioN, raioB]
  function tube(pts, rad, sides = 14, ref = [0, 0, 1]) {
    const n = pts.length, p = [], idx = [];
    let N = null;
    for (let i = 0; i < n; i++) {
      const T = nrm(sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]));
      if (!N) { N = nrm(sub(ref, T.map(v => v * dot(ref, T)))); }
      else { N = nrm(sub(N, T.map(v => v * dot(N, T)))); }
      const B = cross(T, N), [rn, rb] = rad(i, n);
      for (let s = 0; s < sides; s++) {
        const a = s / sides * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        p.push(pts[i][0] + rn * c * N[0] + rb * sn * B[0], pts[i][1] + rn * c * N[1] + rb * sn * B[1], pts[i][2] + rn * c * N[2] + rb * sn * B[2]);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides, a = i * sides + s, b = i * sides + s2, c = (i + 1) * sides + s, d = (i + 1) * sides + s2;
      idx.push(a, c, b, b, c, d);
    }
    for (const [ring, c0] of [[0, pts[0]], [n - 1, pts[n - 1]]]) {
      const ci = p.length / 3; p.push(...c0);
      for (let s = 0; s < sides; s++) idx.push(ci, ring * sides + s, ring * sides + (s + 1) % sides);
    }
    return { p, idx };
  }
  function face(c, a, b) {
    return {
      p: [c[0] - a[0] - b[0], c[1] - a[1] - b[1], c[2] - a[2] - b[2], c[0] + a[0] - b[0], c[1] + a[1] - b[1], c[2] + a[2] - b[2],
        c[0] + a[0] + b[0], c[1] + a[1] + b[1], c[2] + a[2] + b[2], c[0] - a[0] + b[0], c[1] - a[1] + b[1], c[2] - a[2] + b[2]],
      idx: [0, 1, 2, 0, 2, 3]
    };
  }
  function box(hx, hy, hz) {
    return merge([
      face([hx, 0, 0], [0, 0, hz], [0, hy, 0]), face([-hx, 0, 0], [0, 0, hz], [0, hy, 0]),
      face([0, hy, 0], [hx, 0, 0], [0, 0, hz]), face([0, -hy, 0], [hx, 0, 0], [0, 0, hz]),
      face([0, 0, hz], [hx, 0, 0], [0, hy, 0]), face([0, 0, -hz], [hx, 0, 0], [0, hy, 0])
    ]);
  }
  function quad(c, right, up, s) {
    const g = face(c, right.map(v => v * s), up.map(v => v * s));
    // face(): v0=-a-b, v1=+a-b, v2=+a+b, v3=-a+b  ->  uv com topo da imagem em "up"
    g.uv = [0, 1, 1, 1, 1, 0, 0, 0];
    return g;
  }

  /* ---------- GL ---------- */
  const VS = `attribute vec3 aP; attribute vec3 aN; attribute vec2 aT;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
void main(){ vec4 w = uM * vec4(aP,1.); vW = w.xyz; vN = mat3(uM) * aN; vUV = aT; gl_Position = uVP * w; }`;
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vW; varying vec3 vN; varying vec2 vUV;
uniform vec3 uCam; uniform vec3 uColor; uniform vec3 uEmis;
uniform float uSpec; uniform float uRefl; uniform float uSheen; uniform float uMode; uniform float uGlow;
uniform sampler2D uTex;
float hash(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
vec3 env(vec3 r){
  float up = r.y*.5+.5;
  vec3 c = mix(vec3(.004,.005,.010), vec3(.03,.04,.08), up);
  c += vec3(.60,.70,.95) * pow(max(dot(r, normalize(vec3(-.35,.9,.5))),0.), 12.) * 1.2;
  c += vec3(.10,.38,1.0) * smoothstep(.60,.97,abs(r.x)) * .55;
  c += vec3(.30,.45,.95) * pow(max(dot(r, normalize(vec3(.6,.1,-.8))),0.), 8.) * .9;
  c += vec3(.85,.92,1.) * smoothstep(.955,1., dot(r, normalize(vec3(.3,.5,.8)))) * 1.6;
  return c;
}
void main(){
  if(uMode > 1.5){ float d = length(vUV-.5)*2.; float a = pow(max(1.-d,0.),2.6)*uGlow; gl_FragColor = vec4(uEmis*a, a); return; }
  if(uMode > .5){ vec4 t = texture2D(uTex, vUV); gl_FragColor = vec4(t.rgb*1.7, t.a); return; }
  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
  if(uSheen > .5){ N = normalize(N + (vec3(hash(vW*38.), hash(vW*38.+7.), hash(vW*38.+13.))-.5)*.10); }
  vec3 V = normalize(uCam - vW);
  vec3 L1 = normalize(vec3(-.4,.8,.6)), L2 = normalize(vec3(.6,.2,-.8)), L3 = normalize(vec3(-.8,-.2,.4));
  float d1 = max(dot(N,L1),0.), d2 = max(dot(N,L2),0.), d3 = max(dot(N,L3),0.);
  vec3 amb = mix(vec3(.015,.02,.03), vec3(.05,.07,.14), N.y*.5+.5);
  vec3 col = uColor * (amb*1.2 + vec3(.9,.95,1.)*d1*.9 + vec3(.15,.4,1.)*d2*1.4 + vec3(.1,.2,.5)*d3*.6);
  col += vec3(.9,.95,1.) * pow(max(dot(N,normalize(L1+V)),0.), uSpec) * .55;
  col += vec3(.2,.5,1.)  * pow(max(dot(N,normalize(L2+V)),0.), uSpec) * 1.0;
  float fr = pow(1.-max(dot(N,V),0.), 4.);
  col += env(reflect(-V,N)) * (uRefl*.14 + uRefl*fr*.9);
  col += vec3(.1,.3,1.) * fr * uSheen * .35;
  col += uEmis;
  col = 1. - exp(-col*1.5);
  gl_FragColor = vec4(pow(col, vec3(1./2.2)), 1.);
}`;
  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, "aP"); gl.bindAttribLocation(prog, 1, "aN"); gl.bindAttribLocation(prog, 2, "aT");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.error("headset3d:", e); stage.classList.add("no3d"); return; }
  gl.useProgram(prog);
  const U = {};
  ["uVP", "uM", "uCam", "uColor", "uEmis", "uSpec", "uRefl", "uSheen", "uMode", "uGlow", "uTex"].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  gl.uniform1i(U.uTex, 0);

  function upload(g) {
    const nrmArr = computeNormals(g.p, g.idx), cnt = g.p.length / 3, data = new Float32Array(cnt * 8);
    const uv = g.uv || new Array(cnt * 2).fill(0);
    for (let i = 0; i < cnt; i++) {
      data.set([g.p[i * 3], g.p[i * 3 + 1], g.p[i * 3 + 2], nrmArr[i * 3], nrmArr[i * 3 + 1], nrmArr[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]], i * 8);
    }
    const vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.idx), gl.STATIC_DRAW);
    return { vb, ib, n: g.idx.length };
  }
  function draw(item, S, pass) {
    const m = item.mat;
    gl.uniformMatrix4fv(U.uM, false, M.mul(S, item.L));
    gl.uniform3fv(U.uColor, m.color || [0, 0, 0]); gl.uniform3fv(U.uEmis, m.emis || [0, 0, 0]);
    gl.uniform1f(U.uSpec, m.spec || 40); gl.uniform1f(U.uRefl, m.refl || 0); gl.uniform1f(U.uSheen, m.sheen || 0);
    gl.uniform1f(U.uMode, m.mode || 0); gl.uniform1f(U.uGlow, m.glow || 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, item.mesh.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, item.mesh.ib);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    gl.drawElements(gl.TRIANGLES, item.mesh.n, gl.UNSIGNED_SHORT, 0);
  }

  /* ---------- cena ---------- */
  const BLUE = [0.08, 0.42, 1.0];
  const MAT = {
    shell: { color: [0.012, 0.014, 0.022], spec: 70, refl: 0.7 },
    glossy: { color: [0.004, 0.005, 0.010], spec: 120, refl: 0.55 },
    leather: { color: [0.016, 0.017, 0.022], spec: 14, refl: 0.35, sheen: 1 },
    foam: { color: [0.008, 0.009, 0.013], spec: 6, refl: 0.1 },
    band: { color: [0.014, 0.016, 0.026], spec: 60, refl: 0.65 },
    ring: { color: [0.01, 0.03, 0.08], emis: BLUE.map(v => v * 1.1), spec: 30, refl: 0.2 },
    tip: { color: [0.01, 0.03, 0.08], emis: BLUE.map(v => v * 2.2), spec: 30, refl: 0.2 },
    logo: { mode: 1 },
    glow: { mode: 2, emis: [0.06, 0.30, 1.0], glow: 0.30 }
  };
  const items = [], logoItems = [], glowItems = [];
  const add = (g, L, mat, list = items) => list.push({ mesh: upload(g), L, mat });

  // arco do headband (plano XY)
  const bandPt = (deg, k = 1) => { const a = deg * Math.PI / 180; return [1.55 * k * Math.cos(a), -0.15 + 1.75 * k * Math.sin(a), 0]; };
  const bump = x => { const v = Math.max(0, 1 - x * x); return v * v; };
  (() => {
    const pts = []; for (let d = -6; d <= 186; d += 3) pts.push(bandPt(d));
    add(tube(pts, i => [0.085, 0.032], 12), M.ident(), MAT.band);
    const pad = []; for (let d = 38; d <= 142; d += 2.5) pad.push(bandPt(d, 0.945));
    add(tube(pad, (i, n) => { const t = (i / (n - 1) - .5) * 2; const k = Math.max(0.28, bump(t * 0.98)); return [0.15 * k + 0.02, 0.07 * k + 0.02]; }, 16), M.ident(), MAT.leather);
  })();

  // conchas
  const cupStrip = [];
  cupStrip.push([0, 0.26], [0.36, 0.26]);
  cupStrip.push(...arc(0.73, 0.04, 0.22, Math.PI / 2, 0, 10).slice(0));
  cupStrip.push([0.95, -0.18]);
  cupStrip.push(...arc(0.80, -0.18, 0.15, 0, -Math.PI / 2, 8));
  cupStrip.push([0.4, -0.33], [0, -0.33]);
  const cupGeo = lathe(cupStrip);
  const faceGeo = lathe([[0, 0.266], [0.30, 0.266], [0.66, 0.266]]);
  const ringGeo = torus(0.80, 0.024, 80, 12);
  const cushionGeo = torus(0.64, 0.27, 80, 24, 0.82);
  const foamGeo = lathe([[0, -0.40], [0.45, -0.40]]);
  const hingeGeo = box(0.16, 0.19, 0.15);

  for (const side of [1, -1]) {
    const C = M.mul(M.translate(side * 1.62, -0.45, 0), M.rotZ(-side * Math.PI / 2));
    add(cupGeo, C, MAT.shell);
    add(faceGeo, C, MAT.glossy);
    add(ringGeo, M.mul(C, M.translate(0, 0.245, 0)), MAT.ring);
    add(cushionGeo, M.mul(C, M.translate(0, -0.47, 0)), MAT.leather);
    add(foamGeo, C, MAT.foam);
    add(hingeGeo, M.translate(side * 1.56, 0.47, 0), MAT.shell);
    const right = [0, 0, -side], up = [-side, 0, 0];
    add(quad([0, 0.274, 0], right, up, 0.30), C, MAT.logo, logoItems);
    add(quad([0, 0.30, 0], right, up, 1.35), C, MAT.glow, glowItems);
  }

  // microfone (lado esquerdo)
  (() => {
    const pts = catmull([[-1.72, -1.15, 0.30], [-1.95, -1.32, 0.75], [-1.62, -1.46, 1.28], [-1.05, -1.38, 1.62], [-0.58, -1.22, 1.72]], 10);
    add(tube(pts, (i, n) => [i > n - 7 ? 0.062 : 0.030, i > n - 7 ? 0.062 : 0.030], 12), M.ident(), MAT.band);
    const tip = pts[pts.length - 1], sph = [];
    for (let i = 0; i <= 12; i++) { const t = -Math.PI / 2 + Math.PI * i / 12; sph.push([0.058 * Math.cos(t), 0.058 * Math.sin(t)]); }
    add(lathe(sph, 20), M.translate(tip[0], tip[1], tip[2]), MAT.tip);
  })();

  // textura do logo
  let logoTex = null;
  const img = new Image();
  img.onload = () => {
    logoTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
    if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  img.src = "logo-mark.png";

  /* ---------- interação ---------- */
  const HOME = Q.norm(Q.mul(Q.axis(1, 0, 0, 0.16), Q.axis(0, 1, 0, -0.62)));
  let rot = HOME.slice(), dist = 6.5, vyaw = 0, vpitch = 0, lastInput = performance.now() - 2000, homeAnim = null;
  const pointers = new Map();
  let lastMove = 0, pinch = 0;
  const hint = stage.querySelector(".hint");
  const hideHint = () => hint && hint.classList.add("hide");

  function rotate(ay, ax) {
    rot = Q.norm(Q.mul(Q.axis(0, 1, 0, ay), Q.mul(Q.axis(1, 0, 0, ax), rot)));
  }
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add("grab"); homeAnim = null; vyaw = vpitch = 0; lastMove = e.timeStamp; hideHint();
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener("pointermove", e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    lastInput = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) dist = Math.min(11, Math.max(4.2, dist * pinch / d)); pinch = d; return;
    }
    const k = 0.0105, dt = Math.max(0.004, (e.timeStamp - lastMove) / 1000); lastMove = e.timeStamp;
    rotate(dx * k, dy * k);
    vyaw = vyaw * 0.4 + (dx * k / dt) * 0.6; vpitch = vpitch * 0.4 + (dy * k / dt) * 0.6;
  });
  const end = e => {
    pointers.delete(e.pointerId); pinch = 0;
    if (!pointers.size) { canvas.classList.remove("grab"); lastInput = performance.now(); if (performance.now() - lastMove > 90 && e.timeStamp - lastMove > 90) vyaw = vpitch = 0; }
  };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", e => {
    e.preventDefault(); hideHint(); lastInput = performance.now();
    dist = Math.min(11, Math.max(4.2, dist * (1 + e.deltaY * 0.0012)));
  }, { passive: false });
  canvas.addEventListener("dblclick", () => { homeAnim = { from: rot.slice(), t: 0 }; vyaw = vpitch = 0; });
  canvas.addEventListener("keydown", e => {
    const s = 0.18, m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
    if (m) { e.preventDefault(); rotate(m[0], m[1]); hideHint(); lastInput = performance.now(); }
  });

  /* ---------- loop ---------- */
  let last = performance.now(), idleSpin = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const dragging = pointers.size > 0;
    if (homeAnim) {
      homeAnim.t = Math.min(1, homeAnim.t + dt / 0.8);
      const t = homeAnim.t, e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      rot = Q.slerp(homeAnim.from, HOME, e); if (homeAnim.t >= 1) homeAnim = null;
    } else if (!dragging) {
      if (Math.abs(vyaw) + Math.abs(vpitch) > 0.02) {
        vyaw = Math.max(-9, Math.min(9, vyaw)); vpitch = Math.max(-9, Math.min(9, vpitch));
        rotate(vyaw * dt, vpitch * dt);
        const f = Math.exp(-dt * 3.2); vyaw *= f; vpitch *= f;
      }
      const idle = (performance.now() - lastInput) > 2200 && !reduceMotion;
      idleSpin += ((idle ? 1 : 0) - idleSpin) * Math.min(1, dt * 1.5);
      if (idleSpin > 0.01) rotate(0.38 * idleSpin * dt, 0);
    }
    render();
    requestAnimationFrame(frame);
  }
  function render() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const asp = w / h, fov = asp < 1 ? 0.78 : 0.6;
    const VP = M.mul(M.persp(fov, asp, 0.1, 60), M.translate(0, 0, -dist));
    const S = M.mul(M.fromQuat(rot), M.translate(0, -0.12, 0));
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3f(U.uCam, 0, 0, dist);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
    for (const it of items) draw(it, S);
    if (logoTex) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, logoTex);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
      for (const it of logoItems) draw(it, S);
    }
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); gl.depthMask(false);
    for (const it of glowItems) draw(it, S);
  }
  requestAnimationFrame(frame);
})();
