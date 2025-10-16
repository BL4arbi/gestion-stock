const API = window.location.origin + "/api";
let allMachines = [];

async function loadMachines() {
  try {
    const response = await fetch(`${API}/machines`, { credentials: "include" });
    if (!response.ok) throw new Error("Erreur chargement");

    allMachines = await response.json();
    renderMachines(allMachines);
    updateMachineStats(allMachines);
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur chargement machines", "error");
  }
}

function updateMachineStats(machines) {
  document.getElementById("total-machines").textContent = machines.length;
}

function renderMachines(machines) {
  const container = document.getElementById("machines-list");

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

  container.innerHTML = machines
    .map(
      (machine) => `
      <div class="machine-card">
        <div class="machine-3d">
          ${
            machine.glb_path
              ? `<model-viewer src="${machine.glb_path}" auto-rotate camera-controls style="width:100%;height:100%;background:#000;"></model-viewer>`
              : `<div style="background:#000;display:flex;align-items:center;justify-content:center;color:#666;width:100%;height:100%;">📦</div>`
          }
        </div>
        
        <div class="machine-footer">
          <div class="machine-title">${escapeHtml(machine.nom)}</div>
          <div class="machine-actions-bottom">
            <button class="btn-compact" onclick="openMachineDetails(${
              machine.id
            })" title="Détails">📋</button>
            <button class="btn-compact delete" onclick="deleteMachine(${
              machine.id
            })" title="Supprimer">🗑️</button>
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

function handleMachineSearch(searchText) {
  const text = searchText.toLowerCase();
  const filtered = allMachines.filter(
    (m) =>
      m.nom.toLowerCase().includes(text) ||
      m.reference.toLowerCase().includes(text) ||
      (m.localisation && m.localisation.toLowerCase().includes(text))
  );
  renderMachines(filtered);
}

function sortMachines(sortBy) {
  let sorted = [...allMachines];
  switch (sortBy) {
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
}

async function openMachineDetails(machineId) {
  try {
    const machineRes = await fetch(`${API}/machines/${machineId}`, {
      credentials: "include",
    });
    if (!machineRes.ok) throw new Error("Erreur");
    const machine = await machineRes.json();

    const mainRes = await fetch(`${API}/machines/${machineId}/maintenances`, {
      credentials: "include",
    });
    const maintenances = mainRes.ok ? await mainRes.json() : [];

    const filesRes = await fetch(`${API}/machines/${machineId}/files`, {
      credentials: "include",
    });
    const files = filesRes.ok ? await filesRes.json() : [];

    showMachineModal(machine, maintenances, files);
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur chargement détails", "error");
  }
}

function getPriorityColor(priority) {
  const colors = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#e94560",
    critical: "#8b0000",
  };
  return colors[priority] || "#666";
}

function getPriorityLabel(priority) {
  const labels = {
    low: "🟢 Basse",
    medium: "🟡 Moyenne",
    high: "🔴 Haute",
    critical: "🔴🔴 Critique",
  };
  return labels[priority] || priority;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showMachineModal(machine, maintenances = [], files = []) {
  let modal = document.getElementById("machine-detail-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "machine-detail-modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  const pending = maintenances.filter((m) => m.status !== "completed");
  const completed = maintenances.filter((m) => m.status === "completed");

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 1200px;">
      <div class="modal-header">
        <h2>${escapeHtml(machine.nom)}</h2>
        <button class="modal-close" onclick="closeModalProperly()">×</button>
      </div>
      
      <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
        <button class="tab-btn active" onclick="switchTab('infos', this)">📋 Infos</button>
        <button class="tab-btn" onclick="switchTab('maintenance', this)">📅 Maintenances</button>
        <button class="tab-btn" onclick="switchTab('files', this)">📄 Documents</button>
      </div>

      <div id="tab-infos" class="tab-content">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h3>📋 Infos machine</h3>
            <p><strong>Nom:</strong> ${escapeHtml(machine.nom)}</p>
            <p><strong>Référence:</strong> ${machine.reference}</p>
            <p><strong>Quantité:</strong> ${machine.quantite}</p>
            <p><strong>Localisation:</strong> ${
              machine.localisation || "N/A"
            }</p>
            <p><strong>Prix:</strong> ${parseFloat(machine.prix || 0).toFixed(
              2
            )}€</p>
            <p><strong>Seuil:</strong> ${machine.seuil_alert}</p>
            <button class="btn-primary" onclick="openEditMachineModal(${
              machine.id
            })" style="margin-top:15px;">✏️ Modifier</button>
          </div>
          ${
            machine.glb_path
              ? `<div><h3>🎨 3D</h3><model-viewer src="${machine.glb_path}" auto-rotate camera-controls style="width:100%;height:300px;border-radius:8px;background:#000;"></model-viewer></div>`
              : `<div style="background:#f5f5f5;padding:20px;border-radius:8px;text-align:center;display:flex;align-items:center;justify-content:center;height:300px;"><p style="color:#999;">📦 Pas de modèle</p></div>`
          }
        </div>
      </div>

      <div id="tab-maintenance" class="tab-content" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
          <h3>📅 Maintenances (${pending.length})</h3>
          <button class="btn-primary" onclick="openAddMaintenanceModal(${
            machine.id
          })">➕ Ajouter</button>
        </div>
        ${
          pending.length === 0
            ? "<p style='text-align:center;color:#999;'>Aucune en attente</p>"
            : pending
                .map(
                  (m) => `
          <div style="background:#f5f5f5;padding:15px;margin-bottom:12px;border-radius:8px;border-left:5px solid ${getPriorityColor(
            m.priority
          )};">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
              <strong>${m.type === "preventive" ? "🛡️" : "🔧"}</strong>
              <span style="background:${getPriorityColor(
                m.priority
              )};color:white;padding:4px 10px;border-radius:12px;font-size:0.8em;">${getPriorityLabel(
                    m.priority
                  )}</span>
            </div>
            <p style="margin:5px 0;color:#333;">${m.description || "-"}</p>
            <p style="margin:5px 0;font-size:0.85em;color:#666;">📅 ${new Date(
              m.date_programmee
            ).toLocaleDateString("fr-FR")}</p>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button onclick="markMaintenanceAsDone(${m.id}, ${
                    machine.id
                  })" style="background:#10b981;color:white;padding:8px 15px;border:none;border-radius:6px;flex:1;cursor:pointer;">✓ Effectuée</button>
              <button onclick="deleteMaintenanceItem(${m.id}, ${
                    machine.id
                  })" style="background:#e94560;color:white;padding:8px 15px;border:none;border-radius:6px;cursor:pointer;">×</button>
            </div>
          </div>
        `
                )
                .join("")
        }
        ${
          completed.length > 0
            ? `<div style="border-top:1px solid #ddd;padding-top:20px;margin-top:20px;"><h3>✓ Historique (${
                completed.length
              })</h3>${completed
                .map(
                  (m) =>
                    `<div style="background:#f0fdf4;padding:12px;margin-bottom:10px;border-radius:8px;border-left:4px solid #10b981;"><strong style="color:#10b981;">✓</strong><p style="margin:5px 0;color:#555;">${
                      m.description || "-"
                    }</p></div>`
                )
                .join("")}</div>`
            : ""
        }
      </div>

      <div id="tab-files" class="tab-content" style="display:none;">
        <h3>📄 Documents</h3>
        <div style="border:2px dashed #ddd;padding:20px;border-radius:8px;text-align:center;margin-bottom:20px;cursor:pointer;" id="upload-area-${
          machine.id
        }">
          <p style="margin:0;color:#666;">📤 Glissez ou cliquez</p>
          <input type="file" id="pdf-input-${
            machine.id
          }" accept=".pdf" style="display:none;" onchange="uploadPDF(event, ${
    machine.id
  })" />
        </div>
        <div style="display:grid;gap:10px;">
          ${
            files.length === 0
              ? "<p style='text-align:center;color:#999;'>Aucun document</p>"
              : files
                  .map(
                    (file) => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:#f5f5f5;padding:12px 15px;border-radius:8px;">
              <div><p style="margin:0;color:#333;font-weight:600;">📄 ${
                file.filename
              }</p><p style="margin:5px 0;font-size:0.85em;color:#666;">${new Date(
                      file.uploaded_at
                    ).toLocaleDateString("fr-FR")}</p></div>
              <div style="display:flex;gap:8px;">
                <a href="${
                  file.path
                }" target="_blank" style="background:#0ea5e9;color:white;text-decoration:none;padding:8px 15px;border-radius:6px;cursor:pointer;">📥</a>
                <button onclick="deletePDF(${file.id}, ${
                      machine.id
                    })" style="background:#e94560;color:white;padding:8px 15px;border:none;border-radius:6px;cursor:pointer;">×</button>
              </div>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.style.zIndex = "9999";
  document.body.style.overflow = "hidden";

  const uploadArea = document.getElementById(`upload-area-${machine.id}`);
  const fileInput = document.getElementById(`pdf-input-${machine.id}`);
  if (uploadArea && fileInput) {
    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      fileInput.files = e.dataTransfer.files;
      uploadPDF({ target: { files: e.dataTransfer.files } }, machine.id);
    });
  }

  modal.onclick = (e) => {
    if (e.target === modal) closeModalProperly();
  };
}

function switchTab(tabName, btn) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => (tab.style.display = "none"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  const tabEl = document.getElementById(`tab-${tabName}`);
  if (tabEl) tabEl.style.display = "block";
  btn.classList.add("active");
}

async function openEditMachineModal(machineId) {
  const machine = allMachines.find((m) => m.id === machineId);
  if (!machine) return;
  let editModal = document.getElementById("edit-machine-modal");
  if (!editModal) {
    editModal = document.createElement("div");
    editModal.id = "edit-machine-modal";
    editModal.className = "modal";
    document.body.appendChild(editModal);
  }
  editModal.innerHTML = `
    <div class="modal-content" style="max-width:600px;">
      <div class="modal-header"><h2>✏️ Modifier</h2><button class="modal-close" onclick="document.getElementById('edit-machine-modal').style.display='none'">×</button></div>
      <form onsubmit="saveEditMachine(event, ${machineId})">
        <div class="form-group"><label>Nom</label><input type="text" id="edit-nom" value="${escapeHtml(
          machine.nom
        )}" required /></div>
        <div class="form-group"><label>Référence</label><input type="text" id="edit-reference" value="${
          machine.reference
        }" required /></div>
        <div class="form-group"><label>Quantité</label><input type="number" id="edit-quantite" value="${
          machine.quantite
        }" required /></div>
        <div class="form-group"><label>Localisation</label><input type="text" id="edit-localisation" value="${
          machine.localisation || ""
        }" /></div>
        <div class="form-group"><label>Prix</label><input type="number" id="edit-prix" value="${
          machine.prix || 0
        }" step="0.01" /></div>
        <div class="form-group"><label>Seuil</label><input type="number" id="edit-seuil" value="${
          machine.seuil_alert
        }" /></div>
        <div class="modal-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('edit-machine-modal').style.display='none'">Annuler</button><button type="submit" class="btn-primary">Enregistrer</button></div>
      </form>
    </div>
  `;
  editModal.style.display = "flex";
  editModal.onclick = (e) => {
    if (e.target === editModal) editModal.style.display = "none";
  };
}

async function saveEditMachine(e, machineId) {
  e.preventDefault();
  const data = {
    nom: document.getElementById("edit-nom").value,
    reference: document.getElementById("edit-reference").value,
    quantite: parseInt(document.getElementById("edit-quantite").value),
    localisation: document.getElementById("edit-localisation").value,
    prix: parseFloat(document.getElementById("edit-prix").value),
    seuil_alert: parseInt(document.getElementById("edit-seuil").value),
  };
  try {
    const response = await fetch(`${API}/machines/${machineId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (response.ok) {
      showNotification("✓ Modifiée", "success");
      document.getElementById("edit-machine-modal").style.display = "none";
      await loadMachines();
      await openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur", "error");
  }
}

async function uploadPDF(e, machineId) {
  const files = e.target.files;
  for (let file of files) {
    if (!file.name.endsWith(".pdf")) continue;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", file.name.replace(".pdf", ""));
    try {
      const response = await fetch(`${API}/machines/${machineId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (response.ok) {
        showNotification("✓ Document ajouté", "success");
        await openMachineDetails(machineId);
      }
    } catch (error) {
      showNotification("Erreur upload", "error");
    }
  }
}

async function deletePDF(fileId, machineId) {
  if (!confirm("Supprimer ?")) return;
  try {
    const response = await fetch(`${API}/machines/files/${fileId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ Supprimé", "success");
      await openMachineDetails(machineId);
    }
  } catch (error) {}
}

function closeModalProperly() {
  const modal = document.getElementById("machine-detail-modal");
  if (modal) modal.style.display = "none";
  const addForm = document.getElementById("add-maintenance-form");
  if (addForm) addForm.style.display = "none";
  document.body.style.overflow = "auto";
}

async function openAddMaintenanceModal(machineId) {
  let form = document.getElementById("add-maintenance-form");
  if (!form) {
    form = document.createElement("div");
    form.id = "add-maintenance-form";
    form.className = "modal";
    document.body.appendChild(form);
  }
  form.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header"><h2>➕ Maintenance</h2><button class="modal-close" onclick="document.getElementById('add-maintenance-form').style.display='none'">×</button></div>
      <form onsubmit="saveMaintenance(event, ${machineId})">
        <div class="form-group"><label>Type</label><select id="maint-type" required><option value="preventive">🛡️ Préventive</option><option value="corrective">🔧 Corrective</option></select></div>
        <div class="form-group"><label>Priorité</label><select id="maint-priority" required><option value="low">🟢 Basse</option><option value="medium" selected>🟡 Moyenne</option><option value="high">🔴 Haute</option><option value="critical">🔴🔴 Critique</option></select></div>
        <div class="form-group"><label>Date</label><input type="date" id="maint-date" required value="${
          new Date().toISOString().split("T")[0]
        }" /></div>
        <div class="form-group"><label>Description</label><textarea id="maint-description" rows="4" required></textarea></div>
        <div class="modal-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('add-maintenance-form').style.display='none'">Annuler</button><button type="submit" class="btn-primary">Créer</button></div>
      </form>
    </div>
  `;
  form.style.display = "flex";
  form.onclick = (e) => {
    if (e.target === form) form.style.display = "none";
  };
}

async function saveMaintenance(e, machineId) {
  e.preventDefault();
  const data = {
    type: document.getElementById("maint-type").value,
    priority: document.getElementById("maint-priority").value,
    description: document.getElementById("maint-description").value,
    date_programmee: document.getElementById("maint-date").value,
    status: "scheduled",
  };
  try {
    const response = await fetch(`${API}/machines/${machineId}/maintenances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (response.ok) {
      showNotification("✓ Maintenance créée", "success");
      document.getElementById("add-maintenance-form").style.display = "none";
      await openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur création", "error");
  }
}

async function markMaintenanceAsDone(maintenanceId, machineId) {
  try {
    const response = await fetch(`${API}/maintenances/${maintenanceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        status: "completed",
        date_realisee: new Date().toISOString().slice(0, 16),
      }),
    });
    if (response.ok) {
      showNotification("✓ Effectuée", "success");
      openMachineDetails(machineId);
    }
  } catch (error) {}
}

async function deleteMaintenanceItem(maintenanceId, machineId) {
  if (!confirm("Supprimer ?")) return;
  try {
    const response = await fetch(`${API}/maintenances/${maintenanceId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ Supprimée", "success");
      openMachineDetails(machineId);
    }
  } catch (error) {}
}

async function deleteMachine(id) {
  if (!confirm("Supprimer cette machine ?")) return;
  try {
    const response = await fetch(`${API}/machines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ Supprimée", "success");
      loadMachines();
    }
  } catch (error) {}
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();
  await loadMachines();
  const searchInput = document.getElementById("search-machines");
  if (searchInput)
    searchInput.addEventListener("input", (e) =>
      handleMachineSearch(e.target.value)
    );
  const sortSelect = document.getElementById("sort-machines");
  if (sortSelect)
    sortSelect.addEventListener("change", (e) => sortMachines(e.target.value));
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
        document.getElementById("localisation").value
      );
      formData.append("prix", document.getElementById("prix").value);
      formData.append(
        "seuil_alert",
        document.getElementById("seuil_alert").value
      );
      const glbFile = document.getElementById("glb_file").files[0];
      if (glbFile) formData.append("glb_file", glbFile);
      try {
        const response = await fetch(`${API}/machines`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (response.ok) {
          machineForm.reset();
          await loadMachines();
          showNotification("✓ Machine ajoutée", "success");
        }
      } catch (error) {
        showNotification("Erreur ajout", "error");
      }
    });
  }
});
