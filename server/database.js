const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const DB_PATH = path.join(__dirname, "..", "stock.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ Erreur connexion DB:", err);
  else console.log("✅ Connecté à la base de données");
});

db.run("PRAGMA foreign_keys = ON");

// Supprimer l'ancienne table problématique
db.run("DROP TABLE IF EXISTS maintenances", (err) => {
  if (err) console.warn("⚠️ Suppression maintenances:", err.message);
  else console.log("🗑️ Ancienne table maintenances supprimée");
});

// USERS
db.run(
  `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('viewer','operator','admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
  (err) => {
    if (err) console.error("❌ users:", err);
    else {
      const pwd = bcrypt.hashSync("admin123", 10);
      db.run(
        "INSERT OR IGNORE INTO users (username,password,role) VALUES (?,?,?)",
        ["admin", pwd, "admin"]
      );
    }
  }
);

// PRODUCTS
db.run(
  `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    reference TEXT,
    quantite INTEGER DEFAULT 0,
    unite TEXT DEFAULT 'pièce',
    localisation TEXT,
    prix REAL DEFAULT 0,
    seuil_alert INTEGER DEFAULT 10,
    category TEXT NOT NULL CHECK(category IN ('visserie','epi','base')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`
);

// MACHINES
db.run(
  `
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
`
);

// MACHINE FILES
db.run(
  `
  CREATE TABLE IF NOT EXISTS machine_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_type TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(machine_id) REFERENCES machines(id) ON DELETE CASCADE
  )
`
);

// MACHINE MAINTENANCES (nouvelle table propre)
db.run(
  `
  CREATE TABLE IF NOT EXISTS machine_maintenances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    titre TEXT,
    description TEXT,
    date_maintenance TEXT,
    statut TEXT CHECK (statut IN ('planifie','en_cours','termine')) DEFAULT 'planifie',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(machine_id) REFERENCES machines(id) ON DELETE CASCADE
  )
`,
  (err) => {
    if (err) console.error("❌ machine_maintenances:", err);
    else console.log("✅ Table machine_maintenances créée");
  }
);

module.exports = db;
