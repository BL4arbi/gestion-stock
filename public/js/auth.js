console.log("✅ auth.js chargé");

// Variable globale
window.authChecked = false;
window.currentUser = null;

// Vérifier l'authentification
async function checkAuth() {
  try {
    const response = await fetch("/api/auth/check", {
      credentials: "include",
    });

    if (!response.ok) {
      // Pas authentifié
      if (!window.location.pathname.includes("login.html")) {
        console.log("❌ Non authentifié, redirection...");
        window.location.href = "/login.html";
      }
      return false;
    }

    const data = await response.json();
    window.currentUser = data.user;
    window.authChecked = true;

    console.log("✅ Utilisateur authentifié:", window.currentUser);

    // Mettre à jour l'affichage utilisateur
    const userSpan = document.getElementById("current-user");
    if (userSpan) {
      userSpan.textContent = window.currentUser.username;
    }

    return true;
  } catch (error) {
    console.error("❌ Erreur vérification auth:", error);
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "/login.html";
    }
    return false;
  }
}

// Fonction de déconnexion
async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login.html";
  } catch (error) {
    console.error("❌ Erreur logout:", error);
    window.location.href = "/login.html";
  }
}

// ✅ VÉRIFIER IMMÉDIATEMENT au chargement
if (!window.location.pathname.includes("login.html")) {
  checkAuth();
}
