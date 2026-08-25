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
    // Walks the node tree instead of rebuilding innerHTML from textContent.
    // The old version read the heading as flat text, which was fine while it
    // was flat — the statement now marks its accented phrases with <em>, and
    // flattening would have thrown that markup away and taken the colour and
    // the drawn underline with it. Recursing wraps each word in place and
    // leaves whatever it is nested inside untouched.
    function wrapWords(node) {
      [].slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          // Captured, not stripped: splitting on the separator keeps the
          // original spacing, so words that sit either side of an <em>
          // boundary do not run together.
          child.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            var span = document.createElement("span");
            span.className = "reveal-word";
            span.textContent = part;
            frag.appendChild(span);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrapWords(child);
        }
      });
    }
    wrapWords(heading);

    var wordEls = heading.querySelectorAll(".reveal-word");
    var marks = heading.querySelectorAll("em");
    var cue = document.querySelector(".story-cue");

    if (reduced) {
      gsap.set(wordEls, { opacity: 1, filter: "none" });
      if (cue) gsap.set(cue, { opacity: 1 });
      return;
    }

    // Closed here rather than in the stylesheet, so the painted state stays
    // the default and the copy survives the script failing to run at all.
    // Set before the section is anywhere near the viewport, which is why it
    // does not need the transition suppressed — nothing is on screen to see
    // it snap shut.
    [].forEach.call(marks, function (m) {
      m.style.backgroundSize = "0% 0.86em";
    });

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

        // Each plate is timed off the first word it covers, so the marker
        // sweeps across a phrase that has just finished resolving rather than
        // several arriving together once the whole line has settled. Clearing
        // the inline value hands the element back to the stylesheet's painted
        // state, and the transition there does the sweep.
        [].forEach.call(marks, function (m) {
          var first = m.querySelector(".reveal-word");
          var i = first ? [].indexOf.call(wordEls, first) : 0;
          gsap.delayedCall(0.04 * i + 0.4, function () {
            m.style.backgroundSize = "";
          });
        });

        if (cue) {
          gsap.to(cue, {
            opacity: 1,
            duration: 0.9,
            delay: 0.04 * wordEls.length + 0.5,
            ease: "power2.out",
          });
        }
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
    window.REGO_MQ.DESKTOP_MOTION,
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
    // Who darkens this panel, and when — and on desktop the answer is nobody.
    //
    // The horizontal section's first stop is near-black, so this panel used to
    // fade to meet it and avoid a hard edge at the seam. Measured, that fade
    // finished 360px before the facade photograph fills the screen: the page
    // went dark while the picture meant to introduce the section was still
    // 333px wide. The order read backwards.
    //
    // On desktop there is nothing left to fade. The facade is full-bleed on
    // the very frame the pin opens — measured at exactly 1440x900 at 0,0 —
    // and this panel has scrolled entirely out of view by then, so the switch
    // from cream to the section's own night stop happens behind a photograph
    // covering every pixel. The panel simply stays light until it is gone, and
    // hscroll.css supplies the matching cream for the approach.
    //
    // Below the breakpoint, and under reduced motion, hscroll.js runs its
    // unpinned branch and builds no facade at all. Nothing covers that switch
    // there, so the panel does still have to walk to meet it — but the window
    // now ends where the section takes the screen instead of well before.
    var storyEl = document.querySelector(".story");
    var contours = document.querySelector(".story-contours");

    gsap.matchMedia().add(
      window.REGO_MQ.NOT_DESKTOP_MOTION,
      function () {
        var fade = { t: 0 };
        var tween = gsap.to(fade, {
          t: 1,
          ease: "none",
          scrollTrigger: {
            trigger: horizontal,
            start: "top 60%",
            end: "top top",
            scrub: true,
          },
          onUpdate: function () {
            // One proxy value written to each target in its own idiom. A plain
            // two-target backgroundColor tween was tried and killed the
            // section's colour ramp: it writes an inline background-color,
            // which outranks the var(--hs-bg) rule the ramp works through, and
            // the tween owns the property so clearing it does not hold.
            var c = gsap.utils.interpolate(lightColor, darkColor, fade.t);
            if (storyEl) storyEl.style.backgroundColor = c;
            horizontal.style.setProperty("--hs-bg", c);
            // The contour canvas paints its own opaque cream, so left alone it
            // would sit over the panel it is supposed to belong to and hold a
            // bright rectangle across the fade. Taken out on the same value,
            // it dissolves with the panel rather than in spite of it.
            if (contours) contours.style.opacity = String(1 - fade.t);
          },
        });

        return function cleanup() {
          tween.kill();
          if (storyEl) storyEl.style.backgroundColor = "";
          if (contours) contours.style.opacity = "";
          horizontal.style.removeProperty("--hs-bg");
        };
      }
    );
  }
});
