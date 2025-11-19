const express = require("express");
const router = express.Router();
const db = require("../database");
const requireAuth = (req,res,next)=> req.session.user ? next() : res.status(401).json({error:"Non authentifié"});

router.get("/stats", requireAuth, (req,res)=>{
  const out = {};
  db.serialize(()=>{
    db.get("SELECT COUNT(*) AS c FROM products", (_,r)=> out.total_products = r?.c||0);
    db.get("SELECT COUNT(*) AS c FROM products WHERE quantite <= seuil_alert", (_,r)=> out.low_stock = r?.c||0);
    db.get("SELECT COUNT(*) AS c FROM machines", (_,r)=> out.machines = r?.c||0);
    db.all("SELECT category, COUNT(*) AS count FROM products GROUP BY category", (_,rows)=>{
      out.by_category = rows||[];
      res.json(out);
    });
  });
});

module.exports = router;