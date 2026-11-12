import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { T, rtl, small, coarse, clamp, lerp, V, createStage, buildRoom, buildBackdrop, makeAvatar, poseAvatar, fontFor, roundRect, createVrWorld, scaleLabels, onLangChange, whenReady, hideLoader } from "./room.js";

/* Page « Vivre une session » : partie de jeu, anniversaire ou cours universitaire, en direct. */
const $ = id => document.getElementById(id);
const stage = $("xstage");
const S = createStage(stage);
const { renderer, scene, camera, roomGlow, neon } = S;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 5; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI * 0.47;
renderer.domElement.style.touchAction = "pan-y";

const vw = createVrWorld();
const rt = new THREE.WebGLRenderTarget(small ? 448 : 640, small ? 320 : 460, { colorSpace: THREE.SRGBColorSpace });
const st = { sc: "game", view: "room", speed: 30, simT: 0, rot: 1, ended: false, featured: 0, featT: 0, toastT: 0 };
let room = null, extras = null, players = [], live = null, deco = [], crowd = [];
const NAMES = { game: ["Yassine", "Salma", "Omar", "Hiba"], bday: ["Yasmine", "Adam", "Lina", "Rayan", "Inès", "Sami", "Nour", "Ilyas"], class: ["Amine", "Salma", "Karim", "Nora", "Ilyas", "Rania", "Mehdi", "Kenza"], next: ["Anas", "Meryem", "Hamza", "Aya", "Zakaria", "Soukaina"] };
const COLS = [0x3d7be8, 0xe85d75, 0x6bbf59, 0x9b7cff, 0xe8a33d, 0x2ad1cf, 0xff7a59, 0x5b8cff];

/* dynamic label above a player: name + time left + bar */
function dynLabel() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 150;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  const k = small ? 0.75 : 0.9; s.scale.set(1.6 * k, 0.47 * k, 1); s.userData.base = s.scale.clone(); s.renderOrder = 25;
  s.userData.draw = (name, left, frac, done) => {
    const g = c.getContext("2d"); g.clearRect(0, 0, 512, 150);
    g.fillStyle = done ? "rgba(70,80,100,0.92)" : "rgba(15,23,48,0.9)"; roundRect(g, 6, 6, 500, 138, 28); g.fill();
    g.fillStyle = "#fff"; g.font = fontFor(40); g.textAlign = rtl() ? "right" : "left"; g.textBaseline = "middle";
    g.fillText(name, rtl() ? 482 : 30, 50);
    g.fillStyle = done ? "#C9D3E5" : "#ffb347"; g.textAlign = rtl() ? "left" : "right"; g.fillText(done ? T("tv_done") : left, rtl() ? 30 : 482, 50);
    g.fillStyle = "rgba(255,255,255,0.15)"; roundRect(g, 30, 98, 452, 18, 9); g.fill();
    g.fillStyle = done ? "#9FB0CC" : "#2ad1cf"; const w = Math.max(18, 452 * clamp(frac, 0, 1)); roundRect(g, rtl() ? 482 - w : 30, 98, w, 18, 9); g.fill();
    tex.needsUpdate = true;
  };
  return s;
}
const mmss = sec => { sec = Math.max(0, Math.round(sec)); return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; };

/* ---------- scenario setup ---------- */
function setup(sc) {
  st.sc = sc; st.simT = 0; st.rot = 1; st.ended = false; st.rotating = false; st.featured = 0; st.featT = 0;
  if (room) scene.remove(room.group);
  if (extras) scene.remove(extras);
  extras = new THREE.Group(); scene.add(extras); deco = []; crowd = [];
  const mode = sc === "class" ? "edu" : "arena";
  const n = sc === "game" ? 4 : 8;
  const W = 12, D = 8, zB = D / 2 - 2.8, wx = W / 2 - 2.0;
  const spectators = sc === "bday" ? [[wx - 0.5, D / 2 - 1.0, 0x6b4f8a], [wx + 0.5, D / 2 - 1.0, 0x1b2a4a]] : sc === "class" ? [[wx - 0.5, D / 2 - 1.0, 0x3d7be8], [wx + 0.5, D / 2 - 1.0, 0xe85d75], [W / 2 - 0.55, D / 2 - 2.0, 0x6bbf59]] : undefined;
  room = buildRoom({ mode, free: -1, occupant: (i, b) => i < n ? { seated: sc === "game" && b.t === "S", color: COLS[i % COLS.length] } : null, spectators });
  scene.add(room.group); room.labelsGroup.visible = st.view === "room";
  roomGlow.color.setHex(room.glowColor); neon.position.copy(room.neonPos);
  if (!scene.userData.bd) { scene.userData.bd = buildBackdrop(W, D); scene.add(scene.userData.bd); }
  // players
  const names = NAMES[sc];
  const total = sc === "bday" ? 60 * 60 : sc === "class" ? 25 * 60 : 20 * 60;
  const start = sc === "game" ? [2, 8, 13, 17.4] : Array(8).fill(0);
  players = names.slice(0, n).map((name, i) => {
    const b = room.bays[i], av = room.bayAvatars[i], lab = dynLabel();
    lab.position.set(b.x, 2.75, b.z); extras.add(lab);
    return { name, i, b, av, lab, total, elapsed: start[i] * 60, done: false, doneT: 0 };
  });
  // the TV live feed
  const sp = room.screen.pos;
  live = new THREE.Mesh(new THREE.PlaneGeometry(1.406, 1.008), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }));
  live.position.set(sp.x - 0.45, sp.y - 0.04, sp.z + 0.01); extras.add(live);
  vw.mode = sc === "class" ? "edu" : sc === "bday" ? "party" : "arena"; vw.clear();
  // scenario extras
  if (sc === "bday") {
    const bcol = [0xff6fae, 0xffd166, 0x6ee7ff, 0xa78bfa, 0xff8a5b];
    const spots = [[room.pts.rx - 0.9, D / 2 - 1.2], [room.pts.rx + 0.9, D / 2 - 1.2], [-W / 2 + 0.5, -D / 2 + 0.5], [W / 2 - 0.5, -D / 2 + 0.5], [W / 2 - 3.3, zB + 0.6]];
    spots.forEach(([x, z], k) => {
      for (let j = 0; j < 3; j++) {
        const bl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), new THREE.MeshStandardMaterial({ color: bcol[(k + j) % 5], roughness: 0.25, metalness: 0.1 }));
        bl.scale.y = 1.2; const by = 2.1 + j * 0.25; bl.position.set(x + (j - 1) * 0.25, by, z + (j % 2) * 0.15); extras.add(bl);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, by - 1.1), new THREE.MeshBasicMaterial({ color: 0xdddddd })); str.position.set(bl.position.x, (by + 1.1) / 2 - 0.1, bl.position.z); extras.add(str);
        deco.push({ float: bl, baseY: by, phase: k + j });
      }
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.7), new THREE.MeshBasicMaterial({ map: bannerTex(), transparent: true, toneMapped: false }));
    banner.position.set(0, 2.45, -D / 2 + 0.1); extras.add(banner); extras.userData.banner = banner;
    // cake table near the waiting area
    const tx = W / 2 - 3.6, tz = D / 2 - 0.8;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 28), new THREE.MeshStandardMaterial({ color: 0xffffff })); top.position.set(tx, 0.78, tz); extras.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.76), new THREE.MeshStandardMaterial({ color: 0x888888 })); leg.position.set(tx, 0.38, tz); extras.add(leg);
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.22, 28), new THREE.MeshStandardMaterial({ color: 0xf6d5e5 })); cake.position.set(tx, 0.92, tz); extras.add(cake);
    const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 28), new THREE.MeshStandardMaterial({ color: 0xff6fae })); icing.position.set(tx, 1.03, tz); extras.add(icing);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, cx = tx + Math.cos(a) * 0.15, cz = tz + Math.sin(a) * 0.15;
      const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x9fd6e8 })); cd.position.set(cx, 1.09, cz); extras.add(cd);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc35c })); fl.position.set(cx, 1.15, cz); extras.add(fl); deco.push({ flame: fl, phase: k });
    }
    const pl = new THREE.PointLight(0xffb347, 1.5, 3); pl.position.set(tx, 1.4, tz); extras.add(pl);
  }
  if (sc === "class") {
    // students waiting in front of the screen + the professor
    for (let k = 0; k < 6; k++) {
      const a = makeAvatar({ color: [0x3d7be8, 0xe85d75, 0x6bbf59, 0x9b7cff, 0xe8a33d, 0x2ad1cf][k], headset: false });
      const x = wx - 2.6 + (k % 3) * 0.7, z = zB + 1.05 + Math.floor(k / 3) * 0.6;
      a.g.position.set(x, 0, z); a.g.rotation.y = Math.atan2(x - wx, z - zB); extras.add(a.g); crowd.push(a);
    }
    const prof = makeAvatar({ color: 0xf2f4f7, headset: false }); prof.g.position.set(wx - 1.55, 0, zB + 0.45); prof.g.rotation.y = Math.PI * 0.75; extras.add(prof.g); crowd.push(prof);
  }
  if (sc === "game") {
    const a = makeAvatar({ color: 0xff7a59, headset: false }); a.g.position.set(wx - 2.2, 0, zB + 1.2); a.g.rotation.y = Math.atan2(-2.2, 1.2); extras.add(a.g); crowd.push(a);
  }
  document.querySelectorAll("#scTabs button").forEach(b => b.classList.toggle("on", b.dataset.sc === sc));
  setView(st.view, true);
  toast("");
}
function bannerTex() {
  const c = document.createElement("canvas"); c.width = 1536; c.height = 180; const g = c.getContext("2d");
  const cols = ["#ff6fae", "#ffd166", "#6ee7ff", "#a78bfa", "#ff8a5b"];
  for (let i = 0; i < 24; i++) { g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 64, 0); g.lineTo(i * 64 + 32, 46); g.fill(); }
  g.fillStyle = "#fff"; g.font = fontFor(78, "800"); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(T("bday_banner", { name: NAMES.bday[0] }), 768, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- views ---------- */
const camTarget = new THREE.Vector3();
function setView(v, instant) {
  st.view = v;
  document.querySelectorAll("#vTabs button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  room.labelsGroup.visible = v === "room";
  players.forEach(p => p.lab.visible = v !== "vr");
  controls.enabled = v === "room";
  $("vrBadge").hidden = v !== "vr";
  const { W, D } = room.dims, sp = room.screen.pos;
  if (v === "room") { camera.position.set(W * 0.55, small ? 13 : 9.5, D * (small ? 1.7 : 1.25)); controls.target.set(0, 0.6, -0.4); controls.update(); }
  if (v === "tv") { camera.position.set(sp.x + 0.35, 2.0, D / 2 - 0.12); camTarget.set(sp.x, 1.55, sp.z); camera.lookAt(camTarget); }
}

/* ---------- simulation ---------- */
function simulate(dt) {
  if (st.ended) return;
  const sd = dt * st.speed;
  st.simT += sd;
  players.forEach(p => {
    if (p.done) {
      p.doneT += sd;
      if (st.sc === "game" && p.doneT > 90) { // next player takes the headset
        p.name = NAMES.next[(p.i + Math.floor(st.simT / 600)) % NAMES.next.length]; p.elapsed = 0; p.done = false; p.av.hs.visible = true; p.av.cheer = false; p.av.idle = false;
      }
      return;
    }
    p.elapsed += sd;
    if (p.elapsed >= p.total) {
      p.elapsed = p.total; p.done = true; p.doneT = 0;
      if (st.sc === "game") { p.av.hs.visible = false; p.av.cheer = true; p.av.idle = true; toast(T("ex_end_game")); setTimeout(() => { p.av.cheer = false; }, 2500); }
    }
  });
  if (st.sc === "bday" && players.every(p => p.done)) {
    st.ended = true; players.forEach(p => { p.av.hs.visible = false; p.av.cheer = true; }); room.waiting.forEach(a => a.cheer = true); toast(T("ex_end_bday"));
  }
  if (st.sc === "class" && !st.rotating && players.every(p => p.done)) {
    st.rotating = true;
    players.forEach(p => { p.av.cheer = true; });
    crowd.forEach(a => a.cheer = true);
    toast(T("ex_end_class"));
    if (st.rot >= 4) { st.ended = true; st.rotating = false; return; }
    setTimeout(() => { st.rot++; players.forEach((p, k) => { p.elapsed = 0; p.done = false; p.av.cheer = false; p.name = NAMES.next[(k + st.rot) % NAMES.next.length]; }); crowd.forEach(a => a.cheer = false); st.rotating = false; }, 2200);
  }
}
function toast(msg) { const el = $("xmsg"); el.textContent = msg; el.hidden = !msg; st.toastT = msg ? 4 : 0; }

/* TV + panel drawing */
function drawTV(t) {
  const g = room.screen.ctx, w = 1024, h = 576, ar = rtl();
  g.fillStyle = "#0d1626"; g.fillRect(0, 0, w, h);
  const title = st.sc === "bday" ? T("bday_title", { name: NAMES.bday[0].toUpperCase() }) : st.sc === "class" ? `${T("class_title")} · ${T("class_rot", { n: st.rot })}` : T("game_title");
  g.fillStyle = "#e5484d"; roundRect(g, 20, 22, 120, 44, 10); g.fill();
  g.fillStyle = "#fff"; g.font = fontFor(26); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("● " + T("tv_live"), 80, 45);
  g.textAlign = "left"; g.fillStyle = "#2ad1cf"; g.font = fontFor(30); g.fillText(title, 160, 45);
  const f = players[st.featured];
  if (f) { g.fillStyle = "#C9D3E5"; g.font = fontFor(22, "600"); g.fillText(T("tv_cast", { n: f.i + 1, name: f.name }), 24, 545); }
  // players list (right column)
  g.fillStyle = "#9AA8B8"; g.font = fontFor(22, "700"); g.textAlign = ar ? "right" : "left"; g.fillText(T("tv_players"), ar ? 1004 : 664, 110);
  const rows = players.slice(0, 8), rh = Math.min(54, 420 / rows.length);
  rows.forEach((p, k) => {
    const y = 140 + k * rh, left = p.total - p.elapsed, frac = p.elapsed / p.total;
    g.fillStyle = k === st.featured ? "#ffb347" : "#E9EEF3"; g.font = fontFor(20, "700"); g.textAlign = ar ? "right" : "left";
    g.fillText(`${p.i + 1}. ${p.name}`, ar ? 1004 : 664, y);
    g.textAlign = ar ? "left" : "right"; g.fillStyle = p.done ? "#9FB0CC" : "#ffb347"; g.fillText(p.done ? T("tv_done") : mmss(left), ar ? 664 : 1004, y);
    g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(664, y + 14, 340, 6);
    g.fillStyle = p.done ? "#9FB0CC" : "#2ad1cf"; const bw = 340 * clamp(frac, 0, 1); g.fillRect(ar ? 1004 - bw : 664, y + 14, bw, 6);
  });
  room.screen.tex.needsUpdate = true;
}
function updatePanel() {
  const head = st.sc === "bday" ? T("bday_title", { name: NAMES.bday[0] }) : st.sc === "class" ? `${T("class_title")} · ${T("class_rot", { n: st.rot })}` : T("game_title");
  $("pnTitle").textContent = head;
  $("pnState").textContent = st.ended ? T("pn_end") : T("tv_live");
  $("pnState").classList.toggle("off", st.ended);
  $("pnList").innerHTML = players.map(p => {
    const frac = clamp(p.elapsed / p.total, 0, 1);
    return `<li class="${p.done ? "done" : ""}${p.i === players[st.featured]?.i ? " feat" : ""}"><div class="pn-row"><b>${p.i + 1}. ${p.name}</b><span>${p.done ? T("tv_done") : mmss(p.total - p.elapsed) + " " + T("pn_left")}</span></div><div class="bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div><small>${mmss(p.elapsed)} ${T("pn_elapsed")} / ${mmss(p.total)}</small></li>`;
  }).join("");
  const f = players[st.featured];
  if (f) { $("vrName").textContent = T("tv_cast", { n: f.i + 1, name: f.name }); $("vrLeft").textContent = mmss(f.total - f.elapsed); }
}

/* ---------- UI ---------- */
document.querySelectorAll("#scTabs button").forEach(b => b.onclick = () => setup(b.dataset.sc));
document.querySelectorAll("#vTabs button").forEach(b => b.onclick = () => setView(b.dataset.v));
$("speed").onclick = () => { st.speed = st.speed === 1 ? 30 : 1; $("speed").textContent = T(st.speed === 1 ? "speed_real" : "speed_fast") + (st.speed === 1 ? "" : " ×30"); };
$("restart").onclick = () => setup(st.sc);
document.querySelectorAll("[data-goto-sc]").forEach(b => b.addEventListener("click", () => { setup(b.dataset.gotoSc); stage.scrollIntoView({ behavior: "smooth" }); }));
onLangChange(() => { if (!room) return; const v = st.view; setup(st.sc); setView(v); $("speed").textContent = T(st.speed === 1 ? "speed_real" : "speed_fast") + (st.speed === 1 ? "" : " ×30"); });

/* ---------- loop ---------- */
const clock = new THREE.Clock(); let tick = 0, visible = true, lastPanel = 0;
new IntersectionObserver(es => visible = es[0].isIntersecting).observe(stage);
renderer.setAnimationLoop(() => {
  if (!room || !visible) return;
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  simulate(dt);
  room.animated.forEach(a => poseAvatar(a, t, dt)); crowd.forEach(a => poseAvatar(a, t, dt));
  deco.forEach(d => { if (d.flame) d.flame.scale.setScalar(0.8 + Math.random() * 0.5); else poseAvatar(d, t, dt); });
  players.forEach(p => p.lab.userData.draw(`${p.i + 1}. ${p.name}`, mmss(p.total - p.elapsed), p.elapsed / p.total, p.done));
  // featured player rotates every 7 s
  st.featT += dt; if (st.featT > 7) { st.featT = 0; const act = players.filter(p => !p.done); if (act.length) st.featured = players.indexOf(act[(act.indexOf(players[st.featured]) + 1) % act.length]); }
  if (st.toastT > 0) { st.toastT -= dt; if (st.toastT <= 0) toast(""); }
  // VR world (auto-play for the featured player)
  vw.update(dt, t, { auto: true, rate: st.sc === "class" ? 0.7 : 0.45 });
  vw.camera.position.y = 1.6 + Math.sin(t * 1.3) * 0.05; vw.camera.lookAt(Math.sin(t * 0.5) * 2, 1.6 + Math.sin(t * 0.7) * 0.4, -10);
  if (st.view === "vr") {
    vw.camera.aspect = camera.aspect; vw.camera.updateProjectionMatrix();
    renderer.setRenderTarget(null); renderer.render(vw.scene, vw.camera);
  } else {
    if ((tick % 2) === 0) { vw.camera.aspect = 1.395; vw.camera.updateProjectionMatrix(); renderer.setRenderTarget(rt); renderer.render(vw.scene, vw.camera); renderer.setRenderTarget(null); }
    if ((tick % 6) === 0) drawTV(t);
    if (st.view === "room") { controls.update(); scaleLabels(room.labels, camera); }
    renderer.render(scene, camera);
  }
  tick++;
  if (t - lastPanel > 0.25) { lastPanel = t; updatePanel(); }
});

whenReady(() => {
  const sc = new URLSearchParams(location.search).get("sc");
  setup(["game", "bday", "class"].includes(sc) ? sc : "game");
  $("speed").textContent = T("speed_fast") + " ×30";
  hideLoader();
});
