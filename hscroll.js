/* (01) Los espacios — horizontal editorial.

   Uses the GSAP + ScrollTrigger already on the page (3.14.1); no new library
   is introduced. ScrollToPlugin is deliberately not used for the jump-to-beat
   controls — it is not loaded here, and native scrollTo with behavior:"smooth"
   does the same job without adding a dependency.

   Everything lives inside gsap.matchMedia(), which is what makes the pin
   disappear cleanly below 1024px and under prefers-reduced-motion: the
   context's cleanup function unwinds the triggers and the inline transforms
   instead of leaving a half-applied desktop layout behind. */
document.addEventListener("DOMContentLoaded", function () {
  var section = document.querySelector(".hscroll");
  if (!section || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  var track = section.querySelector(".hscroll__track");
  var bar = section.querySelector(".hscroll__bar span");
  var rail = section.querySelector(".hscroll__progress");
  var navButtons = [].slice.call(section.querySelectorAll(".hscroll__progress button"));
  if (!track) return;

  // ── Background ramp ──────────────────────────────────────────────────
  // The emotional arc of the section as colour: shut-in night at the start,
  // full daylight by the time the events hall and its call to action arrive.
  var STOPS = [
    { p: 0.0, bg: "#0e0e0f", fg: "#eae7e0" },
    { p: 0.3, bg: "#161311", fg: "#eae7e0" },
    { p: 0.62, bg: "#3b2a19", fg: "#f2e9dc" },
    { p: 1.0, bg: "#e9e4da", fg: "#1a1714" },
  ];

  // Perceptual space, not sRGB: a straight sRGB ramp from near-black to
  // near-white passes through muddy greys around the midpoint.
  var CAN_MIX =
    typeof CSS !== "undefined" &&
    CSS.supports &&
    CSS.supports("color", "color-mix(in oklab, #000 50%, #fff)");

  function lerpHex(a, b, t) {
    var pa = parseInt(a.slice(1), 16);
    var pb = parseInt(b.slice(1), 16);
    var out = 0;
    for (var shift = 16; shift >= 0; shift -= 8) {
      var ca = (pa >> shift) & 255;
      var cb = (pb >> shift) & 255;
      out |= Math.round(ca + (cb - ca) * t) << shift;
    }
    return "#" + ("000000" + (out >>> 0).toString(16)).slice(-6);
  }

  function blend(from, to, t) {
    if (CAN_MIX) return "color-mix(in oklab, " + to + " " + (t * 100).toFixed(2) + "%, " + from + ")";
    return lerpHex(from, to, t);
  }

  // Where the ink switches from light to dark. Measured, not guessed: across
  // the final segment the background climbs from luminance .027 to .78, and
  // .80 is the progress at which dark ink starts out-contrasting light ink
  // against it.
  var FG_FLIP = 0.79;

  var lastBg = "";
  var lastFg = "";

  function setProgress(p) {
    p = gsap.utils.clamp(0, 1, p);
    var i = 0;
    while (i < STOPS.length - 2 && p > STOPS[i + 1].p) i++;
    var a = STOPS[i];
    var b = STOPS[i + 1];
    var t = (p - a.p) / (b.p - a.p);

    // Guarded against rewriting the same string. --hs-bg and --hs-fg are
    // inherited custom properties read by nine rules across the section, so
    // touching either one invalidates the style of the whole subtree and
    // repaints it. On the stretches where the ramp is flat — most of the
    // first third — the computed colour does not actually change from frame
    // to frame, and this skips that work entirely rather than handing the
    // engine an identical value to re-resolve.
    var bg = blend(a.bg, b.bg, t);
    if (bg !== lastBg) {
      section.style.setProperty("--hs-bg", bg);
      lastBg = bg;
    }

    // The foreground is stepped across the last segment rather than
    // interpolated. Interpolating it — which is what the brief's table
    // implies — walks the ink from light to dark over the same stretch the
    // background walks from dark to light, so the two cross: measured at 75%
    // of the run the text was mid-grey on mid-brown at 2.03:1, effectively
    // invisible. Holding the ink light until the background has committed to
    // being light, then switching it outright, keeps the worst case at the
    // best value these two endpoints allow.
    var fg = i === 2 ? (p < FG_FLIP ? a.fg : b.fg) : blend(a.fg, b.fg, t);
    if (fg !== lastFg) {
      section.style.setProperty("--hs-fg", fg);
      lastFg = fg;
    }
  }

  // ── Shared reveals ───────────────────────────────────────────────────
  // makeTrigger is the only thing that differs between the horizontal run
  // (which needs containerAnimation) and the stacked layout (a normal vertical
  // trigger), so the two layouts cannot drift apart visually.
  function buildReveals(makeTrigger, reduced) {
    if (reduced) {
      // No wipes, no counter-scale: a short fade is the whole vocabulary.
      gsap.utils
        .toArray(section.querySelectorAll(".hs-photo, .beat__subtitle, .hs-card"))
        .forEach(function (el) {
          gsap.fromTo(el, { opacity: 0 }, {
            opacity: 1,
            duration: 0.2,
            ease: "none",
            scrollTrigger: makeTrigger(el),
          });
        });
      return;
    }

    gsap.utils.toArray(section.querySelectorAll(".hs-photo")).forEach(function (fig) {
      var pic = fig.querySelector("picture");
      var img = fig.querySelector("img");
      var label = fig.querySelector(".hs-label");
      if (!pic || !img) return;

      // Curtain: the mask opens while the photograph inside counter-scales
      // down. It is the opposition between the two that reads as something
      // being uncovered; without it the frame merely fades in.
      gsap.set(pic, { clipPath: "inset(100% 0 0 0)" });
      gsap.set(img, { scale: 1.12 });

      var tl = gsap.timeline({ scrollTrigger: makeTrigger(fig) });
      tl.to(pic, { clipPath: "inset(0% 0 0 0)", duration: 0.9, ease: "expo.out" }, 0)
        .to(img, { scale: 1, duration: 0.9, ease: "expo.out" }, 0);

      if (label) {
        gsap.set(label, { y: 10, opacity: 0 });
        tl.to(label, { y: 0, opacity: 0.6, duration: 0.5 }, 0.18);
      }
    });

    gsap.utils.toArray(section.querySelectorAll(".beat__backdrop")).forEach(function (el) {
      gsap.fromTo(el, { yPercent: 110 }, {
        yPercent: 0,
        duration: 0.8,
        ease: "power4.out",
        scrollTrigger: makeTrigger(el),
      });
    });

    gsap.utils.toArray(section.querySelectorAll(".beat__subtitle")).forEach(function (el) {
      var mark = el.querySelector(".mark");
      var rule = el.querySelector(".beat__rule");
      var tl = gsap.timeline({ scrollTrigger: makeTrigger(el) });

      tl.fromTo(el, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0);

      if (mark) {
        // The plate lives on a pseudo-element, which GSAP cannot target, so
        // the wipe is driven through a custom property the pseudo-element
        // reads. Animating the variable keeps it reversible and scrubbable —
        // a class toggle with a CSS transition would not be either.
        tl.fromTo(mark,
          { "--hs-mark": "100%" },
          { "--hs-mark": "0%", duration: 0.6, ease: "power2.inOut" },
          0.3
        );
      }
      if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, 0.45);
    });

    gsap.utils.toArray(section.querySelectorAll(".hs-tick")).forEach(function (el) {
      gsap.fromTo(el, { scaleX: 0 }, {
        scaleX: 1,
        duration: 0.5,
        ease: "power2.out",
        scrollTrigger: makeTrigger(el),
      });
    });

    gsap.utils.toArray(section.querySelectorAll(".hs-card")).forEach(function (el) {
      // Trails the photograph beside it, so the eye lands on the space before
      // it lands on the ask.
      gsap.fromTo(el, { y: 24, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.7,
        delay: 0.15,
        ease: "power3.out",
        scrollTrigger: makeTrigger(el),
      });
    });

    var stroke = section.querySelector(".hs-stroke path");
    if (stroke && stroke.getTotalLength) {
      var len = stroke.getTotalLength();
      gsap.set(stroke, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(stroke, {
        strokeDashoffset: 0,
        duration: 1.2,
        ease: "power2.inOut",
        scrollTrigger: makeTrigger(stroke.closest(".hs-photo")),
      });
    }
  }

  var mm = gsap.matchMedia();

  // ── Desktop: pinned horizontal run ───────────────────────────────────
  mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", function () {
    // A function, not a captured number: resolving this once at load leaves
    // the section broken after a resize, or once the display serif lands and
    // changes the width of the 13vw backdrop.
    // Measured off the track's own layout box, not scrollWidth. scrollWidth
    // includes scrollable overflow, and the outline backdrops are both very
    // wide and pushed sideways by their own parallax — so it grew as the
    // section was scrolled, and read 7200 near the start against 9217 further
    // in. Travel distance, pin length and the 1:1 gesture ratio are all
    // derived from this, so an unstable measurement moves the end of the pin
    // underneath the visitor. offsetWidth comes from layout and ignores both
    // the overflow and the transforms.
    // Memoised. offsetWidth is a layout-forcing read, and drive() called this
    // first thing on every scroll frame — after it had just written sixteen
    // transforms. Reading layout straight after writing style is what forces
    // the engine to flush a synchronous layout mid-frame, and doing it once
    // per frame for the whole pinned run is most of what made this section
    // feel unsteady. The value only changes when the track is re-laid out, so
    // it is computed on refresh and read from cache in between.
    var distanceCache = -1;
    var distance = function () {
      if (distanceCache < 0) distanceCache = Math.max(0, track.offsetWidth - window.innerWidth);
      return distanceCache;
    };

    // Prepared once, not re-derived every frame.
    //
    // These two lists used to be plain element arrays, and drive() below read
    // data-speed / data-drift off the DOM with getAttribute + parseFloat and
    // called gsap.set() once per element, on every scroll frame. With fourteen
    // layers that is fourteen attribute reads, fourteen string parses and
    // fourteen full gsap.set() calls per frame — and gsap.set() re-resolves
    // its target and re-reads the element's current transform each time it is
    // called, which is exactly the work quickSetter exists to hoist out of the
    // loop. The ratio is fixed at setup and the setter is built once, so the
    // per-frame cost drops to one cached function call and one transform
    // write per layer.
    function prepare(selector, attribute, fallback) {
      return [].slice.call(section.querySelectorAll(selector)).map(function (el) {
        var raw = parseFloat(el.getAttribute(attribute));
        return {
          el: el,
          k: isNaN(raw) ? fallback : raw,
          set: gsap.quickSetter(el, "x", "px"),
        };
      });
    }

    var layers = prepare("[data-speed]", "data-speed", 1);
    var drifters = prepare("[data-drift]", "data-drift", 0);
    var beats = [].slice.call(section.querySelectorAll("[data-beat]"));
    var topo = section.querySelector(".hscroll__topo");
    var setTopo = topo ? gsap.quickSetter(topo, "x", "px") : null;
    var setBar = bar ? gsap.quickSetter(bar, "scaleX") : null;

    // ── The facade's flight ────────────────────────────────────────────
    // The marquee above hands over a detached, fixed-position copy of its
    // facade photograph (window.regoFacade, set up in story.js). It arrives
    // here still sitting at its strip position; this pin is what carries it
    // to full screen and then off again.
    //
    // It runs inside this pin rather than in one of its own. An earlier cut
    // gave the marquee its own prelude pin, which broke twice: .story-marquee
    // is only 50svh tall, so pinning it left half the screen empty with the
    // intro heading stranded in it, and ending that pin before this section
    // began meant the facade had to be faded out and the horizontal run then
    // started over from nothing — two pinned acts with a seam between them.
    // Folding it in makes it one continuous move: the picture fills the
    // screen, and carrying on scrolling slides it away into the run.
    var flip = null;
    var facade = null;
    var HAS_FLIP = typeof Flip !== "undefined" && !!window.regoFacade;

    // The picture leaves at exactly the track's own speed. With .beat--lead
    // sized at one screen, that puts its right edge on the strip's right edge
    // and the next beat's left edge against it — it behaves like a beat of
    // the track rather than an overlay sliding across one, so there is
    // neither a seam nor a gap between them.
    var EXIT_RATE = 1;

    function buildFlip() {
      if (!HAS_FLIP || flip) return;
      window.regoFacade.ensure();
      var node = window.regoFacade.node();
      if (!node) return;
      facade = node;
      var state = Flip.getState(facade);
      gsap.set(facade, {
        position: "fixed",
        left: 0,
        top: 0,
        width: "100%",
        height: "100svh",
        transform: "rotate(0deg)",
        transformOrigin: "center center",
      });
      flip = Flip.from(state, { duration: 1, ease: "none", paused: true });
    }

    function driveFacade(travelled) {
      if (!flip) return;
      // Growth is finished before this ever runs — see the approach trigger
      // below — so inside the pin there is nothing left to do but carry the
      // finished picture away.
      flip.progress(1);
      if (facade) gsap.set(facade, { x: -travelled * EXIT_RATE });
    }

    function releaseFlip() {
      if (flip) {
        // Wound back before killing, so the photograph returns to its strip
        // footprint. Killing it mid-flight would leave a full-screen fixed
        // image sitting over the page.
        flip.progress(0);
        flip.kill();
        flip = null;
      }
      if (window.regoFacade) window.regoFacade.reset();
      facade = null;
    }

    // Thresholds, not elements. Reading b.offsetLeft inside the per-frame loop
    // meant one forced layout per beat per frame — three more synchronous
    // flushes on top of the one distance() was causing, and again immediately
    // after a batch of transform writes. The trip point for each beat only
    // moves when the track is re-laid out, so it is measured on refresh.
    var anchors = new WeakMap();
    var railAlpha = -1;

    var navPoints = [];
    function measureNav() {
      navPoints = beats.map(function (b) {
        return {
          slug: b.getAttribute("data-beat"),
          // A beat becomes current once its left edge passes the middle of
          // the viewport, so the label flips when the block actually reads as
          // the one being looked at.
          at: b.offsetLeft - window.innerWidth * 0.5,
        };
      });
    }

    var navSlug = null;
    function updateNav(x) {
      // Defaults to the first block rather than to nothing. The lead and
      // intro beats are not one of the three, so strictly nothing is current
      // there — but an empty rail through the opening reads as a control that
      // has stopped working, when what it means is "on the way to Hospedaje".
      var activeSlug = navPoints.length ? navPoints[0].slug : null;
      for (var i = 0; i < navPoints.length; i++) {
        if (navPoints[i].at <= x) activeSlug = navPoints[i].slug;
      }
      // The rail only changes three times across the whole run; without this
      // guard it was rewriting the same attribute on every button on every
      // frame, and an attribute write invalidates the element's style whether
      // or not the value differs.
      if (activeSlug === navSlug) return;
      navSlug = activeSlug;
      navButtons.forEach(function (btn) {
        if (btn.getAttribute("data-goto") === activeSlug) btn.setAttribute("aria-current", "true");
        else btn.removeAttribute("aria-current");
      });
    }

    // Everything above that was measured off layout is invalidated here, in
    // one place, on the event that can actually change it. anchors was already
    // a lazy cache but had no invalidation at all, so a window resize inside
    // the desktop range left every parallax layer anchored to the old
    // geometry — latent before this change, load-bearing now that the other
    // two caches sit beside it.
    function remeasure() {
      distanceCache = -1;
      anchors = new WeakMap();
      measureNav();
    }
    ScrollTrigger.addEventListener("refresh", remeasure);
    // ScrollTrigger fires a refresh of its own during setup, but the triggers
    // below are built after this point and drive() can run before that first
    // refresh lands, so the thresholds are measured once here as well.
    measureNav();

    // Parallax measured from the moment a layer's own beat is centred on
    // screen, not from the start of the track.
    //
    // Reading it from the start made the offset cumulative: the outline
    // titles carry a 0.4 differential, so by the end of the run they had
    // drifted 2650px to the right of where they were laid out — which is why
    // HOSPEDAJE was still on screen through the restaurant block and
    // RESTAURANTE through the salon. The photographs drifted the same way,
    // just less far. Anchoring to the beat's own centre keeps every offset
    // bounded and symmetric: zero when the block is centred, equal and
    // opposite at either edge of its pass, and never accumulating across
    // blocks.
    function localTravel(el, x) {
      var a = anchors.get(el);
      if (!a) {
        var beat = el.closest(".beat");
        a = beat
          ? {
              centre: beat.offsetLeft + beat.offsetWidth / 2 - window.innerWidth / 2,
              // Half the span over which the block is anywhere on screen: from
              // its left edge entering on the right to its right edge leaving
              // on the left.
              half: (beat.offsetWidth + window.innerWidth) / 2,
            }
          : { centre: 0, half: 0 };
        anchors.set(el, a);
      }
      // Clamped, not just centred. Centring alone still let the figure grow
      // without limit while the block sat off screen — Salón's title was
      // carrying a 1095px offset before its own block had arrived, which put
      // the word inside the restaurant block instead. Past the edges of its
      // own pass a layer has nothing left to parallax against, so the offset
      // holds.
      return gsap.utils.clamp(-a.half, a.half, x - a.centre);
    }

    // Parallax, marquee drift and chrome all driven off one progress value so
    // they cannot desynchronise from the track.
    function drive(p) {
      var d = distance();
      var x = p * d;
      // The pin opens on a finished cover image, so travel through it is the
      // run, plainly. Nothing here can report progress through content the
      // visitor has not been shown, because the growth happened before this
      // trigger existed.
      var run = d > 0 ? gsap.utils.clamp(0, 1, x / d) : 0;
      layers.forEach(function (l) {
        l.set(-localTravel(l.el, x) * (l.k - 1));
      });
      drifters.forEach(function (l) {
        l.set(localTravel(l.el, x) * l.k);
      });
      driveFacade(x);
      // Deepest layer in the stack.
      if (setTopo) setTopo(-x * 0.3);
      if (setBar) setBar(run);
      // Faded in against travel rather than by a CSS transition. The rail is
      // driven from scroll position, and a time-based transition on a
      // scroll-driven property does not reliably settle — same trap the
      // background ramp fell into. This way it is deterministic in both
      // directions and reverses cleanly when scrolling back up.
      if (rail) {
        // Reaches 1 within a quarter of a screen and stays there for the rest
        // of the run, so the guard skips the overwhelming majority of frames.
        // autoAlpha writes both opacity and visibility, so an unguarded write
        // is two style mutations a frame for a value that is not changing.
        var alpha = gsap.utils.clamp(0, 1, x / (window.innerWidth * 0.25));
        if (alpha !== railAlpha) {
          railAlpha = alpha;
          gsap.set(rail, { autoAlpha: alpha });
        }
      }
      updateNav(x);
      return run;
    }

    // ── Growth, on the approach ────────────────────────────────────────
    // Runs from the moment the section starts entering to the moment its top
    // reaches the top of the screen — so it is finished exactly when the pin
    // opens, and the first thing further scrolling does is move a completed
    // picture rather than continue assembling one.
    //
    // It used to run inside the pin, which read wrong twice over: the
    // photograph detached from the strip and then sat frozen through the
    // whole approach before anything happened to it, and the horizontal
    // section was already showing behind it while it was still growing.
    var bg = section.querySelector(".hscroll__bg");

    // Anchored to the marquee, not to this section. Two reasons: this section
    // is pinned, and a trigger measuring a pinned element reads against the
    // pin-spacer rather than the element, which put the window 344px off; and
    // the strip's own top edge is where story.js detaches the photograph, so
    // starting here means growth begins on the very frame it leaves the strip
    // instead of after a stretch of it hanging frozen in mid-air. The strip's
    // bottom edge is this section's top edge, so it ends exactly as the pin
    // opens.
    var growth = ScrollTrigger.create({
      trigger: ".story-marquee",
      start: "top top",
      end: "bottom top",
      invalidateOnRefresh: true,
      onEnter: buildFlip,
      onEnterBack: buildFlip,
      onLeaveBack: releaseFlip,
      onUpdate: function (self) {
        if (flip) flip.progress(self.progress);
      },
    });

    var tween = gsap.to(track, {
      x: function () { return -distance(); },
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: function () { return "+=" + distance(); },
        pin: true,
        // One second of smoothing. Raw `true` reads as jitter on a trackpad.
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: function () { anchors = new WeakMap(); },
        onEnter: function () {
          buildFlip();
          if (bg) gsap.set(bg, { autoAlpha: 1 });
        },
        onEnterBack: function () {
          buildFlip();
          if (bg) gsap.set(bg, { autoAlpha: 1 });
        },
        onLeaveBack: function () {
          if (bg) gsap.set(bg, { autoAlpha: 0 });
        },
        onUpdate: function (self) {
          setProgress(drive(self.progress));
        },
      },
    });

    // Reveals are attached here rather than in a second matchMedia block so
    // they hold a direct reference to this tween — looking it back up by
    // target would depend on block execution order.
    buildReveals(function (el) {
      return {
        trigger: el,
        containerAnimation: tween,
        start: "left 88%",
        toggleActions: "play none none reverse",
      };
    }, false);

    // The marquee lines also loop on their own so they stay alive when the
    // scroll is still. The loop animates xPercent while drive() animates x —
    // different properties, so they compose instead of fighting.
    var loops = drifters.map(function (el, i) {
      return gsap.to(el, {
        xPercent: -50,
        repeat: -1,
        ease: "none",
        duration: i === 0 ? 30 : 38,
      });
    });

    // ── Beat navigation ────────────────────────────────────────────────
    function scrollYForBeat(beatEl) {
      var st = tween.scrollTrigger;
      var d = distance();
      if (!st) return 0;
      if (d <= 0) return st.start;
      var frac = gsap.utils.clamp(0, 1, beatEl.offsetLeft / d);
      return st.start + frac * (st.end - st.start);
    }

    function onNavClick() {
      var target = section.querySelector('[data-beat="' + this.getAttribute("data-goto") + '"]');
      if (target) window.scrollTo({ top: scrollYForBeat(target), behavior: "smooth" });
    }
    navButtons.forEach(function (b) { b.addEventListener("click", onNavClick); });

    // Tabbing into a pinned horizontal container otherwise moves focus to
    // elements parked off-screen: the page looks frozen while the caret sits
    // somewhere the user cannot see. This drags the owning beat into view.
    var focusables = [].slice.call(
      section.querySelectorAll(".hscroll__track a, .hscroll__track button")
    );
    function onFocus(e) {
      var beat = e.target.closest("[data-beat]");
      if (!beat) return;
      var rect = e.target.getBoundingClientRect();
      // Already comfortably on screen — do not yank the page.
      if (rect.left > 0 && rect.right < window.innerWidth) return;
      window.scrollTo({ top: scrollYForBeat(beat), behavior: "smooth" });
    }
    focusables.forEach(function (el) { el.addEventListener("focus", onFocus); });

    // Hidden until the pin opens; the approach belongs to the marquee above
    // and to the picture in flight, not to this section's own field.
    if (bg) gsap.set(bg, { autoAlpha: 0 });
    // Pairs with left:50% in the stylesheet. Set as a GSAP transform rather
    // than in CSS so it composes with the x the parallax writes each frame —
    // a CSS translateX(-50%) would simply be overwritten.
    gsap.set(section.querySelectorAll(".beat__backdrop"), { xPercent: -50 });

    setProgress(drive(0));

    return function cleanup() {
      // Removed with the rest of the context. gsap.matchMedia unwinds the
      // triggers it created here, but a listener added straight to
      // ScrollTrigger is not its to clean up — left behind, every crossing of
      // the 1024px breakpoint would stack another remeasure() onto every
      // future refresh, each one closing over dead elements.
      ScrollTrigger.removeEventListener("refresh", remeasure);
      railAlpha = -1;
      growth.kill();
      releaseFlip();
      if (bg) gsap.set(bg, { clearProps: "opacity,visibility" });
      if (rail) gsap.set(rail, { clearProps: "opacity,visibility" });
      if (window.regoFacade) window.regoFacade.release();
      loops.forEach(function (l) { l.kill(); });
      focusables.forEach(function (el) { el.removeEventListener("focus", onFocus); });
      navButtons.forEach(function (b) {
        b.removeEventListener("click", onNavClick);
        b.removeAttribute("aria-current");
      });
      if (topo) gsap.set(topo, { clearProps: "transform" });
      gsap.set(layers.concat(drifters), { clearProps: "transform" });
    };
  });

  // ── Stacked layout: small screens and reduced motion ─────────────────
  mm.add("(max-width: 1023px), (prefers-reduced-motion: reduce)", function () {
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    buildReveals(function (el) {
      return {
        trigger: el,
        start: "top 88%",
        toggleActions: reduced ? "play none none none" : "play none none reverse",
      };
    }, reduced);

    // The colour ramp survives; it is just driven by the section's own
    // vertical travel instead of by the track.
    var st = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: function (self) {
        setProgress(self.progress);
        if (bar) gsap.set(bar, { scaleX: self.progress });
      },
    });

    function onNavClick() {
      var target = section.querySelector('[data-beat="' + this.getAttribute("data-goto") + '"]');
      if (target) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - 24,
          behavior: reduced ? "auto" : "smooth",
        });
      }
    }
    navButtons.forEach(function (b) { b.addEventListener("click", onNavClick); });

    setProgress(0);

    return function cleanup() {
      st.kill();
      navButtons.forEach(function (b) { b.removeEventListener("click", onNavClick); });
    };
  });

  // ── Measurement hygiene ──────────────────────────────────────────────
  // The 13vw outline backdrop changes width when the display serif finally
  // lands, which changes track.scrollWidth, which changes the length of the
  // pin — and therefore the start of every trigger below it on the page.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  // Anchor jumps and in-page search can land inside a pinned section; without
  // a refresh the pin can be left measuring against a stale document height.
  window.addEventListener("hashchange", function () { ScrollTrigger.refresh(); });
});
