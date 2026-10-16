// ============================================================
// CETAK PDF - Generate PDF Landscape
// ============================================================

let allLaporan = [];
let currentProfile = null;

const TAHAP_LABEL = {
  prescribing: 'Prescribing Error',
  transcribing: 'Transcribing Error',
  dispensing: 'Dispensing Error',
  administering: 'Administering Error'
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await renderLayout('cetak-pdf.html');
  currentProfile = await getCurrentProfile();
  if (!currentProfile) return;

  await loadLaporan();
  bindEvents();
});

// ============================================================
// LOAD LAPORAN
// ============================================================
async function loadLaporan() {
  const { data, error } = await db
    .from('laporan_me')
    .select('id, no_laporan, tgl_temuan, nama_pasien, status')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  allLaporan = data || [];

  const select = document.getElementById('pilihLaporan');
  select.innerHTML = '<option value="">-- Pilih Laporan --</option>' +
    allLaporan.map(l =>
      `<option value="${l.id}">${l.no_laporan} — ${l.nama_pasien} (${statusLabel(l.status)})</option>`
    ).join('');
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  document.getElementById('pilihLaporan').addEventListener('change', (e) => {
    const id = e.target.value;
    document.getElementById('btnCetakSatu').disabled = !id;

    if (id) {
      const l = allLaporan.find(x => x.id === id);
      document.getElementById('previewInfo').innerHTML = `
        <p><b>No. Laporan:</b> ${escapeHtml(l.no_laporan)}</p>
        <p><b>Pasien:</b> ${escapeHtml(l.nama_pasien)}</p>
        <p><b>Status:</b> <span class="badge ${statusBadgeClass(l.status)}">${statusLabel(l.status)}</span></p>
      `;
      document.getElementById('previewCard').style.display = 'block';
    } else {
      document.getElementById('previewCard').style.display = 'none';
    }
  });

  document.getElementById('btnCetakSatu').addEventListener('click', async () => {
    const id = document.getElementById('pilihLaporan').value;
    if (!id) return;
    await cetakSatuLaporan(id);
  });

  document.getElementById('btnCetakBatch').addEventListener('click', cetakBatch);
}

// ============================================================
// CETAK 1 LAPORAN
// ============================================================
async function cetakSatuLaporan(id) {
  const btn = document.getElementById('btnCetakSatu');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const data = await fetchLaporanLengkap(id);
    if (!data) throw new Error('Laporan tidak ditemukan');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    await generatePDFPage(doc, data, false);
    doc.save(`ME_${data.laporan.no_laporan.replace(/\//g, '_')}.pdf`);

    showToast('✅ PDF berhasil dibuat', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal cetak: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '🖨️ Cetak PDF';
  }
}

// ============================================================
// CETAK BATCH (banyak laporan)
// ============================================================
async function cetakBatch() {
  const dari = document.getElementById('batchDari').value;
  const sampai = document.getElementById('batchSampai').value;
  const status = document.getElementById('batchStatus').value;

  const btn = document.getElementById('btnCetakBatch');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    let query = db.from('laporan_me').select('id');
    if (dari) query = query.gte('tgl_laporan', dari);
    if (sampai) query = query.lte('tgl_laporan', sampai);
    if (status) query = query.eq('status', status);

    const { data: list, error } = await query.order('tgl_laporan');
    if (error) throw error;
    if (!list || !list.length) throw new Error('Tidak ada laporan di rentang tersebut');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    for (let i = 0; i < list.length; i++) {
      const data = await fetchLaporanLengkap(list[i].id);
      if (!data) continue;
      await generatePDFPage(doc, data, i > 0);
    }

    doc.save(`ME_Batch_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast(`✅ ${list.length} laporan berhasil dicetak`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal cetak: ' + err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = '📚 Cetak Batch PDF';
  }
}

// ============================================================
// FETCH DATA LENGKAP
// ============================================================
async function fetchLaporanLengkap(id) {
  const [laporanRes, detailRes, itemMasterRes, gradeMasterRes] = await Promise.all([
    db.from('laporan_me').select(`
      *,
      ruangan:ruangan_id(nama_ruangan),
      petugas:petugas_id(nama, profesi),
      verifikator:verified_by(nama)
    `).eq('id', id).single(),

    db.from('laporan_me_detail').select(`
      catatan_lain,
      item:item_monitoring_id(id, tahap, nama_item, urutan)
    `).eq('laporan_id', id),

    db.from('item_monitoring').select('id, tahap, nama_item, urutan').eq('is_active', true).order('tahap').order('urutan'),

    db.from('grade_insiden').select('kode, kategori, deskripsi').order('kode')
  ]);

  if (laporanRes.error) return null;

  return {
    laporan: laporanRes.data,
    detail: detailRes.data || [],
    items: itemMasterRes.data || [],
    grades: gradeMasterRes.data || []
  };
}

// ============================================================
// GENERATE 1 HALAMAN PDF
// ============================================================
async function generatePDFPage(doc, data, addNewPage = true) {
  const { laporan, detail, items, grades } = data;

  if (addNewPage) doc.addPage('a4', 'landscape');

  const pageW = 297;
  const pageH = 210;
  const margin = 10;
  let y = 12;

  // ============ HEADER ============
  try {
    const img = await loadImageAsDataURL('assets/img/logo-rsud.png');
    doc.addImage(img, 'PNG', margin, y, 20, 20);
  } catch (e) { /* skip kalau logo gagal */ }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FORMULIR MONITORING MEDICATION ERROR (ME)', pageW / 2, y + 5, { align: 'center' });

  doc.setFontSize(10);
  doc.text('RSUD AM PARIKESIT', pageW / 2, y + 11, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`No. Laporan: ${laporan.no_laporan}`, pageW / 2, y + 16, { align: 'center' });

  y += 24;
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ============ INFO 2 KOLOM ============
  doc.setFontSize(9);
  const col1X = margin;
  const col2X = pageW / 2 + 10;

  const info1 = [
    ['Tanggal Temuan', `: ${formatTanggal(laporan.tgl_temuan)} ${laporan.jam_temuan || ''}`],
    ['Tanggal Laporan', `: ${formatTanggal(laporan.tgl_laporan)} ${laporan.jam_laporan || ''}`],
    ['Ruangan/Lokasi', `: ${laporan.ruangan?.nama_ruangan || '-'}`],
    ['Petugas Pelapor', `: ${laporan.petugas?.nama || '-'} (${laporan.petugas?.profesi || '-'})`]
  ];

  const info2 = [
    ['Nama Pasien', `: ${laporan.nama_pasien}`],
    ['No. RM', `: ${laporan.no_rm}`],
    ['DPJP', `: ${laporan.nama_dpjp || '-'}`],
    ['Grade', `: ${laporan.grade || '-'}`]
  ];

  let infoY = y;
  info1.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, col1X, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, col1X + 30, infoY);
    infoY += 5;
  });

  infoY = y;
  info2.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, col2X, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, col2X + 25, infoY);
    infoY += 5;
  });

  y += 24;

  // ============ TABEL MATRIKS ITEM ERROR ============
  // Header
  doc.setFillColor(22, 163, 74);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  // ===== KALKULASI LEBAR KOLOM =====
  const gradeKodes = ['A','B','C','D','E','F','G','H','I'];
  const gradeCellW = 6;                                 // lebar 1 kolom grade
  const gradeTotalW = gradeKodes.length * gradeCellW;   // 9 × 6 = 54mm
  const gradeStartX = pageW - margin - gradeTotalW;     // titik mulai kolom A
  const itemColEndX = gradeStartX - 2;                  // batas kanan kolom item

  // Posisi kolom
  const colNo = margin + 2;
  const colTahap = margin + 12;
  const colItem = margin + 48;

  // ===== HEADER BAR =====
  doc.setFillColor(22, 163, 74);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  // Label utama
  doc.text('NO', colNo, y + 5);
  doc.text('TAHAPAN', colTahap, y + 5);
  doc.text('MONITORING MEDICATION ERROR', colItem, y + 5);

  // Grade headers (center-align di tiap cell)
  gradeKodes.forEach((k, i) => {
    const centerX = gradeStartX + (i * gradeCellW) + (gradeCellW / 2);
    doc.text(k, centerX, y + 5, { align: 'center' });
  });

  // Garis pemisah vertical antar kolom grade (garis putih tipis)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  for (let i = 0; i <= gradeKodes.length; i++) {
    const xLine = gradeStartX + (i * gradeCellW);
    doc.line(xLine, y, xLine, y + 7);
  }

  y += 7;

  // ============ ROWS ============
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  let rowNum = 1;
  const rowH = 5;
  const tahapOrder = ['prescribing', 'transcribing', 'dispensing', 'administering'];

  tahapOrder.forEach(tahap => {
    const tahapItems = items.filter(it => it.tahap === tahap);
    if (!tahapItems.length) return;

    // Header tahap
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(String(rowNum), colNo, y + 3.5);
    doc.text(TAHAP_LABEL[tahap], colTahap, y + 3.5);
    doc.setFont('helvetica', 'normal');
    y += rowH;

    // Item rows
    tahapItems.forEach(item => {
      const detailItem = detail.find(d => d.item && d.item.id === item.id);
      const isChecked = !!detailItem;

      // Highlight baris kalau item dicentang
      if (isChecked) {
        doc.setFillColor(220, 252, 231);
        doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
      }

      // Item name (wrap kalau panjang)
      const itemText = item.nama_item.length > 70
        ? item.nama_item.substring(0, 70) + '...'
        : item.nama_item;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(itemText, colItem, y + 3.5);

      // Grade checkmark (center-align di kolom grade)
      if (isChecked && laporan.grade) {
        const gradeIdx = gradeKodes.indexOf(laporan.grade);
        if (gradeIdx >= 0) {
          const centerX = gradeStartX + (gradeIdx * gradeCellW) + (gradeCellW / 2);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text('✓', centerX, y + 3.8, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
        }
      }

      y += rowH;

      // Page break kalau kepanjangan
      if (y > pageH - 50) {
        doc.addPage('a4', 'landscape');
        y = 15;

        // Re-draw header tabel di halaman baru
        doc.setFillColor(22, 163, 74);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, y, pageW - margin * 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('NO', colNo, y + 5);
        doc.text('TAHAPAN', colTahap, y + 5);
        doc.text('MONITORING MEDICATION ERROR', colItem, y + 5);
        gradeKodes.forEach((k, i) => {
          const centerX = gradeStartX + (i * gradeCellW) + (gradeCellW / 2);
          doc.text(k, centerX, y + 5, { align: 'center' });
        });
        y += 7;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
      }
    });

    rowNum++;
  });

  // Grid: garis pemisah kolom vertical
  const tableTop = y - (totalRowsRendered * rowH); // ganti sesuai perhitungan Anda
  // Grid horizontal saja (opsional: garis antara header & data)
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.5);
  doc.line(margin, y - (rowNum > 0 ? 2 : 0), pageW - margin, y - (rowNum > 0 ? 2 : 0));

  y += 5;

  // ============ KETERANGAN GRADE ============
  const selectedGrade = grades.find(g => g.kode === laporan.grade);
  if (selectedGrade) {
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, y, pageW - margin * 2, 12, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`GRADE: ${selectedGrade.kode} (${selectedGrade.kategori})`, margin + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const desc = selectedGrade.deskripsi.length > 150
      ? selectedGrade.deskripsi.substring(0, 150) + '...'
      : selectedGrade.deskripsi;
    doc.text(desc, margin + 3, y + 10);

    y += 15;
  }

  // ============ DESKRIPSI & TINDAKAN ============
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DESKRIPSI KEJADIAN:', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(laporan.deskripsi_kejadian || '-', pageW - margin * 2 - 5);
  doc.text(descLines, margin, y);
  y += descLines.length * 3.5 + 3;

  if (laporan.tindakan) {
    doc.setFont('helvetica', 'bold');
    doc.text('TINDAKAN/INTERVENSI:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const tindakanLines = doc.splitTextToSize(laporan.tindakan, pageW - margin * 2 - 5);
    doc.text(tindakanLines, margin, y);
    y += tindakanLines.length * 3.5 + 3;
  }

  // ============ TANDA TANGAN ============
   // ============ TANDA TANGAN ============
  // Geser posisi TTD ke bawah konten, tapi minimal 30mm dari bawah
  const minSignY = pageH - 35;  // batas minimal dari atas halaman untuk TTD
  const signY = Math.max(y + 10, minSignY);
  
  // Kalau signY melebihi tinggi halaman, tambah halaman baru
  let finalSignY = signY;
  if (signY > pageH - 25) {
    doc.addPage('a4', 'landscape');
    finalSignY = 20;
  }

  const signW = 60;
  const leftX = margin + 20;
  const rightX = pageW - margin - signW - 20;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  // Label
  doc.text('Petugas Pelapor,', leftX, finalSignY);
  doc.text('Apoteker PJ / Verifikator,', rightX, finalSignY);

  // Garis tanda tangan
  doc.line(leftX, finalSignY + 18, leftX + signW, finalSignY + 18);
  doc.line(rightX, finalSignY + 18, rightX + signW, finalSignY + 18);

  // Nama
  doc.setFont('helvetica', 'bold');
  doc.text(laporan.petugas?.nama || '(...................)', leftX, finalSignY + 23);
  doc.text(laporan.verifikator?.nama || '(...................)', rightX, finalSignY + 23);
}

// ============================================================
// HELPER: Load image as Data URL
// ============================================================
function loadImageAsDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
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
  t._timeout = setTimeout(() => { t.style.display = 'none'; }, 3500);
}
