// Deferred to DOMContentLoaded so these triggers are created *after* story.js
// registers its pinned section. ScrollTrigger measures in creation order, and
// a trigger born before the pin misses the pin-spacer height entirely.
document.addEventListener("DOMContentLoaded", function () {
  var section = document.querySelector(".offering");
  if (!section) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var isMobile = window.matchMedia("(max-width: 767px)").matches;
  var shift = isMobile ? 4 : 8;

  var media = section.querySelector(".offering-media");
  var img = section.querySelector(".offering-img");
  var ghost = section.querySelector(".offering-ghost");

  // ── Parallax: the image drifts against the page across the whole time the
  //    section is on screen, so the range is the full crossing (top of the
  //    section hitting the bottom of the viewport, to its bottom hitting the
  //    top). `scrub: true` locks it to the scrollbar; the ghost number uses a
  //    wider range so it visibly lags behind the photo.
  gsap.fromTo(
    img,
    { yPercent: -shift },
    {
      yPercent: shift,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    }
  );

  if (ghost) {
    gsap.fromTo(
      ghost,
      { yPercent: -15 },
      {
        yPercent: 15,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  }

  // ── The photo's entrance ────────────────────────────────────────────
  // Played out rather than scrubbed. Tied to the scrollbar it finished in a
  // single flick of the wheel and read as a static image; on its own clock it
  // always gets its full run regardless of how fast the visitor scrolls.
  //
  // Four things move at once: the card wipes open downward, the photo inside
  // settles back from an over-scale so it appears to fall into place under the
  // moving edge, a band of light rides just ahead of that edge, and the shadow
  // grows in so the card lands on the page rather than starting there.
  var clip = section.querySelector(".offering-clip");
  var sweep = section.querySelector(".offering-sweep");

  var SHADOW_OFF = "0 0px 0px rgba(20, 16, 12, 0), 0 0px 0px -20px rgba(20, 16, 12, 0)";
  var SHADOW_ON =
    "0 2px 8px rgba(20, 16, 12, 0.08), 0 40px 80px -20px rgba(20, 16, 12, 0.35)";

  var entrance = gsap.timeline({
    scrollTrigger: {
      trigger: media,
      start: "top 82%",
      once: true,
    },
  });

  entrance
    .fromTo(
      media,
      { scale: 0.88, boxShadow: SHADOW_OFF },
      { scale: 1, boxShadow: SHADOW_ON, duration: 1.7, ease: "power4.out" },
      0
    )
    .fromTo(
      clip,
      { clipPath: "inset(0% 0% 100% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "power4.inOut" },
      0.05
    )
    // Scale only — the image's yPercent belongs to the parallax tween above,
    // and two tweens writing the same property would fight each other.
    .fromTo(img, { scale: 1.4 }, { scale: 1, duration: 2, ease: "power3.out" }, 0)
    // Pinned to the reveal: same start, duration and ease as the wipe. The band
    // is 40% of the card's height, so travelling -100% → 150% of itself puts
    // its lower edge exactly on the clip's edge for the whole run. Given its
    // own timing it simply arrived late, after the card had already opened.
    .fromTo(
      sweep,
      // `y: 0` is not redundant. GSAP resolves the stylesheet's percentage
      // translate into a pixel `y`, which then adds to whatever `yPercent`
      // the tween sets — the band tracked the edge's motion exactly but sat a
      // constant ~387px above it, off the card, until this cleared the residue.
      { yPercent: -100, y: 0 },
      { yPercent: 150, y: 0, duration: 1.5, ease: "power4.inOut" },
      0.05
    )
    .fromTo(sweep, { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0.05)
    .to(sweep, { opacity: 0, duration: 0.45 }, 1.15);

  // ── Copy reveal, scrubbed rather than triggered ─────────────────────
  // Every line sits inside an .offering-mask with overflow:hidden, so
  // translateY(100%) parks it completely out of view underneath the mask;
  // animating back to 0 makes it rise out from under the image edge.
  // Durations/staggers below are proportions of the scroll range, not
  // wall-clock seconds, because the timeline is scrubbed.
  var lines = section.querySelectorAll(".offering-mask > *");
  var chips = section.querySelectorAll(".offering-chip");
  var line = section.querySelector(".offering-line");

  var tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    scrollTrigger: {
      trigger: section,
      start: "top 70%",
      end: "top 5%",
      scrub: 1,
    },
  });

  tl.to(line, { scaleY: 1, duration: 0.8 }, 0);

  tl.to(
    lines,
    {
      y: "0%",
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.9,
      stagger: 0.09,
    },
    0.15
  );

  tl.to(
    chips,
    {
      y: 0,
      opacity: 1,
      duration: 0.6,
      stagger: 0.06,
    },
    ">-0.3"
  );
});
