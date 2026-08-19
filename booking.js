/* Booking widget.

   Vanilla port of the supplied React spec: no Vite/Tailwind/Framer Motion, and
   no date-fns — the calendar is built by hand against native Date, which the
   spec allows. Motion is GSAP, already on the page.

   ── Mocked data, ready to swap for a real availability call ──────────── */
var BK_UNITS = {
  suite: { label: "Suite", capacity: 4, area: 45, rate: 310 },
  loft: { label: "Loft", capacity: 2, area: 32, rate: 260 },
};

/* ISO dates the calendar refuses. Replace with the response of an
   availability endpoint; the shape is all this code depends on. */
var BK_BLOCKED = [
  "2026-08-24", "2026-08-25", "2026-08-26",
  "2026-09-11", "2026-09-12",
  "2026-10-02", "2026-10-03", "2026-10-04",
];

var BK_MAX_GUESTS = 6;
var BK_MIN_GUESTS = 1;
var BK_REPLY_HOURS = 2;
var BK_WA_NUMBER = "51990669259";

/* Flip to simulate the network failing, to exercise the error banner. */
var BK_FAIL = false;

document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".bk");
  if (!root) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  var DAYS_SHORT = ["dom","lun","mar","mié","jue","vie","sáb"];
  var WEEK = ["lu","ma","mi","ju","vi","sá","do"];

  // ── Date helpers ─────────────────────────────────────────────────────
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  var TODAY = midnight(new Date());

  function iso(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function sameDay(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function nightsBetween(a, b) {
    // Built from calendar days, not elapsed milliseconds: across a DST shift a
    // ms-based division returns 3.958 nights and floors to the wrong number.
    return Math.round((b - a) / 86400000);
  }
  function fmtLong(d) { return DAYS_SHORT[d.getDay()] + " " + d.getDate() + " " + MONTHS_SHORT[d.getMonth()]; }
  function isBlocked(d) { return BK_BLOCKED.indexOf(iso(d)) > -1; }
  function isDisabled(d) { return d < TODAY || isBlocked(d); }

  // ── State ────────────────────────────────────────────────────────────
  var state = {
    checkin: null,
    checkout: null,
    guests: 2,
    unit: "suite",
    picking: null,        // "in" | "out" | null — which half is being chosen
    anchor: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
    hover: null,
    focus: null,
    sending: false,
  };

  // ── Elements ─────────────────────────────────────────────────────────
  var q = function (sel) { return root.querySelector(sel); };
  var qa = function (sel) { return [].slice.call(root.querySelectorAll(sel)); };

  var main = q(".bk-main");
  var done = q(".bk-done");
  var form = q(".bk-form");
  var dates = q(".bk-dates");
  var dateBtns = qa(".bk-date");
  var calWrap = q(".bk-cal-wrap");
  var cal = q(".bk-cal");
  var calTitle = q(".bk-cal-title");
  var calMonths = q(".bk-cal-months");
  var calHint = q(".bk-cal-hint");
  var errDates = q("#bk-err-dates");
  var stepVal = q(".bk-step-val");
  var stepBtns = qa(".bk-step");
  var pills = qa(".bk-pill");
  var unitNote = q(".bk-unit-note");
  var summary = q(".bk-summary");
  var sumNights = q(".bk-sum-nights");
  var sumRange = q(".bk-sum-range");
  var priceEl = q(".bk-price");
  var contact = q(".bk-contact");
  var reveals = qa(".bk-reveal");
  var banner = q(".bk-banner");
  var submit = q(".bk-submit");
  var submitText = q(".bk-submit-text");
  var waLink = q(".bk-wa");
  var extraToggle = q(".bk-extra-toggle");
  var extra = q(".bk-extra");
  var nameI = q("#bk-name");
  var mailI = q("#bk-email");
  var telI = q("#bk-wa");
  var msgI = q("#bk-msg");

  var twoUp = window.matchMedia("(min-width: 720px)");

  // ── Calendar rendering ───────────────────────────────────────────────
  function monthGrid(base) {
    var wrap = document.createElement("div");

    var cap = document.createElement("p");
    cap.className = "bk-month-cap";
    cap.textContent = MONTHS[base.getMonth()] + " " + base.getFullYear();
    wrap.appendChild(cap);

    var head = document.createElement("div");
    head.className = "bk-week";
    head.setAttribute("aria-hidden", "true");
    WEEK.forEach(function (w) {
      var s = document.createElement("span");
      s.textContent = w;
      head.appendChild(s);
    });
    wrap.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "bk-days";

    // Monday-first: JS getDay() is Sunday-first, so shift by 6 and wrap.
    var lead = (new Date(base.getFullYear(), base.getMonth(), 1).getDay() + 6) % 7;
    for (var i = 0; i < lead; i++) {
      var blank = document.createElement("span");
      blank.className = "bk-day is-blank";
      grid.appendChild(blank);
    }

    var total = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    for (var d = 1; d <= total; d++) {
      var date = new Date(base.getFullYear(), base.getMonth(), d);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bk-day";
      btn.dataset.iso = iso(date);
      btn.disabled = isDisabled(date);
      btn.setAttribute("aria-label", date.getDate() + " de " + MONTHS[date.getMonth()] + " de " + date.getFullYear());
      btn.tabIndex = -1;
      var i2 = document.createElement("i");
      i2.textContent = String(d);
      btn.appendChild(i2);
      grid.appendChild(btn);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function renderCal() {
    calMonths.innerHTML = "";
    var count = twoUp.matches ? 2 : 1;
    for (var m = 0; m < count; m++) {
      calMonths.appendChild(monthGrid(addMonths(state.anchor, m)));
    }

    var last = addMonths(state.anchor, count - 1);
    calTitle.textContent = count === 2
      ? MONTHS[state.anchor.getMonth()] + " — " + MONTHS[last.getMonth()] + " " + last.getFullYear()
      : MONTHS[state.anchor.getMonth()] + " " + state.anchor.getFullYear();

    // Never let the visitor page back before the current month.
    var prev = q('.bk-cal-nav[data-dir="-1"]');
    prev.disabled = state.anchor <= new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);

    calHint.textContent = state.picking === "out"
      ? "Elige la fecha de salida"
      : "Elige la fecha de llegada";

    paintCal();
  }

  // Range shading is recomputed on every hover, so it is kept separate from
  // the DOM build above — rebuilding the grids on mousemove would thrash.
  function paintCal() {
    var start = state.checkin;
    var end = state.checkout;
    // While picking the checkout, the hovered day previews the range end.
    if (state.picking === "out" && start && !end && state.hover && state.hover > start) {
      end = state.hover;
    }

    qa(".bk-day").forEach(function (btn) {
      if (!btn.dataset.iso) return;
      var parts = btn.dataset.iso.split("-");
      var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);

      btn.classList.toggle("is-today", sameDay(d, TODAY));
      var isStart = sameDay(d, start);
      var isEnd = sameDay(d, end);
      var inside = !!(start && end && d > start && d < end);

      btn.classList.toggle("is-start", isStart);
      btn.classList.toggle("is-end", isEnd);
      btn.classList.toggle("in-range", isStart || isEnd || inside);
      if (isStart || isEnd) btn.setAttribute("aria-current", "date");
      else btn.removeAttribute("aria-current");

      var focused = sameDay(d, state.focus);
      btn.tabIndex = focused ? 0 : -1;
    });
  }

  // ── Open / close ─────────────────────────────────────────────────────
  function openCal(which) {
    state.picking = which;
    state.focus = which === "out" && state.checkin ? state.checkin : (state.checkin || TODAY);
    // Jump the view to the month holding the relevant date.
    state.anchor = new Date(state.focus.getFullYear(), state.focus.getMonth(), 1);

    dates.dataset.open = "1";
    dateBtns.forEach(function (b) {
      var on = b.dataset.which === which;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });

    renderCal();

    var h = cal.offsetHeight;
    gsap.killTweensOf(calWrap);
    if (reduced) {
      gsap.set(calWrap, { height: "auto" });
    } else {
      gsap.fromTo(calWrap, { height: calWrap.offsetHeight },
        { height: h, duration: 0.28, ease: "power2.out",
          onComplete: function () { gsap.set(calWrap, { height: "auto" }); } });
    }
  }

  function closeCal() {
    state.picking = null;
    state.hover = null;
    delete dates.dataset.open;
    dateBtns.forEach(function (b) {
      b.classList.remove("is-active");
      b.setAttribute("aria-expanded", "false");
    });

    gsap.killTweensOf(calWrap);
    if (reduced) {
      gsap.set(calWrap, { height: 0 });
    } else {
      gsap.to(calWrap, { height: 0, duration: 0.24, ease: "power2.in" });
    }
  }

  // ── Selection ────────────────────────────────────────────────────────
  function pick(d, btn) {
    if (isDisabled(d)) return;

    if (state.picking === "in" || !state.checkin || d <= state.checkin) {
      // Starting over: a click on or before the current arrival resets the range.
      state.checkin = d;
      state.checkout = null;
      state.picking = "out";
      state.focus = d;
      calHint.textContent = "Elige la fecha de salida";
    } else {
      state.checkout = d;
      state.picking = null;
      state.focus = d;
    }

    if (btn && !reduced) gsap.fromTo(btn, { scale: 0.96 }, { scale: 1, duration: 0.25, ease: "power2.out" });

    clearError(errDates);
    paintCal();
    syncDates();
    syncSummary();
    syncGate();

    if (state.checkin && state.checkout) closeCal();
  }

  function syncDates() {
    dateBtns.forEach(function (b) {
      var v = b.querySelector(".bk-date-value");
      var d = b.dataset.which === "in" ? state.checkin : state.checkout;
      v.textContent = d ? fmtLong(d) : "Selecciona";
      v.classList.toggle("is-empty", !d);
    });
  }

  // ── Live summary ─────────────────────────────────────────────────────
  var shownPrice = 0;

  function syncSummary() {
    var ready = state.checkin && state.checkout;

    if (!ready) {
      if (!summary.hidden) {
        if (reduced) { summary.hidden = true; }
        else {
          gsap.to(summary, { opacity: 0, y: 8, duration: 0.2, ease: "power2.in",
            onComplete: function () { summary.hidden = true; } });
        }
      }
      shownPrice = 0;
      return;
    }

    var n = nightsBetween(state.checkin, state.checkout);
    sumNights.textContent = n + (n === 1 ? " noche" : " noches");
    sumRange.textContent = state.checkin.getDate() + "–" + state.checkout.getDate() + " " + MONTHS_SHORT[state.checkout.getMonth()];

    var target = n * BK_UNITS[state.unit].rate;

    var appearing = summary.hidden;
    if (appearing) {
      summary.hidden = false;
      if (reduced) gsap.set(summary, { opacity: 1, y: 0 });
      else gsap.fromTo(summary, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" });
    }

    // The price interpolates rather than snapping, so a changed night count
    // reads as the total moving instead of a new number appearing.
    if (reduced || appearing) {
      shownPrice = target;
      priceEl.textContent = target.toLocaleString("es-PE");
    } else {
      var proxy = { v: shownPrice };
      gsap.killTweensOf(proxy);
      gsap.to(proxy, {
        v: target, duration: 0.5, ease: "power2.out",
        onUpdate: function () { priceEl.textContent = Math.round(proxy.v).toLocaleString("es-PE"); },
        onComplete: function () { shownPrice = target; },
      });
    }

    syncWa();
  }

  function syncWa() {
    var txt = "Hola, consulto por REGO Premium";
    if (state.checkin && state.checkout) {
      txt += " para el " + state.checkin.getDate() + "-" + state.checkout.getDate() +
        " " + MONTHS_SHORT[state.checkout.getMonth()];
    }
    txt += " para " + state.guests + (state.guests === 1 ? " persona" : " personas") +
      " (" + BK_UNITS[state.unit].label + ")";
    waLink.href = "https://wa.me/" + BK_WA_NUMBER + "?text=" + encodeURIComponent(txt);
  }

  // ── Guests + unit ────────────────────────────────────────────────────
  function syncUnit() {
    var u = BK_UNITS[state.unit];
    var over = state.guests > u.capacity;
    unitNote.textContent = over
      ? "Hasta " + u.capacity + " personas · para " + state.guests + " te proponemos dos unidades"
      : "Hasta " + u.capacity + " personas · " + u.area + " m²";
    unitNote.classList.toggle("is-warn", over);

    pills.forEach(function (p) {
      var on = p.dataset.unit === state.unit;
      p.setAttribute("aria-checked", on ? "true" : "false");
      p.tabIndex = on ? 0 : -1;
    });

    stepBtns.forEach(function (b) {
      b.disabled = +b.dataset.step < 0 ? state.guests <= BK_MIN_GUESTS : state.guests >= BK_MAX_GUESTS;
    });
    stepVal.textContent = state.guests;
  }

  // ── Progressive disclosure of the contact fields ─────────────────────
  var contactShown = false;

  function syncGate() {
    var datesOk = !!(state.checkin && state.checkout);

    if (datesOk && !contactShown) {
      contactShown = true;
      contact.hidden = false;
      if (reduced) {
        gsap.set(reveals, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(reveals,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power2.out" });
      }
    }

    if (state.sending) return;

    var filled = nameI.value.trim() && mailI.value.trim() && telI.value.trim();
    if (!datesOk) {
      submitText.textContent = "Selecciona tus fechas";
      submit.disabled = true;
    } else if (!filled) {
      submitText.textContent = "Completa tus datos";
      submit.disabled = true;
    } else {
      submitText.textContent = "Consultar disponibilidad";
      submit.disabled = false;
    }
  }

  // ── Validation ───────────────────────────────────────────────────────
  var MAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function errSlot(input) {
    var field = input.closest(".bk-reveal") || input.parentElement;
    return field ? field.querySelector(".bk-err") : null;
  }
  function setError(input, msg) {
    var slot = errSlot(input);
    if (slot) slot.textContent = msg;
    input.setAttribute("aria-invalid", "true");
    var tel = input.closest(".bk-tel");
    if (tel) tel.dataset.invalid = "1";
  }
  function clearError(target) {
    if (!target) return;
    if (target.classList && target.classList.contains("bk-err")) { target.textContent = ""; return; }
    var slot = errSlot(target);
    if (slot) slot.textContent = "";
    target.removeAttribute("aria-invalid");
    var tel = target.closest && target.closest(".bk-tel");
    if (tel) delete tel.dataset.invalid;
  }

  function validate(input) {
    var v = input.value.trim();
    if (input === nameI) {
      if (!v) return "Escribe tu nombre.";
      if (v.length < 3) return "El nombre parece muy corto.";
      return "";
    }
    if (input === mailI) {
      if (!v) return "Escribe tu email.";
      if (!MAIL_RE.test(v)) return "Ese email no parece válido.";
      return "";
    }
    if (input === telI) {
      var digits = v.replace(/\D/g, "");
      if (!digits) return "Escribe tu número.";
      if (digits.length !== 9) return "El número debe tener 9 dígitos.";
      return "";
    }
    return "";
  }

  // Validated on blur, never per keystroke; the error clears as soon as the
  // visitor starts correcting it.
  [nameI, mailI, telI].forEach(function (input) {
    input.addEventListener("blur", function () {
      var msg = validate(input);
      if (msg) setError(input, msg); else clearError(input);
    });
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid")) clearError(input);
      syncGate();
    });
  });

  // ── Events ───────────────────────────────────────────────────────────
  dateBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var which = b.dataset.which;
      if (state.picking === which) closeCal();
      else openCal(which);
    });
  });

  qa(".bk-cal-nav").forEach(function (b) {
    b.addEventListener("click", function () {
      state.anchor = addMonths(state.anchor, +b.dataset.dir);
      renderCal();
      if (!reduced) gsap.fromTo(calMonths, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" });
    });
  });

  calMonths.addEventListener("click", function (e) {
    var btn = e.target.closest(".bk-day");
    if (!btn || !btn.dataset.iso || btn.disabled) return;
    var p = btn.dataset.iso.split("-");
    pick(new Date(+p[0], +p[1] - 1, +p[2]), btn);
  });

  calMonths.addEventListener("mouseover", function (e) {
    var btn = e.target.closest(".bk-day");
    if (!btn || !btn.dataset.iso || btn.disabled) return;
    var p = btn.dataset.iso.split("-");
    state.hover = new Date(+p[0], +p[1] - 1, +p[2]);
    paintCal();
  });
  calMonths.addEventListener("mouseleave", function () {
    state.hover = null;
    paintCal();
  });

  // Keyboard: arrows walk the grid, Enter picks, Esc closes.
  cal.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeCal(); dates.querySelector('.bk-date[data-which="' + "in" + '"]').focus(); return; }
    if (!state.focus) return;

    var delta = 0;
    if (e.key === "ArrowLeft") delta = -1;
    else if (e.key === "ArrowRight") delta = 1;
    else if (e.key === "ArrowUp") delta = -7;
    else if (e.key === "ArrowDown") delta = 7;
    else if (e.key === "Enter" || e.key === " ") {
      if (e.target.classList.contains("bk-day")) return; // native click handles it
      return;
    } else return;

    e.preventDefault();

    // Keep stepping in the same direction past unavailable days. A disabled
    // button cannot take focus, so landing on one left the DOM focus behind
    // while the state moved on — the arrows appeared to stop responding.
    var next = addDays(state.focus, delta);
    var guard = 0;
    while (isDisabled(next) && guard++ < 400) next = addDays(next, delta);
    // Walking backwards eventually hits the past, which is disabled all the
    // way down; there is nothing to land on, so the move is abandoned.
    if (isDisabled(next)) return;

    state.focus = next;

    // Page the view when the focus walks out of the rendered months.
    var count = twoUp.matches ? 2 : 1;
    var firstShown = state.anchor;
    var lastShown = new Date(addMonths(state.anchor, count - 1).getFullYear(), addMonths(state.anchor, count - 1).getMonth() + 1, 0);
    if (next < firstShown || next > lastShown) {
      state.anchor = new Date(next.getFullYear(), next.getMonth(), 1);
      renderCal();
    } else {
      paintCal();
    }

    var el = calMonths.querySelector('.bk-day[data-iso="' + iso(next) + '"]');
    if (el) el.focus();
  });

  stepBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var n = state.guests + (+b.dataset.step);
      state.guests = Math.min(BK_MAX_GUESTS, Math.max(BK_MIN_GUESTS, n));
      syncUnit();
      syncWa();
      syncGate();
    });
  });

  pills.forEach(function (p) {
    p.addEventListener("click", function () {
      state.unit = p.dataset.unit;
      syncUnit();
      syncSummary();
    });
    // Arrow keys move between radios, as a real radiogroup does.
    p.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      var i = pills.indexOf(p);
      var next = pills[(i + (e.key === "ArrowRight" ? 1 : pills.length - 1)) % pills.length];
      next.click();
      next.focus();
    });
  });

  extraToggle.addEventListener("click", function () {
    var open = extraToggle.getAttribute("aria-expanded") === "true";
    extraToggle.setAttribute("aria-expanded", open ? "false" : "true");
    extraToggle.textContent = open ? "+ Agregar un pedido especial" : "− Quitar el pedido especial";
    gsap.killTweensOf(extra);
    if (open) {
      gsap.to(extra, { height: 0, duration: 0.24, ease: "power2.in" });
    } else {
      gsap.set(extra, { height: "auto" });
      var h = extra.offsetHeight;
      gsap.fromTo(extra, { height: 0 }, { height: h, duration: 0.28, ease: "power2.out",
        onComplete: function () { gsap.set(extra, { height: "auto" }); msgI.focus(); } });
    }
  });

  // ── Submit ───────────────────────────────────────────────────────────
  function setBusy(busy) {
    state.sending = busy;
    // Scoped to the form, not the whole card. Disabling every button inside
    // .bk also killed the success panel's "Hacer otra consulta" — and since
    // the happy path never calls setBusy(false), it stayed dead permanently.
    [].slice.call(form.querySelectorAll("input, textarea, button")).forEach(function (el) {
      if (el === submit) return;
      el.disabled = busy;
    });
    if (busy) {
      submit.disabled = true;
      submitText.textContent = "Enviando…";
      if (!q(".bk-spin")) submit.insertBefore(Object.assign(document.createElement("span"), { className: "bk-spin" }), submitText);
    } else {
      var sp = q(".bk-spin");
      if (sp) sp.remove();
      syncUnit();
      syncGate();
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.sending) return;

    banner.hidden = true;

    var bad = null;
    [nameI, mailI, telI].forEach(function (input) {
      var msg = validate(input);
      if (msg) { setError(input, msg); if (!bad) bad = input; }
    });
    if (!state.checkin || !state.checkout) {
      errDates.textContent = "Elige las fechas de llegada y salida.";
      if (!bad) bad = dateBtns[0];
    }
    if (bad) { bad.focus(); return; }

    setBusy(true);

    // Stand-in for the real request.
    setTimeout(function () {
      if (BK_FAIL) {
        setBusy(false);
        banner.hidden = false;
        banner.textContent = "No pudimos enviar la consulta. Revisa tu conexión e inténtalo otra vez.";
        return;
      }
      showDone();
    }, 1400);
  });

  function showDone() {
    q(".bk-done-mail").textContent = mailI.value.trim();
    var by = new Date(Date.now() + BK_REPLY_HOURS * 3600000);
    q(".bk-done-time").textContent =
      String(by.getHours()).padStart(2, "0") + ":" + String(by.getMinutes()).padStart(2, "0");

    done.hidden = false;
    if (reduced) {
      main.hidden = true;
      gsap.set(done, { opacity: 1 });
      return;
    }

    var tl = gsap.timeline();
    tl.to(main, { opacity: 0, duration: 0.3, ease: "power2.in",
        onComplete: function () { main.hidden = true; } })
      .fromTo(done, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" });

    // The check is drawn rather than faded: dash offset run down to zero.
    var circle = q(".bk-check circle");
    var tick = q(".bk-check path");
    [circle, tick].forEach(function (el) {
      var len = el.getTotalLength();
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    });
    tl.to(circle, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, "-=0.2")
      .to(tick, { strokeDashoffset: 0, duration: 0.35, ease: "power2.out" }, "-=0.15");
  }

  q(".bk-again").addEventListener("click", function () {
    state.checkin = state.checkout = state.hover = state.focus = null;
    state.picking = null;
    state.guests = 2;
    state.unit = "suite";
    state.anchor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    contactShown = false;

    form.reset();
    [nameI, mailI, telI].forEach(clearError);
    errDates.textContent = "";
    banner.hidden = true;
    contact.hidden = true;
    summary.hidden = true;
    extra.style.height = "0px";
    extraToggle.setAttribute("aria-expanded", "false");
    extraToggle.textContent = "+ Agregar un pedido especial";

    setBusy(false);
    syncDates();
    syncUnit();
    syncSummary();
    syncGate();

    done.hidden = true;
    main.hidden = false;
    if (reduced) { gsap.set(main, { opacity: 1 }); return; }
    gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" });
  });

  // Re-lay the calendar when crossing the one/two month breakpoint.
  twoUp.addEventListener("change", function () { if (state.picking) { renderCal(); gsap.set(calWrap, { height: "auto" }); } });

  // ── Init ─────────────────────────────────────────────────────────────
  gsap.set(calWrap, { height: 0 });
  gsap.set(extra, { height: 0 });
  syncDates();
  syncUnit();
  syncWa();
  syncGate();
});
