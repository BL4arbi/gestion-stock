const API = window.location.origin + "/api";
console.log("✅ stock-visserie.js chargé");

let allProductsVisserie = [];
let products = [];
let editingProductId = null;

// Charger les produits
async function loadProductsVisserie() {
  try {
    console.log("📥 Chargement des produits visserie...");

    const response = await fetch("/api/products?category=visserie", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    products = await response.json();
    console.log(`✅ ${products.length} produits chargés:`, products);
    renderProductsVisserie();
  } catch (error) {
    console.error("❌ Erreur chargement:", error);
    showNotification("Erreur lors du chargement des produits", "error");
  }
}

// Afficher les produits
function renderProductsVisserie() {
  const container = document.getElementById("products-grid");

  if (!container) {
    console.error("❌ Élément #products-grid introuvable!");
    return;
  }

  console.log("🎨 Affichage de", products.length, "produits");

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>🔩</p>
        <p>Aucun produit en stock</p>
        <p style="font-size: 14px; color: #999;">Cliquez sur "Ajouter une visserie" pour commencer</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${
      product.quantite <= product.seuil_alert ? "low-stock" : ""
    }">
      <div class="product-header">
        <h3>${product.nom}</h3>
        ${
          product.quantite <= product.seuil_alert
            ? '<span class="badge badge-warning">⚠️ Stock bas</span>'
            : ""
        }
      </div>
      
      <div class="product-body">
        <p><strong>Référence:</strong> ${product.reference || "-"}</p>
        <p><strong>Quantité:</strong> ${product.quantite} ${product.unite}</p>
        <p><strong>Localisation:</strong> ${product.localisation || "-"}</p>
        <p><strong>Prix:</strong> ${parseFloat(product.prix || 0).toFixed(
          2
        )} €</p>
        ${
          product.notes ? `<p><strong>Notes:</strong> ${product.notes}</p>` : ""
        }
      </div>
      
      <div class="product-actions">
        <button onclick="editProduct(${
          product.id
        })" class="btn btn-sm btn-secondary">✏️ Modifier</button>
        <button onclick="deleteProduct(${
          product.id
        })" class="btn btn-sm btn-danger">🗑️ Supprimer</button>
      </div>
    </div>
  `
    )
    .join("");

  console.log("✅ Produits affichés");
}

// Ouvrir le modal d'ajout
function openAddModal() {
  editingProductId = null;
  document.getElementById("modal-title").textContent = "Ajouter une visserie";
  document.getElementById("product-form").reset();
  document.getElementById("product-modal").style.display = "block";
}

// Modifier un produit
function editProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  editingProductId = id;
  document.getElementById("modal-title").textContent = "Modifier la visserie";
  document.getElementById("product-nom").value = product.nom;
  document.getElementById("product-reference").value = product.reference || "";
  document.getElementById("product-quantite").value = product.quantite;
  document.getElementById("product-unite").value = product.unite;
  document.getElementById("product-localisation").value =
    product.localisation || "";
  document.getElementById("product-prix").value = product.prix || 0;
  document.getElementById("product-seuil").value = product.seuil_alert;
  document.getElementById("product-notes").value = product.notes || "";

  document.getElementById("product-modal").style.display = "block";
}

// Fermer le modal
function closeModal() {
  document.getElementById("product-modal").style.display = "none";
  editingProductId = null;
}

// Sauvegarder le produit
async function saveProduct(e) {
  e.preventDefault();

  const productData = {
    nom: document.getElementById("product-nom").value.trim(),
    reference: document.getElementById("product-reference").value.trim(),
    quantite: parseInt(document.getElementById("product-quantite").value),
    unite: document.getElementById("product-unite").value,
    localisation: document.getElementById("product-localisation").value.trim(),
    prix: parseFloat(document.getElementById("product-prix").value) || 0,
    seuil_alert: parseInt(document.getElementById("product-seuil").value) || 10,
    category: "visserie",
    notes: document.getElementById("product-notes").value.trim(),
  };

  console.log("📤 Sauvegarde produit:", productData);

  try {
    const url = editingProductId
      ? `/api/products/${editingProductId}`
      : "/api/products";
    const method = editingProductId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur serveur");
    }

    const result = await response.json();
    console.log("✅ Produit sauvegardé:", result);

    showNotification(
      editingProductId
        ? "Produit modifié avec succès"
        : "Produit ajouté avec succès",
      "success"
    );

    closeModal();
    loadProductsVisserie();
  } catch (error) {
    console.error("❌ Erreur sauvegarde:", error);
    showNotification(error.message, "error");
  }
}

// Supprimer un produit
async function deleteProduct(id) {
  if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

  try {
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) throw new Error("Erreur suppression");

    showNotification("Produit supprimé", "success");
    loadProductsVisserie();
  } catch (error) {
    console.error("❌ Erreur suppression:", error);
    showNotification("Erreur lors de la suppression", "error");
  }
}

// =================== ÉVÉNEMENTS =================== //

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initialisation stock-visserie");

  // ✅ CHARGER IMMÉDIATEMENT (l'auth est déjà vérifiée par auth.js)
  loadProductsVisserie();

  // Boutons
  document
    .getElementById("add-product-btn")
    ?.addEventListener("click", openAddModal);
  document.querySelector(".close")?.addEventListener("click", closeModal);
  document.getElementById("cancel-btn")?.addEventListener("click", closeModal);
  document
    .getElementById("product-form")
    ?.addEventListener("submit", saveProduct);

  // Fermer modal en cliquant en dehors
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("product-modal");
    if (e.target === modal) {
      closeModal();
    }
  });
});
