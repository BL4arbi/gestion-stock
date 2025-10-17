const API = window.location.origin + "/api";
let allMachines = [];

// Charger les machines
async function loadMachines() {
  try {
    const response = await fetch(`${API}/machines`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Erreur chargement");
    }

    allMachines = await response.json();
    renderMachines(allMachines);
    updateStats(allMachines);
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur chargement machines", "error");
  }
}

// Mettre à jour les stats
function updateStats(machines) {
  const totalElem = document.getElementById("total-machines");
  if (totalElem) {
    totalElem.textContent = machines.length;
  }
}

// Afficher les machines
function renderMachines(machines) {
  const container = document.getElementById("machines-list");

  if (!container) return;

  if (!machines || machines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <h3>Aucune machine</h3>
        <p>Ajoutez votre première machine</p>
      </div>
    `;
    return;
  }

  // Vérifie que userPermissions est défini
  const perms = window.userPermissions || {
    canDelete: false,
  };

  container.innerHTML = machines
    .map(
      (machine) => `
      <div class="machine-card">
        <div class="machine-3d">
          ${
            machine.glb_path
              ? `<model-viewer src="${machine.glb_path}" auto-rotate camera-controls style="width:100%;height:100%;background:#000;"></model-viewer>`
              : `<div style="background:#000;display:flex;align-items:center;justify-content:center;color:#666;width:100%;height:100%;font-size:2em;">📦</div>`
          }
        </div>
        
        <div class="machine-footer">
          <div class="machine-title">${escapeHtml(machine.nom)}</div>
          <div class="machine-actions-bottom">
            <button class="btn-compact" onclick="openMachineDetails(${
              machine.id
            })" title="Détails">📋 Détails</button>
            ${
              perms.canDelete
                ? `<button class="btn-compact delete" onclick="deleteMachine(${machine.id})" title="Supprimer">🗑️</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

// Échapper HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Supprimer une machine
async function deleteMachine(id) {
  if (!confirm("Supprimer cette machine ?")) return;

  try {
    const response = await fetch(`${API}/machines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      showNotification("✅ Machine supprimée", "success");
      await loadMachines();
    } else {
      showNotification("❌ Erreur suppression", "error");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur connexion", "error");
  }
}

// Ouvrir les détails d'une machine
async function openMachineDetails(id) {
  const machine = allMachines.find((m) => m.id === id);
  if (!machine) return;

  // Récupère les maintenances et fichiers
  let maintenances = [];
  let files = [];

  try {
    const maintenanceRes = await fetch(`${API}/machines/${id}/maintenances`, {
      credentials: "include",
    });
    if (maintenanceRes.ok) {
      maintenances = await maintenanceRes.json();
    }

    const filesRes = await fetch(`${API}/machines/${id}/files`, {
      credentials: "include",
    });
    if (filesRes.ok) {
      files = await filesRes.json();
    }
  } catch (error) {
    console.error("Erreur chargement détails:", error);
  }

  // Crée la modale
  let modal = document.getElementById("machine-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "machine-modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  const perms = window.userPermissions || { canDelete: false, canEdit: false };

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px;">
      <div class="modal-header">
        <h2>🤖 ${escapeHtml(machine.nom)}</h2>
        <button class="modal-close" onclick="document.getElementById('machine-modal').style.display='none'">×</button>
      </div>

      <div class="modal-body">
        <!-- Informations principales -->
        <div class="info-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-bottom:25px;">
          <div class="info-item">
            <strong>🏷️ Référence:</strong>
            <span>${escapeHtml(machine.reference)}</span>
          </div>
          <div class="info-item">
            <strong>📦 Quantité:</strong>
            <span>${machine.quantite}</span>
          </div>
          <div class="info-item">
            <strong>📍 Localisation:</strong>
            <span>${escapeHtml(machine.localisation || "N/A")}</span>
          </div>
          <div class="info-item">
            <strong>💰 Prix:</strong>
            <span>${parseFloat(machine.prix || 0).toFixed(2)}€</span>
          </div>
          <div class="info-item">
            <strong>⚠️ Seuil alerte:</strong>
            <span>${machine.seuil_alert || 5}</span>
          </div>
          <div class="info-item">
            <strong>📅 Créée le:</strong>
            <span>${new Date(machine.created_at).toLocaleDateString(
              "fr-FR"
            )}</span>
          </div>
        </div>

        <!-- Visualisation 3D -->
        ${
          machine.glb_path
            ? `
          <div style="margin-bottom:25px;">
            <h3 style="margin-bottom:10px;">🎨 Modèle 3D</h3>
            <div style="background:#000;border-radius:8px;overflow:hidden;aspect-ratio:16/9;">
              <model-viewer 
                src="${machine.glb_path}" 
                auto-rotate 
                camera-controls 
                style="width:100%;height:100%;background:#000;">
              </model-viewer>
            </div>
          </div>
        `
            : ""
        }

        <!-- Maintenances -->
        <div style="margin-bottom:25px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3>🔧 Maintenances</h3>
            ${
              perms.canEdit
                ? `<button class="btn-primary" onclick="openAddMaintenanceModal(${id})">➕ Ajouter</button>`
                : ""
            }
          </div>
          <div id="maintenances-list">
            ${
              maintenances.length === 0
                ? '<p style="color:#999;text-align:center;padding:20px;">Aucune maintenance planifiée</p>'
                : maintenances
                    .map(
                      (m) => `
                <div class="maintenance-card" style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${
                  m.status === "completed"
                    ? "#10b981"
                    : m.status === "in_progress"
                    ? "#f59e0b"
                    : "#667eea"
                };">
                  <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                      <strong>${escapeHtml(m.type)}</strong>
                      <p style="margin:5px 0;color:#666;">${escapeHtml(
                        m.description || "Pas de description"
                      )}</p>
                      <small style="color:#999;">
                        📅 Programmée: ${new Date(
                          m.date_programmee
                        ).toLocaleDateString("fr-FR")}
                        ${
                          m.date_realisee
                            ? ` | ✓ Réalisée: ${new Date(
                                m.date_realisee
                              ).toLocaleDateString("fr-FR")}`
                            : ""
                        }
                      </small>
                    </div>
                    <div>
                      <span style="padding:4px 12px;border-radius:12px;font-size:0.85em;background:${
                        m.status === "completed"
                          ? "#10b981"
                          : m.status === "in_progress"
                          ? "#f59e0b"
                          : "#667eea"
                      };color:white;">
                        ${
                          m.status === "completed"
                            ? "✓ Terminée"
                            : m.status === "in_progress"
                            ? "⏳ En cours"
                            : "📋 Planifiée"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              `
                    )
                    .join("")
            }
          </div>
        </div>

        <!-- Fichiers -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3>📁 Documents & Plans</h3>
            ${
              perms.canEdit
                ? `<button class="btn-primary" onclick="openUploadFileModal(${id})">➕ Ajouter fichier</button>`
                : ""
            }
          </div>
          <div id="files-list">
            ${
              files.length === 0
                ? '<p style="color:#999;text-align:center;padding:20px;">Aucun fichier</p>'
                : files
                    .map(
                      (f) => `
                <div class="file-item" style="background:#f8f9fa;padding:12px 15px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.5em;">📄</span>
                    <div>
                      <strong>${escapeHtml(f.filename)}</strong>
                      <br><small style="color:#999;">Ajouté le ${new Date(
                        f.uploaded_at
                      ).toLocaleDateString("fr-FR")}</small>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;">
                    <a href="${
                      f.path
                    }" target="_blank" class="btn-small">👁️ Voir</a>
                    ${
                      perms.canDelete
                        ? `<button class="btn-small btn-delete" onclick="deleteFile(${f.id}, ${id})">🗑️</button>`
                        : ""
                    }
                  </div>
                </div>
              `
                    )
                    .join("")
            }
          </div>
        </div>
      </div>

      <div class="modal-actions">
        ${
          perms.canEdit
            ? `<button class="btn-primary" onclick="openEditMachineModal(${id})">✏️ Modifier</button>`
            : ""
        }
        <button class="btn-secondary" onclick="document.getElementById('machine-modal').style.display='none'">Fermer</button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

// Ajouter une maintenance
function openAddMaintenanceModal(machineId) {
  let modal = document.getElementById("add-maintenance-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "add-maintenance-modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header">
        <h2>➕ Ajouter une maintenance</h2>
        <button class="modal-close" onclick="document.getElementById('add-maintenance-modal').style.display='none'">×</button>
      </div>
      <form onsubmit="submitMaintenance(event, ${machineId})">
        <div class="form-group">
          <label>Type de maintenance *</label>
          <input type="text" id="maintenance-type" placeholder="Ex: Révision complète" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="maintenance-description" placeholder="Détails..." rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Date programmée *</label>
          <input type="date" id="maintenance-date" required />
        </div>
        <div class="form-group">
          <label>Priorité</label>
          <select id="maintenance-priority">
            <option value="low">🟢 Faible</option>
            <option value="medium" selected>🟡 Moyenne</option>
            <option value="high">🔴 Haute</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="document.getElementById('add-maintenance-modal').style.display='none'">Annuler</button>
          <button type="submit" class="btn-primary">Ajouter</button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = "flex";
}

// Soumettre maintenance
async function submitMaintenance(e, machineId) {
  e.preventDefault();

  const data = {
    type: document.getElementById("maintenance-type").value,
    description: document.getElementById("maintenance-description").value,
    date_programmee: document.getElementById("maintenance-date").value,
    priority: document.getElementById("maintenance-priority").value,
  };

  try {
    const response = await fetch(`${API}/machines/${machineId}/maintenances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (response.ok) {
      showNotification("✅ Maintenance ajoutée", "success");
      document.getElementById("add-maintenance-modal").style.display = "none";
      openMachineDetails(machineId); // Recharge les détails
    }
  } catch (error) {
    showNotification("❌ Erreur ajout maintenance", "error");
  }
}

// Upload fichier
function openUploadFileModal(machineId) {
  let modal = document.getElementById("upload-file-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "upload-file-modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header">
        <h2>📁 Ajouter un fichier</h2>
        <button class="modal-close" onclick="document.getElementById('upload-file-modal').style.display='none'">×</button>
      </div>
      <form onsubmit="submitFile(event, ${machineId})">
        <div class="form-group">
          <label>Fichier (PDF, DOCX, XLSX, Images) *</label>
          <input type="file" id="file-upload" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" required />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="document.getElementById('upload-file-modal').style.display='none'">Annuler</button>
          <button type="submit" class="btn-primary">Télécharger</button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = "flex";
}

// Soumettre fichier
async function submitFile(e, machineId) {
  e.preventDefault();

  const formData = new FormData();
  const fileInput = document.getElementById("file-upload");
  formData.append("file", fileInput.files[0]);

  try {
    const response = await fetch(`${API}/machines/${machineId}/files`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (response.ok) {
      showNotification("✅ Fichier ajouté", "success");
      document.getElementById("upload-file-modal").style.display = "none";
      openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("❌ Erreur upload fichier", "error");
  }
}

// Supprimer fichier
async function deleteFile(fileId, machineId) {
  if (!confirm("Supprimer ce fichier ?")) return;

  try {
    const response = await fetch(`${API}/machines/files/${fileId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      showNotification("✅ Fichier supprimé", "success");
      openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("❌ Erreur suppression", "error");
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();

  await loadMachines();

  // Formulaire d'ajout
  const machineForm = document.getElementById("machine-form");
  if (machineForm) {
    machineForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData();
      formData.append("nom", document.getElementById("nom").value);
      formData.append("reference", document.getElementById("reference").value);
      formData.append("quantite", document.getElementById("quantite").value);
      formData.append(
        "localisation",
        document.getElementById("localisation").value || ""
      );
      formData.append("prix", document.getElementById("prix").value || "0");
      formData.append(
        "seuil_alert",
        document.getElementById("seuil_alert").value || "5"
      );

      const glbFile = document.getElementById("glb_file").files[0];
      if (glbFile) {
        formData.append("glb_file", glbFile);
      }

      try {
        const response = await fetch(`${API}/machines`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (response.ok) {
          showNotification("✅ Machine ajoutée", "success");
          machineForm.reset(); // Vide le formulaire
          await loadMachines();
        } else {
          const error = await response.json();
          showNotification(`❌ ${error.error || "Erreur ajout"}`, "error");
        }
      } catch (error) {
        console.error("Erreur:", error);
        showNotification("Erreur connexion", "error");
      }
    });
  }

  // Recherche
  const searchInput = document.getElementById("search-machines");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const text = e.target.value.toLowerCase();
      const filtered = allMachines.filter(
        (m) =>
          m.nom.toLowerCase().includes(text) ||
          m.reference.toLowerCase().includes(text) ||
          (m.localisation && m.localisation.toLowerCase().includes(text))
      );
      renderMachines(filtered);
    });
  }

  // Tri
  const sortSelect = document.getElementById("sort-machines");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      let sorted = [...allMachines];
      switch (e.target.value) {
        case "nom":
          sorted.sort((a, b) => a.nom.localeCompare(b.nom));
          break;
        case "reference":
          sorted.sort((a, b) => a.reference.localeCompare(b.reference));
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
      }
      renderMachines(sorted);
    });
  }
});
