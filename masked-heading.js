/* MaskedHeading — vanilla port of the React Bits component (JS-CSS variant).
   Same technique as the source: the word is laid out transparently to be
   measured, an SVG <clipPath> holds a matching <text>, and a media layer is
   clipped by it. fillScale / drift / parallax / brightness / saturation
   behave as in the original.

   Differences from the source, both deliberate:
   - It masks one word inside an existing heading instead of replacing the
     whole heading, so the neighbouring type keeps its own styling.
   - `textScale` is dropped. The source resizes the heading from its own
     width; here the font size belongs to the page's heading rule and must
     not be overwritten. */
(function () {
  var uid = 0;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function initMasked(el) {
    var opts = {
      src: el.dataset.mhSrc || "",
      mediaType: el.dataset.mhType || "image",
      poster: el.dataset.mhPoster || "",
      fillScale: parseFloat(el.dataset.mhFill || "1.25"),
      parallax: parseFloat(el.dataset.mhParallax || "26"),
      drift: parseFloat(el.dataset.mhDrift || "18"),
      brightness: parseFloat(el.dataset.mhBrightness || "1"),
      saturation: parseFloat(el.dataset.mhSaturation || "1"),
      grayscale: el.dataset.mhGrayscale === "true",
    };
    if (!opts.src) return;

    var word = el.textContent.trim();
    var clipId = "mh-" + ++uid;

    el.textContent = "";
    el.classList.add("mh");

    // measure layer
    var measure = document.createElement("span");
    measure.className = "mh__measure";
    var wordEl = document.createElement("span");
    wordEl.className = "mh__word";
    wordEl.appendChild(document.createTextNode(word));
    var baseEl = document.createElement("i");
    baseEl.className = "mh__baseline";
    wordEl.appendChild(baseEl);
    measure.appendChild(wordEl);
    el.appendChild(measure);

    // clip path
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "mh__defs");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var defs = document.createElementNS(NS, "defs");
    var clip = document.createElementNS(NS, "clipPath");
    clip.setAttribute("id", clipId);
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    var glyph = document.createElementNS(NS, "text");
    glyph.appendChild(document.createTextNode(word));
    clip.appendChild(glyph);
    defs.appendChild(clip);
    svg.appendChild(defs);
    el.appendChild(svg);

    // media layer
    var reveal = document.createElement("span");
    reveal.className = "mh__reveal";
    var clipBox = document.createElement("span");
    clipBox.className = "mh__clip";
    clipBox.style.clipPath = "url(#" + clipId + ")";
    clipBox.style.webkitClipPath = "url(#" + clipId + ")";
    var media = document.createElement("span");
    media.className = "mh__media";

    var source;
    if (opts.mediaType === "video") {
      source = document.createElement("video");
      source.autoplay = true;
      source.muted = true;
      source.loop = true;
      source.playsInline = true;
      if (opts.poster) source.poster = opts.poster;
    } else {
      source = document.createElement("img");
      source.alt = "";
      source.draggable = false;
    }
    source.className = "mh__source";
    source.src = opts.src;

    media.appendChild(source);
    clipBox.appendChild(media);
    reveal.appendChild(clipBox);
    el.appendChild(reveal);

    var off = { x: 0, y: 0, tx: 0, ty: 0 };

    function place() {
      var W = el.clientWidth;
      var H = el.clientHeight;
      var maxX = Math.max(0, ((opts.fillScale - 1) / 2) * W);
      var maxY = Math.max(0, ((opts.fillScale - 1) / 2) * H);
      media.style.transform =
        "translate3d(" +
        clamp(off.x, -maxX, maxX).toFixed(2) + "px, " +
        clamp(off.y, -maxY, maxY).toFixed(2) + "px, 0) scale(" +
        opts.fillScale + ")";
      media.style.filter =
        "brightness(" + opts.brightness + ") saturate(" + opts.saturation + ")" +
        (opts.grayscale ? " grayscale(1)" : "");
    }

    // Positions the SVG glyph over the measured word. Rects are used instead
    // of offsetLeft/offsetTop because this element is inline inside a larger
    // heading, so its offsetParent is not the element itself.
    function sync() {
      var rootRect = el.getBoundingClientRect();
      var wordRect = wordEl.getBoundingClientRect();
      var baseRect = baseEl.getBoundingClientRect();
      if (!rootRect.width) return;

      glyph.setAttribute("x", String(wordRect.left - rootRect.left));
      glyph.setAttribute("y", String(baseRect.top - rootRect.top));

      var cs = window.getComputedStyle(measure);
      glyph.style.fontFamily = cs.fontFamily;
      glyph.style.fontSize = cs.fontSize;
      glyph.style.fontWeight = cs.fontWeight;
      glyph.style.fontStyle = cs.fontStyle;
      glyph.style.letterSpacing = cs.letterSpacing;
      place();
    }

    sync();
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(sync).observe(el);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sync).catch(function () {});
    }
    window.addEventListener("resize", sync, { passive: true });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Slow autonomous drift, eased toward the pointer target.
    var last = performance.now();
    var clock = 0;
    (function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      var dx = Math.sin(clock * 0.21) * opts.drift;
      var dy = Math.cos(clock * 0.17) * opts.drift * 0.6;
      var ease = 1 - Math.exp(-dt / 0.18);
      off.x += (off.tx + dx - off.x) * ease;
      off.y += (off.ty + dy - off.y) * ease;

      place();
      requestAnimationFrame(frame);
    })(last);

    if (opts.parallax > 0) {
      // Tracked on the window: the word itself is a small target that keeps
      // sliding away, so pointer events on it alone would rarely fire.
      window.addEventListener(
        "pointermove",
        function (e) {
          var r = el.getBoundingClientRect();
          if (!r.width) return;
          var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
          var ny = ((e.clientY - r.top) / r.height) * 2 - 1;
          off.tx = clamp(nx, -1, 1) * -opts.parallax;
          off.ty = clamp(ny, -1, 1) * -opts.parallax;
        },
        { passive: true }
      );
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    [].slice.call(document.querySelectorAll("[data-mh-src]")).forEach(initMasked);
  });
})();
