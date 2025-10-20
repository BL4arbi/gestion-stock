// Configuration de l'API
const API_URL = window.location.origin + "/api";

let editingProductId = null;
let currentUser = null;
let allProducts = [];
let authChecked = false;

// userPermissions est maintenant dans window.userPermissions (défini dans permissions.js)

// Vérifier l'authentification au chargement
async function checkAuth() {
  try {
    const response = await fetch(`${window.location.origin}/api/auth/check`, {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      const userElement = document.getElementById("current-user");
      if (userElement) {
        userElement.textContent = data.username;
      }
      authChecked = true;

      // Charge les permissions après l'auth
      if (typeof loadPermissions === "function") {
        await loadPermissions();
      }

      return true;
    } else {
      window.location.href = "/login.html";
      return false;
    }
  } catch (error) {
    console.error("Erreur:", error);
    window.location.href = "/login.html";
    return false;
  }
}

// Déconnexion
async function logout() {
  try {
    const response = await fetch(`${window.location.origin}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      window.location.href = "/login.html";
    }
  } catch (error) {
    console.error("Erreur déconnexion:", error);
    window.location.href = "/login.html";
  }
}

// Afficher les notifications
function showNotification(message, type = "info", duration = 4000) {
  const container = document.getElementById("notifications");
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

// Charger les produits depuis l'API
async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}/products`, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        authChecked = false;
        window.location.href = "/login.html";
        return;
      }
      throw new Error("Erreur lors du chargement");
    }

    allProducts = await response.json();
    renderProducts(allProducts);
  } catch (error) {
    console.error("Erreur lors du chargement des produits:", error);
    showNotification("Erreur de connexion au serveur", "error");
  }
}

// Recherche produits
function handleSearch(searchText) {
  const text = searchText.toLowerCase();
  const filtered = allProducts.filter(
    (p) =>
      p.nom.toLowerCase().includes(text) ||
      (p.localisation && p.localisation.toLowerCase().includes(text))
  );
  renderProducts(filtered);
}

// Tri produits
function sortProducts(sortBy) {
  let sorted = [...allProducts];

  switch (sortBy) {
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

  renderProducts(sorted);
}

// Ajouter un produit
async function addProduct(e) {
  e.preventDefault();

  const nom = document.getElementById("nom").value;
  const quantite = parseInt(document.getElementById("quantite").value);
  const localisation = document.getElementById("localisation").value;
  const prix = parseFloat(document.getElementById("prix").value) || 0;
  const seuil_alert = parseInt(document.getElementById("seuil").value) || 10;

  try {
    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        nom,
        quantite,
        localisation,
        prix,
        seuil_alert,
        category: "general",
      }),
    });

    if (response.ok) {
      showNotification("✅ Produit ajouté avec succès", "success");
      document.getElementById("product-form").reset();
      await loadProducts();
    } else {
      showNotification("❌ Erreur lors de l'ajout", "error");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur de connexion", "error");
  }
}

// Afficher les produits
function renderProducts(products) {
  const container = document.getElementById("products-list");

  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <h3>Aucun produit</h3>
        <p>Commencez par ajouter un produit à votre stock</p>
      </div>
    `;
    return;
  }

  const lowStockCount = products.filter(
    (p) => p.quantite <= (p.seuil_alert || 10)
  ).length;
  const totalProducts = products.length;

  const totalElem = document.getElementById("total-products");
  const lowStockElem = document.getElementById("low-stock");

  if (totalElem) totalElem.textContent = totalProducts;
  if (lowStockElem) lowStockElem.textContent = lowStockCount;

  // Vérifie que userPermissions est défini
  const perms = window.userPermissions || {
    canAddRemoveStock: false,
    canDelete: false,
  };

  container.innerHTML = products
    .map((product) => {
      const isLowStock = product.quantite <= (product.seuil_alert || 10);

      return `
      <div class="product-card ${isLowStock ? "low-stock" : ""}">
        <div class="product-header">
          <h3 class="product-name">${escapeHtml(product.nom)}</h3>
          <span class="product-quantity">${product.quantite}</span>
        </div>

        <div class="product-info">
          <strong>📍</strong> ${escapeHtml(product.localisation || "N/A")}
        </div>

        <div class="product-info">
          <strong>💰</strong> ${parseFloat(product.prix || 0).toFixed(2)}€
        </div>

        <div class="product-info">
          <strong>⚠️</strong> Seuil: ${product.seuil_alert || 10}
        </div>

        <div class="product-actions">
          ${
            perms.canAddRemoveStock
              ? `
            <button class="btn-small btn-add" onclick="updateQuantity(${
              product.id
            }, ${product.quantite + 1})">➕</button>
            <button class="btn-small btn-remove" onclick="updateQuantity(${
              product.id
            }, ${product.quantite - 1})">➖</button>
          `
              : ""
          }
          ${
            perms.canDelete
              ? `
            <button class="btn-small btn-delete" onclick="deleteProduct(${product.id})">🗑️</button>
          `
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");
}

// Échapper le HTML pour éviter les injections
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Modifier la quantité
async function updateQuantity(id, newQuantity) {
  if (newQuantity < 0) {
    showNotification("La quantité ne peut pas être négative", "error");
    return;
  }

  try {
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;

    const response = await fetch(`${API_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        nom: product.nom,
        quantite: newQuantity,
        localisation: product.localisation,
        prix: product.prix,
        seuil_alert: product.seuil_alert,
      }),
    });

    if (response.ok) {
      await loadProducts();
      showNotification("✅ Quantité mise à jour", "success");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur mise à jour", "error");
  }
}

// Supprimer un produit
async function deleteProduct(id) {
  if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

  try {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      showNotification("✅ Produit supprimé", "success");
      await loadProducts();
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur suppression", "error");
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await checkAuth();
  if (!isAuth) return;

  // Charger les produits si on est sur la page d'accueil
  if (document.getElementById("products-list")) {
    await loadProducts();

    // Événement du formulaire
    const productForm = document.getElementById("product-form");
    if (productForm) {
      productForm.addEventListener("submit", addProduct);
    }

    // Recherche produits
    const searchInput = document.getElementById("search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) =>
        handleSearch(e.target.value)
      );
    }

    // Tri produits
    const sortSelect = document.getElementById("sort-products");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) =>
        sortProducts(e.target.value)
      );
    }
  }
});
