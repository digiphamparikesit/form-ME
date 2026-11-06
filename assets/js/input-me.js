// ============================================================
// INPUT ME - Form 4 Step (Revisi Autocomplete Ruangan)
// ============================================================

let currentStep = 1;
let currentProfile = null;
let allRuangan = [];
let allItems = {};
let selectedItems = {};
let selectedGrade = null;
let allGrades = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('input-me.html');

  currentProfile = await getCurrentProfile();
  if (!currentProfile) return;

  document.getElementById('petugasPelapor').textContent =
    `${currentProfile.nama} (${roleLabel(currentProfile.role)})`;

  // Set default tanggal & jam hari ini
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const jam = now.toTimeString().substring(0,5);
  document.getElementById('tglTemuan').value = today;
  document.getElementById('tglLaporan').value = today;
  document.getElementById('jamTemuan').value = jam;
  document.getElementById('jamLaporan').value = jam;

  await loadRuangan();
  await loadItems();
  await loadGrades();

  bindEvents();

  // ==========================================
  // CEK MODE EDIT
  // ==========================================
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  if (editId) {
    await loadDataEdit(editId);
  }
});

// ============================================================
// LOAD DATA MASTER
// ============================================================
async function loadRuangan() {
  const { data, error } = await db.from('ruangan').select('id, nama_ruangan').eq('is_active', true).order('nama_ruangan');
  if (error) { console.error(error); return; }
  allRuangan = data || [];
  // Dropdown select sudah diganti jadi input, tidak perlu render option
}

// ============================================================
// AUTOCOMPLETE RUANGAN
// ============================================================
function onRuanganInput(val) {
  const list = document.getElementById('acListRuangan');
  const q = (val || '').toLowerCase().trim();
  
  if (!q) { list.classList.remove('show'); return; }
  
  const matches = allRuangan.filter(r => r.nama_ruangan.toLowerCase().includes(q));
  
  if (matches.length === 0) { list.classList.remove('show'); return; }
  
  list.innerHTML = matches.map(r => `
    <div class="ac-item" onclick="pilihRuangan('${r.id}', '${escapeAttr(r.nama_ruangan)}')">
      ${escapeHtml(r.nama_ruangan)}
    </div>
  `).join('');
  
  list.classList.add('show');
}

function pilihRuangan(id, nama) {
  document.getElementById('inputRuangan').value = nama;
  document.getElementById('ruanganId').value = id;
  document.getElementById('acListRuangan').classList.remove('show');
}

// ============================================================
// LOAD ITEMS & GRADES
// ============================================================
async function loadItems() {
  const { data, error } = await db.from('item_monitoring').select('id, tahap, nama_item, urutan').eq('is_active', true).order('tahap').order('urutan');
  if (error) {
    console.error(error);
    document.getElementById('itemsContainer').innerHTML = `<p class="text-danger">Gagal memuat item error.</p>`;
    return;
  }

  allItems = { prescribing: [], transcribing: [], dispensing: [], administering: [] };
  (data || []).forEach(item => {
    if (allItems[item.tahap]) allItems[item.tahap].push(item);
  });
  renderItems();
}

async function loadGrades() {
  const { data, error } = await db.from('grade_insiden').select('kode, kategori, deskripsi').order('kode');
  if (error) { console.error(error); return; }
  allGrades = data || [];
  renderGrades();
}

// ============================================================
// RENDER ITEMS & GRADES
// ============================================================
const TAHAP_LABEL = {
  prescribing: '💊 Prescribing Error',
  transcribing: '📝 Transcribing Error',
  dispensing: '📦 Dispensing Error',
  administering: '💉 Administering Error'
};

function renderItems() {
  const container = document.getElementById('itemsContainer');
  let html = '';

  Object.keys(TAHAP_LABEL).forEach(tahap => {
    const items = allItems[tahap] || [];
    if (!items.length) return;

    html += `
      <div class="item-group">
        <div class="item-group-header">
          <h4>${TAHAP_LABEL[tahap]}</h4>
          <span class="badge badge-info">${items.length} item</span>
        </div>
        <div class="item-group-body">
    `;

    items.forEach(item => {
      const isLain = item.nama_item.toLowerCase().startsWith('lain');
      html += `
        <div class="item-checkbox">
          <label class="checkbox-label">
            <input type="checkbox" class="item-check" data-id="${item.id}" data-lain="${isLain}">
            <span>${escapeHtml(item.nama_item)}</span>
          </label>
          <div class="item-lain-input" id="lain-${item.id}" style="display:none;">
            <input type="text" class="form-control form-control-sm" placeholder="Sebutkan..." data-lain-id="${item.id}">
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
  container.querySelectorAll('.item-check').forEach(cb => {
    cb.addEventListener('change', handleItemCheck);
  });
}

function handleItemCheck(e) {
  const id = e.target.dataset.id;
  const isLain = e.target.dataset.lain === 'true';

  if (e.target.checked) {
    selectedItems[id] = '';
    if (isLain) document.getElementById(`lain-${id}`).style.display = 'block';
  } else {
    delete selectedItems[id];
    if (isLain) {
      document.getElementById(`lain-${id}`).style.display = 'none';
      const input = document.querySelector(`[data-lain-id="${id}"]`);
      if (input) input.value = '';
    }
  }
}

function renderGrades() {
  const grid = document.getElementById('gradeGrid');
  grid.innerHTML = allGrades.map(g => `
    <label class="grade-option" data-kode="${g.kode}">
      <input type="radio" name="grade" value="${g.kode}">
      <div class="grade-badge">${g.kode}</div>
      <div class="grade-info">
        <strong>${g.kategori}</strong>
        <small>${escapeHtml(g.deskripsi.substring(0, 60))}...</small>
      </div>
    </label>
  `).join('');

  grid.querySelectorAll('input[name="grade"]').forEach(radio => {
    radio.addEventListener('change', handleGradeChange);
  });
}

function handleGradeChange(e) {
  selectedGrade = e.target.value;
  const g = allGrades.find(x => x.kode === selectedGrade);
  if (!g) return;

  document.getElementById('gradeInfoTitle').textContent = `Grade ${g.kode} — ${g.kategori}`;
  document.getElementById('gradeInfoDesc').textContent = g.deskripsi;
  document.getElementById('gradeInfo').style.display = 'block';

  document.querySelectorAll('.grade-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.kode === selectedGrade);
  });
}

// ============================================================
// LOAD DATA EDIT (MENGISI FORM DENGAN DATA LAMA)
// ============================================================
async function loadDataEdit(id) {
  document.querySelector('.page-title').textContent = 'Edit Laporan ME';
  document.querySelector('.page-subtitle').textContent = 'Perbarui data laporan yang sudah ada';
  
  const btnSaveDraft = document.getElementById('btnSaveDraft');
  if(btnSaveDraft) btnSaveDraft.style.display = 'none';
  
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.innerHTML = '💾 Simpan Perubahan';
  btnSubmit.dataset.editId = id;

  try {
    const { data: lap, error } = await db.from('laporan_me').select('*, ruangan:ruangan_id(nama_ruangan)').eq('id', id).single();
    if (error) throw error;

    document.getElementById('tglTemuan').value = lap.tgl_temuan;
    document.getElementById('jamTemuan').value = lap.jam_temuan || '00:00';
    document.getElementById('tglLaporan').value = lap.tgl_laporan;
    document.getElementById('jamLaporan').value = lap.jam_laporan || '00:00';
    
    // Set Ruangan ID (hidden) dan Nama Ruangan (tampilan)
    document.getElementById('ruanganId').value = lap.ruangan_id || '';
    document.getElementById('inputRuangan').value = lap.ruangan?.nama_ruangan || '';
    
    if (!lap.ruangan_id) {
      showToast('Perhatian: Ruangan kosong. Silakan pilih ulang.', 'warning');
    }

    document.getElementById('namaPasien').value = lap.nama_pasien;
    document.getElementById('noRm').value = lap.no_rm;
    document.getElementById('namaDpjp').value = lap.nama_dpjp || '';

    const { data: details } = await db.from('laporan_me_detail').select('*').eq('laporan_id', id);
    if (details && details.length > 0) {
      details.forEach(d => {
        const cb = document.querySelector(`.item-check[data-id="${d.item_monitoring_id}"]`);
        if (cb) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change'));
          if (d.catatan_lain) {
            const input = document.querySelector(`[data-lain-id="${d.item_monitoring_id}"]`);
            if (input) input.value = d.catatan_lain;
          }
        }
      });
    }

    if (lap.grade) {
      const radio = document.querySelector(`input[name="grade"][value="${lap.grade}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
    }

    document.getElementById('deskripsiKejadian').value = lap.deskripsi_kejadian || '';
    document.getElementById('tindakan').value = lap.tindakan || '';

    showToast('Data laporan berhasil dimuat.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal memuat data edit: ' + err.message, 'danger');
  }
}

// ============================================================
// NAVIGATION & VALIDATION
// ============================================================
function bindEvents() {
  document.getElementById('btnNext1').addEventListener('click', () => { if (validateStep1()) goToStep(2); });
  document.getElementById('btnNext2').addEventListener('click', () => { if (validateStep2()) goToStep(3); });
  document.getElementById('btnNext3').addEventListener('click', () => { if (validateStep3()) { renderReview(); goToStep(4); } });
  
  document.getElementById('btnPrev2').addEventListener('click', () => goToStep(1));
  document.getElementById('btnPrev3').addEventListener('click', () => goToStep(2));
  document.getElementById('btnPrev4').addEventListener('click', () => goToStep(3));

  document.getElementById('btnSaveDraft').addEventListener('click', () => saveLaporan('draft'));
  document.getElementById('btnSubmit').addEventListener('click', () => saveLaporan('pending'));

  // Sembunyikan autocomplete ruangan jika klik di luar
  document.addEventListener('click', e => {
    if(!e.target.closest('#inputRuangan') && !e.target.closest('#acListRuangan')) {
      document.getElementById('acListRuangan').classList.remove('show');
    }
  });
}

function validateStep1() {
  const errBox = document.getElementById('errorStep1');
  errBox.style.display = 'none';
  const required = ['tglTemuan', 'jamTemuan', 'tglLaporan', 'jamLaporan', 'namaPasien', 'noRm'];
  for (const id of required) {
    if (!document.getElementById(id).value.trim()) {
      errBox.textContent = 'Lengkapi semua field yang bertanda *';
      errBox.style.display = 'block';
      document.getElementById(id).focus();
      return false;
    }
  }
  // Validasi Ruangan Autocomplete
  const rId = document.getElementById('ruanganId').value;
  const rTeks = document.getElementById('inputRuangan').value;
  if (!rId || !rTeks) {
    errBox.textContent = 'Pilih Ruangan dari daftar pencarian';
    errBox.style.display = 'block';
    document.getElementById('inputRuangan').focus();
    return false;
  }
  return true;
}

function validateStep2() {
  const errBox = document.getElementById('errorStep2');
  errBox.style.display = 'none';
  if (Object.keys(selectedItems).length === 0) {
    errBox.textContent = 'Pilih minimal 1 item error';
    errBox.style.display = 'block';
    return false;
  }
  const lainChecks = document.querySelectorAll('.item-check[data-lain="true"]:checked');
  for (const cb of lainChecks) {
    const id = cb.dataset.id;
    const input = document.querySelector(`[data-lain-id="${id}"]`);
    if (!input.value.trim()) {
      errBox.textContent = 'Isi keterangan pada item "Lain:"';
      errBox.style.display = 'block';
      input.focus();
      return false;
    }
  }
  return true;
}

function validateStep3() {
  const errBox = document.getElementById('errorStep3');
  errBox.style.display = 'none';
  if (!selectedGrade) {
    errBox.textContent = 'Pilih grade dampak insiden';
    errBox.style.display = 'block';
    return false;
  }
  const deskripsi = document.getElementById('deskripsiKejadian').value.trim();
  if (!deskripsi) {
    errBox.textContent = 'Deskripsi kejadian wajib diisi';
    errBox.style.display = 'block';
    document.getElementById('deskripsiKejadian').focus();
    return false;
  }
  if (deskripsi.length < 10) {
    errBox.textContent = 'Deskripsi minimal 10 karakter';
    errBox.style.display = 'block';
    return false;
  }
  return true;
}

function goToStep(n) {
  currentStep = n;
  [1, 2, 3, 4].forEach(i => {
    document.getElementById(`step${i}`).style.display = (i === n) ? 'block' : 'none';
  });
  document.querySelectorAll('.step-item').forEach(el => {
    const step = parseInt(el.dataset.step);
    el.classList.toggle('active', step === n);
    el.classList.toggle('done', step < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// REVIEW (STEP 4)
// ============================================================
function renderReview() {
  // Ambil nama ruangan dari input teks
  const ruanganNama = document.getElementById('inputRuangan').value;
  const grade = allGrades.find(g => g.kode === selectedGrade);

  const groupedItems = {};
  Object.keys(selectedItems).forEach(id => {
    const item = Object.values(allItems).flat().find(x => x.id === parseInt(id));
    if (!item) return;
    if (!groupedItems[item.tahap]) groupedItems[item.tahap] = [];
    const lainInput = document.querySelector(`[data-lain-id="${id}"]`);
    const catatan = lainInput ? lainInput.value.trim() : '';
    groupedItems[item.tahap].push({ ...item, catatan });
  });

  let itemsHtml = '';
  Object.keys(groupedItems).forEach(tahap => {
    itemsHtml += `
      <div class="review-section">
        <h5>${TAHAP_LABEL[tahap]}</h5>
        <ul>${groupedItems[tahap].map(i => `<li>${escapeHtml(i.nama_item)} ${i.catatan ? `<b>: ${escapeHtml(i.catatan)}</b>` : ''}</li>`).join('')}</ul>
      </div>
    `;
  });

  document.getElementById('reviewContent').innerHTML = `
    <div class="review-block">
      <h4>📋 Data Kejadian</h4>
      <table class="review-table">
        <tr><td>Tgl Temuan</td><td>: <b>${formatTanggal(document.getElementById('tglTemuan').value)} ${document.getElementById('jamTemuan').value}</b></td></tr>
        <tr><td>Tgl Laporan</td><td>: <b>${formatTanggal(document.getElementById('tglLaporan').value)} ${document.getElementById('jamLaporan').value}</b></td></tr>
        <tr><td>Ruangan</td><td>: <b>${escapeHtml(ruanganNama || '-')}</b></td></tr>
        <tr><td>Nama Pasien</td><td>: <b>${escapeHtml(document.getElementById('namaPasien').value)}</b></td></tr>
        <tr><td>No. RM</td><td>: <b>${escapeHtml(document.getElementById('noRm').value)}</b></td></tr>
        <tr><td>DPJP</td><td>: <b>${escapeHtml(document.getElementById('namaDpjp').value || '-')}</b></td></tr>
        <tr><td>Pelapor</td><td>: <b>${escapeHtml(currentProfile.nama)}</b></td></tr>
      </table>
    </div>
    <div class="review-block">
      <h4>☑️ Item Error (${Object.keys(selectedItems).length} dipilih)</h4>
      ${itemsHtml}
    </div>
    <div class="review-block">
      <h4>🎯 Grade</h4>
      <p><span class="badge ${gradeBadgeClass(selectedGrade)}">Grade ${selectedGrade}</span> — <b>${escapeHtml(grade?.kategori || '')}</b></p>
      <p>${escapeHtml(grade?.deskripsi || '')}</p>
    </div>
    <div class="review-block">
      <h4>📝 Deskripsi Kejadian</h4>
      <p>${escapeHtml(document.getElementById('deskripsiKejadian').value).replace(/\n/g,'<br>')}</p>
    </div>
    <div class="review-block">
      <h4>💊 Tindakan / Intervensi</h4>
      <p>${escapeHtml(document.getElementById('tindakan').value || '-').replace(/\n/g,'<br>')}</p>
    </div>
  `;
}

// ============================================================
// SAVE LAPORAN (CREATE & UPDATE)
// ============================================================
async function saveLaporan(status) {
  const errBox = document.getElementById('errorStep4');
  errBox.style.display = 'none';

  const btnSave = document.getElementById('btnSaveDraft');
  const btnSubmit = document.getElementById('btnSubmit');
  
  const editId = btnSubmit.dataset.editId;
  const isEdit = !!editId;

  btnSave.disabled = true;
  btnSubmit.disabled = true;

  try {
    const payload = {
      tgl_temuan: document.getElementById('tglTemuan').value,
      jam_temuan: document.getElementById('jamTemuan').value,
      tgl_laporan: document.getElementById('tglLaporan').value,
      jam_laporan: document.getElementById('jamLaporan').value,
      ruangan_id: parseInt(document.getElementById('ruanganId').value), // Ambil dari hidden input
      petugas_id: currentProfile.id,
      nama_pasien: document.getElementById('namaPasien').value.trim(),
      no_rm: document.getElementById('noRm').value.trim(),
      nama_dpjp: document.getElementById('namaDpjp').value.trim() || null,
      grade: selectedGrade,
      deskripsi_kejadian: document.getElementById('deskripsiKejadian').value.trim(),
      tindakan: document.getElementById('tindakan').value.trim() || null,
      status: status
    };

    let laporanId = editId;

    if (isEdit) {
      const { error: errUpdate } = await db.from('laporan_me').update(payload).eq('id', editId);
      if (errUpdate) throw errUpdate;
      await db.from('laporan_me_detail').delete().eq('laporan_id', editId);
    } else {
      payload.created_by = currentProfile.id;
      const { data: laporan, error: errInsert } = await db.from('laporan_me').insert(payload).select('id, no_laporan').single();
      if (errInsert) throw errInsert;
      laporanId = laporan.id;
      payload.no_laporan = laporan.no_laporan;
    }

    const detailPayload = Object.keys(selectedItems).map(itemId => {
      const lainInput = document.querySelector(`[data-lain-id="${itemId}"]`);
      return {
        laporan_id: laporanId,
        item_monitoring_id: parseInt(itemId),
        catatan_lain: lainInput ? (lainInput.value.trim() || null) : null
      };
    });

    if (detailPayload.length > 0) {
      const { error: errDetail } = await db.from('laporan_me_detail').insert(detailPayload);
      if (errDetail) throw errDetail;
    }

    const msg = isEdit ? 'diperbarui' : 'tersimpan';
    showToast(`✅ Laporan berhasil ${msg}`, 'success');

    setTimeout(() => {
      window.location.href = 'laporan.html';
    }, 1500);

  } catch (err) {
    console.error(err);
    errBox.textContent = 'Gagal menyimpan: ' + (err.message || 'Unknown error');
    errBox.style.display = 'block';
    btnSave.disabled = false;
    btnSubmit.disabled = false;
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
  t._timeout = setTimeout(() => { t.style.display = 'none'; }, 4000);
}
