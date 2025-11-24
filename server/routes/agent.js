const express = require("express");
const router = express.Router();
const fetch = require("node-fetch"); // Ajoutez cette dépendance si nécessaire

// Configuration de l'agent SolidWorks
const AGENT_URL = "http://127.0.0.1:3001";
const AGENT_TOKEN = "mon-token-secret-2025";

// Map pour stocker les agents connectés
const connectedAgents = new Map();

// Vérifier le statut de l'agent
router.get("/status", async (req, res) => {
  try {
    // Vérifier si l'agent externe répond
    const response = await fetch(`${AGENT_URL}/status?token=${AGENT_TOKEN}`, {
      timeout: 3000,
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        connected: true,
        agent: data,
        url: AGENT_URL,
      });
    } else {
      throw new Error("Agent non accessible");
    }
  } catch (error) {
    console.error("❌ Agent SolidWorks non disponible:", error.message);
    res.json({
      connected: false,
      error: "Agent SolidWorks non connecté",
    });
  }
});

// Enregistrer un agent
router.post("/register", (req, res) => {
  const { agentId, hostname } = req.body;

  connectedAgents.set(agentId, {
    hostname,
    lastSeen: Date.now(),
  });

  console.log(`✅ Agent connecté: ${agentId} (${hostname})`);

  res.json({ success: true, message: "Agent enregistré" });
});

// Heartbeat de l'agent
router.post("/heartbeat", (req, res) => {
  const { agentId } = req.body;

  if (connectedAgents.has(agentId)) {
    connectedAgents.set(agentId, {
      ...connectedAgents.get(agentId),
      lastSeen: Date.now(),
    });
  }

  res.json({ success: true });
});

// Ouvrir un fichier SolidWorks via l'agent
router.post("/open-solidworks", async (req, res) => {
  try {
    const { filePath, machineId } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "Chemin de fichier manquant" });
    }

    console.log(`📤 Envoi commande à l'agent SolidWorks:`);
    console.log(`   Fichier: ${filePath}`);
    console.log(`   Machine ID: ${machineId}`);

    // Envoyer la commande à l'agent
    const response = await fetch(`${AGENT_URL}/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Token": AGENT_TOKEN,
      },
      body: JSON.stringify({ path: filePath }),
      timeout: 10000,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur agent");
    }

    const result = await response.json();

    console.log("✅ Fichier ouvert dans SolidWorks:", result);

    res.json({
      success: true,
      message: "Fichier ouvert dans SolidWorks",
      details: result,
    });
  } catch (error) {
    console.error("❌ Erreur ouverture SolidWorks:", error);
    res.status(500).json({
      error: error.message || "Impossible de contacter l'agent SolidWorks",
      details: "Vérifiez que l'agent est bien lancé sur le poste",
    });
  }
});

// Nettoyer les agents inactifs (toutes les 60 secondes)
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 60 secondes

  for (const [agentId, agentData] of connectedAgents.entries()) {
    if (now - agentData.lastSeen > timeout) {
      console.log(`❌ Agent déconnecté (timeout): ${agentId}`);
      connectedAgents.delete(agentId);
    }
  }
}, 60000);

module.exports = router;
