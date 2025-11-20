// machines.js - VERSION COMPLÈTE
const API = window.location.origin + "/api";
console.log("✅ machines.js chargé");

let allMachines = [];
let editingMachineId = null;
let uploadedGlbFile = null;
let uploadedSolidworksFile = null;

// =================== CHARGEMENT ===================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Initialisation des machines");
  await loadMachines();
  setupEventListeners();
  checkAgentStatus();
  setInterval(checkAgentStatus, 30000);
});

// =================== AGENT STATUS ===================
async function checkAgentStatus() {
  try {
    const response = await fetch(`${API}/agent/status`);
    const data = await response.json();

    const statusEl = document.getElementById("sw-agent-status");
    if (statusEl) {
      if (data.connected) {
        statusEl.innerHTML = `Agent: ✅ connecté`;
        statusEl.className = "agent-status ok";
      } else {
        statusEl.innerHTML = `Agent: ❌ non connecté`;
        statusEl.className = "agent-status ko";
      }
    }
  } catch (error) {
    console.error("❌ Erreur vérification agent:", error);
    const statusEl = document.getElementById("sw-agent-status");
    if (statusEl) {
      statusEl.innerHTML = `Agent: ❌ non connecté`;
      statusEl.className = "agent-status ko";
    }
  }
}

// =================== CHARGEMENT MACHINES ===================
async function loadMachines() {
  try {
    console.log("📥 Chargement des machines...");
    const response = await fetch(`${API}/machines`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const machines = await response.json();
    console.log(`✅ ${machines.length} machines chargées`, machines);

    allMachines = machines;
    displayMachines(machines);
  } catch (error) {
    console.error("❌ Erreur chargement machines:", error);
    showNotification("Erreur lors du chargement des machines", "error");
  }
}

// =================== AFFICHAGE ===================
function displayMachines(machines) {
  const list = document.getElementById("machines-list");
  if (!list) {
    console.error("❌ Élément machines-list introuvable");
    return;
  }

  if (machines.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>🏭</p>
        <p>Aucune machine trouvée</p>
        <p>Cliquez sur "Ajouter" pour créer votre première machine</p>
      </div>
    `;
    return;
  }

  list.innerHTML = machines
    .map((m) => {
      const hasGlb = m.glb_file ? "✅" : "❌";
      const hasSw = m.solidworks_link ? "✅" : "❌";

      // Prévisualisation 3D si fichier GLB disponible
      const preview3D = m.glb_file
        ? `
          <div style="margin: 12px 0;">
            <model-viewer 
              src="${m.glb_file}" 
              alt="${m.nom}"
              auto-rotate 
              camera-controls 
              shadow-intensity="1"
              style="width: 100%; height: 250px; background: #0a0a0a; border-radius: 12px; border: 2px solid #dc2626;"
            ></model-viewer>
          </div>
        `
        : `
          <div style="margin: 12px 0; padding: 40px; text-align: center; background: #0a0a0a; border-radius: 12px; border: 2px dashed #3d3d3d;">
            <p style="color: #9ca3af; font-size: 14px;">📦 Aucun modèle 3D</p>
          </div>
        `;

      return `
        <div class="product-card">
          <div class="product-header">
            <h3>${m.nom}</h3>
            <span class="product-quantity">${m.quantite || 1}</span>
          </div>
          
          ${preview3D}
          
          <div class="product-body">
            <div class="product-info">
              <strong>Référence:</strong> ${m.reference}
            </div>
            ${
              m.localisation
                ? `<div class="product-info"><strong>Localisation:</strong> ${m.localisation}</div>`
                : ""
            }
            ${
              m.dimensions
                ? `<div class="product-info"><strong>Dimensions:</strong> ${m.dimensions}</div>`
                : ""
            }
            ${
              m.poids
                ? `<div class="product-info"><strong>Poids:</strong> ${m.poids} kg</div>`
                : ""
            }
            <div class="product-info">
              <strong>Fichiers:</strong> 3D ${hasGlb} | SW ${hasSw}
            </div>
          </div>
          <div class="product-actions">
            <button class="btn-small btn-edit" onclick="editMachine(${m.id})">
              ✏️ Modifier
            </button>
            <button class="btn-small btn-primary" onclick="showMachineDetails(${
              m.id
            })">
              👁️ Détails
            </button>
            <button class="btn-small btn-delete" onclick="deleteMachine(${
              m.id
            })">
              🗑️ Supprimer
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

// =================== EVENT LISTENERS ===================
function setupEventListeners() {
  // Bouton ajouter
  const addBtn = document.getElementById("add-machine-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      editingMachineId = null;
      document.getElementById("machine-form").reset();
      const cancelBtn = document.getElementById("cancel-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
      document.getElementById("add-section").style.display = "block";
      uploadedGlbFile = null;
      uploadedSolidworksFile = null;
    });
  }

  // Bouton annuler
  const cancelBtn = document.getElementById("cancel-edit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      editingMachineId = null;
      document.getElementById("machine-form").reset();
      cancelBtn.style.display = "none";
      uploadedGlbFile = null;
      uploadedSolidworksFile = null;
    });
  }

  // Formulaire
  const form = document.getElementById("machine-form");
  if (form) {
    form.addEventListener("submit", saveMachine);
  }

  // Recherche
  const searchInput = document.getElementById("search-machines");
  if (searchInput) {
    searchInput.addEventListener("input", filterMachines);
  }

  // Tri
  const sortSelect = document.getElementById("sort-machines");
  if (sortSelect) {
    sortSelect.addEventListener("change", sortMachines);
  }

  // Upload fichier 3D GLB
  const glbInput = document.getElementById("glb_file");
  if (glbInput) {
    glbInput.addEventListener("change", (e) => {
      uploadedGlbFile = e.target.files[0];
      console.log("📁 Fichier 3D GLB sélectionné:", uploadedGlbFile?.name);
    });
  }

  // Input texte SolidWorks (juste le chemin, pas de fichier)
  const solidworksInput = document.getElementById("solidworks_link");
  if (solidworksInput) {
    solidworksInput.addEventListener("input", (e) => {
      console.log("📝 Chemin SolidWorks:", e.target.value);
    });
  }

  // Modal
  const modalClose = document.getElementById("modal-close");
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  // Tabs
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

// =================== RECHERCHE & TRI ===================
function filterMachines() {
  const search =
    document.getElementById("search-machines")?.value.toLowerCase() || "";

  let filtered = allMachines.filter(
    (m) =>
      m.nom.toLowerCase().includes(search) ||
      m.reference.toLowerCase().includes(search) ||
      (m.localisation && m.localisation.toLowerCase().includes(search))
  );

  displayMachines(filtered);
}

function sortMachines() {
  const sortBy = document.getElementById("sort-machines")?.value;

  if (!sortBy) {
    displayMachines(allMachines);
    return;
  }

  const sorted = [...allMachines].sort((a, b) => {
    if (a[sortBy] < b[sortBy]) return -1;
    if (a[sortBy] > b[sortBy]) return 1;
    return 0;
  });

  displayMachines(sorted);
}

// =================== SAUVEGARDE ===================
async function saveMachine(event) {
  event.preventDefault();

  const formData = new FormData();
  formData.append("nom", document.getElementById("nom").value);
  formData.append("reference", document.getElementById("reference").value);
  formData.append("quantite", document.getElementById("quantite").value);
  formData.append(
    "localisation",
    document.getElementById("localisation").value || ""
  );
  formData.append("prix", document.getElementById("prix").value || 0);
  formData.append(
    "seuil_alert",
    document.getElementById("seuil_alert").value || 5
  );
  formData.append(
    "dimensions",
    document.getElementById("dimensions").value || ""
  );
  formData.append("poids", document.getElementById("poids").value || 0);

  // Chemin SolidWorks (texte)
  const solidworksLink = document.getElementById("solidworks_link").value;
  if (solidworksLink) {
    formData.append("solidworks_link", solidworksLink);
  }

  // Fichier 3D GLB (fichier)
  if (uploadedGlbFile) {
    formData.append("glb_file", uploadedGlbFile);
    console.log("📤 Upload du fichier GLB:", uploadedGlbFile.name);
  }

  try {
    const url = editingMachineId
      ? `${API}/machines/${editingMachineId}`
      : `${API}/machines`;

    const response = await fetch(url, {
      method: editingMachineId ? "PUT" : "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur sauvegarde");
    }

    showNotification(
      editingMachineId
        ? "Machine modifiée avec succès"
        : "Machine ajoutée avec succès",
      "success"
    );

    document.getElementById("machine-form").reset();
    const cancelBtn = document.getElementById("cancel-edit");
    if (cancelBtn) cancelBtn.style.display = "none";
    editingMachineId = null;
    uploadedGlbFile = null;
    uploadedSolidworksFile = null;

    await loadMachines();
  } catch (error) {
    console.error("❌ Erreur sauvegarde:", error);
    showNotification(error.message || "Erreur lors de la sauvegarde", "error");
  }
}

// =================== MODIFICATION ===================
async function editMachine(id) {
  try {
    const response = await fetch(`${API}/machines/${id}`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Erreur chargement machine");

    const machine = await response.json();
    editingMachineId = id;

    document.getElementById("nom").value = machine.nom;
    document.getElementById("reference").value = machine.reference;
    document.getElementById("quantite").value = machine.quantite || 1;
    document.getElementById("localisation").value = machine.localisation || "";
    document.getElementById("prix").value = machine.prix || 0;
    document.getElementById("seuil_alert").value = machine.seuil_alert || 5;
    document.getElementById("dimensions").value = machine.dimensions || "";
    document.getElementById("poids").value = machine.poids || 0;

    if (machine.solidworks_link) {
      document.getElementById("solidworks_link").value = machine.solidworks_link
        .split("/")
        .pop();
    }

    document.getElementById("cancel-edit").style.display = "inline-flex";
    document.getElementById("add-section").style.display = "block";
    document
      .getElementById("add-section")
      .scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification("Erreur lors du chargement de la machine", "error");
  }
}

// =================== SUPPRESSION ===================
async function deleteMachine(id) {
  if (!confirm("Êtes-vous sûr de vouloir supprimer cette machine ?")) return;

  try {
    const response = await fetch(`${API}/machines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) throw new Error("Erreur suppression");

    showNotification("Machine supprimée avec succès", "success");
    await loadMachines();
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification("Erreur lors de la suppression", "error");
  }
}

// =================== MODAL DÉTAILS ===================
async function showMachineDetails(id) {
  try {
    const response = await fetch(`${API}/machines/${id}`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Erreur chargement machine");

    const machine = await response.json();

    document.getElementById("modal-title").textContent = machine.nom;

    // Tab Infos
    document.getElementById("tab-infos").innerHTML = `
      <div class="product-info"><strong>Référence:</strong> ${
        machine.reference
      }</div>
      <div class="product-info"><strong>Quantité:</strong> ${
        machine.quantite || 1
      }</div>
      ${
        machine.localisation
          ? `<div class="product-info"><strong>Localisation:</strong> ${machine.localisation}</div>`
          : ""
      }
      ${
        machine.dimensions
          ? `<div class="product-info"><strong>Dimensions:</strong> ${machine.dimensions}</div>`
          : ""
      }
      ${
        machine.poids
          ? `<div class="product-info"><strong>Poids:</strong> ${machine.poids} kg</div>`
          : ""
      }
      ${
        machine.prix
          ? `<div class="product-info"><strong>Prix:</strong> ${machine.prix} €</div>`
          : ""
      }
      ${
        machine.seuil_alert
          ? `<div class="product-info"><strong>Seuil d'alerte:</strong> ${machine.seuil_alert}</div>`
          : ""
      }
    `;

    // Tab Files avec prévisualisation 3D
    if (machine.glb_file) {
      document.getElementById("tab-files").innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3>📦 Prévisualisation 3D</h3>
          <model-viewer 
            src="${machine.glb_file}" 
            alt="${machine.nom}"
            auto-rotate 
            camera-controls 
            shadow-intensity="1"
            style="width: 100%; height: 400px; background: #1a1a1a; border-radius: 12px; border: 2px solid #dc2626;"
          ></model-viewer>
        </div>
        <div class="product-info">
          ✅ <a href="${
            machine.glb_file
          }" target="_blank" download>📥 Télécharger le modèle 3D (.glb)</a>
        </div>
        ${
          machine.solidworks_link
            ? `<div class="product-info">✅ <a href="${machine.solidworks_link}" target="_blank" download>📥 Télécharger le fichier SolidWorks</a></div>`
            : "<div class='product-info'>❌ Aucun fichier SolidWorks</div>"
        }
      `;
    } else {
      document.getElementById("tab-files").innerHTML = `
        <div class="empty-state">
          <p>📦</p>
          <p>❌ Aucun modèle 3D disponible</p>
        </div>
        ${
          machine.solidworks_link
            ? `<div class="product-info">✅ <a href="${machine.solidworks_link}" target="_blank" download>📥 Télécharger le fichier SolidWorks</a></div>`
            : "<div class='product-info'>❌ Aucun fichier SolidWorks</div>"
        }
      `;
    }

    // Tab Maintenance
    document.getElementById(
      "tab-maintenance"
    ).innerHTML = `<p>Fonctionnalité à venir...</p>`;

    document.getElementById("machine-modal").style.display = "flex";
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification("Erreur lors du chargement des détails", "error");
  }
}

function closeModal() {
  document.getElementById("machine-modal").style.display = "none";
}

function switchTab(tabName) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`tab-${tabName}`).classList.add("active");
}

// =================== NOTIFICATIONS ===================
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Fermer modal en cliquant à l'extérieur
window.onclick = function (event) {
  const modal = document.getElementById("machine-modal");
  if (event.target === modal) {
    closeModal();
  }
};

console.log("✅ machines.js initialisé");
