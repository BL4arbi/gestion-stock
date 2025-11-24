// machines.js - VERSION COMPLÈTE
const API = window.location.origin + "/api";
console.log("✅ machines.js chargé");

let allMachines = [];
let editingMachineId = null;
let uploadedGlbFile = null;

// =================== NOTIFICATION ===================
function showNotification(message, type = "info") {
  const oldNotif = document.querySelector(".notification");
  if (oldNotif) oldNotif.remove();

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  const colors = {
    success: "#10b981",
    error: "#ef4444",
    info: "#3b82f6",
    warning: "#f59e0b",
  };
  notification.style.background = colors[type] || colors.info;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Ajouter les animations CSS
if (!document.getElementById("notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

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
  const statusEl = document.getElementById("sw-agent-status");
  if (!statusEl) return;

  try {
    const response = await fetch(`${API}/agent/status`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Agent non disponible");
    }

    const data = await response.json();

    if (data.connected) {
      statusEl.innerHTML = `Agent: ✅ connecté`;
      statusEl.className = "agent-status ok";
    } else {
      statusEl.innerHTML = `Agent: ❌ non connecté`;
      statusEl.className = "agent-status ko";
    }
  } catch (error) {
    console.error("❌ Erreur vérification agent:", error);
    statusEl.innerHTML = `Agent: ❌ non connecté`;
    statusEl.className = "agent-status ko";
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

      console.log("Machine:", m.nom, "GLB:", m.glb_file); // Debug

      const preview3D = m.glb_file
        ? `
          <div style="margin: 12px 0;">
            <model-viewer 
              src="${m.glb_file}" 
              alt="${escapeHtml(m.nom)}"
              auto-rotate 
              camera-controls 
              shadow-intensity="1"
              environment-image="neutral"
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
            <h3>${escapeHtml(m.nom)}</h3>
            <span class="product-quantity">${m.quantite || 1}</span>
          </div>
          
          ${preview3D}
          
          <div class="product-body">
            <div class="product-info">
              <strong>Référence:</strong> ${escapeHtml(m.reference)}
            </div>
            ${
              m.localisation
                ? `<div class="product-info"><strong>Localisation:</strong> ${escapeHtml(
                    m.localisation
                  )}</div>`
                : ""
            }
            ${
              m.dimensions
                ? `<div class="product-info"><strong>Dimensions:</strong> ${escapeHtml(
                    m.dimensions
                  )}</div>`
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
  const addBtn = document.getElementById("add-machine-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      editingMachineId = null;
      document.getElementById("machine-form").reset();
      const cancelBtn = document.getElementById("cancel-edit");
      if (cancelBtn) cancelBtn.style.display = "none";
      document.getElementById("add-section").style.display = "block";
      uploadedGlbFile = null;
    });
  }

  const cancelBtn = document.getElementById("cancel-edit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      editingMachineId = null;
      document.getElementById("machine-form").reset();
      document.getElementById("add-section").style.display = "none";
      cancelBtn.style.display = "none";
      uploadedGlbFile = null;
    });
  }

  const form = document.getElementById("machine-form");
  if (form) {
    form.addEventListener("submit", saveMachine);
  }

  const searchInput = document.getElementById("search-machines");
  if (searchInput) {
    searchInput.addEventListener("input", filterMachines);
  }

  const sortSelect = document.getElementById("sort-machines");
  if (sortSelect) {
    sortSelect.addEventListener("change", sortMachines);
  }

  const glbInput = document.getElementById("glb_file");
  if (glbInput) {
    glbInput.addEventListener("change", (e) => {
      uploadedGlbFile = e.target.files[0];
      console.log("📁 Fichier 3D GLB sélectionné:", uploadedGlbFile?.name);
    });
  }

  const modalClose = document.getElementById("modal-close");
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      document.getElementById("machine-modal").style.display = "none";
    });
  }
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

  const solidworksLink = document
    .getElementById("solidworks_link")
    .value.trim();
  if (solidworksLink) {
    const cleanPath = solidworksLink.replace(/^["']|["']$/g, "");
    formData.append("solidworks_link", cleanPath);
    console.log("📝 Chemin SolidWorks enregistré:", cleanPath);
  }

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
        ? "✅ Machine modifiée avec succès"
        : "✅ Machine ajoutée avec succès",
      "success"
    );

    document.getElementById("machine-form").reset();
    document.getElementById("add-section").style.display = "none";
    const cancelBtn = document.getElementById("cancel-edit");
    if (cancelBtn) cancelBtn.style.display = "none";
    editingMachineId = null;
    uploadedGlbFile = null;

    await loadMachines();
  } catch (error) {
    console.error("❌ Erreur sauvegarde:", error);
    showNotification(
      "❌ " + (error.message || "Erreur lors de la sauvegarde"),
      "error"
    );
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
      document.getElementById("solidworks_link").value =
        machine.solidworks_link;
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

    showNotification("✅ Machine supprimée avec succès", "success");
    await loadMachines();
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification("❌ Erreur lors de la suppression", "error");
  }
}

// =================== GESTION DES TABS ===================
function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.remove("active");
    panel.style.display = "none";
  });

  const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeTab) {
    activeTab.classList.add("active");
  }

  const activePanel = document.getElementById(`tab-${tabName}`);
  if (activePanel) {
    activePanel.classList.add("active");
    activePanel.style.display = "block";
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
    console.log("Machine détails:", machine); // Debug

    document.getElementById("modal-title").textContent = machine.nom;

    // Tab Infos
    document.getElementById("tab-infos").innerHTML = `
      <div class="product-info"><strong>Référence:</strong> ${escapeHtml(
        machine.reference
      )}</div>
      <div class="product-info"><strong>Quantité:</strong> ${
        machine.quantite || 1
      }</div>
      ${
        machine.localisation
          ? `<div class="product-info"><strong>Localisation:</strong> ${escapeHtml(
              machine.localisation
            )}</div>`
          : ""
      }
      ${
        machine.dimensions
          ? `<div class="product-info"><strong>Dimensions:</strong> ${escapeHtml(
              machine.dimensions
            )}</div>`
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

    // Tab Fichiers
    const solidworksPath = machine.solidworks_link
      ? JSON.stringify(machine.solidworks_link)
      : null;
    const solidworksButton = solidworksPath
      ? `<button class="btn btn-primary" onclick='openInSolidworks(${solidworksPath}, ${id})' style="margin-top:10px;">
           🔧 Ouvrir dans SolidWorks
         </button>`
      : "";

    console.log("GLB File path:", machine.glb_file); // Debug

    if (machine.glb_file) {
      document.getElementById("tab-files").innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3>📦 Prévisualisation 3D</h3>
          <model-viewer 
            src="${machine.glb_file}" 
            alt="${escapeHtml(machine.nom)}"
            auto-rotate 
            camera-controls 
            shadow-intensity="1"
            environment-image="neutral"
            style="width: 100%; height: 500px; background: #1a1a1a; border-radius: 12px; border: 2px solid #dc2626;"
            loading="eager"
          ></model-viewer>
          <p style="color: #999; font-size: 12px; margin-top: 8px;">Chemin: ${
            machine.glb_file
          }</p>
        </div>
        <div class="product-info">
          ✅ <a href="${
            machine.glb_file
          }" target="_blank" download>📥 Télécharger le modèle 3D (.glb)</a>
        </div>
        ${
          machine.solidworks_link
            ? `
          <div class="product-info" style="margin-top: 15px;">
            ✅ <strong>Fichier SolidWorks:</strong><br>
            <code style="background: #2a2a2a; padding: 8px; border-radius: 4px; display: block; margin-top: 5px; word-break: break-all;">${escapeHtml(
              machine.solidworks_link
            )}</code>
            ${solidworksButton}
          </div>
        `
            : "<div class='product-info'>❌ Aucun fichier SolidWorks</div>"
        }
      `;
    } else {
      document.getElementById("tab-files").innerHTML = `
        <div class="empty-state">
          <p style="font-size: 48px;">📦</p>
          <p>❌ Aucun modèle 3D disponible</p>
        </div>
        ${
          machine.solidworks_link
            ? `
          <div class="product-info" style="margin-top: 15px;">
            ✅ <strong>Fichier SolidWorks:</strong><br>
            <code style="background: #2a2a2a; padding: 8px; border-radius: 4px; display: block; margin-top: 5px; word-break: break-all;">${escapeHtml(
              machine.solidworks_link
            )}</code>
            ${solidworksButton}
          </div>
        `
            : "<div class='product-info'>❌ Aucun fichier SolidWorks</div>"
        }
      `;
    }

    // Tab Maintenance
    document.getElementById("tab-maintenance").innerHTML = `
      <div class="empty-state">
        <p style="font-size: 48px;">🔧</p>
        <p>Fonctionnalité maintenance à venir...</p>
      </div>
    `;

    const modal = document.getElementById("machine-modal");
    modal.style.display = "flex";

    switchTab("infos");

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        switchTab(tab.dataset.tab);
      };
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    showNotification("❌ Erreur lors du chargement des détails", "error");
  }
}

// =================== OUVRIR DANS SOLIDWORKS ===================
async function openInSolidworks(filePath, machineId) {
  try {
    showNotification("🔄 Envoi de la commande à l'agent SolidWorks...", "info");

    console.log("📤 Ouverture SolidWorks:", filePath);

    const response = await fetch(`${API}/agent/open-solidworks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ filePath, machineId }),
    });

    const result = await response.json();

    if (response.ok) {
      showNotification("✅ Fichier ouvert dans SolidWorks", "success");
      console.log("✅ Succès:", result);
    } else {
      throw new Error(result.error || "Erreur ouverture");
    }
  } catch (error) {
    console.error("❌ Erreur ouverture SolidWorks:", error);

    let errorMessage = "❌ Impossible d'ouvrir le fichier.\n\n";

    if (error.message.includes("fetch")) {
      errorMessage += "Le serveur ne répond pas.";
    } else if (error.message.includes("agent")) {
      errorMessage +=
        "L'agent SolidWorks n'est pas connecté.\nLancez sw-agent.js sur le poste.";
    } else {
      errorMessage += error.message;
    }

    showNotification(errorMessage, "error");
  }
}

// =================== FONCTION UTILITAIRE ===================
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Fermer modal en cliquant à l'extérieur
window.onclick = function (event) {
  const modal = document.getElementById("machine-modal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
};

console.log("✅ machines.js initialisé");
