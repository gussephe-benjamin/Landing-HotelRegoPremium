/* Floating trigger + curved slide-in navigation.

   Vanilla port of the `curved-menu` React component (see menu.css for what
   carried over and what did not). Framer Motion's variants map to a GSAP
   timeline; AnimatePresence's exit becomes an onComplete that re-hides the
   container.

   The trigger is deliberately absent from the sections that run heavy
   effects — a glass button floating over the pinned horizontal scroll or the
   cursor-trail finale reads as a stray widget, not as chrome. */

/* Sections that own the screen while they play. The button hides whenever one
   of these is across the viewport's middle. */
// .kinetic salió de la lista al eliminarse esa sección: un selector que no
// resuelve dejaría el botón sin regla que lo tape, pero además Reserva es
// ahora la última ventana y ahí el botón SÍ debe verse — es el único acceso
// a la navegación una vez que se acaba la página.
var MENU_LOUD = [".hero-intro", ".story", ".rooms"];

document.addEventListener("DOMContentLoaded", function () {
  var fab = document.querySelector(".nav-fab");
  var shell = document.querySelector(".cv");
  if (!fab || !shell) return;

  var panel = shell.querySelector(".cv-panel");
  var scrim = shell.querySelector(".cv-scrim");
  var edge = shell.querySelector(".cv-edge path");
  var links = [].slice.call(shell.querySelectorAll(".cv-link"));
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Per-letter ripple ────────────────────────────────────────────────
  // Each word is split so the letters can be staggered independently. The
  // source shifts the container -16px while every letter goes +16px: the net
  // resting offset is zero, so what you see is a wave passing through the
  // word rather than the word moving.
  links.forEach(function (link) {
    var word = link.querySelector(".cv-word");
    var text = word.textContent;
    word.textContent = "";
    text.split("").forEach(function (ch) {
      var s = document.createElement("span");
      s.textContent = ch === " " ? " " : ch;
      word.appendChild(s);
    });

    if (reduced) return;
    var letters = [].slice.call(word.children);

    link.addEventListener("mouseenter", function () {
      gsap.to(word, { x: -16, duration: 0.4, ease: "power2.out" });
      gsap.to(letters, { x: 16, duration: 0.4, ease: "power2.out", stagger: 0.02 });
    });
    link.addEventListener("mouseleave", function () {
      gsap.to(word, { x: 0, duration: 0.4, ease: "power2.out" });
      gsap.to(letters, { x: 0, duration: 0.4, ease: "power2.out", stagger: 0.02 });
    });
  });

  // ── The curved edge ──────────────────────────────────────────────────
  // Both paths carry the same number of coordinates, so tweening the `d`
  // attribute interpolates them point for point.
  function bowed() {
    var h = window.innerHeight;
    return "M100 0 L200 0 L200 " + h + " L100 " + h + " Q-100 " + h / 2 + " 100 0";
  }
  function flat() {
    var h = window.innerHeight;
    return "M100 0 L200 0 L200 " + h + " L100 " + h + " Q100 " + h / 2 + " 100 0";
  }

  // ── Open / close ─────────────────────────────────────────────────────
  var open = false;
  var busy = false;

  var EASE = "power4.inOut"; // stand-in for the source's cubic-bezier(.76,0,.24,1)

  function openMenu() {
    if (open || busy) return;
    open = true;
    busy = true;

    shell.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "Cerrar menú");
    document.body.style.overflow = "hidden";

    edge.setAttribute("d", bowed());

    if (reduced) {
      gsap.set(scrim, { opacity: 1 });
      gsap.set(panel, { x: 0 });
      edge.setAttribute("d", flat());
      busy = false;
      links[0].focus();
      return;
    }

    var tl = gsap.timeline({ onComplete: function () { busy = false; links[0].focus(); } });
    tl.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0)
      .fromTo(panel,
        { x: function () { return panel.offsetWidth + 100; } },
        { x: 0, duration: 0.8, ease: EASE }, 0)
      .to(edge, { attr: { d: flat() }, duration: 1, ease: EASE }, 0)
      .fromTo(links,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }, 0.35);
  }

  function closeMenu() {
    if (!open || busy) return;
    open = false;
    busy = true;

    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Abrir menú");
    document.body.style.overflow = "";

    function finish() {
      shell.hidden = true;
      busy = false;
      // Always back to the trigger, never to whatever happened to be focused
      // when the menu opened: a click does not reliably focus a button (Safari
      // on macOS never does), so that was often the body, and closing the
      // dialog dropped the keyboard user back at the top of the document.
      fab.focus();
    }

    if (reduced) { finish(); return; }

    gsap.timeline({ onComplete: finish })
      .to(scrim, { opacity: 0, duration: 0.5, ease: "power2.in" }, 0)
      .to(panel, { x: function () { return panel.offsetWidth + 100; }, duration: 0.8, ease: EASE }, 0)
      .to(edge, { attr: { d: bowed() }, duration: 0.8, ease: EASE }, 0);
  }

  fab.addEventListener("click", function () { open ? closeMenu() : openMenu(); });
  scrim.addEventListener("click", closeMenu);

  document.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") { closeMenu(); return; }
    // The dialog is modal, so the tab ring is kept inside it.
    if (e.key !== "Tab") return;
    var focusables = [].slice.call(shell.querySelectorAll("a[href], button"));
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ── Ir a una sección ─────────────────────────────────────────────────
  // Un salto, no un recorrido. Con behavior:"smooth" el navegador atraviesa
  // toda la distancia hasta el destino, y como en el medio hay tres secciones
  // ancladas eso significa reproducir cada efecto del camino a velocidad de
  // scroll: son varios segundos viendo pasar la landing entera. Desde un menú
  // de navegación lo que se espera es aparecer ahí.
  function scrollYFor(href) {
    if (href === "#top") return 0;
    var target = document.querySelector(href);
    if (!target) return null;

    // Una sección anclada está transformada mientras su pin corre, así que su
    // propio rect no dice dónde empieza — el pin sí, y su start es
    // exactamente la posición de scroll en la que la sección toma la pantalla.
    if (typeof ScrollTrigger !== "undefined") {
      var pinned = ScrollTrigger.getAll().filter(function (st) {
        return st.pin && st.trigger === target;
      })[0];
      if (pinned) return pinned.start;
    }

    return target.getBoundingClientRect().top + window.scrollY;
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return;
      e.preventDefault();
      closeMenu();

      // El scroll tiene que esperar a que se suelte el bloqueo de overflow del
      // body, o la posición que calcula es la del documento bloqueado.
      setTimeout(function () {
        // El intro bloquea el documento (body.is-intro pone overflow:hidden),
        // así que un clic durante él saltaría a ningún lado.
        if (window.unlockScroll) window.unlockScroll();

        // Medir después de refrescar: los pins de arriba se quedan con mucha
        // distancia de scroll, y un pin-spacer con altura vieja deja el
        // destino cientos de píxeles corrido.
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();

        var y = scrollYFor(href);
        if (y === null) return;

        window.scrollTo({ top: y, behavior: "auto" });

        // Sin esto los triggers quedan evaluados contra la posición anterior
        // y la sección de destino aparece con su estado de entrada a medias.
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.update();
        if (window.history && history.replaceState) history.replaceState(null, "", href);
      }, 60);
    });
  });

  window.addEventListener("resize", function () {
    if (open) edge.setAttribute("d", flat());
  });

  // ── Where the trigger is allowed to appear ───────────────────────────
  if (typeof ScrollTrigger === "undefined") {
    fab.classList.add("is-shown");
    return;
  }

  var loud = 0;

  MENU_LOUD.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      // Active while the section covers the viewport's middle, so exactly one
      // section counts as "current" and the button does not flicker at the
      // seams between them.
      start: "top center",
      end: "bottom center",
      // Below every pin on the page; these must measure last.
      refreshPriority: -7,
      onToggle: function (self) {
        loud += self.isActive ? 1 : -1;
        if (loud < 0) loud = 0;
        fab.classList.toggle("is-shown", loud === 0 && !open);
      },
    });
  });

  // The intro locks the page; nothing should float over it.
  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    refreshPriority: -7,
    onRefresh: function () {
      fab.classList.toggle("is-shown", loud === 0);
    },
  });
});
