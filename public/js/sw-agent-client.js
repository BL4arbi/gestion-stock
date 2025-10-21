// sw-agent-client.js - Client pour communiquer avec l'agent local SolidWorks
(function () {
  const AGENT_URL = "http://localhost:3001"; // ✅ Changé de 5050 à 3001
  const TOKEN = "mon-token-secret-2025"; // ✅ Ton token

  class SolidWorksAgent {
    constructor() {
      this.baseUrl = AGENT_URL;
      this.token = TOKEN;
      this.connected = false;
      this.init();
    }

    async init() {
      try {
        const response = await fetch(`${this.baseUrl}/health`, {
          method: "GET",
          mode: "cors",
        });

        if (response.ok) {
          this.connected = true;
          console.log("✅ Agent SolidWorks connecté sur", this.baseUrl);
        }
      } catch (error) {
        console.warn("⚠️ Agent SolidWorks non disponible:", error.message);
        this.connected = false;
      }
    }

    async openFile(filePath) {
      if (!this.connected) {
        throw new Error(
          "Agent SolidWorks non connecté. Assurez-vous que l'agent local tourne sur http://localhost:3001"
        );
      }

      try {
        console.log("📤 Envoi requête ouverture:", filePath);

        const response = await fetch(`${this.baseUrl}/open`, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filePath,
            token: this.token,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Erreur ouverture fichier");
        }

        const result = await response.json();
        console.log("✅ Réponse agent:", result);
        return result;
      } catch (error) {
        console.error("❌ Erreur openFile:", error);
        throw error;
      }
    }

    async checkStatus() {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        return response.ok;
      } catch {
        return false;
      }
    }
  }

  // Créer l'instance globale
  window.SW_AGENT = new SolidWorksAgent();
  console.log("🔧 SW_AGENT initialisé");
})();
