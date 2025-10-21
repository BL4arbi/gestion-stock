// machines.js - VERSION COMPLÈTE
const API = window.location.origin + "/api";
let allMachines = [];
let editingMachineId = null;

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();
  await loadMachines();

  /// DRAG & DROP
  /// DRAG & DROP
  const dropZone = document.getElementById("solidworks-drop-zone");
  const pathInput = document.getElementById("solidworks_link");

  if (dropZone) {
    // Empêcher le comportement par défaut
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false
      );
    });

    // Empêcher aussi sur document pour être sûr
    ["dragenter", "dragover"].forEach((eventName) => {
      document.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false
      );
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.style.background = "#dbeafe";
        dropZone.style.borderColor = "#0ea5e9";
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.style.background = "#f0f9ff";
        dropZone.style.borderColor = "#3b82f6";
      });
    });

    // ✅ NOUVEAU CODE ICI
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const items = e.dataTransfer.items;

      if (items && items.length > 0) {
        const item = items[0];

        // Si c'est un fichier
        if (item.kind === "file") {
          const file = item.getAsFile();

          // Essaye d'obtenir le chemin complet
          let filePath = "";

          // Méthode 1 : file.path (Electron/certains navigateurs)
          if (file.path) {
            filePath = file.path;
          }
          // Méthode 2 : Demande à l'utilisateur de coller le chemin
          else {
            filePath = prompt(
              `Le navigateur ne peut pas accéder au chemin complet.\n\n` +
                `Fichier détecté: ${file.name}\n\n` +
                `Veuillez coller le CHEMIN COMPLET du fichier :\n` +
                `(Shift + Clic droit sur le fichier > "Copier en tant que chemin")`,
              ""
            );

            if (!filePath) {
              showNotification("❌ Opération annulée", "error");
              return;
            }

            // Nettoie les guillemets si présents
            filePath = filePath.replace(/^"|"$/g, "");
          }

          pathInput.value = filePath;

          dropZone.innerHTML = `
        <div style="font-size:2em;">✅</div>
        <p style="font-weight:bold;color:#059669;">${file.name}</p>
        <p style="color:#666;font-size:0.85em;font-family:monospace;word-break:break-all;">${filePath}</p>
      `;

          console.log("Chemin capturé:", filePath);
          showNotification("✅ Fichier capturé: " + file.name, "success");
        }
      }
    });

    // Empêcher l'ouverture du fichier sur tout le document
    document.addEventListener(
      "drop",
      (e) => {
        if (e.target !== dropZone && !dropZone.contains(e.target)) {
          e.preventDefault();
        }
      },
      false
    );

    document.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
      },
      false
    );
  }

  // ============================================
  // FORMULAIRE
  // ============================================
  const form = document.getElementById("machine-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nom = document.getElementById("nom").value;
      const reference = document.getElementById("reference").value;
      const quantite = document.getElementById("quantite").value;
      const localisation = document.getElementById("localisation").value || "";
      const prix = document.getElementById("prix").value || "0";
      const seuil_alert = document.getElementById("seuil_alert").value || "5";
      const solidworks_link =
        document.getElementById("solidworks_link").value || "";

      if (!nom || !reference || !quantite) {
        showNotification("❌ Remplissez les champs obligatoires", "error");
        return;
      }

      const formData = new FormData();
      formData.append("nom", nom);
      formData.append("reference", reference);
      formData.append("quantite", quantite);
      formData.append("localisation", localisation);
      formData.append("prix", prix);
      formData.append("seuil_alert", seuil_alert);
      formData.append("solidworks_link", solidworks_link);

      const glbFile = document.getElementById("glb_file");
      if (glbFile && glbFile.files[0]) {
        formData.append("glb_file", glbFile.files[0]);
      }

      try {
        let response;
        if (editingMachineId) {
          response = await fetch(`${API}/machines/${editingMachineId}`, {
            method: "PUT",
            credentials: "include",
            body: formData,
          });
        } else {
          response = await fetch(`${API}/machines`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
        }

        if (response.ok) {
          showNotification(
            editingMachineId ? "✅ Modifié" : "✅ Ajouté",
            "success"
          );
          form.reset();
          resetDropZone();
          cancelEdit();
          await loadMachines();
        } else {
          const error = await response.json();
          showNotification(`❌ ${error.error}`, "error");
        }
      } catch (error) {
        showNotification("❌ Erreur connexion", "error");
      }
    });
  }

  // RECHERCHE
  const searchInput = document.getElementById("search-machines");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const text = e.target.value.toLowerCase();
      const filtered = allMachines.filter(
        (m) =>
          m.nom.toLowerCase().includes(text) ||
          m.reference.toLowerCase().includes(text)
      );
      renderMachines(filtered);
    });
  }

  // TRI
  const sortSelect = document.getElementById("sort-machines");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      let sorted = [...allMachines];
      if (e.target.value === "nom") {
        sorted.sort((a, b) => a.nom.localeCompare(b.nom));
      } else if (e.target.value === "reference") {
        sorted.sort((a, b) => a.reference.localeCompare(b.reference));
      }
      renderMachines(sorted);
    });
  }
});

function resetDropZone() {
  const dropZone = document.getElementById("solidworks-drop-zone");
  if (dropZone) {
    dropZone.innerHTML = `
      <div style="font-size:3em;">📐</div>
      <p style="font-weight:bold;margin:10px 0;">Glissez le fichier SolidWorks ici</p>
      <p style="color:#666;font-size:0.9em;">Le chemin sera capturé automatiquement</p>
    `;
  }
  const pathInput = document.getElementById("solidworks_link");
  if (pathInput) pathInput.value = "";
}

// ============================================
// CHARGER MACHINES
// ============================================
async function loadMachines() {
  try {
    const response = await fetch(`${API}/machines`, { credentials: "include" });
    if (!response.ok) throw new Error("Erreur");
    allMachines = await response.json();
    renderMachines(allMachines);
    document.getElementById("total-machines").textContent = allMachines.length;
  } catch (error) {
    showNotification("❌ Erreur chargement", "error");
  }
}

// ============================================
// AFFICHER MACHINES
// ============================================
function renderMachines(machines) {
  const container = document.getElementById("machines-list");
  if (!machines || machines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <h3>Aucune machine</h3>
      </div>
    `;
    return;
  }

  const perms = window.userPermissions || {};

  container.innerHTML = machines
    .map(
      (m) => `
      <div class="product-card">
        <div class="product-header">
          <h3 class="product-name">${escapeHtml(m.nom)}</h3>
          <span class="product-quantity">${m.quantite}</span>
        </div>

        ${
          m.glb_path
            ? `
        <div style="background:#000;border-radius:8px;overflow:hidden;margin:15px 0;aspect-ratio:1;">
          <model-viewer 
            src="${m.glb_path}" 
            auto-rotate 
            camera-controls 
            style="width:100%;height:100%;background:#000;">
          </model-viewer>
        </div>
        `
            : ""
        }

        <div class="product-info"><strong>🏷️</strong> ${escapeHtml(
          m.reference
        )}</div>
        <div class="product-info"><strong>📍</strong> ${escapeHtml(
          m.localisation || "N/A"
        )}</div>
        <div class="product-info"><strong>💰</strong> ${parseFloat(
          m.prix || 0
        ).toFixed(2)}€</div>
        
        ${
          m.solidworks_link
            ? `
        <div style="margin:10px 0;padding:10px;background:#dbeafe;border-radius:6px;">
          <strong>📐 SolidWorks:</strong>
          <p style="font-size:0.85em;color:#666;margin:5px 0;word-break:break-all;">${escapeHtml(
            m.solidworks_link
          )}</p>
          <button class="btn-small" style="background:#3b82f6;width:100%;" onclick="openSolidWorksFile('${m.solidworks_link.replace(
            /\\/g,
            "\\\\"
          )}')">
            🔧 Ouvrir
          </button>
        </div>
        `
            : ""
        }

        <div class="product-actions">
          <button class="btn-small" style="background:#3b82f6;" onclick="openMachineDetails(${
            m.id
          })">👁️ Détails</button>
          ${
            perms.canEdit
              ? `<button class="btn-small btn-edit" onclick="editMachine(${m.id})">✏️</button>`
              : ""
          }
          ${
            perms.canDelete
              ? `<button class="btn-small btn-delete" onclick="deleteMachine(${m.id})">🗑️</button>`
              : ""
          }
        </div>
      </div>
    `
    )
    .join("");
}

// ============================================
// MODIFIER MACHINE
// ============================================
async function editMachine(id) {
  const machine = allMachines.find((m) => m.id === id);
  if (!machine) return;

  editingMachineId = id;

  document.getElementById("nom").value = machine.nom;
  document.getElementById("reference").value = machine.reference;
  document.getElementById("quantite").value = machine.quantite;
  document.getElementById("localisation").value = machine.localisation || "";
  document.getElementById("prix").value = machine.prix || 0;
  document.getElementById("seuil_alert").value = machine.seuil_alert || 5;
  document.getElementById("solidworks_link").value =
    machine.solidworks_link || "";

  const form = document.getElementById("machine-form");
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
  showNotification("✏️ Mode modification", "info");
}

function cancelEdit() {
  editingMachineId = null;
  const form = document.getElementById("machine-form");
  form.reset();
  resetDropZone();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = "➕ Ajouter";
  submitBtn.style.background = "";

  const cancelBtn = document.getElementById("cancel-edit-btn");
  if (cancelBtn) cancelBtn.remove();
}

// ============================================
// SUPPRIMER MACHINE
// ============================================
async function deleteMachine(id) {
  const machine = allMachines.find((m) => m.id === id);
  if (!confirm(`⚠️ SUPPRIMER ${machine.nom} ?`)) return;

  try {
    const response = await fetch(`${API}/machines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      showNotification("✅ Supprimé", "success");
      await loadMachines();
    } else {
      showNotification("❌ Erreur", "error");
    }
  } catch (error) {
    showNotification("❌ Erreur connexion", "error");
  }
}

// ============================================
// DÉTAILS MACHINE (MODAL)
// ============================================
async function openMachineDetails(id) {
  const machine = allMachines.find((m) => m.id === id);
  if (!machine) return;

  let maintenances = [];
  let files = [];

  try {
    const mRes = await fetch(`${API}/machines/${id}/maintenances`, {
      credentials: "include",
    });
    if (mRes.ok) maintenances = await mRes.json();

    const fRes = await fetch(`${API}/machines/${id}/files`, {
      credentials: "include",
    });
    if (fRes.ok) files = await fRes.json();
  } catch (error) {
    console.error("Erreur:", error);
  }

  let modal = document.getElementById("machine-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "machine-modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width:900px;">
      <div class="modal-header">
        <h2>🤖 ${escapeHtml(machine.nom)}</h2>
        <button class="modal-close" onclick="document.getElementById('machine-modal').style.display='none'">×</button>
      </div>

      <div class="modal-body">
        <!-- INFOS -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-bottom:25px;">
          <div><strong>🏷️ Référence:</strong> ${escapeHtml(
            machine.reference
          )}</div>
          <div><strong>📦 Quantité:</strong> ${machine.quantite}</div>
          <div><strong>📍 Localisation:</strong> ${escapeHtml(
            machine.localisation || "N/A"
          )}</div>
          <div><strong>💰 Prix:</strong> ${parseFloat(
            machine.prix || 0
          ).toFixed(2)}€</div>
          <div><strong>⚠️ Seuil:</strong> ${machine.seuil_alert || 5}</div>
          <div><strong>📅 Créée:</strong> ${new Date(
            machine.created_at
          ).toLocaleDateString("fr-FR")}</div>
        </div>

        <!-- SOLIDWORKS -->
        ${
          machine.solidworks_link
            ? `
        <div style="margin-bottom:25px;padding:15px;background:#dbeafe;border-left:4px solid #0ea5e9;border-radius:8px;">
          <h3 style="margin:0 0 10px 0;">📐 SolidWorks</h3>
          <p style="color:#666;font-size:0.85em;font-family:monospace;word-break:break-all;">${escapeHtml(
            machine.solidworks_link
          )}</p>
          <button class="btn-primary" style="margin-top:10px;" onclick="openSolidWorksFile('${machine.solidworks_link.replace(
            /\\/g,
            "\\\\"
          )}')">🔧 Ouvrir</button>
        </div>
        `
            : ""
        }

        <!-- 3D -->
        ${
          machine.glb_path
            ? `
        <div style="margin-bottom:25px;">
          <h3>🎨 Aperçu 3D</h3>
          <div style="background:#000;border-radius:8px;overflow:hidden;aspect-ratio:16/9;">
            <model-viewer src="${machine.glb_path}" auto-rotate camera-controls style="width:100%;height:100%;background:#000;"></model-viewer>
          </div>
        </div>
        `
            : ""
        }

        <!-- MAINTENANCES -->
        <div style="margin-bottom:25px;">
          <h3>🔧 Maintenances</h3>
          ${
            maintenances.length > 0
              ? maintenances
                  .map(
                    (m) => `
            <div style="padding:10px;background:#f9fafb;border-left:3px solid ${
              m.status === "completed" ? "#10b981" : "#f59e0b"
            };margin-bottom:10px;border-radius:4px;">
              <div style="display:flex;justify-content:space-between;">
                <strong>${m.type}</strong>
                <span style="color:#666;font-size:0.9em;">${new Date(
                  m.date_programmee
                ).toLocaleDateString("fr-FR")}</span>
              </div>
              ${
                m.description
                  ? `<p style="margin:5px 0;color:#666;">${m.description}</p>`
                  : ""
              }
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#666;">Aucune maintenance</p>'
          }
        </div>

        <!-- FICHIERS -->
        <div>
          <h3>📄 Fichiers</h3>
          ${
            files.length > 0
              ? files
                  .map(
                    (f) => `
            <div style="display:flex;justify-content:space-between;padding:10px;background:#f9fafb;margin-bottom:10px;border-radius:4px;">
              <div>
                <strong>${escapeHtml(f.filename)}</strong>
                <p style="margin:5px 0;color:#666;font-size:0.85em;">${new Date(
                  f.uploaded_at
                ).toLocaleDateString("fr-FR")}</p>
              </div>
              <a href="${
                f.path
              }" target="_blank" class="btn-small" style="background:#3b82f6;">📥</a>
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#666;">Aucun fichier</p>'
          }
        </div>
      </div>

      <div style="margin-top:20px;text-align:right;">
        <button class="btn-secondary" onclick="document.getElementById('machine-modal').style.display='none'">Fermer</button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

// ============================================
// OUVRIR SOLIDWORKS
// ============================================
async function openSolidWorksFile(filePath) {
  if (!window.SW_AGENT) {
    showNotification("❌ Agent local non chargé", "error");
    return;
  }

  try {
    showNotification("🔄 Ouverture...", "info");
    const result = await window.SW_AGENT.openFile(filePath);
    if (result.ok) {
      showNotification("✅ Fichier ouvert!", "success");
    }
  } catch (error) {
    showNotification(`❌ ${error.message}`, "error");
  }
}

// ============================================
// UTILS
// ============================================
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
