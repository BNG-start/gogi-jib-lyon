/* Gogi Jib — en-tête, menu, statut d'ouverture, horaires du jour, réservation par SMS */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var TEL = "+33648678767";
  var header = document.querySelector(".header");
  var burger = document.querySelector(".burger");
  var nav = document.getElementById("nav");
  var fab = document.querySelector(".fab");
  var reserve = document.getElementById("reserver");

  /* En-tête + bouton flottant au défilement */
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 30);
    var r = reserve.getBoundingClientRect();
    var inReserve = r.top < window.innerHeight * 0.8 && r.bottom > 0;
    fab.classList.toggle("is-visible", y > window.innerHeight * 0.7 && !inReserve);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Menu mobile */
  function setMenu(open) {
    header.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    document.body.style.overflow = open ? "hidden" : "";
  }
  burger.addEventListener("click", function () { setMenu(!header.classList.contains("is-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  window.addEventListener("resize", function () { if (window.innerWidth >= 960) setMenu(false); });

  /* Horaires (heure de Lyon). Tous les jours : 12h–14h30 et 19h–22h30, samedi soir jusqu'à 23h. */
  function serviceHours(day) {
    return [[12, 14.5], [19, day === 6 ? 23 : 22.5]];
  }
  function fmt(h) {
    var m = Math.round((h % 1) * 60);
    return Math.floor(h) + "h" + (m ? String(m).padStart(2, "0") : "");
  }
  function lyonNow() {
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    var get = function (t) { return parts.find(function (p) { return p.type === t; }).value; };
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[get("weekday")], h: Number(get("hour")) % 24 + Number(get("minute")) / 60 };
  }

  function updateStatus() {
    var now = lyonNow();
    var slots = serviceHours(now.day);
    var text = "", open = false;
    for (var i = 0; i < slots.length; i++) {
      if (now.h >= slots[i][0] && now.h < slots[i][1]) { open = true; text = "Ouvert maintenant · jusqu’à " + fmt(slots[i][1]); break; }
      if (now.h < slots[i][0]) { text = "Fermé · ouvre à " + fmt(slots[i][0]); break; }
    }
    if (!text) text = "Fermé · ouvre demain à 12h";

    document.querySelectorAll("[data-status-text]").forEach(function (el) { el.textContent = text; });
    document.querySelectorAll("[data-status]").forEach(function (el) { el.classList.toggle("is-open", open); });
    document.querySelectorAll(".hours tr").forEach(function (tr) {
      tr.classList.toggle("is-today", Number(tr.getAttribute("data-day")) === now.day);
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* Réservation : créneaux, nombre de personnes, envoi par SMS */
  var form = document.getElementById("form");
  var error = document.getElementById("form-error");
  var dateInput = document.getElementById("date");
  var service = document.getElementById("service");
  var slotsBox = document.querySelector("[data-slots]");
  var persOut = document.getElementById("pers");
  var persons = 2;
  var heure = "";

  var SLOTS = {
    midi: ["12h00", "12h30", "13h00", "13h30", "14h00"],
    soir: ["19h00", "19h30", "20h00", "20h30", "21h00", "21h30", "22h00"]
  };

  var d = new Date();
  dateInput.min = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  function renderSlots() {
    var list = SLOTS[service.value];
    heure = "";
    slotsBox.innerHTML = "";
    list.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = s;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.addEventListener("click", function () {
        heure = s;
        slotsBox.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      });
      slotsBox.appendChild(b);
    });
  }
  service.addEventListener("change", renderSlots);
  renderSlots();

  form.querySelectorAll("[data-step]").forEach(function (b) {
    b.addEventListener("click", function () {
      persons = Math.min(30, Math.max(1, persons + Number(b.getAttribute("data-step"))));
      persOut.textContent = persons;
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    error.textContent = "";
    var f = form.elements;
    var nom = f.nom.value.trim();
    var tel = f.tel.value.trim();
    var date = f.date.value;

    if (!nom || tel.replace(/\D/g, "").length < 9 || !date) {
      error.textContent = "Merci d’indiquer votre nom, un numéro de téléphone valide et la date.";
      return;
    }
    if (!heure) {
      error.textContent = "Choisissez une heure d’arrivée.";
      return;
    }
    var dateFr = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    var lines = [
      "Bonjour Gogi Jib, je souhaite réserver :",
      nom + " · " + persons + " pers.",
      dateFr + " à " + heure,
      "Tél : " + tel
    ];
    if (f.message.value.trim()) lines.push(f.message.value.trim());
    var body = encodeURIComponent(lines.join("\n"));
    var sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? "&" : "?";
    window.location.href = "sms:" + TEL + sep + "body=" + body;
  });

  /* Apparitions au défilement */
  var items = document.querySelectorAll(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) {
      var i = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = Math.min(i, 4) * 90 + "ms";
      io.observe(el);
    });
  }

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
