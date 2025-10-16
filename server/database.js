const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "..", "stock.db");
const db = new sqlite3.Database(dbPath);

// Initialisation de la base de données
db.serialize(() => {
  // Table des utilisateurs
  db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nom TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            actif INTEGER DEFAULT 1
        )
    `);

  // Table des produits
  db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            quantite INTEGER DEFAULT 0,
            localisation TEXT DEFAULT 'Non défini',
            prix REAL DEFAULT 0,
            seuil INTEGER DEFAULT 10,
            date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_modification DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

  // Table des logs d'activité
  db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            date_action DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

  // Créer un utilisateur admin par défaut si aucun n'existe
  db.get("SELECT COUNT(*) as count FROM users", [], async (err, row) => {
    if (err) {
      console.error("Erreur lors de la vérification des utilisateurs:", err);
      return;
    }

    if (row.count === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      db.run(
        "INSERT INTO users (username, password, nom, role) VALUES (?, ?, ?, ?)",
        ["admin", hashedPassword, "Administrateur", "admin"],
        (err) => {
          if (err) {
            console.error("Erreur création admin:", err);
          } else {
            console.log("👤 Utilisateur admin créé : admin / admin123");
            console.log("⚠️  CHANGEZ LE MOT DE PASSE !");
          }
        }
      );
    }
  });

  console.log("✅ Base de données initialisée");
});

module.exports = db;
