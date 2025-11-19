const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../database");

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: "Non authentifié" });
}

const uploadsDir = path.join(process.cwd(), "public", "uploads", "machines");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]+/g, "_");
    cb(null, Date.now() + "_" + safe);
  },
});
const upload = multer({ storage });

function mapMachine(r) {
  return {
    id: r.id,
    nom: r.nom,
    reference: r.reference,
    quantite: r.quantite ?? 0,
    localisation: r.localisation,
    prix: r.prix ?? 0,
    seuil_alert: r.seuil_alert ?? 5,
    solidworks_link: r.solidworks_link,
    glb_path: r.glb_path,
    dimensions: r.dimensions,
    poids: r.poids ?? 0,
    created_at: r.created_at,
  };
}

// LIST
router.get("/", requireAuth, (_req, res) => {
  db.all("SELECT * FROM machines ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(mapMachine));
  });
});

// ONE
router.get("/:id", requireAuth, (req, res) => {
  db.get("SELECT * FROM machines WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Introuvable" });
    res.json(mapMachine(row));
  });
});

// CREATE
router.post("/", requireAuth, upload.single("glb_file"), (req, res) => {
  const b = req.body;
  const glbPath = req.file ? `/uploads/machines/${req.file.filename}` : null;

  const sql = `
    INSERT INTO machines
      (nom, reference, quantite, localisation, prix, seuil_alert, solidworks_link, glb_path, dimensions, poids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    b.nom,
    b.reference,
    parseInt(b.quantite || 0, 10),
    b.localisation || null,
    parseFloat(b.prix || 0),
    parseInt(b.seuil_alert || 5, 10),
    b.solidworks_link || null,
    glbPath,
    b.dimensions || null,
    parseFloat(b.poids || 0),
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT * FROM machines WHERE id = ?", [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.status(201).json(mapMachine(row));
    });
  });
});

// UPDATE
router.put("/:id", requireAuth, upload.single("glb_file"), (req, res) => {
  const b = req.body;
  const id = req.params.id;

  const set = [
    "nom = ?",
    "reference = ?",
    "quantite = ?",
    "localisation = ?",
    "prix = ?",
    "seuil_alert = ?",
    "solidworks_link = ?",
    "dimensions = ?",
    "poids = ?",
  ];

  const params = [
    b.nom,
    b.reference,
    parseInt(b.quantite || 0, 10),
    b.localisation || null,
    parseFloat(b.prix || 0),
    parseInt(b.seuil_alert || 5, 10),
    b.solidworks_link || null,
    b.dimensions || null,
    parseFloat(b.poids || 0),
  ];

  if (req.file) {
    set.push("glb_path = ?");
    params.push(`/uploads/machines/${req.file.filename}`);
  }

  params.push(id);

  db.run(
    `UPDATE machines SET ${set.join(", ")} WHERE id = ?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get("SELECT * FROM machines WHERE id = ?", [id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(mapMachine(row));
      });
    }
  );
});

// DELETE
router.delete("/:id", requireAuth, (req, res) => {
  db.run("DELETE FROM machines WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// FILES
router.get("/:machineId/files", requireAuth, (req, res) => {
  db.all(
    "SELECT id, filename, filepath AS path, file_type, uploaded_at FROM machine_files WHERE machine_id = ? ORDER BY uploaded_at DESC",
    [req.params.machineId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// MAINTENANCE LIST
router.get("/:machineId/maintenances", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM machine_maintenances WHERE machine_id = ? ORDER BY date_maintenance DESC, id DESC",
    [req.params.machineId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// MAINTENANCE CREATE
router.post(
  "/:machineId/maintenances",
  requireAuth,
  express.json(),
  (req, res) => {
    const mid = req.params.machineId;
    const b = req.body || {};
    const titre = b.titre || b.type || "Maintenance";
    const description = b.description || b.notes || null;
    const date_maintenance =
      b.date_maintenance || b.date || new Date().toISOString().slice(0, 10);
    const statut = b.statut || "planifie";

    db.run(
      "INSERT INTO machine_maintenances (machine_id, titre, description, date_maintenance, statut) VALUES (?, ?, ?, ?, ?)",
      [mid, titre, description, date_maintenance, statut],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(
          "SELECT * FROM machine_maintenances WHERE id = ?",
          [this.lastID],
          (e, row) => {
            if (e) return res.status(500).json({ error: e.message });
            res.status(201).json(row);
          }
        );
      }
    );
  }
);

// MAINTENANCE UPDATE
router.put(
  "/:machineId/maintenances/:id",
  requireAuth,
  express.json(),
  (req, res) => {
    const { machineId, id } = req.params;
    const b = req.body || {};
    const fields = [];
    const params = [];

    if (b.titre || b.type) {
      fields.push("titre = ?");
      params.push(b.titre || b.type);
    }
    if (b.description || b.notes) {
      fields.push("description = ?");
      params.push(b.description || b.notes);
    }
    if (b.date_maintenance || b.date) {
      fields.push("date_maintenance = ?");
      params.push(b.date_maintenance || b.date);
    }
    if (b.statut) {
      fields.push("statut = ?");
      params.push(b.statut);
    }

    if (!fields.length) {
      return res.status(400).json({ error: "Aucune mise à jour" });
    }

    params.push(machineId, id);

    db.run(
      `UPDATE machine_maintenances SET ${fields.join(
        ", "
      )} WHERE machine_id = ? AND id = ?`,
      params,
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(
          "SELECT * FROM machine_maintenances WHERE machine_id = ? AND id = ?",
          [machineId, id],
          (e, row) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json(row);
          }
        );
      }
    );
  }
);

// MAINTENANCE DELETE
router.delete("/:machineId/maintenances/:id", requireAuth, (req, res) => {
  db.run(
    "DELETE FROM machine_maintenances WHERE machine_id = ? AND id = ?",
    [req.params.machineId, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

module.exports = router;
