<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visserie - Tacquet Industries</title>
  <link rel="stylesheet" href="/css/main.css?v=15" /> <!-- 👈 Incrémente la version -->
</head>
<body>
  <header>
    <nav>
      <div class="logo">🏭 Tacquet Industries</div>
      <ul class="nav-links">
        <li><a href="/dashboard.html">📊 Dashboard</a></li>
        <li><a href="/machines.html">🤖 Machines</a></li>
        <li><a href="/maintenance.html">🔧 Maintenance</a></li>
        <li><a href="/fournisseurs.html" class="active">📦 Fournisseurs</a></li>
      </ul>
      <button class="logout-btn" onclick="logout()">🚪 Déconnexion</button>
    </nav>
  </header>

  <main>
    <div class="container">
      <h1>Gestion de la Visserie</h1>
      
      <div class="stats">
        <div class="stat-item">
          <h2 id="total-visserie">0</h2>
          <p>Total Visserie</p>
        </div>
        <div class="stat-item">
          <h2 id="visserie-alerte">0</h2>
          <p>Articles en alerte</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn" id="add-visserie-btn">➕ Ajouter une visserie</button>
        <div class="search-sort">
          <input type="text" id="search-visserie" placeholder="Rechercher une visserie..." />
          <select id="sort-visserie">
            <option value="nom">Trier par nom</option>
            <option value="reference">Trier par référence</option>
            <option value="quantite-asc">Trier par quantité (asc)</option>
            <option value="quantite-desc">Trier par quantité (desc)</option>
            <option value="prix-asc">Trier par prix (asc)</option>
            <option value="prix-desc">Trier par prix (desc)</option>
          </select>
        </div>
      </div>

      <div id="visserie-list" class="visserie-list">
        <!-- La visserie sera chargée ici par JavaScript -->
      </div>
    </div>
  </main>

  <script src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.0.1/model-viewer.min.js"></script>
  <script src="/js/auth.js"></script>
  <script src="/js/notifications.js"></script>
  <script src="/js/visserie.js"></script>
</body>
</html>

<script>
const API = window.location.origin + "/api";
let allVisserie = [];

// Charger la visserie
async function loadVisserie() {
  try {
    const response = await fetch(`${API}/visserie`, { 
      credentials: "include" 
    });
    
    if (!response.ok) throw new Error("Erreur chargement");
    
    allVisserie = await response.json();
    console.log('✅ Visserie chargée:', allVisserie.length);
    renderVisserie(allVisserie);
    updateVisserieStats(allVisserie);
  } catch (error) {
    console.error("Erreur chargement visserie:", error);
    showNotification("❌ Erreur chargement visserie", "error");
  }
}

// Mettre à jour les stats
function updateVisserieStats(items) {
  const totalElement = document.getElementById("total-visserie");
  const alerteElement = document.getElementById("visserie-alerte");
  
  if (totalElement) {
    totalElement.textContent = items.length;
  }
  
  if (alerteElement) {
    const enAlerte = items.filter(v => v.quantite <= (v.seuil_alert || 10));
    alerteElement.textContent = enAlerte.length;
  }
}

// Afficher la visserie
function renderVisserie(items) {
  const container = document.getElementById("visserie-list");

  if (!container) {
    console.error('❌ Container "visserie-list" non trouvé!');
    return;
  }

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔩</div>
        <h3>Aucune visserie</h3>
        <p>Ajoutez votre premier article de visserie</p>
      </div>
    `;
    return;
  }

  const perms = window.userPermissions || {
    canAddRemoveStock: false,
    canEdit: false,
    canDelete: false,
  };

  container.innerHTML = items
    .map(
      (item) => `
      <div class="visserie-card ${item.quantite <= (item.seuil_alert || 10) ? 'alerte' : ''}">
        <div class="visserie-header">
          <h3>${escapeHtml(item.nom)}</h3>
          ${item.quantite <= (item.seuil_alert || 10) ? '<span class="badge-alerte">⚠️ Stock bas</span>' : ''}
        </div>
        
        <div class="visserie-info">
          <div class="info-row">
            <span class="label">🏷️ Référence:</span>
            <span>${escapeHtml(item.reference)}</span>
          </div>
          <div class="info-row">
            <span class="label">📦 Quantité:</span>
            <span class="quantite-value">${item.quantite}</span>
          </div>
          <div class="info-row">
            <span class="label">📍 Localisation:</span>
            <span>${escapeHtml(item.localisation || 'N/A')}</span>
          </div>
          <div class="info-row">
            <span class="label">💰 Prix unitaire:</span>
            <span>${parseFloat(item.prix || 0).toFixed(2)}€</span>
          </div>
          <div class="info-row">
            <span class="label">⚠️ Seuil alerte:</span>
            <span>${item.seuil_alert || 10}</span>
          </div>
        </div>

        <div class="visserie-actions">
          ${
            perms.canAddRemoveStock
              ? `
            <button class="btn-small btn-add" onclick="adjustStock(${item.id}, 'add')" title="Ajouter du stock">
              ➕
            </button>
            <button class="btn-small btn-remove" onclick="adjustStock(${item.id}, 'remove')" title="Retirer du stock">
              ➖
            </button>
          `
              : ""
          }
          ${
            perms.canEdit
              ? `
            <button class="btn-small btn-edit" onclick="editVisserie(${item.id})" title="Modifier">
              ✏️
            </button>
          `
              : ""
          }
          ${
            perms.canDelete
              ? `
            <button class="btn-small btn-delete" onclick="deleteVisserie(${item.id})" title="Supprimer">
              🗑️
            </button>
          `
              : ""
          }
        </div>
      </div>
    `
    )
    .join("");
}

// Ajuster le stock
async function adjustStock(id, action) {
  const item = allVisserie.find((v) => v.id === id);
  if (!item) return;

  const quantity = parseInt(
    prompt(
      `${action === 'add' ? '➕ Ajouter' : '➖ Retirer'} combien de ${item.nom}?`,
      "1"
    )
  );

  if (!quantity || quantity <= 0) return;

  const newQuantity =
    action === "add" ? item.quantite + quantity : item.quantite - quantity;

  if (newQuantity < 0) {
    showNotification("❌ Stock insuffisant", "error");
    return;
  }

  try {
    const response = await fetch(`${API}/visserie/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...item,
        quantite: newQuantity,
      }),
    });

    if (response.ok) {
      showNotification(
        `✅ Stock ${action === 'add' ? 'ajouté' : 'retiré'}`,
        "success"
      );
      await loadVisserie();
    } else {
      throw new Error("Erreur mise à jour");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("❌ Erreur mise à jour stock", "error");
  }
}

// Modifier visserie
async function editVisserie(id) {
  const item = allVisserie.find((v) => v.id === id);
  if (!item) return;

  document.getElementById("nom").value = item.nom;
  document.getElementById("reference").value = item.reference;
  document.getElementById("quantite").value = item.quantite;
  document.getElementById("localisation").value = item.localisation || "";
  document.getElementById("prix").value = item.prix || 0;
  document.getElementById("seuil_alert").value = item.seuil_alert || 10;

  const form = document.getElementById("visserie-form");
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = "💾 Mettre à jour";
  submitBtn.style.background = "#f59e0b";

  let cancelBtn = document.getElementById("cancel-edit-btn");
  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.id = "cancel-edit-btn";
    cancelBtn.type = "button";
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = "❌ Annuler";
    cancelBtn.onclick = cancelEdit;
    submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
  }

  form.scrollIntoView({ behavior: "smooth" });

  form.onsubmit = async (e) => {
    e.preventDefault();
    await updateVisserie(id);
  };

  showNotification("✏️ Mode modification activé", "info");
}

// Mettre à jour visserie
async function updateVisserie(id) {
  const data = {
    nom: document.getElementById("nom").value,
    reference: document.getElementById("reference").value,
    quantite: parseInt(document.getElementById("quantite").value),
    localisation: document.getElementById("localisation").value || "",
    prix: parseFloat(document.getElementById("prix").value || 0),
    seuil_alert: parseInt(document.getElementById("seuil_alert").value || 10),
  };

  try {
    const response = await fetch(`${API}/visserie/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (response.ok) {
      showNotification("✅ Visserie mise à jour", "success");
      cancelEdit();
      await loadVisserie();
    } else {
      const error = await response.json();
      showNotification(`❌ ${error.error || "Erreur"}`, "error");
    }
  } catch (error) {
    showNotification("❌ Erreur connexion", "error");
  }
}

// Annuler modification
function cancelEdit() {
  const form = document.getElementById("visserie-form");
  form.reset();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = "Ajouter";
  submitBtn.style.background = "";

  const cancelBtn = document.getElementById("cancel-edit-btn");
  if (cancelBtn) cancelBtn.remove();

  form.onsubmit = null;

  showNotification("Modification annulée", "info");
}

// Supprimer visserie
async function deleteVisserie(id) {
  const item = allVisserie.find((v) => v.id === id);
  const itemName = item ? item.nom : `#${id}`;

  if (
    !confirm(
      `⚠️ SUPPRIMER CET ARTICLE ?\n\n${itemName}\n\nCette action est irréversible !`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${API}/visserie/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      showNotification("✅ Article supprimé", "success");
      await loadVisserie();
    } else {
      throw new Error("Erreur suppression");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("❌ Erreur suppression", "error");
  }
}

// Échapper HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();

  await loadVisserie();

  // Recherche
  const searchInput = document.getElementById("search-visserie");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const text = e.target.value.toLowerCase();
      const filtered = allVisserie.filter(
        (v) =>
          v.nom.toLowerCase().includes(text) ||
          v.reference.toLowerCase().includes(text) ||
          (v.localisation && v.localisation.toLowerCase().includes(text))
      );
      renderVisserie(filtered);
    });
  }

  // Tri
  const sortSelect = document.getElementById("sort-visserie");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      let sorted = [...allVisserie];
      switch (e.target.value) {
        case "nom":
          sorted.sort((a, b) => a.nom.localeCompare(b.nom));
          break;
        case "reference":
          sorted.sort((a, b) => a.reference.localeCompare(b.reference));
          break;
        case "quantite-asc":
          sorted.sort((a, b) => a.quantite - b.quantite);
          break;
        case "quantite-desc":
          sorted.sort((a, b) => b.quantite - a.quantite);
          break;
        case "prix-asc":
          sorted.sort((a, b) => (a.prix || 0) - (b.prix || 0));
          break;
        case "prix-desc":
          sorted.sort((a, b) => (b.prix || 0) - (a.prix || 0));
          break;
      }
      renderVisserie(sorted);
    });
  }

  // Formulaire d'ajout
  const form = document.getElementById("visserie-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = {
        nom: document.getElementById("nom").value,
        reference: document.getElementById("reference").value,
        quantite: parseInt(document.getElementById("quantite").value),
        localisation: document.getElementById("localisation").value || "",
        prix: parseFloat(document.getElementById("prix").value || 0),
        seuil_alert: parseInt(document.getElementById("seuil_alert").value || 10),
      };

      try {
        const response = await fetch(`${API}/visserie`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });

        if (response.ok) {
          showNotification("✅ Visserie ajoutée", "success");
          form.reset();
          await loadVisserie();
        } else {
          const error = await response.json();
          showNotification(`❌ ${error.error || "Erreur ajout"}`, "error");
        }
      } catch (error) {
        console.error("Erreur:", error);
        showNotification("❌ Erreur connexion", "error");
      }
    });
  }
});
</script>