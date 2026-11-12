import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { T, small, coarse, createStage, buildRoom, buildBackdrop, makeHeadset, spriteLabel, poseAvatar, onLangChange, whenReady, hideLoader, V } from "./room.js";

/* Page Réserver : casques 3D flottants, Libre / Réservé / Votre choix */
const $ = id => document.getElementById(id);
const stage = $("rstage");
const S = createStage(stage, { fov: 45 });
const { renderer, scene, camera, roomGlow, neon } = S;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 16;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.25; controls.enableZoom = !coarse;
renderer.domElement.style.touchAction = "pan-y";

let room, heads = [];
const st = { formule: "session", date: "", slot: "", booked: new Set(), sel: new Set() };
const N = 8;

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function computeBooked() {
  st.booked = new Set();
  if (!st.date || !st.slot) return;
  const d = new Date(st.date + "T12:00"), we = d.getDay() === 0 || d.getDay() === 6, eve = parseInt(st.slot) >= 18;
  const rate = 0.18 + (we ? 0.15 : 0) + (eve ? 0.15 : 0);
  for (let i = 0; i < N; i++) if (hash(`${st.date}|${st.slot}|${i}`) < rate) st.booked.add(i);
}

function build() {
  if (room) scene.remove(room.group);
  room = buildRoom({ mode: "arena", free: -1, occupant: () => null, bayLabels: false, spectators: [], host: true });
  scene.add(room.group); room.labelsGroup.visible = false;
  if (!scene.userData.bd) { scene.userData.bd = buildBackdrop(room.dims.W, room.dims.D); scene.add(scene.userData.bd); }
  roomGlow.color.setHex(0x2ad1cf); neon.position.copy(room.neonPos);
  heads.forEach(h => scene.remove(h.root)); heads = [];
  room.bays.slice(0, N).forEach((b, i) => {
    const root = new THREE.Group(); root.position.set(b.x, 0, b.z); scene.add(root);
    const h = makeHeadset(); h.g.position.y = 1.7; h.g.rotation.x = -0.2; root.add(h.g);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.55, 1.6, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0x2ad1cf, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 0.8; root.add(beam);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 40), new THREE.MeshBasicMaterial({ color: 0x2ad1cf, transparent: true, opacity: 0.18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; root.add(disc);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.7; root.add(hit); hit.userData.i = i;
    heads.push({ root, h, beam, disc, hit, lab: null, i, float: h.g, baseY: 1.7, phase: i * 0.8 });
  });
  refresh3D();
}
const COLORS = { free: 0x2ad1cf, booked: 0x6b7280, mine: 0xffb347, none: 0x9fb0cc };
function stateOf(i) { if (!st.date || !st.slot) return "none"; if (st.booked.has(i)) return "booked"; return st.sel.has(i) ? "mine" : "free"; }
function refresh3D() {
  heads.forEach(o => {
    const s = stateOf(o.i), c = COLORS[s];
    o.beam.material.color.setHex(c); o.disc.material.color.setHex(c);
    o.h.body.material.color.setHex(s === "booked" ? 0x7c8496 : s === "mine" ? 0xffd08a : 0xf2f4f7);
    o.h.visor.material.color.setHex(s === "booked" ? 0x3a4152 : c);
    if (o.lab) { o.root.remove(o.lab); o.lab.material.map.dispose(); }
    const txt = s === "none" ? T("hs_n", { n: o.i + 1 }) : `${o.i + 1} · ${T(s === "free" ? "rs_free" : s === "booked" ? "rs_booked" : "rs_mine")}`;
    o.lab = spriteLabel(txt, s === "mine" ? "rgba(232,163,61,0.97)" : s === "booked" ? "rgba(70,80,100,0.92)" : s === "free" ? "rgba(14,124,123,0.95)" : "rgba(27,42,74,0.92)", 0.62, s === "mine" ? "#1D1405" : "#fff");
    o.lab.position.y = 2.45; o.root.add(o.lab);
  });
  // list
  $("hsList").innerHTML = heads.map(o => { const s = stateOf(o.i); return `<button type="button" class="hs-chip ${s}" data-i="${o.i}" ${s === "booked" ? "disabled" : ""} aria-pressed="${s === "mine"}"><i></i>${T("hs_n", { n: o.i + 1 })}<small>${s === "none" ? "" : T(s === "free" ? "rs_free" : s === "booked" ? "rs_booked" : "rs_mine")}</small></button>`; }).join("");
  $("selInfo").textContent = T("rs_sel", { n: st.sel.size });
  updateTotal();
}
function toggle(i) {
  const err = $("berr"); err.textContent = "";
  if (!st.date || !st.slot) { err.textContent = T("rs_pickday"); flashStep("step2"); return; }
  if (st.booked.has(i)) return;
  if (st.formule === "bday") return;
  st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i);
  refresh3D();
}
function flashStep(id) { const el = $(id); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.animate([{ outlineColor: "rgba(232,163,61,1)" }, { outlineColor: "rgba(232,163,61,0)" }], { duration: 1200 }); }
$("hsList").addEventListener("click", e => { const b = e.target.closest(".hs-chip"); if (b) toggle(+b.dataset.i); });

// raycast on 3D headsets
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener("pointerdown", e => down = [e.clientX, e.clientY]);
renderer.domElement.addEventListener("pointerup", e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(heads.map(h => h.hit))[0];
  if (hit) toggle(hit.object.userData.i);
});
renderer.domElement.addEventListener("pointermove", e => {
  if (coarse) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(heads.map(h => h.hit))[0];
  renderer.domElement.style.cursor = hit && !st.booked.has(hit.object.userData.i) ? "pointer" : "grab";
  heads.forEach(o => o.hover = hit && hit.object.userData.i === o.i);
});

/* ---------- form ---------- */
const form = $("bookForm"), slotsEl = $("slots"), date = $("bdate");
const pad = n => String(n).padStart(2, "0");
const now = new Date(); date.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const params = new URLSearchParams(location.search);
if (["session", "sub", "bday"].includes(params.get("formule"))) form.querySelector(`input[value=${params.get("formule")}]`).checked = true;
const fname = { session: "f_session", sub: "f_sub", bday: "f_bday" };
function slots() {
  const f = st.formule, d = date.value ? new Date(date.value + "T12:00") : null, we = d && (d.getDay() === 0 || d.getDay() === 6);
  let times = [];
  if (f === "bday") times = ["11:00", "14:00", "16:00", "18:00", "20:00"];
  else for (let m = (we ? 10 : 15) * 60; m <= 21 * 60 + 30; m += 30) times.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  if (!times.includes(st.slot)) st.slot = "";
  slotsEl.innerHTML = times.map(x => `<label class="opt"><input type="radio" name="slot" value="${x}" ${x === st.slot ? "checked" : ""}><span dir="ltr">${x}</span></label>`).join("");
}
function updateTotal() {
  const C = window.VR_CONFIG, n = st.sel.size, f = st.formule, dh = T("u_dh");
  $("btotal").textContent = f === "bday" ? C.PRICE_BDAY + dh : f === "sub" ? n * C.PRICE_SUB + dh + " " + T("per_month") : n * C.PRICE_SESSION + dh;
  $("bdayNote").hidden = f !== "bday";
}
function applyFormule() {
  st.formule = form.querySelector("input[name=formule]:checked").value;
  if (st.formule === "bday") { st.sel = new Set(st.booked.size || !st.slot ? [] : [...Array(N).keys()]); }
  else if (st.sel.size === N && st.formule !== "bday") st.sel.clear();
}
function onSlotChange() {
  computeBooked();
  [...st.sel].forEach(i => { if (st.booked.has(i)) st.sel.delete(i); });
  if (st.formule === "bday") { st.sel = new Set(st.booked.size ? [] : [...Array(N).keys()]); $("berr").textContent = st.booked.size ? T("rs_full") : ""; }
  refresh3D();
}
form.addEventListener("change", e => {
  if (e.target.name === "formule") { applyFormule(); slots(); onSlotChange(); }
  else if (e.target === date) { st.date = date.value; slots(); onSlotChange(); }
  else if (e.target.name === "slot") { st.slot = e.target.value; onSlotChange(); }
});
form.addEventListener("submit", e => {
  e.preventDefault();
  const err = $("berr"); err.textContent = "";
  if (!st.date) { err.textContent = T("err_day"); return; }
  if (!st.slot) { err.textContent = T("err_hour"); return; }
  if (st.formule === "bday" && st.booked.size) { err.textContent = T("rs_full"); return; }
  if (!st.sel.size) { err.textContent = T("rs_pick"); return; }
  const name = $("bname").value.trim(), phone = window.VR_UI.validPhone($("bphone").value);
  if (name.length < 2) { err.textContent = T("err_name"); return; }
  if (!phone) { err.textContent = T("err_phone"); return; }
  const loc = { fr: "fr-FR", en: "en-GB", ar: "ar-MA" }[window.I18N.lang];
  const d = new Date(st.date + "T12:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  const rows = [[T("r_formule"), T(fname[st.formule])], [T("r_day"), d], [T("r_hour"), st.slot], [T("r_headsets"), [...st.sel].sort((a, b) => a - b).map(i => i + 1).join(", ")], [T("r_name"), name], [T("r_phone"), phone], [T("r_total"), $("btotal").textContent]];
  window.VR_UI.showSummary($("done"), rows, T("wa_intro"));
  form.hidden = true; $("done").hidden = false; $("done").scrollIntoView({ behavior: "smooth", block: "center" });
});
$("done").querySelector(".again").onclick = () => { $("done").hidden = true; form.hidden = false; };

/* ---------- loop ---------- */
const clock = new THREE.Clock(); let visible = true;
new IntersectionObserver(es => visible = es[0].isIntersecting).observe(stage);
renderer.setAnimationLoop(() => {
  if (!room || !visible) return;
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  room.animated.forEach(a => poseAvatar(a, t, dt));
  heads.forEach(o => { poseAvatar(o, t, dt); const s = o.hover ? 1.15 : 1; o.h.g.scale.lerp(V(s, s, s), Math.min(1, dt * 10)); o.beam.material.opacity = (stateOf(o.i) === "mine" ? 0.28 : 0.14) + 0.04 * Math.sin(t * 3 + o.i); });
  controls.update(); renderer.render(scene, camera);
});
onLangChange(() => { if (room) { refresh3D(); updateTotal(); } });
whenReady(() => {
  applyFormule(); build(); slots(); updateTotal();
  const D = room.dims.D;
  camera.position.set(0, small ? 9.5 : 7.2, small ? 9.5 : 7.4); controls.target.set(0, 0.8, -1.6); controls.update();
  hideLoader();
});
