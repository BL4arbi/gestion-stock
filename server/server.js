require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const db = require("./database");
const os = require("os");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

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

// ============================================
// ========== MIDDLEWARE ======================
// ============================================

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

// Fichiers statiques (AVANT les routes)
app.use(
  express.static(path.join(__dirname, "..", "public"), {
    etag: false,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      if (filePath.endsWith(".js")) {
        res.set("Content-Type", "application/javascript");
      }
    },
  })
);

// Middleware auth
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

function checkPermission(requiredRole) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    const roles = { viewer: 1, operator: 2, admin: 3 };
    if (roles[req.session.user.role] >= roles[requiredRole]) {
      next();
    } else {
      res.status(403).json({ error: "Permission insuffisante" });
    }
  };
}

// ============================================
// ========== ROUTES AUTH =====================
// ============================================

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

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/auth/check", (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// ============================================
// ========== ROUTES SOLIDWORKS ===============
// ============================================

app.post("/api/open-file", requireAuth, (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "Chemin manquant" });
  }

  console.log("📂 Ouverture fichier:", filePath);

  const command = `powershell.exe -Command "Start-Process '${filePath}'"`;

  exec(command, (error) => {
    if (error) {
      console.error("❌ Erreur PowerShell:", error);
      const cmdCommand = `cmd /c start "" "${filePath}"`;
      exec(cmdCommand, (error2) => {
        if (error2) {
          console.error("❌ Erreur cmd:", error2);
          return res.status(500).json({
            error: "Impossible d'ouvrir le fichier",
            details: error2.message,
          });
        }
        console.log("✅ Fichier ouvert (cmd)");
        res.json({ message: "Fichier ouvert" });
      });
    } else {
      console.log("✅ Fichier ouvert (PowerShell)");
      res.json({ message: "Fichier ouvert" });
    }
  });
});

// ============================================
// ========== ROUTES API ======================
// ============================================

// ✅ CHARGER LES ROUTES DEPUIS LES FICHIERS
app.use("/api/products", require("./routes/products"));
app.use("/api/machines", require("./routes/machines"));
app.use("/api/agent", require("./routes/agent")); // ← AJOUTER CETTE LIGNE
app.use("/api/dashboard", require("./routes/dashboard")); // +++

// ============================================
// ========== ROUTES PAGES HTML ===============
// ============================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

// ============================================
// ========== DÉMARRAGE SERVEUR ===============
// ============================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur lancé sur http://${LOCAL_IP}:${PORT}`);
  console.log(`📡 Accessible depuis: http://localhost:${PORT}`);
});
