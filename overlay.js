(function () {
  var WORDS = ["vivir", "quedarte", "volver", "respirar"];
  var INTERVAL = 3000;
  var TRANSITION = 700;
  var LETTER_STAGGER = 25;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function buildLetters(word) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < word.length; i++) {
      var span = document.createElement("span");
      span.className = "wr-letter";
      span.style.transitionDelay = prefersReducedMotion ? "0ms" : i * LETTER_STAGGER + "ms";
      span.textContent = word[i];
      frag.appendChild(span);
    }
    return frag;
  }

  function makeTrack(word) {
    var track = document.createElement("span");
    track.className = "wr-track";
    track.appendChild(buildLetters(word));
    return track;
  }

  // Measures the natural width of a word by mounting a hidden probe inside
  // the rotator, so the wrapper's CSS width transition never guesses/jumps.
  function measureWidth(rotator, word) {
    var probe = makeTrack(word);
    probe.style.visibility = "hidden";
    probe.style.transform = "none";
    rotator.appendChild(probe);
    var width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  }

  function initWordRotator() {
    var rotator = document.getElementById("wordRotator");
    if (!rotator || rotator.dataset.initialized) return;
    rotator.dataset.initialized = "true";

    var index = 0;
    var currentTrack = makeTrack(WORDS[0]);
    rotator.appendChild(currentTrack);
    rotator.style.width = measureWidth(rotator, WORDS[0]) + "px";

    requestAnimationFrame(function () {
      var letters = currentTrack.querySelectorAll(".wr-letter");
      for (var i = 0; i < letters.length; i++) letters[i].classList.add("wr-in");
    });

    if (prefersReducedMotion) return;

    setInterval(function () {
      index = (index + 1) % WORDS.length;
      var nextWord = WORDS[index];
      var nextWidth = measureWidth(rotator, nextWord);

      var outgoing = currentTrack;
      outgoing.classList.add("wr-leaving");

      var incoming = makeTrack(nextWord);
      incoming.classList.add("wr-entering");
      if (!isMobile()) incoming.classList.add("wr-blur");
      rotator.appendChild(incoming);
      rotator.style.width = nextWidth + "px";

      // Double rAF: let the entering state paint once before removing it,
      // otherwise the browser collapses start/end styles into one frame
      // and the slide-up/blur transition never plays.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          incoming.classList.remove("wr-entering");
          var letters = incoming.querySelectorAll(".wr-letter");
          for (var i = 0; i < letters.length; i++) letters[i].classList.add("wr-in");
        });
      });

      currentTrack = incoming;
      setTimeout(function () {
        outgoing.remove();
      }, TRANSITION + 150);
    }, INTERVAL);
  }

  function revealOverlay() {
    var overlay = document.getElementById("heroOverlay");
    if (!overlay) return;
    overlay.classList.add("is-revealed");
    initWordRotator();
  }

  window.initHeroOverlay = revealOverlay;
})();
