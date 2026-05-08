// ════════════════════════════════════════════════════════
//  KLIKPRO RME — AUTENTIKASI PIN
//  Mengelola layar kunci PIN dan sesi login user (Expire: 3 Jam)
// ════════════════════════════════════════════════════════

let currentPinInput = "";
let loggedInUser    = null; // { nama, jabatan }

// ── INISIALISASI PIN LOCK (CEK SESI 3 JAM) ──
// BUG-02 FIX: Sesi divalidasi dengan token HMAC (userId + expiry) yang disimpan
// bersamaan dengan is_unlocked. Manipulasi localStorage saja tidak cukup karena
// token harus cocok dengan yang dibuat saat login berhasil.
async function initPinLock() {
    const isUnlocked    = localStorage.getItem('is_unlocked');
    const expiryTime    = localStorage.getItem('session_expiry');
    const sessionToken  = localStorage.getItem('session_token');
    const storedUser    = localStorage.getItem('logged_user');
    const now           = Date.now();

    if (isUnlocked === 'true' && expiryTime && now < parseInt(expiryTime) && sessionToken && storedUser) {
        // Verifikasi token — harus cocok dengan yang dibuat saat login
        let parsedUser = null;
        try { parsedUser = JSON.parse(storedUser); } catch(e) {}

        let tokenValid = false;
        if (parsedUser && parsedUser.id) {
            const expectedToken = await _sha256(parsedUser.id + expiryTime);
            tokenValid = (sessionToken === expectedToken);
        }

        if (!tokenValid) {
            // Token tidak cocok — tolak sesi meski is_unlocked = true
            _clearSessionStorage();
        } else {
            // BUG-07 FIX: Re-validasi jabatan dari server agar sesi resign langsung dicabut
            try {
                if (parsedUser && parsedUser.id) {
                    const rows = await _sbFetch(`users?id=eq.${parsedUser.id}&select=id,nama,jabatan&limit=1`);
                    if (rows && rows[0]) {
                        const jabatanServer = (rows[0].jabatan || '').toLowerCase();
                        if (jabatanServer === 'sudah resign') {
                            _clearSessionStorage();
                            showToast && showToast("⛔ Akun Anda sudah tidak aktif.", "error");
                            _tampilkanPinScreen();
                            return;
                        }
                        // Sinkronkan jabatan terbaru ke loggedInUser & localStorage
                        parsedUser.jabatan = rows[0].jabatan;
                        localStorage.setItem('logged_user', JSON.stringify(parsedUser));
                    }
                }
            } catch(e) {
                // Jika fetch gagal (offline), tetap izinkan sesi yang sudah ada
                console.warn('[Klikpro] Gagal re-validasi jabatan dari server:', e.message);
            }

            loggedInUser = parsedUser;

            const pinScreen = document.getElementById('pinScreen');
            if (pinScreen) pinScreen.style.display = 'none';

            const drNameEl = document.getElementById('drName');
            if (drNameEl && localStorage.getItem('rme_drName')) {
                drNameEl.innerText = localStorage.getItem('rme_drName');
            }

            applyRoleRestrictions();
            return;
        }
    }

    // Sesi tidak valid / kedaluwarsa — bersihkan
    _clearSessionStorage();
    _tampilkanPinScreen();
}

function _clearSessionStorage() {
    localStorage.removeItem('is_unlocked');
    localStorage.removeItem('logged_user');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('session_token');
}

function _tampilkanPinScreen() {
    const pinScreen = document.getElementById('pinScreen');
    if (pinScreen) pinScreen.style.display = 'flex';
    loadLoginUsers();
    updatePinDots();
}

// ── MENGAMBIL DAFTAR USER DARI SUPABASE ──
// BUG-05 FIX: Filter user "Sudah Resign" agar tidak muncul di dropdown login.
async function loadLoginUsers() {
    const select = document.getElementById('loginUserSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Memuat user...</option>';

    try {
        const res = await sb_getUsers();
        select.innerHTML = '';

        if (res.status === "success" && res.data && res.data.length > 0) {
            // Hanya tampilkan user yang BUKAN resign
            const aktif = res.data.filter(u => (u.jabatan || '').toLowerCase() !== 'sudah resign');
            if (aktif.length === 0) {
                select.innerHTML = '<option value="">Belum ada user aktif</option>';
                return;
            }
            aktif.forEach((u, i) => {
                const opt       = document.createElement('option');
                opt.value       = u.id;
                opt.textContent = u.nama + ' (' + u.jabatan + ')';
                if (i === 0) opt.selected = true;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Belum ada user / Gagal memuat</option>';
        }
    } catch (e) {
        console.error("Gagal muat user:", e);
        if (select) select.innerHTML = '<option value="">Koneksi bermasalah</option>';
    }
}

// ── INPUT PIN ──
function inputPin(num) {
    if (currentPinInput.length < 6) {
        currentPinInput += num;
        updatePinDots();
        if (currentPinInput.length === 6) setTimeout(checkPinServer, 200);
    }
}

function deletePin() {
    if (currentPinInput.length > 0) {
        currentPinInput = currentPinInput.slice(0, -1);
        updatePinDots();
    }
}

function updatePinDots() {
    const dotsEl = document.getElementById('pinDots');
    if (!dotsEl) return;
    const dots = dotsEl.children;
    for (let i = 0; i < 6; i++) {
        dots[i].className = 'pin-dot' + (i < currentPinInput.length ? ' filled' : '');
    }
}

// ── VERIFIKASI PIN KE SUPABASE ──
async function checkPinServer() {
    const select = document.getElementById('loginUserSelect');
    const userId = select ? select.value : '';

    if (!userId) {
        showPinError("Pilih akun terlebih dahulu!");
        return;
    }

    const subtitle = document.getElementById('pinSubtitle');
    if (subtitle) {
        subtitle.innerText   = "Memverifikasi...";
        subtitle.style.color = "var(--primary)";
    }

    try {
        const res = await sb_verifyPin(userId, currentPinInput);

        if (res.isValid) {
            loggedInUser = res.user;

            // BUG-06 FIX: Blokir login jika jabatan sudah resign,
            // meski PIN cocok (edge case: resign tapi PIN belum dihapus).
            if ((loggedInUser.jabatan || '').toLowerCase() === 'sudah resign') {
                showPinError("Akun ini sudah tidak aktif.");
                return;
            }

            // Sesi 3 jam
            const expiry = Date.now() + (3 * 60 * 60 * 1000);

            // BUG-02 FIX: Buat session token dari user ID + expiry agar
            // tidak bisa di-bypass hanya dengan set localStorage manual.
            const sessionToken = await _sha256(loggedInUser.id + String(expiry));

            localStorage.setItem('is_unlocked',    'true');
            localStorage.setItem('logged_user',    JSON.stringify(loggedInUser));
            localStorage.setItem('session_expiry', expiry);
            localStorage.setItem('session_token',  sessionToken);

            if (res.user) {
                const label = res.user.nama + " (" + res.user.jabatan + ")";
                const drEl  = document.getElementById('drName');
                if (drEl) drEl.innerText = label;
                localStorage.setItem('rme_drName', label);
            }

            unlockScreen();
            applyRoleRestrictions();
        } else {
            showPinError("PIN Salah! Coba lagi.");
        }
    } catch (e) {
        console.error("Gagal verifikasi PIN:", e);
        showPinError("Koneksi gagal. Cek internet.");
    }
}

function showPinError(msg) {
    const subtitle = document.getElementById('pinSubtitle');
    if (subtitle) { subtitle.innerText = msg; subtitle.style.color = "var(--danger)"; }

    const dotsEl = document.getElementById('pinDots');
    if (dotsEl) Array.from(dotsEl.children).forEach(d => d.classList.add('error'));

    setTimeout(() => {
        currentPinInput = "";
        updatePinDots();
        if (subtitle) { subtitle.style.color = ""; subtitle.innerText = "Masukkan PIN 6 Digit"; }
    }, 1300);
}

function unlockScreen() {
    const screen = document.getElementById('pinScreen');
    if (screen) {
        screen.classList.add('hidden');
        setTimeout(() => { screen.style.display = 'none'; }, 420);
    }
    if (typeof showToast === 'function') {
        showToast("🔓 Selamat datang, " + (loggedInUser ? loggedInUser.nama : ''), "success");
    }
}

// ════════════════════════════════════════════════════════
//  PEMBATASAN AKSES BERDASARKAN JABATAN
//  Menggunakan applyModuleAccess() dari settings.js (sistem baru)
//  + fallback ke logika lama jika settings.js belum load
// ════════════════════════════════════════════════════════
function applyRoleRestrictions() {
    if (!loggedInUser) return;

    const jabatan = loggedInUser.jabatan;

    // ── Gunakan sistem hak akses per-modul dari settings.js ──
    if (typeof applyModuleAccess === 'function') {
        applyModuleAccess(jabatan);
        return;
    }

    // ── FALLBACK LAMA: jika settings.js belum tersedia ──
    const bolehMedis  = (typeof JABATAN_MEDIS !== 'undefined')
                        ? JABATAN_MEDIS.includes(jabatan)
                        : true;
    const isParamedis = jabatan === 'Paramedis';

    // Tombol lanjut periksa
    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.style.display = bolehMedis ? '' : 'none';

    // Sub-seksi klinis
    const sectionKlinis = document.getElementById('sectionKlinis');
    if (sectionKlinis) sectionKlinis.style.display = isParamedis ? 'none' : '';

    // Sembunyikan nav User untuk Paramedis
    document.querySelectorAll('.nav-item').forEach(navEl => {
        const onclick = navEl.getAttribute('onclick') || '';
        if (onclick.includes('pageUser')) {
            navEl.style.display = isParamedis ? 'none' : '';
        }
    });

    window._isParamedis = isParamedis;

    if (!bolehMedis && localStorage.getItem('activePage') === 'pageMedis') {
        localStorage.removeItem('activePage');
    }
}

// ── LOGOUT ──
function logout() {
    localStorage.removeItem('is_unlocked');
    localStorage.removeItem('logged_user');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('rme_drName');
    if (typeof clearSession === 'function') clearSession();
    location.reload();
}

// ── CEK AKSES SEBELUM KE pageMedis ──
function canAccessMedis() {
    if (!loggedInUser) {
        if (typeof showToast === 'function') showToast("⛔ Anda belum login.", "error");
        return false;
    }
    // Cek lewat currentAccess jika sudah load dari settings.js
    if (window._currentAccess) {
        if (!window._currentAccess.includes('mod_pemeriksaan_ttv') &&
            !window._currentAccess.includes('mod_diagnosa')) {
            if (typeof showToast === 'function')
                showToast("⛔ Akses ditolak untuk jabatan " + loggedInUser.jabatan, "error");
            return false;
        }
        return true;
    }
    // Fallback lama
    if (typeof JABATAN_MEDIS !== 'undefined' && !JABATAN_MEDIS.includes(loggedInUser.jabatan)) {
        if (typeof showToast === 'function')
            showToast("⛔ Akses ditolak. Hanya Dokter, Admin & Paramedis.", "error");
        return false;
    }
    return true;
}
