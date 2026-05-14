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
//
//  Catatan load-order:
//    - _renderSectionLabDinamic DIDEFINISIKAN di file ini (bukan wrap dari kunjungan.js)
//    - kunjungan.js memanggil _renderSectionLabDinamic() saat bukaRekamMedisHariIni(),
//      sehingga pemeriksaan-medis.js harus di-load SEBELUM kunjungan.js
//      (atau setidaknya sebelum user membuka rekam medis pertama kali).
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
window._pemxActive          = window._pemxActive          || {};  // BUG-FIX: flag chip pemx aktif (terpisah dari nilai)

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

// escHtml() didefinisikan di supabase.js (diload pertama).
// Alias ini hanya untuk menjaga kompatibilitas pemanggilan internal.
const _pm_escHtml = (str) => window.escHtml(str);

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
//  SECTION 3a — LABORATORIUM ACCORDION + CLICK-TO-INPUT
//  Tampilan accordion per sub_group biaya (mirip penunjang/tindakan).
//  Klik item → aktif + muncul input hasil.
//  Item aktif muncul di halaman Kunjungan sebagai chip lab_req_.
//  Dikontrol dari halaman Biaya (kategori Laboratorium)
// ══════════════════════════════════════════════════════

// Ikon per nama lab
const _LAB_ICONS = {
    'GDS': '🍬', 'Glukosa': '🍬', 'GDP': '🍬', 'HbA1c': '🍬',
    'Kolesterol': '💧', 'HDL': '💧', 'LDL': '💧', 'Trigliserida': '💧',
    'HB': '🩸', 'Hemoglobin': '🩸', 'Hematokrit': '🩸',
    'Trombosit': '🩸', 'Leukosit': '🩸', 'Eritrosit': '🩸', 'Darah Rutin': '🩸',
    'SGOT': '🫀', 'SGPT': '🫀', 'Hati': '🫀',
    'Ureum': '🫘', 'Creatinin': '🫘', 'Ginjal': '🫘',
    'HIV': '🧬', 'Sifilis': '🧬', 'Hepatitis': '🧬',
    'Asam Urat': '🔬', 'Urin': '🔬', 'Urine': '🔬',
};

// Map nama tarif lab → field id di kunjungan DB
const _LAB_NAMA_TO_FIELD = {
    'GDS'             : 'lab_gds',
    'Kolesterol'      : 'lab_chol',
    'Asam Urat'       : 'lab_ua',
    'Hemoglobin (HB)' : 'lab_hb',
    'Trombosit'       : 'lab_trombosit',
    'Leukosit'        : 'lab_leukosit',
    'Eritrosit'       : 'lab_eritrosit',
    'Hematokrit'      : 'lab_hematokrit',
    'HIV'             : 'lab_hiv',
    'Sifilis'         : 'lab_sifilis',
    'Hepatitis B'     : 'lab_hepatitis',
    'HDL'             : 'lab_hdl',
    'LDL'             : 'lab_ldl',
    'Trigliserida'    : 'lab_tg',
    'GDP'             : 'lab_gdp',
    'HbA1c'           : 'lab_hba1c',
    'SGOT'            : 'lab_sgot',
    'SGPT'            : 'lab_sgpt',
    'Ureum'           : 'lab_ureum',
    'Creatinin'       : 'lab_creatinin',
};

// Unit per field id
const _LAB_FIELD_META = {
    lab_gds:       { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_chol:      { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_ua:        { unit: 'mg/dL', step: '0.1',  type: 'number' },
    lab_hb:        { unit: 'g/dL',  step: '0.1',  type: 'number' },
    lab_trombosit: { unit: 'ribu/µL', step: '1',  type: 'number' },
    lab_leukosit:  { unit: 'ribu/µL', step: '0.1',type: 'number' },
    lab_eritrosit: { unit: 'juta/µL', step: '0.01',type: 'number'},
    lab_hematokrit:{ unit: '%',      step: '0.1',  type: 'number' },
    lab_hiv:       { unit: '',       step: null,   type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    lab_sifilis:   { unit: '',       step: null,   type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    lab_hepatitis: { unit: '',       step: null,   type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    lab_hdl:       { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_ldl:       { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_tg:        { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_gdp:       { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_hba1c:     { unit: '%',     step: '0.1',  type: 'number' },
    lab_sgot:      { unit: 'U/L',   step: '1',    type: 'number' },
    lab_sgpt:      { unit: 'U/L',   step: '1',    type: 'number' },
    lab_ureum:     { unit: 'mg/dL', step: '1',    type: 'number' },
    lab_creatinin: { unit: 'mg/dL', step: '0.01', type: 'number' },
};

// State aktif lab (item yang diklik = permintaan + siap isi hasil)
// Disimpan di window._reqLab dengan prefix 'lab_req_'
// State nilai hasil disimpan di DOM langsung (field data-save="true")

/** Render section Lab sebagai accordion per sub_group */
function _renderChipPermintaanLab() {
    const section   = document.getElementById('sectionLab');
    if (!section) return;

    // Sembunyikan static row lama (GDS/Kol/AU hardcoded di HTML)
    const staticRow = section.querySelector('.row.g-2.mb-3');
    if (staticRow) staticRow.style.display = 'none';

    const wrapper   = document.getElementById('sectionPermintaanLabRequest');
    if (wrapper) wrapper.style.display = 'none'; // sembunyikan chip lama

    const labItems = _pm_getTarif('Laboratorium', []);
    if (labItems.length === 0) return;

    // Kelompokkan per sub_group
    const groups  = {};
    const noGroup = [];
    labItems.forEach(t => {
        const sg = (t.sub_group || '').trim();
        if (sg) {
            if (!groups[sg]) groups[sg] = [];
            groups[sg].push(t);
        } else {
            noGroup.push(t);
        }
    });
    const hasGroups = Object.keys(groups).length > 0;

    // Render container (insert sebelum labAlert)
    let wrap = document.getElementById('_labAccordionWrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = '_labAccordionWrap';
        const alertEl = document.getElementById('labAlert');
        if (alertEl) section.insertBefore(wrap, alertEl);
        else section.appendChild(wrap);
    }

    function _chipLabHtml(t) {
        const chipId  = _pm_slug('lab_req', t.nama);
        const active  = !!window._reqLab[chipId];
        const icon    = _pm_icon(t.nama, _LAB_ICONS, '🔬');
        // Hanya kirim chipId; _toggleLabItem akan resolve nama dari tarif cache
        return `<button id="chip_${chipId}"
            onclick="event.stopPropagation();_toggleLabItem('${chipId}')"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;
                font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;margin:3px 3px 0 0;
                border:1.5px solid ${active?'#2563eb':'#e2e8f0'};
                background:${active?'#2563eb':'#fff'};
                color:${active?'#fff':'var(--text,#334155)'};">
            ${icon} ${_pm_escHtml(t.nama)}
        </button>`;
    }

    function _accordionLabHtml(sg, items) {
        const sgId   = 'lab_acc_' + _pm_slug('sg', sg);
        const isOpen = window._accordionState && window._accordionState[sgId] === true;
        const hasAny = items.some(t => !!window._reqLab[_pm_slug('lab_req', t.nama)]);
        return `
        <div style="border:1px solid #e2e8f0;border-radius:11px;margin-bottom:7px;overflow:hidden;">
            <div onclick="_labAccToggle('${sgId}')"
                style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;cursor:pointer;background:${hasAny?'#eff6ff':'#f8fafc'};user-select:none;">
                <span style="font-size:11.5px;font-weight:700;color:${hasAny?'#2563eb':'#475569'};">
                    🔬 ${_pm_escHtml(sg)}${hasAny?' <span style=\'color:#2563eb;font-size:10px;\'>●</span>':''}
                </span>
                <span id="${sgId}_arrow" style="font-size:11px;color:#94a3b8;transition:transform .2s;">${isOpen?'▼':'▶'}</span>
            </div>
            <div id="${sgId}_body" style="display:${isOpen?'block':'none'};padding:10px 12px 8px;">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">
                    Klik item untuk memilih & mengisi hasil pemeriksaan
                </div>
                <div id="${sgId}_chips" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
                    ${items.map(_chipLabHtml).join('')}
                </div>
                <div id="${sgId}_inputs"></div>
            </div>
        </div>`;
    }

    let html = `
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#2563eb;display:inline-block;flex-shrink:0;"></span>
            Pemeriksaan Laboratorium
        </div>`;

    if (hasGroups) {
        Object.keys(groups).sort().forEach(sg => { html += _accordionLabHtml(sg, groups[sg]); });
        if (noGroup.length > 0) {
            html += `<div id="lab_nogroup_chips" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
                ${noGroup.map(_chipLabHtml).join('')}
            </div>
            <div id="lab_nogroup_inputs"></div>`;
        }
    } else {
        // Flat tanpa accordion
        html += `<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">Klik item untuk memilih & mengisi hasil pemeriksaan</div>`;
        html += `<div id="lab_flat_chips" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${labItems.map(_chipLabHtml).join('')}</div>`;
        html += `<div id="lab_flat_inputs"></div>`;
    }

    wrap.innerHTML = html;

    // Re-render input untuk item yang sudah aktif
    labItems.forEach(t => {
        const chipId = _pm_slug('lab_req', t.nama);
        if (window._reqLab[chipId]) {
            _renderLabInput(chipId, t.nama);
        }
    });
}

// _labAccToggle — digantikan oleh window.accToggle (supabase.js).
window._labAccToggle = function(sgId) { window.accToggle(sgId); };

/** Toggle item lab: aktif → tampilkan input; nonaktif → hapus input & clear field */
function _toggleLabItem(chipId, nama) {
    // Resolve nama dari tarif cache jika parameter nama mengandung HTML entity atau kosong
    // Ini mencegah bug dimana nama yang di-escape di HTML tidak cocok dengan kunci _LAB_NAMA_TO_FIELD
    const labTarifList = _pm_getTarif('Laboratorium', []);
    const tarifItem = labTarifList.find(t => _pm_slug('lab_req', t.nama) === chipId);
    const realNama  = tarifItem ? tarifItem.nama : (nama || '');

    // Toggle state: gunakan truthy agar undefined → true (aktivasi pertama kali)
    const wasActive = !!window._reqLab[chipId];
    window._reqLab[chipId] = !wasActive;
    const active = !!window._reqLab[chipId];

    const btn = document.getElementById('chip_' + chipId);
    if (btn) {
        btn.style.background  = active ? '#2563eb' : '#fff';
        btn.style.borderColor = active ? '#2563eb' : '#e2e8f0';
        btn.style.color       = active ? '#fff'    : 'var(--text,#334155)';
    }
    if (active) {
        _renderLabInput(chipId, realNama);
    } else {
        // Hapus input & clear nilai
        const inputWrap = document.getElementById('labinput_' + chipId);
        if (inputWrap) inputWrap.remove();
        // Clear nilai field DB (gunakan realNama agar lookup benar)
        const fieldId = _LAB_NAMA_TO_FIELD[realNama];
        if (fieldId) {
            const el = document.getElementById(fieldId);
            if (el) { el.value = ''; localStorage.removeItem('rme_' + fieldId); }
        }
        // Update accordion header color
        _updateLabAccordionHeader(chipId);
    }
}

/** Render input field di bawah chip setelah diklik */
function _renderLabInput(chipId, nama) {
    // Cari container inputs terdekat dengan chip ini
    let inputsWrap = null;
    const chip = document.getElementById('chip_' + chipId);
    if (chip) {
        const accBody = chip.closest('[id$="_body"]');
        if (accBody) {
            inputsWrap = accBody.querySelector('[id$="_inputs"]');
        }
    }
    if (!inputsWrap) inputsWrap = document.getElementById('lab_flat_inputs') || document.getElementById('lab_nogroup_inputs');
    if (!inputsWrap) return;

    // Jangan dobel render
    if (document.getElementById('labinput_' + chipId)) return;

    const fieldId = _LAB_NAMA_TO_FIELD[nama];
    const meta    = (fieldId && _LAB_FIELD_META[fieldId]) || { unit: '', step: '1', type: 'number' };
    const icon    = _pm_icon(nama, _LAB_ICONS, '🔬');
    const ne      = _pm_escHtml(nama);

    let inputHtml = '';
    if (meta.type === 'select') {
        inputHtml = `<select id="${fieldId || chipId}" data-save="true"
            style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid #c7d9f5;border-radius:8px;background:#fff;color:#1e3a8a;outline:none;box-sizing:border-box;height:38px;"
            onchange="_onLabFieldChange('${fieldId || chipId}')">
            ${(meta.opts||['—','Non-Reaktif','Reaktif']).map(o => `<option value="${o==='—'?'':o}">${o}</option>`).join('')}
        </select>`;
    } else {
        inputHtml = `<input type="number" id="${fieldId || chipId}" data-save="true"
            placeholder="—" step="${meta.step||1}"
            style="width:100%;font-size:14px;padding:7px 10px;border:1.5px solid #c7d9f5;border-radius:8px;background:#fff;color:#1e3a8a;outline:none;box-sizing:border-box;"
            oninput="_onLabFieldChange('${fieldId || chipId}')">`;
    }

    const unitLabel = meta.unit ? `<span style="font-size:10px;font-weight:600;color:#64748b;margin-left:4px;">${_pm_escHtml(meta.unit)}</span>` : '';

    const div = document.createElement('div');
    div.id = 'labinput_' + chipId;
    div.style.cssText = 'animation:_pnj_fadeIn .2s ease forwards;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:9px 12px;margin-top:6px;margin-bottom:4px;';
    div.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#2563eb;">${icon} ${ne} ${unitLabel}</span>
            <button onclick="event.stopPropagation();_toggleLabItem('${chipId}')"
                style="background:rgba(239,68,68,0.09);border:1px solid rgba(239,68,68,0.2);border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;color:#dc2626;display:flex;align-items:center;justify-content:center;padding:0;"
                title="Batalkan">✕</button>
        </div>
        ${inputHtml}`;
    inputsWrap.appendChild(div);

    // Restore nilai tersimpan
    const realFieldEl = document.getElementById(fieldId || chipId);
    if (realFieldEl) {
        const saved = localStorage.getItem('rme_' + (fieldId || chipId));
        if (saved !== null && saved !== '') realFieldEl.value = saved;
        realFieldEl.addEventListener('input', () => {
            localStorage.setItem('rme_' + (fieldId || chipId), realFieldEl.value);
            if (typeof checkLabAlert === 'function') checkLabAlert();
        });
        realFieldEl.addEventListener('change', () => {
            localStorage.setItem('rme_' + (fieldId || chipId), realFieldEl.value);
        });
    }

    // Update accordion header
    _updateLabAccordionHeader(chipId);
}

function _onLabFieldChange(fieldId) {
    const el = document.getElementById(fieldId);
    if (el) localStorage.setItem('rme_' + fieldId, el.value);
    if (typeof checkLabAlert === 'function') checkLabAlert();
}

/** Perbarui warna header accordion jika ada item aktif di dalamnya */
function _updateLabAccordionHeader(chipId) {
    const chip = document.getElementById('chip_' + chipId);
    if (!chip) return;
    const accBody = chip.closest('[id$="_body"]');
    if (!accBody) return;
    const sgId  = accBody.id.replace('_body', '');
    const hasAny = accBody.querySelectorAll('button[style*="background: rgb(37, 99, 235)"], button[style*="background:#2563eb"]').length > 0;
    const header = accBody.previousElementSibling;
    if (!header) return;
    const spanLabel = header.querySelector('span:first-child');
    if (spanLabel) {
        spanLabel.style.color = hasAny ? '#2563eb' : '#475569';
        // Titik indikator
        const dotSpan = spanLabel.querySelector('span');
        if (hasAny && !dotSpan) {
            spanLabel.insertAdjacentHTML('beforeend', ' <span style=\'color:#2563eb;font-size:10px;\'>●</span>');
        } else if (!hasAny && dotSpan) {
            dotSpan.remove();
        }
    }
    header.style.background = hasAny ? '#eff6ff' : '#f8fafc';
}

// Backward compat: fungsi lama masih dipanggil oleh renderMedisDinamis
function _toggleLabReqChip(id) { _toggleLabItem(id); }

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

/** Render seluruh section penunjang ke #sectionPermintaanLab — dengan accordion per sub_group */
function renderSectionPermintaanLab() {
    const container = document.getElementById('sectionPermintaanLab');
    if (!container) return;

    const tarifRaw = _pm_getTarif('Penunjang', []);
    if (tarifRaw.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }
    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:4px;';

    // Kelompokkan tarif per sub_group
    const groups = {};   // sub_group || '' → items[]
    const noGroup = [];
    tarifRaw.forEach(t => {
        const sg = (t.sub_group || '').trim();
        if (sg) {
            if (!groups[sg]) groups[sg] = [];
            groups[sg].push(t);
        } else {
            noGroup.push(t);
        }
    });

    const hasGroups = Object.keys(groups).length > 0;

    function _chipHtml(t) {
        const p = {
            id:    _pm_slug('penunjang', t.nama),
            label: t.nama,
            icon:  _pm_icon(t.nama, _PENUNJANG_ICONS, '🔬'),
        };
        const active = !!window._reqLab[p.id];
        return `<button id="chip_${p.id}" onclick="event.stopPropagation();_togglePenunjang('${p.id}')"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid ${active?'#2563eb':'#e2e8f0'};background:${active?'#2563eb':'#fff'};color:${active?'#fff':'var(--text,#334155)'};transition:all .15s;margin:3px 3px 0 0;">
            ${p.icon} ${_pm_escHtml(p.label)}
        </button>`;
    }

    function _accordionPnj(sg, items) {
        const sgId   = 'pnj_acc_' + _pm_slug('sg', sg);
        const isOpen = window._accordionState && window._accordionState[sgId] === true;
        const hasAny = items.some(t => !!window._reqLab[_pm_slug('penunjang', t.nama)]);
        return `
        <div style="border:1px solid #e2e8f0;border-radius:11px;margin-bottom:7px;overflow:hidden;">
            <div onclick="_pnjAccToggle('${sgId}')"
                style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;cursor:pointer;background:${hasAny?'#eff6ff':'#f8fafc'};user-select:none;">
                <span style="font-size:11.5px;font-weight:700;color:${hasAny?'#2563eb':'#475569'};">
                    🔬 ${_pm_escHtml(sg)}${hasAny?' <span style=\'color:#2563eb;font-size:10px;\'>●</span>':''}
                </span>
                <span id="${sgId}_arrow" style="font-size:11px;color:#94a3b8;transition:transform .2s;">${isOpen?'▼':'▶'}</span>
            </div>
            <div id="${sgId}_body" style="display:${isOpen?'block':'none'};padding:10px 12px 8px;">
                <div id="${sgId}_chips" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
                    ${items.map(_chipHtml).join('')}
                </div>
                <div id="${sgId}_panels"></div>
            </div>
        </div>`;
    }

    let html = `
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#2563eb;display:inline-block;flex-shrink:0;"></span>
            Pemeriksaan Penunjang
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:10px;">
            Tandai pemeriksaan penunjang. Petugas akan melihat permintaan ini.
        </div>`;

    if (hasGroups) {
        Object.keys(groups).sort().forEach(sg => {
            html += _accordionPnj(sg, groups[sg]);
        });
        // Item tanpa group di luar accordion
        if (noGroup.length > 0) {
            html += `<div id="pnj-chips-wrap" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${noGroup.map(_chipHtml).join('')}</div>`;
        }
    } else {
        // Tidak ada sub_group → flat chips seperti semula
        html += `<div id="pnj-chips-wrap" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${tarifRaw.map(_chipHtml).join('')}</div>`;
    }
    html += `<div id="pnj-panels-wrap"></div>`;
    container.innerHTML = html;

    // Re-render panel yang sudah aktif
    const allItems = _getPenunjangList();
    allItems.forEach(p => {
        if (window._reqLab[p.id]) _renderPenunjangPanel(p.id, p.label, p.icon);
    });
}

// _pnjAccToggle — digantikan oleh window.accToggle (supabase.js).
window._pnjAccToggle = function(sgId) { window.accToggle(sgId); };

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
    // Cari wrap: cek accordion sub_group dulu, fallback ke global pnj-panels-wrap
    let wrap = null;
    // Cari di dalam accordion yang terbuka (sgId_panels)
    const allAccPanels = document.querySelectorAll('[id$="_panels"]');
    for (const ap of allAccPanels) {
        if (ap.closest('[style*="display:block"]') || ap.closest('[id$="_body"][style*="display:block"]')) {
            // Cek apakah chip ada di dalam accordion ini
            const chipInAcc = ap.closest('[id$="_body"]')?.querySelector('#chip_' + id);
            if (chipInAcc) { wrap = ap; break; }
        }
    }
    // Fallback ke accordion body yang berisi chip ini
    if (!wrap) {
        const chip = document.getElementById('chip_' + id);
        if (chip) {
            const accBody = chip.closest('[id$="_body"]');
            if (accBody) wrap = accBody.querySelector('[id$="_panels"]');
        }
    }
    // Final fallback ke global wrap
    if (!wrap) wrap = document.getElementById('pnj-panels-wrap');
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

    const tarifRaw = _pm_getTarif('Tindakan', []);
    if (tarifRaw.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }
    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:8px;';

    // Kelompokkan per sub_group
    const groups  = {};
    const noGroup = [];
    tarifRaw.forEach(t => {
        const sg = (t.sub_group || '').trim();
        if (sg) {
            if (!groups[sg]) groups[sg] = [];
            groups[sg].push(t);
        } else {
            noGroup.push(t);
        }
    });
    const hasGroups = Object.keys(groups).length > 0;

    function _chipTid(t) {
        const id     = _pm_slug('tindakan', t.nama);
        const icon   = _pm_icon(t.nama, _TINDAKAN_ICONS, '⚕️');
        const active = !!window._reqTindakan[id];
        return `<button id="chip_${id}" onclick="event.stopPropagation();_toggleTindakan('${id}')"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid ${active?'#dc2626':'#e2e8f0'};background:${active?'#dc2626':'#fff'};color:${active?'#fff':'var(--text,#334155)'};transition:all .15s;margin:3px 3px 0 0;">
            ${icon} ${_pm_escHtml(t.nama)}
        </button>`;
    }

    function _accordionTid(sg, items) {
        const sgId   = 'tid_acc_' + _pm_slug('sg', sg);
        const isOpen = window._accordionState && window._accordionState[sgId] === true;
        const hasAny = items.some(t => !!window._reqTindakan[_pm_slug('tindakan', t.nama)]);
        return `
        <div style="border:1px solid #e2e8f0;border-radius:11px;margin-bottom:7px;overflow:hidden;">
            <div onclick="_tidAccToggle('${sgId}')"
                style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;cursor:pointer;background:${hasAny?'#fff5f5':'#f8fafc'};user-select:none;">
                <span style="font-size:11.5px;font-weight:700;color:${hasAny?'#dc2626':'#475569'};">
                    ⚕️ ${_pm_escHtml(sg)}${hasAny?' <span style=\'color:#dc2626;font-size:10px;\'>●</span>':''}
                </span>
                <span id="${sgId}_arrow" style="font-size:11px;color:#94a3b8;">${isOpen?'▼':'▶'}</span>
            </div>
            <div id="${sgId}_body" style="display:${isOpen?'block':'none'};padding:10px 12px 8px;">
                <div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
                    ${items.map(_chipTid).join('')}
                </div>
            </div>
        </div>`;
    }

    const div = document.createElement('div');
    div.id    = 'sectionTindakanMedis';

    let html = `
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#dc2626;display:inline-block;flex-shrink:0;"></span>
            Tindakan Medis
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:10px;">
            Tandai tindakan yang dilakukan. Item terpilih masuk ke tagihan otomatis.
        </div>`;

    if (hasGroups) {
        Object.keys(groups).sort().forEach(sg => {
            html += _accordionTid(sg, groups[sg]);
        });
        if (noGroup.length > 0) {
            html += `<div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${noGroup.map(_chipTid).join('')}</div>`;
        }
    } else {
        const allList = _getTindakanList();
        const chips = allList.map(t => {
            const active = !!window._reqTindakan[t.id];
            return `<button id="chip_${t.id}" onclick="event.stopPropagation();_toggleTindakan('${t.id}')"
                style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid ${active?'#dc2626':'#e2e8f0'};background:${active?'#dc2626':'#fff'};color:${active?'#fff':'var(--text,#334155)'};transition:all .15s;margin:3px 3px 0 0;">
                ${t.icon} ${_pm_escHtml(t.label)}
            </button>`;
        }).join('');
        html += `<div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${chips}</div>`;
    }

    div.innerHTML = html;
    container.innerHTML = '';
    container.appendChild(div);
}

// _tidAccToggle — digantikan oleh window.accToggle (supabase.js).
window._tidAccToggle = function(sgId) { window.accToggle(sgId); };

function _toggleTindakan(id) {
    // Toggle eksplisit — pastikan false jika sebelumnya truthy
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
//  SECTION 2 — PEMERIKSAAN EXTRA ACCORDION (dari tarif Pemeriksaan)
//  Klik item → aktif + muncul textarea input
//  Item aktif muncul sebagai chip di halaman Kunjungan
// ══════════════════════════════════════════════════════

const _PEMX_COLORS = ['#7c3aed','#0891b2','#059669','#d97706','#db2777','#6366f1'];

const _PEMX_ICONS = {
    'EKG': '🫀', 'Konsultasi': '💬', 'Edukasi': '📚', 'Gizi': '🥗',
    'Fisik': '🩺', 'Fisioterapi': '🏃', 'Psikologi': '🧠',
    'Mata': '👁️', 'THT': '👂', 'Gigi': '🦷', 'Kulit': '🧴',
};


// ── Helper tombol ✕ pemx — ambil slug dari data-slug, hindari masalah HTML entity ──
// BUG-FIX: sebelumnya ✕ mengirim nama via onclick string yang sudah di-escape HTML
window._pemxDeactivate = function(btn) {
    const slug = btn ? (btn.dataset ? btn.dataset.slug : btn.getAttribute('data-slug')) : null;
    if (!slug) return;
    // Resolve nama dari tarif cache
    const tarif = (window._tarifCache || []).find(t => _pm_slug('pemx', t.nama) === slug);
    const nama  = tarif ? tarif.nama : slug;
    _togglePemx(slug, nama);
};
function _renderSectionPemeriksaanExtra() {
    const container = document.getElementById('sectionPemeriksaanDinamis');
    if (!container) return;
    const items = _pm_getTarif('Pemeriksaan', _PEMERIKSAAN_BAWAAN);
    if (items.length === 0) { container.innerHTML = ''; container.style.display = 'none'; return; }
    container.style.display = '';

    // Kelompokkan per sub_group
    const groups  = {};
    const noGroup = [];
    items.forEach(t => {
        const sg = (t.sub_group || '').trim();
        if (sg) { if (!groups[sg]) groups[sg] = []; groups[sg].push(t); }
        else noGroup.push(t);
    });
    const hasGroups = Object.keys(groups).length > 0;

    function _chipPemxHtml(t) {
        const slug   = _pm_slug('pemx', t.nama);
        // BUG-FIX: gunakan _pemxActive flag bukan .trim() nilai
        const active = !!(window._pemxActive && window._pemxActive[slug]);
        const icon   = _pm_icon(t.nama, _PEMX_ICONS, '🩺');
        return `<button id="chip_${slug}"
            onclick="event.stopPropagation();_togglePemx('${slug}','${_pm_escHtml(t.nama)}')"
            style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;
                font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;margin:3px 3px 0 0;
                border:1.5px solid ${active?'#7c3aed':'#e2e8f0'};
                background:${active?'#7c3aed':'#fff'};
                color:${active?'#fff':'var(--text,#334155)'};">
            ${icon} ${_pm_escHtml(t.nama)}
        </button>`;
    }

    function _accordionPemxHtml(sg, sgItems) {
        const sgId   = 'pemx_acc_' + _pm_slug('sg', sg);
        const isOpen = window._accordionState && window._accordionState[sgId] === true;
        const hasAny = sgItems.some(t => {
            const s = _pm_slug('pemx', t.nama);
            return !!(window._reqPemeriksaanExtra[s] && String(window._reqPemeriksaanExtra[s]).trim());
        });
        return `
        <div style="border:1px solid #e2e8f0;border-radius:11px;margin-bottom:7px;overflow:hidden;">
            <div onclick="_pemxAccToggle('${sgId}')"
                style="display:flex;justify-content:space-between;align-items:center;padding:9px 13px;cursor:pointer;background:${hasAny?'#faf5ff':'#f8fafc'};user-select:none;">
                <span style="font-size:11.5px;font-weight:700;color:${hasAny?'#7c3aed':'#475569'};">
                    🩺 ${_pm_escHtml(sg)}${hasAny?' <span style=\'color:#7c3aed;font-size:10px;\'>●</span>':''}
                </span>
                <span id="${sgId}_arrow" style="font-size:11px;color:#94a3b8;">${isOpen?'▼':'▶'}</span>
            </div>
            <div id="${sgId}_body" style="display:${isOpen?'block':'none'};padding:10px 12px 8px;">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">Klik item untuk memilih & mengisi catatan</div>
                <div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
                    ${sgItems.map(_chipPemxHtml).join('')}
                </div>
                <div id="${sgId}_inputs"></div>
            </div>
        </div>`;
    }

    let html = `
        <div class="rm-subsection" style="border-bottom:1px dashed var(--border);padding-bottom:14px;margin-bottom:14px;">
            <div class="rm-subsection-label">
                <span class="rm-subsection-dot" style="background:#7c3aed;"></span>
                Pemeriksaan Tambahan
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:10px;">Klik item untuk memilih & mengisi catatan pemeriksaan</div>`;

    if (hasGroups) {
        Object.keys(groups).sort().forEach(sg => { html += _accordionPemxHtml(sg, groups[sg]); });
        if (noGroup.length > 0) {
            html += `<div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${noGroup.map(_chipPemxHtml).join('')}</div>`;
            html += `<div id="pemx_nogroup_inputs"></div>`;
        }
    } else {
        html += `<div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">${items.map(_chipPemxHtml).join('')}</div>`;
        html += `<div id="pemx_flat_inputs"></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;

    // Re-render textarea untuk item yang sudah aktif
    // BUG-FIX: cek _pemxActive flag (bukan .trim()) agar chip yg aktif tapi kosong ikut dirender
    items.forEach(t => {
        const slug = _pm_slug('pemx', t.nama);
        if (window._pemxActive && window._pemxActive[slug]) {
            _renderPemxInput(slug, t.nama);
        }
    });
}

// _pemxAccToggle — digantikan oleh window.accToggle (supabase.js).
window._pemxAccToggle = function(sgId) { window.accToggle(sgId); };

function _togglePemx(slug, nama) {
    // BUG-FIX: Gunakan flag _pemxActive_ terpisah agar toggle tidak bergantung
    // pada trim() nilai — nilai spasi/kosong tidak lagi menyebabkan chip stuck aktif.
    const isActive = !!window._pemxActive[slug];
    if (isActive) {
        // Nonaktifkan
        window._pemxActive[slug] = false;
        window._reqPemeriksaanExtra[slug] = '';
        localStorage.removeItem('rme_' + slug);
        const inputWrap = document.getElementById('pemxinput_' + slug);
        if (inputWrap) inputWrap.remove();
        const btn = document.getElementById('chip_' + slug);
        if (btn) { btn.style.background = '#fff'; btn.style.borderColor = '#e2e8f0'; btn.style.color = 'var(--text,#334155)'; }
        _updatePemxAccordionHeader(slug);
    } else {
        // Aktifkan
        window._pemxActive[slug] = true;
        // Pertahankan nilai lama jika ada, jangan timpa dengan spasi
        if (!window._reqPemeriksaanExtra[slug]) window._reqPemeriksaanExtra[slug] = '';
        const btn = document.getElementById('chip_' + slug);
        if (btn) { btn.style.background = '#7c3aed'; btn.style.borderColor = '#7c3aed'; btn.style.color = '#fff'; }
        _renderPemxInput(slug, nama);
    }
}

function _renderPemxInput(slug, nama) {
    // Cari wrap inputs terdekat
    let inputsWrap = null;
    const chip = document.getElementById('chip_' + slug);
    if (chip) {
        const accBody = chip.closest('[id$="_body"]');
        if (accBody) inputsWrap = accBody.querySelector('[id$="_inputs"]');
    }
    if (!inputsWrap) inputsWrap = document.getElementById('pemx_flat_inputs') || document.getElementById('pemx_nogroup_inputs');
    if (!inputsWrap || document.getElementById('pemxinput_' + slug)) return;

    const icon   = _pm_icon(nama, _PEMX_ICONS, '🩺');
    const ne     = _pm_escHtml(nama);
    const valSaved = window._reqPemeriksaanExtra[slug];
    const val    = (valSaved && valSaved.trim()) ? valSaved.trim() : '';

    const div = document.createElement('div');
    div.id = 'pemxinput_' + slug;
    div.style.cssText = 'animation:_pnj_fadeIn .2s ease forwards;background:#faf5ff;border:1.5px solid #c4b5fd;border-radius:10px;padding:9px 12px;margin-top:6px;margin-bottom:4px;';
    div.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#7c3aed;">${icon} ${ne}</span>
            <button data-slug="${slug}" onclick="_pemxDeactivate(this)"
                style="background:rgba(239,68,68,0.09);border:1px solid rgba(239,68,68,0.2);border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;color:#dc2626;display:flex;align-items:center;justify-content:center;padding:0;"
                title="Batalkan">✕</button>
        </div>
        <div style="position:relative;">
            <textarea id="${slug}" class="form-control" data-save="true"
                placeholder="Catatan / hasil ${ne.toLowerCase()}..." rows="2"
                style="font-size:12px;padding:7px 36px 7px 10px;border-color:#c4b5fd;"
                oninput="_onPemxInput('${slug}')">${_pm_escHtml(val)}</textarea>
            <button class="stt-btn" onclick="startSTT('${slug}')" style="border-color:#c4b5fd;">🎙️</button>
        </div>`;
    inputsWrap.appendChild(div);
    // Sync nilai
    if (val) { window._reqPemeriksaanExtra[slug] = val; }
    _updatePemxAccordionHeader(slug);
}

function _updatePemxAccordionHeader(slug) {
    const chip = document.getElementById('chip_' + slug);
    if (!chip) return;
    const accBody = chip.closest('[id$="_body"]');
    if (!accBody) return;
    const hasAny = Array.from(accBody.querySelectorAll('button[id^="chip_pemx_"]'))
        .some(b => b.style.background === 'rgb(124, 58, 237)' || b.style.background === '#7c3aed');
    const header = accBody.previousElementSibling;
    if (!header) return;
    const spanLabel = header.querySelector('span:first-child');
    if (spanLabel) {
        spanLabel.style.color = hasAny ? '#7c3aed' : '#475569';
        const dotSpan = spanLabel.querySelector('span');
        if (hasAny && !dotSpan) spanLabel.insertAdjacentHTML('beforeend', ' <span style=\'color:#7c3aed;font-size:10px;\'>●</span>');
        else if (!hasAny && dotSpan) dotSpan.remove();
    }
    header.style.background = hasAny ? '#faf5ff' : '#f8fafc';
}

function _onPemxInput(slug) {
    const el = document.getElementById(slug);
    if (!el) return;
    window._reqPemeriksaanExtra[slug] = el.value;
    localStorage.setItem('rme_' + slug, el.value);
    // Update chip warna berdasarkan isi
    const chip = document.getElementById('chip_' + slug);
    if (chip) {
        const hasVal = el.value.trim().length > 0;
        chip.style.background  = hasVal ? '#7c3aed' : '#fff';
        chip.style.borderColor = hasVal ? '#7c3aed' : '#e2e8f0';
        chip.style.color       = hasVal ? '#fff'    : 'var(--text,#334155)';
    }
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

    // Penunjang: chip aktif + hasil teks
    Object.entries(window._reqLab || {}).forEach(([k, v]) => {
        if (!v) return;
        payload[k] = true;
        const hasil = (window._reqLabHasil || {})[k];
        if (hasil && hasil.trim()) payload['hasil_' + k] = hasil.trim();
        // Foto URLs
        const fotos = (window._reqLabFoto || {})[k];
        if (fotos && fotos.length) payload['foto_' + k] = fotos;
    });

    // Lab accordion: simpan nama asli dari tarif untuk tampilan di kunjungan
    const labTarif = _pm_getTarif('Laboratorium', []);
    labTarif.forEach(t => {
        const chipId = _pm_slug('lab_req', t.nama);
        if (window._reqLab[chipId]) {
            payload['_labname_' + chipId] = t.nama;
        }
    });

    // ── PENTING: Kumpulkan nilai angka/teks hasil lab dari DOM input ──
    // Field lab (lab_gds, lab_chol, dst.) dirender oleh _renderLabInput() dengan
    // id sesuai _LAB_NAMA_TO_FIELD. Nilai ini HARUS ikut masuk ke req_lab JSON
    // karena kolom lab_* TIDAK ADA di tabel kunjungan — semua data lab disimpan
    // di kolom req_lab (JSON).
    Object.entries(_LAB_NAMA_TO_FIELD).forEach(([_, fieldId]) => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        const val = (el.value || '').trim();
        if (val && val !== '—') payload[fieldId] = val;
    });

    // Tindakan: chip aktif + nama asli
    const tidTarif = _pm_getTarif('Tindakan', []);
    Object.entries(window._reqTindakan || {}).forEach(([k, v]) => {
        if (!v) return;
        payload[k] = true;
        // Simpan nama asli tindakan
        const tarif = tidTarif.find(t => _pm_slug('tindakan', t.nama) === k);
        if (tarif) payload['_tidname_' + k] = tarif.nama;
    });

    // Pemeriksaan extra: simpan jika chip aktif (flag _pemxActive), nilai boleh kosong
    // BUG-FIX: cek _pemxActive agar chip yang sudah diklik tapi belum diisi tetap tersimpan
    const pemxTarif = _pm_getTarif('Pemeriksaan', _PEMERIKSAAN_BAWAAN);
    const _pemxAct  = window._pemxActive || {};
    pemxTarif.forEach(t => {
        const k = _pm_slug('pemx', t.nama);
        if (!_pemxAct[k]) return; // chip tidak aktif, skip
        const v = (window._reqPemeriksaanExtra[k] || '').trim();
        payload[k] = v;           // simpan string kosong sekalipun (agar restore tahu chip aktif)
        payload['_pemxname_' + k] = t.nama;
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
    window._pemxActive          = {}; // BUG-FIX: reset sebelum load ulang dari DB

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
        if (k.startsWith('pemx_')) {
            // BUG-FIX: restore active flag agar chip bisa di-toggle kembali
            // _pemxActive harus true meski nilai string kosong (chip aktif tapi belum diisi)
            window._reqPemeriksaanExtra[k] = (v === null || v === undefined) ? '' : String(v);
            window._pemxActive = window._pemxActive || {};
            window._pemxActive[k] = true; // chip pernah diaktifkan
        }
        if (k.startsWith('adm_')  && v) window._reqAdminExtra[k] = true;
        // Lab accordion items (chip aktif)
        if (k.startsWith('lab_req_'))   window._reqLab[k] = true;
        // ── Nilai angka/teks hasil lab (lab_gds, lab_chol, dst.) ──
        // Disimpan langsung di req_lab JSON (bukan kolom DB terpisah).
        // Restore ke DOM setelah _refreshAllChipUI() merender field-nya.
        if (_LAB_NAMA_TO_FIELD && Object.values(_LAB_NAMA_TO_FIELD).includes(k)) {
            // Tandai untuk restore ke DOM setelah render
            window._pendingLabValues = window._pendingLabValues || {};
            window._pendingLabValues[k] = v;
        }
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

    // ── Restore nilai angka/teks hasil lab ke DOM field ──
    // _pendingLabValues diisi oleh loadReqLabFromKunjungan() saat parsing req_lab.
    // Chip lab (lab_req_*) harus aktif terlebih dahulu agar field DOM-nya dirender
    // oleh _renderLabInput() — baru kita bisa set value-nya.
    if (window._pendingLabValues && Object.keys(window._pendingLabValues).length > 0) {
        // Aktifkan chip untuk setiap field yang punya nilai tersimpan
        Object.entries(window._pendingLabValues).forEach(([fieldId, val]) => {
            // Cari nama tarif dari fieldId via _LAB_NAMA_TO_FIELD (reverse lookup)
            const nama = Object.entries(_LAB_NAMA_TO_FIELD).find(([n, f]) => f === fieldId)?.[0];
            if (!nama) return;
            const chipId = _pm_slug('lab_req', nama);
            // Aktifkan chip jika belum aktif
            if (!window._reqLab[chipId]) {
                window._reqLab[chipId] = true;
                _renderLabInput(chipId, nama);
            }
            // Set nilai ke DOM
            const el = document.getElementById(fieldId);
            if (el) {
                el.value = val;
                localStorage.setItem('rme_' + fieldId, String(val));
            }
        });
        window._pendingLabValues = {};
    }

    // Pemx chip warna sudah dihandle oleh _renderSectionPemeriksaanExtra (re-render input aktif)
    // Nilai textarea akan di-restore saat _renderPemxInput dipanggil
}

// Alias _refreshChipUI lama
window._refreshChipUI = _refreshAllChipUI;

// ══════════════════════════════════════════════════════
//  _renderSectionLabDinamic  (PINDAHAN dari kunjungan.js)
//  Canonical definition — kunjungan.js tidak lagi mendefinisikan ini.
// ══════════════════════════════════════════════════════

function _renderSectionLabDinamic() {
    const section = document.getElementById('sectionLab');
    if (!section) return;

    // ── Tangani section resep / terapi (tidak berubah) ──
    if (window._stokAktif && typeof renderSectionResep === 'function') {
        renderSectionResep(
            (typeof currentKunjunganId !== 'undefined' ? currentKunjunganId : null) || null
        );
        const secResep  = document.getElementById('sectionResep');
        const secManual = document.getElementById('sectionTerapiManual');
        if (secResep)  secResep.style.display  = '';
        if (secManual) secManual.style.display = 'none';
    }

    // Sembunyikan elemen HTML bawaan yang sudah tidak dipakai
    const staticRow = section.querySelector('.row.g-2.mb-3');
    if (staticRow) staticRow.style.display = 'none';
    const labReqWrap = document.getElementById('sectionPermintaanLabRequest');
    if (labReqWrap) labReqWrap.style.display = 'none';

    const tarifLab = (window._tarifCache || []).filter(t => t.aktif && t.kategori === 'Laboratorium');
    const labAktif = window._labAktif || {};
    const hasLab   = tarifLab.length > 0 || Object.values(labAktif).some(Boolean);

    if (!hasLab) {
        section.style.display = 'none';
        if (typeof renderSectionPermintaanLab === 'function') renderSectionPermintaanLab();
        return;
    }
    section.style.display = '';

    // Render accordion lab
    if (typeof _renderChipPermintaanLab === 'function') _renderChipPermintaanLab();

    // Render section permintaan penunjang setelah lab
    if (typeof renderSectionPermintaanLab === 'function') renderSectionPermintaanLab();

    // Render semua section dinamis lain (pemx, tindakan, adm)
    try { renderMedisDinamis(); } catch(e) {}
}

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

                    // BUG-FIX RESEP: load resep dari DB setelah sectionResep dirender oleh
                    // renderMedisDinamis() di atas. Sebelumnya loadResepByKunjungan hanya
                    // dipanggil di _recoverLanjutkan (path refresh), bukan saat buka kunjungan
                    // pertama kali — akibatnya resep tidak muncul sampai halaman di-refresh.
                    if (window._stokAktif && typeof loadResepByKunjungan === 'function') {
                        const _kId = (typeof currentKunjunganId !== 'undefined') ? currentKunjunganId : null;
                        if (_kId) loadResepByKunjungan(_kId).catch(e => console.warn('[resep] gagal load:', e.message));
                    }

                    // Restore riwayat_penyakit
                    if (kunjunganData.riwayat_penyakit && document.getElementById('riwayat_penyakit')) {
                        document.getElementById('riwayat_penyakit').value = kunjunganData.riwayat_penyakit;
                        localStorage.setItem('rme_riwayat_penyakit', kunjunganData.riwayat_penyakit);
                    }

                    // Restore surat sakit button
                    const ss = document.getElementById('suratSakit');
                    if (ss) { _onSuratSakitChange(); }

                    // Setelah semua field terisi, jalankan kalkulasi klinis
                    // (sebelumnya dipanggil langsung di kunjungan.js — sekarang di sini)
                    try { calculateIMT();  } catch(e) {}
                    try { checkTensi();    } catch(e) {}
                    try { checkLabAlert(); } catch(e) {}
                    // Terapkan lock UI
                    if (typeof _applyLockUI === 'function') setTimeout(_applyLockUI, 50);

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
                const t = setInterval(() => {
                    if (_doHook()) { clearInterval(t); return; }
                    if (++i > 50) { clearInterval(t); console.warn('[pemeriksaan-medis] Hook timeout: fungsi target tidak dimuat dalam 5 detik.'); }
                }, 100);
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
                const t = setInterval(() => {
                    if (_doHook()) { clearInterval(t); return; }
                    if (++i > 50) { clearInterval(t); console.warn('[pemeriksaan-medis] Hook timeout: fungsi target tidak dimuat dalam 5 detik.'); }
                }, 100);
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
//  Pola retry sama seperti hook lain — clearSession mungkin
//  belum terdefinisi saat file ini diparse.
// ══════════════════════════════════════════════════════

//  HOOK — clearSession (app.js)
//  Reset semua state saat pasien berganti.
//  Karena app.js diload SETELAH pemeriksaan-medis.js, kita daftarkan
//  callback via event 'klikpro:clearSession' alih-alih interval polling.
//  app.js dispatch event ini dari dalam clearSession().
// ══════════════════════════════════════════════════════

(function _hookClearSession() {
    /** Reset seluruh state per-pasien milik modul ini. */
    function _resetPemMedisState() {
        window._reqLab              = {};
        window._reqTindakan         = {};
        window._reqLabHasil         = {};
        window._reqLabFoto          = {};
        window._reqPemeriksaanExtra = {};
        window._reqAdminExtra       = {};
        window._pemxActive          = {};
        window._accordionState      = {};
        // Bersihkan invoice & status cache agar tidak bocor ke pasien berikutnya
        window._invoiceData         = null;
        window._invoiceNama         = '';
        window._invoiceTgl          = '';
        window._statusCache         = {};
    }

    // Cara 1: wrap langsung jika clearSession sudah tersedia
    function _tryWrap() {
        const _orig = window.clearSession;
        if (typeof _orig !== 'function' || _orig._pemMedisClearHooked) return false;
        window.clearSession = function() {
            _orig.apply(this, arguments);
            _resetPemMedisState();
        };
        window.clearSession._pemMedisClearHooked = true;
        return true;
    }

    // Cara 2: fallback via custom event (tidak perlu interval — event ini di-dispatch
    // oleh app.js setelah clearSession dipanggil sehingga tidak ada leak).
    document.addEventListener('klikpro:clearSession', _resetPemMedisState);

    // Coba wrap saat file diparse; jika belum tersedia, coba lagi setelah DOM siap.
    // Tidak menggunakan setInterval agar tidak ada goroutine liar yang terus berjalan.
    if (!_tryWrap()) {
        document.addEventListener('DOMContentLoaded', _tryWrap);
    }
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
                let i = 0; const t = setInterval(() => {
                    if (_doHook()) { clearInterval(t); return; }
                    if (++i > 50) { clearInterval(t); console.warn('[pemeriksaan-medis] Hook timeout: initPageBiaya tidak dimuat dalam 5 detik.'); }
                }, 100);
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

// ══════════════════════════════════════════════════════
//  VALIDASI NILAI TANDA VITAL  (PINDAHAN dari kunjungan.js)
//  Rentang absolut yang masih physiologically possible
// ══════════════════════════════════════════════════════

const VITAL_RULES = {
    sistol:        { min: 50,   max: 300,  label: 'Sistol',              unit: 'mmHg' },
    diastol:       { min: 30,   max: 200,  label: 'Diastol',             unit: 'mmHg' },
    nadi:          { min: 20,   max: 300,  label: 'Nadi',                unit: 'x/mnt' },
    suhu:          { min: 30,   max: 45,   label: 'Suhu',                unit: '°C' },
    rr:            { min: 5,    max: 60,   label: 'Laju Napas',          unit: 'x/mnt' },
    bb:            { min: 1,    max: 300,  label: 'Berat Badan',         unit: 'kg' },
    tb:            { min: 30,   max: 250,  label: 'Tinggi Badan',        unit: 'cm' },
    lab_gds:       { min: 20,   max: 800,  label: 'GDS',                 unit: 'mg/dL' },
    lab_chol:      { min: 50,   max: 800,  label: 'Kolesterol',          unit: 'mg/dL' },
    lab_ua:        { min: 1,    max: 20,   label: 'Asam Urat',           unit: 'mg/dL' },
    lab_hb:        { min: 2,    max: 25,   label: 'HB',                  unit: 'g/dL' },
    lab_trombosit: { min: 10,   max: 1500, label: 'Trombosit',           unit: 'ribu/µL' },
    lab_leukosit:  { min: 0.5,  max: 100,  label: 'Leukosit',            unit: 'ribu/µL' },
    lab_eritrosit: { min: 0.5,  max: 10,   label: 'Eritrosit',           unit: 'juta/µL' },
    lab_hematokrit:{ min: 5,    max: 70,   label: 'Hematokrit',          unit: '%' },
    // lab_hiv, lab_sifilis, lab_hepatitis SENGAJA TIDAK DIMASUKKAN di sini —
    // field tersebut adalah <select> (Non-Reaktif/Reaktif), bukan angka,
    // sehingga parseFloat() akan menghasilkan NaN dan memblokir simpan.
    lab_hdl:       { min: 5,    max: 200,  label: 'HDL',                 unit: 'mg/dL' },
    lab_ldl:       { min: 10,   max: 500,  label: 'LDL',                 unit: 'mg/dL' },
    lab_tg:        { min: 10,   max: 2000, label: 'Trigliserida',        unit: 'mg/dL' },
    lab_gdp:       { min: 20,   max: 800,  label: 'GDP',                 unit: 'mg/dL' },
    lab_hba1c:     { min: 2,    max: 20,   label: 'HbA1c',               unit: '%' },
    lab_sgot:      { min: 5,    max: 5000, label: 'SGOT',                unit: 'U/L' },
    lab_sgpt:      { min: 5,    max: 5000, label: 'SGPT',                unit: 'U/L' },
    lab_ureum:     { min: 5,    max: 500,  label: 'Ureum',               unit: 'mg/dL' },
    lab_creatinin: { min: 0.1,  max: 50,   label: 'Creatinin',           unit: 'mg/dL' },
};

function validasiNilaiVital() {
    const errors = [];
    Object.entries(VITAL_RULES).forEach(([id, rule]) => {
        const el = document.getElementById(id);
        // Lewati jika elemen tidak ada, kosong, atau berupa <select> (nilai non-numerik)
        if (!el || el.value === '' || el.tagName === 'SELECT') return;
        const val = parseFloat(el.value);
        if (isNaN(val)) { errors.push(`${rule.label}: bukan angka valid`); return; }
        if (val < rule.min || val > rule.max) {
            errors.push(`${rule.label}: ${val} ${rule.unit} (rentang valid: ${rule.min}–${rule.max})`);
        }
    });
    const sis = parseFloat(document.getElementById('sistol')?.value  || '');
    const dia = parseFloat(document.getElementById('diastol')?.value || '');
    if (!isNaN(sis) && !isNaN(dia) && sis <= dia) {
        errors.push(`Tekanan darah tidak valid: Sistol (${sis}) harus lebih besar dari Diastol (${dia})`);
    }
    return errors;
}

// ══════════════════════════════════════════════════════
//  RENDER LIST RIWAYAT (PINDAHAN dari kunjungan.js)
//  Selalu dipanggil dengan containerId="historyListMedis"
//  yang merupakan elemen milik page-medis.html.
// ══════════════════════════════════════════════════════

function renderRiwayatList(list, containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;

    if (list && list.length > 0) {
        c.innerHTML = list.map((r, i) => {
            const st        = r.id ? _getStatusKunjungan(r.id) : { obat: false, bayar: false };
            const obatDone  = st.obat;
            const bayarDone = st.bayar;

            const jabatan = ((typeof loggedInUser !== 'undefined' && loggedInUser)
                ? (loggedInUser.jabatan || '') : '').toLowerCase();
            const canToggleObat  = ['apoteker','admin','dokter'].includes(jabatan);
            const canToggleBayar = ['kasir','admin','dokter'].includes(jabatan);

            const badgeObat = r.id ? `
            <span id="badge_obat_${r.id}"
                onclick="${canToggleObat ? `event.stopPropagation();toggleStatusKunjungan(event,'${r.id}','obat')` : 'event.stopPropagation()'}"
                style="${_badgeStyleAttr('obat', obatDone)}${canToggleObat ? '' : 'cursor:default;'}">
                ${_badgeHtml('obat', obatDone)}
            </span>` : '';

            const badgeBayar = r.id ? `
            <span id="badge_bayar_${r.id}"
                onclick="${canToggleBayar ? `event.stopPropagation();toggleStatusKunjungan(event,'${r.id}','bayar')` : 'event.stopPropagation()'}"
                style="${_badgeStyleAttr('bayar', bayarDone)}${canToggleBayar ? '' : 'cursor:default;'}">
                ${_badgeHtml('bayar', bayarDone)}
            </span>` : '';

            return `
                <div class="riwayat-item" onclick="openModal(${i})" style="cursor:pointer; padding:10px 12px; border-bottom:1px solid var(--border);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                        <div style="font-size:12px; font-weight:700; color:var(--primary);">
                            📅 ${formatTglIndo(r.tgl)} (${r.waktu || '00:00'})
                        </div>
                        <div style="display:flex;gap:6px;align-items:center;">
                            <div style="font-size:10px; color:var(--primary); font-weight:700;">Lihat Detail 👁️</div>
                            ${(r.id && window._biayaAktif) ? `<button onclick="event.stopPropagation();_bukaInvoiceRiwayat(this)" data-kunjid="${escHtml(String(r.id))}" data-tgl="${escHtml(r.tgl||'')}" style="padding:2px 7px;background:rgba(22,163,74,0.1);color:#166534;border:1px solid rgba(22,163,74,0.25);border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer;">🧾 Invoice</button>` : ''}
                            ${(r.id && window._stokAktif) ? `<button onclick="event.stopPropagation();_bukaResepRiwayat(this)" data-kunjid="${escHtml(String(r.id))}" data-tgl="${escHtml(r.tgl||'')}" data-nama="${escHtml(r.namaPasien||'')}" style="padding:2px 7px;background:rgba(37,99,235,0.1);color:#1e40af;border:1px solid rgba(37,99,235,0.25);border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer;">💊 Resep</button>` : ''}
                        </div>
                    </div>
                    <div style="font-size:11px; margin-bottom:6px; color:var(--text-muted); background:var(--surface-2); padding:4px 8px; border-radius:8px;">
                        <b>TTV:</b> TD ${r.td||'-'} | N ${r.nadi||'-'} | S ${r.suhu||'-'} | RR ${r.rr||'-'} | BB ${r.bb||'-'}
                    </div>
                    ${window._isParamedis ? '' : `<div class="riwayat-diag" style="margin-bottom:3px;">🩺 ${r.diag || 'Menunggu Diagnosa'}</div>`}
                    <div class="riwayat-keluhan" style="color:var(--text); border-top:1px dashed var(--border); padding-top:4px; margin-bottom:3px;"><b>Keluhan:</b> ${r.keluhan || '-'}</div>
                    <div class="riwayat-keluhan" style="color:var(--text);margin-bottom:6px;"><b>Terapi:</b> ${r.terapi || '-'}</div>
                    ${r.dokterNama ? `<div style="font-size:10px;color:#059669;font-weight:600;padding-top:4px;border-top:1px dashed var(--border);">👨‍⚕️ Diperiksa oleh: ${r.dokterNama}</div>` : ''}
                    <div style="display:flex;gap:5px;align-items:center;margin-top:7px;padding-top:5px;border-top:1px dashed var(--border);" onclick="event.stopPropagation()">
                        ${badgeObat}
                        ${badgeBayar}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>Belum ada riwayat.</div>`;
    }
}

// ══════════════════════════════════════════════════════
//  EDIT LOCK  (PINDAHAN dari kunjungan.js)
//  Kunjungan > 2 hari tidak bisa disimpan
// ══════════════════════════════════════════════════════

/**
 * Kembalikan true jika kunjungan yang sedang dibuka sudah lewat 2 hari.
 * Kunjungan BARU (currentKunjunganId null) selalu false (tidak terkunci).
 */
function _isKunjunganTerkunci() {
    const kId = (typeof currentKunjunganId !== 'undefined') ? currentKunjunganId : null;
    if (!kId || kId === 'null') return false;

    let tglStr = null;
    const kCache = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : [])
        .find(x => x.id === kId);
    if (kCache && kCache.tgl) {
        tglStr = kCache.tgl;
    } else {
        const raw = localStorage.getItem('cTglEdit') || '';
        const m   = raw.replace('Tgl: ', '').trim();
        if (m && m.includes('/')) {
            const p = m.split('/');
            if (p.length === 3) tglStr = `${p[2]}-${p[1]}-${p[0]}`;
        }
    }

    if (!tglStr) return false;
    const tglKunjungan = new Date(tglStr);
    if (isNaN(tglKunjungan)) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tglKunjungan.setHours(0, 0, 0, 0);
    return Math.floor((today - tglKunjungan) / 86400000) > 2;
}

/**
 * Terapkan visual lock ke semua tombol simpan di pageMedis.
 * Dipanggil dari bukaRekamMedisHariIni (kunjungan.js) via setTimeout,
 * dan dari _hookIsiformDariKunjungan setelah form terisi.
 */
function _applyLockUI() {
    const terkunci = _isKunjunganTerkunci();

    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.disabled = terkunci;
        if (terkunci) {
            btnSave.innerText     = '🔒 Rekam Medis Terkunci (> 2 Hari)';
            btnSave.style.cssText = 'width:100%;padding:12px;border-radius:12px;font-size:13px;font-weight:800;background:#e2e8f0;color:#94a3b8;border:none;cursor:not-allowed;';
        } else {
            btnSave.innerText     = '✓ Simpan Rekam Medis';
            // Selalu reset cssText agar style terkunci tidak terjebak jika dipanggil ulang
            btnSave.style.cssText = '';
        }
    }

    document.querySelectorAll('._mini-save-btn').forEach(b => {
        b.disabled          = terkunci;
        b.style.opacity     = terkunci ? '0.38' : '';
        b.style.cursor      = terkunci ? 'not-allowed' : '';
        b.style.borderStyle = terkunci ? 'dashed' : '';
    });

    const LOCK_ID = 'pageMedisLockBanner';
    let banner = document.getElementById(LOCK_ID);
    if (terkunci) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = LOCK_ID;
            banner.style.cssText = 'position:sticky;top:0;z-index:200;padding:9px 16px;background:rgba(239,68,68,0.1);border-bottom:1.5px solid rgba(239,68,68,0.3);color:#dc2626;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:8px;border-radius:0 0 10px 10px;';
            banner.innerHTML = '🔒 Rekam medis ini sudah lebih dari 2 hari dan tidak dapat diubah.';
            const page = document.getElementById('pageMedis');
            if (page) page.insertBefore(banner, page.firstChild);
        }
    } else {
        if (banner) banner.remove();
    }
}

// ══════════════════════════════════════════════════════
//  SIMPAN REKAM MEDIS — saveAll()  (PINDAHAN dari kunjungan.js)
//  Dipanggil dari tombol "✓ Simpan Rekam Medis" di page-medis.html
// ══════════════════════════════════════════════════════

async function saveAll(showInvoice = true) {
    const btn = document.getElementById('btnSave');
    if (btn) { btn.disabled = true; btn.innerText = '⏳ Menyimpan...'; }

    try {
        if (_isKunjunganTerkunci()) {
            showToast('🔒 Rekam medis ini sudah lebih dari 2 hari dan tidak dapat diubah.', 'warning');
            return;
        }

        const _cPasienId    = (typeof currentPasienId    !== 'undefined') ? currentPasienId    : null;
        const _cKunjunganId = (typeof currentKunjunganId !== 'undefined') ? currentKunjunganId : null;

        if (!_cPasienId || _cPasienId === 'null') {
            showToast('⚠️ Data pasien tidak ditemukan. Daftar ulang dari halaman Daftar.', 'warning');
            return;
        }

        const vitalErrors = validasiNilaiVital();
        if (vitalErrors && vitalErrors.length > 0) {
            showToast('⚠️ ' + vitalErrors[0], 'warning');
            return;
        }

        const today      = new Date();
        const tzOffset   = today.getTimezoneOffset() * 60000;
        const _todayDate = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
        const _todayTime = String(today.getHours()).padStart(2,'0') + ':' + String(today.getMinutes()).padStart(2,'0');

        let localDate = _todayDate;
        let localTime = _todayTime;
        if (_cKunjunganId) {
            const _kCache = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : [])
                .find(x => x.id === _cKunjunganId);
            if (_kCache && _kCache.tgl) {
                localDate = _kCache.tgl;
                if (_kCache.waktu) localTime = _kCache.waktu;
            } else {
                const _cTgl      = localStorage.getItem('cTglEdit') || '';
                const _tglMatch  = _cTgl.replace('Tgl: ', '').trim();
                if (_tglMatch && _tglMatch.includes('/')) {
                    const _p = _tglMatch.split('/');
                    if (_p.length === 3) localDate = `${_p[2]}-${_p[1]}-${_p[0]}`;
                }
            }
        }

        const _$ = id => document.getElementById(id);
        const sistol  = _$('sistol')  ? _$('sistol').value.trim()  : '';
        const diastol = _$('diastol') ? _$('diastol').value.trim() : '';
        const td      = (sistol && diastol) ? `${sistol}/${diastol}` : (sistol || diastol || '');

        const diag1 = _$('diagnosa')  ? _$('diagnosa').value.trim()  : '';
        const diag2 = _$('diagnosa2') ? _$('diagnosa2').value.trim() : '';

        const userId = (typeof loggedInUser !== 'undefined' && loggedInUser) ? loggedInUser.id : null;

        const _namaDariForm = _$('nama') ? _$('nama').value.trim() : '';
        const namaPasien    = _namaDariForm || localStorage.getItem('cP_nama') || '';

        const payload = {
            pasienId:         _cPasienId,
            kunjunganId:      _cKunjunganId,
            localDate, localTime, userId,
            nama:             namaPasien,
            nik:              _$('nik')       ? _$('nik').value.trim()       : '',
            tgl_lahir:        _$('tgl_lahir') ? _$('tgl_lahir').value.trim() : '',
            jk:               _$('jk')        ? _$('jk').value               : 'L',
            alamat:           _$('alamat')    ? _$('alamat').value.trim()    : '',
            alergi:           _$('alergi')    ? _$('alergi').value.trim()    : '',
            td,
            nadi:             _$('nadi') ? _$('nadi').value : '',
            suhu:             _$('suhu') ? _$('suhu').value : '',
            rr:               _$('rr')   ? _$('rr').value   : '',
            bb:               _$('bb')   ? _$('bb').value   : '',
            tb:               _$('tb')   ? _$('tb').value   : '',
            keluhan:          _$('keluhan') ? _$('keluhan').value : '',
            fisik:            _$('fisik')   ? _$('fisik').value   : '',
            diagnosa:         diag1,
            diagnosa2:        diag2,
            terapi:           _$('terapi')  ? _$('terapi').value  : '',
            req_lab:          (typeof getReqLabPayload === 'function') ? getReqLabPayload() : null,
            riwayat_penyakit: _$('riwayat_penyakit') ? (_$('riwayat_penyakit').value || null) : null
        };

        const result = await sb_saveKunjungan(payload);

        if (result && result.kunjunganId) {
            currentKunjunganId = result.kunjunganId;
            localStorage.setItem('cK_id', currentKunjunganId);
        }

        if (window._stokAktif && currentKunjunganId && typeof _getResepItems === 'function') {
            try {
                const resepItems = _getResepItems();
                if (resepItems && resepItems.length > 0) {
                    await sb_saveResep(currentKunjunganId, resepItems);
                }
            } catch(e) { console.warn('[Klikpro] Resep gagal disimpan:', e.message); }
        }

        if (typeof kunjunganHariIni !== 'undefined' && currentKunjunganId) {
            const isSelesai = !!(diag1 && payload.terapi);
            const kIdx = kunjunganHariIni.findIndex(x => x.id === currentKunjunganId);
            if (kIdx !== -1) {
                kunjunganHariIni[kIdx].status  = isSelesai ? 'Selesai' : 'Menunggu';
                kunjunganHariIni[kIdx].td      = td;
                kunjunganHariIni[kIdx].suhu    = payload.suhu;
                kunjunganHariIni[kIdx].nadi    = payload.nadi;
                kunjunganHariIni[kIdx].keluhan = payload.keluhan;
                kunjunganHariIni[kIdx].diag    = diag1;
            }
        }

        showToast('✅ Rekam medis berhasil disimpan!', 'success');

        if (showInvoice && window._biayaAktif && currentKunjunganId && diag1) {
            try {
                const namaPasienDisplay = _$('infoPasienNama') ? _$('infoPasienNama').innerText : namaPasien;
                if (typeof openModalTagihan === 'function') {
                    let kunjunganDataFresh = null;
                    try {
                        kunjunganDataFresh = await sb_getKunjunganById(currentKunjunganId);
                    } catch(e) { console.warn('[Klikpro] Gagal ambil kunjungan fresh:', e.message); }
                    openModalTagihan(
                        currentKunjunganId, _cPasienId,
                        namaPasienDisplay, localDate,
                        kunjunganDataFresh || payload
                    );
                }
            } catch(e) { console.warn('[Klikpro] Modal invoice gagal:', e.message); }
        }

        // Refresh riwayat pasien di pageMedis
        // Gunakan snapshot _cPasienId (diambil di awal fungsi) bukan currentPasienId langsung,
        // agar tidak terkena race condition jika user berpindah pasien saat simpan berlangsung.
        try {
            if (_cPasienId) {
                const riwayatRows = await _sbFetch(
                    `kunjungan?pasien_id=eq.${_cPasienId}&order=tgl.desc,waktu.desc&select=*`
                );
                if (!window._usersCache || window._usersCache.length === 0) {
                    const users = await _sbFetch('users?select=id,nama,jabatan&order=nama.asc');
                    window._usersCache = users || [];
                }
                currentRiwayat = riwayatRows.map(r => {
                    const dokterUser = r.user_id
                        ? (window._usersCache || []).find(u => u.id === r.user_id && u.jabatan?.toLowerCase() === 'dokter')
                        : null;
                    return {
                        id: r.id, tgl: r.tgl, waktu: r.waktu,
                        td: r.td, nadi: r.nadi, suhu: r.suhu, rr: r.rr, bb: r.bb, tb: r.tb,
                        keluhan: r.keluhan, fisik: r.fisik, req_lab: r.req_lab,
                        diag: r.diagnosa, diagnosa2: r.diagnosa2, terapi: r.terapi,
                        status: r.status, user_id: r.user_id,
                        status_obat: !!r.status_obat, status_bayar: !!r.status_bayar,
                        dokterNama: dokterUser ? dokterUser.nama : ''
                    };
                });
                localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
                renderRiwayatList(currentRiwayat, 'historyListMedis');
            }
        } catch(e) { console.warn('[Klikpro] Gagal refresh riwayat:', e.message); }

    } catch (e) {
        console.error('[Klikpro] saveAll error:', e);
        showToast('❌ Gagal menyimpan: ' + (e.message || 'Cek koneksi internet'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '✓ Simpan Rekam Medis';
            // Reset inline style agar tidak terjebak di state terkunci dari _applyLockUI
            btn.style.cssText = '';
        }
    }
}

// ══════════════════════════════════════════════════════
//  FLOATING SAVE BUTTON  (PINDAHAN dari kunjungan.js)
//  Seluruh DOM yang dioperasikan milik page-medis.html:
//  floatingSaveBtn, floatSaveTrigger, floatDirtyRing, floatSaveLabel
// ══════════════════════════════════════════════════════

(function _floatingSaveModule() {
    let _floatSavedTimer = null;
    let _dirtyTimer      = null;
    let _isDirty         = false;

    function _showFloatBtn() {
        const btn = document.getElementById('floatingSaveBtn');
        if (btn) btn.style.display = 'flex';
    }
    function _hideFloatBtn() {
        const btn = document.getElementById('floatingSaveBtn');
        if (btn) btn.style.display = 'none';
        _setDirty(false);
    }

    function _setDirty(dirty) {
        _isDirty = dirty;
        const trigger = document.getElementById('floatSaveTrigger');
        const ring    = document.getElementById('floatDirtyRing');
        const label   = document.getElementById('floatSaveLabel');
        if (!trigger) return;
        if (dirty) {
            trigger.classList.add('dirty');
            trigger.classList.remove('saving');
            if (ring)  ring.style.display = 'block';
            if (label) label.textContent  = 'Ada perubahan';
        } else {
            trigger.classList.remove('dirty');
            if (ring)  ring.style.display = 'none';
            if (label) label.textContent  = 'Simpan';
        }
    }

    function _attachDirtyListeners() {
        const page = document.getElementById('pageMedis');
        if (!page) return;
        page.addEventListener('input', function(e) {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
                if (e.target.id !== 'floatSaveTrigger') {
                    clearTimeout(_dirtyTimer);
                    _dirtyTimer = setTimeout(() => _setDirty(true), 400);
                }
            }
        }, true);
        page.addEventListener('change', function(e) {
            if (e.target && (e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) {
                clearTimeout(_dirtyTimer);
                _dirtyTimer = setTimeout(() => _setDirty(true), 200);
            }
        }, true);
    }

    function _showFloatToast() {
        const toast = document.getElementById('floatSaveToast');
        if (!toast) return;
        toast.style.transform = 'translateX(-50%) translateY(0px)';
        setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(-80px)'; }, 2200);
    }

    function _observePageMedis() {
        const page = document.getElementById('pageMedis');
        if (!page) { setTimeout(_observePageMedis, 150); return; }
        const obs = new MutationObserver(() => {
            const visible = page.style.display !== 'none' && page.classList.contains('active');
            visible ? _showFloatBtn() : _hideFloatBtn();
        });
        obs.observe(page, { attributes: true, attributeFilter: ['style','class'] });
        if (page.style.display !== 'none' && page.classList.contains('active')) _showFloatBtn();
        _attachDirtyListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _observePageMedis);
    } else {
        _observePageMedis();
    }

    // Fallback: pantau body jika pageMedis belum ada saat IIFE berjalan
    (function() {
        const bodyObs = new MutationObserver(function(_, obs) {
            if (document.getElementById('pageMedis')) {
                obs.disconnect();
                _observePageMedis();
            }
        });
        bodyObs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    })();

    // Ctrl+S / Cmd+S shortcut
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            const page = document.getElementById('pageMedis');
            if (page && page.classList.contains('active')) {
                e.preventDefault();
                window._floatSave();
            }
        }
    });

    window._floatSave = function() {
        const trigger = document.getElementById('floatSaveTrigger');
        const icon    = document.getElementById('floatSaveIcon');
        const ring    = document.getElementById('floatDirtyRing');
        const label   = document.getElementById('floatSaveLabel');

        if (trigger) {
            trigger.classList.remove('dirty');
            trigger.classList.add('saving');
            if (icon)  icon.textContent  = '⏳';
            if (ring)  ring.style.display = 'none';
            if (label) label.textContent  = 'Menyimpan...';
        }

        const done = () => {
            if (trigger) { trigger.classList.remove('saving'); if (icon) icon.textContent = '✅'; }
            if (label) label.textContent = 'Tersimpan!';
            _showFloatToast();
            _setDirty(false);
            clearTimeout(_floatSavedTimer);
            _floatSavedTimer = setTimeout(() => {
                if (icon)  icon.textContent  = '💾';
                if (label) label.textContent = 'Simpan';
            }, 2500);
        };

        try {
            const result = saveAll(false);
            if (result && typeof result.then === 'function') {
                result.then(done).catch(done);
            } else {
                setTimeout(done, 500);
            }
        } catch(e) { done(); }
    };

    window._floatResetDirty = function() { _setDirty(false); };
})();

console.log('[pemeriksaan-medis] ✅ Loaded — konsolidasi penunjang, tindakan, dokumen, pemx, lab chip');
