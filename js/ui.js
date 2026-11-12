(() => {
  // Numéro WhatsApp de la salle, format international sans + (ex. "212600000000"). Vide = envoi désactivé.
  // MAPS_URL: lien Google Maps de la salle. Vide = pas de lien « Itinéraire » dans le pied de page.
  window.VR_CONFIG = { WHATSAPP: "", MAPS_URL: "", PRICE_SESSION: 30, PRICE_SUB: 199, PRICE_BDAY: 400 };

  const $ = id => document.getElementById(id);
  const t = (k, v) => window.I18N.t(k, v);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  window.VR_UI = { esc };

  // shared: show a summary with WhatsApp or copy
  window.VR_UI.showSummary = (zone, rows, intro) => {
    const text = intro + "\n" + rows.map(([k, v]) => `${k} : ${v}`).join("\n");
    const W = window.VR_CONFIG.WHATSAPP;
    zone.querySelector(".recap").innerHTML = rows.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join("");
    const send = zone.querySelector(".sendZone");
    send.innerHTML = W
      ? `<a class="btn btn-saffron btn-block" href="https://wa.me/${W}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${esc(t("wa_send"))}</a>`
      : `<p class="small" style="margin:0 0 12px">${esc(t("done_note"))}</p><button type="button" class="btn btn-ink btn-block copyBtn">${esc(t("copy"))}</button>`;
    const c = send.querySelector(".copyBtn");
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(text); c.textContent = t("copied"); } catch (e) { c.textContent = t("copy_fail"); } };
  };
  window.VR_UI.validPhone = v => { const p = v.replace(/[\s.-]/g, "").replace(/^\+212/, "0").replace(/^00212/, "0"); return /^0[5-7]\d{8}$/.test(p) ? p : null; };

  // Lite mode: skip the heavy 3D on devices that can't run it well.
  // ?lite forces it on, ?3d forces full 3D.
  window.VR_LITE = (() => {
    const q = new URLSearchParams(location.search);
    if (q.has("3d")) return false;
    if (q.has("lite")) return true;
    const n = navigator, c = n.connection || {};
    if (c.saveData || (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2)) return true;
    try { const cv = document.createElement("canvas"); return !(cv.getContext("webgl2") || cv.getContext("webgl")); } catch (e) { return true; }
  })();
  if (window.VR_LITE) document.documentElement.classList.add("lite");

  // Never leave visitors stuck on the loading screen: if the 3D scene fails
  // (no WebGL, old phone, script error) or is slow, show the page anyway.
  const dropLoader = () => { const l = document.getElementById("loader"); if (l) l.classList.add("out"); };
  addEventListener("error", dropLoader);
  addEventListener("unhandledrejection", dropLoader);
  setTimeout(dropLoader, 8000);

  const ready = fn => document.readyState !== "loading" ? fn() : document.addEventListener("DOMContentLoaded", fn);
  ready(() => {
    document.querySelectorAll(".lang button").forEach(b => b.onclick = () => window.I18N.set(b.dataset.lang));
    window.I18N.init();

    // header + menu
    const top = $("top"), nav = $("nav"), mb = $("menuBtn"), home = document.body.dataset.page === "home";
    const onScroll = () => top.classList.toggle("solid", !home || scrollY > innerHeight * 0.5 || nav.classList.contains("open"));
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    mb.onclick = () => { const o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", o); onScroll(); };
    const page = document.body.dataset.page;
    nav.querySelectorAll("a").forEach(a => { if (a.dataset.page === page) a.setAttribute("aria-current", "page"); a.addEventListener("click", () => { nav.classList.remove("open"); mb.setAttribute("aria-expanded", false); }); });

    // reveal on scroll + counters
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in"); io.unobserve(e.target);
      if (!reduce) e.target.querySelectorAll("[data-count]").forEach(el => {
        const end = +el.dataset.count, t0 = performance.now();
        const step = now => { const k = Math.min(1, (now - t0) / 1100); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }), { threshold: 0.15 });
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));

    // quote / request forms (écoles, entreprises)
    document.querySelectorAll("form.quote").forEach(form => {
      const done = form.nextElementSibling;
      form.addEventListener("submit", e => {
        e.preventDefault();
        const err = form.querySelector(".err"); err.textContent = "";
        const name = form.querySelector("[name=name]").value.trim();
        const phone = window.VR_UI.validPhone(form.querySelector("[name=phone]").value);
        if (name.length < 2) { err.textContent = t("err_name"); return; }
        if (!phone) { err.textContent = t("err_phone"); return; }
        const need = form.querySelector("[name=need]");
        const rows = [[t("r_name"), name], [t("r_org"), form.querySelector("[name=org]").value.trim() || "–"], [t("r_phone"), phone]];
        const email = form.querySelector("[name=email]").value.trim(); if (email) rows.push([t("r_email"), email]);
        rows.push([t("r_need"), need.options[need.selectedIndex].text], [t("r_count"), form.querySelector("[name=count]").value || "–"]);
        const d = form.querySelector("[name=date]").value; if (d) rows.push([t("r_date"), d]);
        const m = form.querySelector("[name=msg]").value.trim(); if (m) rows.push([t("r_msg"), m]);
        window.VR_UI.showSummary(done, rows, t("wa_intro_q"));
        form.hidden = true; done.hidden = false;
      });
      done.querySelector(".again").onclick = () => { done.hidden = true; form.hidden = false; };
    });

    // footer: directions + WhatsApp links, shown once they are configured
    const city = document.querySelector('footer [data-i18n="ft_city"]');
    if (city) {
      const C = window.VR_CONFIG, add = (href, key) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.dataset.i18n = key; a.textContent = t(key); city.before(a); };
      if (C.WHATSAPP) add("https://wa.me/" + C.WHATSAPP, "ft_wa");
      if (C.MAPS_URL) add(C.MAPS_URL, "ft_map");
    }

    // sticky CTA (mobile)
    const sticky = $("stickyCta");
    if (sticky) {
      const hideZones = [...document.querySelectorAll("[data-hide-sticky]")];
      const vis = new Map();
      const upd = () => sticky.classList.toggle("show", scrollY > innerHeight * 0.6 && ![...vis.values()].some(Boolean) && !document.body.classList.contains("immersive"));
      const ob = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target, e.isIntersecting)); upd(); }, { threshold: 0 });
      hideZones.forEach(z => ob.observe(z));
      addEventListener("scroll", upd, { passive: true }); document.addEventListener("immersive", upd);
    }
  });
})();
