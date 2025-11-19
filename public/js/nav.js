console.log("✅ nav.js chargé");

// ============================================
// GÉNÉRER LA NAVIGATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.getElementById("main-nav");

  // Si l'élément existe et est vide, on génère le menu
  if (navContainer && !navContainer.innerHTML.trim()) {
    console.log("📝 Génération du menu...");

    navContainer.innerHTML = `
      <div class="nav-container">
        <div class="nav-brand">
          <img src="/assets/logo.png" alt="Logo" class="nav-logo" />
          <span class="nav-company">TACQUET INDUSTRIES</span>
        </div>

        <ul class="nav-links">
          <li><a href="/">🏠 Accueil</a></li>
          
          <li class="nav-dropdown">
            <a href="#">📦 Stock ▾</a>
            <ul class="nav-dropdown-content">
              <li><a href="/stock-base.html">📦 Stock de base</a></li>
              <li><a href="/stock-epi.html">🦺 EPI</a></li>
              <li><a href="/stock-visserie.html">🔩 Visserie</a></li>
            </ul>
          </li>

          <li><a href="/machines.html">🤖 Machines</a></li>
        </ul>

        <div class="user-info">
          <span>👤 <span id="current-user">Chargement...</span></span>
          <button class="btn-logout" onclick="logout()">🚪 Déconnexion</button>
        </div>
      </div>
    `;

    console.log("✅ Menu généré");
  }

  // ============================================
  // GÉRER LES DROPDOWNS
  // ============================================
  const dropdowns = document.querySelectorAll(".nav-dropdown");

  if (dropdowns.length === 0) {
    console.log("⚠️ Aucun dropdown trouvé");
    return;
  }

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
    const menu = dd.querySelector("ul, .nav-dropdown-content");

    if (!toggle || !menu) return;

    // HOVER (desktop)
    if (!isTouch) {
      dd.addEventListener("mouseenter", () => open(dd));
      dd.addEventListener("mouseleave", () => scheduleClose(dd));
      menu.addEventListener("mouseenter", () => open(dd));
      menu.addEventListener("mouseleave", () => scheduleClose(dd));
    }

    // CLIC
    toggle.addEventListener("click", (e) => {
      const href = toggle.getAttribute("href");

      if (!href || href === "#") {
        e.preventDefault();
        e.stopPropagation();
        activeDD === dd ? closeAll() : open(dd);
      }
    });

    // Fermer en cliquant dans le menu
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.tagName === "A") {
        setTimeout(() => closeAll(), 100);
      }
    });
  });

  // Fermer en cliquant ailleurs
  document.addEventListener("click", closeAll);

  console.log(`✅ ${dropdowns.length} dropdowns initialisés`);
});
