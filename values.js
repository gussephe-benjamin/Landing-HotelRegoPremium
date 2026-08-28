/* Brand-values split slider.
   The source pack drove this by hijacking `window.wheel` on a position:fixed
   overlay — dropped in here that would have swallowed the page's scroll and
   trapped the visitor. Instead the section is pinned and its progress feeds
   the same `scrollPosition` variable, so it advances with normal scrolling
   and releases the page when the last value has been shown. The reveal maths
   (clip-path shapes, image drift, title hold) is unchanged. */
document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".values");
  if (!root || typeof ScrollTrigger === "undefined") return;

  var settings = {
    // Fraction of the remaining distance covered per 60fps frame. Raised from
    // 0.08 so this section answers the scroll at something close to the rate
    // its neighbours do: everything around it — the marquee, the horizontal
    // run, the hand-off into Reserva — now tracks the scroll directly, and a
    // third of a second of trail here was enough to read as the page going
    // slack for one section and tightening again afterwards. It is still a
    // lerp and still floats; it just does not lag its own neighbours.
    smoothness: 0.14,
    bufferSlides: 2,
    imageShift: 25,
    /* Cuánto se separan verticalmente las dos mitades del rótulo durante la
       transición. La deriva es opuesta por columna, así que este número es
       literalmente cuánto se parte el texto: a 15 las mitades quedaban a
       distinta altura durante casi todo el recorrido y se leía "SILENCI&" en
       lugar de "SILENCIO &". Se conserva el gesto —partir y recomponer es la
       firma de la sección— pero a una amplitud que no rompe la palabra. */
    copyShift: 9,
    /* Ventana en la que el valor queda CENTRADO y sus dos mitades alineadas,
       es decir, el único tramo en el que su texto se puede leer entero.
       Estaba en 0.1: sobre un recorrido de ±1 por valor, apenas un 10% a cada
       lado, así que había que acertar el instante exacto para leerlo y el
       resto del tiempo la sección era una superposición de fragmentos.

       A 0.38 cada valor se sostiene enfocado durante la mayor parte de su
       paso: entra, se detiene a que lo leas, y recién entonces cede al
       siguiente. Es el enfoque por valor, sin renunciar al scroll. */
    titleHold: 0.38,
    imageZoom: 1.25,
    revealOverlap: 0.5,
  };

  // Each entry names its own image pair rather than relying on its position
  // in this array. Position worked only while the two happened to line up;
  // removing or reordering a value silently handed every value below it the
  // photographs of its neighbour. The count is read from this array too — the
  // counter total and the progress rail's step both derive from it.
  var slides = [
    {
      img: 1,
      title: "Calidez",
      tags: ["Servicio &amp; Cercan&iacute;a", "Atenci&oacute;n &amp; Detalle", "Gente &amp; Oficio"],
      note: "Recibir como se recibe en casa.",
      accent: "#e6c79a",
    },
    {
      img: 2,
      title: "Dise&ntilde;o",
      tags: ["Espacio &amp; Luz", "Materia &amp; Textura", "Forma &amp; Funci&oacute;n"],
      note: "Cada ambiente pensado dos veces.",
      accent: "#d3dbd6",
    },
    {
      img: 3,
      title: "Descanso",
      tags: ["Silencio &amp; Pausa", "Cama &amp; Sue&ntilde;o", "Tiempo &amp; Calma"],
      note: "El lujo de no tener apuro.",
      accent: "#c2d6dc",
    },
    {
      img: 4,
      title: "Ra&iacute;ces",
      tags: ["Amazonas &amp; Origen", "Valle &amp; R&iacute;o", "Local &amp; Aut&eacute;ntico"],
      note: "De Bagua Grande, para el mundo.",
      accent: "#d8c4a4",
    },
  ];

  var columns = {
    left: { el: root.querySelector(".values-left"), visible: new Map() },
    right: { el: root.querySelector(".values-right"), visible: new Map() },
  };
  if (!columns.left.el || !columns.right.el) return;

  var scrollPosition = 1;
  var scrollTarget = 1;
  var active = false;

  function createSlide(side, index) {
    var i = ((index % slides.length) + slides.length) % slides.length;
    var data = slides[i];

    var el = document.createElement("div");
    el.className = "values-slide";
    el.style.zIndex = index;
    el.innerHTML =
      '<img decoding="async" src="./img/value-' + data.img + "-" + side + '.jpg" alt="" />' +
      '<div class="values-overlay"></div>' +
      '<div class="values-copy" style="color:' + data.accent + '">' +
      '<div class="values-tags">' + data.tags.join("<br />") + "</div>" +
      '<div class="values-title">' + data.title + "</div>" +
      '<div class="values-note">' + data.note + "</div>" +
      "</div>";

    columns[side].el.appendChild(el);
    // The two elements this slide animates are looked up once, here, and
    // stored on the record. updateSlider used to call el.querySelector()
    // twice per slide on every frame of the run — a fresh selector match
    // against the subtree, sixty times a second, to find two children that
    // never change.
    columns[side].visible.set(index, {
      el: el,
      img: el.querySelector("img"),
      copy: el.querySelector(".values-copy"),
      hidden: false,
      clip: "",
      imgT: "",
      copyT: "",
    });

    // Decoding is the cost here, not downloading. These photographs are up to
    // 1400x1812, and a browser left to itself decodes them on the main thread
    // the first time they are painted — which lands on exactly the frame the
    // columns slide in, stalling that one transition while every later one
    // runs clean off the cache. That is the stutter, and it is far worse in
    // Safari than in Blink, which decodes off-thread more eagerly.
    //
    // The slides are built at page load, so asking for the decode here does
    // the work long before the section is reached. `decoding="async"` keeps
    // it off the main thread; decode() is what actually starts it rather than
    // waiting for first paint. A rejection just means the image is not there,
    // and the browser falls back to decoding on paint as before.
    var img = columns[side].visible.get(index).img;
    if (img && img.decode) img.decode().catch(function () {});
  }

  // inset(), not polygon(). Both describe the same straight horizontal edge,
  // but a four-point polygon is treated as arbitrary geometry and re-tessellated
  // on every frame it changes, while inset() is a rectangle the compositor has
  // a direct path for. The shape here is only ever a rectangle, so the polygon
  // was paying for generality it never used.
  function getRevealShape(side, revealAmount) {
    var d = Math.max(0, Math.min(1, revealAmount)) * (100 + settings.revealOverlap);
    // Rounded before it reaches the string. At full precision the value
    // changes on every frame no matter how slowly the page is moving, so the
    // guards below could never catch a repeat; two decimals is finer than a
    // device pixel on this box and lets a slow scroll skip most rewrites.
    var edge = (100 - d).toFixed(2);
    return side === "left" ? "inset(" + edge + "% 0 0 0)" : "inset(0 0 " + edge + "% 0)";
  }

  function getTitlePosition(slideProgress) {
    var fromCenter = slideProgress - 1;
    var past = Math.abs(fromCenter) - settings.titleHold;
    if (past <= 0) return 1;
    var t = past / (1 - settings.titleHold);
    return 1 + Math.sign(fromCenter) * t * t * (3 - 2 * t);
  }

  var progressBar = root.querySelector(".values-progress i");
  var counterTotal = root.querySelector(".values-counter");
  // The rail's filled segment is one slide wide and scaled up by the index,
  // so its base width has to track the count. It was hardcoded at 25% for
  // four values; with three that left the bar a quarter short of the end.
  root.style.setProperty("--vl-step", (100 / slides.length).toFixed(4) + "%");
  if (counterTotal) {
    counterTotal.lastChild.textContent = " / " + String(slides.length).padStart(2, "0");
  }
  var counterNow = root.querySelector(".values-counter b");
  var lastIndex = -1;

  function updateChrome() {
    var i = Math.max(0, Math.min(slides.length - 1, Math.round(scrollPosition) - 1));
    if (i === lastIndex) return;
    lastIndex = i;
    if (progressBar) progressBar.style.transform = "scaleX(" + (i + 1) + ")";
    if (counterNow) counterNow.textContent = String(i + 1).padStart(2, "0");
  }

  function updateSlider() {
    var first = Math.floor(scrollPosition) - settings.bufferSlides;
    var last = Math.floor(scrollPosition) + settings.bufferSlides + 1;

    ["left", "right"].forEach(function (side) {
      var visible = columns[side].visible;
      var drift = side === "left" ? 1 : -1;

      for (var i = first; i <= last; i++) {
        if (!visible.has(i)) createSlide(side, i);
      }

      visible.forEach(function (rec, index) {
        if (index < first || index > last) {
          rec.el.remove();
          visible.delete(index);
          return;
        }

        var revealAmount = scrollPosition - index;

        // Buffered but not on screen. Below 0 the clip encloses no area at
        // all; at 2 or above the next slide up is fully revealed and sits on
        // top of this one with a higher z-index, so it is completely covered.
        // Either way nothing of it can be seen.
        //
        // They still have to be hidden explicitly rather than left to the
        // clip. A zero-area clip-path stops the pixels reaching the screen,
        // but it does not stop the layer being built: every slide carries an
        // image and a 100vw-wide copy layer, and those are promoted while the
        // section is running. Six slides a column meant twenty-four composited
        // layers, twenty of which could never be seen, all of them allocated
        // and rasterised on the frames the section arrives on. That was the
        // hitch — it happened once, on entry, which is why it survived the
        // decode fix and the arrival-travel fix. visibility:hidden takes the
        // subtree out of painting entirely, so at rest this is four layers
        // instead of twenty-four.
        //
        // Returning early also skips three style writes per hidden slide per
        // frame during the pinned run.
        if (revealAmount <= 0 || revealAmount >= 2) {
          if (!rec.hidden) {
            rec.hidden = true;
            rec.el.style.visibility = "hidden";
          }
          return;
        }
        if (rec.hidden) {
          rec.hidden = false;
          rec.el.style.visibility = "";
        }

        var slideProgress = Math.max(0, Math.min(2, revealAmount));

        // Every write below is guarded against restating a value the element
        // already has. Assigning an identical string still invalidates the
        // element's style and, for clip-path, still costs a re-raster — and
        // the lerp settles asymptotically, so the tail of every transition
        // spends many frames producing values that no longer differ.
        var clip = getRevealShape(side, revealAmount);
        if (clip !== rec.clip) {
          rec.clip = clip;
          rec.el.style.clipPath = clip;
        }

        var imageDrift = (1 - slideProgress) * settings.imageShift * drift;
        var imgT =
          "translate3d(0," + imageDrift.toFixed(3) + "%,0) scale(" + settings.imageZoom + ")";
        if (imgT !== rec.imgT) {
          rec.imgT = imgT;
          rec.img.style.transform = imgT;
        }

        var titleDrift =
          (1 - getTitlePosition(slideProgress)) * settings.copyShift * drift;
        var copyT = "translate3d(0," + titleDrift.toFixed(3) + "%,0)";
        if (copyT !== rec.copyT) {
          rec.copyT = copyT;
          rec.copy.style.transform = copyT;
        }
      });
    });

    updateChrome();
  }

  // Pin the section and map its scroll progress onto the slider position.
  // `slides.length - 1` because the first value is already on screen when the
  // pin engages; each further unit of travel reveals the next one.
  var span = slides.length - 1;

  // ── Se toca una sola vez, en móvil ───────────────────────────────────
  // Bajando se ven las cuatro caras como siempre. Una vez completada, volver
  // hacia arriba la deja fija en la última —las dos imágenes partidas— sin
  // recalcular nada: ni el lerp, ni los recortes, ni las escrituras de estilo.
  //
  // En escritorio no aplica: ahí el recorrido se rehace en las dos
  // direcciones, que es como estaba y como se ve bien.
  var congelaAlVolver =
    typeof window.REGO_MQ !== "undefined" &&
    !window.matchMedia(window.REGO_MQ.DESKTOP).matches;
  var yaVista = false;

  var colapsada = false;

  // ── El colapso ───────────────────────────────────────────────────────
  // Congelar la última cara no alcanzaba: la sección seguía reteniendo tres
  // pantallas de scroll, así que al volver había que atravesar tres pantallas
  // de una imagen quieta para salir de ella.
  //
  // Una vez recorrida se le quita el pin y queda como lo que es: un bloque de
  // una pantalla mostrando el estado final. Eso obliga a recolocar el scroll a
  // mano — quitar altura por encima del visitante lo desplazaría — y la
  // cantidad no se supone: se mide la altura del documento antes y después y
  // se compensa con la diferencia real. El orden importa, porque refresh()
  // vuelve a medir los otros dos pins de la página, que están por debajo y
  // dependen de esta altura.
  function colapsar() {
    if (colapsada || !congelaAlVolver || !pinST) return;
    colapsada = true;

    var altoAntes = document.documentElement.scrollHeight;
    var yAntes = window.scrollY;

    pinST.kill(true);
    pinST = null;
    active = false;
    root.classList.remove("is-running");

    ScrollTrigger.refresh();

    var quitado = altoAntes - document.documentElement.scrollHeight;
    if (quitado > 0) window.scrollTo(0, Math.max(0, yAntes - quitado));
  }

  var pinST = ScrollTrigger.create({
    trigger: root,
    start: "top top",
    end: function () {
      return "+=" + window.innerHeight * span;
    },
    pin: true,
    scrub: true,
    // Higher priority refreshes FIRST, so this must sit *below* the pinned
    // sections above it on the page (story-hscroll uses 1). Otherwise this
    // trigger measures its position without their pin-spacer height.
    refreshPriority: -1,
    onToggle: function (self) {
      active = self.isActive;
      kick();
      // Promotion is scoped to the stretch where these elements are actually
      // being transformed. Left on permanently, `will-change` holds real
      // texture memory for the whole page and makes Safari build the layers
      // early, which is the cost this section was paying on arrival.
      root.classList.toggle("is-running", self.isActive);
    },
    onUpdate: function (self) {
      // Ya recorrida: no se vuelve a mover el objetivo, así que subir por
      // encima de la sección no la hace retroceder por las cuatro caras.
      if (congelaAlVolver && yaVista) return;

      if (congelaAlVolver && self.progress > 0.999) {
        yaVista = true;
        // Se fija de golpe en lugar de dejar que el lerp llegue solo: si el
        // visitante invierte el scroll a mitad de la convergencia, el estado
        // final quedaría a medio camino y ahí se congelaría.
        scrollTarget = 1 + span;
        scrollPosition = scrollTarget;
        updateSlider();
        return;
      }

      scrollTarget = 1 + self.progress * span;
      kick();
    },
    // Al salir por abajo, no en cuanto el progreso llega a 1: en ese momento
    // la sección todavía está en pantalla y quitarle el pin teletransportaría
    // al visitante en mitad del recorrido.
    onLeave: function () {
      if (congelaAlVolver && yaVista) colapsar();
    },
  });

  // The lerp is what gives the reveal its floaty lag.
  //
  // It is stepped against elapsed time, not against frames. Written as a flat
  // per-frame fraction it converged twice as fast on a 120Hz display as on a
  // 60Hz one — and Safari on a ProMotion panel does not hold one rate, it
  // moves between 24 and 120Hz according to what the system is doing, so the
  // smoothing constant was drifting *during* a scroll. That is felt as the
  // section tightening and loosening for no reason the visitor can see, which
  // is the part that reads as unsteadiness rather than as float. Converting
  // the fraction to a per-millisecond decay makes the response identical at
  // any refresh rate and stable while it changes.
  //
  // The clamp on dt keeps a backgrounded tab — where frames can be seconds
  // apart — from resuming with one enormous jump.
  var lastFrame = 0;
  var rafId = 0;

  function loop() {
    // La condición incluye el caso congelado, y esa es la mitad que hace que
    // esto ahorre algo. Mientras la sección está pineada `active` es true, así
    // que sin este añadido el bucle seguía corriendo a sesenta cuadros por
    // segundo llamando a updateSlider() todo el camino de vuelta — con el
    // objetivo quieto, pero pagando igual el frame.
    if (
      Math.abs(scrollTarget - scrollPosition) < 0.0005 &&
      (!active || (congelaAlVolver && yaVista))
    ) {
      // Settled and off screen: stop scheduling. This used to call
      // requestAnimationFrame unconditionally, so the callback stayed on the
      // frame queue for the entire life of the page, waking the main thread
      // sixty times a second through every other section to decide it had
      // nothing to do.
      rafId = 0;
      lastFrame = 0;
      return;
    }
    var now = performance.now();
    var dt = lastFrame ? Math.min(64, now - lastFrame) : 16.667;
    lastFrame = now;

    var k = 1 - Math.pow(1 - settings.smoothness, dt / 16.667);
    scrollPosition += (scrollTarget - scrollPosition) * k;
    updateSlider();
    rafId = requestAnimationFrame(loop);
  }

  function kick() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  updateSlider();


  // ── Arrival transition: the two columns part like a curtain ──────────
  // values.css drives this with a scroll-driven CSS animation wherever the
  // engine has one, because that runs on the compositor and cannot fall out
  // of phase with the scroll. This is the fallback for engines that do not,
  // and the two must never both run — the test below is character-for-
  // character the @supports condition guarding the CSS.
  var cssArrival =
    typeof CSS !== "undefined" &&
    CSS.supports &&
    CSS.supports("animation-timeline: view()");

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !cssArrival) {
    gsap.fromTo(
      columns.left.el,
      { yPercent: 16 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: true },
      }
    );
    // Simétrico con la columna izquierda a propósito: las dos mitades parten
    // en direcciones opuestas y por la misma cantidad.
    //
    // La amplitud es 16, no 100. Con el recorrido completo cada columna
    // arrancaba enteramente fuera de su caja y dejaba a la vista una franja
    // del fondo de la sección de hasta media pantalla — el bloque negro que
    // se veía al entrar desde Habitaciones. Debe coincidir con el @keyframes
    // de values.css: son la misma animación escrita dos veces, una para
    // motores con animation-timeline y otra para los que no.
    gsap.fromTo(
      columns.right.el,
      { yPercent: -16 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: true },
      }
    );
  }

  // Opacity only, so there is no position to fall out of phase and no reason
  // to route it through the CSS path. Runs on both.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.fromTo(
      [".values-eyebrow", ".values-progress", ".values-counter"],
      { opacity: 0 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top 40%", end: "top top", scrub: true },
      }
    );
  }
});
