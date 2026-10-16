// ============================================================
// MASTER RUANGAN - CRUD
// ============================================================

let allRuangan = [];
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('master-ruangan.html');
  await requireRole(['admin']);
  await loadRuangan();
  bindEvents();
});

async function loadRuangan() {
  showTbodyLoading();

  const { data: ruanganList, error } = await db
    .from('ruangan')
    .select('id, nama_ruangan, is_active, created_at')
    .order('nama_ruangan');

  if (error) {
    console.error(error);
    showToast('Gagal memuat data: ' + error.message, 'danger');
    document.getElementById('tbodyRuangan').innerHTML =
      `<tr><td colspan="5" class="text-center text-danger">Gagal memuat data</td></tr>`;
    return;
  }

  // Hitung jumlah petugas per ruangan
  const { data: profiles } = await db.from('profiles').select('ruangan_id');
  const countMap = {};
  (profiles || []).forEach(p => {
    if (p.ruangan_id) countMap[p.ruangan_id] = (countMap[p.ruangan_id] || 0) + 1;
  });

  allRuangan = (ruanganList || []).map(r => ({
    ...r,
    jumlah_petugas: countMap[r.id] || 0
  }));

  renderTable(allRuangan);
}

function renderTable(list) {
  const tbody = document.getElementById('tbodyRuangan');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Belum ada data ruangan</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${escapeHtml(r.nama_ruangan)}</b></td>
      <td>
        <span class="badge ${r.jumlah_petugas > 0 ? 'badge-info' : 'badge-secondary'}">
          ${r.jumlah_petugas} petugas
        </span>
      </td>
      <td>
        <span class="badge ${r.is_active ? 'badge-success' : 'badge-secondary'}">
          ${r.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <button class="btn-icon btn-edit" data-id="${r.id}" title="Edit">✏️</button>
        <button class="btn-icon btn-delete" data-id="${r.id}"
                data-nama="${escapeHtml(r.nama_ruangan)}"
                data-jumlah="${r.jumlah_petugas}" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
  });
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () =>
      openDeleteModal(parseInt(btn.dataset.id), btn.dataset.nama, parseInt(btn.dataset.jumlah))
    );
  });
}

function showTbodyLoading() {
  document.getElementById('tbodyRuangan').innerHTML =
    `<tr><td colspan="5" class="text-center">Memuat data...</td></tr>`;
}

function bindEvents() {
  document.getElementById('btnTambah').addEventListener('click', openCreateModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnCloseHapus').addEventListener('click', closeDeleteModal);
  document.getElementById('btnCancelHapus').addEventListener('click', closeDeleteModal);
  document.getElementById('formRuangan').addEventListener('submit', handleSubmit);
  document.getElementById('btnConfirmHapus').addEventListener('click', confirmDelete);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return renderTable(allRuangan);
    renderTable(allRuangan.filter(r => r.nama_ruangan.toLowerCase().includes(q)));
  });

  document.getElementById('modalRuangan').addEventListener('click', (e) => {
    if (e.target.id === 'modalRuangan') closeModal();
  });
  document.getElementById('modalHapus').addEventListener('click', (e) => {
    if (e.target.id === 'modalHapus') closeDeleteModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
  });
}

function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'Tambah Ruangan';
  document.getElementById('editMode').value = 'create';
  document.getElementById('editId').value = '';
  document.getElementById('formRuangan').reset();
  document.getElementById('isActive').checked = true;
  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalRuangan').style.display = 'flex';
  setTimeout(() => document.getElementById('namaRuangan').focus(), 100);
}

function openEditModal(id) {
  const r = allRuangan.find(x => x.id === id);
  if (!r) return;

  document.getElementById('modalTitle').textContent = 'Edit Ruangan';
  document.getElementById('editMode').value = 'edit';
  document.getElementById('editId').value = r.id;
  document.getElementById('namaRuangan').value = r.nama_ruangan;
  document.getElementById('isActive').checked = r.is_active === true;
  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalRuangan').style.display = 'flex';
  setTimeout(() => document.getElementById('namaRuangan').focus(), 100);
}

function closeModal() {
  document.getElementById('modalRuangan').style.display = 'none';
}

async function handleSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('editMode').value;
  const btnSave = document.getElementById('btnSave');
  const btnText = document.getElementById('btnSaveText');
  const errBox = document.getElementById('formError');

  errBox.style.display = 'none';
  btnSave.disabled = true;
  btnText.textContent = 'Menyimpan...';

  try {
    const namaRuangan = document.getElementById('namaRuangan').value.trim();
    const isActive = document.getElementById('isActive').checked;

    if (!namaRuangan) throw new Error('Nama ruangan wajib diisi');
    if (namaRuangan.length < 3) throw new Error('Nama ruangan minimal 3 karakter');

    const isDuplicate = allRuangan.some(r =>
      r.nama_ruangan.toLowerCase() === namaRuangan.toLowerCase() &&
      (mode === 'create' || r.id !== parseInt(document.getElementById('editId').value))
    );
    if (isDuplicate) throw new Error('Nama ruangan sudah ada');

    const payload = { nama_ruangan: namaRuangan, is_active: isActive };

    if (mode === 'create') {
      const { error } = await db.from('ruangan').insert(payload);
      if (error) throw error;
      showToast('✅ Ruangan berhasil ditambahkan', 'success');
    } else {
      const id = parseInt(document.getElementById('editId').value);
      const { error } = await db.from('ruangan').update(payload).eq('id', id);
      if (error) throw error;
      showToast('✅ Ruangan berhasil diperbarui', 'success');
    }

    closeModal();
    await loadRuangan();
  } catch (err) {
    console.error(err);
    errBox.textContent = err.message || 'Gagal menyimpan data';
    errBox.style.display = 'block';
  } finally {
    btnSave.disabled = false;
    btnText.textContent = 'Simpan';
  }
}

function openDeleteModal(id, nama, jumlahPetugas) {
  if (jumlahPetugas > 0) {
    showToast(
      `❌ Tidak bisa hapus "${nama}" — masih ada ${jumlahPetugas} petugas di ruangan ini`,
      'danger'
    );
    return;
  }
  deleteTargetId = id;
  document.getElementById('hapusNama').textContent = nama;
  document.getElementById('modalHapus').style.display = 'flex';
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('modalHapus').style.display = 'none';
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  const btn = document.getElementById('btnConfirmHapus');
  btn.disabled = true;
  btn.textContent = 'Menghapus...';

  try {
    const { count, error: countErr } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('ruangan_id', deleteTargetId);

    if (countErr) throw countErr;
    if (count > 0) throw new Error(`Masih ada ${count} petugas di ruangan ini`);

    const { error } = await db.from('ruangan').delete().eq('id', deleteTargetId);
    if (error) throw error;

    showToast('✅ Ruangan berhasil dihapus', 'success');
    closeDeleteModal();
    await loadRuangan();
  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hapus';
  }
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.style.display = 'block';

  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.style.display = 'none'; }, 3500);
}
