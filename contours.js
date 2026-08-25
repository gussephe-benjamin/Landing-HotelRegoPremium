/* Contour field — animated hairline isolines behind the opening statement.

   A single full-screen triangle in a fragment shader. The isolines are the
   level sets of a domain-warped fbm field: the warp is what turns what would
   otherwise be concentric ovals into irregular closed loops with near-straight
   runs and rounded corners, and it is why the shapes transform rather than
   merely drift.

   Two decisions carry most of the look and are easy to get wrong:

     * The line width is measured in screen pixels, not in field units. Taking
       fwidth of the banded value gives the field's rate of change per pixel,
       so dividing by it yields a distance in pixels — the stroke then stays a
       hairline at any zoom, any resize, any device pixel ratio. Thresholding
       the field directly would have produced a line that fattens as the
       shapes grow and steps badly along its edge.

     * The fbm gain is 0.42, not the usual 0.5. At 0.5 the later octaves keep
       enough weight to crinkle the contours and the result reads as an actual
       topographic survey. Pulled down, the curves stay long and clean.

   No dependencies, no build, no assets. If WebGL is unavailable the module
   does nothing at all and the section keeps its CSS background. */
(function () {
  "use strict";

  // ── Tuning ───────────────────────────────────────────────────────────
  var PARAMS = {
    SCALE: 0.8, // base frequency; higher = smaller shapes (0.5–1.2)
    SPEED: 0.075, // global time multiplier; above 0.15 it reads as restless
    DRIFT: [0.14, -0.05], // slow diagonal travel of the whole field
    WARP_SCALE: 0.6, // frequency of the noise that deforms the domain
    WARP_AMP: 0.45, // how far it deforms; 0 = near-circles, >0.8 = chaos
    BANDS: 2.35, // number of levels — the main density control (1.5–3.0)
    LINE_WIDTH: 1.15, // stroke weight in screen pixels
    FILL: 0.55, // strength of the faint between-line shading; 0 disables
    CURSOR_RADIUS: 0.35, // influence radius, in height-normalised units
    CURSOR_PUSH: -0.075, // negative attracts the lines, positive repels
    CURSOR_EASE: 0.06, // pointer follow, as a fraction per 60fps frame

    // Draw on every Nth display frame — a count, not a time.
    //
    // This was a 24fps threshold in milliseconds, and that was the wrong unit.
    // 41.7ms does not divide evenly into a 16.7ms frame, so redraws landed on
    // a 2-3-2-3 cadence: an uneven step even though the average rate was
    // exactly what was asked for. Uneven is what the eye reads as stutter, and
    // it reads as stutter far more readily than a low but regular rate does.
    //
    // Counting frames instead makes every interval identical by construction,
    // whatever the display runs at — half rate on a 60Hz panel, half rate on a
    // 120Hz one, and no drift against the compositor at either.
    //
    // 2 is deliberately conservative. The field's slowest cycle is 46 seconds,
    // so it could be stepped much harder before the motion itself suffered;
    // what cannot be traded is the evenness.
    DRAW_EVERY: 2,

    // Palette. The brief's #F8F8F3 was swapped for this panel's own cream:
    // the canvas only covers the opening screen, and the marquee directly
    // below keeps the section colour, so a lighter canvas would have drawn a
    // visible band across the seam. Line and fill are the brief's ratios
    // carried onto this ground rather than its literal values.
    BG: [0.937, 0.918, 0.891], // #efeae3
    LINE: [0.788, 0.761, 0.706], // #c9c2b4
    FILL_COL: [0.906, 0.882, 0.847], // #e7e1d8
  };

  var canvas = document.querySelector(".story-contours");
  if (!canvas) return;

  var gl = null;
  try {
    gl =
      canvas.getContext("webgl", { antialias: false, alpha: false, depth: false }) ||
      canvas.getContext("experimental-webgl", { antialias: false, alpha: false, depth: false });
  } catch (e) {
    gl = null;
  }
  // Silent fallback: the section's CSS background is already the right colour,
  // so doing nothing degrades to a plain cream panel rather than a hole.
  if (!gl) return;

  // Required for fwidth in WebGL 1. Without it the constant-width line cannot
  // be computed at all, so there is nothing to fall back to but leaving.
  var deriv = gl.getExtension("OES_standard_derivatives");
  if (!deriv) return;

  var VERT = [
    "attribute vec2 aPos;",
    "void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    // Must precede the precision declaration.
    "#extension GL_OES_standard_derivatives : enable",
    "precision highp float;",

    "uniform vec2  uRes;",
    "uniform float uNorm;",
    "uniform float uTime;",
    "uniform vec2  uMouse;",
    "uniform float uMouseAmt;",
    "uniform float uScale;",
    "uniform vec2  uDrift;",
    "uniform float uWarpScale;",
    "uniform float uWarpAmp;",
    "uniform float uBands;",
    "uniform float uLineW;",
    "uniform float uFill;",
    "uniform float uCurRadius;",
    "uniform float uCurPush;",
    "uniform vec3  uBg;",
    "uniform vec3  uLine;",
    "uniform vec3  uFillCol;",

    // 2D simplex noise — Ashima Arts / Stefan Gustavson, MIT.
    "vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }",
    "vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }",
    "vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }",
    "float snoise(vec2 v){",
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439,",
    "                     -0.577350269189626, 0.024390243902439);",
    "  vec2 i  = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v -   i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod289(i);",
    "  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))",
    "                          + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);",
    "  m = m*m; m = m*m;",
    "  vec3 x  = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h  = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);",
    "  vec3 g;",
    "  g.x  = a0.x  * x0.x  + h.x  * x0.y;",
    "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",

    // Three octaves is all the detail these curves can carry before they
    // start to crinkle. The per-octave offset breaks the correlation that
    // would otherwise line the octaves up and produce visible radial spokes.
    "float fbm(vec2 p){",
    "  float a = 0.5, s = 0.0;",
    "  for (int i = 0; i < 3; i++){",
    "    s += a * snoise(p);",
    "    p  = p * 2.0 + 17.3;",
    "    a *= 0.42;",
    "  }",
    "  return s;",
    "}",

    // Two octaves for the warp, three for the field. The warp is a
    // displacement, not a picture: its third octave carries a weight of
    // 0.42 squared and is then multiplied by WARP_AMP 0.45, so it moves the
    // domain by well under a percent — invisible in the result, and a third
    // of every fragment's noise budget. Two of the three fbm calls per pixel
    // are warp calls, so this is the cheapest real saving in the shader.
    "float fbmWarp(vec2 p){",
    "  float a = 0.5, s = 0.0;",
    "  for (int i = 0; i < 2; i++){",
    "    s += a * snoise(p);",
    "    p  = p * 2.0 + 17.3;",
    "    a *= 0.42;",
    "  }",
    "  return s;",
    "}",

    // The two warp channels advance at different rates and in opposite
    // directions. Matching them would slide the field bodily across the
    // screen; opposing them makes the loops stretch, merge and part instead.
    "float field(vec2 p, float t){",
    "  vec2 q = vec2(",
    "    fbmWarp(p * uWarpScale + vec2(0.0,  t * 0.8)),",
    "    fbmWarp(p * uWarpScale + vec2(5.2, -t * 0.6) + 3.7)",
    "  );",
    "  vec2 r = p + uWarpAmp * q + uDrift * t;",
    "  return fbm(r);",
    "}",

    "void main(){",
    // Normalised by one length rather than by both axes, so a wider window
    // shows more field instead of the same field stretched.
    //
    // That length is the viewport's height, not the canvas's. They used to be
    // the same thing and dividing by uRes.y was correct; once this canvas grew
    // to cover the whole panel it became half as tall again as the screen, and
    // dividing by its own height stretched every shape by that ratio — the
    // count on screen fell from 5.7 lines to 3.6, under the density the design
    // calls for. Tying it to the viewport keeps the shapes the same size on
    // screen however tall the element they are painted on happens to be.
    "  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uNorm;",
    "  p *= uScale;",

    "  vec2  d    = p - uMouse * uScale;",
    "  float dist = length(d);",
    "  float infl = exp(-(dist*dist) / (uCurRadius*uCurRadius)) * uMouseAmt;",
    "  p += normalize(d + 1e-5) * infl * uCurPush;",

    "  float t = uTime;",
    "  float n = field(p, t);",

    // Distance to the nearest band edge, converted from field units to
    // pixels by the field's own screen-space gradient.
    "  float v = n * uBands;",
    "  float g = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-6);",
    "  float line = 1.0 - smoothstep(0.0, uLineW, g);",

    "  float fill = smoothstep(-0.15, 0.55, n) * uFill;",
    "  vec3  col  = mix(uBg, uFillCol, fill);",
    "  col        = mix(col, uLine, line);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // One triangle large enough to cover the clip cube. A quad would need two
  // triangles and would rasterise the diagonal seam twice.
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  function u(name) {
    return gl.getUniformLocation(prog, name);
  }
  var U = {
    res: u("uRes"), norm: u("uNorm"), time: u("uTime"), mouse: u("uMouse"), mouseAmt: u("uMouseAmt"),
    scale: u("uScale"), drift: u("uDrift"), warpScale: u("uWarpScale"),
    warpAmp: u("uWarpAmp"), bands: u("uBands"), lineW: u("uLineW"), fill: u("uFill"),
    curRadius: u("uCurRadius"), curPush: u("uCurPush"),
    bg: u("uBg"), line: u("uLine"), fillCol: u("uFillCol"),
  };

  gl.uniform1f(U.scale, PARAMS.SCALE);
  gl.uniform2f(U.drift, PARAMS.DRIFT[0], PARAMS.DRIFT[1]);
  gl.uniform1f(U.warpScale, PARAMS.WARP_SCALE);
  gl.uniform1f(U.warpAmp, PARAMS.WARP_AMP);
  gl.uniform1f(U.bands, PARAMS.BANDS);
  gl.uniform1f(U.lineW, PARAMS.LINE_WIDTH);
  gl.uniform1f(U.fill, PARAMS.FILL);
  gl.uniform1f(U.curRadius, PARAMS.CURSOR_RADIUS);
  gl.uniform1f(U.curPush, PARAMS.CURSOR_PUSH);
  gl.uniform3fv(U.bg, PARAMS.BG);
  gl.uniform3fv(U.line, PARAMS.LINE);
  gl.uniform3fv(U.fillCol, PARAMS.FILL_COL);

  // ── Sizing ───────────────────────────────────────────────────────────
  var vw = 0, vh = 0;

  // Fragment budget. This canvas covers the whole light panel, which is half
  // as tall again as the viewport, and the shader is genuinely expensive per
  // pixel: three fbm calls of three octaves each is nine simplex evaluations
  // for every fragment. Left uncapped at dpr 2 that is roughly 70 million
  // noise evaluations a frame on a desktop.
  //
  // The cap trades resolution rather than quality: the stroke is measured in
  // buffer pixels through fwidth, so a smaller buffer makes it fractionally
  // wider in CSS terms and it stays a hairline either way. Below the cap
  // nothing changes at all.
  var MAX_FRAGMENTS = 3.6e6;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (w * h > MAX_FRAGMENTS) {
      var k = Math.sqrt(MAX_FRAGMENTS / (w * h));
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    // Compared first: reassigning the drawing buffer reallocates it, and doing
    // that every frame would stall the pipeline for no gain.
    if (w === vw && h === vh) return false;
    vw = w; vh = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.res, w, h);
    // The viewport's height expressed in this buffer's pixels — the same unit
    // gl_FragCoord counts in.
    var scale = r.width ? w / r.width : 1;
    gl.uniform1f(U.norm, Math.max(1, (window.innerHeight || h) * scale));
    return true;
  }

  // Observed on the canvas rather than on window: this element is sized by
  // its section, which can change height without the window doing anything.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(function () {
      if (resize() && !running) draw(lastT);
    }).observe(canvas);
  } else {
    window.addEventListener("resize", function () {
      if (resize() && !running) draw(lastT);
    });
  }
  resize();

  // ── Pointer ──────────────────────────────────────────────────────────
  var mx = 0, my = 0, tx = 0, ty = 0, amt = 0, tAmt = 0;

  canvas.parentElement.addEventListener(
    "pointermove",
    function (e) {
      var r = canvas.getBoundingClientRect();
      if (!r.height) return;
      // Same convention as the shader: origin at centre, normalised by height,
      // y up — gl_FragCoord counts from the bottom.
      tx = (e.clientX - r.left - r.width * 0.5) / r.height;
      ty = (r.height * 0.5 - (e.clientY - r.top)) / r.height;
      tAmt = 1;
    },
    { passive: true }
  );
  canvas.parentElement.addEventListener("pointerleave", function () {
    tAmt = 0;
  });

  // ── Loop ─────────────────────────────────────────────────────────────
  // Quieto fuera del escritorio, por la misma razón que la banda de la sección
  // de voces: eran los dos únicos contextos WebGL sin límite de ancho, y en un
  // teléfono corrían a la vez compitiendo con el scroll.
  //
  // Se trata igual que el movimiento reducido, que ya existía: se dibuja un
  // fotograma y se congela. El campo es parte del diseño; su deriva de 46
  // segundos no lo es tanto como para pagarla en una GPU móvil.
  var reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (typeof window.REGO_MQ !== "undefined" &&
      !window.matchMedia(window.REGO_MQ.DESKTOP).matches);
  var running = false;
  var held = false;
  var raf = 0;
  var start = 0;
  var lastT = 0;

  function draw(t) {
    gl.uniform1f(U.time, t);
    gl.uniform2f(U.mouse, mx, my);
    gl.uniform1f(U.mouseAmt, amt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var tick = 0;
  var lastDraw = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);

    // Declining a frame rather than skipping the callback: the loop stays in
    // step with the compositor and every redraw lands on a real frame
    // boundary, evenly spaced.
    if (++tick % PARAMS.DRAW_EVERY !== 0) return;
    var dt = lastDraw ? now - lastDraw : 16.667;
    lastDraw = now;

    if (!start) start = now;
    lastT = ((now - start) / 1000) * PARAMS.SPEED;

    // Decayed against elapsed time, not per frame. Written as a flat fraction
    // the pointer would follow at whatever rate the loop happens to run — and
    // this loop now runs at a quarter of the display's rate deliberately, so a
    // per-frame constant would have made the cursor four times more sluggish
    // as a side effect of an optimisation it has nothing to do with.
    var k = 1 - Math.pow(1 - PARAMS.CURSOR_EASE, dt / 16.667);
    mx += (tx - mx) * k;
    my += (ty - my) * k;
    amt += (tAmt - amt) * k;

    draw(lastT);
  }

  function play() {
    if (running || reduced || held) return;
    running = true;
    // Rebased so the field does not jump forward by however long the section
    // spent off screen.
    start = 0;
    lastDraw = 0;
    tick = 0;
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  if (reduced) {
    // Still drawn, just frozen: the texture is part of the design, the motion
    // is the part that was objected to.
    draw(0);
  } else {
    var onScreen = true;
    if (typeof IntersectionObserver !== "undefined") {
      onScreen = false;
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen && !document.hidden) play();
        else pause();
      }).observe(canvas);
    } else {
      play();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else if (onScreen) play();
    });

    // The heaviest moment on this stretch is the facade growing to fill the
    // screen: a full-bleed photograph being scaled while this canvas redraws
    // behind it. By the end of that growth the field is completely covered, so
    // hscroll.js holds it here and the GPU spends the whole of that transition
    // on the one thing the visitor is actually looking at.
    window.regoContours = {
      hold: function () {
        held = true;
        pause();
      },
      resume: function () {
        held = false;
        if (onScreen && !document.hidden) play();
      },
    };

    // One frame immediately, so the field is already drawn on the first paint
    // rather than appearing when the observer first fires.
    draw(0);
  }
})();
