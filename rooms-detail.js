/* (02) Habitaciones — vista de detalle.
 *
 * Purely additive: nothing in rooms.js, story.js or the existing timelines is
 * touched. The section's own WebGL slider, its reveals and its tab switching
 * keep running exactly as they did; this adds a full-screen layer over them.
 *
 * No router is installed. The project has no build step and no framework — it
 * is hand-written HTML, CSS and JS with GSAP and Three.js from a CDN — so the
 * view is an overlay appended to <body>, with the URL kept in sync through the
 * hash. That gives the browser's back button, a shareable link and Escape for
 * free, without adding a dependency.
 *
 * The photograph flies from the card into the hero with GSAP Flip, which is
 * already loaded for the facade in the horizontal section. It does what
 * layoutId does in Framer Motion — measure, reparent, invert, play — and the
 * scale:true option keeps the growth on the compositor instead of re-laying
 * out and resampling a large photograph every frame. */
(function () {
  "use strict";

  // ── Photography ─────────────────────────────────────────────────────
  // Stock while the real shoot is pending: every id below was checked with a
  // request before being written in, and one that came back 404 was dropped.
  // Swapping them later is a single-file edit — nothing outside this array
  // knows a URL.
  var img = function (id, w) {
    return "https://images.unsplash.com/" + id + "?auto=format&fit=crop&w=" + (w || 1800) + "&q=80";
  };

  var ROOMS = [
    {
      slug: "estudios",
      name: "ESTUDIOS",
      index: "01",
      // The accented word is set in the project's serif italic, the same
      // device the closing section uses.
      titleLead: "Un",
      titleAccent: "estudio",
      titleTail: "para quedarse",
      tagline: "Cocina propia y vista abierta al valle del Utcubamba.",
      description:
        "Treinta y cuatro metros que funcionan solos: cama king, un baño completo y una cocina real, no una repisa con hervidor. Pensado para quien llega por trabajo y se queda más noches de las que reservó.",
      price: 210,
      currency: "S/",
      specs: [
        { n: "34", label: "m²" },
        { n: "2", label: "huéspedes" },
        { n: "1", label: "cama king" },
        { n: "1", label: "baño" },
        { n: "—", label: "vista al valle" },
      ],
      hero: img("photo-1560448204-e02f11c3d0e2"),
      highlights: [
        {
          title: "Cocina equipada",
          subtitle: "Estadías largas sin depender de la calle.",
          badge: "Incluido",
          meta: "Refrigeradora y microondas",
          image: img("photo-1556228453-efd6c1ff04f6", 1200),
        },
        {
          title: "Recepción 24 horas",
          subtitle: "Alguien despierto, a cualquier hora que llegues.",
          badge: "Todos los días",
          meta: "Jr. Miguel Grau 672",
          image: img("photo-1566073771259-6a8506099945", 1200),
        },
      ],
      amenities: [
        "Cocina equipada", "Aire acondicionado", "Wi-Fi en toda la propiedad",
        "Smart TV", "Refrigeradora", "Microondas", "Ducha de vidrio templado",
        "Clóset empotrado", "Ropa de cama y toallas", "Recepción 24 horas",
      ],
      gallery: [
        { src: img("photo-1560448204-e02f11c3d0e2", 1200), alt: "Dormitorio del estudio con cama king y luz natural" },
        { src: img("photo-1584622650111-993a426fbf0a", 1200), alt: "Baño privado con ducha de vidrio templado" },
        { src: img("photo-1556228453-efd6c1ff04f6", 1200), alt: "Cocina equipada con refrigeradora y microondas" },
        { src: img("photo-1522708323590-d24dbb6b0267", 1200), alt: "Zona de estar del estudio" },
        { src: img("photo-1616486338812-3dadae4b4ace", 1200), alt: "Escritorio junto a la ventana" },
        { src: img("photo-1595526114035-0d45ed16cfbf", 1200), alt: "Detalle de la ropa de cama" },
      ],
    },
    {
      slug: "minidepartamentos",
      name: "MINIDEPARTAMENTOS",
      index: "02",
      titleLead: "Un",
      titleAccent: "minidepartamento",
      titleTail: "con balcón",
      tagline: "Dos ambientes, balcón propio y vista a la ciudad.",
      description:
        "Cincuenta y dos metros repartidos en dormitorio y sala separada, con dos baños completos. El balcón da a la ciudad y es el sitio donde termina el día.",
      price: 320,
      currency: "S/",
      specs: [
        { n: "52", label: "m²" },
        { n: "4", label: "huéspedes" },
        { n: "2", label: "ambientes" },
        { n: "2", label: "baños" },
        { n: "—", label: "balcón propio" },
      ],
      hero: img("photo-1502672260266-1c1ef2d93688"),
      highlights: [
        {
          title: "Balcón privado",
          subtitle: "La ciudad de fondo, sin salir del departamento.",
          badge: "En cada unidad",
          meta: "Orientación al este",
          image: img("photo-1600607687939-ce8a6c25118c", 1200),
        },
        {
          title: "Dos ambientes",
          subtitle: "Trabajar y descansar sin compartir la misma pared.",
          badge: "52 m²",
          meta: "Sala independiente",
          image: img("photo-1522708323590-d24dbb6b0267", 1200),
        },
      ],
      amenities: [
        "Cocina equipada", "Aire acondicionado", "Wi-Fi en toda la propiedad",
        "Smart TV", "Balcón privado", "Sala independiente", "Dos baños completos",
        "Clóset empotrado", "Ropa de cama y toallas", "Recepción 24 horas",
      ],
      gallery: [
        { src: img("photo-1502672260266-1c1ef2d93688", 1200), alt: "Dormitorio del minidepartamento con acceso al balcón" },
        { src: img("photo-1522708323590-d24dbb6b0267", 1200), alt: "Sala independiente del minidepartamento" },
        { src: img("photo-1600607687939-ce8a6c25118c", 1200), alt: "Balcón privado con vista a la ciudad" },
        { src: img("photo-1631049307264-da0ec9d70304", 1200), alt: "Baño con ducha de vidrio" },
        { src: img("photo-1600566753086-00f18fb6b3ea", 1200), alt: "Comedor junto a la cocina" },
        { src: img("photo-1567767292278-a4f21aa2d36e", 1200), alt: "Detalle del dormitorio" },
      ],
    },
    {
      slug: "departamentos",
      name: "DEPARTAMENTOS",
      index: "03",
      titleLead: "Un",
      titleAccent: "departamento",
      titleTail: "en el último piso",
      tagline: "Sesenta y ocho metros en el piso más alto.",
      description:
        "El más amplio de los tres y el único en el último piso. Dos baños, sala grande y las mejores vistas del edificio, hacia el valle y hacia la ciudad.",
      price: 450,
      currency: "S/",
      specs: [
        { n: "68", label: "m²" },
        { n: "4", label: "huéspedes" },
        { n: "2", label: "baños" },
        { n: "—", label: "último piso" },
        { n: "—", label: "vista doble" },
      ],
      hero: img("photo-1618221195710-dd6b41faaea6"),
      highlights: [
        {
          title: "Último piso",
          subtitle: "Sin nadie arriba y con las dos vistas del edificio.",
          badge: "Único",
          meta: "Valle y ciudad",
          image: img("photo-1586023492125-27b2c045efd7", 1200),
        },
        {
          title: "Sesenta y ocho metros",
          subtitle: "Espacio real para cuatro, no cuatro apretados.",
          badge: "El más amplio",
          meta: "Dos baños completos",
          image: img("photo-1618221195710-dd6b41faaea6", 1200),
        },
      ],
      amenities: [
        "Cocina equipada", "Aire acondicionado", "Wi-Fi en toda la propiedad",
        "Smart TV", "Sala amplia", "Dos baños completos", "Vista al valle",
        "Clóset empotrado", "Ropa de cama y toallas", "Recepción 24 horas",
      ],
      gallery: [
        { src: img("photo-1618221195710-dd6b41faaea6", 1200), alt: "Sala del departamento en el último piso" },
        { src: img("photo-1586023492125-27b2c045efd7", 1200), alt: "Dormitorio principal con vista al valle" },
        { src: img("photo-1560185007-cde436f6a4d0", 1200), alt: "Segundo baño del departamento" },
        { src: img("photo-1571003123894-1f0594d2b5d9", 1200), alt: "Comedor del departamento" },
        { src: img("photo-1552321554-5fefe8c9ef14", 1200), alt: "Cocina del departamento" },
        { src: img("photo-1540518614846-7eded433c457", 1200), alt: "Detalle del estar" },
      ],
    },
  ];

  var bySlug = {};
  ROOMS.forEach(function (r) { bySlug[r.slug] = r; });

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var HAS_FLIP = typeof gsap !== "undefined" && typeof Flip !== "undefined";

  // ── State ────────────────────────────────────────────────────────────
  var layer = null;      // the overlay element while open
  var openSlug = null;
  var scrollY = 0;       // page position to restore on close
  var opener = null;     // the button that opened it, for focus return
  var flyer = null;      // the photograph in flight

  // ── Body scroll lock ─────────────────────────────────────────────────
  // position:fixed rather than overflow:hidden. The page runs several pinned
  // ScrollTriggers; overflow:hidden on <body> lets the document keep its
  // scroll offset but stops the scrollbar, which reflows every pin the moment
  // the bar disappears. Fixing the body freezes the layout instead, and the
  // offset is restored by hand on close.
  function lockScroll() {
    // Guarded against locking twice. Switching rooms from inside the view
    // reopens it, and this used to re-read window.scrollY with the body
    // already fixed — where it reads 0, because a fixed body does not scroll.
    // The saved position was overwritten with zero and closing dropped the
    // visitor at the top of the page instead of back at the card they came
    // from, with the rooms section off screen and its canvas paused.
    if (document.body.style.position === "fixed") return;
    scrollY = window.scrollY || window.pageYOffset;

    // Auto-refresh is suspended for as long as the body is fixed. Taking it
    // out of flow collapses the document from 20257px to the viewport's 900,
    // and every pinned section on this page has its start and end cached
    // against the full height — a refresh landing in that window (a phone
    // rotating, the browser chrome collapsing) would re-measure all of them
    // against a page that is momentarily one screen tall and leave the whole
    // scroll broken once the view closes. Verified: with this off, the three
    // pins read identically before and after.
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.config({ autoRefreshEvents: "none" });
    }
    document.body.style.position = "fixed";
    document.body.style.top = -scrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockScroll() {
    if (document.body.style.position !== "fixed") return;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);

    // Handed back, then re-measured once against the layout that is actually
    // on screen — cheap here because this is a one-off transition, not a
    // scroll frame, and it catches anything that did change while the page
    // was held (an orientation change being the realistic one).
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize" });
      ScrollTrigger.refresh();
      window.scrollTo(0, scrollY);
    }
  }

  // ── Markup ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function chip(s) {
    return '<div class="rd-chip"><b>' + esc(s.n) + "</b><span>" + esc(s.label) + "</span></div>";
  }

  function amenity(a) {
    return (
      '<div class="rd-amenity">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' +
      "<span>" + esc(a) + "</span></div>"
    );
  }

  function galleryCard(g, i, total) {
    var last = i === total - 1;
    return (
      '<figure class="rd-shot' + (last ? " is-last" : "") + '">' +
      '<img src="' + esc(g.src) + '" alt="' + esc(g.alt) + '" loading="lazy" decoding="async" />' +
      (last ? '<figcaption class="rd-shot-more"><b>+' + total + "</b><span>Fotos</span></figcaption>" : "") +
      "</figure>"
    );
  }

  function highlight(h) {
    return (
      '<article class="rd-card">' +
      '<img src="' + esc(h.image) + '" alt="" loading="lazy" decoding="async" />' +
      '<div class="rd-card-scrim"></div>' +
      '<div class="rd-card-top">' +
      '<span class="rd-pill"><i></i>' + esc(h.badge) + "</span>" +
      '<span class="rd-meta"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' + esc(h.meta) + "</span>" +
      "</div>" +
      '<div class="rd-card-foot">' +
      '<div class="rd-card-say"><h4>' + esc(h.title) + "</h4><p>" + esc(h.subtitle) + "</p></div>" +
      '<span class="rd-card-go"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></span>' +
      "</div></article>"
    );
  }

  function switcherCard(r) {
    return (
      '<button class="rd-next" type="button" data-goto="' + r.slug + '">' +
      '<img src="' + esc(r.gallery[0].src) + '" alt="" loading="lazy" decoding="async" />' +
      '<span class="rd-next-say"><b>' + esc(r.name) + "</b><i>" +
      esc(r.specs[0].n + " " + r.specs[0].label + " · " + r.specs[1].n + " " + r.specs[1].label) +
      "</i></span>" +
      '<span class="rd-next-price">' + esc(r.currency + " " + r.price) + "</span>" +
      '<svg class="rd-next-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>' +
      "</button>"
    );
  }

  function stamp() {
    var d = new Date();
    var dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return dias[d.getDay()] + " " + d.getDate() + " " + meses[d.getMonth()] + " · " + hh + ":" + mm;
  }

  function build(room) {
    var others = ROOMS.filter(function (r) { return r.slug !== room.slug; });
    var el = document.createElement("div");
    el.className = "rd";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Detalle de " + room.name);
    el.innerHTML =
      // Atmosphere: the hero photograph, blurred and darkened, behind everything.
      '<div class="rd-atmos" aria-hidden="true" style="background-image:url(' + esc(room.hero) + ')"></div>' +
      '<div class="rd-atmos-tint" aria-hidden="true"></div>' +
      '<svg class="rd-grain" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<filter id="rdGrain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"></feTurbulence>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"></feColorMatrix></filter>' +
      '<rect width="100%" height="100%" filter="url(#rdGrain)"></rect></svg>' +

      '<div class="rd-scroll">' +

      // 5.1 — utility bar
      '<header class="rd-bar">' +
      '<span class="rd-mark">REGO</span>' +
      '<i class="rd-rule"></i>' +
      '<span class="rd-stamp" data-clock>' + stamp() + "</span>" +
      '<i class="rd-rule"></i>' +
      '<span class="rd-lang"><b>ES</b><s>/</s><em>EN</em></span>' +
      '<span class="rd-bar-title"><b>' + esc(room.name) + "</b><i></i></span>" +
      '<span class="rd-weather"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>Bagua Grande</span>' +
      '<i class="rd-rule"></i>' +
      '<button class="rd-close" type="button" aria-label="Cerrar el detalle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</header>" +

      // 5.2 — dismissible banner
      '<div class="rd-note rd-anim">' +
      '<span class="rd-note-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></span>' +
      '<span class="rd-note-say"><b>' + esc(room.name) + " · Disponible para tus fechas</b>" +
      "<i>Reserva directa con el hotel, sin comisiones de intermediarios.</i></span>" +
      '<button class="rd-note-x" type="button" aria-label="Cerrar el aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</div>" +

      // 5.3 — hero
      '<section class="rd-hero rd-anim">' +
      '<div class="rd-hero-frame"><img class="rd-hero-img" src="' + esc(room.hero) + '" alt="' + esc(room.gallery[0].alt) + '" fetchpriority="high" decoding="async" /></div>' +
      '<div class="rd-hero-scrim"></div>' +
      '<div class="rd-hero-say">' +
      '<p class="rd-eyebrow">Apart-hotel · Bagua Grande</p>' +
      '<h2 class="rd-title"><span>' + esc(room.titleLead) + " <em>" + esc(room.titleAccent) + "</em></span><span>" + esc(room.titleTail) + "</span></h2>" +
      '<p class="rd-tagline">' + esc(room.tagline) + "</p>" +
      "</div>" +
      '<div class="rd-hero-price"><small>Desde</small><b>' + esc(room.currency + " " + room.price) + "</b><i>/ noche</i></div>" +
      "</section>" +

      // 5.4 — spec chips
      '<div class="rd-chips rd-anim">' + room.specs.map(chip).join("") + "</div>" +

      // description
      '<p class="rd-lede rd-anim">' + esc(room.description) + "</p>" +

      // 5.5 — gallery
      '<section class="rd-gallery rd-anim">' +
      '<p class="rd-label">La habitación</p>' +
      '<div class="rd-strip">' + room.gallery.map(function (g, i) { return galleryCard(g, i, room.gallery.length); }).join("") + "</div>" +
      "</section>" +

      // 5.6 — the two glass cards
      '<section class="rd-cards rd-anim">' + room.highlights.map(highlight).join("") + "</section>" +

      // 5.7 — amenities
      '<section class="rd-amenities rd-anim">' +
      '<p class="rd-label">Incluido en la tarifa</p>' +
      '<div class="rd-amenity-grid">' + room.amenities.map(amenity).join("") + "</div>" +
      "</section>" +

      // 5.9 — the other rooms
      '<section class="rd-switch rd-anim">' +
      '<p class="rd-label">Las otras dos</p>' + others.map(switcherCard).join("") +
      "</section>" +

      "</div>" +

      // 5.8 — sticky action bar
      '<div class="rd-book">' +
      '<span class="rd-book-price"><b>' + esc(room.currency + " " + room.price) + "</b><i>/ noche</i></span>" +
      '<a class="rd-book-cta" href="#contact"><span>Reservar</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>' +
      "</div>";
    return el;
  }

  // ── The photograph in flight ─────────────────────────────────────────
  // The section paints its main photo with a WebGL plane on desktop and a
  // plain <img> below the breakpoint, so there is no single element to hand
  // to Flip. A clone positioned over whichever of the two is on screen gives
  // it one, and it is removed the moment the real hero can take over.
  function sourceRect() {
    var media = document.querySelector(".rooms-media");
    return media ? media.getBoundingClientRect() : null;
  }

  function flyOpen(room, onDone) {
    var r = sourceRect();
    // No flight without a card to fly from. A deep link, a reload on the hash
    // or the back button all open the view with nothing on screen behind it,
    // and morphing out of a card the visitor never clicked is a lie about
    // where they came from. It also removes this path's dependency on
    // requestAnimationFrame: a link opened in a background tab gets no frames
    // until it is focused, and the content would sit invisible until then.
    if (!opener || !HAS_FLIP || reduced || !r || !r.width) { onDone(); return; }

    // Belt and braces for the click path too: if the frames never arrive, the
    // view still settles rather than staying blank.
    var settled = false;
    var once = function () {
      if (settled) return;
      settled = true;
      cleanFlyer();
      onDone();
    };
    var bail = window.setTimeout(once, 1200);

    flyer = document.createElement("img");
    flyer.src = room.hero;
    flyer.alt = "";
    flyer.className = "rd-flyer";
    gsap.set(flyer, {
      position: "fixed", left: 0, top: 0,
      width: r.width, height: r.height, x: r.left, y: r.top,
    });
    document.body.appendChild(flyer);

    // Two frames: one for the layer to lay out, one for the browser to settle
    // it, before the hero's box can be measured.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var target = layer && layer.querySelector(".rd-hero-frame");
        if (!target) { window.clearTimeout(bail); once(); return; }
        var t = target.getBoundingClientRect();
        var state = Flip.getState(flyer);
        gsap.set(flyer, { width: t.width, height: t.height, x: t.left, y: t.top });
        Flip.from(state, {
          duration: 0.72,
          ease: "power3.inOut",
          // Compositor work rather than layout: this is a full-bleed
          // photograph and animating its width would resample it every frame.
          scale: true,
          onComplete: function () { window.clearTimeout(bail); once(); },
        });
      });
    });
  }

  function cleanFlyer() {
    if (flyer && flyer.parentNode) flyer.parentNode.removeChild(flyer);
    flyer = null;
  }

  // ── Focus trap ───────────────────────────────────────────────────────
  var FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab" || !layer) return;
    var items = [].slice.call(layer.querySelectorAll(FOCUSABLE)).filter(function (n) {
      return n.offsetWidth || n.offsetHeight || n.getClientRects().length;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ── Open / close ─────────────────────────────────────────────────────
  var clockTimer = 0;

  function open(slug, opts) {
    var room = bySlug[slug];
    if (!room || openSlug === slug) return;
    if (layer) teardown();

    openSlug = slug;
    lockScroll();

    layer = build(room);
    document.body.appendChild(layer);
    document.addEventListener("keydown", onKey, true);

    // The live clock: a minute is the finest granularity shown, so that is
    // how often it is refreshed.
    var clock = layer.querySelector("[data-clock]");
    clockTimer = window.setInterval(function () {
      if (clock) clock.textContent = stamp();
    }, 60000);

    wire(layer);

    if (!(opts && opts.silent)) {
      var hash = "#/habitaciones/" + slug;
      if (window.location.hash !== hash) window.history.pushState({ rego: slug }, "", hash);
    }

    layer.classList.add("is-open");

    // Focus moves in on the frame the dialog appears, not when the morph
    // finishes. It used to wait for the flight to land, which left roughly
    // 700ms where a modal was on screen with aria-modal set while the keyboard
    // was still on the page behind it — the trap was in place but there was
    // nothing inside it yet.
    var closeBtn = layer.querySelector(".rd-close");
    if (closeBtn) {
      try { closeBtn.focus({ preventScroll: true }); } catch (e) { closeBtn.focus(); }
    }

    flyOpen(room, function () {
      if (!layer) return;
      layer.classList.add("is-settled");
      var items = layer.querySelectorAll(".rd-anim");
      if (reduced || typeof gsap === "undefined") {
        gsap.set ? gsap.set(items, { opacity: 1, y: 0 }) : null;
        [].forEach.call(items, function (n) { n.style.opacity = 1; n.style.transform = "none"; });
      } else {
        gsap.fromTo(items, { opacity: 0, y: 24 }, {
          opacity: 1, y: 0, duration: 0.6, stagger: 0.06, delay: 0.05,
          ease: "power3.out", clearProps: "transform",
        });
      }
    });
  }

  function teardown() {
    if (clockTimer) { window.clearInterval(clockTimer); clockTimer = 0; }
    document.removeEventListener("keydown", onKey, true);
    cleanFlyer();
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;
    openSlug = null;
  }

  function close(opts) {
    if (!layer) return;
    var finish = function () {
      teardown();
      unlockScroll();
      if (opener) { try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); } }
      opener = null;
      if (!(opts && opts.silent) && window.location.hash.indexOf("#/habitaciones/") === 0) {
        window.history.pushState({}, "", window.location.pathname + window.location.search);
      }
    };
    if (reduced || typeof gsap === "undefined") { finish(); return; }
    gsap.to(layer, { opacity: 0, duration: 0.22, ease: "power2.in", onComplete: finish });
  }

  function wire(root) {
    root.querySelector(".rd-close").addEventListener("click", function () { close(); });

    var note = root.querySelector(".rd-note");
    var noteX = root.querySelector(".rd-note-x");
    if (note && noteX) {
      noteX.addEventListener("click", function () {
        if (reduced || typeof gsap === "undefined") { note.remove(); return; }
        gsap.to(note, {
          height: 0, opacity: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0,
          duration: 0.4, ease: "power2.inOut",
          onComplete: function () { note.remove(); },
        });
      });
    }

    [].forEach.call(root.querySelectorAll("[data-goto]"), function (b) {
      b.addEventListener("click", function () {
        var next = b.getAttribute("data-goto");
        var scroller = root.querySelector(".rd-scroll");
        if (scroller) scroller.scrollTop = 0;
        openSlug = null;
        open(next);
      });
    });

    var cta = root.querySelector(".rd-book-cta");
    if (cta) {
      cta.addEventListener("click", function (e) {
        e.preventDefault();
        close();
        window.setTimeout(function () {
          var target = document.getElementById("contact");
          if (target) target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        }, 260);
      });
    }
  }

  // ── Wiring into the page ─────────────────────────────────────────────
  function slugForSlide(slide) {
    var t = slide.querySelector(".rooms-title");
    if (!t) return null;
    var name = t.textContent.trim().toLowerCase();
    for (var i = 0; i < ROOMS.length; i++) {
      if (ROOMS[i].name.toLowerCase() === name) return ROOMS[i].slug;
    }
    return null;
  }

  document.addEventListener("DOMContentLoaded", function () {
    [].forEach.call(document.querySelectorAll(".rooms-more"), function (btn) {
      var slide = btn.closest(".rooms-slide");
      var slug = slide ? slugForSlide(slide) : null;
      if (!slug) return;
      btn.addEventListener("click", function () {
        opener = btn;
        open(slug);
      });
    });

    // The hash is the source of truth, so a shared link, a reload and the
    // back button all land in the same place.
    function fromHash(silent) {
      var m = /^#\/habitaciones\/([a-z-]+)$/.exec(window.location.hash);
      if (m && bySlug[m[1]]) open(m[1], { silent: true });
      else if (layer) close({ silent: true });
    }
    window.addEventListener("popstate", function () { fromHash(true); });
    fromHash(true);
  });
})();
