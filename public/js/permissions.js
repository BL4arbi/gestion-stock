// Initialise userPermissions en global
window.userPermissions = {
  canEdit: false,
  canEditPrices: false,
  canDelete: false,
  canAddRemoveStock: false,
  canViewOnly: true,
  role: 'viewer'
};

async function loadPermissions() {
  try {
    const response = await fetch(`${window.location.origin}/api/auth/permissions`, {
      credentials: "include"
    });
    if (response.ok) {
      const data = await response.json();
      window.userPermissions = data.permissions;
      window.userPermissions.role = data.role;
      updateUIBasedOnPermissions();
      return data;
    }
  } catch (error) {
    console.error("Erreur chargement permissions:", error);
  }
  return null;
}

function updateUIBasedOnPermissions() {
  console.log("Permissions chargées:", window.userPermissions);

  // Cache les formulaires d'ajout pour les visiteurs
  if (window.userPermissions.canViewOnly) {
    document.querySelectorAll('.add-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('form').forEach(el => {
      if (!el.id.includes('login')) el.style.display = 'none';
    });
  }

  // Cache les boutons de suppression sauf pour admin
  if (!window.userPermissions.canDelete) {
    document.querySelectorAll('.btn-delete, .delete, button[onclick*="delete"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Désactive les champs prix sauf pour admin
  if (!window.userPermissions.canEditPrices) {
    document.querySelectorAll('input[id*="prix"], input[placeholder*="Prix"]').forEach(el => {
      el.disabled = true;
      el.style.opacity = '0.5';
      el.style.cursor = 'not-allowed';
      el.title = 'Seul l\'admin peut modifier les prix';
    });
  }

  // Cache les boutons d'édition pour les visiteurs
  if (!window.userPermissions.canEdit) {
    document.querySelectorAll('button[onclick*="Edit"], .btn-edit').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Ajoute un badge de rôle
  const userSpan = document.getElementById('current-user');
  if (userSpan && !userSpan.querySelector('.role-badge')) {
    const roleBadges = {
      admin: '<span class="role-badge" style="background:#10b981;color:white;padding:3px 8px;border-radius:12px;font-size:0.75em;margin-left:8px;font-weight:600;">👑 ADMIN</span>',
      operator: '<span class="role-badge" style="background:#f59e0b;color:white;padding:3px 8px;border-radius:12px;font-size:0.75em;margin-left:8px;font-weight:600;">🔧 OPÉRATEUR</span>',
      viewer: '<span class="role-badge" style="background:#6b7280;color:white;padding:3px 8px;border-radius:12px;font-size:0.75em;margin-left:8px;font-weight:600;">👁️ VISITEUR</span>'
    };
    const username = userSpan.textContent.trim();
    userSpan.innerHTML = username + (roleBadges[window.userPermissions.role] || '');
  }

  // Cache le lien "Utilisateurs" sauf pour admin
  if (window.userPermissions.role !== 'admin') {
    document.querySelectorAll('a[href*="users.html"]').forEach(el => el.style.display = 'none');
  }
}

function canPerformAction(action) {
  switch(action) {
    case 'edit': return window.userPermissions.canEdit;
    case 'delete': return window.userPermissions.canDelete;
    case 'editPrice': return window.userPermissions.canEditPrices;
    case 'addRemove': return window.userPermissions.canAddRemoveStock;
    default: return false;
  }
}