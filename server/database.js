const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "..", "stock.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Table users avec rôle
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Crée les utilisateurs par défaut
  const users = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "operateur", password: "operateur123", role: "operator" },
    { username: "visiteur", password: "visiteur123", role: "viewer" },
  ];

  users.forEach((user) => {
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [user.username],
      (err, row) => {
        if (!row) {
          bcrypt.hash(user.password, 10, (err, hash) => {
            if (!err) {
              db.run(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                [user.username, hash, user.role],
                (err) => {
                  if (!err)
                    console.log(
                      `✓ Utilisateur ${user.username} (${user.role}) créé`
                    );
                  else
                    console.error(
                      `✗ Erreur création ${user.username}:`,
                      err.message
                    );
                }
              );
            }
          });
        } else {
          console.log(`ℹ Utilisateur ${user.username} existe déjà`);
        }
      }
    );
  });

  // Table products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      quantite INTEGER NOT NULL,
      localisation TEXT,
      prix REAL,
      seuil_alert INTEGER DEFAULT 10,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table machines
  db.run(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      quantite INTEGER NOT NULL,
      localisation TEXT,
      prix REAL,
      seuil_alert INTEGER DEFAULT 5,
      glb_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table maintenances
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      date_programmee DATE NOT NULL,
      date_realisee DATETIME,
      status TEXT DEFAULT 'scheduled',
      priority TEXT DEFAULT 'medium',
      technicien TEXT,
      cout REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
    )
  `);

  // Table machine_files (CORRIGÉE)
  db.run(`
    CREATE TABLE IF NOT EXISTS machine_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
    )
  `);
});

module.exports = db;
