// ============================================================
// LAYOUT HELPER - Sidebar & Topbar reusable (MOBILE OPTIMIZED)
// ============================================================

const MENU_ITEMS = [
  { href: 'dashboard.html',    icon: '📊', label: 'Dashboard',         roles: ['admin','petugas','pj'] },
  { href: 'input-me.html',     icon: '📝', label: 'Input ME',          roles: ['admin','petugas','pj'] },
  { href: 'laporan.html',      icon: '📄', label: 'Data Laporan',      roles: ['admin','petugas','pj'] },
  { href: 'laporan-bulanan.html', icon: '📊', label: 'Laporan Bulanan', roles: ['admin','petugas','pj'] },
  { href: 'verifikasi.html',   icon: '✅', label: 'Verifikasi',        roles: ['admin','pj'] },
  { href: 'cetak-pdf.html',    icon: '🖨️', label: 'Cetak PDF',        roles: ['admin','petugas','pj'] },
  { href: 'master-petugas.html', icon: '👥', label: 'Master Petugas',  roles: ['admin'] },
  { href: 'master-ruangan.html', icon: '🏥', label: 'Master Ruangan', roles: ['admin'] }
];

async function renderLayout(activePage) {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getCurrentProfile();
  if (!profile) {
    alert('Profil tidak ditemukan. Hubungi administrator.');
    await logout();
    return;
  }

  const activeHref = activePage || location.pathname.split('/').pop();

  // --- SIDEBAR OVERLAY (mobile) ---
  if (!document.getElementById('sidebarOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);
  }

  // --- SIDEBAR ---
  const sidebarEl = document.getElementById('app-sidebar');
  if (sidebarEl) {
    const menuHtml = MENU_ITEMS
      .filter(m => m.roles.includes(profile.role))
      .map(m => `
        <a href="${m.href}" class="sidebar-item ${m.href === activeHref ? 'active' : ''}">
          <span class="sidebar-icon">${m.icon}</span>
          <span class="sidebar-label">${m.label}</span>
        </a>
      `).join('');

    sidebarEl.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="assets/img/logo-rsud.png" alt="Logo" onerror="this.style.display='none'">
          <div class="brand-text">
            <strong>RSUD AM PARIKESIT</strong>
            <small>Monitoring ME</small>
          </div>
        </div>
        <nav class="sidebar-menu">${menuHtml}</nav>
        <div class="sidebar-footer">
          <small>v1.0 &copy; 2026</small>
        </div>
      </aside>
    `;
  }

  // --- TOPBAR ---
  const topbarEl = document.getElementById('app-topbar');
  if (topbarEl) {
    topbarEl.innerHTML = `
      <header class="topbar">
        <div class="topbar-left">
          <button class="btn-hamburger" id="btnHamburger" aria-label="Menu">☰</button>
          <h2>${document.title.split('|')[0].trim()}</h2>
        </div>
        <div class="topbar-right">
          <div class="user-info">
            <div class="user-avatar">${(profile.nama || '?').charAt(0).toUpperCase()}</div>
            <div class="user-detail">
              <strong>${profile.nama}</strong>
              <small>${roleLabel(profile.role)}${profile.ruangan?.nama_ruangan ? ' • ' + profile.ruangan.nama_ruangan : ''}</small>
            </div>
          </div>
          <button id="btnLogout" class="btn btn-outline-danger btn-sm">Keluar</button>
        </div>
      </header>
    `;

    document.getElementById('btnLogout').addEventListener('click', async () => {
      if (confirm('Yakin ingin keluar dari aplikasi?')) {
        await logout();
      }
    });

    // Hamburger toggle
    document.getElementById('btnHamburger').addEventListener('click', toggleSidebar);
  }

  // Close sidebar otomatis kalau link diklik (mobile)
  sidebarEl?.querySelectorAll('.sidebar-item').forEach(el => {
    el.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Handle ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // Handle resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });
}

// ============================================================
// SIDEBAR TOGGLE (mobile)
// ============================================================
function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  const isOpen = sidebar.classList.contains('sidebar-open');
  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('sidebar-open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  sidebar.classList.remove('sidebar-open');
  overlay?.classList.remove('active');
  document.body.style.overflow = '';
}
