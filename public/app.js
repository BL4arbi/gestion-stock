// Configuration de l'API
const API_URL = window.location.origin + "/api";

let editingProductId = null;
let currentUser = null;

// Vérifier l'authentification au chargement
async function checkAuth() {
  try {
    const response = await fetch(`${API_URL}/auth/check`, {
      credentials: "include",
    });
    const data = await response.json();

    if (!data.authenticated) {
      window.location.href = "/login.html";
      return false;
    }

    currentUser = data.user;
    displayUserInfo();
    return true;
  } catch (error) {
    console.error("Erreur auth:", error);
    window.location.href = "/login.html";
    return false;
  }
}

// Afficher les infos utilisateur
function displayUserInfo() {
  const header = document.querySelector("header");
  const userInfo = document.createElement("div");
  userInfo.style.cssText = `
        position: absolute;
        top: 20px;
        right: 50px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.9em;
        display: flex;
        gap: 15px;
        align-items: center;
        z-index: 10;
    `;
  userInfo.innerHTML = `
        <span>👤 ${currentUser.nom}</span>
        <button onclick="logout()" style="
            background: rgba(233, 69, 96, 0.2);
            border: 1px solid rgba(233, 69, 96, 0.3);
            color: #e94560;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        " onmouseover="this.style.background='rgba(233, 69, 96, 0.3)'" 
           onmouseout="this.style.background='rgba(233, 69, 96, 0.2)'">
            Déconnexion
        </button>
    `;
  header.appendChild(userInfo);
}

// Déconnexion
async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Erreur déconnexion:", error);
    window.location.href = "/login.html";
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  // Nettoyer le localStorage (anciennes données locales)
  localStorage.removeItem("products");

  const isAuth = await checkAuth();
  if (!isAuth) return;

  await loadProducts();
  await updateStats();

  // Formulaire d'ajout
  document
    .getElementById("product-form")
    .addEventListener("submit", addProduct);

  // Recherche
  document.getElementById("search").addEventListener("input", handleSearch);

  // Fermer le modal en cliquant à l'extérieur
  document.addEventListener("click", (e) => {
    const modal = document.getElementById("edit-modal");
    if (e.target === modal) {
      closeEditModal();
    }
  });

  // Rafraîchir automatiquement toutes les 10 secondes
  setInterval(async () => {
    await loadProducts();
    await updateStats();
  }, 10000);
});

// Charger les produits depuis l'API
async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}/products`, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error("Erreur lors du chargement");
    }

    const products = await response.json();
    renderProducts(products);
  } catch (error) {
    console.error("Erreur lors du chargement des produits:", error);
    showNotification("Erreur de connexion au serveur", "error");
  }
}

// Ajouter un produit
async function addProduct(e) {
  e.preventDefault();

  const product = {
    nom: document.getElementById("nom").value.trim(),
    quantite: parseInt(document.getElementById("quantite").value),
    localisation:
      document.getElementById("localisation").value.trim() || "Non défini",
    prix: parseFloat(document.getElementById("prix").value) || 0,
    seuil: parseInt(document.getElementById("seuil").value) || 10,
  };

  if (!product.nom) {
    showNotification("Le nom du produit est requis", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(product),
    });

    if (response.ok) {
      e.target.reset();
      await loadProducts();
      await updateStats();
      showNotification("✓ Produit ajouté avec succès", "success");
    } else {
      const error = await response.json();
      showNotification(error.error || "Erreur lors de l'ajout", "error");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur lors de l'ajout", "error");
  }
}

// Afficher les produits
function renderProducts(products) {
  const container = document.getElementById("products-list");

  if (!products || products.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>Aucun produit en stock</h3>
                <p>Ajoutez votre premier produit pour commencer</p>
            </div>
        `;
    return;
  }

  container.innerHTML = products
    .map((product) => {
      const isLowStock = product.quantite <= product.seuil;
      return `
            <div class="product-card ${
              isLowStock ? "low-stock" : ""
            }" data-id="${product.id}">
                <div class="product-header">
                    <div class="product-name">${escapeHtml(product.nom)}</div>
                    <div class="product-quantity">${product.quantite}</div>
                </div>
                <div class="product-info">
                    <strong>📍</strong> ${escapeHtml(product.localisation)}
                </div>
                <div class="product-info">
                    <strong>💰</strong> ${parseFloat(product.prix).toFixed(2)}€
                </div>
                <div class="product-info">
                    <strong>⚠️</strong> Seuil: ${product.seuil}
                </div>
                ${
                  isLowStock
                    ? '<div class="product-info" style="color: #e94560; font-weight: bold;">⚠️ Stock faible !</div>'
                    : ""
                }
                <div class="product-actions">
                    <button class="btn-small btn-add" onclick="updateQuantity(${
                      product.id
                    }, ${product.quantite + 1})" title="Ajouter">+</button>
                    <button class="btn-small btn-remove" onclick="updateQuantity(${
                      product.id
                    }, ${product.quantite - 1})" title="Retirer">-</button>
                    <button class="btn-small btn-edit" onclick='openEditModal(${JSON.stringify(
                      product
                    ).replace(/'/g, "&apos;")})' title="Modifier">✎</button>
                    <button class="btn-small btn-delete" onclick="deleteProduct(${
                      product.id
                    }, '${escapeHtml(
        product.nom
      )}')" title="Supprimer">×</button>
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
    showNotification("La quantité ne peut pas être négative", "warning");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/products/${id}/quantity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantite: newQuantity }),
    });

    if (response.ok) {
      await loadProducts();
      await updateStats();
      showNotification("✓ Quantité modifiée", "success");
    } else {
      const error = await response.json();
      showNotification(
        error.error || "Erreur lors de la modification",
        "error"
      );
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur lors de la modification", "error");
  }
}

// Ouvrir le modal de modification
function openEditModal(product) {
  editingProductId = product.id;

  let modal = document.getElementById("edit-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "edit-modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>✎ Modifier le produit</h2>
                <button class="modal-close" onclick="closeEditModal()">×</button>
            </div>
            <form id="edit-form" onsubmit="saveEdit(event)">
                <div class="form-group">
                    <label>Nom du produit</label>
                    <input type="text" id="edit-nom" value="${escapeHtml(
                      product.nom
                    )}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Quantité</label>
                        <input type="number" id="edit-quantite" value="${
                          product.quantite
                        }" required min="0">
                    </div>
                    <div class="form-group">
                        <label>Prix unitaire (€)</label>
                        <input type="number" id="edit-prix" value="${
                          product.prix
                        }" step="0.01" required min="0">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Localisation</label>
                        <input type="text" id="edit-localisation" value="${escapeHtml(
                          product.localisation
                        )}">
                    </div>
                    <div class="form-group">
                        <label>Seuil d'alerte</label>
                        <input type="number" id="edit-seuil" value="${
                          product.seuil
                        }" required min="0">
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="closeEditModal()">Annuler</button>
                    <button type="submit" class="btn-primary">Enregistrer</button>
                </div>
            </form>
        </div>
    `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
    editingProductId = null;
  }
}

// Sauvegarder les modifications
async function saveEdit(e) {
  e.preventDefault();

  const updatedProduct = {
    nom: document.getElementById("edit-nom").value.trim(),
    quantite: parseInt(document.getElementById("edit-quantite").value),
    prix: parseFloat(document.getElementById("edit-prix").value),
    localisation:
      document.getElementById("edit-localisation").value.trim() || "Non défini",
    seuil: parseInt(document.getElementById("edit-seuil").value),
  };

  if (!updatedProduct.nom) {
    showNotification("Le nom du produit est requis", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/products/${editingProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updatedProduct),
    });

    if (response.ok) {
      await loadProducts();
      await updateStats();
      closeEditModal();
      showNotification("✓ Produit modifié avec succès", "success");
    } else {
      const error = await response.json();
      showNotification(
        error.error || "Erreur lors de la modification",
        "error"
      );
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur lors de la modification", "error");
  }
}

// Supprimer un produit
async function deleteProduct(id, nom) {
  if (!confirm(`Voulez-vous vraiment supprimer "${nom}" ?`)) return;

  try {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      await loadProducts();
      await updateStats();
      showNotification("✓ Produit supprimé", "info");
    } else {
      const error = await response.json();
      showNotification(error.error || "Erreur lors de la suppression", "error");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur lors de la suppression", "error");
  }
}

// Recherche locale
function handleSearch(e) {
  const search = e.target.value.toLowerCase();
  const cards = document.querySelectorAll(".product-card");

  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(search) ? "block" : "none";
  });
}

// Mettre à jour les statistiques
async function updateStats() {
  try {
    const response = await fetch(`${API_URL}/stats`, {
      credentials: "include",
    });

    if (!response.ok) return;

    const stats = await response.json();
    document.getElementById("total-products").textContent = stats.total || 0;
    document.getElementById("low-stock").textContent = stats.low_stock || 0;
  } catch (error) {
    console.error("Erreur stats:", error);
  }
}

// Notifications
function showNotification(message, type = "success") {
  const notif = document.createElement("div");
  notif.className = `notification notification-${type}`;

  const colors = {
    success: "#10b981",
    warning: "#f59e0b",
    error: "#e94560",
    info: "#0ea5e9",
  };

  notif.style.cssText = `
        position: fixed;
        top: 30px;
        right: 30px;
        background: linear-gradient(135deg, ${colors[type]} 0%, ${colors[type]}dd 100%);
        color: white;
        padding: 18px 28px;
        border-radius: 12px;
        box-shadow: 0 8px 25px ${colors[type]}66;
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: 280px;
        border: 1px solid ${colors[type]}44;
    `;
  notif.textContent = message;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = "slideOutRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
    setTimeout(() => notif.remove(), 400);
  }, 3000);
}

const style = document.createElement("style");
style.textContent = `
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOutRight {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
`;
document.head.appendChild(style);
