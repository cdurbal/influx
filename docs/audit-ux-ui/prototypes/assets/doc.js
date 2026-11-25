/*
 * doc.js — bloc de comparaison des pages de présentation.
 * À gauche, la capture de l'audit (docs/audit-ux-ui/captures) ; à droite, le prototype dans un cadre
 * iframe à la vraie largeur d'écran (1 440 × 900 ou 390 × 844), mis à l'échelle de la colonne : ses
 * requêtes média réagissent comme sur un vrai écran. Changer d'état ne recharge pas le prototype.
 */
(function () {
  "use strict";
  var SIZES = { desktop: [1440, 900], narrow: [1180, 860], phone: [390, 844] };
  function setCapture(img, name) {
    img.onerror = function () { if (!img.getAttribute("data-retried")) { img.setAttribute("data-retried", "1"); img.src = "../captures/" + name; } };
    img.removeAttribute("data-retried");
    img.src = "captures/" + name;
  }
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-compare]"), function (c) {
      var frame = c.querySelector(".d-frame"), ifr = frame.querySelector("iframe");
      var shot = c.querySelector(".d-shot"), img = shot.querySelector("img"), none = c.querySelector(".d-none");
      var open = c.querySelector("[data-open]"), capLabel = c.querySelector("[data-cap-label]");
      var base = ifr.getAttribute("data-src"), pressed = c.querySelector("[data-mode][aria-pressed='true']"), mode = pressed ? pressed.getAttribute("data-mode") : "desktop", hier = false;
      c.setAttribute("data-mode", mode);
      var current = function () { return c.querySelector("[data-st][aria-pressed='true']"); };
      function hash() { return "#" + current().getAttribute("data-st") + (hier ? "--h" : ""); }
      function fit() {
        var s = SIZES[mode], scale = Math.min(1, frame.clientWidth / s[0]);
        ifr.style.width = s[0] + "px"; ifr.style.height = s[1] + "px";
        ifr.style.transform = "scale(" + scale + ")";
        frame.style.height = Math.round(s[1] * scale) + "px";
        shot.style.height = none.style.height = Math.round(s[1] * scale) + "px";
      }
      function capture() {
        var b = current(), name = mode === "phone" ? b.getAttribute("data-cap-m") : b.getAttribute("data-cap");
        shot.hidden = !name; none.hidden = !!name;
        if (name) { setCapture(img, name); img.alt = "Capture de l'écran actuel : " + b.textContent.trim(); shot.scrollTop = 0; }
        capLabel.textContent = name ? "capture " + name.replace(/\.jpg$/, "") : "pas de capture à cette largeur";
      }
      function go() { ifr.src = base + hash(); open.href = base + hash(); }
      Array.prototype.forEach.call(c.querySelectorAll("[data-st]"), function (b) {
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(c.querySelectorAll("[data-st]"), function (o) { o.setAttribute("aria-pressed", String(o === b)); });
          go(); capture();
        });
      });
      Array.prototype.forEach.call(c.querySelectorAll("[data-mode]"), function (b) {
        b.addEventListener("click", function () {
          mode = b.getAttribute("data-mode"); c.setAttribute("data-mode", mode);
          Array.prototype.forEach.call(c.querySelectorAll("[data-mode]"), function (o) { o.setAttribute("aria-pressed", String(o === b)); });
          requestAnimationFrame(function () { fit(); capture(); });
        });
      });
      var hb = c.querySelector("[data-hier]");
      if (hb) hb.addEventListener("click", function () { hier = !hier; hb.setAttribute("aria-pressed", String(hier)); go(); });
      window.addEventListener("resize", fit);
      fit(); go(); capture();
    });
  });
})();
