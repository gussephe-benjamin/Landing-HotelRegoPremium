document.addEventListener("DOMContentLoaded", function () {
  gsap.registerPlugin(ScrollTrigger, Flip);

  // The intro timeline owns the screen until it finishes; only then does the
  // page become scrollable and the pinned sections start measuring.
  window.unlockScroll = function () {
    if (!document.body.classList.contains("is-intro")) return;
    document.body.classList.remove("is-intro");
    ScrollTrigger.refresh();
  };

  var root = getComputedStyle(document.documentElement);
  var lightColor = root.getPropertyValue("--st-light").trim();
  var darkColor = root.getPropertyValue("--st-dark").trim();

  // ── Word-by-word reveal for the opening statement ────────────────────
  // Wraps each word in its own span (no SplitText plugin needed) and resolves
  // them out of a blur with a short stagger once the section is in view.
  (function initIntroReveal() {
    var heading = document.querySelector(".story-intro h2");
    if (!heading) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── The lead-in stroke ─────────────────────────────────────────────
    // Scrubbed to scroll rather than played on entry, so it starts extending
    // from the first pixel of scroll and is already complete by the time the
    // phrase begins to resolve. The end is a fixed scroll position, and the
    // track behind it shows that full extent from the start — the stroke has
    // a defined stopping point and cannot run past it.
    var lineWrap = document.querySelector(".story-intro-line");
    var lineDraw = document.querySelector(".story-line-draw");
    var lineTip = document.querySelector(".story-line-tip");

    if (lineWrap && lineDraw && lineTip && !reduced) {
      var lineH = lineWrap.offsetHeight;

      ScrollTrigger.create({
        trigger: ".story-intro",
        start: "top bottom",
        end: "top 76%",
        // Smoothed rather than locked 1:1, so the stroke keeps extending for a
        // beat after the scroll stops instead of snapping to a halt.
        scrub: 0.6,
        onRefresh: function () {
          lineH = lineWrap.offsetHeight;
        },
        onUpdate: function (self) {
          // ScrollTrigger already clamps to 0..1; the tip is positioned from
          // the same number as the stroke's scale, so it can never lead or
          // trail the edge it is meant to sit on.
          var p = self.progress;
          gsap.set(lineDraw, { scaleY: p });
          gsap.set(lineTip, { y: p * lineH, opacity: p > 0.015 ? 1 : 0 });
        },
      });
    }

    // ── Word-by-word blur-in ───────────────────────────────────────────
    var words = heading.textContent.trim().split(/\s+/);
    heading.innerHTML = words
      .map(function (w) {
        return '<span class="reveal-word">' + w + "</span>";
      })
      .join(" ");

    var wordEls = heading.querySelectorAll(".reveal-word");

    if (reduced) {
      gsap.set(wordEls, { opacity: 1, filter: "none" });
      return;
    }

    // The TextBlurIn component's own values: 0.8s per word, 0.04s stagger,
    // opacity and blur only — no vertical travel, which is what makes it read
    // as pulling into focus. "power2.out" matches Motion's default easeOut.
    gsap.set(wordEls, { opacity: 0, filter: "blur(10px)" });

    ScrollTrigger.create({
      trigger: ".story-intro",
      start: "top 70%",
      once: true,
      onEnter: function () {
        gsap.to(wordEls, {
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.8,
          stagger: 0.04,
          ease: "power2.out",
        });
      },
    });
  })();

  // ── Marquee drifts sideways as the section enters ──────────────────
  ScrollTrigger.create({
    trigger: ".story-marquee",
    start: "top bottom",
    end: "top top",
    scrub: true,
    onUpdate: function (self) {
      gsap.set(".story-marquee-images", { x: -75 + self.progress * 25 + "%" });
    },
  });

  // ── The tagged marquee image is cloned into a fixed-position copy, so it
  //    can leave the tilted strip and later Flip to fullscreen ───────────
  var clone = null;
  var cloneActive = false;

  function createClone() {
    if (cloneActive) return;
    var original = document.querySelector(".story-marquee-img.story-pin img");
    var rect = original.getBoundingClientRect();

    clone = original.cloneNode(true);
    gsap.set(clone, {
      position: "fixed",
      left: rect.left + rect.width / 2 - original.offsetWidth / 2,
      top: rect.top + rect.height / 2 - original.offsetHeight / 2,
      width: original.offsetWidth,
      height: original.offsetHeight,
      transform: "rotate(-5deg)",
      transformOrigin: "center center",
      pointerEvents: "none",
      willChange: "transform",
      zIndex: 100,
    });

    document.body.appendChild(clone);
    gsap.set(original, { opacity: 0 });
    cloneActive = true;
  }

  function removeClone() {
    if (!cloneActive) return;
    if (clone) {
      clone.remove();
      clone = null;
    }
    gsap.set(document.querySelector(".story-marquee-img.story-pin img"), { opacity: 1 });
    cloneActive = false;
  }

  ScrollTrigger.create({
    trigger: ".story-hscroll",
    start: "top top",
    end: function () {
      return "+=" + window.innerHeight * 5;
    },
    pin: true,
    // Must refresh before any trigger further down the page, otherwise those
    // measure their position without this pin's spacer height.
    refreshPriority: 1,
  });

  ScrollTrigger.create({
    trigger: ".story-marquee",
    start: "top top",
    onEnter: createClone,
    onEnterBack: createClone,
    onLeaveBack: removeClone,
  });

  // ── Giant headline + flying cards ───────────────────────────────────
  // Ported from the "Meet The Obsessives" section. It is driven from this
  // pinned section's own progress instead of its own ScrollTrigger, because
  // the cards travel sideways inside a pin — a normal trigger would never
  // see them cross the viewport.
  var obsessHeader = document.querySelector(".obsess-header");
  var obsessCards = [].slice.call(document.querySelectorAll(".obsess-card"));

  // Per-card [yPercent keyframes, rotation keyframes] — this is what gives
  // each card its own bob and tilt instead of a uniform slide.
  var cardTransforms = [
    [[10, 50, -10, 10], [20, -10, -45, 20]],
    [[0, 47.5, -10, 15], [-25, 15, -45, 30]],
    [[0, 52.5, -10, 5], [15, -5, -40, 60]],
    [[0, 50, 30, -80], [20, -10, 60, 5]],
    [[0, 55, -15, 30], [25, -15, 60, 95]],
    [[5, 46, -12, 22], [-18, 12, -50, 40]],
  ];

  var maxTranslate = 0;
  var cardStartX = 25;
  var cardEndX = -650;

  function measureObsess() {
    if (!obsessHeader) return;
    maxTranslate = Math.max(0, obsessHeader.offsetWidth - window.innerWidth);

    var cardWidth = 325;
    if (obsessCards[0]) {
      cardWidth = obsessCards[0].getBoundingClientRect().width || 325;
    }
    // Scale the travel so cards clear the screen on any viewport width.
    var travel = Math.abs((-650 / 100) * cardWidth) * 1.25 *
      Math.max(1, window.innerWidth / 1920);
    cardStartX = 25;
    cardEndX = -(travel / cardWidth) * 100;
  }

  // Headline and cards get separate lead-ins off the same raw progress: the
  // type follows the facade closely, while the cards hold back until the
  // full stretch has passed so they never arrive before it.
  var HEADLINE_LEAD = 0.1;
  var CARDS_LEAD = 0.24;

  function updateObsess(hp) {
    var raw = gsap.utils.clamp(0, 1, hp);
    var headP = gsap.utils.clamp(0, 1, (raw - HEADLINE_LEAD) / (1 - HEADLINE_LEAD));
    var cardsP = gsap.utils.clamp(0, 1, (raw - CARDS_LEAD) / (1 - CARDS_LEAD));

    if (obsessHeader) gsap.set(obsessHeader, { x: -headP * maxTranslate });

    obsessCards.forEach(function (card, i) {
      // 0.115 sets the gap between cards; with 6 of them the last still
      // finishes inside the run (5*0.115 + 1/2.4 ≈ 0.99).
      var delay = i * 0.115;
      var cp = Math.max(0, Math.min((cardsP - delay) * 2.4, 1));

      if (cp <= 0) {
        gsap.set(card, { opacity: 0 });
        return;
      }

      var ys = cardTransforms[i][0];
      var rots = cardTransforms[i][1];
      var yProgress = cp * 3;
      var k = Math.min(Math.floor(yProgress), ys.length - 2);
      var t = yProgress - k;

      gsap.set(card, {
        xPercent: gsap.utils.interpolate(cardStartX, cardEndX, cp),
        yPercent: gsap.utils.interpolate(ys[k], ys[k + 1], t),
        rotation: gsap.utils.interpolate(rots[k], rots[k + 1], t),
        opacity: 1,
      });
    });
  }

  measureObsess();
  updateObsess(0);
  ScrollTrigger.addEventListener("refreshInit", measureObsess);
  window.addEventListener("resize", measureObsess, { passive: true });

  // ── Flip the clone from its marquee footprint to fullscreen ─────────
  var flip = null;

  ScrollTrigger.create({
    trigger: ".story-hscroll",
    start: "top 50%",
    end: function () {
      return "+=" + window.innerHeight * 5.5;
    },
    onEnter: function () {
      if (!clone || !cloneActive || flip) return;
      var state = Flip.getState(clone);
      gsap.set(clone, {
        position: "fixed",
        left: 0,
        top: 0,
        width: "100%",
        height: "100svh",
        transform: "rotate(0deg)",
        transformOrigin: "center center",
      });
      flip = Flip.from(state, { duration: 1, ease: "none", paused: true });
    },
    onLeaveBack: function () {
      if (flip) {
        flip.kill();
        flip = null;
      }
      gsap.set(".story", { backgroundColor: lightColor });
      updateObsess(0);
    },
  });

  // ── Scrub the flip, the background fade and the horizontal travel ───
  ScrollTrigger.create({
    trigger: ".story-hscroll",
    start: "top 50%",
    end: function () {
      return "+=" + window.innerHeight * 5.5;
    },
    onUpdate: function (self) {
      var p = self.progress;

      if (p <= 0.05) {
        gsap.set(".story", {
          backgroundColor: gsap.utils.interpolate(lightColor, darkColor, Math.min(p / 0.05, 1)),
        });
      } else {
        gsap.set(".story", { backgroundColor: darkColor });
      }

      // Phases: flip to fullscreen → hold → horizontal run.
      var FLIP_END = 0.2;
      // Just a beat once the facade fills the screen — long enough to read as
      // a deliberate frame, short enough that it never feels like the scroll
      // has stalled.
      var HOLD_END = 0.24;

      if (p <= FLIP_END && flip) {
        flip.progress(p / FLIP_END);
        return;
      }

      if (flip) flip.progress(1);

      // The hold keeps the facade filling the screen so it reads as a
      // full-screen frame before the horizontal run begins.
      if (p <= HOLD_END) {
        gsap.set(clone, { x: "0%", scale: 1 });
        updateObsess(0);
        return;
      }

      if (p <= 0.95) {
        var hp = (p - HOLD_END) / (0.95 - HOLD_END);
        gsap.set(clone, { x: -((66.67 / 100) * 3 * hp) * 100 + "%", scale: 1 });
        updateObsess(hp);
      } else {
        gsap.set(clone, { x: "-200%", scale: 1 });
        updateObsess(1);
      }
    },
  });
});
