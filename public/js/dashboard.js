document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    // Charger toutes les données
    const [visserie, epi, machines] = await Promise.all([
      fetch('/api/visserie').then(r => r.json()),
      fetch('/api/epi').then(r => r.json()),
      fetch('/api/machines').then(r => r.json())
    ]);

    // Statistiques globales
    const totalStock = visserie.length + epi.length;
    const alertsCount = [...visserie, ...epi].filter(item => 
      item.quantite <= (item.seuil_alert || 10)
    ).length;
    
    const totalValue = [...visserie, ...epi].reduce((sum, item) => 
      sum + ((item.prix || 0) * item.quantite), 0
    );

    // Mettre à jour les stats
    document.getElementById('total-stock').textContent = totalStock;
    document.getElementById('alerts-count').textContent = alertsCount;
    document.getElementById('total-machines').textContent = machines.length;
    document.getElementById('total-value').textContent = 
      totalValue.toLocaleString('fr-FR') + '€';

    // Stats par catégorie
    document.getElementById('visserie-count').textContent = visserie.length;
    document.getElementById('epi-count').textContent = epi.length;
    document.getElementById('base-count').textContent = '0'; // À implémenter

    // Alertes stock faible
    displayLowStock([...visserie, ...epi]);

    // Machines récentes
    displayRecentMachines(machines);

    // Activité récente (simulée pour l'instant)
    displayRecentActivity();

  } catch (error) {
    console.error('Erreur chargement dashboard:', error);
  }
}

function displayLowStock(items) {
  const container = document.getElementById('low-stock-list');
  const lowStock = items
    .filter(item => item.quantite <= (item.seuil_alert || 10))
    .slice(0, 5);

  if (lowStock.length === 0) {
    container.innerHTML = '<div class="empty-state">✅ Aucune alerte</div>';
    return;
  }

  container.innerHTML = lowStock.map(item => `
    <div class="alert-item">
      <div>
        <span class="alert-name">${item.nom}</span>
        <div style="font-size: 0.85em; color: #6b7280;">
          ${item.localisation || 'Sans localisation'}
        </div>
      </div>
      <div class="alert-stock">
        ${item.quantite} / ${item.seuil_alert || 10}
      </div>
    </div>
  `).join('');
}

function displayRecentMachines(machines) {
  const container = document.getElementById('recent-machines-list');
  
  // ✅ Récupérer la dernière machine consultée
  const lastViewed = JSON.parse(localStorage.getItem('lastViewedMachine') || 'null');

  if (!lastViewed) {
    container.innerHTML = '<div class="empty-state">Aucune machine récemment consultée</div>';
    return;
  }

  // Calculer le temps écoulé
  const timeAgo = getTimeAgo(new Date(lastViewed.timestamp));

  container.innerHTML = `
    <div class="machine-item" onclick="window.location.href='/machines.html'" style="cursor: pointer;">
      <div class="machine-icon">🤖</div>
      <div class="machine-info">
        <span class="machine-name">${lastViewed.nom}</span>
        <span class="machine-ref">
          Réf: ${lastViewed.reference || 'N/A'} • ${lastViewed.localisation || 'Sans localisation'}
        </span>
      </div>
      <span class="activity-time">${timeAgo}</span>
    </div>
    <div style="text-align: center; padding: 10px;">
      <a href="/machines.html" style="color: #3b82f6; text-decoration: none; font-size: 0.9em;">
        Voir toutes les machines →
      </a>
    </div>
  `;
}

// Fonction pour afficher "Il y a X temps"
function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // secondes

  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString('fr-FR');
}

function displayRecentActivity() {
  const container = document.getElementById('recent-activity');
  
  // Activité simulée (à remplacer par vraie BDD d'historique)
  const activities = [
    { icon: '➕', text: 'Ajout de 50 Vis M8', time: 'Il y a 2h' },
    { icon: '🤖', text: 'Machine Tour CNC ajoutée', time: 'Il y a 5h' },
    { icon: '⚠️', text: 'Alerte stock EPI Casque', time: 'Il y a 1j' },
    { icon: '✏️', text: 'Modification stock Visserie', time: 'Il y a 2j' }
  ];

  container.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <span class="activity-icon">${activity.icon}</span>
      <span class="activity-text">${activity.text}</span>
      <span class="activity-time">${activity.time}</span>
    </div>
  `).join('');
}

function logout() {
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}