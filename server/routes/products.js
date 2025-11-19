const express = require("express");
const router = express.Router();
const db = require("../database");

// Middleware auth
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  next();
}

function checkPermission(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    const roles = { viewer: 1, operator: 2, admin: 3 };
    if (roles[req.session.user.role] >= roles[role]) {
      next();
    } else {
      res.status(403).json({ error: "Permission insuffisante" });
    }
  };
}

// GET tous les produits
router.get("/", requireAuth, (req, res) => {
  const { category } = req.query;
  let query = "SELECT * FROM products";
  let params = [];

  if (category) {
    query += " WHERE category = ?";
    params.push(category);
  }

  query += " ORDER BY created_at DESC";
  console.log(`📥 GET /api/products${category ? "?category=" + category : ""}`);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("❌ GET products:", err);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✅ Retourne ${rows.length} produits`);
    res.json(rows);
  });
});

// GET un produit par ID
router.get("/:id", requireAuth, (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Produit non trouvé" });
    res.json(row);
  });
});

// POST créer un produit
router.post("/", requireAuth, checkPermission("operator"), (req, res) => {
  console.log("📥 POST /api/products:", req.body);

  const {
    nom,
    reference,
    quantite,
    unite,
    localisation,
    prix,
    seuil_alert,
    category,
    notes,
  } = req.body;

  if (!nom) {
    console.error("❌ Nom manquant");
    return res.status(400).json({ error: "Le nom est requis" });
  }

  if (!category || !["visserie", "epi", "base"].includes(category)) {
    console.error("❌ Catégorie invalide:", category);
    return res
      .status(400)
      .json({ error: "Catégorie invalide (visserie, epi ou base)" });
  }

  const query = `
    INSERT INTO products (nom, reference, quantite, unite, localisation, prix, seuil_alert, category, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    nom,
    reference || "",
    parseInt(quantite) || 0,
    unite || "pièce",
    localisation || "",
    parseFloat(prix) || 0,
    parseInt(seuil_alert) || 10,
    category,
    notes || "",
  ];

  console.log("📝 Insertion:", values);

  db.run(query, values, function (err) {
    if (err) {
      console.error("❌ INSERT product:", err);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ Produit créé avec ID: ${this.lastID}`);

    db.get("SELECT * FROM products WHERE id = ?", [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(row);
    });
  });
});

// PUT modifier un produit
router.put("/:id", requireAuth, checkPermission("operator"), (req, res) => {
  const {
    nom,
    reference,
    quantite,
    unite,
    localisation,
    prix,
    seuil_alert,
    category,
    notes,
  } = req.body;

  const query = `
    UPDATE products 
    SET nom=?, reference=?, quantite=?, unite=?, localisation=?, prix=?, seuil_alert=?, category=?, notes=?
    WHERE id=?
  `;

  db.run(
    query,
    [
      nom,
      reference,
      quantite,
      unite,
      localisation,
      prix,
      seuil_alert,
      category,
      notes,
      req.params.id,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Produit non trouvé" });

      db.get(
        "SELECT * FROM products WHERE id = ?",
        [req.params.id],
        (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(row);
        }
      );
    }
  );
});

// DELETE supprimer un produit
router.delete("/:id", requireAuth, checkPermission("admin"), (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "Produit non trouvé" });
    res.json({ message: "Produit supprimé", id: req.params.id });
  });
});

module.exports = router;
