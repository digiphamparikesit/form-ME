// ============================================================
// SAFE QUERY - Anti-Freeze & Auto-Retry System
// ============================================================

const RETRY_DELAY_MS = 3000;   // Jeda 3 detik sebelum retry
const MAX_RETRY = 3;           // Maksimal 3x percobaan
const TIMEOUT_MS = 10000;      // Batalkan jika lewat 10 detik

const logBuffer = [];

function pushLog(type, msg) {
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
  logBuffer.unshift({ time, type, msg });
  if (logBuffer.length > 20) logBuffer.pop();
  renderLogs();
}

function renderLogs() {
  const el = document.getElementById('logList');
  if (!el) return;
  if (logBuffer.length === 0) {
    el.innerHTML = `<div class="log-line"><span class="log-time">[--:--:--]</span> <span class="log-info">Log akan muncul di sini...</span></div>`;
    return;
  }
  el.innerHTML = logBuffer.map(l =>
    `<div class="log-line"><span class="log-time">[${l.time}]</span> <span class="log-${l.type}">${escapeHtml(l.msg)}</span></div>`
  ).join('');
}

function clearLogs() {
  logBuffer.length = 0;
  renderLogs();
  if (typeof showToast === 'function') showToast('Log dibersihkan', 'info');
}

async function safeQuery(queryName, queryFn) {
  const startTime = Date.now();
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => { isTimeout = true; controller.abort(); }, TIMEOUT_MS);

    try {
      pushLog('info', `[${queryName}] Percobaan ${attempt}/${MAX_RETRY}...`);
      const result = await queryFn(controller.signal);
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      if (result && result.error) {
        const errMsg = result.error.message || String(result.error);
        pushLog('err', `[${queryName}] Gagal: ${errMsg}`);
        // Jika error bukan masalah jaringan, jangan di-retry
        if (!/network|fetch|timeout|ECONNRESET|502|503|504|JWT|AbortError/i.test(errMsg)) {
          return { ...result, attempt, elapsed };
        }
        if (attempt < MAX_RETRY) {
          pushLog('warn', `[${queryName}] Retry dalam ${RETRY_DELAY_MS/1000}s...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        return { ...result, attempt, elapsed };
      }
      pushLog('ok', `[${queryName}] Sukses dalam ${elapsed}ms (percobaan ${attempt})`);
      return { ...result, attempt, elapsed };
    } catch (err) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      const errMsg = isTimeout ? `Timeout (Koneksi terputus paksa)` : (err.message || String(err));
      pushLog('err', `[${queryName}] ${errMsg}`);
      if (attempt < MAX_RETRY) {
        pushLog('warn', `[${queryName}] Retry dalam ${RETRY_DELAY_MS/1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
         return { error: { message: errMsg }, attempt, elapsed };
      }
    }
  }
}
