/* FAQ — control del riel y del acordeón.

   Diferido a DOMContentLoaded por lo mismo que el resto de las secciones: los
   ScrollTrigger se miden en orden de creación, y uno nacido antes de que
   hscroll.js registre su pin se queda sin la altura del pin-spacer.

   Un solo estado —`active`, el índice abierto— gobierna los dos modos. Lo que
   cambia entre ellos es cómo se llega a él (el puntero en el riel, el toque en
   el acordeón) y si se admite tenerlo todo cerrado, que sólo tiene sentido en
   el acordeón. */
document.addEventListener("DOMContentLoaded", function () {
  var section = document.querySelector(".faq");
  if (!section) return;

  var wrap = section.querySelector(".faq-rail-wrap");
  var rail = section.querySelector(".faq-rail");
  var fill = section.querySelector(".faq-track-fill");
  var counter = section.querySelector(".faq-count b");
  var prevBtn = section.querySelector("[data-faq-prev]");
  var nextBtn = section.querySelector("[data-faq-next]");
  var panels = [].slice.call(section.querySelectorAll(".faq-panel"));
  if (!rail || !panels.length) return;

  // Tiene que coincidir con el 8fr de faq.css: el filete dorado se calcula a
  // partir de este número, no midiendo el DOM a medio transicionar.
  var ACTIVE_FR = 8;
  // Ancho base de .faq-track-fill en la hoja. El scaleX se calcula contra él.
  var FILL_BASE = 100;

  // El mismo predicado que separa los dos modos en faq.css. Si uno cambia, el
  // otro también, o el JS gobierna un riel que no existe.
  var railMQ = window.matchMedia(
    "(any-hover: hover) and (any-pointer: fine) and (min-width: 900px)"
  );
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var buttons = panels.map(function (p) {
    return p.querySelector(".faq-panel__btn");
  });

  // En el riel siempre hay uno abierto; en el acordeón se admite -1, todo
  // cerrado, porque cerrar lo que acabas de abrir es un gesto esperado ahí.
  var active = 0;
  // El filete no se pinta hasta que la entrada lo suelta, o crecería antes de
  // que los paneles hayan aparecido.
  var painted = false;

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* Geometría del riel, calculada y no medida. Durante la transición el DOM
     devuelve anchos intermedios, así que leerlo daría un filete persiguiendo a
     los paneles medio segundo por detrás. Con la plantilla conocida —un panel
     a ACTIVE_FR y el resto a 1fr— la posición final es aritmética. */
  function metrics() {
    var gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    var n = panels.length;
    var avail = rail.clientWidth - gap * (n - 1);
    return { gap: gap, unit: avail / (n - 1 + ACTIVE_FR) };
  }

  function paintFill(i) {
    if (!fill) return;
    if (!painted || i < 0 || !railMQ.matches) {
      fill.style.transform = "translateX(0) scaleX(0)";
      return;
    }
    var m = metrics();
    // Todo lo que hay antes del panel abierto está cerrado, así que mide una
    // unidad cada uno.
    var x = i * (m.unit + m.gap);
    var w = m.unit * ACTIVE_FR;
    fill.style.transform = "translateX(" + x + "px) scaleX(" + w / FILL_BASE + ")";
  }

  function paintTemplate(i) {
    if (!railMQ.matches) {
      // Fuera del riel la plantilla la pone la hoja; una inline sobreviviría al
      // cambio de modo y dejaría el acordeón en columnas.
      rail.style.removeProperty("grid-template-columns");
      return;
    }
    rail.style.gridTemplateColumns = panels
      .map(function (_, k) {
        return k === i ? ACTIVE_FR + "fr" : "1fr";
      })
      .join(" ");
  }

  function apply() {
    panels.forEach(function (p, k) {
      var on = k === active;
      p.classList.toggle("is-active", on);
      if (buttons[k]) buttons[k].setAttribute("aria-expanded", on ? "true" : "false");
    });
    if (counter) counter.textContent = pad2((active < 0 ? 0 : active) + 1);
    paintTemplate(active < 0 ? 0 : active);
    paintFill(active);
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    apply();
  }

  function step(dir) {
    var n = panels.length;
    // Con todo cerrado —sólo pasa en el acordeón— la flecha abre el extremo
    // que le corresponde, no el segundo panel. Tratar "nada abierto" como si
    // fuera el 0 hacía que "siguiente" saltara directo al 02.
    if (active < 0) {
      setActive(dir > 0 ? 0 : n - 1);
      return;
    }
    setActive((active + dir + n) % n);
  }

  /* ── ¿Se movió el puntero, o se movió lo que hay debajo? ─────────────
     `pointerenter` no significa "el ratón entró aquí": significa que este
     elemento y el puntero dejaron de solaparse, y eso pasa igual si el que se
     mueve es el elemento. Con el cursor quieto sobre el riel, bajar la página
     hacía que los seis paneles cruzaran por debajo y dispararan `enter` uno
     detrás de otro; cada uno reescribía `grid-template-columns`, que es una
     animación de LAYOUT de 0.72s en el hilo principal. Seis encadenadas
     mientras la sección además se traslada es el temblor que se veía al
     entrar en Reserva —y de paso dejaba abierto un panel del medio que nadie
     había elegido—.

     El navegador emite `pointermove` durante el scroll aunque el ratón no se
     haya movido, así que un simple "¿hubo pointermove?" no distingue los dos
     casos. Lo que sí los distingue son las COORDENADAS: si no cambian, el que
     se movió fue el documento. */
  var pointerMoved = false;
  var lastX = 0;
  var lastY = 0;
  // Hay una posición anterior con la que comparar. Se desarma en cada scroll,
  // porque el PRIMER pointermove que llega después es justamente el que genera
  // el propio scroll: sin desarmar, se compararía contra una posición vieja y
  // se leería como gesto. Desarmado, ese primer evento sólo siembra las
  // coordenadas y no cuenta.
  var armed = false;

  document.addEventListener(
    "pointermove",
    function (ev) {
      if (armed && (ev.clientX !== lastX || ev.clientY !== lastY)) pointerMoved = true;
      armed = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
    },
    { passive: true }
  );

  // Cada scroll vuelve a exigir un gesto real antes de volver a abrir nada.
  window.addEventListener(
    "scroll",
    function () {
      pointerMoved = false;
      armed = false;
    },
    { passive: true }
  );

  // ── Puntero ────────────────────────────────────────────────────────
  // pointerenter y no mouseenter: en un portátil con pantalla táctil el mismo
  // gesto llega como pointer, y así el riel responde a los dos sin duplicar el
  // manejador. El toque queda excluido por el tipo, que es lo que se quiere:
  // en táctil manda el click.
  panels.forEach(function (panel, i) {
    var hover = function (ev) {
      if (ev.pointerType === "touch") return;
      if (!railMQ.matches) return;
      if (!pointerMoved) return;
      setActive(i);
    };

    panel.addEventListener("pointerenter", hover);

    // También en pointermove: si tras un scroll el cursor ya está dentro de un
    // panel, `enter` no volverá a dispararse: ya ocurrió y se descartó. Sin
    // esto habría que salir del panel y volver a entrar para abrirlo. Es
    // barato — setActive corta en seco cuando el índice no cambia.
    panel.addEventListener("pointermove", hover, { passive: true });

    var btn = buttons[i];
    if (!btn) return;

    btn.addEventListener("click", function () {
      // En el riel el click abre; en el acordeón alterna, porque volver a
      // cerrar una respuesta leída es parte del gesto.
      if (!railMQ.matches && active === i) setActive(-1);
      else setActive(i);
    });

    // Tabular por las preguntas tiene que mover el riel, o el foco acaba en un
    // panel cerrado cuyo contenido no se ve.
    btn.addEventListener("focus", function () {
      if (railMQ.matches) setActive(i);
    });

    btn.addEventListener("keydown", function (ev) {
      if (!railMQ.matches) return;
      var dir = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      var n = panels.length;
      var to = (i + dir + n) % n;
      setActive(to);
      if (buttons[to]) buttons[to].focus();
    });
  });

  if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });

  // ── Cambios de tamaño y de modo ────────────────────────────────────
  // El filete se recoloca sin animar: si no, persigue al riel medio segundo
  // después de que la ventana ya paró.
  var resizeTimer = null;
  function relayout() {
    if (wrap) wrap.classList.add("no-anim");
    if (active < 0 && railMQ.matches) active = 0;
    apply();
    // Dos cuadros: uno para que el navegador aplique la plantilla nueva sin
    // transición, otro para devolverla antes de la siguiente interacción.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (wrap) wrap.classList.remove("no-anim");
      });
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 120);
  });

  // addEventListener y no onchange: onchange lo pisaría cualquier otro script
  // que escuchara la misma consulta.
  if (railMQ.addEventListener) railMQ.addEventListener("change", relayout);
  else if (railMQ.addListener) railMQ.addListener(relayout);

  apply();

  // ── Entrada ────────────────────────────────────────────────────────
  var head = [].slice.call(section.querySelectorAll(".faq-anim"));

  function reveal() {
    painted = true;
    paintFill(active);
  }

  if (typeof ScrollTrigger === "undefined" || typeof gsap === "undefined" || reduced) {
    // Sin GSAP la sección se ve entera; sólo falta soltar el filete.
    section.classList.remove("is-ready");
    reveal();
    return;
  }

  // La clase se pone aquí y no en el HTML para que una carga sin JS —o con el
  // script caído— no deje los paneles invisibles.
  section.classList.add("is-ready");

  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top 72%",
      once: true,
      // Igual que el resto de secciones de la mitad baja: las pinadas de
      // arriba tienen que medirse antes o estas marcas caen cortas.
      refreshPriority: -4,
    },
    onStart: reveal,
  });

  tl.fromTo(
    head,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.85, stagger: 0.09, ease: "power3.out" },
    0
  );

  /* Los paneles suben con el recorte abriéndose desde el borde inferior: la
     fila se "revela" en cascada en lugar de aparecer. clip-path y no height,
     que sería layout en cada cuadro sobre seis cajas con foto dentro. */
  tl.fromTo(
    panels,
    { opacity: 0, y: 44, clipPath: "inset(100% 0% 0% 0%)" },
    {
      opacity: 1,
      y: 0,
      clipPath: "inset(0% 0% 0% 0%)",
      duration: 1.05,
      stagger: 0.075,
      ease: "power3.out",
      // Las inline dejarían un clip-path fijo sobre paneles que después
      // transicionan de ancho, y un recorte estático encima de una caja que
      // cambia de tamaño se ve como un borde que no sigue.
      clearProps: "clipPath,transform",
    },
    0.22
  );
});
