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
    smoothness: 0.08,
    bufferSlides: 2,
    imageShift: 25,
    copyShift: 15,
    titleHold: 0.1,
    imageZoom: 1.25,
    revealOverlap: 0.5,
  };

  var slides = [
    {
      title: "Calidez",
      tags: ["Servicio &amp; Cercan&iacute;a", "Atenci&oacute;n &amp; Detalle", "Gente &amp; Oficio"],
      note: "Recibir como se recibe en casa.",
      accent: "#e6c79a",
    },
    {
      title: "Dise&ntilde;o",
      tags: ["Espacio &amp; Luz", "Materia &amp; Textura", "Forma &amp; Funci&oacute;n"],
      note: "Cada ambiente pensado dos veces.",
      accent: "#d3dbd6",
    },
    {
      title: "Descanso",
      tags: ["Silencio &amp; Pausa", "Cama &amp; Sue&ntilde;o", "Tiempo &amp; Calma"],
      note: "El lujo de no tener apuro.",
      accent: "#c2d6dc",
    },
    {
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
      '<img src="./img/value-' + (i + 1) + "-" + side + '.jpg" alt="" />' +
      '<div class="values-overlay"></div>' +
      '<div class="values-copy" style="color:' + data.accent + '">' +
      '<div class="values-tags">' + data.tags.join("<br />") + "</div>" +
      '<div class="values-title">' + data.title + "</div>" +
      '<div class="values-note">' + data.note + "</div>" +
      "</div>";

    columns[side].el.appendChild(el);
    columns[side].visible.set(index, el);
  }

  function getRevealShape(side, revealAmount) {
    var d = Math.max(0, Math.min(1, revealAmount)) * (100 + settings.revealOverlap);
    return side === "left"
      ? "polygon(0% " + (100 - d) + "%, 100% " + (100 - d) + "%, 100% 100%, 0% 100%)"
      : "polygon(0% 0%, 100% 0%, 100% " + d + "%, 0% " + d + "%)";
  }

  function getTitlePosition(slideProgress) {
    var fromCenter = slideProgress - 1;
    var past = Math.abs(fromCenter) - settings.titleHold;
    if (past <= 0) return 1;
    var t = past / (1 - settings.titleHold);
    return 1 + Math.sign(fromCenter) * t * t * (3 - 2 * t);
  }

  var progressBar = root.querySelector(".values-progress i");
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

      visible.forEach(function (el, index) {
        if (index < first || index > last) {
          el.remove();
          visible.delete(index);
          return;
        }

        var revealAmount = scrollPosition - index;
        var slideProgress = Math.max(0, Math.min(2, revealAmount));

        el.style.clipPath = getRevealShape(side, revealAmount);

        var imageDrift = (1 - slideProgress) * settings.imageShift * drift;
        el.querySelector("img").style.transform =
          "translateY(" + imageDrift + "%) scale(" + settings.imageZoom + ")";

        var titleDrift =
          (1 - getTitlePosition(slideProgress)) * settings.copyShift * drift;
        el.querySelector(".values-copy").style.transform =
          "translateY(" + titleDrift + "%)";
      });
    });

    updateChrome();
  }

  // Pin the section and map its scroll progress onto the slider position.
  // `slides.length - 1` because the first value is already on screen when the
  // pin engages; each further unit of travel reveals the next one.
  var span = slides.length - 1;

  ScrollTrigger.create({
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
    },
    onUpdate: function (self) {
      scrollTarget = 1 + self.progress * span;
    },
  });

  // The lerp is what gives the reveal its floaty lag; it only runs while the
  // section is on screen so it costs nothing for the rest of the page.
  function loop() {
    requestAnimationFrame(loop);
    if (!active && Math.abs(scrollTarget - scrollPosition) < 0.0005) return;
    scrollPosition += (scrollTarget - scrollPosition) * settings.smoothness;
    updateSlider();
  }

  updateSlider();
  loop();


  // ── Arrival transition: the two columns part like a curtain ──────────
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.fromTo(
      columns.left.el,
      { yPercent: 100 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: true },
      }
    );
    gsap.fromTo(
      columns.right.el,
      { yPercent: -100 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: true },
      }
    );
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
