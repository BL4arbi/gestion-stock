require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("./database");
const os = require("os");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "public", "assets", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".glb", ".gltf", ".pdf", ".docx", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext) || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// Récupérer l'IP locale
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const LOCAL_IP = getLocalIP();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key-tacquet",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Désactive le cache pour les fichiers statiques
app.use(
  express.static("public", {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    },
  })
);

// Middleware d'authentification
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

// Middleware de vérification des permissions
function checkPermission(requiredRole) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const userRole = req.session.user.role;
    const roles = {
      viewer: 1,
      operator: 2,
      admin: 3,
    };

    if (roles[userRole] >= roles[requiredRole]) {
      next();
    } else {
      res.status(403).json({ error: "Permission insuffisante" });
    }
  };
}

// Route pour récupérer les permissions de l'utilisateur
app.get("/api/auth/permissions", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  res.json({
    role: req.session.user.role,
    username: req.session.user.username,
    permissions: {
      canEdit:
        req.session.user.role === "admin" ||
        req.session.user.role === "operator",
      canEditPrices: req.session.user.role === "admin",
      canDelete: req.session.user.role === "admin",
      canAddRemoveStock: req.session.user.role !== "viewer",
      canViewOnly: req.session.user.role === "viewer",
    },
  });
});

// Route de login (modifie pour inclure le rôle)
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) return res.status(500).json({ error: "Erreur serveur" });
      if (!user)
        return res.status(401).json({ error: "Identifiants incorrects" });

      const match = await bcrypt.compare(password, user.password);
      if (!match)
        return res.status(401).json({ error: "Identifiants incorrects" });

      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role || "user",
      };

      res.json({
        message: "Connexion réussie",
        username: user.username,
        role: user.role,
      });
    }
  );
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth
app.get("/api/auth/check", (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// ============================================
// ========== ROUTES PAGES HTML ===============
// ============================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/machines.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/machines.html"));
});

// ============================================
// ========== ROUTES PRODUITS =================
// ============================================

app.get("/api/products", requireAuth, (req, res) => {
  const category = req.query.category || "general";
  db.all(
    "SELECT * FROM products WHERE category = ? ORDER BY nom",
    [category],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post(
  "/api/products",
  requireAuth,
  checkPermission("operator"),
  (req, res) => {
    const { nom, quantite, localisation, prix, seuil_alert, category } =
      req.body;
    db.run(
      "INSERT INTO products (nom, quantite, localisation, prix, seuil_alert, category) VALUES (?, ?, ?, ?, ?, ?)",
      [
        nom,
        quantite,
        localisation || null,
        prix || 0,
        seuil_alert || 10,
        category || "general",
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "Produit ajouté" });
      }
    );
  }
);

// PUT modifier machine
app.put(
  "/api/machines/:id",
  requireAuth,
  checkPermission("admin"),
  upload.single("glb_file"),
  (req, res) => {
    console.log("📥 PUT /api/machines/" + req.params.id);
    console.log("Body:", req.body);
    console.log("File:", req.file);

    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      solidworks_link,
    } = req.body;
    const { id } = req.params;

    // ✅ VALIDATION
    if (!nom || !reference || !quantite) {
      console.error("❌ Champs manquants:", { nom, reference, quantite });
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    // Prépare les champs à mettre à jour
    let query = `UPDATE machines SET 
      nom = ?,
      reference = ?,
      quantite = ?,
      localisation = ?,
      prix = ?,
      seuil_alert = ?,
      solidworks_link = ?`;

    let params = [
      nom,
      reference,
      parseInt(quantite),
      localisation || null,
      parseFloat(prix) || 0,
      parseInt(seuil_alert) || 5,
      solidworks_link || null,
    ];

    // Si nouveau fichier GLB uploadé
    if (req.file) {
      query += `, glb_path = ?`;
      params.push(`/assets/uploads/${req.file.filename}`);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    console.log("🔧 Query:", query);
    console.log("🔧 Params:", params);

    db.run(query, params, function (err) {
      if (err) {
        console.error("❌ Erreur UPDATE:", err);
        return res.status(500).json({ error: err.message });
      }
      console.log("✅ Machine modifiée");
      res.json({ message: "Machine modifiée avec succès" });
    });
  }
);

app.delete(
  "/api/products/:id",
  requireAuth,
  checkPermission("admin"),
  (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Produit supprimé" });
    });
  }
);

// ============================================
// ========== ROUTES MACHINES =================
// ============================================

// GET toutes les machines
app.get("/api/machines", requireAuth, (req, res) => {
  db.all("SELECT * FROM machines ORDER BY nom", (err, rows) => {
    if (err) {
      console.error("Erreur GET machines:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get("/api/machines/:id", requireAuth, (req, res) => {
  db.get(
    "SELECT * FROM machines WHERE id=? AND user_id=?",
    [req.params.id, req.session.userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Machine non trouvée" });
      res.json(row);
    }
  );
});

// POST nouvelle machine
app.post(
  "/api/machines",
  requireAuth,
  checkPermission("admin"),
  upload.single("glb_file"),
  (req, res) => {
    console.log("POST /api/machines - Body:", req.body);
    console.log("POST /api/machines - File:", req.file);

    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      solidworks_link,
    } = req.body;
    const glb_path = req.file ? `/assets/uploads/${req.file.filename}` : null;

    // Validation
    if (!nom || !reference || !quantite) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    db.run(
      `INSERT INTO machines (nom, reference, quantite, localisation, prix, seuil_alert, glb_path, solidworks_link) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        reference,
        quantite,
        localisation || null,
        prix || 0,
        seuil_alert || 5,
        glb_path,
        solidworks_link || null,
      ],
      function (err) {
        if (err) {
          console.error("Erreur POST machine:", err);
          return res.status(500).json({ error: err.message });
        }
        console.log("Machine ajoutée avec ID:", this.lastID);
        res.json({ id: this.lastID, message: "Machine ajoutée" });
      }
    );
  }
);

// PUT modifier machine
app.put(
  "/api/machines/:id",
  requireAuth,
  checkPermission("admin"),
  (req, res) => {
    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      solidworks_link,
    } = req.body;
    const { id } = req.params;

    db.run(
      `UPDATE machines 
       SET nom=?, reference=?, quantite=?, localisation=?, prix=?, seuil_alert=?, solidworks_link=? 
       WHERE id=?`,
      [
        nom,
        reference,
        quantite,
        localisation,
        prix,
        seuil_alert,
        solidworks_link,
        id,
      ],
      (err) => {
        if (err) {
          console.error("Erreur PUT machine:", err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Machine modifiée" });
      }
    );
  }
);

// DELETE machine
app.delete(
  "/api/machines/:id",
  requireAuth,
  checkPermission("admin"),
  (req, res) => {
    const { id } = req.params;

    // Récupère d'abord les infos de la machine
    db.get(
      "SELECT glb_path FROM machines WHERE id = ?",
      [id],
      (err, machine) => {
        if (err) {
          console.error("Erreur récupération machine:", err);
          return res.status(500).json({ error: err.message });
        }

        // Supprime le fichier GLB si présent
        if (machine && machine.glb_path) {
          const filePath = path.join(
            __dirname,
            "..",
            "public",
            machine.glb_path
          );
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log("✓ Fichier GLB supprimé:", filePath);
            } catch (err) {
              console.error("Erreur suppression fichier:", err);
            }
          }
        }

        // Supprime tous les fichiers associés
        db.all(
          "SELECT path FROM machine_files WHERE machine_id = ?",
          [id],
          (err, files) => {
            if (files && files.length > 0) {
              files.forEach((file) => {
                const filePath = path.join(
                  __dirname,
                  "..",
                  "public",
                  file.path
                );
                if (fs.existsSync(filePath)) {
                  try {
                    fs.unlinkSync(filePath);
                    console.log("✓ Fichier supprimé:", filePath);
                  } catch (err) {
                    console.error("Erreur suppression fichier:", err);
                  }
                }
              });
            }

            // Supprime les maintenances associées
            db.run(
              "DELETE FROM maintenances WHERE machine_id = ?",
              [id],
              (err) => {
                if (err) console.error("Erreur suppression maintenances:", err);
              }
            );

            // Supprime les fichiers associés de la BD
            db.run(
              "DELETE FROM machine_files WHERE machine_id = ?",
              [id],
              (err) => {
                if (err) console.error("Erreur suppression fichiers BD:", err);
              }
            );

            // Supprime enfin la machine
            db.run("DELETE FROM machines WHERE id = ?", [id], (err) => {
              if (err) {
                console.error("Erreur DELETE machine:", err);
                return res.status(500).json({ error: err.message });
              }
              console.log("✓ Machine supprimée avec succès:", id);
              res.json({ message: "Machine supprimée avec succès" });
            });
          }
        );
      }
    );
  }
);

// ============================================
// ========== ROUTES MAINTENANCES =============
// ============================================

// ============================================
// ========== ROUTES MACHINES =================
// ============================================

// GET toutes les machines
app.get("/api/machines", requireAuth, (req, res) => {
  db.all("SELECT * FROM machines ORDER BY nom", (err, rows) => {
    if (err) {
      console.error("Erreur GET machines:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET une machine
app.get("/api/machines/:id", requireAuth, (req, res) => {
  db.get("SELECT * FROM machines WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Machine non trouvée" });
    res.json(row);
  });
});

// POST nouvelle machine
app.post(
  "/api/machines",
  requireAuth,
  checkPermission("admin"),
  upload.single("glb_file"),
  (req, res) => {
    console.log("📥 POST /api/machines");
    console.log("Body:", req.body);
    console.log("File:", req.file);

    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      solidworks_link,
    } = req.body;

    const glb_path = req.file ? `/assets/uploads/${req.file.filename}` : null;

    if (!nom || !reference || !quantite) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    db.run(
      `INSERT INTO machines (nom, reference, quantite, localisation, prix, seuil_alert, glb_path, solidworks_link) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        reference,
        parseInt(quantite),
        localisation || null,
        parseFloat(prix) || 0,
        parseInt(seuil_alert) || 5,
        glb_path,
        solidworks_link || null,
      ],
      function (err) {
        if (err) {
          console.error("❌ Erreur INSERT:", err);
          return res.status(500).json({ error: err.message });
        }
        console.log("✅ Machine ajoutée, ID:", this.lastID);
        res.json({ id: this.lastID, message: "Machine ajoutée" });
      }
    );
  }
);

// PUT modifier machine
app.put(
  "/api/machines/:id",
  requireAuth,
  checkPermission("admin"),
  upload.single("glb_file"),
  (req, res) => {
    console.log("📥 PUT /api/machines/" + req.params.id);
    console.log("Body:", req.body);
    console.log("File:", req.file);

    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      solidworks_link,
    } = req.body;
    const { id } = req.params;

    let query = `UPDATE machines SET nom=?, reference=?, quantite=?, localisation=?, prix=?, seuil_alert=?, solidworks_link=?`;
    let params = [
      nom,
      reference,
      parseInt(quantite),
      localisation,
      parseFloat(prix),
      parseInt(seuil_alert),
      solidworks_link,
    ];

    // Si nouveau fichier GLB
    if (req.file) {
      query += `, glb_path=?`;
      params.push(`/assets/uploads/${req.file.filename}`);
    }

    query += ` WHERE id=?`;
    params.push(id);

    db.run(query, params, function (err) {
      if (err) {
        console.error("❌ Erreur UPDATE:", err);
        return res.status(500).json({ error: err.message });
      }
      console.log("✅ Machine modifiée");
      res.json({ message: "Machine modifiée" });
    });
  }
);

// DELETE machine
app.delete(
  "/api/machines/:id",
  requireAuth,
  checkPermission("admin"),
  (req, res) => {
    const { id } = req.params;
    console.log("🗑️ DELETE /api/machines/" + id);

    db.get(
      "SELECT glb_path FROM machines WHERE id = ?",
      [id],
      (err, machine) => {
        if (err) {
          console.error("❌ Erreur SELECT:", err);
          return res.status(500).json({ error: err.message });
        }

        // Supprime le fichier GLB
        if (machine && machine.glb_path) {
          const filePath = path.join(
            __dirname,
            "..",
            "public",
            machine.glb_path
          );
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log("✅ Fichier GLB supprimé");
            } catch (err) {
              console.error("❌ Erreur suppression fichier:", err);
            }
          }
        }

        // Supprime les fichiers associés
        db.all(
          "SELECT path FROM machine_files WHERE machine_id = ?",
          [id],
          (err, files) => {
            if (files && files.length > 0) {
              files.forEach((file) => {
                const filePath = path.join(
                  __dirname,
                  "..",
                  "public",
                  file.path
                );
                if (fs.existsSync(filePath)) {
                  try {
                    fs.unlinkSync(filePath);
                  } catch (err) {
                    console.error("Erreur:", err);
                  }
                }
              });
            }

            // Supprime maintenances
            db.run("DELETE FROM maintenances WHERE machine_id = ?", [id]);

            // Supprime fichiers BD
            db.run("DELETE FROM machine_files WHERE machine_id = ?", [id]);

            // Supprime la machine
            db.run("DELETE FROM machines WHERE id = ?", [id], (err) => {
              if (err) {
                console.error("❌ Erreur DELETE:", err);
                return res.status(500).json({ error: err.message });
              }
              console.log("✅ Machine supprimée");
              res.json({ message: "Machine supprimée" });
            });
          }
        );
      }
    );
  }
);

// ============================================
// ========== ROUTES MAINTENANCES =============
// ============================================

app.get("/api/machines/:id/maintenances", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM maintenances WHERE machine_id = ? ORDER BY date_programmee DESC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/machines/:id/maintenances", requireAuth, (req, res) => {
  const { type, priority, description, date_programmee, status } = req.body;
  db.run(
    `INSERT INTO maintenances (machine_id, type, priority, description, date_programmee, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      req.params.id,
      type,
      priority || "medium",
      description,
      date_programmee,
      status || "scheduled",
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// ============================================
// ========== ROUTES FICHIERS =================
// ============================================

app.get("/api/machines/:machineId/files", requireAuth, (req, res) => {
  db.all(
    "SELECT id, filename, path, uploaded_at FROM machine_files WHERE machine_id = ? ORDER BY uploaded_at DESC",
    [req.params.machineId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.post(
  "/api/machines/:machineId/files",
  requireAuth,
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier" });
      }

      const filename = req.body.filename || req.file.originalname;
      const filepath = `/assets/uploads/${req.file.filename}`;

      db.run(
        `INSERT INTO machine_files (machine_id, filename, path, uploaded_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.params.machineId, filename, filepath],
        function (err) {
          if (err) {
            console.error("Erreur:", err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, id: this.lastID, path: filepath });
        }
      );
    } catch (error) {
      console.error("Erreur:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.delete("/api/machines/files/:fileId", requireAuth, (req, res) => {
  try {
    db.get(
      "SELECT path FROM machine_files WHERE id = ?",
      [req.params.fileId],
      (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: "Fichier non trouvé" });

        const filepath = path.join(__dirname, "..", "public", file.path);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }

        db.run(
          "DELETE FROM machine_files WHERE id = ?",
          [req.params.fileId],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ========== ROUTES COMMANDES =================
// ============================================

app.post("/api/open-file", requireAuth, (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "Chemin manquant" });
  }

  console.log("Tentative d'ouverture du fichier:", filePath);

  // Utilise une commande PowerShell qui fonctionne mieux avec les chemins réseau
  const command = `powershell.exe -Command "Start-Process '${filePath}'"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("Erreur ouverture fichier:", error);
      console.error("stderr:", stderr);

      // Essaye une méthode alternative avec cmd
      const cmdCommand = `cmd /c start "" "${filePath}"`;
      exec(cmdCommand, (error2, stdout2, stderr2) => {
        if (error2) {
          console.error("Erreur méthode alternative:", error2);
          return res.status(500).json({
            error: "Impossible d'ouvrir le fichier",
            details: error2.message,
          });
        }
        console.log("✓ Fichier ouvert avec cmd");
        res.json({ message: "Fichier ouvert" });
      });
    } else {
      console.log("✓ Fichier ouvert avec PowerShell");
      res.json({ message: "Fichier ouvert" });
    }
  });
});

app.post("/api/create-open-script", requireAuth, (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "Chemin manquant" });
  }

  // Crée un fichier .bat avec plusieurs méthodes de fallback
  const scriptContent = `@echo off
echo Tentative d'ouverture du fichier...
echo Chemin: ${filePath}
echo.

REM Méthode 1: Start direct
start "" "${filePath}"

REM Attendre 2 secondes
timeout /t 2 /nobreak >nul

REM Si échec, méthode 2: Explorer
if errorlevel 1 (
    echo Méthode alternative...
    explorer.exe "${filePath}"
)

echo.
echo Appuyez sur une touche pour fermer...
pause >nul
`;

  const timestamp = Date.now();
  const scriptPath = path.join(
    __dirname,
    "..",
    "public",
    "assets",
    `open-solidworks-${timestamp}.bat`
  );

  try {
    fs.writeFileSync(scriptPath, scriptContent);
    console.log("✓ Script créé:", scriptPath);

    res.json({
      scriptPath: `/assets/open-solidworks-${timestamp}.bat`,
      message: "Script créé",
    });
  } catch (error) {
    console.error("Erreur création script:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ========== DÉMARRAGE SERVEUR ===============
// ============================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur lancé sur http://${LOCAL_IP}:${PORT}`);
});
