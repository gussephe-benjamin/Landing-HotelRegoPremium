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
  // story.css drives this from a view() timeline wherever the engine has
  // one — on the compositor, so it cannot trail the scroll. This is the
  // fallback, gated on the same condition as the @supports block there so
  // only one of the two can ever be writing that transform.
  if (!CSS.supports || !CSS.supports("animation-timeline: view()")) {
    ScrollTrigger.create({
      trigger: ".story-marquee",
      start: "top bottom",
      end: "top top",
      scrub: true,
      onUpdate: function (self) {
        gsap.set(".story-marquee-images", { x: -75 + self.progress * 25 + "%" });
      },
    });
  }

  // ── The tagged marquee image is cloned into a fixed-position copy, so it
  //    can leave the tilted strip and later Flip to fullscreen ───────────
  var clone = null;
  var cloneActive = false;

  // Kept so the placement can be re-applied exactly. Unwinding the Flip and
  // killing it gets the size back but not reliably the position, which left
  // the photograph snapped to the left edge for the stretch between the
  // horizontal section and the marquee when scrolling back up.
  var clonePlacement = null;

  function createClone() {
    if (cloneActive) return;
    var original = document.querySelector(".story-marquee-img.story-pin img");
    var rect = original.getBoundingClientRect();

    clone = original.cloneNode(true);
    clonePlacement = {
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
    };
    gsap.set(clone, clonePlacement);

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

  // Shared with hscroll.js, which owns the flight from here into the pinned
  // horizontal section. The clone is created here because it is this strip's
  // own photograph, detached; what happens to it afterwards belongs to the
  // section it flies into.
  window.regoFacade = {
    ensure: createClone,
    release: removeClone,
    node: function () { return cloneActive ? clone : null; },
    // Puts the photograph back in the strip exactly where it was detached.
    reset: function () {
      if (cloneActive && clone && clonePlacement) gsap.set(clone, clonePlacement);
    },
  };

  // Only worth detaching where it actually flies. Below the horizontal
  // breakpoint, and under reduced motion, hscroll.js never builds the Flip —
  // a clone created there would be a fixed-position photograph pinned over
  // the page with nothing left to move it.
  gsap.matchMedia().add(
    "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    function () {
      var st = ScrollTrigger.create({
        trigger: ".story-marquee",
        start: "top top",
        onEnter: createClone,
        onEnterBack: createClone,
        onLeaveBack: removeClone,
      });
      return function () {
        st.kill();
        removeClone();
      };
    }
  );

  // The light panel darkens as the near-black horizontal section rises under
  // it, so that hand-off is a fade rather than a cut. This used to hang off
  // the prelude's own pin; with the prelude folded into .hscroll it is driven
  // by that section's approach instead.
  var horizontal = document.querySelector(".hscroll");
  if (horizontal) {
    gsap.fromTo(
      ".story",
      { backgroundColor: lightColor },
      {
        backgroundColor: darkColor,
        ease: "none",
        scrollTrigger: {
          trigger: horizontal,
          start: "top bottom",
          end: "top 40%",
          scrub: true,
        },
      }
    );
  }
});
