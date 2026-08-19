document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".kinetic");
  if (!root || typeof ScrollTrigger === "undefined") return;

  var typeEl = root.querySelector(".kinetic-type");
  var lines = [].slice.call(root.querySelectorAll(".kinetic-line"));
  var item = root.querySelector(".kinetic-item");
  if (!typeEl || !lines.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var lineOpacity =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kn-line-opacity")) || 0.05;

  // The demo's "in" transition, kept verbatim in shape: the type block scales
  // up and rotates a quarter turn while the lines sweep sideways and flash
  // from their resting opacity up to full and back out.
  var tl = gsap.timeline({ paused: true });

  tl.to(item, { duration: 0.8, ease: "power2.inOut", opacity: 0, scale: 0.92 }, 0)
    .to(typeEl, { duration: 1.4, ease: "power2.inOut", scale: 2.7, rotate: -90 }, 0.3)
    .to(
      lines,
      {
        keyframes: [
          { x: "20%", duration: 1, ease: "power1.inOut" },
          { x: "-200%", duration: 1.5, ease: "power1.in" },
        ],
        stagger: 0.04,
      },
      0.3
    )
    .to(
      lines,
      {
        keyframes: [
          { opacity: 1, duration: 1, ease: "power1.in" },
          { opacity: 0, duration: 1.5, ease: "power1.in" },
        ],
      },
      0.3
    );

  // The trail panel takes over the screen the type just vacated, so the
  // pinned section never sits empty.
  // The trail panel takes over the screen the type just vacated. It does not
  // simply cut in: it comes forward out of a blur, still slightly oversized,
  // as if the camera were pulling focus past the type that just swept off —
  // and its own contents are cued from the same instant (see footer-trail.js),
  // so the whole panel assembles in one continuous gesture.
  var stage = root.querySelector(".trail-stage");
  if (stage) {
    gsap.set(stage, { scale: 1.08, filter: "blur(18px)" });

    tl.add(function () {
      stage.classList.add("is-live");
      stage.dispatchEvent(new CustomEvent("trail:reveal"));
    }, "-=1.05")
      .to(stage, { opacity: 1, duration: 1.1, ease: "power2.out" }, "<")
      .to(
        stage,
        { scale: 1, filter: "blur(0px)", duration: 1.6, ease: "power3.out" },
        "<"
      );
  }

  gsap.set(lines, { opacity: lineOpacity });

  // A short pin, not a scrubbed one. It locks the section once it fills the
  // screen so the visitor actually arrives at it, holds still for the first
  // stretch, then lets the sequence play itself out. The pin is kept well
  // under one viewport: any longer and the screen sits empty after the type
  // has swept away, which is dead space before the trail panel below.
  var played = false;
  var PLAY_AT = 0.12;

  ScrollTrigger.create({
    trigger: root,
    start: "top top",
    end: function () {
      return "+=" + window.innerHeight * 1.35;
    },
    pin: true,
    // Lowest priority on the page: every pin above must be measured first.
    refreshPriority: -5,
    onUpdate: function (self) {
      if (!played && self.progress >= PLAY_AT) {
        played = true;
        tl.play();
      }
    },
  });
});
