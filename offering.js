/* "Experiencia" — full-bleed video statement.
   Deferred to DOMContentLoaded so these triggers are created *after* story.js
   registers its pinned section. ScrollTrigger measures in creation order, and
   a trigger born before the pin misses the pin-spacer height entirely. */
document.addEventListener("DOMContentLoaded", function () {
  var section = document.querySelector(".offering");
  if (!section) return;

  // Quieta fuera del escritorio.
  //
  // Esta sección es una pantalla sostenida con un video de fondo, y en móvil
  // cobraba dos veces: un parallax con scrub, que escribe un transform en cada
  // cuadro mientras la sección cruza la pantalla, y una entrada que anima
  // `filter: blur()` sobre cada letra del titular por separado. Un desenfoque
  // animado es trabajo por píxel, y multiplicado por once letras es de lo más
  // caro que hacía la página en un teléfono — justo al llegar a una sección
  // que además está decodificando video.
  //
  // Se reutiliza la rama de movimiento reducido, que ya existía y ya hace lo
  // correcto: deja el recorte abierto y el texto visible en su estado final,
  // y no crea ninguna animación. El video queda, que es lo que se venía a ver.
  var reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (typeof window.REGO_MQ !== "undefined" &&
      !window.matchMedia(window.REGO_MQ.DESKTOP).matches);

  var frame = section.querySelector(".offering-frame");
  var video = section.querySelector(".offering-video");
  var kicker = section.querySelector(".offering-kicker");
  var word = section.querySelector(".offering-word");

  // ── Autoplay ─────────────────────────────────────────────────────────
  // Some browsers refuse the initial call; nudge it again on canplay and on
  // load. Rejections are expected and ignored.
  if (video) {
    var play = function () {
      var p = video.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    };
    video.addEventListener("canplay", play);
    window.addEventListener("load", play);
    play();
  }

  // ── Split the word so it can resolve letter by letter ────────────────
  var chars = [];
  if (word) {
    var text = word.textContent.trim();
    word.textContent = "";
    text.split("").forEach(function (ch) {
      var span = document.createElement("span");
      span.className = "offering-char";
      span.textContent = ch;
      word.appendChild(span);
      chars.push(span);
    });
    // The split turns one word into N elements; without this a screen reader
    // would spell it out.
    word.setAttribute("aria-label", text);
  }

  if (typeof ScrollTrigger === "undefined") return;

  if (reduced) {
    gsap.set([kicker].concat(chars), { opacity: 1 });
    gsap.set(frame, { clipPath: "inset(0% 0% 0% 0%)" });
    return;
  }

  // ── Parallax ─────────────────────────────────────────────────────────
  // The video is scaled 1.06 in CSS, which leaves 3% of slack on each edge —
  // this stays inside it so no edge is ever exposed.
  gsap.fromTo(
    video,
    { yPercent: -3 },
    {
      yPercent: 3,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true },
    }
  );

  // ── Statement entrance ───────────────────────────────────────────────
  // Played rather than scrubbed: the whole section is one held frame, so the
  // type should arrive on its own beat instead of tracking the scrollbar.
  var tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: "top 65%", once: true },
  });

  // The frame splits open from the centre line before the type arrives.
  tl.fromTo(
    frame,
    { clipPath: "inset(50% 0% 50% 0%)" },
    { clipPath: "inset(0% 0% 0% 0%)", duration: 1.25, ease: "power4.inOut" },
    0
  );

  tl.fromTo(
    kicker,
    { opacity: 0, y: 16, filter: "blur(8px)" },
    { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" },
    0.55
  ).fromTo(
    chars,
    { opacity: 0, y: 40, filter: "blur(12px)" },
    {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 1.1,
      stagger: 0.045,
      ease: "power3.out",
    },
    0.7
  );
});
