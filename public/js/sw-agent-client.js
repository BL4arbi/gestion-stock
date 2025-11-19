// sw-agent-client.js - Client pour communiquer avec l'agent local SolidWorks
(() => {
  const Agent = {
    baseURL: "http://127.0.0.1:3001",
    token: "mon-token-secret-2025",
    online: false,

    async ping() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // 3 sec max

        const r = await fetch(`${this.baseURL}/status?t=${Date.now()}`, {
          headers: {
            "X-Token": this.token,
            Authorization: `Bearer ${this.token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          console.log("✅ Agent ping OK:", data);
          this.online = true;
        } else {
          console.warn("⚠️ Agent ping refusé:", r.status);
          this.online = false;
        }
      } catch (e) {
        console.warn("⚠️ Agent ping échoué:", e.message);
        this.online = false;
      }

      window.dispatchEvent(
        new CustomEvent(this.online ? "sw-agent:online" : "sw-agent:offline")
      );
      return this.online;
    },

    async open(filePath) {
      if (!filePath) throw new Error("Chemin vide");

      console.log("🔧 Tentative ouverture:", filePath);
      console.log("🔑 Token:", this.token);

      // POST /open
      try {
        const r = await fetch(`${this.baseURL}/open`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Token": this.token,
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ path: filePath }),
        });

        if (r.ok) {
          const data = await r.json().catch(() => ({ success: true }));
          console.log("✅ Succès POST:", data);
          return data;
        }

        const txt = await r.text().catch(() => "");
        console.error("❌ POST refusé:", r.status, txt);
      } catch (e) {
        console.error("❌ POST erreur:", e.message);
      }

      // GET /open (fallback)
      try {
        const url = `${this.baseURL}/open?path=${encodeURIComponent(
          filePath
        )}&token=${encodeURIComponent(this.token)}`;
        const r = await fetch(url, {
          headers: {
            "X-Token": this.token,
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (r.ok) {
          const data = await r.json().catch(() => ({ success: true }));
          console.log("✅ Succès GET:", data);
          return data;
        }

        const txt = await r.text().catch(() => "");
        throw new Error(`Refus ${r.status}: ${txt.slice(0, 80)}`);
      } catch (e) {
        throw new Error(`Impossible: ${e.message}`);
      }
    },

    setToken(tok) {
      this.token = tok;
      localStorage.setItem("swAgentToken", tok);
      console.log("🔑 Token mis à jour:", tok);
      this.ping();
    },
  };

  window.SWAgent = Agent;

  // Force le bon token au démarrage
  const saved = localStorage.getItem("swAgentToken");
  if (!saved || saved !== "mon-token-secret-2025") {
    localStorage.setItem("swAgentToken", "mon-token-secret-2025");
    Agent.token = "mon-token-secret-2025";
  }

  // Premier ping immédiat
  Agent.ping();

  // Puis toutes les 8 secondes
  setInterval(() => Agent.ping(), 8000);
})();
