import * as THREE from "three";

/* Moteur 3D partagé par toutes les pages : la salle, les personnages, la rue, les étiquettes, l'écran. */

export const T = (k, v) => window.I18N.t(k, v);
export const rtl = () => document.documentElement.dir === "rtl";
export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const coarse = matchMedia("(pointer: coarse)").matches;
export const small = matchMedia("(max-width: 760px)").matches;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function angLerp(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; }

export const DEFAULT = { W: 12, D: 8, H: 3, nL: 4, nS: 4 };
export const FRONT = 2.8, SW = 3.2;
const M = 0.3, GAP = 0.4, BL = 2.5, BS = 1.5;

/* ---------- renderer + base scene ---------- */
export function createStage(stage, { shadows = !small, fov = 50 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1222); scene.fog = new THREE.Fog(0x0b1222, 28, 80);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a2234, 0.85));
  const moon = new THREE.DirectionalLight(0xdfe8ff, 1.15);
  moon.position.set(9, 18, 12); moon.castShadow = shadows; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  scene.add(moon);
  const roomGlow = new THREE.PointLight(0x2ad1cf, 6, 16, 1.6); roomGlow.position.set(0, 2.6, -1); scene.add(roomGlow);
  const neon = new THREE.PointLight(0xffb347, 14, 10, 1.6); scene.add(neon);
  const g = new THREE.BufferGeometry(), n = 900, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 60, y = 25 + Math.random() * 90; p.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd2ff, size: 0.6, fog: false, transparent: true, opacity: 0.8 })));
  const fit = () => {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(stage); fit();
  return { renderer, scene, camera, roomGlow, neon, moon, fit };
}

/* ---------- helpers ---------- */
const mats = {};
export const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o })); };
export function box(w, h, d, m, x, y, z, parent, shadow = true) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; parent.add(b); return b;
}
export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export const fontFor = (px, w = "bold") => `${w} ${px}px ${rtl() ? '"Noto Kufi Arabic",' : ""}Manrope, system-ui, sans-serif`;
export function spriteLabel(text, bg = "rgba(14,124,123,0.92)", scale = 1, color = "#fff") {
  const c = document.createElement("canvas"); let g = c.getContext("2d"); g.font = fontFor(46);
  const tw = Math.ceil(g.measureText(text).width + 56); c.width = tw + 8; c.height = 128;
  g = c.getContext("2d"); g.font = fontFor(46);
  g.fillStyle = bg; roundRect(g, 4, 24, tw, 80, 26); g.fill();
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width / 2, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  scale *= small ? 0.85 : 1;
  s.scale.set(0.8 * scale * c.width / 128, 0.8 * scale, 1); s.renderOrder = 20; s.userData.base = s.scale.clone();
  return s;
}
export function textTexture(text, w, h, bg, fg, font) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const tmpV = new THREE.Vector3();
export function scaleLabels(labels, camera, near = 9) {
  for (const l of labels) { if (!l.visible) continue; const k = clamp(l.getWorldPosition(tmpV).distanceTo(camera.position) / near, 0.3, 1); l.scale.copy(l.userData.base).multiplyScalar(k); }
}

/* ---------- characters ---------- */
export function makeAvatar({ seated = false, color = 0x3d7be8, headset = true, player = false, skin = null } = {}) {
  const g = new THREE.Group();
  const sk = mat(skin ?? (player ? 0xb98262 : [0xc89270, 0xa86f4f, 0xd9a47e, 0x8d5a3b][Math.floor(Math.random() * 4)])), shirt = mat(color), dark = mat(0x1c2333);
  const hip = seated ? 0.47 : 0.88, y0 = seated ? 0.45 : 0.9;
  if (seated) { box(0.55, 0.45, 0.55, mat(0x2b3550), 0, 0.22, 0.08, g); box(0.55, 0.6, 0.1, mat(0x2b3550), 0, 0.62, 0.34, g); }
  const legs = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(0.11 * s, hip, 0); g.add(pv);
    box(0.15, seated ? 0.45 : 0.86, 0.17, dark, 0, seated ? -0.22 : -0.43, 0, pv);
    if (seated) pv.rotation.x = Math.PI / 2;
    legs.push(pv);
  }
  box(0.46, 0.62, 0.26, shirt, 0, y0 + 0.31, 0, g);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), sk); head.position.set(0, y0 + 0.8, 0); head.castShadow = true; g.add(head);
  const hs = new THREE.Group(); head.add(hs);
  box(0.27, 0.13, 0.15, mat(0xf2f4f7, { roughness: 0.35 }), 0, 0.02, -0.1, hs);
  box(0.25, 0.028, 0.012, new THREE.MeshBasicMaterial({ color: 0x2ad1cf }), 0, 0.0, -0.18, hs, false);
  box(0.3, 0.03, 0.03, dark, 0, 0.03, 0.02, hs);
  hs.visible = headset;
  const arms = [], hands = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(0.29 * s, y0 + 0.56, 0); g.add(pv);
    box(0.12, 0.55, 0.12, shirt, 0, -0.26, 0, pv);
    box(0.1, 0.1, 0.1, sk, 0, -0.56, 0, pv);
    if (player) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc35c, transparent: true, opacity: 0.85 }));
      glow.position.y = -0.58; glow.visible = false; pv.add(glow); hands.push(glow);
    }
    arms.push(pv);
  }
  return { g, head, arms, legs, hs, hands, seated, phase: Math.random() * 6.28, walk: 0, idle: !headset, cheer: false };
}
export function poseAvatar(a, t, dt) {
  if (a.holo) { a.holo.rotation.y += dt * 0.9; a.holo.position.y = a.baseY + Math.sin(t * 1.5 + a.phase) * 0.06; return; }
  if (a.ring) { a.ring.material.opacity = 0.45 + 0.4 * Math.sin(t * 3); a.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3)); return; }
  if (a.float) { a.float.position.y = a.baseY + Math.sin(t * 1.2 + a.phase) * 0.12; a.float.rotation.y = Math.sin(t * 0.6 + a.phase) * 0.4; return; }
  const s = Math.sin(t * 2.2 + a.phase);
  if (a.walk > 0.01) {
    const w = Math.sin(t * 9) * 0.6 * a.walk;
    a.legs[0].rotation.x = w; a.legs[1].rotation.x = -w;
    a.arms[0].rotation.x = -w * 0.8; a.arms[1].rotation.x = w * 0.8; a.arms[0].rotation.z = 0.06; a.arms[1].rotation.z = -0.06;
    a.head.rotation.y = 0; a.g.position.y = Math.abs(Math.sin(t * 9)) * 0.04 * a.walk;
    return;
  }
  if (!a.seated) { a.legs[0].rotation.x = 0; a.legs[1].rotation.x = 0; }
  if (a.cheer) { // applause / celebration
    const c = Math.sin(t * 10 + a.phase);
    a.arms[0].rotation.x = a.arms[1].rotation.x = 2.6; a.arms[0].rotation.z = -0.25 - c * 0.15; a.arms[1].rotation.z = 0.25 + c * 0.15;
    if (!a.seated) a.g.position.y = Math.max(0, Math.sin(t * 6 + a.phase)) * 0.08; return;
  }
  if (a.idle || !a.hs.visible) {
    a.head.rotation.y = (a.lookAt ?? 0) + Math.sin(t * 0.4 + a.phase) * 0.15;
    a.arms[0].rotation.x = a.arms[1].rotation.x = a.seated ? 0.55 : 0.05; a.arms[0].rotation.z = 0.05; a.arms[1].rotation.z = -0.05;
    a.g.position.y = 0; return;
  }
  a.head.rotation.y = Math.sin(t * 0.8 + a.phase) * 0.6;
  a.arms[0].rotation.x = 1.15 + s * 0.45; a.arms[1].rotation.x = 1.05 - s * 0.45; a.arms[0].rotation.z = -0.12; a.arms[1].rotation.z = 0.12;
  if (!a.seated) a.g.position.y = Math.max(0, Math.sin(t * 4 + a.phase) * 0.02);
}

/* a floating VR headset (used for booking) */
export function makeHeadset(color = 0xf2f4f7) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.3, 2, 2, 2), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 }));
  body.castShadow = true; g.add(body);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x2ad1cf }));
  visor.position.set(0, 0, 0.16); g.add(visor);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.06), mat(0x1c2333)); pad.position.z = -0.17; g.add(pad);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 40, Math.PI), mat(0x1c2333)); strap.rotation.y = Math.PI / 2; strap.rotation.z = Math.PI / 2; strap.position.z = -0.2; strap.scale.set(1, 1, 0.9); g.add(strap);
  return { g, body, visor };
}

/* ---------- layout ---------- */
export function layout(W, D, nL, nS) {
  const x0 = -W / 2 + M, x1 = W / 2 - M, z0 = -D / 2 + M, z1 = D / 2 - FRONT - 0.4;
  const bays = []; let z = z0, rl = nL, rs = nS;
  const row = (size, count) => {
    const xs = []; let x = x0;
    while (count > 0 && x + size <= x1 + 1e-6) { xs.push(x); x += size + GAP; count--; }
    const used = xs.length ? xs.length * size + (xs.length - 1) * GAP : 0, off = (x1 - x0 - used) / 2;
    return xs.map(v => v + off);
  };
  while (rl > 0 && z + BL <= z1 + 1e-6) { const xs = row(BL, rl); if (!xs.length) break; xs.forEach(x => bays.push({ t: "L", x: x + BL / 2, z: z + BL / 2, s: BL })); rl -= xs.length; z += BL + GAP; }
  while (rs > 0 && z + BS <= z1 + 1e-6) { const xs = row(BS, rs); if (!xs.length) break; xs.forEach(x => bays.push({ t: "S", x: x + BS / 2, z: z + BS / 2, s: BS })); rs -= xs.length; z += BS + GAP; }
  return { bays, overflow: rl + rs };
}

/* ---------- street ---------- */
export function buildBackdrop(W, D) {
  const bd = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x141c2b, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; bd.add(ground);
  box(W + 30, 0.14, 3.2, mat(0x4a5162), 0, 0.07, D / 2 + 1.7, bd, false);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(W + 60, 7), mat(0x1b2130, { roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, D / 2 + 6.8); bd.add(road);
  for (let x = -W / 2 - 26; x < W / 2 + 26; x += 4) box(2, 0.02, 0.18, new THREE.MeshBasicMaterial({ color: 0xc9b98a }), x, 0.02, D / 2 + 6.8, bd, false);
  box(W + 30, 0.14, 3.2, mat(0x4a5162), 0, 0.07, D / 2 + 11.9, bd, false);
  const wins = [], bodies = [];
  let x = -W / 2 - 0.2;
  for (let i = 0; i < 3; i++) { const w = 5 + Math.random() * 3; bodies.push([x - w / 2, 0, w, 6 + Math.random() * 5, D]); x -= w + 0.1; }
  x = W / 2 + 0.2;
  for (let i = 0; i < 3; i++) { const w = 5 + Math.random() * 3; bodies.push([x + w / 2, 0, w, 6 + Math.random() * 5, D]); x += w + 0.1; }
  for (let xx = -W / 2 - 22; xx < W / 2 + 22;) { const w = 4 + Math.random() * 4; bodies.push([xx + w / 2, D / 2 + 17.5, w, 5 + Math.random() * 9, 8]); xx += w + 0.3; }
  const bm = [mat(0x26304a), mat(0x2c3653), mat(0x222b42)];
  bodies.forEach(([bx, bz, w, h, d], i) => {
    box(w, h, d, bm[i % 3], bx, h / 2, bz, bd, false);
    const face = bz > 0 ? bz - d / 2 - 0.01 : bz + d / 2 + 0.01;
    for (let fy = 3.2; fy < h - 0.8; fy += 2.2) for (let fx = bx - w / 2 + 0.8; fx < bx + w / 2 - 0.6; fx += 1.4)
      if (Math.random() < 0.6) wins.push([fx, fy, face, bz > 0 ? Math.PI : 0]);
  });
  const palette = [0xffd38a, 0xffe8b8, 0x9fd7ff, 0xffb46b];
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, wins.length));
  const o = new THREE.Object3D(), col = new THREE.Color();
  wins.forEach(([wx, wy, wz, ry], i) => { o.position.set(wx, wy, wz); o.rotation.set(0, ry, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.setHex(palette[i % 4]).multiplyScalar(0.55 + Math.random() * 0.5)); });
  bd.add(im);
  for (let lx = -W / 2 - 10; lx <= W / 2 + 10; lx += 10) {
    box(0.1, 4.2, 0.1, mat(0x59606e), lx, 2.1, D / 2 + 2.9, bd, false);
    box(0.8, 0.08, 0.2, mat(0x59606e), lx, 4.2, D / 2 + 2.6, bd, false);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); bulb.position.set(lx, 4.1, D / 2 + 2.3); bd.add(bulb);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.08, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.16, D / 2 + 2.3); bd.add(pool);
  }
  return bd;
}

/* ---------- room ----------
   opts.mode: "arena" | "edu"
   opts.occupant(i, bay): null (empty) | { seated, color, headset, idle }
   opts.free: index of the free bay (gets an orange ring + hotspot), or -1 */
export function buildRoom(opts = {}) {
  const { W, D, H, nL, nS } = { ...DEFAULT, ...opts };
  const edu = opts.mode === "edu";
  const room = { group: new THREE.Group(), labelsGroup: new THREE.Group(), labels: [], animated: [], colliders: [], circles: [], hotspots: [], bayAvatars: [], waiting: [] };
  const G = room.group; G.add(room.labelsGroup);
  const label = (text, x, y, z, bg, scale) => { const s = spriteLabel(text, bg, scale); s.position.set(x, y, z); room.labels.push(s); room.labelsGroup.add(s); return s; };
  const L = layout(W, D, nL, nS);
  const zB = D / 2 - FRONT, bx0 = -W / 2, bx1 = -W / 2 + SW, rx = bx1 + 1.6, wx = W / 2 - 2.0;

  box(W, 0.06, D, mat(0x283247, { roughness: 0.6, metalness: 0.1 }), 0, -0.03, 0, G);
  box(W - 0.2, 0.012, FRONT - 0.2, mat(0x3a3f4c), 0, 0.007, D / 2 - FRONT / 2, G);
  box(W, H, 0.16, mat(0x2b3858), 0, H / 2, -D / 2, G);
  const glassSide = mat(0x3c4a66, { transparent: true, opacity: 0.32, depthWrite: false });
  box(0.16, H, D, glassSide, -W / 2, H / 2, 0, G); box(0.16, H, D, glassSide, W / 2, H / 2, 0, G);
  const accent = new THREE.MeshBasicMaterial({ color: edu ? 0x5b8cff : 0x2ad1cf });
  box(W - 0.4, 0.06, 0.02, accent, 0, H - 0.25, -D / 2 + 0.09, G, false); box(W - 0.4, 0.06, 0.02, accent, 0, 0.25, -D / 2 + 0.09, G, false);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd6e8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const doorW = 1.6;
  box((W - doorW) / 2, H, 0.06, glass, -(W + doorW) / 4, H / 2, D / 2, G); box((W - doorW) / 2, H, 0.06, glass, (W + doorW) / 4, H / 2, D / 2, G);
  box(W + 0.3, 0.55, 0.2, mat(0x1b2a4a), 0, H + 0.02, D / 2, G);
  room.signMat = new THREE.MeshBasicMaterial({ map: textTexture("IT HUB VR ARENA", 6, 0.46, "#101a33", "#ffb347", "800 96px Manrope, system-ui"), toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W * 0.55, 6), 0.46), room.signMat); sign.position.set(0, H + 0.02, D / 2 + 0.11); G.add(sign);
  room.neonPos = V(0, H - 0.3, D / 2 + 1.6);
  box(doorW + 0.1, 0.05, 0.25, mat(0x14a5a3, { emissive: 0x0c7473, emissiveIntensity: 0.8 }), 0, H - 0.3, D / 2, G, false);
  label(T("l_street"), 0, 0.7, D / 2 + 1.8, "rgba(27,42,74,0.92)", 0.8);

  // service block
  const zMid = D / 2 - 1.4, part = mat(0x8fa3c7, { transparent: true, opacity: 0.26, depthWrite: false });
  box(0.1, 2.4, FRONT, part, bx1, 1.2, D / 2 - FRONT / 2, G); box(SW, 2.4, 0.1, part, (bx0 + bx1) / 2, 1.2, zMid, G); box(0.08, 2.4, 1.4, part, bx0 + 1.6, 1.2, D / 2 - 0.7, G);
  box(2.2, 1.6, 0.45, mat(0x58657f), bx0 + 1.3, 0.8, zB + 0.35, G);
  for (let i = 0; i < 6; i++) { box(0.18, 0.22, 0.12, mat(0xf2f4f7), bx0 + 0.45 + i * 0.34, 1.25, zB + 0.25, G); box(0.04, 0.04, 0.01, new THREE.MeshBasicMaterial({ color: 0x3df27a }), bx0 + 0.45 + i * 0.34, 1.12, zB + 0.18, G, false); }
  label(T("l_storage"), bx0 + SW / 2, 2.95, zB + 0.6, "rgba(27,42,74,0.92)", 0.65);
  box(0.42, 0.42, 0.6, mat(0xeeeeee), bx0 + 0.45, 0.21, D / 2 - 0.45, G); box(0.42, 0.4, 0.18, mat(0xeeeeee), bx0 + 0.45, 0.6, D / 2 - 0.18, G); box(0.45, 0.12, 0.35, mat(0xeeeeee), bx0 + 1.2, 0.85, D / 2 - 1.2, G);
  label(T("l_wc"), bx0 + 0.8, 2.95, D / 2 - 0.7, "rgba(27,42,74,0.92)", 0.6);
  const shx = bx0 + 2.4;
  box(1.3, 0.08, 1.2, mat(0xdfe6ee, { roughness: 0.3 }), shx, 0.04, D / 2 - 0.75, G);
  box(0.06, 2.0, 1.2, new THREE.MeshPhysicalMaterial({ color: 0xbfe3f0, transparent: true, opacity: 0.25, roughness: 0.05 }), shx - 0.62, 1.0, D / 2 - 0.75, G);
  box(0.06, 1.0, 0.06, mat(0xbcc4cf, { metalness: 0.8, roughness: 0.3 }), bx1 - 0.15, 1.9, D / 2 - 0.4, G);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20), mat(0xbcc4cf, { metalness: 0.8, roughness: 0.3 })); sh.position.set(bx1 - 0.3, 2.35, D / 2 - 0.4); G.add(sh);
  label(T("l_shower"), shx, 2.95, D / 2 - 0.7, "rgba(27,42,74,0.92)", 0.6);
  for (let i = 0; i < 3; i++) { box(0.45, 1.9, 0.45, mat(i % 2 ? 0x14a5a3 : 0x0e7c7b, { roughness: 0.5 }), bx1 + 0.3, 0.95, zB + 0.35 + i * 0.47, G); box(0.08, 0.04, 0.02, mat(0xf2f4f7), bx1 + 0.53, 1.1, zB + 0.35 + i * 0.47, G); }
  label(T("l_lockers"), bx1 + 0.4, 2.45, zB + 0.8, "rgba(27,42,74,0.92)", 0.6);
  room.colliders.push([bx0, bx1 + 0.05, zB, D / 2], [bx1, bx1 + 0.56, zB + 0.1, zB + 1.5]);
  room.hotspots.push({ id: "lockers", x: bx1 + 1.0, z: zB + 0.85, r: 1.0 });

  // reception
  box(1.8, 1.05, 0.6, mat(0x14a5a3, { roughness: 0.45 }), rx, 0.52, D / 2 - 1.5, G);
  box(1.9, 0.06, 0.7, mat(0xe9eef3), rx, 1.08, D / 2 - 1.5, G);
  box(0.5, 0.32, 0.03, new THREE.MeshBasicMaterial({ color: 0x9fd6e8 }), rx + 0.4, 1.3, D / 2 - 1.6, G, false);
  if (opts.host !== false) { const host = makeAvatar({ color: 0x1b2a4a, headset: false }); host.g.position.set(rx, 0, D / 2 - 2.1); host.g.rotation.y = Math.PI; G.add(host.g); room.animated.push(host); room.host = host; }
  label(T("l_reception"), rx, 2.6, D / 2 - 1.5);
  room.colliders.push([rx - 0.95, rx + 0.95, D / 2 - 1.85, D / 2 - 1.15]); room.circles.push([rx, D / 2 - 2.1, 0.35]);
  room.hotspots.push({ id: "reception", x: rx, z: D / 2 - 0.65, r: 1.0 });

  // waiting area + TV
  box(2.2, 0.42, 0.8, mat(0x6b4f8a), wx, 0.21, D / 2 - 1.0, G); box(2.2, 0.5, 0.18, mat(0x6b4f8a), wx, 0.6, D / 2 - 0.55, G);
  box(0.8, 0.42, 1.6, mat(0x6b4f8a), W / 2 - 0.55, 0.21, D / 2 - 2.0, G);
  const seats = opts.spectators ?? [[wx - 0.5, D / 2 - 1.0, 0xe8a33d], [wx + 0.5, D / 2 - 1.0, 0x3d7be8], [W / 2 - 0.55, D / 2 - 2.0, 0x6bbf59]];
  seats.forEach(([x, z, c]) => {
    const a = makeAvatar({ seated: true, color: c, headset: false }); a.g.position.set(x, 0, z);
    a.g.rotation.y = Math.atan2(x - wx, z - zB); G.add(a.g); room.animated.push(a); room.waiting.push(a);
  });
  const sc = document.createElement("canvas"); sc.width = 1024; sc.height = 576;
  const tex = new THREE.CanvasTexture(sc); tex.colorSpace = THREE.SRGBColorSpace;
  box(2.5, 1.45, 0.06, mat(0x111111), wx, 1.75, zB + 0.05, G);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.set(wx, 1.75, zB + 0.09); G.add(scr);
  room.screen = { canvas: sc, ctx: sc.getContext("2d"), tex, mesh: scr, pos: V(wx, 1.75, zB + 0.09) };
  label(T(edu ? "l_teacher" : "l_wait"), wx, 3.0, zB + 0.2);
  room.colliders.push([wx - 1.15, wx + 1.15, D / 2 - 1.45, D / 2 - 0.4], [W / 2 - 0.95, W / 2, D / 2 - 2.85, D / 2 - 1.15], [wx - 1.3, wx + 1.3, zB - 0.06, zB + 0.16]);
  room.hotspots.push({ id: "screen", x: wx, z: zB + 0.85, r: 1.0 });

  // railing
  const leftEnd = bx1, openA = rx + 1.2, openB = openA + 1.4;
  const panel = mat(0x22314f, { transparent: true, opacity: 0.6 }), rail = mat(0x14a5a3, { roughness: 0.4, emissive: 0x0c7473, emissiveIntensity: 0.5 });
  box(openA - leftEnd, 0.9, 0.05, panel, (leftEnd + openA) / 2, 0.45, zB, G); box(W / 2 - openB, 0.9, 0.05, panel, (openB + W / 2) / 2, 0.45, zB, G);
  box(openA - leftEnd, 0.05, 0.08, rail, (leftEnd + openA) / 2, 0.92, zB, G); box(W / 2 - openB, 0.05, 0.08, rail, (openB + W / 2) / 2, 0.92, zB, G);
  room.colliders.push([leftEnd, openA, zB - 0.08, zB + 0.08], [openB, W / 2, zB - 0.08, zB + 0.08]);

  // bays
  const free = opts.free ?? (L.bays.length > 1 ? 1 : 0);
  room.freeBay = free >= 0 ? L.bays[free] : null;
  const occupant = opts.occupant || ((i, b) => i === free ? null : { seated: b.t === "S" && !edu && i % 2 === 0, color: b.t === "L" ? 0x3d7be8 : 0xe85d75 });
  L.bays.forEach((b, i) => {
    const c = b.t === "L" ? (edu ? 0x5b8cff : 0x2ad1cf) : (edu ? 0x9b7cff : 0xffb347);
    box(b.s, 0.03, b.s, mat(0x1d2a40, { roughness: 1 }), b.x, 0.015, b.z, G);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.s, 0.04, b.s)), new THREE.LineBasicMaterial({ color: c }));
    edge.position.set(b.x, 0.035, b.z); G.add(edge); b.edge = edge;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(b.s, b.s), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(b.x, 0.04, b.z); G.add(pool); b.pool = pool;
    box(0.08, 0.08, 0.08, mat(0x888888), b.x, H - 0.04, b.z, G);
    if (edu && b.t === "S") { box(0.9, 0.05, 0.5, mat(0xd9dde3), b.x, 0.85, b.z - 0.45, G); box(0.06, 0.85, 0.06, mat(0x888888), b.x, 0.42, b.z - 0.45, G); room.colliders.push([b.x - 0.45, b.x + 0.45, b.z - 0.7, b.z - 0.2]); }
    if (edu) {
      const holo = new THREE.Group(); holo.position.set(b.x, 1.95, b.z - (b.t === "S" ? 0.45 : 0));
      holo.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff6b6b })));
      for (let k = 0; k < 2; k++) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xeaf6ff })); a.position.set(Math.cos(k * 1.82) * 0.26, 0, Math.sin(k * 1.82) * 0.26); holo.add(a); }
      G.add(holo); room.animated.push({ holo, phase: i, baseY: 1.95 });
    }
    const occ = occupant(i, b);
    if (occ) {
      const a = makeAvatar({ seated: !!occ.seated, color: occ.color ?? 0x3d7be8, headset: occ.headset !== false });
      a.g.position.set(b.x, 0, b.z + (edu && b.t === "S" ? 0.15 : 0)); G.add(a.g); room.animated.push(a); room.bayAvatars[i] = a;
      room.circles.push([b.x, b.z, 0.4]);
    } else if (i === free) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, 0.05, b.z); G.add(ring); room.animated.push({ ring, phase: 0 });
      room.hotspots.push({ id: "bay", x: b.x, z: b.z, r: 0.9 });
    }
    if (opts.bayLabels !== false) label(i === free ? T("l_free") : (edu ? T("l_labo") : T("l_vr")) + " " + (i + 1), b.x, H + 0.35, b.z, i === free ? "rgba(232,163,61,0.95)" : (b.t === "L" ? (edu ? "rgba(61,110,232,0.92)" : "rgba(14,124,123,0.92)") : (edu ? "rgba(123,92,214,0.92)" : "rgba(196,128,32,0.95)")), 0.55);
  });
  if (L.bays.length && opts.bayLabels !== false) { const zs = L.bays.map(b => b.z); label(T(edu ? "l_lab" : "l_play"), 0, H + 1.05, (Math.min(...zs) + Math.max(...zs)) / 2, "rgba(27,42,74,0.95)", 1.05); }
  room.glowColor = edu ? 0x6a8dff : 0x2ad1cf;
  room.dims = { W, D, H }; room.layout = L; room.bays = L.bays; room.pts = { rx, bx0, bx1, openA, openB, wx, zB };
  return room;
}

/* default content for the waiting-room TV */
export function drawScreen(room, t, mode) {
  const g = room.screen.ctx, w = 1024, h = 576, edu = mode === "edu", ar = rtl();
  g.fillStyle = "#0d1626"; g.fillRect(0, 0, w, h);
  g.textAlign = ar ? "right" : "left"; const X = ar ? w - 50 : 50, X2 = ar ? 60 : w - 60;
  g.fillStyle = "#2ad1cf"; g.font = fontFor(44); g.fillText(edu ? T("scr_lab") : T("scr_rank"), X, 80);
  if (!edu) {
    ["Tazekka", "Friouato", "Bab Boudir", "Taza Haute"].forEach((nm, i) => {
      const sc = Math.round(1800 - i * 260 + 120 * Math.sin(t * 0.7 + i));
      g.fillStyle = i === 0 ? "#ffb347" : "#E9EEF3"; g.font = fontFor(40);
      g.textAlign = ar ? "right" : "left"; g.fillText(`${i + 1}. ${T("scr_team")} ${nm}`, X, 175 + i * 95);
      g.textAlign = ar ? "left" : "right"; g.fillText(sc + " pts", X2, 175 + i * 95);
    });
  } else {
    g.fillStyle = "#E9EEF3"; g.font = fontFor(40); g.textAlign = "left"; g.fillText("2 H₂ + O₂ → 2 H₂O", 50, 190);
    g.textAlign = ar ? "right" : "left"; g.font = fontFor(32, "500"); g.fillStyle = "#9AA8B8";
    g.fillText(T("scr_group", { n: 1 + Math.floor(t / 6) % 4 }), X, 280);
    const p = (t * 0.12) % 1;
    g.fillStyle = "#24324d"; g.fillRect(50, 340, w - 100, 34); g.fillStyle = "#5b8cff"; g.fillRect(ar ? w - 50 - (w - 100) * p : 50, 340, (w - 100) * p, 34);
    g.fillStyle = "#E9EEF3"; g.font = fontFor(30, "500"); g.fillText(T("scr_progress", { n: Math.round(p * 100) }), X, 430);
  }
  room.screen.tex.needsUpdate = true;
}

/* ---------- VR "inside the headset" world (shared by the mini-game and the live TV feed) ---------- */
export function createVrWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f); scene.fog = new THREE.Fog(0x05070f, 12, 46);
  scene.add(new THREE.HemisphereLight(0x9fc7ff, 0x0a0f1d, 1.2));
  const grid = new THREE.GridHelper(220, 110, 0x2ad1cf, 0x123047); grid.position.y = -2; scene.add(grid);
  const g = new THREE.BufferGeometry(), n = 1500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) p.set([(Math.random() - 0.5) * 160, Math.random() * 60 - 5, -Math.random() * 120 - 5], i * 3);
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.25 })));
  const rings = new THREE.Group();
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(6, 0.04, 8, 80), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb347 : 0x2ad1cf, transparent: true, opacity: 0.5 })); r.position.set(0, 1.5, -10 - i * 9); rings.add(r); }
  scene.add(rings);
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200);
  camera.position.set(0, 1.6, 4); camera.lookAt(0, 1.6, -10);
  const geo = { ico: new THREE.IcosahedronGeometry(0.45, 0), O: new THREE.SphereGeometry(0.42, 24, 16), H: new THREE.SphereGeometry(0.28, 20, 14), cake: new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24) };
  const vw = { scene, camera, targets: [], bursts: [], rings, mode: "arena", spawnT: 0, elapsed: 0 };
  vw.spawn = (speedBoost = 0) => {
    let m;
    if (vw.mode === "edu") { const o = Math.random() < 0.34; m = new THREE.Mesh(o ? geo.O : geo.H, new THREE.MeshStandardMaterial({ color: o ? 0xff5a5a : 0xf2f6ff, emissive: o ? 0x801818 : 0x334455, roughness: 0.3 })); }
    else if (vw.mode === "party") { const c = [0xff6fae, 0xffd166, 0x6ee7ff, 0xa78bfa][Math.floor(Math.random() * 4)]; m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.3 })); m.scale.y = 1.2; }
    else { const c = Math.random() < 0.5 ? 0xffb347 : 0x2ad1cf; m = new THREE.Mesh(geo.ico, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, flatShading: true })); }
    m.position.set((Math.random() - 0.5) * 7, 0.2 + Math.random() * 3.2, -34);
    m.userData.v = 7 + Math.random() * 4 + speedBoost; m.userData.spin = V(Math.random(), Math.random(), 0).multiplyScalar(3);
    scene.add(m); vw.targets.push(m); return m;
  };
  vw.burst = (pos, color) => {
    const n = 40, bg = new THREE.BufferGeometry(), arr = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { arr.set([pos.x, pos.y, pos.z], i * 3); vel.push(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4)); }
    bg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(bg, new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 1 }));
    scene.add(pts); vw.bursts.push({ pts, vel, life: 0.7 });
  };
  vw.hit = m => { vw.burst(m.position, m.material.color); scene.remove(m); vw.targets.splice(vw.targets.indexOf(m), 1); };
  vw.clear = () => { vw.targets.forEach(m => scene.remove(m)); vw.targets = []; };
  vw.update = (dt, t, { auto = false, rate = 0.8 } = {}) => {
    vw.spawnT -= dt;
    if (vw.spawnT <= 0) { vw.spawn(); vw.spawnT = rate; }
    for (let i = vw.targets.length - 1; i >= 0; i--) {
      const m = vw.targets[i]; m.position.z += m.userData.v * dt; m.rotation.x += m.userData.spin.x * dt; m.rotation.y += m.userData.spin.y * dt;
      if (auto && m.position.z > -6 && Math.random() < dt * 2.2) { vw.hit(m); continue; }
      if (m.position.z > 5) { scene.remove(m); vw.targets.splice(i, 1); }
    }
    for (let i = vw.bursts.length - 1; i >= 0; i--) {
      const b = vw.bursts[i]; b.life -= dt; const a = b.pts.geometry.attributes.position;
      for (let j = 0; j < b.vel.length; j++) a.setXYZ(j, a.getX(j) + b.vel[j].x * dt, a.getY(j) + b.vel[j].y * dt, a.getZ(j) + b.vel[j].z * dt);
      a.needsUpdate = true; b.pts.material.opacity = Math.max(0, b.life / 0.7);
      if (b.life <= 0) { scene.remove(b.pts); b.pts.geometry.dispose(); vw.bursts.splice(i, 1); }
    }
    rings.children.forEach((r, i) => { r.position.z += dt * 6; if (r.position.z > 6) r.position.z -= 54; r.rotation.z += dt * 0.2 * (i % 2 ? 1 : -1); });
  };
  return vw;
}

/* page-level helpers */
export function onLangChange(fn) { document.addEventListener("langchange", fn); }
export function whenReady(fn) { const go = () => setTimeout(fn, 0); if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); }
export function hideLoader() { const l = document.getElementById("loader"); if (l) l.classList.add("out"); }
