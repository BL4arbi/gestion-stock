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

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(express.static("public"));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "changez-moi-en-production",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 86400000 },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

// 📁 Gestion des uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Servir les fichiers uploadés
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================
// ========== ROUTES AUTHENTIFICATION =========
// ============================================

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username et password requis" });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (!user) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("❌ Bcrypt Error:", err);
        return res.status(500).json({ error: "Erreur serveur" });
      }

      if (!isMatch) {
        return res.status(401).json({ error: "Identifiants invalides" });
      }

      req.session.userId = user.id;
      req.session.user = {
        id: user.id,
        username: user.username,
        nom: user.nom,
        role: user.role,
      };

      res.json({ success: true, user: req.session.user });
    });
  });
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
  db.all(
    "SELECT * FROM products WHERE user_id = ? ORDER BY date_ajout DESC",
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/products", requireAuth, (req, res) => {
  const { nom, quantite, localisation, prix, seuil } = req.body;
  db.run(
    `INSERT INTO products (nom, quantite, localisation, prix, seuil, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      nom,
      quantite || 0,
      localisation,
      prix || 0,
      seuil || 10,
      req.session.userId,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, nom, quantite });
    }
  );
});

app.put("/api/products/:id", requireAuth, (req, res) => {
  const { nom, quantite, localisation, prix, seuil } = req.body;
  db.run(
    `UPDATE products SET nom=?, quantite=?, localisation=?, prix=?, seuil=?, date_modification=CURRENT_TIMESTAMP
     WHERE id=? AND user_id=?`,
    [
      nom,
      quantite,
      localisation,
      prix,
      seuil,
      req.params.id,
      req.session.userId,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Produit non trouvé" });
      res.json({ message: "Produit mis à jour" });
    }
  );
});

app.delete("/api/products/:id", requireAuth, (req, res) => {
  db.run(
    "DELETE FROM products WHERE id=? AND user_id=?",
    [req.params.id, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Produit non trouvé" });
      res.json({ message: "Produit supprimé" });
    }
  );
});

app.patch("/api/products/:id/quantity", requireAuth, (req, res) => {
  const { quantite } = req.body;
  db.run(
    `UPDATE products SET quantite=?, date_modification=CURRENT_TIMESTAMP
     WHERE id=? AND user_id=?`,
    [quantite, req.params.id, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Quantité modifiée" });
    }
  );
});

app.get("/api/stats", requireAuth, (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN quantite <= seuil THEN 1 ELSE 0 END) as low_stock
     FROM products WHERE user_id = ?`,
    [req.session.userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

// ============================================
// ========== ROUTES MACHINES =================
// ============================================

app.get("/api/machines", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM machines WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
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

app.post(
  "/api/machines",
  requireAuth,
  upload.single("glb_file"),
  (req, res) => {
    const { nom, reference, quantite, localisation, prix, seuil_alert } =
      req.body;
    const glb_path = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(
      `INSERT INTO machines (nom, reference, quantite, localisation, prix, seuil_alert, glb_path, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        reference,
        quantite || 0,
        localisation,
        prix || 0,
        seuil_alert || 1,
        glb_path,
        req.session.userId,
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, nom });
      }
    );
  }
);

app.put("/api/machines/:id", requireAuth, (req, res) => {
  const { nom, reference, quantite, localisation, prix, seuil_alert } =
    req.body;
  db.run(
    `UPDATE machines SET nom=?, reference=?, quantite=?, localisation=?, prix=?, seuil_alert=?
     WHERE id=? AND user_id=?`,
    [
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      req.params.id,
      req.session.userId,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Machine mise à jour" });
    }
  );
});

app.delete("/api/machines/:id", requireAuth, (req, res) => {
  db.run(
    "DELETE FROM machines WHERE id=? AND user_id=?",
    [req.params.id, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Machine supprimée" });
    }
  );
});

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

app.put("/api/maintenances/:id", requireAuth, (req, res) => {
  const { status, date_realisee, priority } = req.body;
  db.run(
    `UPDATE maintenances SET status=?, date_realisee=?, priority=? WHERE id=?`,
    [status, date_realisee || null, priority || "medium", req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Mise à jour réussie" });
    }
  );
});

app.delete("/api/maintenances/:id", requireAuth, (req, res) => {
  db.run(
    "DELETE FROM maintenances WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Suppression réussie" });
    }
  );
});

// ============================================
// ========== ROUTES FICHIERS/PDF =============
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
        return res.status(400).json({ error: "Aucun fichier fourni" });
      }

      const filename =
        req.body.filename || req.file.originalname.replace(".pdf", "");
      const filepath = `/uploads/${req.file.filename}`;

      db.run(
        `INSERT INTO machine_files (machine_id, filename, path, type, uploaded_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.params.machineId, filename, filepath, "pdf"],
        function (err) {
          if (err) {
            console.error("Erreur insertion DB:", err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true, id: this.lastID, path: filepath });
        }
      );
    } catch (error) {
      console.error("Erreur upload:", error);
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

        // Supprimer le fichier physique
        const filepath = path.join(__dirname, "public", file.path);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }

        // Supprimer l'enregistrement BD
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
// ========== DÉMARRAGE SERVEUR ===============
// ============================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur lancé sur http://${LOCAL_IP}:${PORT}`);
});
