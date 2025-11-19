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

      // ✅ AJOUTER
      const dimensions = document.getElementById("dimensions").value || "";
      const poids = document.getElementById("poids").value || "0";

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

      // ✅ AJOUTER
      formData.append("dimensions", dimensions);
      formData.append("poids", poids);

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

  // ✅ AJOUTER
  document.getElementById("dimensions").value = machine.dimensions || "";
  document.getElementById("poids").value = machine.poids || 0;

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

  // Rendu modal avec formulaire maintenance
  modal.innerHTML = `
    <div class="modal-content" style="max-width:900px;">
      <div class="modal-header">
        <h2>🤖 ${escapeHtml(machine.nom)}</h2>
        <button class="modal-close" onclick="document.getElementById('machine-modal').style.display='none'">×</button>
      </div>

      <div class="modal-body">
        <!-- Infos principales -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-bottom:20px;">
          <div><strong>🏷️ Référence:</strong> ${escapeHtml(
            machine.reference
          )}</div>
          <div><strong>📍 Localisation:</strong> ${escapeHtml(
            machine.localisation || "N/A"
          )}</div>
          <div><strong>📦 Quantité:</strong> ${machine.quantite}</div>
          <div><strong>⚠️ Seuil:</strong> ${machine.seuil_alert || 5}</div>
          <div><strong>💰 Prix:</strong> ${parseFloat(
            machine.prix || 0
          ).toFixed(2)}€</div>
          ${
            machine.dimensions
              ? `<div><strong>📏 Dimensions:</strong> ${escapeHtml(
                  machine.dimensions
                )}</div>`
              : ""
          }
          ${
            machine.poids
              ? `<div><strong>⚖️ Poids:</strong> ${parseFloat(
                  machine.poids
                ).toFixed(2)} kg</div>`
              : ""
          }
        </div>

        ${
          machine.solidworks_link
            ? `
          <div style="margin-bottom:20px;padding:12px;background:#dbeafe;border-left:4px solid #0ea5e9;border-radius:8px;">
            <h3 style="margin:0 0 8px 0;">📐 SolidWorks</h3>
            <p style="color:#666;font-size:0.85em;font-family:monospace;word-break:break-all;">${escapeHtml(
              machine.solidworks_link
            )}</p>
            <button id="open-sw-btn" class="btn-primary" style="margin-top:8px;">🔧 Ouvrir</button>
          </div>`
            : ""
        }

        ${
          machine.glb_path
            ? `
          <div style="margin-bottom:20px;">
            <h3>🎨 Aperçu 3D</h3>
            <div style="background:#000;border-radius:8px;overflow:hidden;aspect-ratio:16/9;">
              <model-viewer src="${machine.glb_path}" auto-rotate camera-controls style="width:100%;height:100%;background:#000;"></model-viewer>
            </div>
          </div>`
            : ""
        }

        <div style="margin-bottom:20px;">
          <h3>🔧 Maintenances</h3>

          <form id="maint-form" class="form-row" style="margin:10px 0;">
            <input id="maint-title" placeholder="Titre *" required />
            <input id="maint-date" type="date" required />
            <select id="maint-status">
              <option value="planifie">Planifié</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
            </select>
            <input id="maint-desc" placeholder="Description" />
            <button class="btn btn-primary" type="submit">Ajouter</button>
          </form>

          <div id="maint-list">
            ${
              maintenances.length
                ? maintenances
                    .map(
                      (m) => `
              <div class="maint-item" data-id="${m.id}">
                <div class="maint-left">
                  <div><strong>${escapeHtml(
                    m.titre || m.type || "Maintenance"
                  )}</strong> ${tagFromStatus(m.statut)}</div>
                  <div class="widget-item-subtitle">${new Date(
                    m.date_maintenance || Date.now()
                  ).toLocaleDateString("fr-FR")} — ${escapeHtml(
                        m.description || ""
                      )}</div>
                </div>
                <div class="maint-actions">
                  <button class="btn btn-sm btn-secondary" data-action="edit">✏️</button>
                  <button class="btn btn-sm btn-danger" data-action="del">🗑️</button>
                </div>
              </div>
            `
                    )
                    .join("")
                : `<div class="empty-state">Aucune maintenance</div>`
            }
          </div>
        </div>

        <div>
          <h3>📄 Fichiers</h3>
          ${
            (files || []).length
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
              : `<div class="empty-state">Aucun fichier</div>`
          }
        </div>
      </div>

      <div style="margin-top:16px;text-align:right;">
        <button class="btn-secondary" onclick="document.getElementById('machine-modal').style.display='none'">Fermer</button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  // SW Agent: conserve l'appel existant, accepte SW_AGENT (ancien) ou SWAgent (nouveau)
  const swBtn = document.getElementById("open-sw-btn");
  if (swBtn) {
    if (machine.solidworks_link) {
      swBtn.onclick = () => openSolidWorks(machine.solidworks_link);
    } else {
      swBtn.disabled = true;
      swBtn.title = "Lien SolidWorks manquant";
    }
  }

  // Handlers maintenance
  const form = document.getElementById("maint-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      titre: document.getElementById("maint-title").value.trim(),
      date_maintenance: document.getElementById("maint-date").value,
      statut: document.getElementById("maint-status").value,
      description: document.getElementById("maint-desc").value.trim(),
    };
    if (!payload.titre || !payload.date_maintenance) {
      showNotification("Titre et date requis", "error");
      return;
    }
    try {
      const r = await fetch(`${API}/machines/${id}/maintenances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Ajout impossible");
      showNotification("Maintenance ajoutée", "success");
      openMachineDetails(id); // reload section
    } catch (err) {
      showNotification("❌ " + err.message, "error");
    }
  });

  document
    .getElementById("maint-list")
    ?.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      const row = ev.target.closest(".maint-item");
      const mid = row?.dataset.id;
      if (!mid) return;

      if (btn.dataset.action === "del") {
        if (!confirm("Supprimer cette maintenance ?")) return;
        try {
          const r = await fetch(`${API}/machines/${id}/maintenances/${mid}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!r.ok) throw new Error("Suppression impossible");
          showNotification("Supprimé", "success");
          openMachineDetails(id);
        } catch (err) {
          showNotification("❌ " + err.message, "error");
        }
      }

      if (btn.dataset.action === "edit") {
        const newTitle = prompt("Nouveau titre ?");
        if (newTitle === null) return;
        try {
          const r = await fetch(`${API}/machines/${id}/maintenances/${mid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ titre: newTitle }),
          });
          if (!r.ok) throw new Error("Modification impossible");
          showNotification("Modifié", "success");
          openMachineDetails(id);
        } catch (err) {
          showNotification("❌ " + err.message, "error");
        }
      }
    });
}

function tagFromStatus(st) {
  if (st === "termine") return `<span class="tag ok">Terminé</span>`;
  if (st === "en_cours") return `<span class="tag warn">En cours</span>`;
  return `<span class="tag todo">Planifié</span>`;
}

// SolidWorks: compat SW_AGENT (ancien) et SWAgent (nouveau)
async function openSolidWorksFile(filePath) {
  try {
    if (window.SW_AGENT?.openFile) {
      const r = await window.SW_AGENT.openFile(filePath);
      if (r?.ok !== false) showNotification("✅ Ouvert", "success");
      else throw new Error("Échec ouverture");
    } else if (window.SWAgent?.open) {
      await window.SWAgent.open(filePath);
      showNotification("✅ Ouvert", "success");
    } else {
      throw new Error("Agent non disponible");
    }
  } catch (err) {
    showNotification("❌ " + err.message, "error");
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

function displayMachines(machines) {
  const container = document.getElementById("machines-list");

  if (!machines || machines.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Aucune machine disponible</div>';
    return;
  }

  container.innerHTML = machines
    .map(
      (machine) => `
      <div class="product-card">
        <div class="product-header">
          <h3>${machine.nom}</h3>
          <span class="product-ref">Réf: ${machine.reference || "N/A"}</span>
        </div>
        <div class="product-info">
          <p><strong>Localisation:</strong> ${
            machine.localisation || "Non défini"
          }</p>
          <p><strong>Type:</strong> ${machine.type || "Non défini"}</p>
        </div>
        ${
          machine.glb_file
            ? `
          <model-viewer
            src="/uploads/${machine.glb_file}"
            camera-controls
            auto-rotate
            style="width: 100%; height: 200px;"
          ></model-viewer>
        `
            : '<div class="no-model">📦 Pas de modèle 3D</div>'
        }
        <div class="product-actions">
          ${
            machine.solidworks_link
              ? `
            <button onclick="openSolidWorks('${machine.solidworks_link}')" class="btn-secondary">
              📐 SolidWorks
            </button>
          `
              : ""
          }
          
          <!-- ✅ MODIFIER LE BOUTON DÉTAILS -->
          <button onclick="viewMachineDetails(${
            machine.id
          }, '${machine.nom.replace(/'/g, "\\'")}', '${(
        machine.reference || "N/A"
      ).replace(/'/g, "\\'")}', '${(machine.localisation || "N/A").replace(
        /'/g,
        "\\'"
      )}'); openMachineModal(${machine.id})" class="btn-primary">
            👁️ Détails
          </button>
          
          ${
            canEdit()
              ? `
            <button onclick="editMachine(${machine.id})" class="btn-edit">✏️ Modifier</button>
            <button onclick="deleteMachine(${machine.id})" class="btn-delete">🗑️ Supprimer</button>
          `
              : ""
          }
        </div>
      </div>
    `
    )
    .join("");
}

// ✅ AJOUTER CETTE FONCTION
function viewMachineDetails(id, nom, reference, localisation) {
  // Sauvegarder dans localStorage
  localStorage.setItem(
    "lastViewedMachine",
    JSON.stringify({
      id: id,
      nom: nom,
      reference: reference,
      localisation: localisation,
      timestamp: Date.now(),
    })
  );

  console.log("Machine consultée:", nom);
}

function updateAgentBadge() {
  const b = document.getElementById("sw-agent-status");
  if (!b || !window.SWAgent) return;
  if (window.SWAgent.online) {
    b.textContent = "Agent: connecté";
    b.classList.add("ok");
    b.classList.remove("ko");
  } else {
    b.textContent = "Agent: non connecté";
    b.classList.add("ko");
    b.classList.remove("ok");
  }
}

window.addEventListener("sw-agent:online", updateAgentBadge);
window.addEventListener("sw-agent:offline", updateAgentBadge);

document.addEventListener("DOMContentLoaded", () => {
  // ...existing code...
  updateAgentBadge();

  // Raccourci: Alt+S pour régler le token
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "s" && window.SWAgent) {
      const t = prompt("Token SW Agent", window.SWAgent.token || "");
      if (t) window.SWAgent.setToken(t);
    }
  });
});

//// filepath: c:\gestion-stock\server\routes\machines.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../database");

const router = express.Router();

// Auth basique (adapté à ta session existante)
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: "Non authentifié" });
}

// Assure les tables nécessaires (exécuté au chargement du routeur)
function ensureTables() {
  db.serialize(() => {
    // Table machines (toutes colonnes utilisées par le front)
    db.run(`
      CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        reference TEXT NOT NULL,
        quantite INTEGER DEFAULT 0,
        localisation TEXT,
        prix REAL DEFAULT 0,
        seuil_alert INTEGER DEFAULT 5,
        solidworks_link TEXT,
        glb_path TEXT,
        dimensions TEXT,
        poids REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des maintenances
    db.run(`
      CREATE TABLE IF NOT EXISTS machine_maintenances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER NOT NULL,
        titre TEXT,          -- alias "type" dans certaines vues
        description TEXT,
        date_maintenance TEXT,
        statut TEXT CHECK (statut IN ('planifie','en_cours','termine')) DEFAULT 'planifie',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      )
    `);

    // Table des fichiers liés (si utilisée)
    db.run(`
      CREATE TABLE IF NOT EXISTS machine_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        file_type TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      )
    `);
  });
}
ensureTables();

// Upload GLB/GLTF
const uploadsDir = path.join(process.cwd(), "public", "uploads", "machines");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]+/g, "_");
    const name = `${Date.now()}_${safe}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// ============ Helpers
function mapMachine(row) {
  return {
    id: row.id,
    nom: row.nom,
    reference: row.reference,
    quantite: row.quantite ?? 0,
    localisation: row.localisation,
    prix: row.prix ?? 0,
    seuil_alert: row.seuil_alert ?? 5,
    solidworks_link: row.solidworks_link,
    glb_path: row.glb_path,
    dimensions: row.dimensions,
    poids: row.poids ?? 0,
    created_at: row.created_at,
  };
}

// ============ Machines CRUD
router.get("/", requireAuth, (req, res) => {
  db.all("SELECT * FROM machines ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(mapMachine));
  });
});

router.get("/:id", requireAuth, (req, res) => {
  db.get("SELECT * FROM machines WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Introuvable" });
    res.json(mapMachine(row));
  });
});

router.post("/", requireAuth, upload.single("glb_file"), (req, res) => {
  const b = req.body;
  const glbPath = req.file ? `/uploads/machines/${req.file.filename}` : null;

  const sql = `
    INSERT INTO machines
      (nom, reference, quantite, localisation, prix, seuil_alert, solidworks_link, glb_path, dimensions, poids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    b.nom,
    b.reference,
    parseInt(b.quantite || 0, 10),
    b.localisation || null,
    parseFloat(b.prix || 0),
    parseInt(b.seuil_alert || 5, 10),
    b.solidworks_link || null,
    glbPath,
    b.dimensions || null,
    parseFloat(b.poids || 0),
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT * FROM machines WHERE id = ?", [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.status(201).json(mapMachine(row));
    });
  });
});

router.put("/:id", requireAuth, upload.single("glb_file"), (req, res) => {
  const id = req.params.id;
  const b = req.body;

  const updates = [
    "nom = ?",
    "reference = ?",
    "quantite = ?",
    "localisation = ?",
    "prix = ?",
    "seuil_alert = ?",
    "solidworks_link = ?",
    "dimensions = ?",
    "poids = ?",
  ];
  const params = [
    b.nom,
    b.reference,
    parseInt(b.quantite || 0, 10),
    b.localisation || null,
    parseFloat(b.prix || 0),
    parseInt(b.seuil_alert || 5, 10),
    b.solidworks_link || null,
    b.dimensions || null,
    parseFloat(b.poids || 0),
  ];

  if (req.file) {
    updates.push("glb_path = ?");
    params.push(`/uploads/machines/${req.file.filename}`);
  }

  params.push(id);

  db.run(
    `UPDATE machines SET ${updates.join(", ")} WHERE id = ?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get("SELECT * FROM machines WHERE id = ?", [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(mapMachine(row));
      });
    }
  );
});

router.delete("/:id", requireAuth, (req, res) => {
  db.run("DELETE FROM machines WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// ============ Fichiers liés à une machine
router.get("/:machineId/files", requireAuth, (req, res) => {
  db.all(
    "SELECT id, filename, filepath AS path, file_type, uploaded_at FROM machine_files WHERE machine_id = ? ORDER BY uploaded_at DESC",
    [req.params.machineId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// ============ Maintenance (GET/POST/PUT/DELETE)
router.get("/:machineId/maintenances", requireAuth, (req, res) => {
  db.all(
    "SELECT id, machine_id, titre, description, date_maintenance, statut, created_at FROM machine_maintenances WHERE machine_id = ? ORDER BY date_maintenance DESC, id DESC",
    [req.params.machineId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Back-compat: expose aussi 'type' pour les UIs existantes
      const mapped = (rows || []).map((r) => ({
        id: r.id,
        machine_id: r.machine_id,
        titre: r.titre,
        type: r.titre, // alias
        description: r.description,
        date_maintenance: r.date_maintenance,
        statut: r.statut,
        created_at: r.created_at,
      }));
      res.json(mapped);
    }
  );
});

router.post(
  "/:machineId/maintenances",
  requireAuth,
  express.json(),
  (req, res) => {
    const id = req.params.machineId;
    const b = req.body || {};
    // Supporte b.titre ou b.type, b.date ou b.date_maintenance
    const titre = b.titre || b.type || "Maintenance";
    const description = b.description || b.notes || null;
    const date_maintenance =
      b.date_maintenance || b.date || new Date().toISOString().slice(0, 10);
    const statut = b.statut || "planifie";

    const sql = `
    INSERT INTO machine_maintenances (machine_id, titre, description, date_maintenance, statut)
    VALUES (?, ?, ?, ?, ?)
  `;
    db.run(
      sql,
      [id, titre, description, date_maintenance, statut],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(
          "SELECT * FROM machine_maintenances WHERE id = ?",
          [this.lastID],
          (e, row) => {
            if (e) return res.status(500).json({ error: e.message });
            res.status(201).json(row);
          }
        );
      }
    );
  }
);

router.put(
  "/:machineId/maintenances/:maintId",
  requireAuth,
  express.json(),
  (req, res) => {
    const { machineId, maintId } = req.params;
    const b = req.body || {};
    const fields = [];
    const params = [];

    if (b.titre || b.type) {
      fields.push("titre = ?");
      params.push(b.titre || b.type);
    }
    if (b.description || b.notes) {
      fields.push("description = ?");
      params.push(b.description || b.notes);
    }
    if (b.date_maintenance || b.date) {
      fields.push("date_maintenance = ?");
      params.push(b.date_maintenance || b.date);
    }
    if (b.statut) {
      fields.push("statut = ?");
      params.push(b.statut);
    }

    if (!fields.length)
      return res.status(400).json({ error: "Aucune donnée à mettre à jour" });

    params.push(machineId, maintId);

    db.run(
      `UPDATE machine_maintenances SET ${fields.join(
        ", "
      )} WHERE machine_id = ? AND id = ?`,
      params,
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(
          "SELECT * FROM machine_maintenances WHERE machine_id = ? AND id = ?",
          [machineId, maintId],
          (e, row) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json(row);
          }
        );
      }
    );
  }
);

router.delete("/:machineId/maintenances/:maintId", requireAuth, (req, res) => {
  db.run(
    "DELETE FROM machine_maintenances WHERE machine_id = ? AND id = ?",
    [req.params.machineId, req.params.maintId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

module.exports = router;
