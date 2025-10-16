const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "..", "stock.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Table users
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

  // Table produits
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

  // Table logs activité
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

  // Table machines industrielles
  db.run(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      reference TEXT,
      quantite INTEGER DEFAULT 0,
      localisation TEXT,
      prix REAL,
      seuil_alert INTEGER DEFAULT 10,
      dimensions TEXT,
      poids REAL,
      glb_path TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Historique & maintenances
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      type TEXT,
      priority TEXT DEFAULT 'medium',
      description TEXT,
      date_programmee DATETIME,
      date_realisee DATETIME,
      status TEXT DEFAULT 'scheduled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(machine_id) REFERENCES machines(id)
    )
  `);

  // Fichiers associés aux machines (PDF, images, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS machine_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      filename TEXT,
      path TEXT,
      type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(machine_id) REFERENCES machines(id)
    )
  `);

  // Création d'un admin par défaut
  db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
    if (err) {
      console.error("❌ Erreur vérification users:", err);
      return;
    }

    if (row && row.count === 0) {
      bcrypt.hash("admin123", 10, (hashErr, hashed) => {
        if (hashErr) {
          console.error("❌ Erreur hash password:", hashErr);
          return;
        }

        db.run(
          "INSERT INTO users (username, password, nom, role) VALUES (?, ?, ?, ?)",
          ["admin", hashed, "Administrateur", "admin"],
          (insertErr) => {
            if (insertErr)
              console.error("❌ Erreur création admin:", insertErr);
            else console.log("👤 Admin créé : admin / admin123");
          }
        );
      });
    }
  });

  console.log("✅ Base de données initialisée");
});

module.exports = db;
