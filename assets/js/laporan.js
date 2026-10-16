// ============================================================
// DATA LAPORAN ME - List
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('laporan.html');
  await loadLaporan();
});

async function loadLaporan() {
  const tbody = document.getElementById('tbodyLaporan');

  const { data, error } = await db
    .from('laporan_me')
    .select(`
      id, no_laporan, tgl_temuan, nama_pasien, no_rm, grade, status, created_at,
      ruangan:ruangan_id(nama_ruangan),
      petugas:petugas_id(nama)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuat data: ${error.message}</td></tr>`;
    return;
  }

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">Belum ada laporan ME</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(l => `
    <tr>
      <td><code>${escapeHtml(l.no_laporan)}</code></td>
      <td>${formatTanggal(l.tgl_temuan)}</td>
      <td>
        <b>${escapeHtml(l.nama_pasien)}</b><br>
        <small class="text-muted">RM: ${escapeHtml(l.no_rm)}</small>
      </td>
      <td>${escapeHtml(l.ruangan?.nama_ruangan || '-')}</td>
      <td><span class="badge ${gradeBadgeClass(l.grade)}">${l.grade || '-'}</span></td>
      <td><span class="badge ${statusBadgeClass(l.status)}">${statusLabel(l.status)}</span></td>
      <td>${escapeHtml(l.petugas?.nama || '-')}</td>
      <td>
        <button class="btn-icon" title="Detail" onclick="alert('Fitur detail akan tersedia di Tahap 7')">👁️</button>
      </td>
    </tr>
  `).join('');
}
