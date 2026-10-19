// ============================================================
// DATA LAPORAN ME - List & Detail
// ============================================================

let allLaporan = [];

document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('laporan.html');
  await loadLaporan();
  
  // Event listener untuk tutup modal
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetail);
  document.getElementById('modalDetail').addEventListener('click', (e) => {
    if (e.target.id === 'modalDetail') closeDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });
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

  allLaporan = data;

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
        <button class="btn-icon" title="Detail" onclick="openDetail('${l.id}')">👁️</button>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// DETAIL MODAL
// ============================================================
async function openDetail(id) {
  const laporan = allLaporan.find(l => l.id === id);
  if (!laporan) return;

  document.getElementById('detailTitle').textContent = `Laporan ${laporan.no_laporan}`;
  document.getElementById('detailBody').innerHTML = '<p class="text-center">Memuat detail...</p>';
  document.getElementById('detailFooter').innerHTML = '';
  document.getElementById('modalDetail').style.display = 'flex';

  // Load detail lengkap + items
  const [detailRes, itemsRes, gradeRes] = await Promise.all([
    db.from('laporan_me')
      .select(`
        *,
        ruangan:ruangan_id(nama_ruangan),
        petugas:petugas_id(nama, profesi),
        verifikator:verified_by(nama)
      `)
      .eq('id', id)
      .single(),
    db.from('laporan_me_detail')
      .select(`
        catatan_lain,
        item:item_monitoring_id(id, tahap, nama_item, urutan)
      `)
      .eq('laporan_id', id),
    db.from('grade_insiden').select('kode, kategori, deskripsi')
  ]);

  if (detailRes.error) {
    document.getElementById('detailBody').innerHTML =
      `<p class="text-danger">Gagal memuat: ${detailRes.error.message}</p>`;
    return;
  }

  const d = detailRes.data;
  const items = itemsRes.data || [];
  const grades = gradeRes.data || [];
  const selectedGrade = grades.find(g => g.kode === d.grade);

  // Kelompokkan items per tahap
  const grouped = { prescribing: [], transcribing: [], dispensing: [], administering: [] };
  items.forEach(it => {
    if (it.item && grouped[it.item.tahap]) {
      grouped[it.item.tahap].push(it);
    }
  });

  const tahapLabel = {
    prescribing: '💊 Prescribing Error',
    transcribing: '📝 Transcribing Error',
    dispensing: '📦 Dispensing Error',
    administering: '💉 Administering Error'
  };

  let itemsHtml = '';
  Object.keys(grouped).forEach(tahap => {
    if (!grouped[tahap].length) return;
    itemsHtml += `
      <div class="review-section">
        <h5>${tahapLabel[tahap]} (${grouped[tahap].length} item)</h5>
        <ul>
          ${grouped[tahap].map(it => `
            <li>
              ${escapeHtml(it.item.nama_item)}
              ${it.catatan_lain ? `<b>: ${escapeHtml(it.catatan_lain)}</b>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  });

  document.getElementById('detailBody').innerHTML = `
    <div class="review-block">
      <h4>📋 Data Kejadian</h4>
      <table class="review-table">
        <tr><td>Tgl Temuan</td><td>: <b>${formatTanggal(d.tgl_temuan)} ${d.jam_temuan || ''}</b></td></tr>
        <tr><td>Tgl Laporan</td><td>: <b>${formatTanggal(d.tgl_laporan)} ${d.jam_laporan || ''}</b></td></tr>
        <tr><td>Ruangan</td><td>: <b>${escapeHtml(d.ruangan?.nama_ruangan || '-')}</b></td></tr>
        <tr><td>Pasien</td><td>: <b>${escapeHtml(d.nama_pasien)}</b> (RM: ${escapeHtml(d.no_rm)})</td></tr>
        <tr><td>DPJP</td><td>: <b>${escapeHtml(d.nama_dpjp || '-')}</b></td></tr>
        <tr><td>Pelapor</td><td>: <b>${escapeHtml(d.petugas?.nama || '-')}</b> (${escapeHtml(d.petugas?.profesi || '-')})</td></tr>
      </table>
    </div>

    <div class="review-block">
      <h4>☑️ Item Error (${items.length} dipilih)</h4>
      ${itemsHtml || '<p class="text-muted">Tidak ada item dipilih</p>'}
    </div>

    <div class="review-block">
      <h4>🎯 Grade</h4>
      <p><span class="badge ${gradeBadgeClass(d.grade)}">Grade ${d.grade}</span> — <b>${escapeHtml(selectedGrade?.kategori || '')}</b></p>
      <p>${escapeHtml(selectedGrade?.deskripsi || '')}</p>
    </div>

    <div class="review-block">
      <h4>📝 Deskripsi Kejadian</h4>
      <p>${escapeHtml(d.deskripsi_kejadian || '-').replace(/\n/g,'<br>')}</p>
    </div>

    <div class="review-block">
      <h4>💊 Tindakan / Intervensi</h4>
      <p>${escapeHtml(d.tindakan || '-').replace(/\n/g,'<br>')}</p>
    </div>

    ${d.verified_by ? `
      <div class="alert alert-info">
        <b>Verifikator:</b> ${escapeHtml(d.verifikator?.nama || '-')}
        pada ${formatDateTime(d.verified_at)}
        ${d.catatan_verifikasi ? `<br><b>Catatan:</b> ${escapeHtml(d.catatan_verifikasi)}` : ''}
      </div>
    ` : ''}
  `;

  document.getElementById('detailFooter').innerHTML = `
    <button type="button" class="btn btn-outline" onclick="closeDetail()">Tutup</button>
  `;
}

function closeDetail() {
  document.getElementById('modalDetail').style.display = 'none';
}
