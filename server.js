require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("./server/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static("public"));

// Configuration des sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "changez-moi-en-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // mettre à true si HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 heures
    },
  })
);

// Middleware de vérification d'authentification
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

// Middleware pour logger les actions
function logActivity(action, details = "") {
  return (req, res, next) => {
    if (req.session.userId) {
      db.run(
        "INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)",
        [req.session.userId, action, details],
        (err) => {
          if (err) console.error("Erreur log:", err);
        }
      );
    }
    next();
  };
}

// Routes d'authentification

// Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username et password requis" });
  }

  db.get(
    "SELECT * FROM users WHERE username = ? AND actif = 1",
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur" });
      }

      if (!user) {
        return res.status(401).json({ error: "Identifiants incorrects" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Identifiants incorrects" });
      }

      // Créer la session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      // Log de connexion
      db.run("INSERT INTO activity_logs (user_id, action) VALUES (?, ?)", [
        user.id,
        "LOGIN",
      ]);

      res.json({
        id: user.id,
        username: user.username,
        nom: user.nom,
        role: user.role,
      });
    }
  );
});

// Logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
  db.run("INSERT INTO activity_logs (user_id, action) VALUES (?, ?)", [
    req.session.userId,
    "LOGOUT",
  ]);

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Erreur lors de la déconnexion" });
    }
    res.json({ message: "Déconnecté" });
  });
});

// Vérifier la session
app.get("/api/auth/check", (req, res) => {
  if (req.session.userId) {
    db.get(
      "SELECT id, username, nom, role FROM users WHERE id = ?",
      [req.session.userId],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({ authenticated: false });
        }
        res.json({
          authenticated: true,
          user: user,
        });
      }
    );
  } else {
    res.json({ authenticated: false });
  }
});

// Changer le mot de passe
app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Mots de passe requis" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
  }

  db.get(
    "SELECT password FROM users WHERE id = ?",
    [req.session.userId],
    async (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: "Erreur serveur" });
      }

      const validPassword = await bcrypt.compare(oldPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Mot de passe actuel incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedPassword, req.session.userId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Erreur lors du changement" });
          }

          db.run("INSERT INTO activity_logs (user_id, action) VALUES (?, ?)", [
            req.session.userId,
            "PASSWORD_CHANGE",
          ]);

          res.json({ message: "Mot de passe modifié" });
        }
      );
    }
  );
});

// Routes API (protégées par requireAuth)

// Récupérer tous les produits
app.get("/api/products", requireAuth, (req, res) => {
  db.all("SELECT * FROM products ORDER BY date_ajout DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Ajouter un produit
app.post(
  "/api/products",
  requireAuth,
  logActivity("ADD_PRODUCT"),
  (req, res) => {
    const { nom, quantite, localisation, prix, seuil } = req.body;

    db.run(
      `INSERT INTO products (nom, quantite, localisation, prix, seuil, user_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nom,
        quantite,
        localisation || "Non défini",
        prix || 0,
        seuil || 10,
        req.session.userId,
      ],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          nom,
          quantite,
          localisation: localisation || "Non défini",
          prix: prix || 0,
          seuil: seuil || 10,
        });
      }
    );
  }
);

// Modifier un produit
app.put(
  "/api/products/:id",
  requireAuth,
  logActivity("UPDATE_PRODUCT"),
  (req, res) => {
    const { id } = req.params;
    const { nom, quantite, localisation, prix, seuil } = req.body;

    db.run(
      `UPDATE products 
         SET nom = ?, quantite = ?, localisation = ?, prix = ?, seuil = ?
         WHERE id = ?`,
      [nom, quantite, localisation, prix, seuil, id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Produit non trouvé" });
        }
        res.json({ message: "Produit modifié", changes: this.changes });
      }
    );
  }
);

// Modifier uniquement la quantité
app.patch(
  "/api/products/:id/quantity",
  requireAuth,
  logActivity("UPDATE_QUANTITY"),
  (req, res) => {
    const { id } = req.params;
    const { quantite } = req.body;

    db.run(
      "UPDATE products SET quantite = ? WHERE id = ?",
      [quantite, id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Quantité modifiée", changes: this.changes });
      }
    );
  }
);

// Supprimer un produit
app.delete(
  "/api/products/:id",
  requireAuth,
  logActivity("DELETE_PRODUCT"),
  (req, res) => {
    const { id } = req.params;

    db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Produit non trouvé" });
      }
      res.json({ message: "Produit supprimé", changes: this.changes });
    });
  }
);

// Statistiques
app.get("/api/stats", requireAuth, (req, res) => {
  db.get(
    `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN quantite <= seuil THEN 1 ELSE 0 END) as low_stock
         FROM products`,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    }
  );
});

// Logs d'activité (admin seulement)
app.get("/api/logs", requireAuth, (req, res) => {
  if (req.session.role !== "admin") {
    return res.status(403).json({ error: "Accès refusé" });
  }

  db.all(
    `SELECT l.*, u.username, u.nom 
         FROM activity_logs l
         JOIN users u ON l.user_id = u.id
         ORDER BY l.date_action DESC
         LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Démarrage du serveur
app.listen(PORT, "0.0.0.0", () => {
  const os = require("os");
  const interfaces = os.networkInterfaces();
  let localIP = "localhost";

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIP = iface.address;
      }
    }
  }

  console.log("\n🔐 Serveur de gestion de stock SÉCURISÉ\n");
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Réseau:  http://${localIP}:${PORT}\n`);
  console.log("📦 Base de données SQLite connectée");
  console.log("🔒 Authentification activée\n");
});
