document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".reserve");
  if (!root) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Video: some browsers refuse the initial autoplay, so nudge it again on
  //    canplay and on load. Rejections are expected and ignored.
  var video = root.querySelector(".reserve-video");
  // Gated rather than fired immediately: the element carries `autoplay`, so
  // without this it decodes 1280x720 at 24fps from page load onward, through
  // every section above this one, whether or not any of it is near the
  // screen. The scroll trigger below owns this flag.
  var videoNearby = false;
  var play = function () {
    if (!video || !videoNearby) return;
    var p = video.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  };
  if (video) {
    video.addEventListener("canplay", play);
    window.addEventListener("load", play);
  }

  if (typeof ScrollTrigger === "undefined") {
    // No trigger to gate on, so fall back to the old always-on behaviour.
    root.classList.add("is-in");
    videoNearby = true;
    play();
    return;
  }

  // Every pinned section above must be measured first or these land short.
  var PRIORITY = -4;

  // A full viewport of lead in each direction, so playback is already running
  // before any frame of it is visible and only stops once the section is well
  // out of the way. Decoding is the same GPU work the scroll effects here are
  // competing for, which is what made this worth gating on a phone.
  if (video) {
    var videoST = ScrollTrigger.create({
      trigger: root,
      start: "top bottom+=100%",
      end: "bottom top-=100%",
      refreshPriority: PRIORITY,
      onToggle: function (self) {
        videoNearby = self.isActive;
        if (self.isActive) play();
        else video.pause();
      },
    });
    // onToggle does not fire for the state a trigger is born in.
    videoNearby = videoST.isActive;
    if (videoNearby) play();
    else video.pause();
  }

  // ── Page transition ─────────────────────────────────────────────────
  // The panel rises over the previous section, and that section is held
  // still: it gets a scrubbed counter-translation exactly equal to the
  // distance scrolled, so it reads as frozen underneath while this one
  // slides up. Transform-only, so nothing in the document flow shifts.
  if (!reduced) {
    var previous = document.querySelector(".location");
    if (previous) {
      // The section being slid away carries the two most expensive things on
      // the page to move: the info card's backdrop-filter, which re-samples
      // and re-blurs whatever sits behind it on every frame it travels, and
      // the live Google Maps iframe under a five-function filter chain, which
      // re-runs that chain just as often. Handing the whole section to the
      // compositor first means it is rasterised once and then only
      // translated. Nothing the card blurs lives outside .location — the
      // section paints its own opaque background — so making it a backdrop
      // root here does not change what the glass samples.
      //
      // Promotion is scoped to the hand-off rather than left on: a layer this
      // size is real texture memory, and it is only worth holding while the
      // thing is actually moving. The separate trigger starts earlier than
      // the tween so the layer exists before the first frame of movement
      // instead of being built during it.
      ScrollTrigger.create({
        trigger: root,
        // Just ahead of the tween's own "top bottom", not far ahead: promoting
        // swaps text from subpixel to greyscale antialiasing for as long as it
        // lasts, so the window is kept to the stretch where the section is
        // already travelling and fading and nobody can read it anyway.
        start: "top 110%",
        end: "top top",
        refreshPriority: PRIORITY,
        onToggle: function (self) {
          previous.classList.toggle("is-handoff", self.isActive);
        },
      });

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
