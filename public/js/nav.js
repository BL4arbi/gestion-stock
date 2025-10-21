document.addEventListener("DOMContentLoaded", () => {
  const dropdowns = document.querySelectorAll(
    ".nav-dropdown, .dropdown, nav .nav-links > li:has(> ul)"
  );

  if (dropdowns.length === 0) return;

  const isTouch = window.matchMedia("(hover: none)").matches;
  let activeDD = null;
  let closeTimer = null;

  const closeAll = () => {
    dropdowns.forEach((dd) => dd.classList.remove("open"));
    activeDD = null;
  };

  const open = (dd) => {
    clearTimeout(closeTimer);
    if (activeDD && activeDD !== dd) closeAll();
    dd.classList.add("open");
    activeDD = dd;
  };

  const scheduleClose = (dd) => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (activeDD === dd) closeAll();
    }, 300);
  };

  dropdowns.forEach((dd) => {
    const toggle = dd.querySelector("a");
    const menu = dd.querySelector("ul, .dropdown-menu, .nav-dropdown-content");

    if (!toggle || !menu) return;

    // 🖱️ HOVER
    if (!isTouch) {
      dd.addEventListener("mouseenter", () => open(dd));
      dd.addEventListener("mouseleave", () => scheduleClose(dd));
      menu.addEventListener("mouseenter", () => open(dd));
      menu.addEventListener("mouseleave", () => scheduleClose(dd));
    }

    // 🖱️ CLIC - IMPORTANT: laisser les vrais liens passer!
    toggle.addEventListener("click", (e) => {
      const href = toggle.getAttribute("href");

      // ❌ NE PAS bloquer si c'est un vrai lien (pas "#" et pas vide)
      if (!href || href === "#") {
        // C'est un dropdown pur → l'empêcher et toggle
        e.preventDefault();
        e.stopPropagation();
        activeDD === dd ? closeAll() : open(dd);
      }
      // ✅ Sinon: laisser le navigateur gérer la navigation
    });

    // 📋 CLAVIER
    toggle.addEventListener("keydown", (e) => {
      if (
        (e.key === "Enter" || e.key === " ") &&
        (!toggle.href || toggle.href.endsWith("#"))
      ) {
        e.preventDefault();
        toggle.click();
      }
    });

    // Clic dans le menu
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.tagName === "A") {
        setTimeout(() => closeAll(), 100);
      }
    });
  });

  document.addEventListener("click", closeAll);
});
