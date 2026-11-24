/*
 * proto.js — comportements communs des prototypes, sans dépendance.
 * - état d'écran et calque « hiérarchie » lus dans l'ancre : #etat ou #etat--h ;
 * - région d'annonce unique (Announcer) doublée d'un écho visible dans le bandeau du prototype ;
 * - enregistrement automatique simulé (statut visible, annonce vocale réservée à l'échec) ;
 * - dialogues natifs avec retour du focus ; accordéon à une section ouverte ; panneaux du bas.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function readHash() {
    var parts = (location.hash.slice(1) || "").split("--");
    return { st: parts[0] || document.body.getAttribute("data-default") || "", h: parts[1] === "h" };
  }
  function apply() {
    var s = readHash();
    document.body.setAttribute("data-state", s.st);
    $$("[data-when]").forEach(function (el) { el.hidden = el.getAttribute("data-when").split(" ").indexOf(s.st) === -1; });
    $$("[data-unless]").forEach(function (el) { el.hidden = el.getAttribute("data-unless").split(" ").indexOf(s.st) !== -1; });
    document.body.classList.toggle("show-h", s.h);
    var sel = $("#demo-state"); if (sel) sel.value = s.st;
    var hb = $("#demo-h"); if (hb) hb.setAttribute("aria-pressed", String(s.h));
    document.dispatchEvent(new CustomEvent("proto:state", { detail: s }));
  }
  function setHash(st, h) { location.hash = st + (h ? "--h" : ""); }

  var P = {
    $: $, $$: $$,
    time: function () { var d = new Date(); return d.getHours() + " h " + String(d.getMinutes()).padStart(2, "0"); },
    flash: function (el, strong) {
      if (!el) return; var c = strong ? "is-flash-strong" : "is-flash";
      el.classList.remove(c); void el.offsetWidth; el.classList.add(c);
    },
    announce: function (msg) {
      var r = $("#announcer"); if (r) { r.textContent = ""; setTimeout(function () { r.textContent = msg; }, 60); }
      var e = $("#demo-say"); if (e) { e.textContent = "« " + msg + " »"; P.flash(e.parentNode); }
    },
    openDialog: function (id, opener) {
      var d = document.getElementById(id); if (!d) return;
      d._opener = opener || document.activeElement; d.showModal();
      var f = d.querySelector("[autofocus]"); if (f) f.focus();
    },
    closeDialog: function (d) { if (d && d.open) d.close(); }
  };
  window.P = P;

  document.addEventListener("DOMContentLoaded", function () {
    var sel = $("#demo-state");
    if (sel) sel.addEventListener("change", function () { setHash(sel.value, readHash().h); });
    var hb = $("#demo-h");
    if (hb) hb.addEventListener("click", function () { var s = readHash(); setHash(s.st, !s.h); });
    window.addEventListener("hashchange", apply);
    apply();

    // Dialogues : [data-dialog="id"] ouvre, [data-close] ferme ; le focus revient au déclencheur.
    $$("[data-dialog]").forEach(function (b) { b.addEventListener("click", function () { P.openDialog(b.getAttribute("data-dialog"), b); }); });
    $$("dialog").forEach(function (d) {
      d.addEventListener("close", function () { if (d._opener && d._opener.focus) d._opener.focus(); });
      d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
      $$("[data-close]", d).forEach(function (b) { b.addEventListener("click", function () { d.close(); }); });
    });

    // Panneaux du bas (téléphone) : [data-sheet="id"] ouvre ; Échap ou le voile ferment.
    var openSheets = [];
    $$("[data-sheet]").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = document.getElementById(b.getAttribute("data-sheet")), scrim = $("#scrim");
        s.classList.add("is-open"); if (scrim) scrim.classList.add("is-open");
        s._opener = b; b.setAttribute("aria-expanded", "true"); openSheets.push(s);
        var f = s.querySelector("h2, [tabindex='-1']"); if (f) f.focus();
      });
    });
    function closeSheets() {
      openSheets.splice(0).forEach(function (s) { s.classList.remove("is-open"); if (s._opener) { s._opener.setAttribute("aria-expanded", "false"); s._opener.focus(); } });
      var scrim = $("#scrim"); if (scrim) scrim.classList.remove("is-open");
    }
    $$("[data-sheet-close]").forEach(function (b) { b.addEventListener("click", closeSheets); });
    var scrim = $("#scrim"); if (scrim) scrim.addEventListener("click", closeSheets);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheets(); });

    // Accordéon : une section ouverte à la fois dans un même groupe (profil sur téléphone).
    $$("[data-acc]").forEach(function (b) {
      b.addEventListener("click", function () {
        var panel = document.getElementById(b.getAttribute("aria-controls"));
        var open = b.getAttribute("aria-expanded") === "true";
        var group = b.closest("[data-acc-group]");
        if (group && !open) $$("[data-acc]", group).forEach(function (o) {
          if (o !== b) { o.setAttribute("aria-expanded", "false"); var p = document.getElementById(o.getAttribute("aria-controls")); if (p) p.classList.add("is-collapsed"); }
        });
        b.setAttribute("aria-expanded", String(!open));
        panel.classList.toggle("is-collapsed", open);
        if (!open) { panel.classList.remove("is-entering"); void panel.offsetWidth; panel.classList.add("is-entering"); }
      });
    });

    // Enregistrement automatique : statut visible près de l'action ; seule une erreur est annoncée.
    var timer = null, failNext = false;
    var fail = $("#demo-fail");
    if (fail) fail.addEventListener("click", function () { failNext = !failNext; fail.setAttribute("aria-pressed", String(failNext)); });
    function setSave(kind) {
      $$("[data-save]").forEach(function (el) {
        var txt = el.querySelector("[data-save-text]"), ico = el.querySelector("use");
        el.setAttribute("data-kind", kind);
        if (kind === "saving") { txt.textContent = "Enregistrement…"; if (ico) ico.setAttribute("href", "#i-refresh-cw"); }
        if (kind === "saved") { txt.textContent = "Enregistré à " + P.time(); if (ico) ico.setAttribute("href", "#i-check"); }
        if (kind === "failed") { txt.textContent = "Non enregistré — nouvelle tentative dans 5 s"; if (ico) ico.setAttribute("href", "#i-circle-alert"); }
        var retry = el.querySelector("[data-retry]"); if (retry) retry.hidden = kind !== "failed";
      });
    }
    $$("[data-autosave]").forEach(function (f) {
      f.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          setSave("saving");
          setTimeout(function () {
            if (failNext) { setSave("failed"); P.announce("Modifications non enregistrées. Nouvelle tentative dans 5 secondes."); }
            else setSave("saved");
          }, 500);
        }, 600);
      });
    });
    $$("[data-retry]").forEach(function (b) {
      b.addEventListener("click", function () {
        failNext = false; if (fail) fail.setAttribute("aria-pressed", "false");
        setSave("saving"); setTimeout(function () { setSave("saved"); P.announce("Modifications enregistrées."); }, 500);
      });
    });
  });
})();
