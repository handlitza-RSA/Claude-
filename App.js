/* HandlT front-end behaviour
   ------------------------------------------------------------------
   Keep this layer thin and framework-free so it can later be swapped
   for a real backend (Supabase / Airtable / HubSpot / CRM). The submit
   handler is the single integration point: today it builds a WhatsApp
   message; tomorrow POST the `payload` object to your endpoint instead.
*/
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "27730882155"; // +27 73 088 2155, digits only for wa.me

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var drawer = qs("#site-menu");
  var drawerScrim = qs(".drawer-scrim");
  var modal = qs("[data-modal]"); // the .modal-scrim, only present where a modal exists
  var lastMenuTrigger = null;
  var lastQuoteTrigger = null;

  /* ---------------------------------------------------------------- Drawer */
  function openMenu(trigger) {
    if (!drawer) return;
    lastMenuTrigger = trigger || qs("[data-open-menu]");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    if (drawerScrim) drawerScrim.classList.add("is-open");
    document.body.classList.add("menu-open");
    qsa("[data-open-menu]").forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
    var first = drawer.querySelector("a, button");
    if (first) first.focus();
  }

  function closeMenu() {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (drawerScrim) drawerScrim.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    qsa("[data-open-menu]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    if (lastMenuTrigger) { lastMenuTrigger.focus(); lastMenuTrigger = null; }
  }

  /* ------------------------------------------------------------- Quote modal */
  function openQuote(eventType, trigger) {
    // Pages without a modal (e.g. quote.html) fall back to the full form page.
    if (!modal) {
      window.location.href = eventType
        ? "quote.html?event=" + encodeURIComponent(eventType)
        : "quote.html";
      return;
    }
    lastQuoteTrigger = trigger || null;

    // Reset to a clean form each time it opens.
    var form = modal.querySelector("[data-quote-form]");
    var success = modal.querySelector("[data-success]");
    if (success) success.classList.remove("is-visible");
    if (form) form.hidden = false;

    modal.hidden = false;
    window.requestAnimationFrame(function () { modal.classList.add("is-open"); });
    document.body.classList.add("modal-open");

    if (eventType) {
      var sel = modal.querySelector("[name='eventType']");
      if (sel) sel.value = eventType;
    }
    var firstField = modal.querySelector("select, input, textarea");
    if (firstField) {
      // Small delay so the slide-up animation isn't interrupted by focus scroll.
      window.setTimeout(function () { firstField.focus(); }, 120);
    }
  }

  function closeQuote() {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    window.setTimeout(function () {
      if (!modal.classList.contains("is-open")) modal.hidden = true;
    }, 280);
    if (lastQuoteTrigger) { lastQuoteTrigger.focus(); lastQuoteTrigger = null; }
  }

  /* -------------------------------------------------- Click + key delegation */
  document.addEventListener("click", function (e) {
    var openMenuBtn = e.target.closest("[data-open-menu]");
    if (openMenuBtn) { e.preventDefault(); openMenu(openMenuBtn); return; }

    if (e.target.closest("[data-close-menu]")) { e.preventDefault(); closeMenu(); return; }

    var quoteBtn = e.target.closest("[data-open-quote]");
    if (quoteBtn) {
      e.preventDefault();
      closeMenu();
      openQuote(quoteBtn.getAttribute("data-event") || "", quoteBtn);
      return;
    }

    if (e.target.closest("[data-close-quote]")) { e.preventDefault(); closeQuote(); return; }

    // Click on the dimmed backdrop (the scrim itself, not the panel) closes the modal.
    if (modal && e.target === modal) { closeQuote(); }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (drawer && drawer.classList.contains("is-open")) { closeMenu(); return; }
    if (modal && modal.classList.contains("is-open")) { closeQuote(); }
  });

  /* --------------------------------------------------------- Form submission */
  function buildPayload(form) {
    var data = new FormData(form);
    var needs = data.getAll("needs"); // checkbox group → array
    return {
      eventType: (data.get("eventType") || "").trim(),
      eventDate: (data.get("eventDate") || "").trim(),
      location: (data.get("location") || "").trim(),
      guests: (data.get("guests") || "").trim(),
      needs: needs,
      name: (data.get("name") || "").trim(),
      phone: (data.get("phone") || "").trim(),
      notes: (data.get("notes") || "").trim(),
      submittedAt: new Date().toISOString()
    };
  }

  function buildWhatsAppMessage(p) {
    var lines = [
      "Hi HandlT, here are my event details:",
      "",
      "Event: " + (p.eventType || "—"),
      "Date: " + (p.eventDate || "—"),
      "Area: " + (p.location || "—"),
      "Guests: " + (p.guests || "—"),
      "Needs: " + (p.needs.length ? p.needs.join(", ") : "—"),
      "Name: " + (p.name || "—"),
      "My WhatsApp: " + (p.phone || "—")
    ];
    if (p.notes) lines.push("Notes: " + p.notes);
    lines.push("");
    lines.push("(Sent from the HandlT site — I can attach inspiration / venue photos here.)");
    return lines.join("\n");
  }

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;

    var payload = buildPayload(form);
    var waUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(buildWhatsAppMessage(payload));

    // Persist locally so nothing is lost (and as a hook for a future dashboard).
    try { localStorage.setItem("handlt:lastQuote", JSON.stringify(payload)); } catch (err) { /* private mode */ }

    // ----- Future backend integration point -------------------------------
    // fetch("/api/quotes", { method:"POST", headers:{ "Content-Type":"application/json" },
    //   body: JSON.stringify(payload) });
    // ----------------------------------------------------------------------

    var container = form.closest(".quote-panel, .content-card") || form.parentNode;
    var success = container ? container.querySelector("[data-success]") : null;
    var summaryLink = container ? container.querySelector("[data-whatsapp-summary]") : null;
    if (summaryLink) summaryLink.href = waUrl;

    var win = window.open(waUrl, "_blank", "noopener");
    if (!win) window.location.href = waUrl; // popup blocked → navigate

    if (success) {
      form.hidden = true;
      success.classList.add("is-visible");
      success.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  qsa("[data-quote-form]").forEach(function (form) {
    form.addEventListener("submit", handleSubmit);
  });

  /* ------------------------------------------- Deep-link event pre-selection */
  (function preselectFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var ev = params.get("event");
    if (!ev) return;
    var sel = qs("[data-quote-form] [name='eventType']");
    if (!sel) return;
    var match = Array.prototype.some.call(sel.options, function (o) {
      return o.value === ev || o.text === ev;
    });
    if (match) sel.value = ev;
  })();
})();

