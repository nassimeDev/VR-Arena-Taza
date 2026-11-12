import * as THREE from "three";
import { T, rtl, reduce, coarse, small, clamp, lerp, smooth, V, angLerp, createStage, buildRoom, buildBackdrop, makeAvatar, poseAvatar, makeHeadset, spriteLabel, drawScreen, createVrWorld, scaleLabels, onLangChange, whenReady, hideLoader, DEFAULT } from "./room.js";

/* Page d'accueil : histoire au défilement + mode jeu + mini-jeu VR */
const $ = id => document.getElementById(id);
const stage = $("stage"), storyEl = $("story");
const S = createStage(stage);
const { renderer, scene, camera, roomGlow, neon } = S;
const world = new THREE.Group(); scene.add(world);
let room = null, backdrop = null;
const state = { mode: "arena", view: "story", p: 0 };

/* player */
const player = makeAvatar({ color: 0xe8a33d, headset: false, player: true });
world.add(player.g);
const pRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
pRing.rotation.x = -Math.PI / 2; pRing.position.y = 0.05; player.g.add(pRing);
const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffc35c, transparent: true, opacity: 0 }));
halo.rotation.x = Math.PI / 2; halo.position.y = 1.45; player.g.add(halo);
let tag = null;
function makeTag() { if (tag) player.g.remove(tag); tag = spriteLabel(T("l_you"), "rgba(232,163,61,0.96)", 0.6, "#1D1405"); tag.position.y = 2.25; player.g.add(tag); }

/* floating headsets (chapter 6) */
const floatGroup = new THREE.Group(); world.add(floatGroup);
let floats = [];
function buildFloats() {
  floatGroup.clear(); floats = [];
  const fb = room.freeBay;
  room.bays.forEach((b, i) => {
    const booked = i !== room.bays.indexOf(fb) && [0, 3, 5].includes(i);
    const mine = b === fb;
    const h = makeHeadset(mine ? 0xffd08a : booked ? 0x8a93a6 : 0xf2f4f7);
    h.g.position.set(b.x, 2.35, b.z); h.g.rotation.x = -0.25; floatGroup.add(h.g);
    const lab = spriteLabel(mine ? T("hs_yours") : booked ? T("hs_booked") : T("hs_free"), mine ? "rgba(232,163,61,0.96)" : booked ? "rgba(70,80,100,0.92)" : "rgba(14,124,123,0.95)", 0.62, mine ? "#1D1405" : "#fff");
    lab.position.set(b.x, 3.05, b.z); floatGroup.add(lab);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.4, 2.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: mine ? 0xffb347 : booked ? 0x6b7280 : 0x2ad1cf, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(b.x, 1.1, b.z); floatGroup.add(beam);
    floats.push({ float: h.g, baseY: 2.35, phase: i * 0.7, lab, beam });
  });
}

/* room build */
function build() {
  if (room) world.remove(room.group);
  const prev = room;
  room = buildRoom({ ...DEFAULT, mode: state.mode });
  world.add(room.group);
  if (!backdrop) { backdrop = buildBackdrop(DEFAULT.W, DEFAULT.D); world.add(backdrop); }
  room.labelsGroup.visible = state.view !== "story";
  roomGlow.color.setHex(room.glowColor); neon.position.copy(room.neonPos);
  room.signMat.color.setScalar(intro.active ? signLevel : 1);
  if (!prev || floats.length !== room.bays.length) buildFloats();
}

/* ---------------- story ---------------- */
let curves = null, path = null;
function makeStory() {
  const { W, D } = room.dims, P = room.pts, fb = room.freeBay || { x: 0, z: -1 };
  const port = camera.aspect < 0.8;
  const pos = [V(5.5, 2.4, D / 2 + 10.5), V(3.4, 2.3, D / 2 + 4.8), V(W / 2 - 1.5, 2.7, D / 2 - 0.35), V(W / 2 - 0.7, 3.5, P.zB + 0.2),
    V(-W / 2 + 1.0, 3.6, P.zB + 0.1), V(fb.x + 2.3, 2.25, fb.z + 2.5), port ? V(0, 8.5, P.zB + 6) : V(0, 6.2, P.zB + 4.6), port ? V(W * 0.4, 16, D * 1.6) : V(W * 0.62, 10, D * 1.2)];
  const tgt = [V(0, 1.9, D / 2), V(0, 1.3, D / 2 - 1.6), V(P.bx1 - 0.6, 1.0, D / 2 - 1.2), V(-1, 0.9, -D / 2 + 1.6),
    V(1.6, 0.8, -D / 2 + 1.6), V(fb.x, 1.45, fb.z - 0.2), V(0, 2.0, -1.4), V(0, 0.4, 0)];
  curves = { pc: new THREE.CatmullRomCurve3(pos, false, "centripetal", 0.5), tc: new THREE.CatmullRomCurve3(tgt, false, "centripetal", 0.5) };
  path = [[0.0, 0, D / 2 + 4.4], [0.13, 0, D / 2 - 0.4], [0.25, P.rx + 1.5, D / 2 - 0.85], [0.35, (P.openA + P.openB) / 2, P.zB + 0.35], [0.43, fb.x, fb.z]];
}
function playerAt(p) {
  let i = 0; while (i < path.length - 2 && p > path[i + 1][0]) i++;
  const a = path[i], b = path[i + 1], k = clamp((p - a[0]) / (b[0] - a[0]), 0, 1), e = smooth(k);
  return { x: lerp(a[1], b[1], e), z: lerp(a[2], b[2], e), dx: b[1] - a[1], dz: b[2] - a[2], moving: k > 0 && k < 1 };
}
const camTarget = new THREE.Vector3();
const railDots = [...document.querySelectorAll("#rail i")];
const chapters = [...document.querySelectorAll(".ch")];
let lastP = 0;
function storyUpdate(dt, t) {
  const p = state.p;
  const want = p >= 0.5 && p < 0.79 ? "edu" : "arena";
  if (want !== state.mode) { state.mode = want; build(); }
  const pl = playerAt(Math.min(p, 0.43));
  player.g.position.set(pl.x, player.g.position.y, pl.z);
  player.walk = lerp(player.walk, pl.moving && Math.abs(p - lastP) > 1e-5 ? 1 : 0, Math.min(1, dt * 8));
  const face = p < 0.43 ? (p < 0.01 ? 0 : Math.atan2(-pl.dx, -pl.dz)) : 0;
  player.g.rotation.y = angLerp(player.g.rotation.y, face, Math.min(1, dt * 6));
  player.hs.visible = p > 0.425;
  player.idle = !(p > 0.425 && player.walk < 0.05);
  const handsOn = p > 0.62 && p < 0.8;
  player.hands.forEach(h => h.visible = handsOn);
  halo.material.opacity = handsOn ? 0.5 + 0.3 * Math.sin(t * 3) : 0;
  lastP = p;
  // floating headsets
  const f = smooth((p - 0.77) / 0.06) * (1 - smooth((p - 0.93) / 0.05));
  floatGroup.visible = f > 0.01;
  floats.forEach(o => { o.float.scale.setScalar(f); o.lab.material.opacity = f; o.beam.material.opacity = 0.12 * f; });
  if (!intro.active) { camera.position.copy(curves.pc.getPoint(p)); camTarget.copy(curves.tc.getPoint(p)); camera.lookAt(camTarget); }
  const n = 7;
  chapters.forEach(el => {
    const i = +el.dataset.ch, c = i / n;
    let a = clamp(1 - (Math.abs(p - c) * n - 0.22) / 0.3, 0, 1);
    if (i === 0) a = (p < c ? 1 : a) * intro.textK;
    if (i === 7 && p > c) a = 1;
    const dir = p > c ? -1 : 1;
    el.style.opacity = a.toFixed(3);
    el.style.transform = (i === 7 && !small ? "translateY(-50%) " : "") + `translateY(${((1 - a) * 26 * dir).toFixed(1)}px)`;
    el.classList.toggle("live", a > 0.5);
  });
  const on = Math.round(p * n); railDots.forEach((d, i) => d.classList.toggle("on", i === on));
}
function readScroll() { const r = storyEl.getBoundingClientRect(), total = storyEl.offsetHeight - innerHeight; return clamp(-r.top / total, 0, 1); }

/* intro */
const intro = { active: false, t: 0, textK: 1 };
let signLevel = 1;
function startIntro() {
  if (reduce || readScroll() > 0.01) return;
  intro.active = true; intro.t = 0; intro.textK = 0; intro.from = { p: V(3, 30, room.dims.D / 2 + 9), t: V(0, 0, room.dims.D / 2 + 1) };
}
function introUpdate(dt) {
  if (!intro.active) return;
  intro.t += dt / 3.4; const k = smooth(intro.t);
  camera.position.lerpVectors(intro.from.p, curves.pc.getPoint(0), k);
  camTarget.lerpVectors(intro.from.t, curves.tc.getPoint(0), k); camera.lookAt(camTarget);
  intro.textK = smooth((intro.t - 0.7) / 0.3);
  signLevel = intro.t < 0.55 ? 0.2 : intro.t < 0.85 ? (Math.random() > 0.45 ? 1 : 0.15) : 1;
  room.signMat.color.setScalar(signLevel); neon.intensity = 14 * signLevel;
  if (intro.t >= 1 || readScroll() > 0.01) { intro.active = false; intro.textK = 1; signLevel = 1; room.signMat.color.setScalar(1); neon.intensity = 14; }
}

/* ---------------- play mode ---------------- */
const keys = new Set(), joyV = { x: 0, y: 0 };
let camYaw = 0, nearSpot = null, dragging = false, lastX = 0;
const playCam = new THREE.Vector3();
function setImmersive(on) {
  document.body.classList.toggle("immersive", on);
  document.documentElement.style.overflow = on ? "hidden" : "";
  stage.classList.toggle("full", on);
  document.dispatchEvent(new Event("immersive")); S.fit();
}
function enterPlay(mode) {
  state.view = "play"; if (mode) state.mode = mode;
  build(); setImmersive(true); floatGroup.visible = false;
  $("playHud").hidden = false; $("vrHud").hidden = true; room.labelsGroup.visible = true; tag.visible = true;
  player.hs.visible = false; player.hands.forEach(h => h.visible = false); halo.material.opacity = 0;
  const sx = (room.pts.openA + room.pts.openB) / 2, D = room.dims.D;
  player.g.position.set(sx, 0, D / 2 - 0.5); player.g.rotation.y = 0; camYaw = 0; playCam.set(sx, 2.4, D / 2 + 2.8);
  $("joy").hidden = !coarse; $("playHelp").textContent = T(coarse ? "play_help_touch" : "play_help_kb");
  document.querySelectorAll("#playSeg button").forEach(b => b.classList.toggle("on", b.dataset.mode === state.mode));
  intro.active = false; room.signMat.color.setScalar(1); neon.intensity = 14; camera.clearViewOffset(); nearSpot = undefined;
}
function exitPlay() {
  state.view = "story"; $("playHud").hidden = true; $("info").hidden = true; $("prompt").hidden = true;
  setImmersive(false); state.mode = state.p >= 0.5 && state.p < 0.79 ? "edu" : "arena"; build();
}
function blocked(x, z) {
  const { W, D } = room.dims, r = 0.25;
  if (x < -W / 2 + 0.3 || x > W / 2 - 0.3 || z < -D / 2 + 0.3 || z > D / 2 - 0.25) return true;
  for (const [x0, x1, z0, z1] of room.colliders) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
  for (const [cx, cz, cr] of room.circles) if ((x - cx) ** 2 + (z - cz) ** 2 < (cr + r) ** 2) return true;
  return false;
}
function playUpdate(dt) {
  let f = 0, s = 0;
  if (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("KeyZ")) f += 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) f -= 1;
  if (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("KeyQ")) s -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) s += 1;
  f += -joyV.y; s += joyV.x;
  const len = Math.hypot(f, s), P = player.g.position;
  if (len > 0.08) {
    const k = Math.min(1, len) / len, sp = 2.4 * dt;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const mx = (fx * f + rx * s) * k * sp, mz = (fz * f + rz * s) * k * sp;
    if (!blocked(P.x + mx, P.z)) P.x += mx;
    if (!blocked(P.x, P.z + mz)) P.z += mz;
    player.g.rotation.y = angLerp(player.g.rotation.y, Math.atan2(-mx, -mz), Math.min(1, dt * 10));
    player.walk = lerp(player.walk, 1, Math.min(1, dt * 8));
    if (!dragging) camYaw = angLerp(camYaw, player.g.rotation.y, Math.min(1, dt * 1.2));
  } else player.walk = lerp(player.walk, 0, Math.min(1, dt * 8));
  player.idle = true;
  const dist = small ? 3.6 : 3.2;
  playCam.lerp(V(P.x + Math.sin(camYaw) * dist, 2.3, P.z + Math.cos(camYaw) * dist), Math.min(1, dt * 5));
  camera.position.copy(playCam); camTarget.set(P.x, 1.2, P.z); camera.lookAt(camTarget);
  let spot = null;
  for (const h of room.hotspots) if ((P.x - h.x) ** 2 + (P.z - h.z) ** 2 < h.r * h.r) spot = h;
  if (spot !== nearSpot) {
    nearSpot = spot; const pr = $("prompt"), info = $("info"); info.hidden = true; pr.hidden = true;
    if (spot && spot.id === "bay") { pr.innerHTML = T(state.mode === "edu" ? "pr_lab" : "pr_bay") + (coarse ? "" : "<kbd>E</kbd>"); pr.hidden = false; }
    else if (spot) { $("infoH").textContent = T("in_" + spot.id + "_h"); $("infoP").textContent = T("in_" + spot.id + "_p"); $("infoBook").hidden = spot.id !== "reception"; info.hidden = false; }
  }
}
const act = () => { if (state.view === "play" && nearSpot && nearSpot.id === "bay") enterVR(); };
addEventListener("keydown", e => {
  if (state.view === "play") {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    keys.add(e.code); if (e.code === "KeyE" || e.code === "Enter") act(); if (e.code === "Escape") exitPlay();
  } else if (state.view === "vr" && e.code === "Escape") exitVR();
});
addEventListener("keyup", e => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
const cv = renderer.domElement;
cv.addEventListener("pointerdown", e => { if (state.view === "play") { dragging = true; lastX = e.clientX; cv.setPointerCapture(e.pointerId); } if (state.view === "vr") vrShoot(e); });
cv.addEventListener("pointermove", e => {
  if (state.view === "play" && dragging) { camYaw -= (e.clientX - lastX) * 0.006; lastX = e.clientX; }
  if (state.view === "vr" && !coarse) { const r = cv.getBoundingClientRect(); look.set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2); }
});
addEventListener("pointerup", () => dragging = false);
{
  const joy = $("joy"), knob = $("knob"); let jid = null;
  const setJ = e => { const r = joy.getBoundingClientRect(); let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; const d = Math.hypot(dx, dy), R = r.width / 2 - 10; if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; joyV.x = dx / R; joyV.y = dy / R; };
  joy.addEventListener("pointerdown", e => { jid = e.pointerId; joy.setPointerCapture(jid); setJ(e); e.stopPropagation(); });
  joy.addEventListener("pointermove", e => { if (e.pointerId === jid) setJ(e); });
  const end = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ""; joyV.x = joyV.y = 0; };
  joy.addEventListener("pointerup", end); joy.addEventListener("pointercancel", end);
}
$("prompt").onclick = act; $("exitPlay").onclick = exitPlay;
document.querySelectorAll("#playSeg button").forEach(b => b.onclick = () => {
  state.mode = b.dataset.mode; build(); if (blocked(player.g.position.x, player.g.position.z)) player.g.position.set(0, 0, room.dims.D / 2 - 0.5);
  nearSpot = undefined; document.querySelectorAll("#playSeg button").forEach(x => x.classList.toggle("on", x === b));
});

/* ---------------- VR mini game ---------------- */
const vw = createVrWorld();
const look = new THREE.Vector2(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const game = { score: 0, time: 20, running: false };
function enterVR() {
  state.view = "vr"; vw.mode = state.mode; vw.clear();
  $("playHud").hidden = true; $("vrHud").hidden = false; $("vrEnd").hidden = true;
  $("vrUnit").textContent = T(state.mode === "edu" ? "vr_score_edu" : "vr_score_arena");
  $("vrHint").textContent = T(state.mode === "edu" ? "vr_hint_edu" : "vr_hint_arena"); $("vrHint").hidden = false;
  Object.assign(game, { score: 0, time: 20, running: true }); $("vrScore").textContent = 0; $("vrTime").textContent = 20;
  stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
}
function vrShoot(e) {
  if (!game.running) return;
  const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, vw.camera);
  let best = null, bd = Infinity;
  for (const m of vw.targets) { const d = ray.ray.distanceToPoint(m.position), tol = (coarse ? 1.1 : 0.8) + Math.max(0, -m.position.z) * 0.02; if (d < tol && -m.position.z < bd) { best = m; bd = -m.position.z; } }
  if (best) { vw.hit(best); game.score++; $("vrScore").textContent = game.score; }
}
function exitVR() { game.running = false; $("vrHud").hidden = true; state.view = "play"; $("playHud").hidden = false; nearSpot = undefined; }
function vrFrame(dt, t) {
  if (game.running) {
    game.time -= dt; $("vrTime").textContent = Math.max(0, Math.ceil(game.time));
    if (game.time < 17) $("vrHint").hidden = true;
    if (game.time <= 0) { game.running = false; $("vrEndP").textContent = T("vr_end_p", { n: game.score }); $("vrEnd").hidden = false; }
  }
  vw.update(dt, t, { rate: game.running ? Math.max(0.35, 0.9 - (20 - game.time) * 0.03) : 99 });
  const lx = coarse ? Math.sin(t * 0.5) * 0.15 : look.x * 0.35, ly = coarse ? Math.sin(t * 0.7) * 0.06 : -look.y * 0.2;
  vw.camera.position.y = 1.6 + Math.sin(t * 1.3) * 0.03; vw.camera.lookAt(lx * 10, 1.6 + ly * 10, -10);
}
$("exitVr").onclick = exitVR; $("vrAgain").onclick = enterVR;
$("vrBook").addEventListener("click", () => { exitVR(); exitPlay(); });
$("infoBook").addEventListener("click", () => exitPlay());

/* ---------------- hooks + loop ---------------- */
document.addEventListener("click", e => { const b = e.target.closest("[data-action=play]"); if (b) { e.preventDefault(); enterPlay(b.dataset.mode); } });
onLangChange(() => { if (!room) return; build(); buildFloats(); makeTag(); if (state.view === "play") { room.labelsGroup.visible = true; $("playHelp").textContent = T(coarse ? "play_help_touch" : "play_help_kb"); } nearSpot = undefined; });
new ResizeObserver(() => { if (room) makeStory(); }).observe(stage);
let visible = true;
new IntersectionObserver(es => visible = es[0].isIntersecting, { threshold: 0 }).observe(storyEl);

const clock = new THREE.Clock(); let tick = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!curves || !tag) return;
  if (state.view === "story" && !visible) return;
  if (state.view === "vr") { vw.camera.aspect = camera.aspect; vw.camera.updateProjectionMatrix(); vrFrame(dt, t); renderer.render(vw.scene, vw.camera); return; }
  room.animated.forEach(a => poseAvatar(a, t, dt)); poseAvatar(player, t, dt);
  if (floatGroup.visible) floats.forEach(o => poseAvatar(o, t, dt));
  if ((tick++ % 5) === 0) drawScreen(room, t, state.mode);
  if (state.view === "story") {
    const target = readScroll();
    state.p = lerp(state.p, target, Math.min(1, dt * (reduce ? 30 : 6))); if (Math.abs(state.p - target) < 0.0005) state.p = target;
    introUpdate(dt); storyUpdate(dt, t);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (camera.aspect > 1.15) camera.setViewOffset(w, h, (rtl() ? 1 : -1) * w * 0.18, 0, w, h);
    else if (small) camera.setViewOffset(w, h, 0, -h * 0.06, w, h);
  } else if (state.view === "play") playUpdate(dt);
  if (room.labelsGroup.visible) scaleLabels(room.labels, camera);
  renderer.render(scene, camera);
});

whenReady(() => {
  build(); makeTag(); makeStory();
  state.p = readScroll();
  camera.position.copy(curves.pc.getPoint(state.p)); camTarget.copy(curves.tc.getPoint(state.p)); camera.lookAt(camTarget);
  hideLoader(); startIntro();
  if (!intro.active) { room.signMat.color.setScalar(1); neon.intensity = 14; } else { room.signMat.color.setScalar(0.2); neon.intensity = 0; }
  if (new URLSearchParams(location.search).has("play")) enterPlay();
});
window.__vr = { state, enterPlay, enterVR, exitPlay };
