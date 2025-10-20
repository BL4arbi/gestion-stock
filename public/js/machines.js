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

  console.log('🔍 renderMachines appelée');
  console.log('Container trouvé:', !!container);
  console.log('Nombre de machines:', machines ? machines.length : 0);
  console.log('Machines:', machines);

  if (!container) {
    console.error('❌ Container "machines-list" non trouvé!');
    return;
  }

  if (!machines || machines.length === 0) {
    console.log('📭 Aucune machine à afficher');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <h3>Aucune machine</h3>
        <p>Ajoutez votre première machine</p>
      </div>
    `;
    return;
  }

  const perms = window.userPermissions || {
    canDelete: false,
    canEdit: false,
  };

  console.log('✅ Rendu de', machines.length, 'machine(s)');
  console.log('Permissions:', perms);

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
          <div class="machine-info-compact">
            <span>📦 Qté: ${machine.quantite}</span>
            <span>💰 ${parseFloat(machine.prix || 0).toFixed(2)}€</span>
          </div>
          <div class="machine-actions-bottom">
            <button class="btn-compact" onclick="openMachineDetails(${
              machine.id
            })" title="Voir les détails">
              👁️ Détails
            </button>
            ${
              perms.canEdit
                ? `<button class="btn-compact edit" onclick="editMachine(${machine.id})" title="Modifier">
                ✏️ Modifier
              </button>`
                : ""
            }
            ${
              perms.canDelete
                ? `<button class="btn-compact delete" onclick="deleteMachine(${machine.id})" title="Supprimer">
                🗑️ Suppr.
              </button>`
                : ""
            }
          </div>
        </div>
      </div>
    `
    )
    .join("");
  
  console.log('✅ HTML inséré dans le container');
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
  const machine = allMachines.find((m) => m.id === id);
  const machineName = machine ? machine.nom : `#${id}`;

  if (
    !confirm(
      `⚠️ SUPPRIMER LA MACHINE ?\n\n${machineName}\n\nCette action est irréversible !`
    )
  ) {
    return;
  }

  try {
    console.log("Suppression de la machine:", id);

    const response = await fetch(`${API}/machines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    console.log("Réponse suppression:", response.status);

    if (response.ok) {
      showNotification("✅ Machine supprimée avec succès", "success");
      await loadMachines(); // Recharge la liste
    } else {
      const error = await response.json();
      console.error("Erreur serveur:", error);
      showNotification(
        `❌ Erreur: ${error.error || "Impossible de supprimer"}`,
        "error"
      );
    }
  } catch (error) {
    console.error("Erreur réseau:", error);
    showNotification("❌ Erreur de connexion au serveur", "error");
  }
}

// ============ FONCTION MODIFICATION ============
async function editMachine(id) {
  const machine = allMachines.find((m) => m.id === id);
  if (!machine) return;

  // Remplis le formulaire avec les données existantes
  document.getElementById("nom").value = machine.nom;
  document.getElementById("reference").value = machine.reference;
  document.getElementById("quantite").value = machine.quantite;
  document.getElementById("localisation").value = machine.localisation || "";
  document.getElementById("prix").value = machine.prix || 0;
  document.getElementById("seuil_alert").value = machine.seuil_alert || 5;
  document.getElementById("solidworks_link").value =
    machine.solidworks_link || "";

  // Change le bouton submit
  const form = document.getElementById("machine-form");
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = "💾 Mettre à jour";
  submitBtn.style.background = "#f59e0b";

  // Ajoute un bouton annuler
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

  // Scroll vers le formulaire
  form.scrollIntoView({ behavior: "smooth" });

  // Change le gestionnaire du formulaire
  form.onsubmit = async (e) => {
    e.preventDefault();
    await updateMachine(id);
  };

  showNotification("✏️ Mode modification activé", "info");
}

async function updateMachine(id) {
  const data = {
    nom: document.getElementById("nom").value,
    reference: document.getElementById("reference").value,
    quantite: parseInt(document.getElementById("quantite").value),
    localisation: document.getElementById("localisation").value || "",
    prix: parseFloat(document.getElementById("prix").value || 0),
    seuil_alert: parseInt(document.getElementById("seuil_alert").value || 5),
    solidworks_link: document.getElementById("solidworks_link").value || "",
  };

  try {
    const response = await fetch(`${API}/machines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (response.ok) {
      showNotification("✅ Machine mise à jour", "success");
      cancelEdit();
      await loadMachines();
    } else {
      const error = await response.json();
      showNotification(`❌ ${error.error || "Erreur"}`, "error");
    }
  } catch (error) {
    showNotification("❌ Erreur connexion", "error");
  }
}

function cancelEdit() {
  const form = document.getElementById("machine-form");
  form.reset();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = "Ajouter la machine";
  submitBtn.style.background = "";

  const cancelBtn = document.getElementById("cancel-edit-btn");
  if (cancelBtn) cancelBtn.remove();

  // Réinitialise le gestionnaire du formulaire
  form.onsubmit = null;

  showNotification("Modification annulée", "info");
}

// ============ DÉTAILS MACHINE ============
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

        <!-- Lien SolidWorks -->
        ${
          machine.solidworks_link
            ? `
          <div style="margin-bottom:25px;padding:15px;background:#dbeafe;border-left:4px solid #0ea5e9;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <h3 style="margin:0 0 5px 0;color:#0369a1;">📐 Assemblage SolidWorks</h3>
                <p style="margin:0;color:#64748b;font-size:0.85em;font-family:monospace;word-break:break-all;">${escapeHtml(
                  machine.solidworks_link
                )}</p>
              </div>
              <button class="btn-primary" onclick="openSolidWorksFile('${machine.solidworks_link.replace(
                /\\/g,
                "\\\\"
              )}')">
                🔧 Ouvrir
              </button>
            </div>
          </div>
        `
            : ""
        }

        <!-- Visualisation 3D -->
        ${
          machine.glb_path
            ? `
          <div style="margin-bottom:25px;">
            <h3 style="margin-bottom:10px;">🎨 Aperçu 3D</h3>
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
              <p style="margin:5px 0;color:#666;">${m.description || ""}</p>
              <span style="background:${
                m.status === "completed" ? "#10b981" : "#f59e0b"
              };color:white;padding:2px 8px;border-radius:4px;font-size:0.85em;">${
                      m.status
                    }</span>
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#666;">Aucune maintenance</p>'
          }
        </div>

        <!-- Fichiers -->
        <div>
          <h3>📄 Fichiers</h3>
          ${
            files.length > 0
              ? files
                  .map(
                    (f) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f9fafb;margin-bottom:10px;border-radius:4px;">
              <div>
                <strong>${escapeHtml(f.filename)}</strong>
                <p style="margin:5px 0;color:#666;font-size:0.85em;">${new Date(
                  f.uploaded_at
                ).toLocaleDateString("fr-FR")}</p>
              </div>
              <a href="${
                f.path
              }" target="_blank" class="btn-small btn-view">📥 Voir</a>
            </div>
          `
                  )
                  .join("")
              : '<p style="color:#666;">Aucun fichier</p>'
          }
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="document.getElementById('machine-modal').style.display='none'">Fermer</button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  };
}

// Fonction pour ouvrir le fichier SolidWorks
function openSolidWorksFile(filePath) {
  const cleanPath = filePath.trim();

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content" style="max-width:650px;">
      <div class="modal-header">
        <h2>📐 Ouvrir avec SolidWorks</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="background:#f3f4f6;padding:12px;border-radius:8px;margin-bottom:20px;">
          <strong>📂 Fichier:</strong>
          <p style="margin:5px 0;font-family:monospace;font-size:0.85em;word-break:break-all;">${escapeHtml(
            cleanPath
          )}</p>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
          <button class="btn-primary" style="padding:15px;font-size:1em;" onclick="openViaPowerShell('${cleanPath.replace(
            /\\/g,
            "\\\\"
          )}'); this.closest('.modal').remove()">
            🚀 Méthode 1: Ouverture automatique (Serveur)
          </button>
          
          <button class="btn-primary" style="padding:15px;font-size:1em;" onclick="downloadBatchScript('${cleanPath.replace(
            /\\/g,
            "\\\\"
          )}'); this.closest('.modal').remove()">
            💾 Méthode 2: Télécharger script .bat
          </button>
          
          <button class="btn-primary" style="padding:15px;font-size:1em;" onclick="copyPathAndShowInstructions('${cleanPath.replace(
            /\\/g,
            "\\\\"
          )}'); this.closest('.modal').remove()">
            📋 Méthode 3: Copier le chemin (Manuel)
          </button>
        </div>

        <div style="padding:15px;background:#dbeafe;border-left:4px solid #3b82f6;border-radius:6px;">
          <strong style="display:block;margin-bottom:8px;">💡 Instructions:</strong>
          <ul style="margin:0;padding-left:20px;font-size:0.9em;line-height:1.6;">
            <li><strong>Méthode 1:</strong> Ouvre automatiquement le fichier (recommandé)</li>
            <li><strong>Méthode 2:</strong> Télécharge un script, double-cliquez dessus</li>
            <li><strong>Méthode 3:</strong> Copie le chemin et collez dans l'explorateur (Win+E)</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

async function openViaPowerShell(filePath) {
  try {
    showNotification("🔄 Ouverture du fichier...", "info");

    const response = await fetch(`${API}/open-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ filePath }),
    });

    if (response.ok) {
      showNotification("✅ Fichier ouvert avec succès!", "success");
    } else {
      const error = await response.json();
      console.error("Erreur:", error);
      showNotification(`❌ ${error.error || "Erreur ouverture"}`, "error");

      // Propose la méthode alternative
      setTimeout(() => {
        if (
          confirm(
            "❌ Échec ouverture automatique.\n\nVoulez-vous télécharger le script .bat ?"
          )
        ) {
          downloadBatchScript(filePath);
        }
      }, 1000);
    }
  } catch (error) {
    console.error("Erreur réseau:", error);
    showNotification("❌ Erreur de connexion", "error");
  }
}

async function downloadBatchScript(filePath) {
  try {
    showNotification("💾 Création du script...", "info");

    const response = await fetch(`${API}/create-open-script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ filePath }),
    });

    if (response.ok) {
      const data = await response.json();

      // Télécharge le fichier .bat
      const link = document.createElement("a");
      link.href = data.scriptPath;
      link.download = "ouvrir-solidworks.bat";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification(
        "✅ Script téléchargé! Double-cliquez dessus pour ouvrir le fichier",
        "success",
        8000
      );
    } else {
      showNotification("❌ Erreur création script", "error");
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("❌ Erreur serveur", "error");
  }
}

function copyPathAndShowInstructions(filePath) {
  copyToClipboard(filePath);
  showNotification(
    "✅ Chemin copié!\n\n1. Ouvrez l'explorateur (Win+E)\n2. Collez dans la barre d'adresse (Ctrl+V)\n3. Appuyez sur Entrée",
    "success",
    10000
  );
}

function copyToClipboard(text) {
  // Méthode moderne
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("✅ Copié avec succès:", text);
      })
      .catch((err) => {
        console.error("Erreur clipboard moderne:", err);
        fallbackCopy(text);
      });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  // Fallback pour anciens navigateurs
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
    console.log("✅ Copié avec fallback:", text);
  } catch (err) {
    console.error("Erreur copie fallback:", err);
  }

  document.body.removeChild(textarea);
}

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  if (!authChecked) await checkAuth();

  await loadMachines();

  // Ouvre la console (F12) et tape:
  fetch('/api/machines', {credentials: 'include'}).then(r => r.json()).then(data => {
    console.log('Machines dans la BD:', data);
    console.log('Nombre de machines:', data.length);
  });

  // ============ DRAG & DROP FICHIER GLB ============
  const glbFileInput = document.getElementById("glb_file");
  const solidworksInput = document.getElementById("solidworks_link");

  if (glbFileInput) {
    // Crée une zone de drop visuelle
    const dropZone = document.createElement("div");
    dropZone.className = "drop-zone";
    dropZone.innerHTML = `
      <div class="drop-zone-content">
        <div style="font-size:3em;margin-bottom:10px;">📦</div>
        <p style="font-weight:bold;margin-bottom:5px;">Glissez votre fichier GLB ici</p>
        <p style="color:#666;font-size:0.9em;">ou cliquez pour parcourir</p>
      </div>
    `;

    // Remplace l'input file par la drop zone
    glbFileInput.style.display = "none";
    glbFileInput.parentElement.appendChild(dropZone);

    // Click pour ouvrir le sélecteur
    dropZone.addEventListener("click", () => glbFileInput.click());

    // Drag & Drop events
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add("drop-zone-active");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove("drop-zone-active");
      });
    });

    dropZone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];

        // Vérifie l'extension
        if (
          file.name.toLowerCase().endsWith(".glb") ||
          file.name.toLowerCase().endsWith(".gltf")
        ) {
          glbFileInput.files = files;
          dropZone.innerHTML = `
            <div class="drop-zone-content" style="background:#dcfce7;">
              <div style="font-size:2em;margin-bottom:10px;">✅</div>
              <p style="font-weight:bold;color:#059669;">${file.name}</p>
              <p style="color:#666;font-size:0.85em;">${(
                file.size /
                1024 /
                1024
              ).toFixed(2)} MB</p>
            </div>
          `;
          showNotification(`✅ Fichier ${file.name} chargé`, "success");
        } else {
          showNotification(
            "❌ Seuls les fichiers GLB/GLTF sont acceptés",
            "error"
          );
        }
      }
    });

    // Change l'affichage quand un fichier est sélectionné
    glbFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        dropZone.innerHTML = `
          <div class="drop-zone-content" style="background:#dcfce7;">
            <div style="font-size:2em;margin-bottom:10px;">✅</div>
            <p style="font-weight:bold;color:#059669;">${file.name}</p>
            <p style="color:#666;font-size:0.85em;">${(
              file.size /
              1024 /
              1024
            ).toFixed(2)} MB</p>
          </div>
        `;
      }
    });
  }

  // ============ DRAG & DROP POUR SOLIDWORKS (FICHIER OU DOSSIER) ============
  if (solidworksInput) {
    const swDropZone = document.createElement("div");
    swDropZone.className = "drop-zone";
    swDropZone.style.minHeight = "80px";
    swDropZone.innerHTML = `
      <div class="drop-zone-content">
        <div style="font-size:2em;margin-bottom:10px;">📐</div>
        <p style="font-weight:bold;margin-bottom:5px;">Glissez le fichier SolidWorks ici</p>
        <p style="color:#666;font-size:0.9em;">Le chemin sera automatiquement rempli</p>
      </div>
    `;

    solidworksInput.parentElement.appendChild(swDropZone);

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      swDropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach((eventName) => {
      swDropZone.addEventListener(eventName, () => {
        swDropZone.classList.add("drop-zone-active");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      swDropZone.addEventListener(eventName, () => {
        swDropZone.classList.remove("drop-zone-active");
      });
    });

    swDropZone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];

        // Récupère le chemin complet (ne fonctionne que dans certains contextes)
        const filePath = file.path || file.name;

        solidworksInput.value = filePath;
        swDropZone.innerHTML = `
          <div class="drop-zone-content" style="background:#dbeafe;">
            <div style="font-size:2em;margin-bottom:10px;">✅</div>
            <p style="font-weight:bold;color:#0369a1;">${file.name}</p>
            <p style="color:#666;font-size:0.85em;font-family:monospace;word-break:break-all;">${filePath}</p>
          </div>
        `;
        showNotification(`✅ Chemin SolidWorks défini`, "success");
      }
    });
  }

  // Formulaire d'ajout
  const machineForm = document.getElementById("machine-form");
  if (machineForm) {
    machineForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Récupère les valeurs
      const nom = document.getElementById("nom")?.value;
      const reference = document.getElementById("reference")?.value;
      const quantite = document.getElementById("quantite")?.value;
      const localisation = document.getElementById("localisation")?.value || "";
      const prix = document.getElementById("prix")?.value || "0";
      const seuil_alert = document.getElementById("seuil_alert")?.value || "5";
      const solidworks_link =
        document.getElementById("solidworks_link")?.value || "";

      // Vérifie les champs obligatoires
      if (!nom || !reference || !quantite) {
        showNotification(
          "❌ Veuillez remplir tous les champs obligatoires",
          "error"
        );
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

      const glbFileInput = document.getElementById("glb_file");
      if (glbFileInput && glbFileInput.files[0]) {
        formData.append("glb_file", glbFileInput.files[0]);
      }

      try {
        console.log("Envoi de la machine...");
        const response = await fetch(`${API}/machines`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        console.log("Réponse reçue:", response.status);

        if (response.ok) {
          const result = await response.json();
          console.log("Succès:", result);
          showNotification("✅ Machine ajoutée avec succès", "success");
          machineForm.reset();
          await loadMachines();
        } else {
          const error = await response.json();
          console.error("Erreur serveur:", error);
          showNotification(
            `❌ ${error.error || "Erreur lors de l'ajout"}`,
            "error"
          );
        }
      } catch (error) {
        console.error("Erreur réseau:", error);
        showNotification("❌ Erreur de connexion au serveur", "error");
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
