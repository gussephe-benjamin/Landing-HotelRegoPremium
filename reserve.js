document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".reserve");
  if (!root) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Video: some browsers refuse the initial autoplay, so nudge it again on
  //    canplay and on load. Rejections are expected and ignored.
  var video = root.querySelector(".reserve-video");
  if (video) {
    var play = function () {
      var p = video.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    };
    video.addEventListener("canplay", play);
    window.addEventListener("load", play);
    play();
  }

  if (typeof ScrollTrigger === "undefined") {
    root.classList.add("is-in");
    return;
  }

  // Every pinned section above must be measured first or these land short.
  var PRIORITY = -4;

  // ── Page transition ─────────────────────────────────────────────────
  // The panel rises over the previous section, and that section is held
  // still: it gets a scrubbed counter-translation exactly equal to the
  // distance scrolled, so it reads as frozen underneath while this one
  // slides up. Transform-only, so nothing in the document flow shifts.
  if (!reduced) {
    var previous = document.querySelector(".location");
    if (previous) {
      gsap.fromTo(
        previous,
        { y: 0 },
        {
          y: function () {
            return window.innerHeight;
          },
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "top top",
            scrub: true,
            invalidateOnRefresh: true,
            refreshPriority: PRIORITY,
          },
        }
      );
    }

    // A soft dim on the section being covered adds depth to the hand-off.
    gsap.fromTo(
      ".location-grid, .location-head, .location-near",
      { opacity: 1 },
      {
        opacity: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top 85%",
          end: "top 20%",
          scrub: true,
          refreshPriority: PRIORITY,
        },
      }
    );
  }

  // ── Entrance ─────────────────────────────────────────────────────────
  // The CSS keyframes carry the stagger; this only flips them on once the
  // panel is actually filling the screen.
  ScrollTrigger.create({
    trigger: root,
    start: "top 55%",
    once: true,
    refreshPriority: PRIORITY,
    onEnter: function () {
      root.classList.add("is-in");
    },
  });

  // The form lives in booking.js now.
});
