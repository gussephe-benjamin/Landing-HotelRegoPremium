/* Persistent corner wordmark — visibility and ink.

   Two things are decided here: whether the mark is on screen at all, and
   whether it is inked light or dark.

   The ink is driven by declared state, not by sampling what is behind it.
   Reading the actual pixels was the other option and it is not available:
   three of the sections this passes over are painted by a <video>, a
   cross-origin Google Maps <iframe> and a WebGL <canvas>, none of which can
   be read back — and doing it per frame would undo the scroll work the rest
   of this project spends its effort on. Declaring it costs one class toggle
   about six times across the whole page. */
document.addEventListener("DOMContentLoaded", function () {
  var mark = document.querySelector(".brandmark");
  if (!mark) return;

  // Two sources, and which one wins is decided by ownership, never by
  // truthiness. `hsInk` was originally consulted as `hsInk || base`, which is
  // wrong in a way that is easy to miss: "light" is a perfectly truthy
  // string, so the moment the horizontal section reported light ink it
  // masked `base` permanently — and hscroll.js calls setProgress once while
  // setting itself up, so that happened on page load and the mark never
  // inverted anywhere again.
  var base = "light"; // whatever ordinary section is under the mark
  var hsInk = null; // what the horizontal section last reported
  var hsOwns = false; // is that section the one under the mark right now

  function apply() {
    var ink = hsOwns && hsInk !== null ? hsInk : base;
    mark.classList.toggle("is-dark", ink === "dark");
  }

  window.regoMark = {
    setInk: function (ink) {
      if (ink === hsInk) return;
      hsInk = ink;
      if (hsOwns) apply();
    },
  };

  if (typeof ScrollTrigger === "undefined") {
    mark.classList.add("is-visible");
    return;
  }

  // ── Geometry, cached ─────────────────────────────────────────────────
  // Everything below is decided from the scroll position by arithmetic, so
  // these are measured once per refresh rather than per frame.
  //
  // The first version of this hung the ink off ScrollTrigger toggles — one
  // trigger per section, each flipping state as it came under the mark. That
  // works while the visitor scrolls, and fails the moment they do not: a jump
  // that clears a whole section never toggles it, so the state it was meant to
  // set never arrives. Loading the page and jumping straight to the closing
  // section left the mark inked dark on a near-black panel. Menu links, deep
  // links and a browser restoring a scroll position on reload all take that
  // path. A pure function of scrollY cannot be skipped over.
  var markMid = 0, markBottom = 0;
  var heroBottom = 0;
  var storyTop = 0, storyBottom = 0;
  var hsTop = 0, hsBottom = 0;

  var hero = document.querySelector(".hero-intro");
  var story = document.querySelector(".story");
  var hscroll = document.querySelector(".hscroll");

  function span(el) {
    if (!el) return [0, 0];
    // The pinned sections are laid out inside a spacer that owns their scroll
    // extent; the section's own box stops moving once pinned and would report
    // a range a fraction of the real one.
    var host =
      el.parentElement && el.parentElement.classList.contains("pin-spacer")
        ? el.parentElement
        : el;
    var r = host.getBoundingClientRect();
    var top = r.top + window.scrollY;
    return [top, top + r.height];
  }

  function measure() {
    var r = mark.getBoundingClientRect();
    markMid = r.top + r.height / 2;
    markBottom = r.bottom;
    if (hero) heroBottom = span(hero)[1];
    var st = span(story); storyTop = st[0]; storyBottom = st[1];
    var hz = span(hscroll); hsTop = hz[0]; hsBottom = hz[1];
  }

  // ── Ink ──────────────────────────────────────────────────────────────
  // Relative luminance, sRGB. 0.18 is the crossover: above it the dark ink
  // out-contrasts the light one against that background, below it the reverse.
  function inkFor(colour) {
    var m = colour && colour.match(/[\d.]+/g);
    if (!m) return "light";
    var f = function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    var lum = 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]);
    return lum > 0.18 ? "dark" : "light";
  }

  var lastStoryBg = "";
  var wasVisible = null;

  function update() {
    var mid = window.scrollY + markMid;

    // Held back until the hero's own logo has left the corner, so the two are
    // never on screen together.
    var visible = !hero || window.scrollY + markBottom >= heroBottom;
    if (visible !== wasVisible) {
      wasVisible = visible;
      mark.classList.toggle("is-visible", visible);
    }

    // The horizontal section reports its own ink because its background is not
    // one tone — it ramps from near-black to near-white mid-run. This decides
    // when that report is the one that counts.
    var owns = hscroll ? mid >= hsTop && mid <= hsBottom : false;
    if (owns !== hsOwns) hsOwns = owns;

    if (story && mid >= storyTop && mid <= storyBottom) {
      // Read rather than declared: .story is the page's one light section, but
      // only at its top — story.js fades the whole panel to near-black as the
      // horizontal section rises beneath it, and a static flag left the mark
      // dark-on-near-black across the last third of its travel.
      var c = getComputedStyle(story).backgroundColor;
      if (c !== lastStoryBg) {
        lastStoryBg = c;
        base = inkFor(c);
      }
    } else {
      lastStoryBg = "";
      base = "light";
    }

    apply();
  }

  ScrollTrigger.addEventListener("refresh", function () {
    measure();
    update();
  });

  // One trigger spanning the document, rather than one per section. Its only
  // job is to give `update` a scroll tick; every decision inside is made from
  // the position itself.
  ScrollTrigger.create({
    trigger: document.body,
    start: 0,
    end: "max",
    onUpdate: update,
  });

  measure();
  update();
});
