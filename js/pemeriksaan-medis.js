// ════════════════════════════════════════════════════════
//  KLIKPRO RME — PEMERIKSAAN-MEDIS.JS
//
//  Konsolidasi modul-modul page-medis menjadi satu file:
//
//  ┌─────────────────────────────────────────────────────┐
//  │  SECTION 2  │ Pemeriksaan Medis                     │
//  │             │ • TTV + Antropometri (form sudah ada)  │
//  │             │ • Riwayat Penyakit Dahulu (field baru) │
//  │             │ • Pemeriksaan tambahan dinamis         │
//  │             │   (dari tarif kategori Pemeriksaan)    │
//  ├─────────────────────────────────────────────────────┤
//  │  SECTION 3  │ Pemeriksaan Tambahan                  │
//  │             │ • Lab chip permintaan + input hasil    │
//  │             │   (dari tarif kategori Laboratorium)   │
//  │             │ • Penunjang chip + panel hasil         │
//  │             │   (dari tarif kategori Penunjang)      │
//  ├─────────────────────────────────────────────────────┤
//  │  SECTION 5  │ Tindakan Medis                        │
//  │             │ • Chip tindakan dari tarif             │
//  │             │   (kategori Tindakan)                  │
//  ├─────────────────────────────────────────────────────┤
//  │  SECTION 6  │ Dokumen Kesehatan                     │
//  │             │ • Surat Sakit: modal print             │
//  │             │ • Dokumen Administrasi dinamis         │
//  │             │   (dari tarif kategori Administrasi)   │
//  └─────────────────────────────────────────────────────┘
//
//  Sumber tarif  : window._tarifCache (diisi app.js/biaya.js)
//  State simpan  : req_lab (JSON) di kolom kunjungan
//  Key prefix    :
//    penunjang_  → chip penunjang aktif
//    hasil_penunjang_ → hasil teks penunjang
//    tindakan_   → chip tindakan aktif
//    pemx_       → textarea pemeriksaan extra
//    adm_        → checkbox dokumen admin extra
//    lab_req_    → chip permintaan lab
//
//  File MENGGANTIKAN (tidak perlu di-load lagi):
//    pem-penunjang.js   → ✅ digabung di sini
//    tin-medis.js       → ✅ digabung di sini
//    pem-labor.js       → ✅ digabung di sini
//    medis-dinamis.js   → ✅ digabung di sini
//    lab-request.js     → sudah deprecated sebelumnya
//
//  Bergantung pada (harus di-load lebih dulu):
//    - supabase-biaya.js   → sb_getTarif
//    - kunjungan.js        → _renderSectionLabDinamic (akan di-wrap)
// ════════════════════════════════════════════════════════

'use strict';

// ══════════════════════════════════════════════════════
//  GLOBAL STATE
// ══════════════════════════════════════════════════════

window._reqLab              = window._reqLab              || {};  // penunjang chip aktif
window._reqLabHasil         = window._reqLabHasil         || {};  // teks hasil penunjang
window._reqLabFoto          = window._reqLabFoto          || {};  // foto penunjang (Supabase Storage)
window._reqTindakan         = window._reqTindakan         || {};  // tindakan chip aktif
window._reqPemeriksaanExtra = window._reqPemeriksaanExtra || {};  // textarea pemeriksaan extra
window._reqAdminExtra       = window._reqAdminExtra       || {};  // checkbox dokumen admin extra

// ── Item bawaan yang tidak dirender ulang ──
const _PEMERIKSAAN_BAWAAN = [
    'Vital Sign', 'Konsultasi Medis', 'Pemeriksaan Fisik',
    'Anamnesa', 'Anamnesa (Keluhan Utama)'
];
const _ADMINISTRASI_BAWAAN = ['Surat Keterangan Sakit'];

// ── Nama bucket Supabase Storage (untuk foto penunjang) ──
const _PNJ_BUCKET = 'penunjang-foto';

// ══════════════════════════════════════════════════════
//  SHARED HELPERS
// ══════════════════════════════════════════════════════

function _pm_escHtml(str) {
    if (typeof escHtml === 'function') return escHtml(str);
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Buat slug id dari prefix + nama */
function _pm_slug(prefix, nama) {
    return prefix + '_' + String(nama || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/** Ambil tarif aktif dari cache untuk satu kategori, kecualikan daftar bawaan */
function _pm_getTarif(kategori, exclude = []) {
    return (window._tarifCache || []).filter(t =>
        t.aktif &&
        t.kategori === kategori &&
        !exclude.includes(t.nama)
    );
}

/** Ambil ikon dari map, fallback ke default */
function _pm_icon(nama, map, def = '⚙️') {
    const lower = (nama || '').toLowerCase();
    for (const [k, v] of Object.entries(map)) {
        if (lower.includes(k.toLowerCase())) return v;
    }
    return def;
}

// ══════════════════════════════════════════════════════
//  KALKULASI & VALIDASI KLINIS — TTV, Antropometri, Lab
//  (dipindahkan dari utils.js — bagian dari page medis)
// ══════════════════════════════════════════════════════

/** Hitung IMT dari field #bb dan #tb, tampilkan di #imtCalc */
function calculateIMT() {
    const bbEl = document.getElementById('bb');
    const tbEl = document.getElementById('tb');
    const imtEl = document.getElementById('imtCalc');
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

/** Tandai field tensi merah jika melebihi batas normal */
function checkTensi() {
    const sEl = document.getElementById('sistol');
    const dEl = document.getElementById('diastol');
    if (!sEl || !dEl) return;
    const s = parseInt(sEl.value);
    const d = parseInt(dEl.value);
    if (s >= 140) sEl.classList.add('is-high'); else sEl.classList.remove('is-high');
    if (d >= 90)  dEl.classList.add('is-high'); else dEl.classList.remove('is-high');
}

/** Tampilkan alert jika nilai lab (GDS, Kolesterol, Asam Urat) di luar normal */
function checkLabAlert() {
    const gds  = parseFloat(document.getElementById('lab_gds')  ? document.getElementById('lab_gds').value  : '');
    const chol = parseFloat(document.getElementById('lab_chol') ? document.getElementById('lab_chol').value : '');
    const ua   = parseFloat(document.getElementById('lab_ua')   ? document.getElementById('lab_ua').value   : '');
    const alerts = [];
    if (!isNaN(gds))  { if (gds  >= 200) alerts.push(`⚠️ GDS ${gds} mg/dL (Tinggi)`);  else if (gds < 70) alerts.push(`⚠️ GDS ${gds} mg/dL (Rendah)`); }
    if (!isNaN(chol)) { if (chol >= 200) alerts.push(`⚠️ Kolesterol ${chol} mg/dL (Tinggi)`); }
    if (!isNaN(ua))   { if (ua   >  7.0) alerts.push(`⚠️ Asam Urat ${ua} mg/dL (Tinggi)`); }
    const el = document.getElementById('labAlert');
    if (!el) return;
    if (alerts.length > 0) { el.innerHTML = alerts.join(' &nbsp;|&nbsp; '); el.style.display = 'block'; }
    else                   { el.style.display = 'none'; }
}

// ══════════════════════════════════════════════════════
//  CSS INJECT — penunjang panel & dokumen modal
// ══════════════════════════════════════════════════════
(function _pm_injectCSS() {
    if (document.getElementById('_css_pemmedis')) return;
    const s = document.createElement('style');
    s.id = '_css_pemmedis';
    s.textContent = `
    @keyframes _pnj_fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes _pnj_pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }
    @keyframes _pnj_spin   { to{transform:rotate(360deg)} }

    .pnj-panel {
        animation:_pnj_fadeIn .22s ease forwards;
        background:#f0f7ff; border:1.5px solid var(--primary,#2563eb);
        border-radius:12px; padding:10px 12px 12px; margin-top:8px; position:relative;
    }
    .pnj-panel-label { font-size:11px;font-weight:700;color:var(--primary,#2563eb);margin-bottom:6px;display:flex;align-items:center;gap:5px; }
    .pnj-textarea {
        width:100%;min-height:96px;resize:vertical;font-size:12px;line-height:1.55;
        padding:9px 44px 9px 10px; border:1.5px solid #c7d9f5; border-radius:8px;
        background:#fff;color:#1e3a8a;outline:none;box-sizing:border-box;font-family:inherit;transition:border-color .15s;
    }
    .pnj-textarea:focus { border-color:var(--primary,#2563eb);box-shadow:0 0 0 3px rgba(37,99,235,.1); }
    .pnj-stt-btn {
        position:absolute;top:38px;right:18px;width:30px;height:30px;border-radius:50%;
        border:1.5px solid #c7d9f5;background:#fff;cursor:pointer;font-size:15px;padding:0;
        display:flex;align-items:center;justify-content:center;transition:all .15s;z-index:2;
    }
    .pnj-stt-btn:hover { background:#e0eaff;border-color:var(--primary,#2563eb); }
    .pnj-stt-btn.recording { background:#fee2e2;border-color:#ef4444;animation:_pnj_pulse 1s infinite; }
    .pnj-foto-label { font-size:10px;font-weight:600;color:#64748b;margin:10px 0 6px;display:flex;align-items:center;gap:4px; }
    .pnj-foto-area  { display:flex;flex-wrap:wrap;gap:7px;align-items:flex-start; }
    .pnj-foto-add {
        width:58px;height:58px;border:2px dashed #c7d9f5;border-radius:9px;background:#f8fbff;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-size:20px;color:#93afd4;user-select:none;transition:border-color .15s,background .15s,color .15s;flex-shrink:0;
    }
    .pnj-foto-add:hover { border-color:var(--primary,#2563eb);background:#e8f0fe;color:var(--primary,#2563eb); }
    .pnj-foto-add.uploading { pointer-events:none;opacity:.6; }
    .pnj-spinner { width:20px;height:20px;border:2.5px solid #c7d9f5;border-top-color:var(--primary,#2563eb);border-radius:50%;animation:_pnj_spin .7s linear infinite; }
    .pnj-foto-thumb { position:relative;width:58px;height:58px;border-radius:9px;overflow:hidden;border:1.5px solid #c7d9f5;flex-shrink:0;cursor:pointer;transition:border-color .15s; }
    .pnj-foto-thumb:hover { border-color:var(--primary,#2563eb); }
    .pnj-foto-thumb img { width:100%;height:100%;object-fit:cover;display:block; }
    .pnj-foto-del { position:absolute;top:2px;right:2px;width:17px;height:17px;border-radius:50%;background:rgba(220,38,38,.88);color:#fff;font-size:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;padding:0;z-index:3; }
    .pnj-foto-del:hover { background:#b91c1c; }
    `;
    document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════════
//  SUPABASE STORAGE — upload/delete foto penunjang
// ══════════════════════════════════════════════════════

async function _sbStorageUploadFoto(file, penunjangId) {
    const ext      = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `${penunjangId}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
    const res = await fetch(`${_SB_URL}/storage/v1/object/${_PNJ_BUCKET}/${filePath}`, {
        method:  'POST',
        headers: { 'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY,
                   'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'true' },
        body: file
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Storage upload gagal (HTTP ' + res.status + ')');
    }
    return `${_SB_URL}/storage/v1/object/public/${_PNJ_BUCKET}/${filePath}`;
}

async function _sbStorageDeleteFoto(publicUrl) {
    try {
        const marker   = `/object/public/${_PNJ_BUCKET}/`;
        const filePath = publicUrl.includes(marker) ? publicUrl.split(marker)[1] : null;
        if (!filePath) return;
        await fetch(`${_SB_URL}/storage/v1/object/${_PNJ_BUCKET}/${filePath}`, {
            method: 'DELETE',
            headers: { 'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY }
        });
    } catch(e) { console.warn('[pemeriksaan-medis] Gagal hapus Storage:', e.message); }
}

// ══════════════════════════════════════════════════════
//  SECTION 3a — CHIP PERMINTAAN LABORATORIUM
//  Chip request (tanda centang) — sebelum isi hasil
//  Dikontrol dari halaman Biaya (kategori Laboratorium)
// ══════════════════════════════════════════════════════

function _renderChipPermintaanLab() {
    const container = document.getElementById('chipsPermintaanLab');
    const wrapper   = document.getElementById('sectionPermintaanLabRequest');
    if (!container || !wrapper) return;

    const labItems = _pm_getTarif('Laboratorium', []);
    if (labItems.length === 0) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = '';

    container.innerHTML = labItems.map(t => {
        const id     = _pm_slug('lab_req', t.nama);
        const active = !!window._reqLab[id];
        return `<button id="chip_${id}" class="lab-req-chip${active ? ' active' : ''}"
            onclick="_toggleLabReqChip('${id}')"
            title="Buat permintaan: ${_pm_escHtml(t.nama)}">
            🔬 ${_pm_escHtml(t.nama)}
        </button>`;
    }).join('');
}

function _toggleLabReqChip(id) {
    window._reqLab[id] = !window._reqLab[id];
    const btn = document.getElementById('chip_' + id);
    if (!btn) return;
    btn.classList.toggle('active', !!window._reqLab[id]);
}

// ══════════════════════════════════════════════════════
//  SECTION 3b — CHIP PEMERIKSAAN PENUNJANG
//  EKG, Rontgen, USG, dll.
//  Dikontrol dari halaman Biaya (kategori Penunjang)
// ══════════════════════════════════════════════════════

const _PENUNJANG_ICONS = {
    'EKG': '🫀', 'Elektrokardiografi': '🫀',
    'Rontgen': '🦴', 'X-Ray': '🦴',
    'USG': '🔊', 'Ultrasonografi': '🔊',
    'Spirometri': '🫁',
    'Audiometri': '👂',
    'Visus': '👁️',
    'Gula': '🍬', 'Glukosa': '🍬',
    'Darah': '🩸',
    'Urin': '🔬', 'Urine': '🔬',
};

function _getPenunjangList() {
    return _pm_getTarif('Penunjang', []).map(t => ({
        id:         _pm_slug('penunjang', t.nama),
        label:      t.nama,
        icon:       _pm_icon(t.nama, _PENUNJANG_ICONS, '🔬'),
        _tarifNama: t.nama
    }));
}

/** Render seluruh section penunjang ke #sectionPermintaanLab */
function renderSectionPermintaanLab() {
    const container = document.getElementById('sectionPermintaanLab');
    if (!container) return;

    const items = _getPenunjangList();
    if (items.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }
    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:4px;';

    const chips = items.map(p => {
        const active = !!window._reqLab[p.id];
        return `<button id="chip_${p.id}"
            onclick="_togglePenunjang('${p.id}')"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid ${active?'#2563eb':'#e2e8f0'};background:${active?'#2563eb':'#fff'};color:${active?'#fff':'var(--text,#334155)'};transition:all .15s;margin:3px 3px 0 0;">
            ${p.icon} ${_pm_escHtml(p.label)}
        </button>`;
    }).join('');

    container.innerHTML = `
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#2563eb;display:inline-block;flex-shrink:0;"></span>
            Pemeriksaan Penunjang
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px;">
            Tandai pemeriksaan penunjang. Petugas akan melihat permintaan ini.
        </div>
        <div id="pnj-chips-wrap" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${chips}</div>
        <div id="pnj-panels-wrap"></div>`;

    // Re-render panel yang sudah aktif
    items.forEach(p => {
        if (window._reqLab[p.id]) _renderPenunjangPanel(p.id, p.label, p.icon);
    });
}

function _togglePenunjang(id) {
    window._reqLab[id] = !window._reqLab[id];
    const btn = document.getElementById('chip_' + id);
    const active = !!window._reqLab[id];
    if (btn) {
        btn.style.background  = active ? '#2563eb' : '#fff';
        btn.style.borderColor = active ? '#2563eb' : '#e2e8f0';
        btn.style.color       = active ? '#fff'    : 'var(--text,#334155)';
    }
    const item = _getPenunjangList().find(p => p.id === id);
    if (active) {
        _renderPenunjangPanel(id, item ? item.label : id, item ? item.icon : '🔬');
    } else {
        const panel = document.getElementById('panel_' + id);
        if (panel) panel.remove();
        delete window._reqLabHasil[id];
        const fotos = window._reqLabFoto[id] || [];
        fotos.forEach(url => _sbStorageDeleteFoto(url).catch(() => {}));
        delete window._reqLabFoto[id];
    }
}

function _renderPenunjangPanel(id, label, icon) {
    const wrap = document.getElementById('pnj-panels-wrap');
    if (!wrap || document.getElementById('panel_' + id)) return;

    const hasilVal = window._reqLabHasil[id] || '';
    const fotos    = window._reqLabFoto[id]  || [];

    const panel = document.createElement('div');
    panel.id    = 'panel_' + id;
    panel.className = 'pnj-panel';
    panel.innerHTML = `
        <div class="pnj-panel-label">${icon} ${_pm_escHtml(label)}</div>
        <div style="position:relative;">
            <textarea id="ta_${id}" class="pnj-textarea"
                placeholder="Catatan / hasil pemeriksaan ${_pm_escHtml(label)}..."
                oninput="_onPenunjangInput('${id}')">${_pm_escHtml(hasilVal)}</textarea>
            <button class="pnj-stt-btn" onclick="_pnj_STT('${id}')">🎙️</button>
        </div>
        <div class="pnj-foto-label">📷 Foto Hasil</div>
        <div class="pnj-foto-area" id="foto_${id}">
            ${fotos.map(url => _pnj_thumbHtml(id, url)).join('')}
            <label class="pnj-foto-add" title="Tambah foto" id="fotoadd_${id}">
                <input type="file" accept="image/*" multiple
                    style="display:none;" onchange="_pnj_onFotoAdd(event,'${id}')">
                <span>＋</span>
                <span style="font-size:9px;margin-top:2px;">Foto</span>
            </label>
        </div>`;
    wrap.appendChild(panel);
}

function _onPenunjangInput(id) {
    const el = document.getElementById('ta_' + id);
    if (!el) return;
    window._reqLabHasil[id] = el.value;
}

function _pnj_thumbHtml(id, url) {
    const safeUrl = _pm_escHtml(url);
    return `<div class="pnj-foto-thumb" onclick="window.open('${safeUrl}','_blank')">
        <img src="${safeUrl}" alt="Foto" loading="lazy">
        <button class="pnj-foto-del" onclick="event.stopPropagation();_pnj_deleteFoto('${id}','${safeUrl}')">✕</button>
    </div>`;
}

async function _pnj_onFotoAdd(event, id) {
    const files  = Array.from(event.target.files || []);
    const addBtn = document.getElementById('fotoadd_' + id);
    if (!files.length) return;
    if (addBtn) addBtn.classList.add('uploading');
    // Show spinner
    const wrap = document.getElementById('foto_' + id);
    const spinner = document.createElement('div');
    spinner.className = 'pnj-spinner';
    if (wrap && addBtn) wrap.insertBefore(spinner, addBtn);
    try {
        const urls = await Promise.all(files.map(f => _sbStorageUploadFoto(f, id)));
        window._reqLabFoto[id] = [...(window._reqLabFoto[id] || []), ...urls];
        // Tambahkan thumbnail
        if (wrap && addBtn) {
            urls.forEach(url => {
                const t = document.createElement('div');
                t.innerHTML = _pnj_thumbHtml(id, url);
                wrap.insertBefore(t.firstElementChild, addBtn);
            });
        }
        showToast('✅ ' + urls.length + ' foto terunggah', 'success');
    } catch(e) {
        showToast('❌ Gagal unggah foto: ' + e.message, 'error');
    } finally {
        spinner.remove();
        if (addBtn) addBtn.classList.remove('uploading');
        event.target.value = '';
    }
}

function _pnj_deleteFoto(id, url) {
    window._reqLabFoto[id] = (window._reqLabFoto[id] || []).filter(u => u !== url);
    _sbStorageDeleteFoto(url).catch(() => {});
    // Hapus thumbnail dari DOM
    const thumb = document.querySelector(`#foto_${id} img[src="${url}"]`);
    if (thumb && thumb.parentElement && thumb.parentElement.classList.contains('pnj-foto-thumb')) {
        thumb.parentElement.remove();
    }
}

function _pnj_STT(id) {
    if (!('webkitSpeechRecognition' in window)) return showToast("❌ Mikrofon tidak didukung", "error");
    const btn = document.querySelector(`.pnj-panel #panel_${id} .pnj-stt-btn`);
    const rec = new webkitSpeechRecognition();
    rec.lang = 'id-ID';
    rec.continuous = false;
    rec.interimResults = false;
    if (btn) btn.classList.add('recording');
    showToast("🎙️ Mendengarkan...", "info");
    rec.start();
    rec.onresult = e => {
        const el = document.getElementById('ta_' + id);
        if (!el) return;
        el.value += (el.value ? ' ' : '') + e.results[0][0].transcript;
        window._reqLabHasil[id] = el.value;
        showToast("✅ Teks ditambahkan", "success");
        if (btn) btn.classList.remove('recording');
    };
    rec.onerror = () => { if (btn) btn.classList.remove('recording'); };
    rec.onend   = () => { if (btn) btn.classList.remove('recording'); };
}

/** Refresh UI semua chip penunjang */
function _refreshPenunjangChipUI() {
    const _doRefresh = () => {
        renderSectionPermintaanLab();
        _renderChipPermintaanLab();
    };
    if (typeof window._ensureTarifCacheThen === 'function') {
        window._ensureTarifCacheThen(_doRefresh);
    } else {
        _doRefresh();
    }
}

// ══════════════════════════════════════════════════════
//  SECTION 5 — TINDAKAN MEDIS
//  Chip button dari tarif kategori Tindakan
// ══════════════════════════════════════════════════════

const _TINDAKAN_ICONS = {
    'Hecting': '🪡', 'Jahit': '🪡',
    'Verband': '🩹', 'Ganti': '🩹',
    'Injeksi': '💉', 'Suntik': '💉',
    'Infus': '🩺', 'Kateter': '🔗',
    'Nebul': '😮‍💨',
    'Insisi': '⚕️',
};

function _getTindakanList() {
    return _pm_getTarif('Tindakan', []).map(t => ({
        id:         _pm_slug('tindakan', t.nama),
        label:      t.nama,
        icon:       _pm_icon(t.nama, _TINDAKAN_ICONS, '⚕️'),
        _tarifNama: t.nama
    }));
}
// Alias lama
Object.defineProperty(window, 'TINDAKAN_LIST', { get: _getTindakanList, configurable: true });

function _renderSectionTindakan() {
    const container = document.getElementById('sectionTindakan');
    if (!container) return;

    const old = document.getElementById('sectionTindakanMedis');
    if (old) old.remove();

    const list = _getTindakanList();
    if (list.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }
    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:8px;';

    const chips = list.map(t => {
        const active = !!window._reqTindakan[t.id];
        return `<button id="chip_${t.id}" onclick="_toggleTindakan('${t.id}')"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid ${active?'#dc2626':'#e2e8f0'};background:${active?'#dc2626':'#fff'};color:${active?'#fff':'var(--text,#334155)'};transition:all .15s;margin:3px 3px 0 0;">
            ${t.icon} ${_pm_escHtml(t.label)}
        </button>`;
    }).join('');

    const div = document.createElement('div');
    div.id    = 'sectionTindakanMedis';
    div.innerHTML = `
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#dc2626;display:inline-block;flex-shrink:0;"></span>
            Tindakan Medis
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px;">
            Tandai tindakan yang dilakukan. Item terpilih masuk ke tagihan otomatis.
        </div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${chips}</div>`;
    container.innerHTML = '';
    container.appendChild(div);
}

function _toggleTindakan(id) {
    window._reqTindakan[id] = !window._reqTindakan[id];
    const btn = document.getElementById('chip_' + id);
    if (!btn) return;
    const active = !!window._reqTindakan[id];
    btn.style.background  = active ? '#dc2626' : '#fff';
    btn.style.borderColor = active ? '#dc2626' : '#e2e8f0';
    btn.style.color       = active ? '#fff'    : 'var(--text,#334155)';
}

function _refreshTindakanChipUI() {
    const _doRefresh = () => {
        _renderSectionTindakan();
        _getTindakanList().forEach(t => {
            const btn = document.getElementById('chip_' + t.id);
            if (!btn) return;
            const active = !!window._reqTindakan[t.id];
            btn.style.background  = active ? '#dc2626' : '#fff';
            btn.style.borderColor = active ? '#dc2626' : '#e2e8f0';
            btn.style.color       = active ? '#fff'    : 'var(--text,#334155)';
        });
    };
    if (typeof window._ensureTarifCacheThen === 'function') {
        window._ensureTarifCacheThen(_doRefresh);
    } else {
        _doRefresh();
    }
}

// ══════════════════════════════════════════════════════
//  SECTION 2 — PEMERIKSAAN EXTRA (dari tarif Pemeriksaan)
// ══════════════════════════════════════════════════════

const _PEMX_COLORS = ['#7c3aed','#0891b2','#059669','#d97706','#db2777','#6366f1'];

function _renderSectionPemeriksaanExtra() {
    const container = document.getElementById('sectionPemeriksaanDinamis');
    if (!container) return;
    const items = _pm_getTarif('Pemeriksaan', _PEMERIKSAAN_BAWAAN);
    if (items.length === 0) { container.innerHTML = ''; container.style.display = 'none'; return; }
    container.style.display = '';
    container.innerHTML = items.map((t, idx) => {
        const slug = _pm_slug('pemx', t.nama);
        const dot  = _PEMX_COLORS[idx % _PEMX_COLORS.length];
        return `<div class="rm-subsection" style="border-bottom:1px dashed var(--border);padding-bottom:14px;margin-bottom:14px;">
            <div class="rm-subsection-label">
                <span class="rm-subsection-dot" style="background:${dot};"></span>
                ${_pm_escHtml(t.nama)}
            </div>
            <div class="form-group" style="position:relative;">
                <label class="form-label">${_pm_escHtml(t.keterangan || t.nama)}</label>
                <textarea id="${slug}" class="form-control" data-save="true"
                    placeholder="Isi ${_pm_escHtml(t.nama).toLowerCase()}..." rows="2"
                    oninput="_onPemxInput('${slug}')"></textarea>
                <button class="stt-btn" onclick="startSTT('${slug}')">🎙️</button>
            </div>
        </div>`;
    }).join('');

    items.forEach(t => {
        const slug = _pm_slug('pemx', t.nama);
        const el   = document.getElementById(slug);
        // BUG-FIX-1: Jangan restore dari localStorage jika data sedang dimuat dari DB
        if (!window._kunjunganLoadingFromDB) {
            const val  = window._reqPemeriksaanExtra[slug] || localStorage.getItem('rme_' + slug) || '';
            if (el && val) { el.value = val; window._reqPemeriksaanExtra[slug] = val; }
        } else {
            const val = window._reqPemeriksaanExtra[slug] || '';
            if (el && val) el.value = val;
        }
    });
}

function _onPemxInput(slug) {
    const el = document.getElementById(slug);
    if (!el) return;
    window._reqPemeriksaanExtra[slug] = el.value;
    localStorage.setItem('rme_' + slug, el.value);
}

// ══════════════════════════════════════════════════════
//  SECTION 6 — DOKUMEN ADMINISTRASI DINAMIS
// ══════════════════════════════════════════════════════

function _renderSectionAdministrasiExtra() {
    const container = document.getElementById('sectionAdministrasiDinamis');
    if (!container) return;
    const items = _pm_getTarif('Administrasi', _ADMINISTRASI_BAWAAN);
    if (items.length === 0) { container.innerHTML = ''; container.style.display = 'none'; return; }
    container.style.display = '';
    container.innerHTML = items.map(t => {
        const slug    = _pm_slug('adm', t.nama);
        const checked = !!window._reqAdminExtra[slug];
        const ne      = _pm_escHtml(t.nama);
        const modalId = 'modal_surat_' + slug;
        return `
        <div class="rm-doc-item" style="border-color:rgba(99,102,241,0.2);background:rgba(99,102,241,0.04);">
            <div class="rm-doc-check">
                <input type="checkbox" id="${slug}"
                    style="width:16px;height:16px;accent-color:var(--primary);"
                    onchange="_onAdmChange('${slug}')"
                    ${checked ? 'checked' : ''}>
                <label for="${slug}" class="rm-doc-label" style="color:var(--primary-dark);">${ne}</label>
                <button id="linkBtn_${slug}"
                    style="display:${checked?'inline-flex':'none'};margin-left:8px;padding:3px 10px;border-radius:20px;border:1.5px solid var(--primary);background:rgba(37,99,235,0.07);color:var(--primary-dark);font-size:11px;font-weight:700;cursor:pointer;"
                    onclick="openModalSuratDinamis('${modalId}','${ne}')">
                    🔗 Lihat Surat
                </button>
            </div>
            <div class="rm-doc-desc">${_pm_escHtml(t.keterangan || 'Centang jika perlu ' + t.nama.toLowerCase())}</div>
        </div>
        <div id="${modalId}" class="modal-surat-overlay" style="display:none;"
            onclick="if(event.target===this)this.style.display='none'">
            <div class="modal-surat-box">
                <div class="modal-surat-header"><span>📄 ${ne}</span>
                    <button class="modal-surat-close"
                        onclick="document.getElementById('${modalId}').style.display='none'">✕</button>
                </div>
                <div class="modal-surat-body" id="body_${modalId}"><div style="padding:20px;text-align:center;color:#94a3b8;">Memuat...</div></div>
                <div class="modal-surat-footer">
                    <button onclick="window.print()" class="modal-surat-btn-print">🖨️ Cetak</button>
                    <button onclick="document.getElementById('${modalId}').style.display='none'" class="modal-surat-btn-close">Tutup</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function _onAdmChange(slug) {
    const el    = document.getElementById(slug);
    const btnEl = document.getElementById('linkBtn_' + slug);
    if (!el) return;
    window._reqAdminExtra[slug] = el.checked;
    if (btnEl) btnEl.style.display = el.checked ? 'inline-flex' : 'none';
}

/** Toggle surat sakit hardcoded */
function _onSuratSakitChange() {
    const el    = document.getElementById('suratSakit');
    const btnEl = document.getElementById('btnLihatSuratSakit');
    if (btnEl) btnEl.style.display = (el && el.checked) ? 'inline-flex' : 'none';
}

/** Buka modal surat sakit hardcoded */
function bukaModalSuratSakit() {
    const modal  = document.getElementById('modalSuratSakit');
    const bodyEl = document.getElementById('bodySuratSakit');
    if (!modal || !bodyEl) return;
    _isiKontenSurat(bodyEl, 'Surat Keterangan Sakit');
    modal.style.display = 'flex';
}

/** Buka modal surat dinamis (dokumen admin extra) */
function openModalSuratDinamis(modalId, namaSurat) {
    const modal  = document.getElementById(modalId);
    const bodyEl = document.getElementById('body_' + modalId);
    if (!modal || !bodyEl) return;
    _isiKontenSurat(bodyEl, namaSurat);
    modal.style.display = 'flex';
}

/** Render konten surat dengan data pasien aktif */
function _isiKontenSurat(bodyEl, namaSurat) {
    const namaEl = document.getElementById('infoPasienNama');
    const nikEl  = document.getElementById('infoPasienNik');
    const umurEl = document.getElementById('infoPasienUmur');
    const nama   = ((namaEl ? namaEl.innerText : '') || localStorage.getItem('cP_nama') || '—').replace('—','').trim() || '—';
    const nik    = ((nikEl  ? nikEl.innerText  : '') || '').replace(/NIK\s*:?/i,'').trim() || '—';
    const umur   = ((umurEl ? umurEl.innerText : '') || '').replace(/Umur\s*:?/i,'').trim() || '—';
    const tgl    = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    const klinik = window.KLINIK_NAMA || 'Klinik';

    // Ambil diagnosa
    const diagEl = document.getElementById('diagnosa');
    const diag   = diagEl ? (diagEl.value.trim() || '—') : '—';

    bodyEl.innerHTML = `
        <div style="font-family:Georgia,serif;padding:20px 24px;line-height:1.7;color:#1e293b;">
            <div style="text-align:center;border-bottom:2px solid #1e293b;padding-bottom:10px;margin-bottom:18px;">
                <div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${_pm_escHtml(klinik)}</div>
                <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">${_pm_escHtml(namaSurat)}</div>
            </div>
            <p style="margin-bottom:8px;">Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
            <table style="width:100%;font-size:13px;margin-bottom:14px;border-collapse:collapse;">
                <tr><td style="width:130px;padding:3px 0;">Nama</td><td style="padding:3px 0;">: <strong>${_pm_escHtml(nama)}</strong></td></tr>
                <tr><td style="padding:3px 0;">NIK</td><td style="padding:3px 0;">: ${_pm_escHtml(nik)}</td></tr>
                <tr><td style="padding:3px 0;">Umur</td><td style="padding:3px 0;">: ${_pm_escHtml(umur)}</td></tr>
                <tr><td style="padding:3px 0;">Diagnosa</td><td style="padding:3px 0;">: ${_pm_escHtml(diag)}</td></tr>
            </table>
            <p style="margin-bottom:18px;">
                Berdasarkan hasil pemeriksaan, yang bersangkutan <strong>tidak dapat bekerja / beraktivitas</strong>
                dan dianjurkan untuk istirahat.
            </p>
            <div style="text-align:right;margin-top:30px;">
                <div style="font-size:12px;">Pekanbaru, ${tgl}</div>
                <div style="font-size:12px;margin-top:4px;">Dokter Pemeriksa,</div>
                <div style="margin-top:52px;font-size:13px;font-weight:700;border-top:1px solid #1e293b;
                    display:inline-block;min-width:150px;text-align:center;">( ________________ )</div>
            </div>
        </div>`;
}

// ══════════════════════════════════════════════════════
//  RENDER MASTER — renderMedisDinamis()
//  Dipanggil saat halaman terbuka atau tarif berubah
// ══════════════════════════════════════════════════════

function renderMedisDinamis() {
    const _doRender = () => {
        try { _renderSectionPemeriksaanExtra();  } catch(e) { console.warn('[pemeriksaan-medis] pemx:', e.message); }
        try { _renderSectionAdministrasiExtra(); } catch(e) { console.warn('[pemeriksaan-medis] adm:', e.message); }
        try { _renderSectionTindakan();          } catch(e) { console.warn('[pemeriksaan-medis] tindakan:', e.message); }
        try { _renderChipPermintaanLab();        } catch(e) { console.warn('[pemeriksaan-medis] lab chip:', e.message); }
    };
    if ((!window._tarifCache || window._tarifCache.length === 0)
        && window._biayaAktif && typeof sb_getTarif === 'function') {
        sb_getTarif().then(tarif => { window._tarifCache = tarif || []; _doRender(); }).catch(() => {});
        return;
    }
    _doRender();
}

// ══════════════════════════════════════════════════════
//  PAYLOAD — getReqLabPayload()
//  Dikumpulkan oleh saveAll() → disimpan ke kolom req_lab
// ══════════════════════════════════════════════════════

function getReqLabPayload() {
    const payload = {};

    // Penunjang: chip aktif + hasil
    Object.entries(window._reqLab || {}).forEach(([k, v]) => {
        if (!v) return;
        payload[k] = true;
        const hasil = (window._reqLabHasil || {})[k];
        if (hasil && hasil.trim()) payload['hasil_' + k] = hasil.trim();
        // Foto URLs
        const fotos = (window._reqLabFoto || {})[k];
        if (fotos && fotos.length) payload['foto_' + k] = fotos;
    });

    // Tindakan
    Object.entries(window._reqTindakan || {}).forEach(([k, v]) => {
        if (v) payload[k] = true;
    });

    // Pemeriksaan extra
    Object.entries(window._reqPemeriksaanExtra || {}).forEach(([k, v]) => {
        if (v && String(v).trim()) payload[k] = String(v).trim();
    });

    // Admin extra
    Object.entries(window._reqAdminExtra || {}).forEach(([k, v]) => {
        if (v) payload[k] = true;
    });

    return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
}

// ══════════════════════════════════════════════════════
//  LOAD — loadReqLabFromKunjungan()
//  Restore semua state chip dari data req_lab DB
// ══════════════════════════════════════════════════════

function loadReqLabFromKunjungan(reqLabJson) {
    window._reqLab              = {};
    window._reqTindakan         = {};
    window._reqLabHasil         = {};
    window._reqLabFoto          = {};
    window._reqPemeriksaanExtra = {};
    window._reqAdminExtra       = {};

    if (!reqLabJson) { _refreshAllChipUI(); return; }

    let parsed = {};
    try { parsed = typeof reqLabJson === 'string' ? JSON.parse(reqLabJson) : reqLabJson; }
    catch(e) { _refreshAllChipUI(); return; }

    Object.entries(parsed).forEach(([k, v]) => {
        if (!v) return;
        if (k.startsWith('penunjang_') && !k.startsWith('hasil_') && !k.startsWith('foto_')) {
            window._reqLab[k] = true;
        }
        if (k.startsWith('hasil_penunjang_')) {
            const chipId = k.replace('hasil_penunjang_', 'penunjang_');
            window._reqLabHasil[chipId] = v;
        }
        if (k.startsWith('foto_penunjang_') && Array.isArray(v)) {
            const chipId = k.replace('foto_penunjang_', 'penunjang_');
            window._reqLabFoto[chipId] = v;
        }
        if (k.startsWith('tindakan_'))  window._reqTindakan[k] = true;
        if (k.startsWith('pemx_') && v) window._reqPemeriksaanExtra[k] = v;
        if (k.startsWith('adm_')  && v) window._reqAdminExtra[k] = true;
        // Lab request chips
        if (k.startsWith('lab_req_'))   window._reqLab[k] = true;
    });

    _refreshAllChipUI();
}

function _refreshAllChipUI() {
    renderMedisDinamis();
    renderSectionPermintaanLab();
    _renderChipPermintaanLab();

    // Restore adm checkboxes
    Object.entries(window._reqAdminExtra || {}).forEach(([k, v]) => {
        const el    = document.getElementById(k);
        const btnEl = document.getElementById('linkBtn_' + k);
        if (el) el.checked = !!v;
        if (btnEl) btnEl.style.display = v ? 'inline-flex' : 'none';
    });

    // Restore pemx textareas
    Object.entries(window._reqPemeriksaanExtra || {}).forEach(([k, v]) => {
        const el = document.getElementById(k);
        if (el) el.value = v || '';
    });
}

// Alias _refreshChipUI lama
window._refreshChipUI = _refreshAllChipUI;

// ══════════════════════════════════════════════════════
//  HOOK — _renderSectionLabDinamic (dari kunjungan.js)
//  Wrap agar semua section dinamis ikut dirender
// ══════════════════════════════════════════════════════

(function _hookRenderSectionLabDinamic() {
    function _tryHook() {
        const _orig = window._renderSectionLabDinamic;
        if (typeof _orig !== 'function') { setTimeout(_tryHook, 100); return; }
        if (_orig._pemMedisHooked) return;

        window._renderSectionLabDinamic = function() {
            _orig.apply(this, arguments);
            try { renderMedisDinamis(); } catch(e) {}
        };
        window._renderSectionLabDinamic._pemMedisHooked = true;
    }
    _tryHook();
})();

// ══════════════════════════════════════════════════════
//  HOOK — _isiFormDariKunjungan (kunjungan.js)
//  Restore state chip saat buka rekam medis lama
// ══════════════════════════════════════════════════════

(function _hookIsiformDariKunjungan() {
    function _doHook() {
        const _orig = window._isiFormDariKunjungan;
        if (typeof _orig !== 'function') return false;
        if (_orig._pemMedisIsiHooked) return true;

        window._isiFormDariKunjungan = function(kunjunganData) {
            _orig.apply(this, arguments);
            try {
                let reqObj = {};
                if (kunjunganData && kunjunganData.req_lab) {
                    reqObj = typeof kunjunganData.req_lab === 'string'
                        ? JSON.parse(kunjunganData.req_lab)
                        : kunjunganData.req_lab;
                }
                const _doLoad = () => {
                    renderMedisDinamis();
                    loadReqLabFromKunjungan(typeof reqObj === 'object' ? JSON.stringify(reqObj) : reqObj);

                    // Restore riwayat_penyakit
                    if (kunjunganData.riwayat_penyakit && document.getElementById('riwayat_penyakit')) {
                        document.getElementById('riwayat_penyakit').value = kunjunganData.riwayat_penyakit;
                        localStorage.setItem('rme_riwayat_penyakit', kunjunganData.riwayat_penyakit);
                    }

                    // Restore surat sakit button
                    const ss = document.getElementById('suratSakit');
                    if (ss) { _onSuratSakitChange(); }

                    // BUG-FIX-1: Reset flag setelah semua data dari DB selesai dimuat
                    window._kunjunganLoadingFromDB = false;
                };
                if (typeof window._ensureTarifCacheThen === 'function') {
                    window._ensureTarifCacheThen(_doLoad);
                } else { _doLoad(); }
            } catch(e) { window._kunjunganLoadingFromDB = false; console.warn('[pemeriksaan-medis] gagal load:', e.message); }
        };
        window._isiFormDariKunjungan._pemMedisIsiHooked = true;
        return true;
    }
    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let i = 0;
                const t = setInterval(() => { if (_doHook() || ++i > 50) clearInterval(t); }, 100);
            }
        });
    }
})();

// ══════════════════════════════════════════════════════
//  HOOK — sb_autoTagihanFromKunjungan (supabase-biaya.js)
//  Tambah item tindakan, penunjang, pemx, adm ke tagihan
// ══════════════════════════════════════════════════════

(function _hookAutoTagihan() {
    function _doHook() {
        const _orig = window.sb_autoTagihanFromKunjungan;
        if (typeof _orig !== 'function') return false;
        if (_orig._pemMedisTagihanHooked) return true;

        window.sb_autoTagihanFromKunjungan = async function(kunjunganId, kunjunganData) {
            const items = await _orig.apply(this, arguments);
            const tarifAktif = (window._tarifCache || []).filter(t => t.aktif);

            let reqObj = {};
            try { reqObj = kunjunganData.req_lab ? JSON.parse(kunjunganData.req_lab) : {}; } catch(e) {}

            // Tindakan
            _getTindakanList().forEach(t => {
                if (!reqObj[t.id]) return;
                const tarif = tarifAktif.find(x => x.kategori === 'Tindakan' && x.nama === t._tarifNama);
                items.push({ nama_item: 'Tindakan: ' + t.label, kategori: 'Tindakan', jumlah: 1,
                             harga_satuan: tarif ? Number(tarif.harga) : 0, keterangan: null });
            });

            // Penunjang (yang dicentang)
            _getPenunjangList().forEach(p => {
                if (!reqObj[p.id]) return;
                const tarif = tarifAktif.find(x => x.kategori === 'Penunjang' && x.nama === p._tarifNama);
                items.push({ nama_item: 'Penunjang: ' + p.label, kategori: 'Penunjang', jumlah: 1,
                             harga_satuan: tarif ? Number(tarif.harga) : 0, keterangan: null });
            });

            // Pemeriksaan extra
            _pm_getTarif('Pemeriksaan', _PEMERIKSAAN_BAWAAN).forEach(t => {
                const slug = _pm_slug('pemx', t.nama);
                if (reqObj[slug] && String(reqObj[slug]).trim()) {
                    items.push({ nama_item: t.nama, kategori: 'Pemeriksaan', jumlah: 1,
                                 harga_satuan: Number(t.harga) || 0, keterangan: null });
                }
            });

            // Administrasi extra
            _pm_getTarif('Administrasi', _ADMINISTRASI_BAWAAN).forEach(t => {
                const slug = _pm_slug('adm', t.nama);
                if (reqObj[slug]) {
                    items.push({ nama_item: t.nama, kategori: 'Administrasi', jumlah: 1,
                                 harga_satuan: Number(t.harga) || 0, keterangan: null });
                }
            });

            return items;
        };
        window.sb_autoTagihanFromKunjungan._pemMedisTagihanHooked = true;
        return true;
    }
    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let i = 0;
                const t = setInterval(() => { if (_doHook() || ++i > 50) clearInterval(t); }, 100);
            }
        });
    }
})();

// ══════════════════════════════════════════════════════
//  HOOK — getReqLabPayload (bawaan kunjungan.js / global)
//  Jika ada definisi lain → wrap agar data kita ikut
// ══════════════════════════════════════════════════════
// (Karena getReqLabPayload sekarang didefinisikan di file ini,
//  hook di bawah hanya untuk backward-compat jika pem-labor.js
//  lama masih terload bersamaan — aman diabaikan.)

// ══════════════════════════════════════════════════════
//  HOOK — clearSession (utils.js)
//  Reset semua state saat pasien berganti
// ══════════════════════════════════════════════════════

(function _wrapClearSession() {
    const _origClear = window.clearSession;
    if (typeof _origClear !== 'function') return;
    if (_origClear._pemMedisClearHooked) return;

    window.clearSession = function() {
        _origClear.apply(this, arguments);
        window._reqLab              = {};
        window._reqTindakan         = {};
        window._reqLabHasil         = {};
        window._reqLabFoto          = {};
        window._reqPemeriksaanExtra = {};
        window._reqAdminExtra       = {};
    };
    window.clearSession._pemMedisClearHooked = true;
})();

// ══════════════════════════════════════════════════════
//  HOOK — initPageBiaya
//  Re-render dinamis saat tarif berubah dari halaman Biaya
// ══════════════════════════════════════════════════════

(function _hookInitPageBiaya() {
    function _doHook() {
        const _orig = window.initPageBiaya;
        if (typeof _orig !== 'function') return false;
        if (_orig._pemMedisBiayaHooked) return true;
        window.initPageBiaya = async function() {
            await _orig.apply(this, arguments);
            try { renderMedisDinamis(); renderSectionPermintaanLab(); } catch(e) {}
        };
        window.initPageBiaya._pemMedisBiayaHooked = true;
        return true;
    }
    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let i = 0; const t = setInterval(() => { if (_doHook() || ++i > 50) clearInterval(t); }, 100);
            }
        });
    }
})();

// ══════════════════════════════════════════════════════
//  SAFETY NET — render saat DOM siap
// ══════════════════════════════════════════════════════
(function _renderOnReady() {
    const _try = () => {
        if (document.getElementById('sectionTindakan')) renderMedisDinamis();
        if (document.getElementById('sectionPermintaanLab')) renderSectionPermintaanLab();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _try);
    else setTimeout(_try, 0);
})();

console.log('[pemeriksaan-medis] ✅ Loaded — konsolidasi penunjang, tindakan, dokumen, pemx, lab chip');
