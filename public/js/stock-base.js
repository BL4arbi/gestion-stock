console.log("✅ stock-base.js chargé");

let products = [];
let editingProductId = null;

// Charger les matériaux
async function loadProductsBase() {
  try {
    console.log("📥 Chargement des matériaux...");

    const response = await fetch("/api/products?category=base", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    products = await response.json();
    console.log(`✅ ${products.length} matériaux chargés`);
    renderProductsBase();
  } catch (error) {
    console.error("❌ Erreur chargement:", error);
    showNotification("Erreur lors du chargement des matériaux", "error");
  }
}

// Afficher les matériaux
function renderProductsBase() {
  const container = document.getElementById("products-grid");

  if (!container) {
    console.error("❌ Élément #products-grid introuvable!");
    return;
  }

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>🏭 Aucun matériau en stock</p>
        <p>Cliquez sur "Ajouter un matériau" pour commencer</p>
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
        <p><strong>Prix:</strong> ${parseFloat(product.prix).toFixed(2)} €</p>
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
}

// Ouvrir modal
function openAddModal() {
  editingProductId = null;
  document.getElementById("modal-title").textContent = "Ajouter un matériau";
  document.getElementById("product-form").reset();
  document.getElementById("product-modal").style.display = "block";
}

// Modifier
function editProduct(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  editingProductId = id;
  document.getElementById("modal-title").textContent = "Modifier le matériau";
  document.getElementById("product-nom").value = product.nom;
  document.getElementById("product-reference").value = product.reference || "";
  document.getElementById("product-quantite").value = product.quantite;
  document.getElementById("product-unite").value = product.unite;
  document.getElementById("product-localisation").value =
    product.localisation || "";
  document.getElementById("product-prix").value = product.prix;
  document.getElementById("product-seuil").value = product.seuil_alert;
  document.getElementById("product-notes").value = product.notes || "";

  document.getElementById("product-modal").style.display = "block";
}

// Fermer
function closeModal() {
  document.getElementById("product-modal").style.display = "none";
  editingProductId = null;
}

// Sauvegarder
async function saveProduct(e) {
  e.preventDefault();

  const productData = {
    nom: document.getElementById("product-nom").value.trim(),
    reference: document.getElementById("product-reference").value.trim(),
    quantite: parseInt(document.getElementById("product-quantite").value),
    unite: document.getElementById("product-unite").value,
    localisation: document.getElementById("product-localisation").value.trim(),
    prix: parseFloat(document.getElementById("product-prix").value) || 0,
    seuil_alert: parseInt(document.getElementById("product-seuil").value) || 5,
    category: "base",
    notes: document.getElementById("product-notes").value.trim(),
  };

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

    showNotification(
      editingProductId ? "Matériau modifié" : "Matériau ajouté",
      "success"
    );

    closeModal();
    loadProductsBase();
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification(error.message, "error");
  }
}

// Supprimer
async function deleteProduct(id) {
  if (!confirm("Supprimer ce matériau ?")) return;

  try {
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) throw new Error("Erreur suppression");

    showNotification("Matériau supprimé", "success");
    loadProductsBase();
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification("Erreur suppression", "error");
  }
}

// Événements
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initialisation stock-base");

  const checkAuthInterval = setInterval(() => {
    if (window.authChecked) {
      clearInterval(checkAuthInterval);
      loadProductsBase();
    }
  }, 100);

  document
    .getElementById("add-product-btn")
    ?.addEventListener("click", openAddModal);
  document.querySelector(".close")?.addEventListener("click", closeModal);
  document.getElementById("cancel-btn")?.addEventListener("click", closeModal);
  document
    .getElementById("product-form")
    ?.addEventListener("submit", saveProduct);

  window.addEventListener("click", (e) => {
    if (e.target === document.getElementById("product-modal")) {
      closeModal();
    }
  });
});
