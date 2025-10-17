const API = window.location.origin + "/api";
let allProductsVisserie = [];

async function loadProductsVisserie() {
  try {
    const response = await fetch(`${API}/products?category=visserie`, { credentials: "include" });
    if (!response.ok) throw new Error("Erreur");
    allProductsVisserie = await response.json();
    renderProductsVisserie(allProductsVisserie);
    updateStatsVisserie(allProductsVisserie);
  } catch (error) {
    console.error("Erreur:", error);
  }
}

function updateStatsVisserie(products) {
  document.getElementById("total-products-visserie").textContent = products.length;
  const lowStock = products.filter(p => p.quantite <= p.seuil_alert).length;
  document.getElementById("low-stock-visserie").textContent = lowStock;
}

function renderProductsVisserie(products) {
  const container = document.getElementById("products-list-visserie");
  if (!products || products.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔩</div><h3>Aucune visserie</h3><p>Ajoutez votre premier article</p></div>`;
    return;
  }
  
  const perms = window.userPermissions || { canAddRemoveStock: false, canDelete: false };
  
  container.innerHTML = products.map(p => `
    <div class="product-card ${p.quantite <= p.seuil_alert ? 'low-stock' : ''}">
      <div class="product-header">
        <h3 class="product-name">${escapeHtml(p.nom)}</h3>
        <span class="product-quantity">${p.quantite}</span>
      </div>
      <div class="product-info">
        <strong>📍</strong> ${escapeHtml(p.localisation || 'N/A')}
      </div>
      <div class="product-info">
        <strong>💰</strong> ${parseFloat(p.prix || 0).toFixed(2)}€
      </div>
      <div class="product-info">
        <strong>⚠️</strong> Seuil: ${p.seuil_alert || 10}
      </div>
      <div class="product-actions">
        ${perms.canAddRemoveStock ? `
          <button class="btn-small btn-add" onclick="updateQuantityVisserie(${p.id}, ${p.quantite + 1})">➕</button>
          <button class="btn-small btn-remove" onclick="updateQuantityVisserie(${p.id}, ${p.quantite - 1})">➖</button>
        ` : ''}
        ${perms.canDelete ? `
          <button class="btn-small btn-delete" onclick="deleteProductVisserie(${p.id})">🗑️</button>
        ` : ''}
      </div>
    </div>
  `).join("");
}

async function updateQuantityVisserie(id, newQuantity) {
  if (newQuantity < 0) {
    showNotification("La quantité ne peut pas être négative", "error");
    return;
  }

  try {
    const product = allProductsVisserie.find(p => p.id === id);
    if (!product) return;

    const response = await fetch(`${API}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ 
        nom: product.nom,
        quantite: newQuantity,
        localisation: product.localisation,
        prix: product.prix,
        seuil_alert: product.seuil_alert,
        category: "visserie"
      }),
    });

    if (response.ok) {
      await loadProductsVisserie();
      showNotification("✅ Quantité mise à jour", "success");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur mise à jour", "error");
  }
}

async function deleteProductVisserie(id) {
  if (!confirm("Supprimer cet article ?")) return;
  try {
    const response = await fetch(`${API}/products/${id}`, { method: "DELETE", credentials: "include" });
    if (response.ok) {
      showNotification("✅ Visserie supprimée", "success");
      loadProductsVisserie();
    }
  } catch (error) {
    showNotification("❌ Erreur suppression", "error");
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();
  await loadProductsVisserie();
  
  const searchInput = document.getElementById("search-visserie");
  if (searchInput) searchInput.addEventListener("input", (e) => {
    const text = e.target.value.toLowerCase();
    const filtered = allProductsVisserie.filter(p => p.nom.toLowerCase().includes(text) || (p.localisation && p.localisation.toLowerCase().includes(text)));
    renderProductsVisserie(filtered);
  });

  const sortSelect = document.getElementById("sort-products-visserie");
  if (sortSelect) sortSelect.addEventListener("change", (e) => {
    let sorted = [...allProductsVisserie];
    switch(e.target.value) {
      case "nom": sorted.sort((a, b) => a.nom.localeCompare(b.nom)); break;
      case "prix-asc": sorted.sort((a, b) => (a.prix || 0) - (b.prix || 0)); break;
      case "prix-desc": sorted.sort((a, b) => (b.prix || 0) - (a.prix || 0)); break;
      case "quantite": sorted.sort((a, b) => a.quantite - b.quantite); break;
      case "faible": sorted = sorted.filter(p => p.quantite <= p.seuil_alert); break;
    }
    renderProductsVisserie(sorted);
  });

  const form = document.getElementById("product-form-visserie");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        nom: document.getElementById("nom-visserie").value,
        quantite: parseInt(document.getElementById("quantite-visserie").value),
        localisation: document.getElementById("localisation-visserie").value,
        prix: parseFloat(document.getElementById("prix-visserie").value || 0),
        seuil_alert: parseInt(document.getElementById("seuil-visserie").value || 10),
        category: "visserie"
      };
      try {
        const response = await fetch(`${API}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data)
        });
        if (response.ok) {
          form.reset();
          await loadProductsVisserie();
          showNotification("✅ Visserie ajoutée", "success");
        }
      } catch (error) {
        showNotification("❌ Erreur ajout", "error");
      }
    });
  }
});