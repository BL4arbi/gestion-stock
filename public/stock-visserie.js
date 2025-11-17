const API = window.location.origin + "/api";
let allProductsEPI = [];

async function loadProductsEPI() {
  try {
    const response = await fetch(`${API}/products?category=epi`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Erreur");
    allProductsEPI = await response.json();
    renderProductsEPI(allProductsEPI);
    updateStatsEPI(allProductsEPI);
  } catch (error) {
    console.error("Erreur:", error);
  }
}

function updateStatsEPI(products) {
  document.getElementById("total-products-epi").textContent = products.length;
  const lowStock = products.filter((p) => p.quantite <= p.seuil_alert).length;
  document.getElementById("low-stock-epi").textContent = lowStock;
}

function renderProductsEPI(products) {
  const container = document.getElementById("products-list-epi");
  if (!products || products.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🦺</div><h3>Aucun EPI</h3><p>Ajoutez votre premier équipement</p></div>`;
    return;
  }
  container.innerHTML = products
    .map(
      (p) => `
    <div class="product-card ${p.quantite <= p.seuil_alert ? "alert" : ""}">
      <div class="product-header">
        <h3>${p.nom}</h3>
        ${
          p.quantite <= p.seuil_alert
            ? '<span class="badge-alert">⚠️ Stock faible</span>'
            : ""
        }
      </div>
      <div class="product-info">
        <p>📦 <strong>${p.quantite}</strong> unités</p>
        <p>📍 ${p.localisation || "N/A"}</p>
        <p>💰 ${parseFloat(p.prix || 0).toFixed(2)}€</p>
      </div>
      <div class="product-actions">
        <button class="btn-action" onclick="openEditModalEPI(${
          p.id
        })">✏️ Modifier</button>
        <button class="btn-delete" onclick="deleteProductEPI(${
          p.id
        })">🗑️ Supprimer</button>
      </div>
    </div>
  `
    )
    .join("");
}

async function deleteProductEPI(id) {
  if (!confirm("Supprimer cet EPI ?")) return;
  try {
    const response = await fetch(`${API}/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ EPI supprimé", "success");
      loadProductsEPI();
    }
  } catch (error) {}
}

function openEditModalEPI(id) {
  const product = allProductsEPI.find((p) => p.id === id);
  if (!product) return;
  let modal = document.getElementById("edit-modal-epi");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "edit-modal-epi";
    modal.className = "modal";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header"><h2>✏️ Modifier EPI</h2><button class="modal-close" onclick="document.getElementById('edit-modal-epi').style.display='none'">×</button></div>
      <form onsubmit="saveEditEPI(event, ${id})">
        <div class="form-group"><label>Nom</label><input type="text" id="edit-nom-epi" value="${
          product.nom
        }" required /></div>
        <div class="form-group"><label>Quantité</label><input type="number" id="edit-quantite-epi" value="${
          product.quantite
        }" required /></div>
        <div class="form-group"><label>Localisation</label><input type="text" id="edit-localisation-epi" value="${
          product.localisation || ""
        }" /></div>
        <div class="form-group"><label>Prix</label><input type="number" id="edit-prix-epi" value="${
          product.prix || 0
        }" step="0.01" /></div>
        <div class="form-group"><label>Seuil</label><input type="number" id="edit-seuil-epi" value="${
          product.seuil_alert || 10
        }" /></div>
        <div class="modal-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('edit-modal-epi').style.display='none'">Annuler</button><button type="submit" class="btn-primary">Enregistrer</button></div>
      </form>
    </div>
  `;
  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

async function saveEditEPI(e, id) {
  e.preventDefault();
  const data = {
    nom: document.getElementById("edit-nom-epi").value,
    quantite: parseInt(document.getElementById("edit-quantite-epi").value),
    localisation: document.getElementById("edit-localisation-epi").value,
    prix: parseFloat(document.getElementById("edit-prix-epi").value),
    seuil_alert: parseInt(document.getElementById("edit-seuil-epi").value),
    category: "epi",
  };
  try {
    const response = await fetch(`${API}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (response.ok) {
      showNotification("✓ Modifié", "success");
      document.getElementById("edit-modal-epi").style.display = "none";
      loadProductsEPI();
    }
  } catch (error) {}
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();
  await loadProductsEPI();

  const searchInput = document.getElementById("search-epi");
  if (searchInput)
    searchInput.addEventListener("input", (e) => {
      const text = e.target.value.toLowerCase();
      const filtered = allProductsEPI.filter(
        (p) =>
          p.nom.toLowerCase().includes(text) ||
          (p.localisation && p.localisation.toLowerCase().includes(text))
      );
      renderProductsEPI(filtered);
    });

  const sortSelect = document.getElementById("sort-products-epi");
  if (sortSelect)
    sortSelect.addEventListener("change", (e) => {
      let sorted = [...allProductsEPI];
      switch (e.target.value) {
        case "nom":
          sorted.sort((a, b) => a.nom.localeCompare(b.nom));
          break;
        case "prix-asc":
          sorted.sort((a, b) => (a.prix || 0) - (b.prix || 0));
          break;
        case "prix-desc":
          sorted.sort((a, b) => (b.prix || 0) - (a.prix || 0));
          break;
        case "quantite":
          sorted.sort((a, b) => a.quantite - b.quantite);
          break;
        case "faible":
          sorted = sorted.filter((p) => p.quantite <= p.seuil_alert);
          break;
      }
      renderProductsEPI(sorted);
    });

  const form = document.getElementById("product-form-epi");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        nom: document.getElementById("nom-epi").value,
        quantite: parseInt(document.getElementById("quantite-epi").value),
        localisation: document.getElementById("localisation-epi").value,
        prix: parseFloat(document.getElementById("prix-epi").value || 0),
        seuil_alert: parseInt(document.getElementById("seuil-epi").value || 10),
        category: "epi",
      };
      try {
        const response = await fetch(`${API}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
        if (response.ok) {
          form.reset();
          await loadProductsEPI();
          showNotification("✓ EPI ajouté", "success");
        }
      } catch (error) {}
    });
  }
});
