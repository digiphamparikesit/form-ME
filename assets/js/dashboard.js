// ============================================================
// DASHBOARD - Statistik & Filter
// ============================================================

let allLaporan = [];
let allGrades = [];
let allItems = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('dashboard.html');

  await loadGradesAndItems();
  await loadTahunOptions();
  bindEvents();

  // Default: tahun ini
  const thn = new Date().getFullYear();
  document.getElementById('filterTahun').value = thn;

  await loadDashboard();
});

// ============================================================
// LOAD MASTER DATA
// ============================================================
async function loadGradesAndItems() {
  const [g, i] = await Promise.all([
    db.from('grade_insiden').select('kode, kategori, deskripsi').order('kode'),
    db.from('item_monitoring').select('id, tahap').eq('is_active', true)
  ]);
  allGrades = g.data || [];
  allItems = i.data || [];
}

async function loadTahunOptions() {
  const { data } = await db
    .from('laporan_me')
    .select('tgl_laporan')
    .order('tgl_laporan', { ascending: false });

  const tahunSet = new Set((data || []).map(l => l.tgl_laporan.substring(0, 4)));
  tahunSet.add(new Date().getFullYear().toString());

  const select = document.getElementById('filterTahun');
  const sorted = Array.from(tahunSet).sort((a, b) => b - a);
  select.innerHTML = '<option value="">Semua Tahun</option>' +
    sorted.map(t => `<option value="${t}">${t}</option>`).join('');
}

// ============================================================
// LOAD DASHBOARD DATA
// ============================================================
async function loadDashboard() {
  const tahun = document.getElementById('filterTahun').value;
  const dari = document.getElementById('filterDari').value;
  const sampai = document.getElementById('filterSampai').value;

  // Query laporan
  let query = db.from('laporan_me').select(`
    id, no_laporan, tgl_laporan, grade, status, ruangan_id,
    ruangan:ruangan_id(nama_ruangan)
  `);

  if (tahun) {
    query = query.gte('tgl_laporan', `${tahun}-01-01`).lte('tgl_laporan', `${tahun}-12-31`);
  }
  if (dari) query = query.gte('tgl_laporan', dari);
  if (sampai) query = query.lte('tgl_laporan', sampai);

  const { data, error } = await query.order('tgl_laporan', { ascending: false });

  if (error) {
    console.error(error);
    showToast('Gagal memuat dashboard: ' + error.message, 'danger');
    return;
  }

  allLaporan = data || [];

  // Load detail item untuk laporan yang tampil
  const laporanIds = allLaporan.map(l => l.id);
  let detailMap = {};

  if (laporanIds.length) {
    const { data: details } = await db
      .from('laporan_me_detail')
      .select('laporan_id, item_monitoring_id')
      .in('laporan_id', laporanIds);

    (details || []).forEach(d => {
      if (!detailMap[d.laporan_id]) detailMap[d.laporan_id] = [];
      detailMap[d.laporan_id].push(d.item_monitoring_id);
    });
  }

  renderStatCards();
  renderGradeChart();
  renderTahapChart(detailMap);
  renderRuanganChart();
  renderTrenChart();
}

// ============================================================
// STAT CARDS
// ============================================================
function renderStatCards() {
  const total = allLaporan.length;
  const draft = allLaporan.filter(l => l.status === 'draft').length;
  const pending = allLaporan.filter(l => l.status === 'pending').length;
  const verified = allLaporan.filter(l => l.status === 'verified').length;
  const rejected = allLaporan.filter(l => l.status === 'rejected').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDraft').textContent = draft;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statVerified').textContent = verified;
  document.getElementById('statRejected').textContent = rejected;
}

// ============================================================
// CHART: GRADE
// ============================================================
function renderGradeChart() {
  const container = document.getElementById('gradeChart');
  const counts = {};
  allGrades.forEach(g => counts[g.kode] = 0);
  allLaporan.forEach(l => {
    if (l.grade) counts[l.grade] = (counts[l.grade] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(counts), 1);

  const rows = allGrades.map(g => {
    const count = counts[g.kode];
    const percent = (count / maxCount) * 100;
    return `
      <div class="bar-row">
        <div class="bar-label">
          <span class="badge ${gradeBadgeClass(g.kode)}">${g.kode}</span>
          <small>${g.kategori}</small>
        </div>
        <div class="bar-track">
          <div class="bar-fill bar-${g.kode}" style="width:${percent}%"></div>
        </div>
        <div class="bar-value">${count}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = rows;
}

// ============================================================
// CHART: TAHAP
// ============================================================
function renderTahapChart(detailMap) {
  const container = document.getElementById('tahapChart');
  const tahapCount = { prescribing: 0, transcribing: 0, dispensing: 0, administering: 0 };

  Object.values(detailMap).forEach(itemIds => {
    itemIds.forEach(id => {
      const item = allItems.find(x => x.id === id);
      if (item && tahapCount[item.tahap] !== undefined) {
        tahapCount[item.tahap]++;
      }
    });
  });

  const labels = {
    prescribing: '💊 Prescribing',
    transcribing: '📝 Transcribing',
    dispensing: '📦 Dispensing',
    administering: '💉 Administering'
  };

  const colors = {
    prescribing: 'var(--primary)',
    transcribing: 'var(--info)',
    dispensing: 'var(--warning)',
    administering: 'var(--orange)'
  };

  const maxCount = Math.max(...Object.values(tahapCount), 1);

  container.innerHTML = Object.keys(tahapCount).map(t => {
    const count = tahapCount[t];
    const percent = (count / maxCount) * 100;
    return `
      <div class="bar-row">
        <div class="bar-label"><small>${labels[t]}</small></div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${percent}%;background:${colors[t]}"></div>
        </div>
        <div class="bar-value">${count}</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// CHART: TOP 5 RUANGAN
// ============================================================
function renderRuanganChart() {
  const container = document.getElementById('ruanganChart');
  const counts = {};

  allLaporan.forEach(l => {
    const nama = l.ruangan?.nama_ruangan || '(Tidak diketahui)';
    counts[nama] = (counts[nama] || 0) + 1;
  });

  const top5 = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!top5.length) {
    container.innerHTML = '<p class="text-muted text-center">Belum ada data</p>';
    return;
  }

  const maxCount = Math.max(...top5.map(x => x[1]), 1);

  container.innerHTML = top5.map(([nama, count], idx) => {
    const percent = (count / maxCount) * 100;
    return `
      <div class="bar-row">
        <div class="bar-label">
          <small><b>#${idx + 1}</b> ${escapeHtml(nama)}</small>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${percent}%;background:var(--primary)"></div>
        </div>
        <div class="bar-value">${count}</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// CHART: TREN BULANAN
// ============================================================
function renderTrenChart() {
  const container = document.getElementById('trenChart');

  // Ambil 12 bulan terakhir
  const bulanArr = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bulanArr.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { month: 'short' })
    });
  }

  const counts = {};
  bulanArr.forEach(b => counts[b.key] = 0);

  allLaporan.forEach(l => {
    const key = l.tgl_laporan.substring(0, 7);
    if (counts[key] !== undefined) counts[key]++;
  });

  const maxCount = Math.max(...Object.values(counts), 1);

  // Tinggi minimum 15% biar tetap kelihatan
  container.innerHTML = `
    <div class="tren-chart">
      ${bulanArr.map(b => {
        const count = counts[b.key];
        const heightPercent = count > 0 
          ? Math.max((count / maxCount) * 85, 15)  // minimal 15% kalau ada data
          : 3;  // 3% kalau 0 (bar kecil tetap tampil)
        return `
          <div class="tren-bar-wrapper" title="${b.label}: ${count} laporan">
            <div class="tren-value">${count > 0 ? count : ''}</div>
            <div class="tren-bar" style="height:${heightPercent}%"></div>
            <div class="tren-label">${b.label}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  document.getElementById('btnApplyFilter').addEventListener('click', loadDashboard);
  document.getElementById('btnResetFilter').addEventListener('click', () => {
    document.getElementById('filterTahun').value = new Date().getFullYear();
    document.getElementById('filterDari').value = '';
    document.getElementById('filterSampai').value = '';
    loadDashboard();
  });

  // Quick filters
  document.getElementById('btnQuickBulanIni').addEventListener('click', () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    document.getElementById('filterTahun').value = '';
    document.getElementById('filterDari').value = first.toISOString().split('T')[0];
    document.getElementById('filterSampai').value = last.toISOString().split('T')[0];
    loadDashboard();
  });

  document.getElementById('btnQuickTahunIni').addEventListener('click', () => {
    document.getElementById('filterTahun').value = new Date().getFullYear();
    document.getElementById('filterDari').value = '';
    document.getElementById('filterSampai').value = '';
    loadDashboard();
  });

  document.getElementById('btnQuick7Hari').addEventListener('click', () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    document.getElementById('filterTahun').value = '';
    document.getElementById('filterDari').value = start.toISOString().split('T')[0];
    document.getElementById('filterSampai').value = now.toISOString().split('T')[0];
    loadDashboard();
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
