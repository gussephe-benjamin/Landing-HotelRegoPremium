document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".location");
  if (!root || typeof ScrollTrigger === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Every pinned section above this one must be measured first, otherwise
  // these triggers land short by the pins' spacer heights and fire early.
  var PRIORITY = -3;

  gsap.from(".location-head > *", {
    y: 34,
    opacity: 0,
    filter: "blur(10px)",
    duration: 0.9,
    stagger: 0.12,
    ease: "power4.out",
    scrollTrigger: { trigger: root, start: "top 75%", refreshPriority: PRIORITY },
  });

  gsap.from(".location-map", {
    clipPath: "inset(0% 0% 100% 0%)",
    duration: 1.2,
    ease: "power4.inOut",
    scrollTrigger: { trigger: ".location-grid", start: "top 80%", refreshPriority: PRIORITY },
  });

  gsap.from(".location-card", {
    y: 60,
    opacity: 0,
    duration: 1,
    ease: "power4.out",
    scrollTrigger: { trigger: ".location-grid", start: "top 80%", refreshPriority: PRIORITY },
  });

  gsap.from(".location-item", {
    x: 22,
    opacity: 0,
    duration: 0.7,
    stagger: 0.09,
    ease: "power3.out",
    scrollTrigger: { trigger: ".location-card", start: "top 70%", refreshPriority: PRIORITY },
  });

  gsap.from(".location-near-item", {
    y: 26,
    opacity: 0,
    duration: 0.7,
    stagger: 0.08,
    ease: "power3.out",
    scrollTrigger: { trigger: ".location-near", start: "top 92%", refreshPriority: PRIORITY },
  });
});
