// ════════════════════════════════════════════════════════
//  KLIKPRO RME — AUTENTIKASI PIN (JWT EDGE FUNCTION VERSION)
//
//  ✅ Integrasi dengan Supabase Edge Function (login-pin)
//  ✅ Menggunakan Custom JWT untuk keamanan & Realtime RLS
//  ✅ Penarikan data otomatis setelah login sukses
//  Sesi login user (Expire: 3 Jam)
// ════════════════════════════════════════════════════════

let currentPinInput = "";
let loggedInUser    = null; // { nama, jabatan, id }

// ── INISIALISASI PIN LOCK (CEK SESI 3 JAM) ──
async function initPinLock() {
    const isUnlocked    = localStorage.getItem('is_unlocked');
    const expiryTime    = localStorage.getItem('session_expiry');
    const sessionJwt    = localStorage.getItem('session_jwt'); // Menggunakan JWT Asli
    const storedUser    = localStorage.getItem('logged_user');
    const now           = Date.now();

    if (isUnlocked === 'true' && expiryTime && now < parseInt(expiryTime) && sessionJwt && storedUser) {
        let parsedUser = null;
        try { parsedUser = JSON.parse(storedUser); } catch(e) {}

        if (parsedUser && parsedUser.id) {
            // BUG-07 FIX: Re-validasi jabatan dari server agar sesi resign langsung dicabut
            try {
                // Catatan: _sbFetch di supabase.js menggunakan Authorization: Bearer sessionJwt
                const rows = await _sbFetch(`users?id=eq.${parsedUser.id}&select=id,nama,jabatan&limit=1`);
                if (rows && rows[0]) {
                    const jabatanServer = (rows[0].jabatan || '').toLowerCase();
                    if (jabatanServer === 'sudah resign') {
                        _clearSessionStorage();
                        showToast && showToast("⛔ Akun Anda sudah tidak aktif.", "error");
                        _tampilkanPinScreen();
                        return;
                    }
                    parsedUser.jabatan = rows[0].jabatan;
                    localStorage.setItem('logged_user', JSON.stringify(parsedUser));
                }
            } catch(e) {
                console.warn('[Klikpro] Gagal re-validasi jabatan dari server:', e.message);
            }

            loggedInUser = parsedUser;

            // Jika library supabase-js resmi dimuat, set Auth untuk Realtime WebSocket
            if (typeof supabase !== 'undefined' && supabase.realtime) {
                supabase.realtime.setAuth(sessionJwt);
            }

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

    _clearSessionStorage();
    _tampilkanPinScreen();
}

function _clearSessionStorage() {
    localStorage.removeItem('is_unlocked');
    localStorage.removeItem('logged_user');
    localStorage.removeItem('session_expiry');
    localStorage.removeItem('session_jwt'); // Hapus JWT
}

function _tampilkanPinScreen() {
    const pinScreen = document.getElementById('pinScreen');
    if (pinScreen) pinScreen.style.display = 'flex';
    loadLoginUsers();
    updatePinDots();
}

// ── MENGAMBIL DAFTAR USER DARI SUPABASE ──
async function loadLoginUsers() {
    const select = document.getElementById('loginUserSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Memuat user...</option>';

    try {
        const res = await sb_getUsers();
        select.innerHTML = '';

        if (res.status === "success" && res.data && res.data.length > 0) {
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

// ── VERIFIKASI PIN KE SUPABASE EDGE FUNCTION ──
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
        const pin_hash = await _sha256(currentPinInput);

        // Panggil Edge Function login-pin
        const edgeUrl = _SB_URL + '/functions/v1/login-pin';
        const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + _SB_KEY // Anon key sebagai preflight
            },
            body: JSON.stringify({ userId: userId, pin_hash: pin_hash })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            showPinError(errData.error || "PIN Salah atau Koneksi Gagal!");
            return;
        }

        const data = await response.json();
        loggedInUser = data.user;
        const customJwtToken = data.token; // Custom JWT dari server

        // Blokir login jika jabatan sudah resign
        if ((loggedInUser.jabatan || '').toLowerCase() === 'sudah resign') {
            showPinError("Akun ini sudah tidak aktif.");
            return;
        }

        // Sesi 3 jam
        const expiry = Date.now() + (3 * 60 * 60 * 1000);

        // Simpan sesi dan JWT Asli ke localStorage
        localStorage.setItem('is_unlocked',    'true');
        localStorage.setItem('logged_user',    JSON.stringify(loggedInUser));
        localStorage.setItem('session_expiry', expiry);
        localStorage.setItem('session_jwt',    customJwtToken);

        // Jika Anda menggunakan Supabase JS Official Client untuk Realtime
        if (typeof supabase !== 'undefined' && supabase.realtime) {
            supabase.realtime.setAuth(customJwtToken);
        }

        if (loggedInUser) {
            const label = loggedInUser.nama + " (" + loggedInUser.jabatan + ")";
            const drEl  = document.getElementById('drName');
            if (drEl) drEl.innerText = label;
            localStorage.setItem('rme_drName', label);
        }

        unlockScreen();
        applyRoleRestrictions();
        
        // ✅ Menarik data pasien dengan JWT yang baru!
        if (typeof fetchByDate === 'function') fetchByDate();
        
    } catch (e) {
        console.error("Gagal verifikasi PIN ke Edge Function:", e);
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
// ════════════════════════════════════════════════════════
function applyRoleRestrictions() {
    if (!loggedInUser) return;

    const jabatan = loggedInUser.jabatan;

    if (typeof applyModuleAccess === 'function') {
        applyModuleAccess(jabatan);
        return;
    }

    // ── FALLBACK LAMA ──
    const bolehMedis  = (typeof JABATAN_MEDIS !== 'undefined')
                        ? JABATAN_MEDIS.includes(jabatan)
                        : true;
    const isParamedis = jabatan === 'Paramedis';

    const btnNext = document.getElementById('btnNext');
    if (btnNext) btnNext.style.display = bolehMedis ? '' : 'none';

    const sectionKlinis = document.getElementById('sectionKlinis');
    if (sectionKlinis) sectionKlinis.style.display = isParamedis ? 'none' : '';

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
    if (typeof destroyRealtime === 'function') destroyRealtime();
    _clearSessionStorage();
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
    if (window._currentAccess) {
        const medisModules = [
            'mod_medis_identitas','mod_medis_ttv','mod_medis_anamnesa',
            'mod_medis_fisik','mod_medis_lab','mod_medis_diagnosa',
            'mod_medis_penunjang','mod_medis_tindakan','mod_medis_riwayat'
        ];
        const hasMedisAccess = medisModules.some(m => window._currentAccess.includes(m));
        if (!hasMedisAccess) {
            if (typeof showToast === 'function')
                showToast("⛔ Akses halaman pemeriksaan ditolak untuk jabatan " + loggedInUser.jabatan, "error");
            return false;
        }
        return true;
    }
    if (typeof JABATAN_MEDIS !== 'undefined' && !JABATAN_MEDIS.includes(loggedInUser.jabatan)) {
        if (typeof showToast === 'function')
            showToast("⛔ Akses ditolak. Hanya Dokter, Admin & Paramedis.", "error");
        return false;
    }
    return true;
}

// SHA-256 untuk hash PIN di browser
async function _sha256(text) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
