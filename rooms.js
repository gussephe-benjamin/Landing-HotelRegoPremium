/* WebGL rooms slider, adapted from the shader pack.
   Removed from the original: the full-screen loading takeover, the fixed
   .frame chrome and the custom cursors — all three assumed they owned the
   whole page, which they don't here. Splitting.js was replaced by a local
   character splitter so the page keeps a single set of dependencies. */
/* ── Room model ───────────────────────────────────────────────────────
   images[0] is the main photo — the WebGL texture, and the only one that
   exists below 1100px. images[1] is the small upper portrait, images[2] the
   medium lower landscape. Order here must match the .rooms-slide order in the
   markup.

   All three rooms now use their real photography (room-2*.jpg, room-3*.jpg,
   room-4*.jpg). */
var ROOMS = [
  {
    slug: "estudios",
    images: [
      // ?v=2 forces a re-fetch on browsers that already cached these three
      // under their old filenames — the files changed but the URLs didn't.
      { src: "./img/room-2.jpg?v=2", alt: "Dormitorio de la Suite Estudio con clóset y aire acondicionado" },
      { src: "./img/room-2-b.jpg?v=2", alt: "Baño de la Suite Estudio con ducha de vidrio" },
      { src: "./img/room-2-c.jpg?v=2", alt: "Kitchenette de la Suite Estudio con barra desayunadora" },
    ],
  },
  {
    slug: "minidepartamentos",
    images: [
      // ?v=2: same cache-name collision as room-2* above — these three keep
      // the original filenames, so a browser that already fetched them once
      // needs the query bumped to notice the bytes changed.
      { src: "./img/room-3.jpg?v=2", alt: "Dormitorio del Minidepartamento con balcón y vista a la ciudad" },
      { src: "./img/room-3-b.jpg?v=2", alt: "Baño del Minidepartamento con ducha de vidrio templado" },
      { src: "./img/room-3-c.jpg?v=2", alt: "Dormitorio del Minidepartamento con acceso directo a la cocina" },
    ],
  },
  {
    slug: "departamentos",
    images: [
      // ?v=2: same cache-name collision as room-2*/room-3* above.
      { src: "./img/room-4.jpg?v=2", alt: "Dormitorio del Departamento en el último piso con vista a la ciudad" },
      { src: "./img/room-4-b.jpg?v=2", alt: "Sala y comedor del Departamento con balcón" },
      { src: "./img/room-4-c.jpg?v=2", alt: "Terraza privada del Departamento con vista a Bagua Grande y los cerros" },
    ],
  },
];

/* Secondary frames only exist at and above this width. Matches the section's
   own layout breakpoint — below it the copy panel drops under the photo and
   there is no left column to put them in. */
var ROOMS_DESKTOP = window.REGO_MQ.DESKTOP;

document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".rooms");
  if (!root || typeof THREE === "undefined") return;

  var mediaEl = root.querySelector(".rooms-media");
  var asideEl = root.querySelector(".rooms-aside");
  var slideEls = [].slice.call(root.querySelectorAll(".rooms-slide"));
  if (!mediaEl || !slideEls.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── helpers ────────────────────────────────────────────────────────
  function splitChars(el) {
    var text = el.textContent.trim();
    el.textContent = "";
    var chars = [];
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.className = "char";
      s.textContent = text[i] === " " ? " " : text[i];
      el.appendChild(s);
      chars.push(s);
    }
    return chars;
  }

  // Measures the rendered text on a canvas to break a paragraph into the
  // same lines the browser produced, then wraps each in an overflow-hidden
  // span so it can be masked.
  function splitLines(el) {
    var styles = getComputedStyle(el);
    // A zero here means layout has not settled; falling back to the parent
    // (or a sane default) avoids splitting every single word onto its own line.
    var maxWidth =
      el.getBoundingClientRect().width ||
      (el.parentElement && el.parentElement.getBoundingClientRect().width) ||
      360;
    var words = el.textContent.trim().split(/\s+/);
    var ctx = document.createElement("canvas").getContext("2d");
    ctx.font = styles["font-weight"] + " " + styles["font-size"] + " " + styles["font-family"];

    var lines = [];
    var current = [];
    for (var i = 0; i < words.length; i++) {
      current.push(words[i]);
      if (ctx.measureText(current.join(" ")).width >= maxWidth) {
        var cached = current.pop();
        lines.push(current.join(" "));
        current = [cached];
      }
    }
    lines.push(current.join(" "));

    el.innerHTML = "";
    var inners = [];
    lines.forEach(function (text) {
      var line = document.createElement("span");
      var inner = document.createElement("span");
      line.className = "line";
      line.style.display = "block";
      inner.style.display = "block";
      inner.textContent = text;
      line.appendChild(inner);
      el.appendChild(line);
      inners.push(inner);
    });
    return inners;
  }

  // ── Engine choice ──────────────────────────────────────────────────
  // The shader runs on desktop only. On a phone it costs more than it is
  // worth and actively misbehaves: the canvas is viewport-fixed and re-reads
  // the element's live rect every frame, but a phone scrolls on the
  // compositor, which runs ahead of that read — so the photograph visibly
  // shakes against the page in both directions. It is also the heaviest thing
  // in the section on a low-end device, and what it buys is a pointer-driven
  // ripple on a machine with no pointer. Below the breakpoint a plain <img>
  // is used instead: it scrolls with the page because it *is* the page.
  // One test for everything in this section that is expensive enough to cost
  // frames on a phone: the shader, the scrubbed cover effect on the section
  // above, and the scrubbed box-shadow.
  var RICH = window.matchMedia(window.REGO_MQ.GPU).matches && !reduced;
  var USE_GL = RICH;

  // ── WebGL stage ────────────────────────────────────────────────────
  var vertexShader = document.getElementById("roomsVertexShader").textContent;
  var fragmentShader = document.getElementById("roomsFragmentShader").textContent;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 50;

  // Null on phones. Everything downstream guards on it, so no context is
  // created and no shader is ever compiled there.
  var renderer = null;
  if (USE_GL) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "rooms-gl";
    // Mounted inside the frame it paints, not over the whole viewport.
    //
    // It used to be a viewport-sized, position:fixed canvas that re-read the
    // element's live rect on every frame to keep the plane glued to it. That
    // works only while scrolling is synchronous with rendering: Safari (and
    // every phone) scrolls on the compositor, which runs ahead of that read,
    // so the photograph lagged the page by a frame and visibly shook — and a
    // full-screen composited layer taxed the scrolling of the sections around
    // it as well, which is why the brand-values block stuttered too.
    //
    // Sized to the element and living inside it, the canvas simply scrolls
    // with the document like any other box. There is nothing left to keep in
    // sync per frame.
    mediaEl.appendChild(renderer.domElement);
    // The stylesheet hides the flat photograph while the canvas is painting.
    root.classList.add("rooms--gl");
  }

  // ── Flat photograph, used wherever the shader is not ────────────────
  var flatImg = null;
  if (!USE_GL) {
    flatImg = document.createElement("img");
    flatImg.className = "rooms-flat";
    flatImg.decoding = "async";
    mediaEl.appendChild(flatImg);
  }

  function updateFlatImage(index) {
    if (!flatImg || !ROOMS[index]) return;
    var data = ROOMS[index].images[0];
    if (flatImg.getAttribute("src") === data.src) return;
    flatImg.src = data.src;
    flatImg.alt = data.alt;
  }

  var clock = new THREE.Clock();

  var pointer = new THREE.Vector2();
  var mouseOver = false;
  var mouseDown = false;
  window.addEventListener("mousemove", function (e) {
    // Normalised against the frame rather than the viewport: the canvas is no
    // longer full-screen, so window coordinates would put the ripple
    // somewhere else entirely. Only measured while the pointer is actually
    // over the frame, so this stays off the path of ordinary mouse movement.
    if (!mouseOver) return;
    var r = mediaEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  });

  var geometry = new THREE.PlaneBufferGeometry(1, 1, 32, 32);
  var material = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    uniforms: {
      uCurrTex: { value: null },
      uNextTex: { value: null },
      uTime: { value: 0 },
      uProg: { value: 0 },
      uAmplitude: { value: 0 },
      uProgDirection: { value: 1 },
      uMeshSize: { value: [1, 1] },
      uImageSize: { value: [1, 1] },
      uMousePos: { value: [0, 0] },
      uMouseOverAmp: { value: 0 },
      uAnimating: { value: false },
      uRadius: { value: 0.08 },
      uTranslating: { value: false },
    },
  });

  var mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  var raycaster = new THREE.Raycaster();
  var meshMouse = new THREE.Vector2();
  var mouseLerp = 0.1;
  var textures = [];
  var animating = false;

  // Fits the canvas and the plane to the frame. Called on layout changes
  // only — never per frame, which is the whole point of mounting the canvas
  // inside the element: its position is now the browser's problem, and the
  // plane just fills whatever the canvas is.
  function sizeToMedia() {
    if (!renderer) return;
    var w = mediaEl.clientWidth;
    var h = mediaEl.clientHeight;
    if (!w || !h) return;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    var vFov = (camera.fov * Math.PI) / 180;
    var unitHeight = 2 * Math.tan(vFov / 2) * (camera.position.z - mesh.position.z);
    mesh.scale.y = unitHeight;
    mesh.scale.x = unitHeight * camera.aspect;
    mesh.position.x = 0;
    mesh.position.y = 0;

    material.uniforms.uMeshSize.value = [w, h];
  }

  // A fixed-position canvas is NOT clipped by the section's overflow, so it
  // would otherwise paint across the whole page. Visibility is gated on the
  // section actually being on screen, and rendering pauses while it isn't.
  var texturesReady = false;
  var onScreen = false;

  function updateGlVisibility() {
    if (!renderer) return;
    gsap.to(renderer.domElement, {
      opacity: texturesReady && onScreen ? 1 : 0,
      duration: 0.5,
      ease: "power2.out",
    });
  }

  function loadTextures() {
    // Skipped without a renderer: nothing would consume them, and
    // switchTextures already no-ops on an empty textures array.
    if (!USE_GL) return;
    var loader = new THREE.TextureLoader();
    var pending = ROOMS.length;

    ROOMS.forEach(function (room, i) {
      loader.load(room.images[0].src, function (texture) {
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        textures[i] = texture;
        if (i === 0) {
          material.uniforms.uImageSize.value = [texture.image.width, texture.image.height];
          material.uniforms.uCurrTex.value = texture;
          material.uniforms.uNextTex.value = texture;
        }
        if (--pending === 0) {
          texturesReady = true;
          updateGlVisibility();
        }
      });
    });
  }

  function render() {
    if (!renderer) return;
    requestAnimationFrame(render);
    if (!onScreen) return;

    material.uniforms.uTime.value = clock.getElapsedTime();

    var target = mouseOver ? pointer : new THREE.Vector2(0, 0);
    meshMouse.lerp(target, mouseLerp);
    raycaster.setFromCamera(meshMouse, camera);
    var hits = raycaster.intersectObject(mesh);
    if (hits.length > 0) {
      material.uniforms.uMousePos.value = [hits[0].uv.x, hits[0].uv.y];
    }

    var amp = material.uniforms.uMouseOverAmp;
    amp.value = THREE.MathUtils.lerp(amp.value, mouseOver && !animating ? 1 : 0, 0.08);
    mouseLerp = THREE.MathUtils.lerp(mouseLerp, mouseOver ? 0.1 : 0, 0.5);

    var radius = material.uniforms.uRadius;
    if (mouseOver && mouseDown) radius.value = THREE.MathUtils.lerp(radius.value, 1, 0.01);
    else radius.value = THREE.MathUtils.lerp(radius.value, 0.08, 0.08);

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", sizeToMedia);
  // The frame's width is a clamp() on viewport width, so a ScrollTrigger
  // refresh (fonts landing, a pin re-measuring) can resize it without a
  // window resize ever firing.
  if (typeof ScrollTrigger !== "undefined") ScrollTrigger.addEventListener("refresh", sizeToMedia);

  mediaEl.addEventListener("mouseenter", function () { mouseOver = true; });
  mediaEl.addEventListener("mouseleave", function () { mouseOver = false; mouseDown = false; });
  mediaEl.addEventListener("mousedown", function () { mouseDown = true; });
  window.addEventListener("mouseup", function () { mouseDown = false; });
  mediaEl.addEventListener("click", function () { step(1); });

  updateFlatImage(0);
  sizeToMedia();
  loadTextures();
  render();

  // ── Slide content ──────────────────────────────────────────────────
  var slides = [];
  var ready = false;

  // The outline title shares one font-size across every room name. That was
  // never a problem while they were all 8-9 letters (SUPERIOR, FAMILIAR,
  // PENTHOUSE) — at the current size the box is exactly wide enough for a
  // word that length. A longer name just overflows it: .rooms-title clips
  // (overflow:hidden, white-space:nowrap), so instead of wrapping it silently
  // truncates mid-word. Shrinking only the titles that actually need it, by
  // exactly the amount that need it, keeps SUPERIOR-length words at their
  // original full size.
  function fitTitle(el) {
    el.style.removeProperty("--rm-title-fit");
    var overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 0) return;
    // A hair under the exact ratio so the longest word still keeps a sliver
    // of the frame's edge padding instead of touching it exactly.
    var scale = (el.clientWidth / el.scrollWidth) * 0.96;
    el.style.setProperty("--rm-title-fit", scale.toFixed(4));
  }

  // Splitting measures text on a canvas, so it must wait for the webfont and
  // a settled layout — otherwise every word lands on its own line.
  function buildSlides() {
    if (ready) return;
    slides = slideEls.map(function (el) {
      var titleEl = el.querySelector(".rooms-title");
      var title = splitChars(titleEl);
      fitTitle(titleEl);
      return {
        el: el,
        index: splitChars(el.querySelector(".rooms-index")),
        title: title,
        lines: splitLines(el.querySelector(".rooms-desc")),
        panel: el.querySelector(".rooms-panel"),
      };
    });

    slides.forEach(function (s, i) {
      if (i === 0) return;
      gsap.set([s.index, s.title], { yPercent: 120, rotation: -3 });
      gsap.set(s.lines, { yPercent: 100 });
      gsap.set(s.panel, { opacity: 0, y: 20 });
    });

    ready = true;
    syncChrome();
  }

  var tabs = [].slice.call(root.querySelectorAll(".rooms-tab"));
  var progressBar = root.querySelector(".rooms-progress i");
  var counterNow = root.querySelector(".rooms-counter b");
  var bgEl = root.querySelector(".rooms-bg");
  // One entry per room, in slide order. Removing ESTUDIO from the model left
  // its colour (#17120f) at the head of this list, which shifted every
  // remaining room onto its predecessor's background — ESTUDIOS lost the
  // green, and DEPARTAMENTOS lost the grey-black.
  var bgColors = [
    "#141a18", // ESTUDIOS  — green
    "#1b1512", // MINIDEPARTAMENTOS — warm brown
    "#101418", // DEPARTAMENTOS — grey-black
  ];

  // ── Secondary images ─────────────────────────────────────────────────
  // Created only while the desktop query matches. This is real conditional
  // rendering, not `display: none`: below 1100px the <img> elements never
  // enter the DOM, so their bytes are never requested.
  var desktopQ = window.matchMedia(ROOMS_DESKTOP);
  var secs = [];

  function buildAside() {
    if (secs.length || !asideEl) return;
    [1, 2].forEach(function (slot) {
      var frame = document.createElement("figure");
      frame.className = "rooms-sec rooms-sec-" + (slot === 1 ? "a" : "b");
      var img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      frame.appendChild(img);
      asideEl.appendChild(frame);
      secs.push({ frame: frame, img: img, slot: slot });
    });
    paintAside(current);
    syncFrameColor(0);
  }

  function destroyAside() {
    secs = [];
    if (asideEl) asideEl.innerHTML = "";
  }

  function paintAside(index) {
    var imgs = ROOMS[index].images;
    secs.forEach(function (s) {
      var data = imgs[s.slot];
      // Required fallback: a room with no images[1] or images[2] simply does
      // not render that frame. The main photo's box is untouched either way —
      // the rail is a separate absolutely-positioned layer.
      s.frame.hidden = !data;
      if (!data) return;
      if (s.img.getAttribute("src") !== data.src) s.img.src = data.src;
      s.img.alt = data.alt;
    });
  }

  // The frame padding has to be the section's background exactly, and that
  // colour is tweened per slide — a hard-coded value would drift out of sync
  // and the "cut out of the page" illusion would break.
  function syncFrameColor(duration) {
    if (!secs.length) return;
    var target = bgColors[current % bgColors.length];
    var frames = secs.map(function (s) { return s.frame; });
    if (duration) gsap.to(frames, { backgroundColor: target, duration: duration, ease: "power2.out" });
    else gsap.set(frames, { backgroundColor: target });
  }

  function syncAsideToBreakpoint() {
    if (desktopQ.matches) buildAside();
    else destroyAside();
  }

  // Both listeners on purpose. The matchMedia `change` event is the precise
  // one, but it does not fire in every environment (a headless viewport
  // resize can change the query result without dispatching it), and a rail
  // left mounted under 1100px would keep its images in the DOM. The resize
  // event always fires, so it backstops the query.
  desktopQ.addEventListener("change", syncAsideToBreakpoint);
  window.addEventListener("resize", syncAsideToBreakpoint);

  var current = 0;
  // Counted from the DOM, not from `slides` — that array is only populated
  // later by buildSlides(), and a zero here makes step()'s modulo return NaN.
  var total = slideEls.length;

  function syncChrome() {
    tabs.forEach(function (t, i) { t.classList.toggle("is-active", i === current); });
    if (progressBar) {
      // Derived from the room count rather than a hard-coded 25% in the
      // stylesheet, so removing or adding a room cannot leave the bar
      // over- or under-filling its track.
      progressBar.style.width = 100 / total + "%";
      progressBar.style.transform = "scaleX(" + (current + 1) + ")";
    }
    if (counterNow) counterNow.textContent = String(current + 1).padStart(2, "0");
    gsap.to(bgEl, { backgroundColor: bgColors[current % bgColors.length], duration: 1.2, ease: "power2.out" });
    syncFrameColor(1.2);
  }

  function switchTextures(index, direction) {
    if (!textures[index]) return;
    gsap.timeline({
      onStart: function () {
        animating = true;
        material.uniforms.uAnimating.value = true;
        material.uniforms.uProgDirection.value = direction;
        material.uniforms.uNextTex.value = textures[index];
      },
      onComplete: function () {
        animating = false;
        material.uniforms.uAnimating.value = false;
        material.uniforms.uCurrTex.value = textures[index];
        material.uniforms.uProg.value = 0;
      },
    })
      .fromTo(material.uniforms.uProg, { value: 0 }, { value: 1, duration: 1, ease: "power2.out" }, 0)
      .fromTo(
        material.uniforms.uAmplitude,
        { value: 0 },
        { value: 1, duration: 0.8, repeat: 1, yoyo: true, yoyoEase: "sine.out", ease: "expo.out" },
        0
      );
  }

  var busy = false;

  function goTo(index, direction) {
    if (!ready || busy || index === current || animating) return;
    busy = true;

    var from = slides[current];
    var to = slides[index];
    var next = direction === 1;

    var tl = gsap
      .timeline({
        defaults: { duration: 1, ease: "power4.inOut" },
        onStart: function () {
          switchTextures(index, direction);
          updateFlatImage(index);
          current = index;
          syncChrome();
        },
        onComplete: function () {
          from.el.classList.remove("is-current");
          busy = false;
        },
      })
      .addLabel("out", 0)
      .to([from.index, from.title], {
        yPercent: next ? -120 : 120,
        rotation: next ? 3 : -3,
        stagger: next ? 0.02 : -0.02,
      }, "out")
      .to(from.lines, { yPercent: next ? -100 : 100, stagger: next ? 0.05 : -0.05 }, "out")
      .to(from.panel, { opacity: 0, y: next ? -20 : 20, duration: 0.5 }, "out")
      .addLabel("in", 0.4)
      .add(function () {
        gsap.set([to.index, to.title], { yPercent: next ? 120 : -120, rotation: next ? -3 : 3 });
        gsap.set(to.lines, { yPercent: next ? 100 : -100 });
        gsap.set(to.panel, { opacity: 0, y: next ? 20 : -20 });
        to.el.classList.add("is-current");
      }, "in")
      .to([to.index, to.title], { yPercent: 0, rotation: 0, stagger: next ? 0.02 : -0.02 }, "in")
      .to(to.lines, { yPercent: 0, stagger: next ? 0.05 : -0.05 }, "in")
      .to(to.panel, { opacity: 1, y: 0, duration: 0.7 }, "in+=0.15");

    // ── Secondary frames ride the same timeline ────────────────────────
    // The brief asks the three images to move together with the main leading.
    // The main is a 1s shader morph whose visible change peaks around its
    // midpoint, which is where the "in" label already sits — so the two
    // frames are offset from that label rather than from t=0, and all three
    // resolve at the same moment instead of the frames snapping early.
    if (secs.length) {
      var frames = secs.map(function (s) { return s.frame; });
      var shift = reduced ? 0 : 14;

      // 0.35 + 0.06 of stagger lands the last frame at 0.41, just clear of the
      // first entrance at "in"+0.08 = 0.48 — otherwise the out and in tweens
      // overlap on the same element and fight for opacity.
      tl.to(
        frames,
        { opacity: 0, y: next ? -shift : shift, duration: 0.35, stagger: 0.06, ease: "power2.in" },
        "out"
      );

      tl.add(function () { paintAside(index); }, "in");

      secs.forEach(function (sec, i) {
        tl.fromTo(
          sec.frame,
          { opacity: 0, y: next ? shift : -shift },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: "power2.out",
            // Without this the "from" state is applied the moment the timeline
            // is built rather than when the tween starts, so the frames blinked
            // straight to invisible and the fade-out above never rendered.
            immediateRender: false,
          },
          "in+=" + (i === 0 ? 0.08 : 0.14)
        );
      });
    }
  }

  function step(dir) {
    var index = (current + dir + total) % total;
    goTo(index, dir);
  }

  if (desktopQ.matches) buildAside();

  root.querySelector(".rooms-nav-prev").addEventListener("click", function () { step(-1); });
  root.querySelector(".rooms-nav-next").addEventListener("click", function () { step(1); });
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { goTo(i, i > current ? 1 : -1); });
  });

  window.addEventListener("keydown", function (e) {
    if (!isSectionVisible()) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  function isSectionVisible() {
    var r = root.getBoundingClientRect();
    return r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(buildSlides);
    setTimeout(buildSlides, 2000); // guard if the font promise never settles
  } else {
    window.addEventListener("load", buildSlides);
  }

  // ── Entrance + cover behaviour ─────────────────────────────────────
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "bottom top",
      onToggle: function (self) {
        onScreen = self.isActive;
        updateGlVisibility();
      },
    });

    if (!reduced) {
      // The cover effect: this panel rides up over the previous section while
      // that section recedes behind it — shrinking, blurring and darkening,
      // like it's dropping a layer back in depth. Pinning was avoided on
      // purpose: .offering is far taller than the viewport, so pinning it
      // (with or without spacing) yanks its height out of the flow and makes
      // the whole page jump.
      //
      // The canvas used to be position:fixed, which made transforming any
      // ancestor of `.rooms` unsafe — it would have re-rooted the canvas to
      // that ancestor and silently detached the photograph from the slider.
      // It now lives inside .rooms-media as an ordinary absolutely-positioned
      // box, so that constraint is gone.
      // Both of these are desktop-only. They are the two heaviest scrubbed
      // effects here and neither survives contact with a mid-range phone:
      // scaling and fading a whole section re-composites it every frame, and
      // animating a 90px-blur box-shadow repaints a shadow the width of the
      // page every frame — box-shadow is not a compositor property, so there
      // is no cheap path for it. Skipping them leaves the static shadow the
      // stylesheet already sets, so nothing is missing on a phone, it simply
      // does not animate.
      if (RICH) {
        gsap.to(".offering-inner", {
          scale: 0.9,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: { trigger: ".rooms", start: "top bottom", end: "top 15%", scrub: true },
        });

        // Shadow intensifies as the panel settles into place, reinforcing
        // that it just landed on top of something.
        gsap.fromTo(
          root,
          { boxShadow: "0 -10px 30px rgba(0,0,0,0)" },
          {
            boxShadow: "0 -34px 90px rgba(0,0,0,0.6)",
            ease: "none",
            scrollTrigger: { trigger: root, start: "top bottom", end: "top 40%", scrub: true },
          }
        );
      }

      // Continuous, scroll-scrubbed parallax (not a one-shot trigger fade) on
      // the chrome that ISN'T an ancestor of the canvas, so it's safe to
      // transform: it rises into place at a slightly different rate than the
      // scroll itself, which is what actually reads as "parallax".
      gsap.fromTo(
        ".rooms-head > *",
        { y: 70, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "top 45%", scrub: true },
        }
      );

      gsap.fromTo(
        [".rooms-tabs", ".rooms-progress", ".rooms-counter"],
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top 70%", end: "bottom 90%", scrub: true },
        }
      );
    }
  }
});
