// Configuration de l'API
const API_URL = window.location.origin + "/api";

let editingProductId = null;
let currentUser = null;
let allProducts = [];
let authChecked = false; // Ajoute cette variable

// Vérifier l'authentification au chargement
async function checkAuth() {
  // Si déjà vérifiée, ne pas refaire l'appel
  if (authChecked) {
    return true;
  }

  try {
    const response = await fetch(`${API_URL}/auth/check`, {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data;
      authChecked = true;
      displayUserInfo();
      return true;
    } else {
      authChecked = true;
      window.location.href = "/login.html";
      return false;
    }
  } catch (error) {
    console.error("❌ Erreur authentification:", error);
    // Ne pas afficher l'erreur, juste rediriger
    authChecked = true;
    window.location.href = "/login.html";
    return false;
  }
}

// Afficher les infos utilisateur
function displayUserInfo() {
  const userInfo = document.getElementById("user-info");
  if (userInfo && currentUser) {
    userInfo.innerHTML = `👤 ${currentUser.username}`;
  }
}

// Déconnexion
async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Erreur déconnexion:", error);
  } finally {
    authChecked = false;
    window.location.href = "/login.html";
  }
}

// Afficher les notifications
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in-out";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
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
      p.localisation.toLowerCase().includes(text)
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
      sorted = sorted.filter((p) => p.quantite <= p.seuil);
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
  const seuil = parseInt(document.getElementById("seuil").value);

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
        seuil,
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

  const lowStockCount = products.filter((p) => p.quantite <= p.seuil).length;
  const totalProducts = products.length;

  document.getElementById("total-products").textContent = totalProducts;
  document.getElementById("low-stock").textContent = lowStockCount;

  container.innerHTML = products
    .map((product) => {
      const isLowStock = product.quantite <= product.seuil;

      return `
      <div class="product-card ${isLowStock ? "low-stock" : ""}">
        <div class="product-header">
          <h3 class="product-name">${product.nom}</h3>
          <span class="product-quantity">${product.quantite}</span>
        </div>

        <div class="product-info">
          <strong>📍</strong> ${product.localisation}
        </div>

        <div class="product-info">
          <strong>💰</strong> ${parseFloat(product.prix || 0).toFixed(2)}€
        </div>

        <div class="product-info">
          <strong>⚠️</strong> Seuil: ${product.seuil}
        </div>

        <div class="product-actions">
          <button class="btn-small btn-add" onclick="updateQuantity(${
            product.id
          }, ${product.quantite + 1})">➕</button>
          <button class="btn-small btn-remove" onclick="updateQuantity(${
            product.id
          }, ${product.quantite - 1})">➖</button>
          <button class="btn-small btn-delete" onclick="deleteProduct(${
            product.id
          })">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

// Échapper le HTML pour éviter les injections
function escapeHtml(text) {
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
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantite: newQuantity }),
    });

    if (response.ok) {
      await loadProducts();
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
