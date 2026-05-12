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
// ════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

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

    const filterDate = document.getElementById('filterDate');
    if (id === 'pageKunjungan' && filterDate && filterDate.value) fetchByDate();
    if (id === 'pageUser')     fetchUsers();
    if (id === 'pageMedis' && typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
    // Selalu reset checkbox surat sakit ke unchecked saat masuk pageMedis
    if (id === 'pageMedis') { const ss = document.getElementById('suratSakit'); if (ss) ss.checked = false; }
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

    if (localStorage.getItem('activePage') === 'pageMedis') {
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
        // Restore tanggal lahir di banner
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
            // Render section dinamis DULU agar field sudah ada di DOM sebelum diisi
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
                    // Restore resep dari DB (in-memory _resepItems kosong setelah refresh)
                    if (window._stokAktif && typeof loadResepByKunjungan === 'function') {
                        loadResepByKunjungan(currentKunjunganId).catch(() => {});
                    }
                    // Restore riwayat_penyakit
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

            // Fetch alergi dari tabel pasien (data permanen)
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
            // Kunjungan baru (belum disimpan) — pakai autosave
            if (typeof loadAutosave === 'function') loadAutosave();
        }

        calculateIMT();
        checkTensi();
        checkLabAlert();

        switchPage('pageMedis', null);
        setTimeout(function(){ if (typeof _applyLockUI === 'function') _applyLockUI(); }, 100);
    } else {
        if (typeof clearSession === 'function') clearSession();
        // Render dynamic lab section untuk halaman non-pageMedis (normal flow)
        if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
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
