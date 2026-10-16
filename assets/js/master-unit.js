// ============================================================
// MASTER UNIT - CRUD
// ============================================================

let allUnit = [];
let deleteTargetId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('master-unit.html');
  await requireRole(['admin']);
  await loadUnit();
  bindEvents();
});

// ============================================================
// LOAD DATA
// ============================================================
async function loadUnit() {
  showTbodyLoading();

  // Ambil unit + jumlah petugas (nested select dengan count)
  const { data: units, error } = await db
    .from('unit')
    .select('id, nama_unit, is_active, created_at')
    .order('nama_unit');

  if (error) {
    console.error(error);
    showToast('Gagal memuat data unit: ' + error.message, 'danger');
    document.getElementById('tbodyUnit').innerHTML =
      `<tr><td colspan="5" class="text-center text-danger">Gagal memuat data</td></tr>`;
    return;
  }

  // Ambil jumlah petugas per unit
  const { data: petugasCount } = await db
    .from('profiles')
    .select('unit_id');

  // Hitung manual
  const countMap = {};
  (petugasCount || []).forEach(p => {
    if (p.unit_id) {
      countMap[p.unit_id] = (countMap[p.unit_id] || 0) + 1;
    }
  });

  allUnit = (units || []).map(u => ({
    ...u,
    jumlah_petugas: countMap[u.id] || 0
  }));

  renderTable(allUnit);
}

// ============================================================
// RENDER TABEL
// ============================================================
function renderTable(list) {
  const tbody = document.getElementById('tbodyUnit');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Belum ada data unit</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${escapeHtml(u.nama_unit)}</b></td>
      <td>
        <span class="badge ${u.jumlah_petugas > 0 ? 'badge-info' : 'badge-secondary'}">
          ${u.jumlah_petugas} petugas
        </span>
      </td>
      <td>
        <span class="badge ${u.is_active ? 'badge-success' : 'badge-secondary'}">
          ${u.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <button class="btn-icon btn-edit" data-id="${u.id}" title="Edit">✏️</button>
        <button class="btn-icon btn-delete" data-id="${u.id}" data-nama="${escapeHtml(u.nama_unit)}" 
                data-jumlah="${u.jumlah_petugas}" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');

  // Bind tombol
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
  document.getElementById('tbodyUnit').innerHTML =
    `<tr><td colspan="5" class="text-center">Memuat data...</td></tr>`;
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  document.getElementById('btnTambah').addEventListener('click', openCreateModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnCloseHapus').addEventListener('click', closeDeleteModal);
  document.getElementById('btnCancelHapus').addEventListener('click', closeDeleteModal);
  document.getElementById('formUnit').addEventListener('submit', handleSubmit);
  document.getElementById('btnConfirmHapus').addEventListener('click', confirmDelete);

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return renderTable(allUnit);
    renderTable(allUnit.filter(u => u.nama_unit.toLowerCase().includes(q)));
  });

  // Close modal on overlay click
  document.getElementById('modalUnit').addEventListener('click', (e) => {
    if (e.target.id === 'modalUnit') closeModal();
  });
  document.getElementById('modalHapus').addEventListener('click', (e) => {
    if (e.target.id === 'modalHapus') closeDeleteModal();
  });

  // ESC untuk close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });
}

// ============================================================
// MODAL: CREATE / EDIT
// ============================================================
function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'Tambah Unit';
  document.getElementById('editMode').value = 'create';
  document.getElementById('editId').value = '';
  document.getElementById('formUnit').reset();
  document.getElementById('isActive').checked = true;
  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalUnit').style.display = 'flex';

  setTimeout(() => document.getElementById('namaUnit').focus(), 100);
}

function openEditModal(id) {
  const u = allUnit.find(x => x.id === id);
  if (!u) return;

  document.getElementById('modalTitle').textContent = 'Edit Unit';
  document.getElementById('editMode').value = 'edit';
  document.getElementById('editId').value = u.id;
  document.getElementById('namaUnit').value = u.nama_unit;
  document.getElementById('isActive').checked = u.is_active === true;
  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalUnit').style.display = 'flex';

  setTimeout(() => document.getElementById('namaUnit').focus(), 100);
}

function closeModal() {
  document.getElementById('modalUnit').style.display = 'none';
}

// ============================================================
// SUBMIT FORM
// ============================================================
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
    const namaUnit = document.getElementById('namaUnit').value.trim();
    const isActive = document.getElementById('isActive').checked;

    // Validasi
    if (!namaUnit) throw new Error('Nama unit wajib diisi');
    if (namaUnit.length < 3) throw new Error('Nama unit minimal 3 karakter');

    // Cek duplikat nama (case-insensitive)
    const isDuplicate = allUnit.some(u => 
      u.nama_unit.toLowerCase() === namaUnit.toLowerCase() &&
      (mode === 'create' || u.id !== parseInt(document.getElementById('editId').value))
    );
    if (isDuplicate) throw new Error('Nama unit sudah ada');

    const payload = {
      nama_unit: namaUnit,
      is_active: isActive
    };

    if (mode === 'create') {
      const { error } = await db.from('unit').insert(payload);
      if (error) throw error;
      showToast('✅ Unit berhasil ditambahkan', 'success');
    } else {
      const id = parseInt(document.getElementById('editId').value);
      const { error } = await db.from('unit').update(payload).eq('id', id);
      if (error) throw error;
      showToast('✅ Unit berhasil diperbarui', 'success');
    }

    closeModal();
    await loadUnit();

  } catch (err) {
    console.error(err);
    errBox.textContent = err.message || 'Gagal menyimpan data';
    errBox.style.display = 'block';
  } finally {
    btnSave.disabled = false;
    btnText.textContent = 'Simpan';
  }
}

// ============================================================
// DELETE (dengan validasi jumlah petugas)
// ============================================================
function openDeleteModal(id, nama, jumlahPetugas) {
  if (jumlahPetugas > 0) {
    showToast(
      `❌ Tidak bisa hapus "${nama}" — masih ada ${jumlahPetugas} petugas di unit ini`,
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
    // Cek ulang di server: apakah masih ada petugas?
    const { count, error: countErr } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('unit_id', deleteTargetId);

    if (countErr) throw countErr;
    if (count > 0) throw new Error(`Masih ada ${count} petugas di unit ini`);

    const { error } = await db.from('unit').delete().eq('id', deleteTargetId);
    if (error) throw error;

    showToast('✅ Unit berhasil dihapus', 'success');
    closeDeleteModal();
    await loadUnit();

  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hapus';
  }
}

// ============================================================
// TOAST (sama seperti master-petugas.js)
// ============================================================
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.style.display = 'block';

  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => {
    t.style.display = 'none';
  }, 3500);
}
