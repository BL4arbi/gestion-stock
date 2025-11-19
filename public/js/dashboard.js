document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Initialisation dashboard");
  await loadDashboardData();
});

// Charger les données
async function loadDashboardData() {
  try {
    console.log("📥 Chargement dashboard...");

    // Charger stats + produits + machines
    const [statsRes, productsRes, machinesRes] = await Promise.all([
      fetch("/api/dashboard/stats", { credentials: "include" }),
      fetch("/api/products", { credentials: "include" }),
      fetch("/api/machines", { credentials: "include" }),
    ]);

    if (!statsRes.ok || !productsRes.ok || !machinesRes.ok) {
      throw new Error("Erreur chargement données");
    }

    const stats = await statsRes.json();
    const products = await productsRes.json();
    const machines = await machinesRes.json();

    console.log("📊 Stats:", stats);
    console.log("📦 Produits:", products.length);
    console.log("🤖 Machines:", machines.length);

    // Mettre à jour l'affichage
    updateStats(stats, products, machines);
    updateLowStockList(products);
    updateCategoryStats(products);
    updateMachinesList(machines);
  } catch (error) {
    console.error("❌ Erreur dashboard:", error);
    showNotification("Erreur de chargement", "error");
  }
}

// Mettre à jour les stats principales
function updateStats(stats, products, machines) {
  // Total produits
  const totalEl = document.getElementById("total-products");
  if (totalEl) totalEl.textContent = products.length;

  // Produits en alerte
  const lowStock = products.filter((p) => p.quantite <= (p.seuil_alert || 10));
  const lowStockEl = document.getElementById("low-stock");
  if (lowStockEl) lowStockEl.textContent = lowStock.length;

  // Total machines
  const machinesEl = document.getElementById("total-machines");
  if (machinesEl) machinesEl.textContent = machines.length;
}

// Afficher les produits en alerte
function updateLowStockList(products) {
  const container = document.getElementById("low-stock-list");
  if (!container) return;

  const lowStock = products.filter((p) => p.quantite <= (p.seuil_alert || 10));

  if (lowStock.length === 0) {
    container.innerHTML = '<div class="empty-state">✅ Aucune alerte</div>';
    return;
  }

  container.innerHTML = lowStock
    .slice(0, 5)
    .map(
      (p) => `
    <div class="widget-item">
      <div class="widget-item-icon">⚠️</div>
      <div class="widget-item-content">
        <div class="widget-item-title">${p.nom}</div>
        <div class="widget-item-subtitle">
          Stock: ${p.quantite} ${p.unite} (seuil: ${p.seuil_alert})
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

// Stats par catégorie
function updateCategoryStats(products) {
  const categories = {
    visserie: products.filter((p) => p.category === "visserie").length,
    epi: products.filter((p) => p.category === "epi").length,
    base: products.filter((p) => p.category === "base").length,
  };

  const visserieEl = document.getElementById("visserie-count");
  const epiEl = document.getElementById("epi-count");
  const baseEl = document.getElementById("base-count");

  if (visserieEl) visserieEl.textContent = categories.visserie;
  if (epiEl) epiEl.textContent = categories.epi;
  if (baseEl) baseEl.textContent = categories.base;
}

// Liste des machines
function updateMachinesList(machines) {
  const container = document.getElementById("machines-list");
  if (!container) return;

  if (machines.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune machine</div>';
    return;
  }

  container.innerHTML = machines
    .slice(0, 5)
    .map(
      (m) => `
    <div class="widget-item">
      <div class="widget-item-icon">🤖</div>
      <div class="widget-item-content">
        <div class="widget-item-title">${m.nom}</div>
        <div class="widget-item-subtitle">${m.marque || "-"}</div>
      </div>
    </div>
  `
    )
    .join("");
}
