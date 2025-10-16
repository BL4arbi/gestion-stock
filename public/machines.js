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
        <h3>Aucune machine enregistrée</h3>
        <p>Commencez par ajouter une machine au parc industriel</p>
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
              : `<div style="background:#003366;display:flex;align-items:center;justify-content:center;color:white;width:100%;height:100%;font-size:3em;">🤖</div>`
          }
        </div>
        
        <div class="machine-footer">
          <div class="machine-title">${escapeHtml(machine.nom)}</div>
          <div class="machine-actions-bottom">
            <button class="btn-compact" onclick="openMachineDetails(${
              machine.id
            })" title="Détails">📋 Voir</button>
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
    high: "#FF6B35",
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
      <img src="/assets/logo-tacquet.png" class="modal-watermark" alt="Tacquet Industries" />
      
      <div class="modal-header">
        <h2>${escapeHtml(machine.nom)}</h2>
        <button class="modal-close" onclick="closeModalProperly()">×</button>
      </div>
      
      <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #F5F5F5; padding-bottom: 10px;">
        <button class="tab-btn active" onclick="switchTab('infos', this)">📋 Informations</button>
        <button class="tab-btn" onclick="switchTab('maintenance', this)">🔧 Maintenances</button>
        <button class="tab-btn" onclick="switchTab('files', this)">📄 Documentation</button>
      </div>

      <div id="tab-infos" class="tab-content">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
          <div>
            <h3>📋 Fiche technique</h3>
            <p style="margin:10px 0;"><strong>Nom :</strong> ${escapeHtml(
              machine.nom
            )}</p>
            <p style="margin:10px 0;"><strong>Référence :</strong> ${
              machine.reference
            }</p>
            <p style="margin:10px 0;"><strong>Quantité :</strong> ${
              machine.quantite
            } unité(s)</p>
            <p style="margin:10px 0;"><strong>Localisation :</strong> ${
              machine.localisation || "Non définie"
            }</p>
            <p style="margin:10px 0;"><strong>Valeur d'achat :</strong> ${parseFloat(
              machine.prix || 0
            ).toFixed(2)}€</p>
            <p style="margin:10px 0;"><strong>Seuil d'alerte :</strong> ${
              machine.seuil_alert
            }</p>
            <button class="btn-primary" onclick="openEditMachineModal(${
              machine.id
            })" style="margin-top:20px;">✏️ Modifier la fiche</button>
          </div>
          ${
            machine.glb_path
              ? `<div><h3>🎨 Modèle 3D</h3><model-viewer src="${machine.glb_path}" auto-rotate camera-controls style="width:100%;height:350px;border-radius:4px;background:#000;border:2px solid #E0E0E0;"></model-viewer></div>`
              : `<div style="background:#F5F5F5;padding:40px;border-radius:4px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:350px;border:2px dashed #ccc;"><div style="font-size:4em;margin-bottom:15px;opacity:0.3;">🤖</div><p style="color:#999;font-weight:600;">Aucun modèle 3D disponible</p></div>`
          }
        </div>
      </div>

      <div id="tab-maintenance" class="tab-content" style="display:none;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3>🔧 Planning de maintenance (${pending.length} en attente)</h3>
          <button class="btn-primary" onclick="openAddMaintenanceModal(${
            machine.id
          })">➕ Planifier</button>
        </div>
        ${
          pending.length === 0
            ? "<div style='text-align:center;padding:40px;background:#F5F5F5;border-radius:4px;'><p style='color:#999;font-size:1.1em;'>✅ Aucune maintenance en attente</p></div>"
            : pending
                .map(
                  (m) => `
          <div style="background:white;padding:20px;margin-bottom:15px;border-radius:4px;border-left:5px solid ${getPriorityColor(
            m.priority
          )};box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
              <strong style="font-size:1.3em;">${
                m.type === "preventive" ? "🛡️" : "🔧"
              }</strong>
              <span style="background:${getPriorityColor(
                m.priority
              )};color:white;padding:6px 14px;border-radius:4px;font-size:0.85em;font-weight:700;text-transform:uppercase;">${getPriorityLabel(
                    m.priority
                  )}</span>
              <span style="color:#666;margin-left:auto;">📅 ${new Date(
                m.date_programmee
              ).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}</span>
            </div>
            <p style="margin:12px 0;color:#333;font-size:1.05em;line-height:1.6;">${
              m.description || "-"
            }</p>
            <div style="display:flex;gap:10px;margin-top:15px;">
              <button onclick="markMaintenanceAsDone(${m.id}, ${
                    machine.id
                  })" style="background:#10b981;color:white;padding:10px 20px;border:none;border-radius:4px;flex:1;cursor:pointer;font-weight:700;text-transform:uppercase;">✓ Marquer effectuée</button>
              <button onclick="deleteMaintenanceItem(${m.id}, ${
                    machine.id
                  })" style="background:#FF6B35;color:white;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-weight:700;">🗑️</button>
            </div>
          </div>
        `
                )
                .join("")
        }
        ${
          completed.length > 0
            ? `<div style="border-top:2px solid #F5F5F5;padding-top:30px;margin-top:30px;"><h3 style="margin-bottom:15px;">✅ Historique des maintenances (${
                completed.length
              })</h3>${completed
                .map(
                  (m) =>
                    `<div style="background:#F0FDF4;padding:15px;margin-bottom:12px;border-radius:4px;border-left:4px solid #10b981;"><div style="display:flex;align-items:center;gap:10px;"><strong style="color:#10b981;font-size:1.2em;">✓</strong><p style="margin:0;color:#666;flex:1;">${
                      m.description || "-"
                    }</p><span style="color:#999;font-size:0.85em;">${new Date(
                      m.date_realisee || m.date_programmee
                    ).toLocaleDateString("fr-FR")}</span></div></div>`
                )
                .join("")}</div>`
            : ""
        }
      </div>

      <div id="tab-files" class="tab-content" style="display:none;">
        <h3>📄 Documents techniques</h3>
        <div style="border:2px dashed #E0E0E0;padding:30px;border-radius:4px;text-align:center;margin:20px 0;cursor:pointer;background:#FAFAFA;transition:all 0.3s;" id="upload-area-${
          machine.id
        }" onmouseover="this.style.background='#F5F5F5';this.style.borderColor='#003366';" onmouseout="this.style.background='#FAFAFA';this.style.borderColor='#E0E0E0';">
          <div style="font-size:3em;margin-bottom:10px;">📤</div>
          <p style="margin:0;color:#666;font-weight:600;font-size:1.05em;">Glissez un document PDF ici</p>
          <p style="margin:5px 0 0 0;color:#999;font-size:0.9em;">ou cliquez pour sélectionner</p>
          <input type="file" id="pdf-input-${
            machine.id
          }" accept=".pdf" style="display:none;" onchange="uploadPDF(event, ${
    machine.id
  })" />
        </div>
        <div style="display:grid;gap:12px;">
          ${
            files.length === 0
              ? "<div style='text-align:center;padding:40px;background:#F5F5F5;border-radius:4px;'><p style='color:#999;font-size:1.1em;'>📂 Aucun document disponible</p></div>"
              : files
                  .map(
                    (file) => `
            <div style="display:flex;justify-content:space-between;align-items:center;background:white;padding:18px 20px;border-radius:4px;border-left:4px solid #003366;box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:all 0.3s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 15px rgba(0,51,102,0.15)';" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';">
              <div style="flex:1;">
                <p style="margin:0 0 5px 0;color:#003366;font-weight:700;font-size:1.05em;">📄 ${
                  file.filename
                }</p>
                <p style="margin:0;font-size:0.85em;color:#999;">Ajouté le ${new Date(
                  file.uploaded_at
                ).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}</p>
              </div>
              <div style="display:flex;gap:10px;">
                <a href="${
                  file.path
                }" target="_blank" style="background:#003366;color:white;text-decoration:none;padding:10px 18px;border-radius:4px;cursor:pointer;font-weight:700;transition:all 0.3s;" onmouseover="this.style.background='#002244';" onmouseout="this.style.background='#003366';">📥 Ouvrir</a>
                <button onclick="deletePDF(${file.id}, ${
                      machine.id
                    })" style="background:#FF6B35;color:white;padding:10px 18px;border:none;border-radius:4px;cursor:pointer;font-weight:700;transition:all 0.3s;" onmouseover="this.style.background='#E55A2B';" onmouseout="this.style.background='#FF6B35';">🗑️</button>
              </div>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>

      <div style="margin-top:30px;padding-top:20px;border-top:2px solid #F5F5F5;text-align:center;color:#666;font-size:0.85em;">
        <p style="margin:0;">© 2025 <strong style="color:#003366;">Tacquet Industries</strong> - Fiche machine</p>
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
    uploadArea.addEventListener("dragover", (e) => e.preventDefault());
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
    <div class="modal-content" style="max-width:700px;">
      <div class="modal-header"><h2>✏️ Modifier la fiche machine</h2><button class="modal-close" onclick="document.getElementById('edit-machine-modal').style.display='none'">×</button></div>
      <form onsubmit="saveEditMachine(event, ${machineId})">
        <div class="form-group"><label>Nom de la machine</label><input type="text" id="edit-nom" value="${escapeHtml(
          machine.nom
        )}" required /></div>
        <div class="form-group"><label>Référence constructeur</label><input type="text" id="edit-reference" value="${
          machine.reference
        }" required /></div>
        <div class="form-group"><label>Quantité</label><input type="number" id="edit-quantite" value="${
          machine.quantite
        }" required /></div>
        <div class="form-group"><label>Localisation</label><input type="text" id="edit-localisation" value="${
          machine.localisation || ""
        }" /></div>
        <div class="form-group"><label>Valeur d'achat (€)</label><input type="number" id="edit-prix" value="${
          machine.prix || 0
        }" step="0.01" /></div>
        <div class="form-group"><label>Seuil d'alerte stock</label><input type="number" id="edit-seuil" value="${
          machine.seuil_alert
        }" /></div>
        <div class="modal-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('edit-machine-modal').style.display='none'">Annuler</button><button type="submit" class="btn-primary">💾 Enregistrer</button></div>
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
      showNotification("✓ Machine modifiée avec succès", "success");
      document.getElementById("edit-machine-modal").style.display = "none";
      await loadMachines();
      await openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur lors de la modification", "error");
  }
}

async function uploadPDF(e, machineId) {
  const files = e.target.files;
  for (let file of files) {
    if (!file.name.endsWith(".pdf")) {
      showNotification("⚠️ Seuls les fichiers PDF sont acceptés", "error");
      continue;
    }
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
        showNotification("✓ Document ajouté avec succès", "success");
        await openMachineDetails(machineId);
      }
    } catch (error) {
      showNotification("Erreur lors de l'ajout du document", "error");
    }
  }
}

async function deletePDF(fileId, machineId) {
  if (!confirm("Supprimer définitivement ce document ?")) return;
  try {
    const response = await fetch(`${API}/machines/files/${fileId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ Document supprimé", "success");
      await openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur lors de la suppression", "error");
  }
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
    <div class="modal-content" style="max-width:600px;">
      <div class="modal-header"><h2>➕ Planifier une maintenance</h2><button class="modal-close" onclick="document.getElementById('add-maintenance-form').style.display='none'">×</button></div>
      <form onsubmit="saveMaintenance(event, ${machineId})">
        <div class="form-group"><label>Type d'intervention</label><select id="maint-type" required><option value="preventive">🛡️ Maintenance préventive</option><option value="corrective">🔧 Maintenance corrective</option></select></div>
        <div class="form-group"><label>Niveau de priorité</label><select id="maint-priority" required><option value="low">🟢 Basse</option><option value="medium" selected>🟡 Moyenne</option><option value="high">🔴 Haute</option><option value="critical">🔴🔴 Critique</option></select></div>
        <div class="form-group"><label>Date programmée</label><input type="date" id="maint-date" required value="${
          new Date().toISOString().split("T")[0]
        }" /></div>
        <div class="form-group"><label>Description de l'intervention</label><textarea id="maint-description" rows="4" placeholder="Détaillez les opérations à effectuer..." required></textarea></div>
        <div class="modal-actions"><button type="button" class="btn-secondary" onclick="document.getElementById('add-maintenance-form').style.display='none'">Annuler</button><button type="submit" class="btn-primary">📅 Planifier</button></div>
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
      showNotification("✓ Maintenance planifiée avec succès", "success");
      document.getElementById("add-maintenance-form").style.display = "none";
      await openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur lors de la planification", "error");
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
      showNotification("✓ Maintenance marquée comme effectuée", "success");
      openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur lors de la mise à jour", "error");
  }
}

async function deleteMaintenanceItem(maintenanceId, machineId) {
  if (!confirm("Supprimer cette maintenance du planning ?")) return;
  try {
    const response = await fetch(`${API}/maintenances/${maintenanceId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ Maintenance supprimée", "success");
      openMachineDetails(machineId);
    }
  } catch (error) {
    showNotification("Erreur lors de la suppression", "error");
  }
}

async function deleteMachine(id) {
  if (
    !confirm("⚠️ Supprimer définitivement cette machine du parc industriel ?")
  )
    return;
  try {
    const response = await fetch(`${API}/machines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showNotification("✓ Machine supprimée avec succès", "success");
      loadMachines();
    }
  } catch (error) {
    showNotification("Erreur lors de la suppression", "error");
  }
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
          showNotification("✓ Machine ajoutée avec succès", "success");
        }
      } catch (error) {
        showNotification("Erreur lors de l'ajout", "error");
      }
    });
  }
});
