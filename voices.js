/* Guest voices — auto-rotating testimonials.

   Vanilla/GSAP port of the "design-testimonial" React component. The Framer
   Motion pieces map across as follows:
     - AnimatePresence mode="wait"  → an out timeline that swaps the copy in an
       onComplete, then plays the in timeline
     - variants with delay: i * 0.05 → gsap stagger on the split words
     - useSpring/useTransform         → gsap.quickTo on the numeral (a tween
       tuned to the same settle as damping 25 / stiffness 200)
     - ease: [0.22, 1, 0.36, 1]      → "power4.out"
   The copy, the rating and the Google CTA are this hotel's, not the demo's. */
document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".voices");
  if (!root) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EASE = "power4.out";

  var data = [
    {
      quote: "Volví tres veces por trabajo y ya no busco hoteles.",
      name: "Camila Rentería",
      from: "Lima, PE",
      score: 5,
    },
    {
      quote: "El departamento impecable y la cocina con absolutamente todo.",
      name: "Diego Salazar",
      from: "Chiclayo, PE",
      score: 5,
    },
    {
      quote: "La terraza al atardecer vale el viaje entero.",
      name: "Ana Lucía Vargas",
      from: "Trujillo, PE",
      score: 5,
    },
    {
      quote: "Un mes con los niños y nunca nos faltó espacio.",
      name: "Martín Cabrera",
      from: "Jaén, PE",
      score: 4,
    },
    {
      quote: "Llegué a medianoche y me recibieron como si fuera mediodía.",
      name: "Valeria Ordóñez",
      from: "Cajamarca, PE",
      score: 5,
    },
  ];

  var band = root.querySelector(".voices-band");
  var quoteEl = root.querySelector(".voices-quote");
  var nameEl = root.querySelector(".voices-name");
  var fromEl = root.querySelector(".voices-from");
  var starsEl = root.querySelector(".voices-stars");
  var badgeEl = root.querySelector(".voices-badge");
  var personEl = root.querySelector(".voices-person");
  var ruleEl = root.querySelector(".voices-rule");
  var numeralEl = root.querySelector(".voices-numeral");
  var numeralSpan = numeralEl && numeralEl.querySelector("span");
  var progressEl = root.querySelector(".voices-progress i");
  var tickerTrack = root.querySelector(".voices-ticker-track");
  if (!quoteEl || !band) return;

  var STAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.3 6.6.7-4.9 4.5 1.4 6.5L12 16.8 6 20l1.4-6.5L2.5 9l6.6-.7z"/></svg>';

  // ── Ticker ───────────────────────────────────────────────────────────
  // Two identical halves so the -50% loop is seamless, rather than the demo's
  // fixed -1000px, which only lines up at one particular viewport width.
  if (tickerTrack) {
    var phrase = "REGO PREMIUM • BAGUA GRANDE • AMAZONAS ";
    var half = new Array(7).join(phrase);
    tickerTrack.innerHTML = "<span>" + half + "</span><span>" + half + "</span>";
    if (!reduced) {
      gsap.to(tickerTrack, {
        xPercent: -50,
        duration: 26,
        ease: "none",
        repeat: -1,
      });
    }
  }

  // ── Copy swap ────────────────────────────────────────────────────────
  function splitWords(text) {
    // The words are separate inline-blocks spaced by margin, so the spaces are
    // not in the text itself — screen readers would run the quote together.
    quoteEl.setAttribute("aria-label", "“" + text + "”");
    quoteEl.innerHTML = text
      .split(" ")
      .map(function (w) {
        return '<span class="voices-word">' + w + "</span>";
      })
      .join("");
    return [].slice.call(quoteEl.querySelectorAll(".voices-word"));
  }

  function setStatic(i) {
    var d = data[i];
    nameEl.textContent = d.name;
    fromEl.textContent = d.from;
    if (starsEl) starsEl.innerHTML = new Array(d.score + 1).join(STAR);
    if (numeralSpan) numeralSpan.textContent = String(i + 1).padStart(2, "0");
    if (progressEl) {
      gsap.to(progressEl, {
        height: ((i + 1) / data.length) * 100 + "%",
        duration: 0.5,
        ease: EASE,
        overwrite: true,
      });
    }
  }

  function playIn(words) {
    var tl = gsap.timeline();

    tl.fromTo(
      words,
      { opacity: 0, y: 20, rotateX: 90 },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.5, stagger: 0.05, ease: EASE },
      0
    )
      .fromTo(
        badgeEl,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, ease: EASE },
        0
      )
      .fromTo(
        personEl,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: EASE },
        0.2
      )
      .fromTo(
        ruleEl,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6, ease: EASE },
        0.3
      );

    if (numeralSpan) {
      tl.fromTo(
        numeralSpan,
        { opacity: 0, scale: 0.8, filter: "blur(10px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.6, ease: EASE },
        0
      );
    }

    return tl;
  }

  var current = 0;
  var busy = false;
  var timer = null;
  var INTERVAL = 6000;

  function show(i) {
    if (busy || i === current) return;
    busy = true;

    if (reduced) {
      setStatic(i);
      splitWords(data[i].quote);
      current = i;
      busy = false;
      return;
    }

    var oldWords = [].slice.call(quoteEl.querySelectorAll(".voices-word"));

    var tl = gsap.timeline({
      onComplete: function () {
        current = i;
        busy = false;
      },
    });

    // Out: the source's `exit` variants, same shapes and same offsets.
    tl.to(oldWords, { opacity: 0, y: -10, duration: 0.2, stagger: 0.02 }, 0)
      .to(badgeEl, { opacity: 0, x: 20, duration: 0.4 }, 0)
      .to(personEl, { opacity: 0, y: -20, duration: 0.4 }, 0);

    if (numeralSpan) {
      tl.to(
        numeralSpan,
        { opacity: 0, scale: 1.1, filter: "blur(10px)", duration: 0.6, ease: EASE },
        0
      );
    }

    tl.add(function () {
      setStatic(i);
      playIn(splitWords(data[i].quote));
    });

    // Holds the swap open while the in-timeline runs, so a fast click or the
    // interval can't start a second transition on top of it.
    tl.to({}, { duration: 1.1 });
  }

  function go(dir) {
    show((current + dir + data.length) % data.length);
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(function () { go(1); }, INTERVAL);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  [].slice.call(root.querySelectorAll(".voices-arrow")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      go(parseInt(btn.getAttribute("data-dir"), 10));
      restart();
    });
  });

  // ── Magnetic numeral ─────────────────────────────────────────────────
  // The component's useSpring(damping 25, stiffness 200) over a ±200px input
  // mapped to ±20 / ±10 of travel. quickTo gives the same follow-and-settle
  // without re-creating a tween on every pointer event.
  if (numeralEl && !reduced) {
    var toX = gsap.quickTo(numeralEl, "x", { duration: 0.55, ease: "power3.out" });
    var toY = gsap.quickTo(numeralEl, "y", { duration: 0.55, ease: "power3.out" });

    band.addEventListener("mousemove", function (e) {
      var r = band.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      toX(gsap.utils.clamp(-20, 20, (dx / 200) * 20));
      toY(gsap.utils.clamp(-10, 10, (dy / 200) * 10));
    });

    band.addEventListener("mouseleave", function () {
      toX(0);
      toY(0);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────
  setStatic(0);
  var firstWords = splitWords(data[0].quote);
  if (reduced) {
    gsap.set([badgeEl, personEl], { opacity: 1 });
    gsap.set(ruleEl, { scaleX: 1 });
  } else {
    gsap.set([firstWords, badgeEl, personEl], { opacity: 0 });
  }

  // Only rotate while the section is actually on screen, and pause on hover so
  // a quote can't slide away mid-read.
  var started = false;

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.create({
      trigger: root,
      start: "top 75%",
      end: "bottom 25%",
      refreshPriority: -2,
      onToggle: function (self) {
        if (self.isActive) {
          if (!started) {
            started = true;
            if (!reduced) playIn(firstWords);
          }
          if (!reduced) restart();
        } else {
          stop();
        }
      },
    });
  } else if (!reduced) {
    playIn(firstWords);
    restart();
  }

  band.addEventListener("mouseenter", stop);
  band.addEventListener("mouseleave", function () {
    if (!reduced && started) restart();
  });

  // ── Section entrance ─────────────────────────────────────────────────
  // Deliberately heavier than the rest of the page's reveals: this section
  // follows the dark values slider, so it needs a strong, unmistakable
  // "arriving" beat rather than a subtle fade.
  if (!reduced && typeof ScrollTrigger !== "undefined") {
    var headTl = gsap.timeline({
      scrollTrigger: { trigger: root, start: "top 75%", refreshPriority: -2 },
      defaults: { ease: "power4.out" },
    });

    headTl
      .from(".voices-eyebrow", { y: 26, opacity: 0, filter: "blur(8px)", duration: 0.8 })
      .from(
        ".voices-title",
        { y: 55, opacity: 0, scale: 0.94, filter: "blur(14px)", duration: 1.1 },
        "-=0.55"
      )
      .from(
        ".voices-intro",
        { y: 26, opacity: 0, filter: "blur(8px)", duration: 0.8 },
        "-=0.7"
      );

    // The band opens up from a slit *and* rises into place, which reads as
    // the strong break the section needs coming out of the dark slider above.
    gsap.from(".voices-band", {
      clipPath: "inset(50% 0% 50% 0%)",
      y: 40,
      duration: 1.3,
      ease: "power4.inOut",
      scrollTrigger: { trigger: ".voices-band", start: "top 82%", refreshPriority: -2 },
    });

    gsap.from([".voices-rail", ".voices-ticker"], {
      opacity: 0,
      duration: 1,
      delay: 0.4,
      scrollTrigger: { trigger: ".voices-band", start: "top 75%", refreshPriority: -2 },
    });

    gsap.from(".voices-foot > *", {
      y: 30,
      opacity: 0,
      filter: "blur(6px)",
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: ".voices-foot", start: "top 92%", refreshPriority: -2 },
    });
  }
});
