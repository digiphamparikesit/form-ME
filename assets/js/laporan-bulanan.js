// ============================================================
// LAPORAN BULANAN (MATRIKS REKAP)
// ============================================================

let allRuangan = [];
let masterItems = []; // Menyimpan daftar 26 item error
let laporanData = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('laporan-bulanan.html');
  
  // Set default tanggal (bulan ini)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  document.getElementById('filterDari').value = firstDay;
  document.getElementById('filterSampai').value = lastDay;

  await loadMasterData();
  bindEvents();
  
  // Auto load pertama kali
  document.getElementById('btnTampilkan').click();
});

// ============================================================
// LOAD MASTER DATA (Ruangan & Item Error)
// ============================================================
async function loadMasterData() {
  // 1. Load Ruangan
  const { data: ruangan } = await db.from('ruangan').select('id, nama_ruangan').eq('is_active', true).order('nama_ruangan');
  allRuangan = ruangan || [];
  const selectRuangan = document.getElementById('filterRuangan');
  selectRuangan.innerHTML = '<option value="">Semua Ruangan</option>' + 
    allRuangan.map(r => `<option value="${r.id}">${escapeHtml(r.nama_ruangan)}</option>`).join('');

  // 2. Load Item Monitoring (Urutkan sesuai tahap & urutan)
  const { data: items } = await db.from('item_monitoring').select('id, tahap, nama_item, urutan').eq('is_active', true).order('tahap').order('urutan');
  masterItems = items || [];
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  document.getElementById('btnTampilkan').addEventListener('click', async () => {
    const dari = document.getElementById('filterDari').value;
    const sampai = document.getElementById('filterSampai').value;
    const ruanganId = document.getElementById('filterRuangan').value;

    if (!dari || !sampai) {
      showToast('Pilih rentang tanggal terlebih dahulu', 'warning');
      return;
    }

    document.getElementById('matrixHead').innerHTML = '<tr><th colspan="3">Memuat data...</th></tr>';
    document.getElementById('matrixBody').innerHTML = '';
    
    await loadLaporanData(dari, sampai, ruanganId);
    renderMatrix(dari, sampai);
  });
}

// ============================================================
// FETCH DATA LAPORAN
// ============================================================
async function loadLaporanData(dari, sampai, ruanganId) {
  let query = db.from('laporan_me')
    .select(`
      id, nama_pasien, no_rm, tgl_temuan,
      detail:laporan_me_detail(item_monitoring_id)
    `)
    .gte('tgl_laporan', dari)
    .lte('tgl_laporan', sampai)
    .order('tgl_laporan', { ascending: true });

  if (ruanganId) {
    query = query.eq('ruangan_id', ruanganId);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    showToast('Gagal memuat data: ' + error.message, 'danger');
    laporanData = [];
    return;
  }
  laporanData = data || [];
}

// ============================================================
// RENDER MATRIKS
// ============================================================
function renderMatrix(dari, sampai) {
  const thead = document.getElementById('matrixHead');
  const tbody = document.getElementById('matrixBody');

  if (laporanData.length === 0) {
    thead.innerHTML = '<tr><th colspan="3">Tidak ada data pada periode ini</th></tr>';
    tbody.innerHTML = '';
    return;
  }

  // 1. Susun Header (Kolom)
  // Kita kelompokkan item berdasarkan tahap
  let headerRow1 = `<tr>
    <th rowspan="2">No</th>
    <th rowspan="2">Nama Pasien (RM)</th>
    <th colspan="${masterItems.length}">MONITORING MEDICATION ERROR</th>
  </tr>`;
  
  let headerRow2 = `<tr>`;
  
  // Grouping header tahap
  const tahapCounts = {};
  masterItems.forEach(item => {
    tahapCounts[item.tahap] = (tahapCounts[item.tahap] || 0) + 1;
  });

  // Baris 1 untuk nama tahap (Prescribing, Trans, dll) - Opsional agar rapi
  // Baris 2 untuk nama item (disingkat sedikit agar muat)
  masterItems.forEach(item => {
    // Ambil 3 kata pertama dari nama item agar tidak terlalu panjang
    let shortName = item.nama_item;
    if (shortName.length > 25) {
      shortName = shortName.substring(0, 22) + '...';
    }
    
    // Beri warna khusus jika ini item "Lain :"
    const isLain = shortName.toLowerCase().includes('lain');
    const bg = isLain ? 'background:#FEF3C7;' : '';
    
    headerRow2 += `<th style="${bg} writing-mode: vertical-rl; transform: rotate(180deg); height: 150px; padding: 10px 4px;">
      ${escapeHtml(shortName)}
    </th>`;
  });
  
  headerRow2 += `</tr>`;
  thead.innerHTML = headerRow1 + headerRow2;

  // 2. Render Baris Data (Per Pasien)
  let bodyHtml = '';
  
  laporanData.forEach((lap, index) => {
    // Kumpulkan ID item yang diceklis oleh pasien ini
    const checkedItems = lap.detail.map(d => d.item_monitoring_id);

    bodyHtml += `<tr>`;
    bodyHtml += `<td>${index + 1}</td>`;
    bodyHtml += `<td class="text-left" style="font-weight:600;">
        ${escapeHtml(lap.nama_pasien)}<br>
        <span style="font-size:10px; color:#666; font-weight:normal;">RM: ${escapeHtml(lap.no_rm)}</span>
      </td>`;

    // Loop 26 item, cek apakah item ini ada di daftar centang pasien
    masterItems.forEach(item => {
      const isChecked = checkedItems.includes(item.id);
      bodyHtml += `<td>${isChecked ? '<span class="check">✓</span>' : ''}</td>`;
    });

    bodyHtml += `</tr>`;
  });

  tbody.innerHTML = bodyHtml;

  // Update text periode cetak
  document.getElementById('printPeriode').textContent = `Periode: ${formatTanggal(dari)} s/d ${formatTanggal(sampai)}`;
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
