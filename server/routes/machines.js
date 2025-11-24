const express = require("express");
const router = express.Router();
const db = require("../database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuration Multer pour l'upload de fichiers GLB
const uploadsDir = path.join(__dirname, "..", "..", "public", "uploads");

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Dossier uploads créé:", uploadsDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".glb", ".gltf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé. Utilisez .glb ou .gltf"));
    }
  },
});

// =================== GET toutes les machines ===================
router.get("/", async (req, res) => {
  try {
    db.all("SELECT * FROM machines ORDER BY nom", (err, rows) => {
      if (err) {
        console.error("❌ Erreur lecture machines:", err);
        return res.status(500).json({ error: err.message });
      }

      // Transformer glb_path en glb_file pour le frontend
      const machines = rows.map((m) => ({
        ...m,
        glb_file: m.glb_path || null,
      }));

      console.log(`✅ ${machines.length} machines chargées`);
      res.json(machines);
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== GET une machine ===================
router.get("/:id", async (req, res) => {
  try {
    db.get("SELECT * FROM machines WHERE id = ?", [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: "Machine introuvable" });
      }

      // Transformer glb_path en glb_file
      const machine = {
        ...row,
        glb_file: row.glb_path || null,
      };

      res.json(machine);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================== POST créer une machine ===================
router.post("/", upload.single("glb_file"), async (req, res) => {
  try {
    console.log("📥 Création machine:", req.body);
    console.log("📁 Fichier uploadé:", req.file);

    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      dimensions,
      poids,
      solidworks_link,
    } = req.body;

    // Construire le chemin du fichier GLB
    const glb_path = req.file ? `/uploads/${req.file.filename}` : null;

    console.log("💾 Chemin GLB:", glb_path);

    db.run(
      `INSERT INTO machines (nom, reference, quantite, localisation, prix, seuil_alert, dimensions, poids, glb_path, solidworks_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nom,
        reference,
        quantite || 1,
        localisation || null,
        prix || 0,
        seuil_alert || 5,
        dimensions || null,
        poids || 0,
        glb_path,
        solidworks_link || null,
      ],
      function (err) {
        if (err) {
          console.error("❌ Erreur insertion:", err);
          return res.status(500).json({ error: err.message });
        }

        console.log("✅ Machine créée avec ID:", this.lastID);

        res.status(201).json({
          id: this.lastID,
          nom,
          reference,
          quantite,
          localisation,
          prix,
          seuil_alert,
          dimensions,
          poids,
          glb_file: glb_path, // ← Retourner glb_file
          solidworks_link,
        });
      }
    );
  } catch (error) {
    console.error("❌ Erreur création machine:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== PUT modifier une machine ===================
router.put("/:id", upload.single("glb_file"), async (req, res) => {
  try {
    console.log("📝 Modification machine ID:", req.params.id);
    console.log("📥 Données:", req.body);
    console.log("📁 Nouveau fichier:", req.file);

    const {
      nom,
      reference,
      quantite,
      localisation,
      prix,
      seuil_alert,
      dimensions,
      poids,
      solidworks_link,
    } = req.body;

    // Récupérer l'ancienne machine pour conserver glb_path si pas de nouveau fichier
    db.get(
      "SELECT glb_path FROM machines WHERE id = ?",
      [req.params.id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const glb_path = req.file
          ? `/uploads/${req.file.filename}`
          : row?.glb_path || null;

        console.log("💾 Chemin GLB (update):", glb_path);

        db.run(
          `UPDATE machines SET nom = ?, reference = ?, quantite = ?, localisation = ?, prix = ?, seuil_alert = ?, dimensions = ?, poids = ?, glb_path = ?, solidworks_link = ? WHERE id = ?`,
          [
            nom,
            reference,
            quantite || 1,
            localisation || null,
            prix || 0,
            seuil_alert || 5,
            dimensions || null,
            poids || 0,
            glb_path,
            solidworks_link || null,
            req.params.id,
          ],
          function (err) {
            if (err) {
              console.error("❌ Erreur modification:", err);
              return res.status(500).json({ error: err.message });
            }

            console.log("✅ Machine modifiée");

            res.json({
              id: req.params.id,
              nom,
              reference,
              quantite,
              localisation,
              prix,
              seuil_alert,
              dimensions,
              poids,
              glb_file: glb_path,
              solidworks_link,
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("❌ Erreur modification machine:", error);
    res.status(500).json({ error: error.message });
  }
});

// =================== DELETE supprimer une machine ===================
router.delete("/:id", async (req, res) => {
  try {
    // Récupérer le fichier GLB pour le supprimer
    db.get(
      "SELECT glb_path FROM machines WHERE id = ?",
      [req.params.id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Supprimer le fichier physique
        if (row?.glb_path) {
          const filePath = path.join(__dirname, "..", "..", "public", row.glb_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🗑️ Fichier GLB supprimé:", filePath);
          }
        }

        // Supprimer la machine de la DB
        db.run("DELETE FROM machines WHERE id = ?", [req.params.id], function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          console.log("✅ Machine supprimée");
          res.json({ message: "Machine supprimée" });
        });
      }
    );
  } catch (error) {
    console.error("❌ Erreur suppression machine:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
