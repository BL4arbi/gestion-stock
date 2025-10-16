const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const db = require("../database");

// Configuration multer pour les uploads
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Seuls les PDF sont acceptés"));
    }
  }
});

// =================== MACHINES =================== //

// GET toutes les machines
router.get("/", (req, res) => {
  db.all("SELECT * FROM machines ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET une machine par ID
router.get("/:id", (req, res) => {
  db.get("SELECT * FROM machines WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Machine non trouvée" });
    res.json(row);
  });
});

// POST créer une machine
router.post("/", upload.single("glb_file"), (req, res) => {
  const { nom, reference, quantite, localisation, prix, seuil_alert } = req.body;
  const glbFile = req.file ? `/uploads/${req.file.filename}` : null;

  db.run(
    `INSERT INTO machines (nom, reference, quantite, localisation, prix, seuil_alert, date_creation, glb_file) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    [nom, reference, quantite, localisation, prix, seuil_alert, glbFile],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

// PUT modifier une machine
router.put("/:id", (req, res) => {
  try {
    const { nom, reference, quantite, localisation, prix, seuil_alert } = req.body;
    
    db.run(
      `UPDATE machines SET nom = ?, reference = ?, quantite = ?, localisation = ?, prix = ?, seuil_alert = ?, date_modification = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nom, reference, quantite, localisation, prix, seuil_alert, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: req.params.id });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE une machine
router.delete("/:id", (req, res) => {
  db.get("SELECT glb_file FROM machines WHERE id = ?", [req.params.id], (err, machine) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!machine) return res.status(404).json({ error: "Machine non trouvée" });

    // Supprimer le fichier GLB physique s'il existe
    if (machine.glb_file) {
      const filePath = path.join(__dirname, "..", "public", machine.glb_file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Supprimer l'enregistrement de la machine
    db.run("DELETE FROM machines WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ===== MAINTENANCES =====

// GET maintenances d'une machine
router.get("/:machineId/maintenances", (req, res) => {
  db.all(
    "SELECT * FROM maintenances WHERE machine_id = ? ORDER BY date DESC",
    [req.params.machineId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST créer une maintenance
router.post("/:machineId/maintenances", (req, res) => {
  const { description, date, cout, responsable } = req.body;

  db.run(
    `INSERT INTO maintenances (machine_id, description, date, cout, responsable, date_creation) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.params.machineId, description, date, cout, responsable],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

// ===== FICHIERS/PDF =====

// GET fichiers d'une machine
router.get("/:machineId/files", (req, res) => {
  try {
    db.all(
      "SELECT id, filename, path, uploaded_at FROM machine_files WHERE machine_id = ? ORDER BY uploaded_at DESC",
      [req.params.machineId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST uploader un fichier PDF
router.post("/:machineId/files", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    const filename = req.body.filename || req.file.originalname.replace(".pdf", "");
    const filepath = `/uploads/${req.file.filename}`;

    db.run(
      `INSERT INTO machine_files (machine_id, filename, path, type, uploaded_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.params.machineId, filename, filepath, "pdf"],
      function(err) {
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
});

// DELETE un fichier
router.delete("/files/:fileId", (req, res) => {
  try {
    db.get(
      "SELECT path FROM machine_files WHERE id = ?",
      [req.params.fileId],
      (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: "Fichier non trouvé" });

        // Supprimer le fichier physique
        const filepath = path.join(__dirname, "..", "public", file.path);
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

module.exports = router;