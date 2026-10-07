/* Visualizador 3D de modelos .glb (glTF binário) — WebGL puro, sem dependências.
   Viewer3D.parse(arrayBuffer)      -> modelo (valida e lê o .glb)
   Viewer3D.create(canvas)          -> visualizador interativo (arrastar = girar, roda = zoom, duplo clique = resetar)
   Viewer3D.thumbnail(model, size)  -> Blob PNG com a miniatura do modelo
   Viewer3D.supported()             -> há WebGL? */
(() => {
  "use strict";

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
    scale(s) { const m = M.ident(); m[0] = m[5] = m[10] = s; return m; },
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
    },
    trs(t, r, s) {
      const m = M.fromQuat(r);
      for (let i = 0; i < 3; i++) { m[i] *= s[0]; m[4 + i] *= s[1]; m[8 + i] *= s[2]; }
      m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
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

  /* ---------- leitor de GLB ---------- */
  const CT = { 5120: [1, "getInt8", 127], 5121: [1, "getUint8", 255], 5122: [2, "getInt16", 32767], 5123: [2, "getUint16", 65535], 5125: [4, "getUint32", 1], 5126: [4, "getFloat32", 1] };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const MAX_VERTS = 2000000;

  function smoothNormals(p, idx) {
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
      if (l > 1e-12) { n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } else n[i + 1] = 1;
    }
    return n;
  }

  async function parse(buf) {
    if (!(buf instanceof ArrayBuffer)) throw new Error("Arquivo inválido");
    const dv = new DataView(buf);
    if (buf.byteLength < 28 || dv.getUint32(0, true) !== 0x46546C67)
      throw new Error("Arquivo inválido: não é um modelo 3D no formato .glb");
    if (dv.getUint32(4, true) !== 2) throw new Error("Versão não suportada: use glTF 2.0 (.glb)");
    const total = Math.min(dv.getUint32(8, true), buf.byteLength);
    let off = 12, json = null, binOff = -1;
    while (off + 8 <= total) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      if (type === 0x4E4F534A && !json) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      else if (type === 0x004E4942 && binOff < 0) binOff = off + 8;
      off += 8 + len;
    }
    if (!json || !json.meshes || !json.meshes.length) throw new Error("O arquivo .glb não contém nenhum objeto 3D");
    const req = (json.extensionsRequired || []).concat(...(json.meshes.flatMap(m => m.primitives.map(p => Object.keys(p.extensions || {})))));
    if (req.some(e => /draco|meshopt/i.test(e)))
      throw new Error("Modelo comprimido (Draco/Meshopt) não é suportado. Exporte o .glb sem compressão.");

    const readAcc = (i, asInt) => {
      const a = json.accessors[i], nc = NC[a.type], [sz, fn, mx] = CT[a.componentType];
      const out = asInt ? new Uint32Array(a.count * nc) : new Float32Array(a.count * nc);
      if (a.bufferView === undefined) return out;
      const bv = json.bufferViews[a.bufferView];
      if (bv.buffer !== 0 || binOff < 0) throw new Error("Este .glb usa arquivos externos; exporte tudo embutido em um único .glb");
      const base = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || nc * sz;
      const norm = a.normalized && !asInt && a.componentType !== 5126;
      for (let e = 0; e < a.count; e++) for (let c = 0; c < nc; c++) {
        let v = dv[fn](base + e * stride + c * sz, true);
        if (norm) v = Math.max(v / mx, -1);
        out[e * nc + c] = v;
      }
      return out;
    };

    // imagens (texturas) embutidas
    const imgCache = new Map();
    const loadImage = async texIdx => {
      if (texIdx === undefined) return null;
      const tex = json.textures && json.textures[texIdx];
      if (!tex || tex.source === undefined) return null;
      if (imgCache.has(tex.source)) return imgCache.get(tex.source);
      const img = json.images[tex.source];
      let bmp = null;
      try {
        let blob;
        if (img.bufferView !== undefined) {
          const bv = json.bufferViews[img.bufferView];
          blob = new Blob([new Uint8Array(buf, binOff + (bv.byteOffset || 0), bv.byteLength)], { type: img.mimeType || "image/png" });
        } else if (img.uri && img.uri.startsWith("data:")) blob = await (await fetch(img.uri)).blob();
        if (blob) bmp = await createImageBitmap(blob);
      } catch { bmp = null; }
      imgCache.set(tex.source, bmp);
      return bmp;
    };

    const prims = [];
    let minB = [Infinity, Infinity, Infinity], maxB = [-Infinity, -Infinity, -Infinity], verts = 0;

    const visit = async (ni, parent) => {
      const node = json.nodes[ni];
      const local = node.matrix ? Float32Array.from(node.matrix)
        : M.trs(node.translation || [0, 0, 0], node.rotation || [0, 0, 0, 1], node.scale || [1, 1, 1]);
      const W = M.mul(parent, local);
      if (node.mesh !== undefined) {
        for (const p of json.meshes[node.mesh].primitives) {
          if ((p.mode ?? 4) !== 4 || p.attributes.POSITION === undefined) continue;
          let pos = readAcc(p.attributes.POSITION);
          verts += pos.length / 3;
          if (verts > MAX_VERTS) throw new Error("Modelo muito pesado (mais de 2 milhões de vértices). Reduza a malha e envie de novo.");
          let idx = p.indices !== undefined ? readAcc(p.indices, true) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
          let nrm = p.attributes.NORMAL !== undefined ? readAcc(p.attributes.NORMAL) : null;
          const uv = p.attributes.TEXCOORD_0 !== undefined ? readAcc(p.attributes.TEXCOORD_0) : null;
          // aplica a transformação do nó diretamente nos vértices
          const a = [W[0], W[1], W[2]], b = [W[4], W[5], W[6]], c = [W[8], W[9], W[10]];
          const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const bc = cr(b, c), ca = cr(c, a), ab = cr(a, b), det = a[0] * bc[0] + a[1] * bc[1] + a[2] * bc[2], sg = det < 0 ? -1 : 1;
          const P = new Float32Array(pos.length), N = nrm ? new Float32Array(nrm.length) : null;
          for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i], y = pos[i + 1], z = pos[i + 2];
            const px = W[0] * x + W[4] * y + W[8] * z + W[12], py = W[1] * x + W[5] * y + W[9] * z + W[13], pz = W[2] * x + W[6] * y + W[10] * z + W[14];
            P[i] = px; P[i + 1] = py; P[i + 2] = pz;
            if (px < minB[0]) minB[0] = px; if (py < minB[1]) minB[1] = py; if (pz < minB[2]) minB[2] = pz;
            if (px > maxB[0]) maxB[0] = px; if (py > maxB[1]) maxB[1] = py; if (pz > maxB[2]) maxB[2] = pz;
            if (N) {
              const nx = nrm[i], ny = nrm[i + 1], nz = nrm[i + 2];
              let rx = (nx * bc[0] + ny * ca[0] + nz * ab[0]) * sg, ry = (nx * bc[1] + ny * ca[1] + nz * ab[1]) * sg, rz = (nx * bc[2] + ny * ca[2] + nz * ab[2]) * sg;
              const l = Math.hypot(rx, ry, rz) || 1; N[i] = rx / l; N[i + 1] = ry / l; N[i + 2] = rz / l;
            }
          }
          const mt = p.material !== undefined ? json.materials[p.material] : null, pbr = (mt && mt.pbrMetallicRoughness) || {};
          const bmp = await loadImage(pbr.baseColorTexture && pbr.baseColorTexture.index);
          const ebmp = await loadImage(mt && mt.emissiveTexture && mt.emissiveTexture.index);
          const es = (mt && mt.extensions && mt.extensions.KHR_materials_emissive_strength && mt.extensions.KHR_materials_emissive_strength.emissiveStrength) || 1;
          prims.push({
            pos: P, nrm: N || smoothNormals(P, idx), uv, idx,
            mat: {
              color: (pbr.baseColorFactor || [1, 1, 1, 1]).slice(0, 4),
              metal: pbr.metallicFactor ?? 1, rough: pbr.roughnessFactor ?? 1,
              emis: ((mt && mt.emissiveFactor) || [0, 0, 0]).map(v => v * es), emisImage: ebmp,
              blend: !!(mt && mt.alphaMode === "BLEND"), image: bmp
            }
          });
        }
      }
      for (const ch of node.children || []) await visit(ch, W);
    };

    const sceneNodes = json.scenes && json.scenes.length ? json.scenes[json.scene || 0].nodes
      : json.nodes.map((_, i) => i).filter(i => !json.nodes.some(n => (n.children || []).includes(i)));
    for (const n of sceneNodes) await visit(n, M.ident());
    if (!prims.length || !isFinite(minB[0])) throw new Error("O arquivo .glb não contém malhas 3D que possam ser exibidas");
    const center = minB.map((v, i) => (v + maxB[i]) / 2);
    const radius = Math.max(1e-6, Math.hypot(maxB[0] - minB[0], maxB[1] - minB[1], maxB[2] - minB[2]) / 2 * 0.88);
    const ex = (json.scenes && json.scenes[json.scene || 0] && json.scenes[json.scene || 0].extras) || {};
    return { prims, center, radius, pitch: typeof ex.viewerPitch === "number" ? ex.viewerPitch : 0.32, yaw: typeof ex.viewerYaw === "number" ? ex.viewerYaw : -0.6 };
  }

  /* ---------- shaders ---------- */
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
uniform float uSpec; uniform float uRefl; uniform float uMetal; uniform float uAlpha; uniform float uTexOn; uniform float uBlend;
uniform sampler2D uTex; uniform sampler2D uETex; uniform float uEOn; uniform float uRough;
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
  vec3 albedo = uColor; float alpha = uAlpha;
  if(uTexOn > .5){ vec4 t = texture2D(uTex, vUV); albedo *= pow(t.rgb, vec3(2.2)); alpha *= t.a; }
  if(uBlend < .5) alpha = 1.;
  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vW);
  vec3 L1 = normalize(vec3(-.4,.8,.6)), L2 = normalize(vec3(.6,.2,-.8)), L3 = normalize(vec3(-.8,-.2,.4));
  float d1 = max(dot(N,L1),0.), d2 = max(dot(N,L2),0.), d3 = max(dot(N,L3),0.);
  vec3 amb = mix(vec3(.04,.045,.055), vec3(.13,.15,.21), N.y*.5+.5);
  vec3 sc = mix(vec3(1.), albedo, uMetal);
  vec3 col = albedo * (1. - uMetal*.85) * (amb*1.6 + vec3(1.,.98,.95)*d1*.95 + vec3(.5,.65,1.)*d2*.6 + vec3(.45,.5,.6)*d3*.45);
  col += sc * vec3(.9,.95,1.) * pow(max(dot(N,normalize(L1+V)),0.), uSpec) * .55;
  col += sc * vec3(.3,.55,1.)  * pow(max(dot(N,normalize(L2+V)),0.), uSpec) * .7;
  float fr = pow(1.-max(dot(N,V),0.), 5.);
  float rw = 1. - uRough*.8;
  col += env(reflect(-V,N)) * sc * (uRefl*.14 + uRefl*fr*.9) * rw;
  vec3 em = uEmis; if(uEOn > .5) em *= pow(texture2D(uETex, vUV).rgb, vec3(2.2));
  col += em;
  col *= 1.25;
  col = clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14), 0., 1.);
  gl_FragColor = vec4(pow(col, vec3(1./2.2)) * alpha, alpha);
}`;

  let supportCache = null;
  function supported() {
    if (supportCache === null) {
      try { supportCache = !!document.createElement("canvas").getContext("webgl"); } catch { supportCache = false; }
    }
    return supportCache;
  }

  /* ---------- visualizador ---------- */
  function create(canvas, opts = {}) {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.preserve });
    if (!gl) return null;
    const u32 = gl.getExtension("OES_element_index_uint");
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, "aP"); gl.bindAttribLocation(prog, 1, "aN"); gl.bindAttribLocation(prog, 2, "aT");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const U = {};
    ["uVP", "uM", "uCam", "uColor", "uEmis", "uSpec", "uRefl", "uMetal", "uAlpha", "uTexOn", "uBlend", "uTex", "uETex", "uEOn", "uRough"].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uETex, 1);

    const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pitch = 0.32, homeYaw = -0.6, yaw = homeYaw;
    const quat = () => Q.norm(Q.mul(Q.axis(1, 0, 0, pitch), Q.axis(0, 1, 0, yaw)));
    let rot = quat(), zoom = 1, vyaw = 0, vpitch = 0, lastInput = performance.now() - 1500, homeAnim = null, idleSpin = 0;
    let gpu = [], fit = M.ident(), destroyed = false, raf = 0;
    const pointers = new Map();
    let lastMove = 0, pinch = 0;

    const pow2 = n => { let p = 1; while (p < n) p <<= 1; return Math.min(p, 2048); };
    function makeTex(bmp) {
      const w = pow2(bmp.width), h = pow2(bmp.height), c = document.createElement("canvas");
      c.width = w; c.height = h; c.getContext("2d").drawImage(bmp, 0, 0, w, h);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return t;
    }
    function freeModel() {
      for (const g of gpu) { gl.deleteBuffer(g.vb); gl.deleteBuffer(g.ib); if (g.tex) gl.deleteTexture(g.tex); if (g.etex) gl.deleteTexture(g.etex); }
      gpu = [];
    }
    function setModel(model) {
      freeModel();
      for (const p of model.prims) {
        const cnt = p.pos.length / 3, data = new Float32Array(cnt * 8);
        for (let i = 0; i < cnt; i++) {
          data[i * 8] = p.pos[i * 3]; data[i * 8 + 1] = p.pos[i * 3 + 1]; data[i * 8 + 2] = p.pos[i * 3 + 2];
          data[i * 8 + 3] = p.nrm[i * 3]; data[i * 8 + 4] = p.nrm[i * 3 + 1]; data[i * 8 + 5] = p.nrm[i * 3 + 2];
          if (p.uv) { data[i * 8 + 6] = p.uv[i * 2]; data[i * 8 + 7] = p.uv[i * 2 + 1]; }
        }
        const wide = cnt > 65535;
        if (wide && !u32) continue;
        const vb = gl.createBuffer(), ib = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wide ? p.idx : Uint16Array.from(p.idx), gl.STATIC_DRAW);
        const m = p.mat;
        gpu.push({ vb, ib, n: p.idx.length, wide, mat: m, tex: m.image && p.uv ? makeTex(m.image) : null, etex: m.emisImage && p.uv ? makeTex(m.emisImage) : null });
      }
      fit = M.mul(M.scale(1 / model.radius), M.translate(-model.center[0], -model.center[1], -model.center[2]));
      pitch = model.pitch; homeYaw = model.yaw; yaw = homeYaw; rot = quat(); zoom = 1; homeAnim = null;
    }

    const rotate = (ay) => { yaw += ay; rot = quat(); };
    const onDown = e => {
      canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.classList.add("grab"); homeAnim = null; vyaw = vpitch = 0; lastMove = e.timeStamp;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const onMove = e => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; lastInput = performance.now();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoom = Math.min(2.2, Math.max(0.45, zoom * pinch / d)); pinch = d; return;
      }
      const k = 0.0105, dt = Math.max(0.004, (e.timeStamp - lastMove) / 1000); lastMove = e.timeStamp;
      rotate(dx * k);
      vyaw = vyaw * 0.4 + (dx * k / dt) * 0.6; vpitch = 0;
    };
    const onUp = e => {
      pointers.delete(e.pointerId); pinch = 0;
      if (!pointers.size) { canvas.classList.remove("grab"); lastInput = performance.now(); if (e.timeStamp - lastMove > 90) vyaw = vpitch = 0; }
    };
    const onWheel = e => { e.preventDefault(); lastInput = performance.now(); zoom = Math.min(2.2, Math.max(0.45, zoom * (1 + e.deltaY * 0.0012))); };
    const reset = () => { const d = ((homeYaw - yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; homeAnim = { y0: yaw, dy: d, z0: zoom, t: 0 }; vyaw = vpitch = 0; };
    const onKey = e => {
      const s = 0.18, m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], }[e.key];
      if (m) { e.preventDefault(); rotate(m[0], m[1]); lastInput = performance.now(); }
    };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false }); canvas.addEventListener("dblclick", reset); canvas.addEventListener("keydown", onKey);

    function draw(g, VP, S, blendPass) {
      const m = g.mat;
      gl.uniformMatrix4fv(U.uM, false, S);
      gl.uniform3f(U.uColor, m.color[0], m.color[1], m.color[2]); gl.uniform1f(U.uAlpha, m.color[3]);
      gl.uniform3fv(U.uEmis, m.emis);
      gl.uniform1f(U.uMetal, Math.min(1, m.metal)); gl.uniform1f(U.uSpec, 8 + Math.pow(1 - Math.min(1, m.rough), 2) * 220);
      gl.uniform1f(U.uRefl, Math.min(1, 0.12 + m.metal * 0.75 + (1 - m.rough) * 0.25));
      gl.uniform1f(U.uRough, Math.min(1, m.rough)); gl.uniform1f(U.uEOn, g.etex ? 1 : 0); gl.uniform1f(U.uTexOn, g.tex ? 1 : 0); gl.uniform1f(U.uBlend, m.blend ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1); if (g.etex) gl.bindTexture(gl.TEXTURE_2D, g.etex);
      gl.activeTexture(gl.TEXTURE0); if (g.tex) gl.bindTexture(gl.TEXTURE_2D, g.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
      gl.drawElements(gl.TRIANGLES, g.n, g.wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    }
    function render() {
      const dpr = opts.size ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round((opts.size || canvas.clientWidth) * dpr)), h = Math.max(1, Math.round((opts.size || canvas.clientHeight) * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const asp = w / h, fov = 0.6, hf = 2 * Math.atan(Math.tan(fov / 2) * asp);
      const dist = 1.02 / Math.sin(Math.min(fov, hf) / 2) * zoom;
      const VP = M.mul(M.persp(fov, asp, 0.05, 100), M.translate(0, 0, -dist));
      const S = M.mul(M.fromQuat(rot), fit);
      gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uCam, 0, 0, dist);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
      for (const g of gpu) if (!g.mat.blend) draw(g, VP, S);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      for (const g of gpu) if (g.mat.blend) draw(g, VP, S);
    }
    let last = performance.now();
    function frame(now) {
      if (destroyed) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (homeAnim) {
        homeAnim.t = Math.min(1, homeAnim.t + dt / 0.8);
        const t = homeAnim.t, e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        yaw = homeAnim.y0 + homeAnim.dy * e; rot = quat(); zoom = homeAnim.z0 + (1 - homeAnim.z0) * e; if (homeAnim.t >= 1) homeAnim = null;
      } else if (!pointers.size) {
        if (Math.abs(vyaw) + Math.abs(vpitch) > 0.02) {
          vyaw = Math.max(-9, Math.min(9, vyaw)); vpitch = Math.max(-9, Math.min(9, vpitch));
          rotate(vyaw * dt); const f = Math.exp(-dt * 3.2); vyaw *= f; vpitch *= f;
        }
        const idle = (performance.now() - lastInput) > 1800 && !reduceMotion;
        idleSpin += ((idle ? 1 : 0) - idleSpin) * Math.min(1, dt * 1.5);
        if (idleSpin > 0.01) rotate(0.45 * idleSpin * dt, 0);
      }
      render(); raf = requestAnimationFrame(frame);
    }
    if (!opts.noLoop) raf = requestAnimationFrame(frame);

    return {
      setModel, render, resetView: reset,
      destroy() {
        destroyed = true; cancelAnimationFrame(raf); freeModel();
        const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
      }
    };
  }

  // miniatura (PNG com fundo transparente) do modelo na vista inicial
  async function thumbnail(model, size = 320) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const v = create(c, { size, preserve: true, noLoop: true });
    if (!v) return null;
    try {
      v.setModel(model); v.render();
      return await new Promise(res => c.toBlob(res, "image/png"));
    } finally { v.destroy(); }
  }

  window.Viewer3D = { parse, create, thumbnail, supported };
})();
