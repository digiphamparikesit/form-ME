// ============================================================
// AUTH HANDLER - Login, Logout, Session, Role
// ============================================================

/**
 * Login pakai email atau username.
 * Kalau input bukan email valid, otomatis diubah jadi <username>@me.local
 */
async function login(emailOrUsername, password) {
  let email = emailOrUsername.trim().toLowerCase();

  // Kalau bukan format email, anggap username → tambah domain dummy
  if (!email.includes('@')) {
    email = `${email}@me.local`;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) throw error;
  return data;
}

/** Logout */
async function logout() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

/** Ambil session aktif */
async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

/** Ambil profile user yang sedang login */
async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await db
    .from('profiles')
    .select('*, unit:unit_id(id, nama_unit)')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Gagal ambil profile:', error);
    return null;
  }
  return data;
}

/** Cek apakah user sudah login. Kalau belum, redirect ke login */
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

/** Cek role tertentu. Contoh: requireRole(['admin','pj']) */
async function requireRole(allowedRoles = []) {
  const profile = await getCurrentProfile();
  if (!profile || !allowedRoles.includes(profile.role)) {
    alert('Anda tidak memiliki akses ke halaman ini.');
    window.location.href = 'dashboard.html';
    return null;
  }
  return profile;
}

/** Label role dalam bahasa Indonesia */
function roleLabel(role) {
  const map = {
    admin: 'Administrator',
    petugas: 'Petugas',
    pj: 'Apoteker PJ'
  };
  return map[role] || role;
}

// ============================================================
// EVENT: Form Login (khusus halaman index.html)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return; // bukan halaman login

  // Kalau sudah login, langsung redirect ke dashboard
  getSession().then(session => {
    if (session) window.location.href = 'dashboard.html';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const btnLogin = document.getElementById('btnLogin');
    const btnText = document.getElementById('btnLoginText');
    const btnSpinner = document.getElementById('btnLoginSpinner');
    const errBox = document.getElementById('loginError');
    const successBox = document.getElementById('loginSuccess');

    // Reset pesan
    errBox.style.display = 'none';
    successBox.style.display = 'none';

    // Loading state
    btnLogin.disabled = true;
    btnText.textContent = 'Memproses...';
    btnSpinner.style.display = 'inline-block';

    try {
      await login(emailInput.value, passInput.value);

      successBox.textContent = 'Login berhasil! Mengalihkan...';
      successBox.style.display = 'block';

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 600);

    } catch (err) {
      console.error(err);
      let msg = 'Login gagal. Periksa kembali email/username dan password Anda.';
      if (err.message?.includes('Invalid login credentials')) {
        msg = 'Email/username atau password salah.';
      } else if (err.message?.includes('Email not confirmed')) {
        msg = 'Email belum dikonfirmasi. Hubungi administrator.';
      }
      errBox.textContent = msg;
      errBox.style.display = 'block';

      btnLogin.disabled = false;
      btnText.textContent = 'Masuk';
      btnSpinner.style.display = 'none';
    }
  });
});
