/* Footer — costura de luz, aura WebGL y entrada.

   Diferido a DOMContentLoaded como el resto de las secciones: ScrollTrigger
   mide en orden de creación, y un disparador nacido antes de que hscroll.js
   registre su pin se queda sin la altura del pin-spacer. */
document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".ft");
  if (!root) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Año del aviso legal ────────────────────────────────────────────
  // En el HTML va un año escrito para que no quede vacío sin JS; esto sólo lo
  // mantiene al día.
  var yearEl = root.querySelector("[data-ft-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ── Costura de luz ─────────────────────────────────────────────────
  // El destello sigue al puntero a lo largo del filete y vuelve al centro
  // cuando se va. JS sólo escribe una variable con la posición; el movimiento
  // lo hace una transición sobre transform, así que la línea nunca se
  // repinta.
  var seam = root.querySelector(".ft-seam");
  if (seam && !reduced && window.matchMedia("(any-hover: hover)").matches) {
    var raf = 0;
    var pending = 0;

    // Desplazamiento respecto al CENTRO del filete, que es donde la hoja ancla
    // el resplandor. Ver la nota de .ft-seam-bloom.
    var write = function () {
      raf = 0;
      seam.style.setProperty("--ft-seam-dx", pending + "px");
    };

    // Se escucha en el footer entero, no sólo en la línea de 1px: seguir un
    // objetivo de un píxel de alto sería imposible de acertar. El puntero
    // recorre el footer y la luz recorre la línea.
    root.addEventListener("pointermove", function (ev) {
      if (ev.pointerType === "touch") return;
      var box = seam.getBoundingClientRect();
      var x = ev.clientX - box.left;
      if (x < 0) x = 0;
      else if (x > box.width) x = box.width;
      pending = x - box.width / 2;
      // Un cuadro como mucho, aunque el ratón dispare veinte eventos.
      if (!raf) raf = window.requestAnimationFrame(write);
    });

    root.addEventListener("pointerleave", function () {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      seam.style.removeProperty("--ft-seam-dx");
    });
  }

  /* ── Aura WebGL de la banda de llamada ───────────────────────────────
     Portado del componente React de referencia a WebGL a pelo, que es lo que
     encaja en esta página: no hay build, no hay React y traer Three.js para un
     quad de dos triángulos costaría más que el efecto.

     Cuatro cosas del original se cambiaron a conciencia, y las cuatro se notan
     en una página como ésta:

       · El bucle era incondicional. Aquí abajo, con un vídeo, los shaders de
         habitaciones y los ScrollTrigger de toda la página por delante, un
         rAF perpetuo quemaría GPU y batería durante toda la sesión aunque el
         pie no se haya visto nunca. Se enciende con IntersectionObserver y se
         apaga con la pestaña.
       · Reconstruía el Float32Array de colores y reconvertía los hex EN CADA
         CUADRO: basura para el recolector 60 veces por segundo para subir
         nueve flotantes que no cambian. Se suben una vez.
       · No comprobaba si los shaders compilaban ni si el programa enlazaba,
         así que un fallo daba un lienzo negro sin una sola pista. Ahora se
         verifica y, si algo falla, la tarjeta se queda como estaba.
       · El color base era cálido casi rojo y la paleta, roja. Aquí es el oro
         de la casa y el mismo azul del resplandor del pie. */
  (function aura() {
    var card = root.querySelector(".ft-cta");
    var canvas = root.querySelector(".ft-cta-aura");
    var vsEl = document.getElementById("ftAuraVertexShader");
    var fsEl = document.getElementById("ftAuraFragmentShader");
    if (!card || !canvas || !vsEl || !fsEl) return;

    var gl = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        // Es decoración: no merece despertar la GPU dedicada de un portátil.
        powerPreference: "low-power",
      });
    } catch (e) {
      gl = null;
    }
    if (!gl) return;

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

    var vs = compile(gl.VERTEX_SHADER, vsEl.textContent);
    var fs = compile(gl.FRAGMENT_SHADER, fsEl.textContent);
    if (!vs || !fs) return;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);
    // Enlazado el programa, los objetos de shader ya no hacen falta.
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    var pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(program, "u_resolution");
    var uTime = gl.getUniformLocation(program, "u_time");

    /* La paleta de la casa, no la roja del componente de referencia:
         [0] #c79a5b — el oro que ya usan el índice de secciones y los acentos
         [1] #e9d0ab — realce cálido para el brillo especular
         [2] #96b0c6 — el mismo azul frío de .ft-glow, para que la tarjeta
                       pertenezca a su sección
       Y una base fría casi negra, porque en `screen` la base es justo lo que
       NO debe levantar el vidrio: cuanto más cerca de cero, más intacto queda. */
    gl.uniform3fv(
      gl.getUniformLocation(program, "u_colors"),
      new Float32Array([
        0.78, 0.604, 0.357,
        0.914, 0.816, 0.671,
        0.588, 0.69, 0.776,
      ])
    );
    gl.uniform3f(gl.getUniformLocation(program, "u_base"), 0.02, 0.024, 0.03);
    // Grano bajo: el pie ya tiene el suyo por encima y dos capas de ruido
    // sumadas se ven sucias.
    gl.uniform1f(gl.getUniformLocation(program, "u_grain"), 0.22);
    // Es el fondo de una tarjeta, no un hero. Sube lo justo para que se note
    // que hay algo vivo detrás del texto.
    gl.uniform1f(gl.getUniformLocation(program, "u_intensity"), 0.82);

    var SPEED = 0.26;

    function resize() {
      // Tope de 1.5 en pantallas densas, y otro absoluto: la tarjeta es ancha
      // y en un monitor grande a DPR 2 el lienzo se iría por encima de los
      // 4000px de ancho sin que se notara la diferencia.
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.min(Math.round(card.clientWidth * dpr), 2600));
      var h = Math.max(1, Math.round(card.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
    resize();

    var ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(card);
    } else {
      window.addEventListener("resize", resize);
    }

    function draw(seconds) {
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    card.classList.add("has-aura");

    if (reduced) {
      // Un solo fotograma: el campo de luz se ve, pero nada se mueve.
      draw(12);
      return;
    }

    var raf = 0;
    var running = false;
    var near = false;
    // El tiempo del shader se lleva aparte y sólo avanza mientras se dibuja.
    // Usar el reloj del rAF haría que, al volver de otra pestaña, el campo
    // saltara de golpe todo lo que estuvo parado.
    var clock = 0;
    var prev = 0;

    function frame(now) {
      var dt = prev ? (now - prev) / 1000 : 0;
      prev = now;
      // Una pausa larga —cambio de pestaña, hilo principal ocupado— no debe
      // traducirse en un tirón del campo.
      if (dt > 0.1) dt = 0.1;
      clock += dt * SPEED;
      draw(clock);
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      prev = 0;
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      window.cancelAnimationFrame(raf);
      raf = 0;
    }

    function sync() {
      if (near && !document.hidden) start();
      else stop();
    }

    if (typeof IntersectionObserver !== "undefined") {
      // Un margen holgado para que ya esté corriendo antes de asomar, y no se
      // vea arrancar.
      new IntersectionObserver(
        function (entries) {
          near = entries[0].isIntersecting;
          sync();
        },
        { rootMargin: "240px 0px" }
      ).observe(card);
    } else {
      near = true;
      sync();
    }

    document.addEventListener("visibilitychange", sync);
  })();

  // ── Volver arriba ──────────────────────────────────────────────────
  var topBtn = root.querySelector("[data-ft-top]");
  if (topBtn) {
    topBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
  }

  // ── Entrada ────────────────────────────────────────────────────────
  var groups = [].slice.call(root.querySelectorAll(".ft-anim"));

  if (typeof ScrollTrigger === "undefined" || typeof gsap === "undefined" || reduced) {
    // Sin GSAP el footer se ve entero; sólo falta disparar el destello del
    // logotipo, que es CSS y depende de esta clase.
    root.classList.remove("is-ready");
    root.classList.add("is-in");
    return;
  }

  // La clase va aquí y no en el HTML para que una carga con el script caído no
  // deje el footer invisible.
  root.classList.add("is-ready");

  gsap.fromTo(
    groups,
    { opacity: 0, y: 28 },
    {
      opacity: 1,
      y: 0,
      duration: 0.9,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: {
        trigger: root,
        start: "top 88%",
        once: true,
        // Igual que el resto de la mitad baja: las secciones pinadas de arriba
        // tienen que medirse primero o estas marcas caen cortas.
        refreshPriority: -4,
        onEnter: function () {
          // Dispara el destello de la marca, que es CSS.
          root.classList.add("is-in");
        },
      },
      // El translate inline estorbaría a cualquier medida posterior; la
      // opacidad se queda, que es lo que mantiene el footer visible.
      clearProps: "transform",
    }
  );
});
