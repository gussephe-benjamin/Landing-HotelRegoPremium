/* Reservation screen.

   The section is a title, a summary bar and a caption over the video; the
   booking engine itself lives on reserva.html. This file only covers the two
   thing that still needs script here: making the "Reservar" buttons scattered
   around the page land on this section. */
document.addEventListener("DOMContentLoaded", function () {
  var section = document.querySelector(".reserve");
  if (!section) return;

  // The background video is already started by reserve.js.

  // ── Title ────────────────────────────────────────────────────────────
  // Same treatment as the "Experiencia" statement: the word is split so each
  // letter can resolve out of a blur on its own beat.
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var kicker = section.querySelector(".reserve-kicker");
  var word = section.querySelector(".reserve-word");
  var chars = [];

  if (word) {
    var text = word.textContent.trim();
    word.textContent = "";
    text.split("").forEach(function (ch) {
      var span = document.createElement("span");
      span.className = "reserve-char";
      span.textContent = ch;
      word.appendChild(span);
      chars.push(span);
    });
    // The split turns one word into N elements; without this a screen reader
    // would spell it out.
    word.setAttribute("aria-label", text);
  }

  if (typeof gsap !== "undefined" && chars.length) {
    if (reduced) {
      gsap.set([kicker].concat(chars), { opacity: 1 });
    } else {
      gsap.set([kicker].concat(chars), { opacity: 0 });

      var playTitle = function () {
        gsap
          .timeline()
          .fromTo(
            kicker,
            { opacity: 0, y: 16, filter: "blur(8px)" },
            { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" },
            0
          )
          .fromTo(
            chars,
            { opacity: 0, y: 40, filter: "blur(12px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1.1,
              stagger: 0.045,
              ease: "power3.out",
            },
            0.15
          );
      };

      if (typeof ScrollTrigger !== "undefined") {
        ScrollTrigger.create({
          trigger: section,
          start: "top 60%",
          once: true,
          // Below every pinned section on the page, so it measures last.
          refreshPriority: -4,
          onEnter: playTitle,
        });
      } else {
        playTitle();
      }
    }
  }

  // ── Date range picker ────────────────────────────────────────────────
  (function initPicker() {
    var trigger = section.querySelector(".rsv-dates");
    var label = section.querySelector(".rsv-dates-text");
    var panel = section.querySelector(".rsv-cal");
    var grid = section.querySelector(".rsv-cal-grid");
    var title = section.querySelector(".rsv-cal-title");
    var hint = section.querySelector(".rsv-cal-hint");
    var fieldIn = section.querySelector("#rsv-in");
    var fieldOut = section.querySelector("#rsv-out");
    if (!trigger || !panel) return;

    var MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    var SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    var DOW = ["lu","ma","mi","ju","vi","sá","do"];

    function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    var TODAY = midnight(new Date());

    function iso(d) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function same(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
    function fmt(d) { return d.getDate() + " " + SHORT[d.getMonth()]; }

    var checkin = null;
    var checkout = null;
    var hover = null;
    var anchorMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);

    function render() {
      grid.innerHTML = "";
      DOW.forEach(function (d) {
        var s = document.createElement("span");
        s.className = "rsv-cal-dow";
        s.textContent = d;
        grid.appendChild(s);
      });

      title.textContent = MONTHS[anchorMonth.getMonth()] + " " + anchorMonth.getFullYear();
      // Queried off the panel, not the section: in sheet mode the panel is
      // parked on <body> and is no longer inside .reserve.
      panel.querySelector('.rsv-cal-nav[data-dir="-1"]').disabled =
        anchorMonth <= new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);

      // Monday-first: getDay() is Sunday-first, so shift by 6 and wrap.
      var lead = (new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1).getDay() + 6) % 7;
      for (var b = 0; b < lead; b++) {
        var blank = document.createElement("span");
        blank.className = "rsv-day is-blank";
        grid.appendChild(blank);
      }

      var total = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 0).getDate();
      for (var n = 1; n <= total; n++) {
        var date = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), n);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rsv-day";
        btn.dataset.iso = iso(date);
        btn.disabled = date < TODAY;
        btn.setAttribute("aria-label", n + " de " + MONTHS[date.getMonth()]);
        var pill = document.createElement("i");
        pill.textContent = String(n);
        btn.appendChild(pill);
        grid.appendChild(btn);
      }

      paint();
    }

    // Range shading is recomputed on hover, so it is kept separate from the
    // grid build above — rebuilding the month on mousemove would thrash.
    function paint() {
      var start = checkin;
      var end = checkout;
      if (start && !end && hover && hover > start) end = hover;

      [].slice.call(grid.querySelectorAll(".rsv-day[data-iso]")).forEach(function (btn) {
        var p = btn.dataset.iso.split("-");
        var d = new Date(+p[0], +p[1] - 1, +p[2]);
        var isStart = same(d, start);
        var isEnd = same(d, end);
        btn.classList.toggle("is-today", same(d, TODAY));
        btn.classList.toggle("is-start", isStart);
        btn.classList.toggle("is-end", isEnd);
        btn.classList.toggle("in-range", isStart || isEnd || !!(start && end && d > start && d < end));
      });

      if (checkin && checkout) {
        var nights = Math.round((checkout - checkin) / 86400000);
        hint.textContent = nights + (nights === 1 ? " noche" : " noches");
      } else {
        hint.textContent = checkin ? "Elige la salida" : "Elige la llegada";
      }
    }

    function syncLabel() {
      if (checkin && checkout) {
        label.textContent = fmt(checkin) + " — " + fmt(checkout);
        label.classList.remove("is-empty");
        fieldIn.value = iso(checkin);
        fieldOut.value = iso(checkout);
      } else {
        label.textContent = "Llegada — Salida";
        label.classList.add("is-empty");
        fieldIn.value = "";
        fieldOut.value = "";
      }
    }

    // ── Sheet mode ─────────────────────────────────────────────────────
    // On a phone the panel cannot stay anchored to the field: .reserve is
    // 100svh with overflow:hidden, and the bar itself keeps a filter from its
    // entrance animation, which makes it a containing block for fixed
    // children. Both are sidestepped by moving the panel to <body> while it
    // is open and putting it back on close.
    var sheetQuery = window.matchMedia("(max-width: 720px)");
    var home = panel.parentNode;
    var scrim = null;
    var isSheet = false;

    function getScrim() {
      if (scrim) return scrim;
      scrim = document.createElement("div");
      scrim.className = "rsv-cal-scrim";
      scrim.addEventListener("click", close);
      // Keeps the page from scrolling under the sheet on touch.
      scrim.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
      return scrim;
    }

    function open() {
      isSheet = sheetQuery.matches;
      if (isSheet) {
        var s = getScrim();
        document.body.appendChild(s);
        document.body.appendChild(panel);
        panel.classList.add("is-sheet");
        requestAnimationFrame(function () { s.classList.add("is-in"); });
      }
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      render();
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      hover = null;
      if (isSheet) {
        panel.classList.remove("is-sheet");
        home.appendChild(panel);
        if (scrim && scrim.parentNode) {
          scrim.classList.remove("is-in");
          scrim.parentNode.removeChild(scrim);
        }
        isSheet = false;
      }
    }

    // Rotating or resizing across the breakpoint would leave the panel in the
    // wrong mode; simplest correct answer is to put it away.
    var onQuery = function () { if (!panel.hidden) close(); };
    if (sheetQuery.addEventListener) sheetQuery.addEventListener("change", onQuery);
    else if (sheetQuery.addListener) sheetQuery.addListener(onQuery);

    panel.querySelector(".rsv-cal-done").addEventListener("click", close);
    panel.querySelector(".rsv-cal-clear").addEventListener("click", function () {
      checkin = null;
      checkout = null;
      hover = null;
      paint();
      syncLabel();
    });

    trigger.addEventListener("click", function () {
      panel.hidden ? open() : close();
    });

    [].slice.call(section.querySelectorAll(".rsv-cal-nav")).forEach(function (b) {
      b.addEventListener("click", function () {
        anchorMonth = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + (+b.dataset.dir), 1);
        render();
      });
    });

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".rsv-day");
      if (!btn || !btn.dataset.iso || btn.disabled) return;
      var p = btn.dataset.iso.split("-");
      var d = new Date(+p[0], +p[1] - 1, +p[2]);

      // A click on or before the current arrival starts the range over.
      if (!checkin || checkout || d <= checkin) {
        checkin = d;
        checkout = null;
      } else {
        checkout = d;
      }

      paint();
      syncLabel();
      // The sheet waits for "Listo" — on a phone the panel is the only thing
      // on screen, so snapping it shut mid-tap reads as a glitch.
      if (checkin && checkout && !isSheet) close();
    });

    grid.addEventListener("mouseover", function (e) {
      var btn = e.target.closest(".rsv-day");
      if (!btn || !btn.dataset.iso || btn.disabled) return;
      var p = btn.dataset.iso.split("-");
      hover = new Date(+p[0], +p[1] - 1, +p[2]);
      paint();
    });
    grid.addEventListener("mouseleave", function () { hover = null; paint(); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { close(); trigger.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (panel.hidden) return;
      if (!panel.contains(e.target) && !trigger.contains(e.target)) close();
    });

    syncLabel();
  })();

  // ── "Reservar" shortcuts ─────────────────────────────────────────────
  // The button in the hero topbar and the one on every room card jump here
  // instantly rather than smooth-scrolling: this page is long and pinned in
  // several places, so animating down would take many seconds and replay
  // every effect between there and here.
  function jumpToReserve() {
    // The intro locks the document (body.is-intro sets overflow:hidden), so a
    // click during it would otherwise scroll nowhere.
    if (window.unlockScroll) window.unlockScroll();

    // Measure after a refresh: the pins above own a lot of scroll distance,
    // and a stale pin-spacer height puts the target hundreds of pixels off.
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();

    window.scrollTo({
      top: section.getBoundingClientRect().top + window.scrollY,
      behavior: "auto",
    });

    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.update();
    if (window.history && history.replaceState) history.replaceState(null, "", "#contact");
  }

  [].slice.call(document.querySelectorAll(".btn-book, .rooms-cta")).forEach(function (btn) {
    btn.addEventListener("click", jumpToReserve);
  });
});
