// ============================================================
// VERIFIKASI LAPORAN ME
// ============================================================

let currentProfile = null;
let allLaporan = [];
let currentFilter = 'pending';

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('verifikasi.html');
  currentProfile = await requireRole(['admin', 'pj']);
  if (!currentProfile) return;

  bindEvents();
  await loadLaporan();
});

// ============================================================
// LOAD DATA
// ============================================================
async function loadLaporan() {
  const tbody = document.getElementById('tbodyVerifikasi');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Memuat data...</td></tr>';

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
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  allLaporan = data || [];

  // Update counter tab
  document.getElementById('countPending').textContent  = allLaporan.filter(l => l.status === 'pending').length;
  document.getElementById('countVerified').textContent = allLaporan.filter(l => l.status === 'verified').length;
  document.getElementById('countRejected').textContent = allLaporan.filter(l => l.status === 'rejected').length;
  document.getElementById('countAll').textContent      = allLaporan.length;

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tbodyVerifikasi');

  let filtered = allLaporan;
  if (currentFilter !== 'all') {
    filtered = allLaporan.filter(l => l.status === currentFilter);
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">Tidak ada laporan</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => `
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
        <button class="btn btn-primary btn-sm" data-id="${l.id}" onclick="openDetail('${l.id}')">
          👁️ Buka
        </button>
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
  const [detailRes, itemsRes] = await Promise.all([
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
      .eq('laporan_id', id)
  ]);

  if (detailRes.error) {
    document.getElementById('detailBody').innerHTML =
      `<p class="text-danger">Gagal memuat: ${detailRes.error.message}</p>`;
    return;
  }

  const d = detailRes.data;
  const items = itemsRes.data || [];

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
      <p><span class="badge ${gradeBadgeClass(d.grade)}">Grade ${d.grade}</span></p>
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

  // Footer: tombol aksi
  const footer = document.getElementById('detailFooter');

  if (d.status === 'pending') {
    footer.innerHTML = `
      <button type="button" class="btn btn-outline" id="btnCloseDetail2">Tutup</button>
      <button type="button" class="btn btn-danger" id="btnReject">❌ Tolak</button>
      <button type="button" class="btn btn-success" id="btnVerify">✅ Verifikasi</button>
    `;
    document.getElementById('btnCloseDetail2').onclick = closeDetail;
    document.getElementById('btnReject').onclick = () => showVerifyForm(id, 'reject');
    document.getElementById('btnVerify').onclick = () => showVerifyForm(id, 'verify');
  } else {
    footer.innerHTML = `<button type="button" class="btn btn-outline" onclick="closeDetail()">Tutup</button>`;
  }
}

function closeDetail() {
  document.getElementById('modalDetail').style.display = 'none';
}

// ============================================================
// VERIFY FORM
// ============================================================
function showVerifyForm(id, action) {
  const isVerify = action === 'verify';

  document.getElementById('detailBody').innerHTML = `
    <div class="alert ${isVerify ? 'alert-success' : 'alert-danger'}">
      ${isVerify ? '✅ Anda akan MEMVERIFIKASI laporan ini' : '❌ Anda akan MENOLAK laporan ini'}
    </div>
    <div class="form-group">
      <label for="catatanVerifikasi">
        Catatan Verifikasi ${isVerify ? '(opsional)' : '<span class="required">*</span>'}
      </label>
      <textarea id="catatanVerifikasi" class="form-control" rows="4"
                placeholder="${isVerify ? 'Catatan tambahan (opsional)...' : 'Alasan penolakan (wajib)...'}"></textarea>
    </div>
    <div id="verifyError" class="alert alert-danger" style="display:none;"></div>
  `;

  document.getElementById('detailFooter').innerHTML = `
    <button type="button" class="btn btn-outline" onclick="openDetail('${id}')">← Kembali</button>
    <button type="button" class="btn ${isVerify ? 'btn-success' : 'btn-danger'}" id="btnConfirmVerify">
      ${isVerify ? '✅ Konfirmasi Verifikasi' : '❌ Konfirmasi Tolak'}
    </button>
  `;

  document.getElementById('btnConfirmVerify').onclick = () => submitVerify(id, action);
}

async function submitVerify(id, action) {
  const catatan = document.getElementById('catatanVerifikasi').value.trim();
  const errBox = document.getElementById('verifyError');
  errBox.style.display = 'none';

  if (action === 'reject' && !catatan) {
    errBox.textContent = 'Alasan penolakan wajib diisi';
    errBox.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btnConfirmVerify');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const newStatus = action === 'verify' ? 'verified' : 'rejected';

    const { error } = await db
      .from('laporan_me')
      .update({
        status: newStatus,
        verified_by: currentProfile.id,
        verified_at: new Date().toISOString(),
        catatan_verifikasi: catatan || null
      })
      .eq('id', id);

    if (error) throw error;

    showToast(
      action === 'verify' ? '✅ Laporan berhasil diverifikasi' : '❌ Laporan ditolak',
      action === 'verify' ? 'success' : 'danger'
    );

    closeDetail();
    await loadLaporan();

  } catch (err) {
    console.error(err);
    errBox.textContent = 'Gagal: ' + err.message;
    errBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = action === 'verify' ? '✅ Konfirmasi Verifikasi' : '❌ Konfirmasi Tolak';
  }
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  // Tab filter
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      renderTable();
    });
  });

  // Close modal
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetail);
  document.getElementById('modalDetail').addEventListener('click', (e) => {
    if (e.target.id === 'modalDetail') closeDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.style.display = 'block';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.style.display = 'none'; }, 3000);
}
