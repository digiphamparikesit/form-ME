// ============================================================
// UTILITY HELPER
// ============================================================

/** Format tanggal Indonesia: 2026-01-15 → 15 Januari 2026 */
function formatTanggal(iso) {
  if (!iso) return '-';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(iso);
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format jam: 14:30:00 → 14:30 */
function formatJam(jam) {
  if (!jam) return '-';
  return jam.substring(0, 5);
}

/** Format datetime lengkap */
function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${formatTanggal(d)} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

/** Escape HTML untuk cegah XSS */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

/** Badge warna untuk grade A–I */
function gradeBadgeClass(kode) {
  if (!kode) return 'badge-secondary';
  if (kode === 'A') return 'badge-info';       // KPC
  if (['B','C'].includes(kode)) return 'badge-success'; // KNC/KTC
  if (kode === 'D') return 'badge-warning';    // KTC monitoring
  if (['E','F'].includes(kode)) return 'badge-orange';  // KTD
  if (['G','H','I'].includes(kode)) return 'badge-danger'; // SENTINEL
  return 'badge-secondary';
}

/** Badge warna untuk status laporan */
function statusBadgeClass(status) {
  const map = {
    draft: 'badge-secondary',
    pending: 'badge-warning',
    verified: 'badge-success',
    rejected: 'badge-danger'
  };
  return map[status] || 'badge-secondary';
}

/** Label status dalam bahasa Indonesia */
function statusLabel(status) {
  const map = {
    draft: 'Draft',
    pending: 'Menunggu Verifikasi',
    verified: 'Terverifikasi',
    rejected: 'Ditolak'
  };
  return map[status] || status;
}
