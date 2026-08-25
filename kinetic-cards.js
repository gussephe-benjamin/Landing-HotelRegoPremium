/* Lightbox for the closing section's two photographs.

   Built on a native <dialog> opened with showModal(), which brings the focus
   trap, the Escape key, the inert page behind it and the ::backdrop for free.
   Writing those by hand is where hand-rolled lightboxes usually go wrong —
   focus escapes to the page underneath and keyboard users are stranded. */
document.addEventListener("DOMContentLoaded", function () {
  var dialog = document.querySelector(".kc-lightbox");
  var zooms = [].slice.call(document.querySelectorAll(".kc-zoom"));
  if (!dialog || !zooms.length) return;

  // Without showModal there is no focus trap to inherit, and a half-working
  // modal is worse than none: the buttons are removed so nothing advertises a
  // control that cannot be escaped.
  if (typeof dialog.showModal !== "function") {
    zooms.forEach(function (b) {
      b.remove();
    });
    return;
  }

  var closeBtn = dialog.querySelector(".kc-lightbox__close");

  // Built on demand, not in the markup and not at setup: a picture element
  // with no src is a broken image in the document even while the dialog
  // holding it stays closed. Created on the first open and reused after that,
  // so opening the second photograph does not accumulate elements.
  var img = null;
  function ensureImg() {
    if (img) return img;
    img = document.createElement("img");
    dialog.appendChild(img);
    return img;
  }

  zooms.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".kc-card");
      var source = card && card.querySelector("img");
      ensureImg();
      img.src = btn.getAttribute("data-full");
      // The card's own alt already describes the photograph; repeating it here
      // keeps the enlarged copy from being announced as an unlabelled image.
      img.alt = source ? source.getAttribute("alt") || "" : "";
      dialog.showModal();
    });
  });

  function release() {
    // Dropped so a large photograph is not held in memory for the rest of the
    // session once it has been dismissed. Guarded because the dialog can be
    // dismissed before it has ever been opened — Escape on a focused control,
    // for one.
    if (img) img.removeAttribute("src");
  }

  function dismiss() {
    dialog.close();
    release();
  }

  closeBtn.addEventListener("click", dismiss);

  // Click outside the picture. The dialog's own box is the full modal area, so
  // a plain target check would also catch the image; comparing against the
  // image's rect is what distinguishes the backdrop from the content.
  dialog.addEventListener("click", function (e) {
    if (!img) return;
    var r = img.getBoundingClientRect();
    var outside =
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) dismiss();
  });

  // Backstop for Escape, which closes the dialog without passing through
  // either handler above. Both events are listened for rather than just
  // `close`: `close` did not fire at all in the environment this was built in,
  // and `cancel` is the one Escape raises first — between them the picture is
  // released however the dialog was dismissed.
  dialog.addEventListener("cancel", release);
  dialog.addEventListener("close", release);
});
