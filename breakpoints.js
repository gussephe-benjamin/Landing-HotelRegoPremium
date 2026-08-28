/* One definition of "this is a desktop", shared by every section.

   It used to be width alone, and the thresholds had drifted apart as sections
   were written: the horizontal run switched at 1024px, the rooms slider at
   1101px, the location hand-off at 1024px. Two problems came out of that.

   The first is that width is the wrong question. A Windows laptop at 1366x768
   with the display scaled to 150% — an ordinary, common setup — reports 911
   CSS pixels, so the page decided it was a phone and served the phone layout
   on a machine with a keyboard and a mouse. At 125% the same laptop reports
   1093, which cleared the horizontal run's breakpoint but not the rooms
   slider's, so one section rendered as desktop and the next as mobile on the
   same screen.

   What actually separates the two cases is the input device, and CSS can be
   asked directly: `hover: hover` and `pointer: fine` together mean a pointer
   that can rest over a target without committing to it, which is a mouse or a
   trackpad and is not a finger. A tablet in landscape at 1024px answers no,
   which is the right answer twice over — its layout should be the touch one,
   and the pinned horizontal run with its WebGL neighbours is more than a
   tablet should be asked to carry.

   The width floor stays, at 860px, but its job is now only to catch a desktop
   window that has been dragged too narrow for a two-column editorial layout.

   GPU is a separate question from layout and keeps a separate answer. The
   rooms slider is a Three.js shader, and wanting the desktop *layout* on a
   modest laptop is not the same as wanting that shader on it — so the layout
   comes down to 860 while the shader stays where it was. Below it the section
   falls back to a plain <img>, which fills the same frame either way. */
(function () {
  "use strict";

  // `any-pointer`, no `pointer`. Esa es la corrección que faltaba y explica el
  // caso reportado: `pointer: fine` describe el dispositivo señalador
  // PRIMARIO, y una laptop con pantalla táctil puede reportar el táctil como
  // primario aunque tenga trackpad — con lo que una PC entera recibía el
  // layout de teléfono. `any-pointer: fine` pregunta si existe ALGÚN señalador
  // preciso, que es la pregunta que de verdad importa.
  //
  // El piso de ancho sigue atajando el otro lado: un teléfono con un ratón
  // Bluetooth cumple `any-pointer: fine` pero no llega a 860px.
  // ── El piso de ancho era la causa del colapso a vertical ─────────────
  // Medido: a 859px la seccion horizontal renderiza VERTICAL, a 861px
  // HORIZONTAL. El test de puntero pasaba en los dos -- el unico porton era
  // el ancho. Eso explica cada caso reportado, porque todos reducen el ancho
  // en pixeles CSS por debajo de 860 sin dejar de ser una PC:
  //
  //   1280px al 150% de zoom -> 853px CSS  -> caia a vertical
  //   1024px al 125%          -> 819px CSS  -> caia a vertical
  //   una ventana de Windows arrastrada angosta -> caia a vertical
  //
  // 640px es el piso nuevo. Deja de estorbar al zoom y a las ventanas
  // angostas, y sigue atajando el unico caso que el puntero no distingue: un
  // telefono con un raton Bluetooth, que cumple `any-pointer: fine` pero
  // ronda los 390-430px.
  //
  // La pregunta principal ya no es el ancho sino el dispositivo. `any-hover`
  // y `any-pointer`, nunca `hover`/`pointer` a secas: esos dos describen el
  // señalador PRIMARIO, y una laptop Windows con pantalla tactil puede
  // reportar el tactil como primario aunque tenga trackpad -- con lo que una
  // PC entera recibia el layout de telefono. `any-*` pregunta si existe
  // ALGUN señalador preciso, que es la pregunta que de verdad importa.
  var DESKTOP =
    "(any-hover: hover) and (any-pointer: fine) and (min-width: 640px)";

  window.REGO_MQ = {
    DESKTOP: DESKTOP,

    // With motion allowed — the form the pinned and scrubbed sections want.
    DESKTOP_MOTION: DESKTOP + " and (prefers-reduced-motion: no-preference)",

    // The exact complement, written with `not all and` rather than as a list
    // of negated features. De Morgan by hand would have left a gap: a device
    // reporting `pointer: none` fails `pointer: fine` and so is not desktop,
    // but it is not `pointer: coarse` either and would have matched neither
    // branch. Negating the whole condition cannot leave a hole.
    NOT_DESKTOP: "not all and " + DESKTOP,
    NOT_DESKTOP_MOTION: "not all and " + DESKTOP + ", (prefers-reduced-motion: reduce)",

    // Heavy GPU work. Same pointer test — a phone never qualifies — with a
    // width floor high enough to stand in for "this machine has a real GPU".
    GPU: "(min-width: 1101px) and (any-pointer: fine)",
  };

  // ── El salto de scroll en móvil ──────────────────────────────────────
  // En un teléfono, scrollear colapsa y despliega la barra de direcciones, y
  // el navegador emite un `resize` por cada cambio. ScrollTrigger se
  // re-mide ante un resize, así que cada colapso recalculaba los tres pins de
  // la página y reubicaba el scroll: eso es el "scrolleas y te manda para
  // atrás o adelante".
  //
  // `ignoreMobileResize` descarta exactamente ese caso — un resize móvil donde
  // solo cambió el alto — y conserva los que sí importan, como una rotación.
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.config({ ignoreMobileResize: true });
  }
})();
