// ════════════════════════════════════════════════════════
//  KLIKPRO RME — UTILITAS & HELPER UMUM
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
    const t = document.createElement('div');
    t.className = `toast ${type}`;
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
let _themeAutoRotate = true;   // BUG FIX: hentikan rotasi jika user memilih manual
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
            _themeAutoRotate = false;   // BUG FIX: matikan auto-rotate setelah pilihan manual
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

// ── KALKULASI IMT ──
function calculateIMT() {
    const bbEl = $('bb'); const tbEl = $('tb'); const imtEl = $('imtCalc');
    if (!bbEl || !tbEl || !imtEl) return;
    const bb = parseFloat(bbEl.value);
    const tb = parseFloat(tbEl.value) / 100;
    if (bb && tb && tb > 0) {
        const imt = (bb / (tb * tb)).toFixed(1);
        let kat = imt < 18.5 ? "Underweight" : imt < 25 ? "Normal" : imt < 30 ? "Overweight" : "Obesitas";
        imtEl.innerText = `IMT: ${imt} (${kat})`;
    } else {
        imtEl.innerText = "";
    }
}

// ── CEK TENSI TINGGI ──
function checkTensi() {
    const sEl = $('sistol'); const dEl = $('diastol');
    if (!sEl || !dEl) return;
    const s = parseInt(sEl.value);
    const d = parseInt(dEl.value);
    if (s >= 140) sEl.classList.add('is-high'); else sEl.classList.remove('is-high');
    if (d >= 90)  dEl.classList.add('is-high'); else dEl.classList.remove('is-high');
}

// ── CEK NILAI LAB ABNORMAL ──
function checkLabAlert() {
    const gds  = parseFloat($('lab_gds')  ? $('lab_gds').value  : '');
    const chol = parseFloat($('lab_chol') ? $('lab_chol').value : '');
    const ua   = parseFloat($('lab_ua')   ? $('lab_ua').value   : '');
    const alerts = [];
    if (!isNaN(gds))  { if (gds  >= 200) alerts.push(`⚠️ GDS ${gds} mg/dL (Tinggi)`);  else if (gds < 70) alerts.push(`⚠️ GDS ${gds} mg/dL (Rendah)`); }
    if (!isNaN(chol)) { if (chol >= 200) alerts.push(`⚠️ Kolesterol ${chol} mg/dL (Tinggi)`); }
    if (!isNaN(ua))   { if (ua   >  7.0) alerts.push(`⚠️ Asam Urat ${ua} mg/dL (Tinggi)`); }
    const el = $('labAlert');
    if (!el) return;
    if (alerts.length > 0) { el.innerHTML = alerts.join(' &nbsp;|&nbsp; '); el.style.display = 'block'; }
    else                   { el.style.display = 'none'; }
}
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
    // BUG D FIX: Hapus semua keys sesi pasien agar reload tidak restore state lama
    ['cP_id','cK_id','cP_nama','cP_nik','cP_umur','cTglEdit','cP_riwayat'].forEach(k => localStorage.removeItem(k));
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
