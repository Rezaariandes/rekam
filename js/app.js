// ════════════════════════════════════════════════════════
//  KLIKPRO RME — APP.JS (GABUNGAN utils.js + app.js)
//
//  File ini menggabungkan:
//    • utils.js  → helper umum (format, toast, tema, STT, autosave)
//    • app.js    → controller (navigasi, settings, initApp)
//
//  File utils.js TIDAK perlu di-load lagi.
//  Hapus 'jsUtils' dari jsKeys di index.html (sudah dilakukan).
// ════════════════════════════════════════════════════════

'use strict';

// ════════════════════════════════════════════════════════
//  SECTION 1 — UTILITAS & HELPER UMUM  (ex utils.js)
//
//  ✅ GLOBALS BERSIH (semua file lain TIDAK boleh mendefinisikan ulang):
//     escHtml()       — escape HTML, gantikan _escHtml/_pm_escHtml/_escD/_esc
//     fmtRp()         — format Rupiah, gantikan _fmt/_fmtRp
//     formatTglIndo() — format tanggal Indo
//     hitungUmur()    — hitung umur dari tgl_lahir
// ════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ── ESCAPE HTML — definisi kanonik ada di supabase.js (diload lebih dulu).
// Guard ini mencegah redefinisi jika urutan load berubah.
if (typeof window.escHtml !== 'function') {
    window.escHtml = function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
}
const escHtml = window.escHtml;

// ── FORMAT RUPIAH — definisi kanonik ada di supabase.js (diload lebih dulu).
if (typeof window.fmtRp !== 'function') {
    window.fmtRp = function fmtRp(n) {
        return Number(n || 0).toLocaleString('id-ID');
    };
}
const fmtRp = window.fmtRp;

// ── FORMAT TANGGAL ──
function formatTglIndo(tglStr) {
    if (!tglStr) return "";
    tglStr = String(tglStr).trim();
    if (tglStr.includes('/')) return tglStr;
    if (tglStr.includes('-')) {
        const p = tglStr.split('-');
        if (p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return tglStr;
}

function hitungUmur(tglStr) {
    if (!tglStr) return "-";
    tglStr = String(tglStr).trim();
    let parts = tglStr.includes('/') ? tglStr.split('/') : tglStr.split('-');
    let bD = parts.length === 3
        ? (parts[0].length === 4
            ? new Date(parts[0], parts[1] - 1, parts[2])
            : new Date(parts[2], parts[1] - 1, parts[0]))
        : new Date(tglStr);
    if (isNaN(bD)) return "-";
    let age = new Date().getFullYear() - bD.getFullYear();
    let m = new Date().getMonth() - bD.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < bD.getDate())) age--;
    return age + " Thn";
}

// ── TOAST NOTIFICATION ──
function showToast(msg, type) {
    const c = $('toastContainer');
    if (!c) return;
    // Pastikan toastContainer selalu di atas semua overlay/modal
    c.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.style.pointerEvents = 'auto';
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 320);
    }, 3000);
}

// ── TEMA WARNA ──
const themes = [
    { h: 210, name: '#2563eb' },
    { h: 270, name: '#7c3aed' },
    { h: 160, name: '#059669' },
    { h: 340, name: '#db2777' },
    { h: 30,  name: '#d97706' },
    { h: 190, name: '#0891b2' }
];
let currentTheme = 0;
let _themeAutoRotate = true;   // hentikan rotasi jika user memilih manual
let _themeRotateTimer = null;

function applyTheme(idx) {
    const t = themes[idx];
    document.documentElement.style.setProperty('--bg-h', t.h);
    document.querySelectorAll('.color-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function buildColorSwitcher() {
    const sw = document.createElement('div');
    sw.className = 'color-switcher';
    themes.forEach((t, i) => {
        const dot = document.createElement('div');
        dot.className = 'color-dot' + (i === 0 ? ' active' : '');
        dot.style.background = t.name;
        dot.title = 'Tema ' + (i + 1);
        dot.onclick = () => {
            currentTheme = i;
            _themeAutoRotate = false;   // matikan auto-rotate setelah pilihan manual
            applyTheme(i);
        };
        sw.appendChild(dot);
    });
    return sw;
}

// Auto-rotate tema setiap 8 detik — berhenti jika user pilih manual
_themeRotateTimer = setInterval(() => {
    if (!_themeAutoRotate) return;
    currentTheme = (currentTheme + 1) % themes.length;
    applyTheme(currentTheme);
}, 8000);

// ── AUTOSAVE & CLEAR SESSION ──
function loadAutosave() {
    document.querySelectorAll('[data-save="true"]').forEach(el => {
        const v = localStorage.getItem('rme_' + el.id);
        if (v !== null) {
            el.value = v;
            if (el.id === 'bb' || el.id === 'tb') calculateIMT();
            if (el.id === 'sistol' || el.id === 'diastol') checkTensi();
        }
    });
}

function clearSession() {
    document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.removeItem('rme_' + el.id));
    localStorage.removeItem('activePage');
    // Hapus semua keys sesi pasien agar reload tidak restore state lama
    ['cP_id','cK_id','cP_nama','cP_nik','cP_umur','cTglEdit','cP_riwayat','cP_tglLahir'].forEach(k => localStorage.removeItem(k));
    const ss = $('suratSakit');
    if (ss) ss.checked = false;
    const imt = $('imtCalc');
    if (imt) imt.innerText = "";
    const sistol  = $('sistol');
    const diastol = $('diastol');
    if (sistol)  sistol.classList.remove('is-high');
    if (diastol) diastol.classList.remove('is-high');
    _updateRecoverBanner(); // Sembunyikan banner setelah sesi bersih

    // Bersihkan state global agar tidak bocor ke pasien berikutnya
    window._accordionState = {};
    window._invoiceData    = null;
    window._invoiceNama    = '';
    window._invoiceTgl     = '';
    window._statusCache    = {};

    // Notifikasi modul lain (pemeriksaan-medis.js, dll) via event —
    // lebih aman daripada setInterval polling.
    document.dispatchEvent(new CustomEvent('klikpro:clearSession'));
}

// ── BANNER RECOVER: tampil di pageDaftar jika ada draft pasien belum selesai ──
// Muncul otomatis saat ada data sesi (cP_id + cK_id) tapi user sedang di halaman lain.
// User bisa klik "Lanjutkan" untuk kembali ke pageMedis, atau "Abaikan" untuk hapus draft.
function _updateRecoverBanner() {
    const cPId = localStorage.getItem('cP_id');
    const cKId = localStorage.getItem('cK_id');
    const activePage = localStorage.getItem('activePage') || 'pageDaftar';
    const hasDraft = !!(cPId && cKId && cKId !== 'null');
    const showBanner = hasDraft && activePage !== 'pageMedis';

    // Buat atau ambil elemen banner
    let banner = document.getElementById('recoverBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'recoverBanner';
        banner.style.cssText = [
            'position:fixed', 'bottom:80px', 'left:50%',
            'transform:translateX(-50%)',
            'z-index:8888',
            'background:linear-gradient(135deg,#1e40af,#2563eb)',
            'color:#fff',
            'padding:12px 18px',
            'border-radius:14px',
            'box-shadow:0 8px 28px rgba(37,99,235,0.38)',
            'display:flex', 'align-items:center', 'gap:12px',
            'font-family:Sora,sans-serif',
            'font-size:13px',
            'max-width:420px',
            'width:calc(100% - 40px)',
            'transition:opacity .3s,transform .3s',
        ].join(';');

        const namaPasien = localStorage.getItem('cP_nama') || 'Pasien';
        banner.innerHTML = `
            <span style="font-size:20px">📋</span>
            <div style="flex:1;line-height:1.4">
                <div style="font-weight:700;font-size:13px">Pemeriksaan belum selesai</div>
                <div style="opacity:.82;font-size:11px" id="recoverBannerNama">${namaPasien}</div>
            </div>
            <button id="recoverBannerBtn"
                style="background:#fff;color:#1e40af;border:none;border-radius:8px;
                       padding:7px 14px;font-weight:700;font-size:12px;cursor:pointer;
                       font-family:Sora,sans-serif;white-space:nowrap;"
                onclick="_recoverLanjutkan()">Lanjutkan ▶</button>
            <button
                style="background:rgba(255,255,255,0.15);color:#fff;border:none;
                       border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;
                       font-family:Sora,sans-serif;"
                onclick="_recoverAbaikan()" title="Abaikan & hapus draft">✕</button>
        `;
        document.body.appendChild(banner);
    } else {
        // Update nama pasien jika banner sudah ada
        const namaEl = document.getElementById('recoverBannerNama');
        if (namaEl) namaEl.textContent = localStorage.getItem('cP_nama') || 'Pasien';
    }

    banner.style.display = showBanner ? 'flex' : 'none';
}

// ── Lanjutkan ke pageMedis dari banner recover ──
async function _recoverLanjutkan() {
    const cPId = localStorage.getItem('cP_id');
    const cKId = localStorage.getItem('cK_id');
    if (!cPId) return;

    currentPasienId    = cPId;
    currentKunjunganId = (cKId === 'null') ? null : cKId;

    if ($('infoPasienNama'))     $('infoPasienNama').innerText     = localStorage.getItem('cP_nama')  || '—';
    if ($('infoPasienNik'))      $('infoPasienNik').innerText      = localStorage.getItem('cP_nik')   || 'NIK: —';
    if ($('infoPasienUmur'))     $('infoPasienUmur').innerText     = localStorage.getItem('cP_umur')  || 'Umur: -';
    if ($('infoTglPemeriksaan')) {
        $('infoTglPemeriksaan').innerText     = localStorage.getItem('cTglEdit') || 'Tgl: -';
        $('infoTglPemeriksaan').style.display = 'block';
    }
    const _savedTglLahir = localStorage.getItem('cP_tglLahir');
    if ($('infoPasienTglLahir') && _savedTglLahir) {
        $('infoPasienTglLahir').innerText     = _savedTglLahir;
        $('infoPasienTglLahir').style.display = '';
    }

    try {
        currentRiwayat = JSON.parse(localStorage.getItem('cP_riwayat') || '[]');
        if (typeof renderRiwayatList === 'function')
            renderRiwayatList(currentRiwayat, 'historyListMedis');
    } catch(e) { currentRiwayat = []; }

    if (currentKunjunganId) {
        if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
        try {
            const kunjunganData = await sb_getKunjunganById(currentKunjunganId);
            if (kunjunganData && typeof _isiFormDariKunjungan === 'function') {
                _isiFormDariKunjungan(kunjunganData);
                document.querySelectorAll('[data-save="true"]').forEach(el =>
                    localStorage.setItem('rme_' + el.id, el.value)
                );
                if (typeof renderMedisDinamis === 'function')
                    window._ensureTarifCacheThen(() => renderMedisDinamis());
                if (window._stokAktif && typeof loadResepByKunjungan === 'function')
                    loadResepByKunjungan(currentKunjunganId).catch(() => {});
                if (kunjunganData.riwayat_penyakit && $('riwayat_penyakit'))
                    $('riwayat_penyakit').value = kunjunganData.riwayat_penyakit;
            } else {
                if (typeof loadAutosave === 'function') loadAutosave();
            }
        } catch(e) {
            console.warn('[Klikpro] Recover: gagal fetch kunjungan, fallback autosave:', e.message);
            if (typeof loadAutosave === 'function') loadAutosave();
        }
    } else {
        if (typeof loadAutosave === 'function') loadAutosave();
    }

    calculateIMT && calculateIMT();
    checkTensi   && checkTensi();
    checkLabAlert && checkLabAlert();

    switchPage('pageMedis', null);
    setTimeout(() => { if (typeof _applyLockUI === 'function') _applyLockUI(); }, 100);
}

// ── Abaikan draft, hapus sesi pasien ──
function _recoverAbaikan() {
    if (!confirm('Abaikan pemeriksaan yang belum selesai? Data yang belum disimpan ke database akan hilang.')) return;
    if (typeof clearSession === 'function') clearSession();
    showToast && showToast('🗑️ Draft pemeriksaan dihapus.', 'info');
}

// ── INPUT FORMAT TANGGAL LAHIR OTOMATIS ──
function bindTglLahirFormat(inputId) {
    const el = $(inputId);
    if (!el) return;
    el.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '');
        if (v.length > 8) v = v.substring(0, 8);
        if (v.length >= 5)      this.value = v.substring(0, 2) + '/' + v.substring(2, 4) + '/' + v.substring(4, 8);
        else if (v.length >= 3) this.value = v.substring(0, 2) + '/' + v.substring(2, 4);
        else                    this.value = v;
    });
}

// ── SPEECH TO TEXT ──
function startSTT(targetId) {
    if (!('webkitSpeechRecognition' in window)) {
        return showToast("❌ Mikrofon tidak didukung di browser ini", "error");
    }
    const btn = event.currentTarget;
    const rec = new webkitSpeechRecognition();
    rec.lang = 'id-ID';
    rec.continuous = false;
    rec.interimResults = false;
    btn.classList.add('recording');
    showToast("🎙️ Mendengarkan...", "info");
    rec.start();
    rec.onresult = (e) => {
        const el = $(targetId);
        if (!el) return;
        el.value += (el.value ? ' ' : '') + e.results[0][0].transcript;
        localStorage.setItem('rme_' + targetId, el.value);
        showToast("✅ Teks berhasil ditambahkan", "success");
        btn.classList.remove('recording');
    };
    rec.onerror = (e) => {
        showToast("❌ Gagal mendengarkan: " + e.error, "error");
        btn.classList.remove('recording');
    };
    rec.onend = () => btn.classList.remove('recording');
}

// ════════════════════════════════════════════════════════
//  SECTION 2 — APP CONTROLLER  (ex app.js)
//  Inisialisasi aplikasi, navigasi halaman, onload
// ════════════════════════════════════════════════════════

// ── Load logo dari localStorage segera (sebelum settings fetch selesai) ──
(function _earlyLogoApply() {
    try {
        const saved = localStorage.getItem('klikpro_logo');
        if (!saved) return;
        let fav = document.querySelector("link[rel~='icon']");
        if (!fav) { fav = document.createElement('link'); fav.rel='icon'; document.head.appendChild(fav); }
        fav.href = saved;
        const img = document.getElementById('appLogoImg');
        if (img) { img.src = saved; img.style.display = ''; }
    } catch(e) {}
})();

// ── UTILITY — Pastikan _tarifCache terisi sebelum jalankan callback ──
window._ensureTarifCacheThen = function(cb) {
    if (window._tarifCache && window._tarifCache.length > 0) {
        cb();
        return;
    }
    if (!window._biayaAktif || typeof sb_getTarif !== 'function') {
        cb();
        return;
    }
    sb_getTarif().then(tarif => {
        window._tarifCache = tarif || [];
        cb();
    }).catch(() => cb());
};

// ── NAVIGASI HALAMAN ──
function switchPage(id, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    if (navEl) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
        navEl.classList.add('active-nav');
    }

    // ── FIX: Selalu simpan halaman aktif agar refresh kembali ke halaman yang benar ──
    // Data sesi pasien (cP_id, cK_id, dll.) SENGAJA tidak dihapus di sini agar
    // banner "Lanjutkan Pasien" tetap bisa ditampilkan saat user di halaman lain.
    // Sesi bersih setelah: simpan selesai, clearSession(), atau klik Abaikan di banner.
    localStorage.setItem('activePage', id);
    _updateRecoverBanner();

    const filterDate = document.getElementById('filterDate');
    if (id === 'pageKunjungan' && filterDate && filterDate.value) fetchByDate();
    if (id === 'pageUser')     fetchUsers();
    if (id === 'pageMedis' && typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
    // Selalu reset checkbox surat sakit ke unchecked saat masuk pageMedis
    if (id === 'pageMedis') { const ss = document.getElementById('suratSakit'); if (ss) ss.checked = false; }
    // ── Floating save button: paksa tampil/sembunyikan sesuai halaman aktif ──
    // MutationObserver di page-medis.html kadang tidak trigger saat class 'active'
    // ditambahkan via JS, jadi kita trigger manual di sini.
    const _floatBtn = document.getElementById('floatingSaveBtn');
    if (_floatBtn) {
        if (id === 'pageMedis') {
            _floatBtn.style.display = 'flex';
        } else {
            _floatBtn.style.display = 'none';
        }
    }
    if (id === 'pageLaporan') {
        if (typeof loggedInUser !== 'undefined' && loggedInUser) {
            const jabatan = (loggedInUser.jabatan || '').toLowerCase();
            if (jabatan === 'paramedis') {
                showToast("⛔ Akses Laporan hanya untuk Admin & Dokter", "error");
                switchPage('pageDaftar', document.getElementById('navDaftar'));
                return;
            }
        }
        if (typeof initLaporan === 'function') initLaporan();
    }
    if (id === 'pageBiaya') {
        if (typeof initPageBiaya === 'function') initPageBiaya();
    }
    if (id === 'pageStok') {
        if (typeof initPageStok === 'function') initPageStok();
    }
    if (id === 'pageSettings') {
        if (typeof loggedInUser !== 'undefined' && loggedInUser) {
            const jabatan = (loggedInUser.jabatan || '').toLowerCase();
            if (jabatan === 'paramedis') {
                showToast("⛔ Akses Settings hanya untuk Admin & Dokter", "error");
                switchPage('pageDaftar', document.querySelector('.nav-item'));
                return;
            }
        }
        if (typeof initSettings === 'function') initSettings();
    }
}

// ── MUAT KONFIGURASI AWAL DARI SUPABASE ──
async function loadRuntimeSettings() {
    try {
        const data = await sb_getSettings();
        if (data.status !== "success" || !data.settings) return;

        const s = data.settings;

        if (s.klinik_nama)  window.KLINIK_NAMA  = s.klinik_nama;
        window._settingsFull = s;

        // Terapkan logo klinik ke favicon & header
        if (s.klinik_logo && typeof _applyLogoToApp === 'function') {
            _applyLogoToApp(s.klinik_logo);
        }
        if (s.klinik_title) window.KLINIK_TITLE = s.klinik_title;
        if (s.jabatan_medis) {
            const jabList = s.jabatan_medis.split(',').map(j => j.trim()).filter(j => j);
            if (jabList.length > 0) window.JABATAN_MEDIS = jabList;
        }

        const h1   = document.querySelector('.app-title h1');
        const span = document.querySelector('.app-title span');
        if (h1   && s.klinik_title) h1.innerText   = s.klinik_title;
        if (span && s.klinik_nama)  span.innerText  = s.klinik_nama;

        if (s.ocr_api_key && s.ocr_api_key.trim() !== '') {
            window.OCR_API_KEY = s.ocr_api_key.trim();
        }

        const providers = ['gemini','groq','openrouter','openai','mistral','cohere'];
        providers.forEach(p => {
            const rawKey = s[`ai_${p}`];
            if (rawKey && typeof rawKey === 'string') {
                const trimmed = rawKey.trim();
                if (trimmed !== '' && trimmed !== '[]') {
                    try {
                        const keys = JSON.parse(trimmed);
                        if (Array.isArray(keys) && keys.length > 0 && typeof AI_KEYS !== 'undefined') {
                            AI_KEYS[p] = keys;
                            console.log('[Klikpro] AI key loaded: ' + p + ' (' + keys.length + ' key)');
                        }
                    } catch(e) {}
                }
            }
        });

        if (data.dokter) window._dokterAktif = data.dokter;

        // Load lab aktif ke window global agar page-medis bisa pakai sebelum settings dibuka
        if (s.lab_aktif) {
            try {
                window._labAktif = JSON.parse(s.lab_aktif);
            } catch(e) {
                window._labAktif = { lab_gds: true, lab_chol: true, lab_ua: true };
            }
        } else {
            window._labAktif = { lab_gds: true, lab_chol: true, lab_ua: true };
        }

        // Load stok_aktif ke window global
        window._stokAktif = (s.stok_aktif === '1');
        if (window._stokAktif && typeof initStokModule === 'function') {
            initStokModule().catch(() => {});
        }
        const _navStok = document.getElementById('navStok');
        if (_navStok) _navStok.style.display = window._stokAktif ? '' : 'none';

        // Load biaya aktif
        window._biayaAktif = (s.biaya_aktif === '1');
        const _navBiaya = document.getElementById('navBiaya');
        if (_navBiaya) _navBiaya.style.display = window._biayaAktif ? '' : 'none';

        // Recalc nav layout setelah item ditampilkan/disembunyikan
        if (typeof window._fitNav === 'function') setTimeout(window._fitNav, 200);

        // Terapkan hak akses modul setelah settings dimuat
        if (typeof applyModuleAccess === 'function' &&
            typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.jabatan) {
            applyModuleAccess(loggedInUser.jabatan);
        }

    } catch (e) {
        console.warn('[Klikpro] Gagal muat runtime settings:', e.message);
    }
}

// ── INISIALISASI APLIKASI ──
async function initApp() {
    if (typeof initPinLock === 'function') initPinLock();

    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);

    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
        headerDate.innerText = today.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    const filterDate = document.getElementById('filterDate');
    if (filterDate) filterDate.value = localISOTime;

    document.body.appendChild(buildColorSwitcher());

    if (typeof populateIcd10      === 'function') populateIcd10('list-icd');
    if (typeof initScanKtp        === 'function') initScanKtp();
    if (typeof bindTglLahirFormat === 'function') bindTglLahirFormat('tgl_lahir');

    document.querySelectorAll('[data-save="true"]').forEach(el => {
        el.addEventListener('input', () => {
            localStorage.setItem('rme_' + el.id, el.value);
        });
    });

    const bbEl      = $('bb');
    const tbEl      = $('tb');
    const sistolEl  = $('sistol');
    const diastolEl = $('diastol');
    if (bbEl)      bbEl.addEventListener('input', calculateIMT);
    if (tbEl)      tbEl.addEventListener('input', calculateIMT);
    if (sistolEl)  sistolEl.addEventListener('input', checkTensi);
    if (diastolEl) diastolEl.addEventListener('input', checkTensi);

    ['lab_gds','lab_chol','lab_ua'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', checkLabAlert);
    });

    // Load settings & tarif cache dulu — selalu, tanpa pengecualian
    try {
        await loadRuntimeSettings();
    } catch(e) {
        console.warn('[Klikpro] Settings gagal, lanjut dengan default');
    }

    // Pastikan _tarifCache terisi (dibutuhkan chip penunjang & tindakan)
    if (window._biayaAktif && typeof sb_getTarif === 'function'
        && (!window._tarifCache || window._tarifCache.length === 0)) {
        try { window._tarifCache = await sb_getTarif(); }
        catch(e) { console.warn('[Klikpro] Gagal pre-fetch tarif:', e.message); }
    }

    // ── FIX: Restore ke halaman terakhir yang benar (bukan selalu pageMedis) ──
    // Jika ada sesi pasien yang belum selesai (cP_id tersimpan), tampilkan banner
    // "Lanjutkan Pasien" di pageDaftar — user yang memilih kapan mau kembali.
    const _lastPage   = localStorage.getItem('activePage') || 'pageDaftar';
    const _hasDraftPx = !!(localStorage.getItem('cP_id') && localStorage.getItem('cK_id'));

    if (_lastPage === 'pageMedis' && _hasDraftPx) {
        // ── KASUS: refresh SAAT sedang di pageMedis → restore langsung ──
        currentPasienId    = localStorage.getItem('cP_id');
        currentKunjunganId = localStorage.getItem('cK_id');
        if (currentKunjunganId === "null") currentKunjunganId = null;

        if ($('infoPasienNama'))     $('infoPasienNama').innerText     = localStorage.getItem('cP_nama')  || '—';
        if ($('infoPasienNik'))      $('infoPasienNik').innerText      = localStorage.getItem('cP_nik')   || 'NIK: —';
        if ($('infoPasienUmur'))     $('infoPasienUmur').innerText     = localStorage.getItem('cP_umur')  || 'Umur: -';
        if ($('infoTglPemeriksaan')) {
            $('infoTglPemeriksaan').innerText     = localStorage.getItem('cTglEdit') || 'Tgl: -';
            $('infoTglPemeriksaan').style.display = 'block';
        }
        const _savedTglLahir = localStorage.getItem('cP_tglLahir');
        if ($('infoPasienTglLahir') && _savedTglLahir) {
            $('infoPasienTglLahir').innerText     = _savedTglLahir;
            $('infoPasienTglLahir').style.display = '';
        }

        try {
            currentRiwayat = JSON.parse(localStorage.getItem('cP_riwayat') || '[]');
            if (typeof renderRiwayatList === 'function')
                renderRiwayatList(currentRiwayat, 'historyListMedis');
        } catch (e) {
            currentRiwayat = [];
        }

        if (currentKunjunganId) {
            if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
            try {
                const kunjunganData = await sb_getKunjunganById(currentKunjunganId);
                if (kunjunganData && typeof _isiFormDariKunjungan === 'function') {
                    _isiFormDariKunjungan(kunjunganData);
                    document.querySelectorAll('[data-save="true"]').forEach(el =>
                        localStorage.setItem('rme_' + el.id, el.value)
                    );
                    if (typeof renderMedisDinamis === 'function') {
                        window._ensureTarifCacheThen(() => renderMedisDinamis());
                    }
                    if (window._stokAktif && typeof loadResepByKunjungan === 'function') {
                        loadResepByKunjungan(currentKunjunganId).catch(() => {});
                    }
                    if (kunjunganData.riwayat_penyakit && $('riwayat_penyakit')) {
                        $('riwayat_penyakit').value = kunjunganData.riwayat_penyakit;
                    }
                } else {
                    if (typeof loadAutosave === 'function') loadAutosave();
                }
            } catch (e) {
                console.warn('[Klikpro] Gagal fetch kunjungan saat reload, fallback autosave:', e.message);
                if (typeof loadAutosave === 'function') loadAutosave();
            }
            if (currentPasienId && currentPasienId !== 'null') {
                try {
                    const pasienRows = await _sbFetch(`pasien?id=eq.${currentPasienId}&select=alergi&limit=1`);
                    if (pasienRows && pasienRows[0]) {
                        const alergiVal = pasienRows[0].alergi || '';
                        if ($('alergi')) $('alergi').value = alergiVal;
                        localStorage.setItem('rme_alergi', alergiVal);
                    }
                } catch(e) {
                    const saved = localStorage.getItem('rme_alergi');
                    if ($('alergi') && saved) $('alergi').value = saved;
                }
            }
        } else {
            if (typeof loadAutosave === 'function') loadAutosave();
        }

        calculateIMT();
        checkTensi();
        checkLabAlert();

        switchPage('pageMedis', null);
        setTimeout(function(){ if (typeof _applyLockUI === 'function') _applyLockUI(); }, 100);

    } else {
        // ── KASUS NORMAL: buka halaman terakhir yang bukan pageMedis ──
        if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();

        // Restore ke halaman terakhir (bukan pageMedis) jika valid
        const validPages = ['pageDaftar','pageKunjungan','pageUser','pageSettings',
                            'pageLaporan','pageStok','pageBiaya'];
        if (validPages.includes(_lastPage)) {
            const navMap = {
                pageDaftar:    'navDaftar',
                pageKunjungan: 'navKunjungan',
                pageUser:      'navUser',
                pageSettings:  'navSettings',
                pageLaporan:   'navLaporan',
                pageStok:      'navStok',
                pageBiaya:     'navBiaya',
            };
            switchPage(_lastPage, document.getElementById(navMap[_lastPage]) || null);
        }
        // Jika ada draft pasien belum selesai, tampilkan banner recover di pageDaftar
        if (_hasDraftPx) {
            _updateRecoverBanner();
        } else {
            if (typeof clearSession === 'function') clearSession();
        }
    }

    // Ambil data awal via sb_initData (Supabase)
    try {
        const data = await sb_initData(localISOTime);

        allPatients      = data.pasien   || [];
        kunjunganHariIni = data.hariIni  || [];

        const listPasien = document.getElementById('list-pasien');
        if (listPasien && allPatients.length > 0) {
            allPatients.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.nama;
                listPasien.appendChild(opt);
            });
        }

        if (typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();

    } catch (e) {
        showToast("⚡ Gagal terhubung ke server. Cek koneksi.", "error");
        console.error('[Klikpro] initData error:', e);
    }
}

console.log('[app] ✅ Loaded — utils + app controller gabungan');
