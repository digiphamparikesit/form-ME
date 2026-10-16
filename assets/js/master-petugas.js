// ============================================================
// MASTER PETUGAS - CRUD
// ============================================================

let allPetugas = [];
let allUnit = [];
let deleteTargetId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('master-petugas.html');
  await requireRole(['admin']); // hanya admin
  await loadUnitOptions();
  await loadPetugas();
  bindEvents();
});

// ============================================================
// LOAD DATA
// ============================================================
async function loadUnitOptions() {
  const { data, error } = await db
    .from('unit')
    .select('id, nama_unit')
    .eq('is_active', true)
    .order('nama_unit');

  if (error) {
    console.error('Gagal load unit:', error);
    return;
  }
  allUnit = data || [];

  const select = document.getElementById('unitId');
  select.innerHTML = '<option value="">-- Pilih Unit --</option>' +
    allUnit.map(u => `<option value="${u.id}">${escapeHtml(u.nama_unit)}</option>`).join('');
}

async function loadPetugas() {
  showTbodyLoading();

  const { data, error } = await db
    .from('profiles')
    .select(`
      id, username, nama, nip, profesi, role, is_active, created_at,
      unit:unit_id(id, nama_unit)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    showToast('Gagal memuat data petugas: ' + error.message, 'danger');
    document.getElementById('tbodyPetugas').innerHTML =
      `<tr><td colspan="9" class="text-center text-danger">Gagal memuat data</td></tr>`;
    return;
  }

  allPetugas = data || [];
  renderTable(allPetugas);
}

// ============================================================
// RENDER TABEL
// ============================================================
function renderTable(list) {
  const tbody = document.getElementById('tbodyPetugas');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">Belum ada data petugas</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code>${escapeHtml(p.username)}</code></td>
      <td><b>${escapeHtml(p.nama)}</b></td>
      <td>${escapeHtml(p.nip || '-')}</td>
      <td>${escapeHtml(p.profesi || '-')}</td>
      <td>${escapeHtml(p.unit?.nama_unit || '-')}</td>
      <td>
        <span class="badge ${badgeRoleClass(p.role)}">
          ${roleLabel(p.role)}
        </span>
      </td>
      <td>
        <span class="badge ${p.is_active ? 'badge-success' : 'badge-secondary'}">
          ${p.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <button class="btn-icon btn-edit" data-id="${p.id}" title="Edit">✏️</button>
        <button class="btn-icon btn-delete" data-id="${p.id}" data-nama="${escapeHtml(p.nama)}" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');

  // Bind tombol aksi
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.nama));
  });
}

function badgeRoleClass(role) {
  return {
    admin: 'badge-danger',
    pj: 'badge-warning',
    petugas: 'badge-info'
  }[role] || 'badge-secondary';
}

function showTbodyLoading() {
  document.getElementById('tbodyPetugas').innerHTML =
    `<tr><td colspan="9" class="text-center">Memuat data...</td></tr>`;
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  // Tombol tambah
  document.getElementById('btnTambah').addEventListener('click', openCreateModal);

  // Close modal
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnCloseHapus').addEventListener('click', closeDeleteModal);
  document.getElementById('btnCancelHapus').addEventListener('click', closeDeleteModal);

  // Submit form
  document.getElementById('formPetugas').addEventListener('submit', handleSubmit);

  // Konfirmasi hapus
  document.getElementById('btnConfirmHapus').addEventListener('click', confirmDelete);

  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return renderTable(allPetugas);
    const filtered = allPetugas.filter(p =>
      (p.nama || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.nip || '').includes(q)
    );
    renderTable(filtered);
  });

  // Close modal kalau klik overlay
  document.getElementById('modalPetugas').addEventListener('click', (e) => {
    if (e.target.id === 'modalPetugas') closeModal();
  });
  document.getElementById('modalHapus').addEventListener('click', (e) => {
    if (e.target.id === 'modalHapus') closeDeleteModal();
  });
}

// ============================================================
// MODAL: CREATE / EDIT
// ============================================================
function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'Tambah Petugas';
  document.getElementById('editMode').value = 'create';
  document.getElementById('editId').value = '';
  document.getElementById('formPetugas').reset();
  document.getElementById('isActive').checked = true;
  document.getElementById('uidGroup').style.display = 'block';
  document.getElementById('uid').required = true;
  document.getElementById('username').disabled = false;
  document.getElementById('formError').style.display = 'none';

  document.getElementById('modalPetugas').style.display = 'flex';
}

function openEditModal(id) {
  const p = allPetugas.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modalTitle').textContent = 'Edit Petugas';
  document.getElementById('editMode').value = 'edit';
  document.getElementById('editId').value = p.id;
  document.getElementById('uidGroup').style.display = 'none';
  document.getElementById('uid').required = false;

  document.getElementById('username').value = p.username || '';
  document.getElementById('username').disabled = true; // username tidak bisa diubah
  document.getElementById('nama').value = p.nama || '';
  document.getElementById('nip').value = p.nip || '';
  document.getElementById('profesi').value = p.profesi || '';
  document.getElementById('unitId').value = p.unit?.id || '';
  document.getElementById('role').value = p.role || 'petugas';
  document.getElementById('isActive').checked = p.is_active === true;

  document.getElementById('formError').style.display = 'none';
  document.getElementById('modalPetugas').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalPetugas').style.display = 'none';
}

// ============================================================
// SUBMIT FORM (CREATE / UPDATE)
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
    const payload = {
      username: document.getElementById('username').value.trim().toLowerCase(),
      nama: document.getElementById('nama').value.trim(),
      nip: document.getElementById('nip').value.trim() || null,
      profesi: document.getElementById('profesi').value,
      unit_id: parseInt(document.getElementById('unitId').value) || null,
      role: document.getElementById('role').value,
      is_active: document.getElementById('isActive').checked
    };

    // Validasi
    if (!payload.nama) throw new Error('Nama wajib diisi');
    if (!payload.profesi) throw new Error('Profesi wajib dipilih');
    if (!payload.unit_id) throw new Error('Unit wajib dipilih');

    if (mode === 'create') {
      const uid = document.getElementById('uid').value.trim();
      if (!uid) throw new Error('User UID wajib diisi');
      if (!/^[0-9a-f-]{36}$/i.test(uid)) throw new Error('Format UID tidak valid (harus UUID)');
      if (!payload.username) throw new Error('Username wajib diisi');

      payload.id = uid;

      const { error } = await db.from('profiles').insert(payload);
      if (error) throw error;

      showToast('✅ Petugas berhasil ditambahkan', 'success');

    } else {
      // Edit: username tidak diubah
      delete payload.username;

      const { error } = await db.from('profiles').update(payload).eq('id', document.getElementById('editId').value);
      if (error) throw error;

      showToast('✅ Petugas berhasil diperbarui', 'success');
    }

    closeModal();
    await loadPetugas();

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
// DELETE
// ============================================================
function openDeleteModal(id, nama) {
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
    const { error } = await db.from('profiles').delete().eq('id', deleteTargetId);
    if (error) throw error;

    showToast('✅ Petugas berhasil dihapus', 'success');
    closeDeleteModal();
    await loadPetugas();

  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Hapus';
  }
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
  t._timeout = setTimeout(() => {
    t.style.display = 'none';
  }, 3000);
}
