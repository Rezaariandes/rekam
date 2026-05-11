// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PEMBIAYAAN (biaya.js)
//  • Manajemen tarif layanan (data dari database)
//  • Auto-generate & simpan tagihan dari kunjungan
//  • Modal tagihan (muncul setelah simpan rekam medis)
//
//  Data tarif disimpan di tabel tarif_layanan (Supabase).
//  Untuk seed data awal → jalankan seed_tarif_layanan.sql
//  di Supabase SQL Editor (cukup sekali).
//
//  Fungsi invoice (lihat, edit, print) → invoice.js
// ════════════════════════════════════════════════════════

// ── State ──
if (typeof window._tarifCache === 'undefined') window._tarifCache = [];
let _activeKatTab = '';

const KAT_ICON = {
    'Pemeriksaan': '🩺',
    'Laboratorium': '🔬',
    'Obat':         '💊',
    'Administrasi': '📋',
    'Penunjang':    '🔭',
    'Tindakan':     '⚕️',
    'Lainnya':      '📌'
};

// ── Sub-grup Laboratorium — untuk pengelompokan di Page Biaya ──
const LAB_SUB_GROUPS = [
    { id: 'lab_dasar',       label: '🩸 Lab Dasar',        items: ['GDS', 'Kolesterol', 'Asam Urat'] },
    { id: 'lab_darah_rutin', label: '🔴 Darah Rutin',      items: ['Hemoglobin (HB)', 'Trombosit', 'Leukosit', 'Eritrosit', 'Hematokrit'] },
    { id: 'lab_triple',      label: '🧬 Triple Eliminasi', items: ['HIV', 'Sifilis', 'Hepatitis B'] },
    { id: 'lab_lemak',       label: '💧 Profil Lemak',     items: ['HDL', 'LDL', 'Trigliserida'] },
    { id: 'lab_gula',        label: '🍬 Gula Darah',       items: ['GDP', 'HbA1c'] },
    { id: 'lab_hati',        label: '🫀 Fungsi Hati',      items: ['SGOT', 'SGPT'] },
    { id: 'lab_ginjal',      label: '🫘 Fungsi Ginjal',    items: ['Ureum', 'Creatinin'] }
];

// ── Sub-grup Penunjang — Radiologi & Pencitraan ──
const PENUNJANG_SUB_GROUPS = [
    {
        id: 'penunjang_radiologi',
        label: '🩻 Pencitraan / Radiologi',
        items: ['X-Ray / Rontgen', 'USG', 'CT Scan', 'MRI', 'Mammografi', 'Fluoroskopi', 'PET Scan', 'Bone Densitometry', 'Intervensi Radiologi']
    },
    {
        id: 'penunjang_ekg',
        label: '❤️ Kardiologi & EKG',
        items: ['EKG / ECG', 'Echocardiography', 'Holter Monitor', 'Stress Test / Treadmill']
    },
    {
        id: 'penunjang_endoskopi',
        label: '🔬 Endoskopi & Prosedur',
        items: ['Endoskopi', 'Kolonoskopi', 'Spirometri', 'Audiometri']
    }
];

// ── Sub-grup Tindakan ──
const TINDAKAN_SUB_GROUPS = [
    { id: 'tindakan_1',  label: '🔪 Bedah & Operatif',
      items: ['Sirkumsisi','Bedah Umum','Bedah Digestif','Bedah Thoraks','Bedah Orthopedi','Bedah Saraf','Bedah Plastik','Bedah Onkologi','Bedah Urologi','Bedah THT','Bedah Mata'] },
    { id: 'tindakan_2',  label: '🩺 Bedah Minimal Invasif',
      items: ['Laparoskopi','Thoracoscopy (VATS)','Arthroskopi','Endoskopi Intervensi','Robotik Surgery','Intervensi Vaskular'] },
    { id: 'tindakan_3',  label: '💉 Anestesi',
      items: ['Anestesi Umum','Anestesi Regional','Sedasi','Analgesia','Blok Saraf'] },
    { id: 'tindakan_4',  label: '🤰 Obstetri & Ginekologi',
      items: ['Persalinan Normal','Sectio Caesarea','Kuretase','USG Fetomaternal','Fertility Procedure'] },
    { id: 'tindakan_5',  label: '❤️ Kardiologi & Vaskular',
      items: ['Kateterisasi Jantung','PCI / Stenting','Ablasi Jantung','Pacemaker','Intervensi Vaskular'] },
    { id: 'tindakan_6',  label: '🫘 Urologi',
      items: ['ESWL','TURP','Endourologi','Biopsi Prostat'] },
    { id: 'tindakan_7',  label: '🎗️ Onkologi',
      items: ['Kemoterapi','Radioterapi','Immunotherapy','Ablasi Tumor'] },
    { id: 'tindakan_8',  label: '🚨 Gawat Darurat & Resusitasi',
      items: ['CPR','Intubasi','Defibrilasi','Resusitasi Cairan','Penanganan Syok'] },
    { id: 'tindakan_9',  label: '🩸 Transfusi & Hematologi',
      items: ['Transfusi Darah','Aferesis','Bone Marrow Procedure'] },
    { id: 'tindakan_10', label: '🔍 Diagnostik Invasif',
      items: ['Biopsi','Aspirasi','Pungsi','Kateterisasi'] },
    { id: 'tindakan_11', label: '🏃 Rehabilitasi Medik & Fisiatri',
      items: ['Fisioterapi','Terapi Wicara','Okupasi Terapi','Akupunktur Medik'] },
    { id: 'tindakan_12', label: '⚕️ Terapeutik Lainnya',
      items: ['Hemodialisis','CAPD','Ventilator Support','Hyperbaric Oxygen Therapy','Laser Therapy'] },
    { id: 'tindakan_13', label: '🧴 Dermatologi',
      items: ['Bedah Kulit','Cryotherapy','Laser Dermatologi','Estetika Medik'] },
    { id: 'tindakan_14', label: '🦷 Gigi & Mulut',
      items: ['Scaling','Tambal Gigi','Pencabutan','Root Canal Treatment','Behel / Ortodonti','Prostodonti'] },
    { id: 'tindakan_15', label: '👂 THT & Neurotologi',
      items: ['Ear Toilet','Sinus Procedure','Tonsilektomi','Neurotologi'] },
    { id: 'tindakan_16', label: '👁️ Oftalmologi',
      items: ['Operasi Katarak','Retina Procedure','LASIK','Glaukoma Procedure'] },
    { id: 'tindakan_17', label: '🧠 Neurologi',
      items: ['Lumbar Puncture','Botulinum Injection','Neurointervensi'] },
    { id: 'tindakan_18', label: '🫁 Gastroenterologi',
      items: ['ERCP','Endoskopi Terapeutik','Hepatobiliary Procedure'] },
    { id: 'tindakan_19', label: '🫁 Pulmonologi',
      items: ['Bronkoskopi','Thoracentesis','Ventilator Procedure'] },
    { id: 'tindakan_20', label: '🫘 Nefrologi',
      items: ['Dialisis','Biopsi Ginjal'] },
    { id: 'tindakan_21', label: '🧪 Endokrinologi',
      items: ['Thyroid Procedure','Endocrine Dynamic Test'] },
    { id: 'tindakan_22', label: '🦴 Reumatologi',
      items: ['Joint Injection','Autoimmune Therapy'] },
    { id: 'tindakan_23', label: '👴 Geriatri',
      items: ['Comprehensive Geriatric Assessment','Rehabilitasi Lansia'] },
    { id: 'tindakan_24', label: '👶 Pediatri',
      items: ['Tindakan Neonatal','Tumbuh Kembang','Resusitasi Neonatus'] },
    { id: 'tindakan_25', label: '🕊️ Paliatif & Hospice',
      items: ['Pain Management','Symptom Control','End of Life Care'] }
];

// ── Sub-grup Pemeriksaan ──
const PEMERIKSAAN_SUB_GROUPS = [
    {
        id: 'periksa_umum',
        label: '🩺 Konsultasi & Umum',
        items: ['Konsultasi Dokter', 'Konsultasi Dokter Spesialis', 'Pemeriksaan Fisik', 'Pemeriksaan Anak', 'Pemeriksaan Ibu Hamil (ANC)', 'Kunjungan Rumah']
    },
    {
        id: 'periksa_gigi',
        label: '🦷 Gigi & Mulut',
        items: ['Konsultasi Gigi', 'Tambal Gigi', 'Cabut Gigi', 'Scaling / Pembersihan Karang Gigi', 'Perawatan Saluran Akar']
    },
    {
        id: 'periksa_mata',
        label: '👁️ Mata',
        items: ['Pemeriksaan Visus', 'Tonometri', 'Pemeriksaan Fundus']
    }
];

// ── Sub-grup Obat ──
const OBAT_SUB_GROUPS = [
    {
        id: 'obat_umum',
        label: '💊 Obat Umum',
        items: ['Obat Generik', 'Obat Paten', 'Vitamin & Suplemen']
    },
    {
        id: 'obat_kronis',
        label: '💉 Obat Kronis & Khusus',
        items: ['Obat Hipertensi', 'Obat Diabetes', 'Obat Kolesterol', 'Obat TB']
    }
];

// ── Sub-grup Administrasi ──
const ADMIN_SUB_GROUPS = [
    {
        id: 'admin_registrasi',
        label: '📝 Registrasi & Pendaftaran',
        items: ['Biaya Pendaftaran', 'Rekam Medis Baru', 'Administrasi Rawat Inap']
    },
    {
        id: 'admin_surat',
        label: '📄 Surat & Dokumen',
        items: ['Surat Keterangan Sakit', 'Surat Keterangan Sehat', 'Surat Rujukan', 'Resume Medis', 'Legalisasi Dokumen']
    }
];

// Mapping kategori → sub-group config
const KATEGORI_SUB_GROUPS = {
    'Laboratorium': LAB_SUB_GROUPS,
    'Penunjang':    PENUNJANG_SUB_GROUPS,
    'Tindakan':     TINDAKAN_SUB_GROUPS,
    'Pemeriksaan':  PEMERIKSAAN_SUB_GROUPS,
    'Obat':         OBAT_SUB_GROUPS,
    'Administrasi': ADMIN_SUB_GROUPS,
};

// State accordion (key: groupId → bool open)
if (typeof window._accordionState === 'undefined') window._accordionState = {};

// ════════════════════════════════════════
//  INIT HALAMAN TARIF
// ════════════════════════════════════════
async function initPageBiaya() {
    await _refreshTarifCache();
    renderDaftarTarif();
}

async function _refreshTarifCache() {
    try {
        const data = await _sbFetch('tarif_layanan?select=*&order=kategori.asc,nama.asc');
        window._tarifCache = data || [];
        console.log('[biaya] ✅ Tarif dimuat:', window._tarifCache.length, 'item');
        if (window._tarifCache.length === 0) {
            showToast('⚠️ Tabel tarif_layanan kosong. Jalankan migrasi SQL terlebih dahulu.', 'error');
        }
    } catch(e) {
        console.error('[biaya] ❌ Gagal memuat tarif:', e.message, e);
        showToast('❌ Gagal memuat tarif: ' + e.message, 'error');
    }
}

// ════════════════════════════════════════
//  RENDER DAFTAR TARIF (dengan accordion)
// ════════════════════════════════════════
function renderDaftarTarif() {
    const container = document.getElementById('daftarTarif');
    const tabsEl    = document.getElementById('biayaKategoriTabs');

    // ── Debug: log state saat render dipanggil ──
    console.log('[biaya] renderDaftarTarif() dipanggil');
    console.log('[biaya] #daftarTarif ditemukan:', !!container);
    console.log('[biaya] _tarifCache.length:', window._tarifCache?.length ?? 'undefined');

    if (!container) {
        console.error('[biaya] ❌ Elemen #daftarTarif tidak ditemukan di HTML. Pastikan ada <div id="daftarTarif"> di halaman biaya.');
        return;
    }

    const categories = [...new Set(window._tarifCache.map(t => t.kategori))].sort();

    if (tabsEl) {
        tabsEl.innerHTML = ['', ...categories].map(k => {
            const isAll  = k === '';
            const active = _activeKatTab === k;
            return `<button onclick="_setBiayaTab('${k}')"
                style="padding:5px 12px;border:1.5px solid ${active ? 'var(--primary)' : '#e2e8f0'};
                       border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;
                       background:${active ? 'var(--primary)' : '#fff'};
                       color:${active ? '#fff' : 'var(--text)'};white-space:nowrap;">
                ${isAll ? '🗂️ Semua' : (KAT_ICON[k] || '') + ' ' + k}
            </button>`;
        }).join('');
    }

    const filtered = _activeKatTab
        ? window._tarifCache.filter(t => t.kategori === _activeKatTab)
        : window._tarifCache;

    // Tombol aksi massal
    let bulkEl = document.getElementById('_biayaBulkActions');
    if (!bulkEl) {
        bulkEl = document.createElement('div');
        bulkEl.id = '_biayaBulkActions';
        container.parentElement.insertBefore(bulkEl, container);
    }
    bulkEl.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;';
    bulkEl.innerHTML = `
        <button onclick="bulkToggleTarif(true)"
            style="padding:5px 14px;border:1.5px solid #22c55e;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:#f0fdf4;color:#16a34a;white-space:nowrap">
            ✅ Aktifkan semua ${_activeKatTab ? '"' + _activeKatTab + '"' : ''}
        </button>
        <button onclick="bulkToggleTarif(false)"
            style="padding:5px 14px;border:1.5px solid #e2e8f0;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:#f8fafc;color:#94a3b8;white-space:nowrap">
            ⛔ Nonaktifkan semua ${_activeKatTab ? '"' + _activeKatTab + '"' : ''}
        </button>`;

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:32px 0">Belum ada tarif di database</p>`;
        return;
    }

    // Jika ada tab aktif dan ada sub-group untuk kategori ini → tampilkan accordion
    if (_activeKatTab && KATEGORI_SUB_GROUPS[_activeKatTab]) {
        container.innerHTML = _renderAccordionByKategori(_activeKatTab, filtered);
    } else if (!_activeKatTab) {
        // Tab "Semua" — kelompokkan per kategori, masing-masing jadi accordion grup
        container.innerHTML = _renderAccordionSemua(filtered);
    } else {
        // Kategori tanpa sub-grup (Lainnya, dll) — tampil flat seperti semula
        container.innerHTML = filtered.map(t => _renderTarifRow(t)).join('');
    }
}

// ─── Render accordion: Tab "Semua" ─────────────────────────
function _renderAccordionSemua(filtered) {
    const byKat = {};
    filtered.forEach(t => {
        if (!byKat[t.kategori]) byKat[t.kategori] = [];
        byKat[t.kategori].push(t);
    });
    return Object.keys(byKat).sort().map(kat => {
        const groupId = 'grp_all_' + kat;
        const isOpen  = window._accordionState[groupId] !== false; // default terbuka
        const count   = byKat[kat].length;
        const aktifCount = byKat[kat].filter(t => t.aktif).length;
        return _accordionShell({
            groupId,
            label: `${KAT_ICON[kat] || ''} ${kat}`,
            count,
            aktifCount,
            isOpen,
            bodyHtml: byKat[kat].map(t => _renderTarifRow(t, true)).join('')
        });
    }).join('');
}

// ─── Render accordion: Tab kategori tertentu dengan sub-grup ─
function _renderAccordionByKategori(kat, filtered) {
    const subGroups = KATEGORI_SUB_GROUPS[kat];
    const matched   = new Set();
    let html = '';

    subGroups.forEach(sg => {
        const items = filtered.filter(t => sg.items.includes(t.nama));
        items.forEach(t => matched.add(t.id));

        // Tampilkan accordion meski items kosong (siap diisi nanti)
        const groupId  = sg.id;
        const isOpen   = window._accordionState[groupId] !== false;
        const aktifCount = items.filter(t => t.aktif).length;

        html += _accordionShell({
            groupId,
            label: sg.label,
            count: items.length,
            aktifCount,
            isOpen,
            bodyHtml: items.length > 0
                ? items.map(t => _renderTarifRow(t)).join('')
                : `<div style="text-align:center;color:#94a3b8;padding:14px 0;font-size:12px;">Belum ada tarif untuk kelompok ini</div>`
        });
    });

    // Item yang tidak masuk sub-grup mana pun → tampil di "Lainnya"
    const unmatched = filtered.filter(t => !matched.has(t.id));
    if (unmatched.length > 0) {
        const groupId    = kat + '_lainnya';
        const isOpen     = window._accordionState[groupId] !== false;
        const aktifCount = unmatched.filter(t => t.aktif).length;
        html += _accordionShell({
            groupId,
            label: '📌 Lainnya',
            count: unmatched.length,
            aktifCount,
            isOpen,
            bodyHtml: unmatched.map(t => _renderTarifRow(t)).join('')
        });
    }

    return html;
}

// ─── Shell HTML accordion ────────────────────────────────────
function _accordionShell({ groupId, label, count, aktifCount, isOpen, bodyHtml }) {
    const inactiveCount = count - aktifCount;
    const badgeAktif    = aktifCount > 0
        ? `<span style="background:#dcfce7;color:#16a34a;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;">${aktifCount} aktif</span>`
        : '';
    const badgeNon      = inactiveCount > 0
        ? `<span style="background:#f1f5f9;color:#94a3b8;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;">${inactiveCount} nonaktif</span>`
        : '';

    return `
    <div style="border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:8px;overflow:hidden;">
        <button onclick="_toggleAccordion('${groupId}')"
            style="width:100%;display:flex;align-items:center;gap:8px;padding:10px 14px;
                   background:${isOpen ? 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))' : '#fafbfc'};
                   border:none;cursor:pointer;text-align:left;transition:background 0.2s;">
            <span style="font-size:13px;font-weight:700;color:var(--primary-dark);flex:1;">${label}</span>
            ${badgeAktif}${badgeNon}
            <span style="font-size:10px;color:#94a3b8;font-weight:600;">${count} item</span>
            <span style="font-size:14px;color:#94a3b8;transition:transform 0.2s;transform:rotate(${isOpen ? '90' : '0'}deg);">▶</span>
        </button>
        <div id="acc_body_${groupId}" style="display:${isOpen ? 'block' : 'none'};padding:0 14px 6px;">
            ${bodyHtml}
        </div>
    </div>`;
}

// ─── Toggle buka/tutup accordion ────────────────────────────
function _toggleAccordion(groupId) {
    const body = document.getElementById('acc_body_' + groupId);
    if (!body) return;
    const nowOpen = body.style.display === 'none';
    window._accordionState[groupId] = nowOpen;
    body.style.display = nowOpen ? 'block' : 'none';

    // Update ikon panah
    const btn = body.previousElementSibling;
    if (btn) {
        const arrow = btn.querySelector('span:last-child');
        if (arrow) arrow.style.transform = `rotate(${nowOpen ? '90' : '0'}deg)`;
        btn.style.background = nowOpen
            ? 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))'
            : '#fafbfc';
    }
}

// ─── Render satu baris tarif ─────────────────────────────────
function _renderTarifRow(t, showKat = false) {
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;${!t.aktif ? 'color:#94a3b8;' : ''}">${t.nama}</div>
            ${showKat ? `<div style="font-size:10px;color:#94a3b8">${KAT_ICON[t.kategori] || ''} ${t.kategori}</div>` : ''}
            ${t.keterangan ? `<div style="font-size:10px;color:#94a3b8">${t.keterangan}</div>` : ''}
        </div>
        <div style="font-weight:700;color:${t.aktif ? 'var(--primary)' : '#94a3b8'};font-size:13px;white-space:nowrap">
            Rp ${Number(t.harga).toLocaleString('id-ID')}
        </div>
        <button onclick="toggleAktifTarif('${t.id}', ${!t.aktif})" title="${t.aktif ? 'Nonaktifkan' : 'Aktifkan'}"
            style="padding:3px 8px;border:1.5px solid ${t.aktif ? '#22c55e' : '#e2e8f0'};border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:${t.aktif ? '#f0fdf4' : '#f8fafc'};color:${t.aktif ? '#16a34a' : '#94a3b8'};white-space:nowrap">
            ${t.aktif ? '✅' : '⛔'}
        </button>
        <button onclick="openEditTarif('${t.id}')"
            style="padding:4px 10px;border:1px solid var(--primary);border-radius:8px;color:var(--primary);font-size:11px;cursor:pointer;background:#fff">
            Edit
        </button>
    </div>`;
}

function _setBiayaTab(kat) {
    _activeKatTab = kat;
    renderDaftarTarif();
}

// ════════════════════════════════════════
//  FORM TAMBAH / EDIT TARIF
// ════════════════════════════════════════

function openEditTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    if (t) _openTarifModal(t);
}

function _openTarifModal(tarif) {
    if (!tarif) return;

    document.getElementById('_tarifModal')?.remove();
    const modal = document.createElement('div');
    modal.id = '_tarifModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;width:340px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.18)">
            <h3 style="margin:0 0 16px;font-size:16px">✏️ Edit Harga</h3>
            <label style="font-size:12px;font-weight:600">Nama Layanan</label>
            <div style="padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;color:#475569">
                ${KAT_ICON[tarif.kategori] || ''} ${tarif.nama}
            </div>
            <input type="hidden" id="_tf_nama" value="${tarif.nama}">
            <label style="font-size:12px;font-weight:600">Kategori</label>
            <div style="padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;color:#475569">
                ${tarif.kategori}
            </div>
            <input type="hidden" id="_tf_kat" value="${tarif.kategori}">
            <label style="font-size:12px;font-weight:600">Harga (Rp)</label>
            <input id="_tf_harga" type="number" value="${tarif.harga}" placeholder="0"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 16px;box-sizing:border-box">
            <div style="display:flex;gap:8px">
                <button onclick="document.getElementById('_tarifModal').remove()"
                    style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;cursor:pointer;background:#fff">
                    Batal
                </button>
                <button onclick="_saveTarifFromModal('${tarif.id}')"
                    style="flex:1;padding:10px;border:none;border-radius:10px;font-size:13px;cursor:pointer;background:var(--primary);color:#fff;font-weight:700">
                    Simpan
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function _saveTarifFromModal(id) {
    const nama  = document.getElementById('_tf_nama').value.trim();
    const kat   = document.getElementById('_tf_kat').value;
    const harga = document.getElementById('_tf_harga').value;
    const existing = window._tarifCache.find(x => String(x.id) === String(id));
    const aktif = existing ? existing.aktif : true;
    const ket   = existing ? existing.keterangan : null;

    if (!nama) return showToast('❌ Nama layanan wajib diisi', 'error');

    try {
        await sb_saveTarif({ id: id || undefined, nama, kategori: kat, harga: Number(harga) || 0, keterangan: ket || null, aktif });
        document.getElementById('_tarifModal')?.remove();
        showToast('✅ Tarif berhasil disimpan', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        console.error('[biaya] ❌ Gagal simpan tarif:', e);
        showToast('❌ Gagal menyimpan tarif: ' + (e.message || e), 'error');
    }
}

async function toggleAktifTarif(id, aktifBaru) {
    try {
        const t = window._tarifCache.find(x => String(x.id) === String(id));
        if (!t) return;
        await sb_saveTarif({ id, nama: t.nama, kategori: t.kategori, harga: t.harga, keterangan: t.keterangan, aktif: aktifBaru });
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        console.error('[biaya] ❌ Gagal toggle aktif:', e);
        showToast('❌ Gagal mengubah status', 'error');
    }
}

async function bulkToggleTarif(aktifBaru) {
    const targets = _activeKatTab
        ? window._tarifCache.filter(t => t.kategori === _activeKatTab)
        : window._tarifCache;

    const perlu = targets.filter(t => t.aktif !== aktifBaru);
    if (perlu.length === 0) {
        showToast(`Semua sudah ${aktifBaru ? 'aktif' : 'nonaktif'}`, 'info');
        return;
    }

    showToast(`⏳ Memproses ${perlu.length} layanan...`, 'info');
    try {
        await Promise.all(perlu.map(t =>
            sb_saveTarif({ id: t.id, nama: t.nama, kategori: t.kategori, harga: t.harga, keterangan: t.keterangan, aktif: aktifBaru })
        ));
        await _refreshTarifCache();
        renderDaftarTarif();
        const label = _activeKatTab ? `"${_activeKatTab}"` : 'semua';
        showToast(`✅ ${perlu.length} layanan ${label} berhasil di${aktifBaru ? 'aktifkan' : 'nonaktifkan'}`, 'success');
    } catch(e) {
        console.error('[biaya] ❌ Gagal bulk toggle:', e);
        showToast('❌ Gagal mengubah status massal', 'error');
    }
}


// ════════════════════════════════════════
//  MODAL TAGIHAN (setelah simpan rekam medis)
// ════════════════════════════════════════
async function showTagihanModal(kunjunganId, pasienId, kunjunganData) {
    if (!window._biayaAktif) return;

    let items = [];
    try {
        items = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData);
    } catch(e) {
        showToast('⚠️ Gagal generate tagihan otomatis', 'error');
    }

    _renderTagihanModal(kunjunganId, pasienId, items);
}

function _renderTagihanModal(kunjunganId, pasienId, items) {
    document.getElementById('_tagihanModal')?.remove();

    const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const modal    = document.createElement('div');
    modal.id       = '_tagihanModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 -4px 24px rgba(0,0,0,.15)">
            <h3 style="margin:0 0 4px;font-size:16px">🧾 Rincian Tagihan</h3>
            <p style="font-size:12px;color:#64748b;margin:0 0 14px">Periksa & sesuaikan sebelum menyimpan</p>
            <div id="_tagihanItemList">
                ${items.map((it, i) => _tagihanItemRow(it, i)).join('')}
            </div>
            <button onclick="_addTagihanItem()"
                style="width:100%;padding:9px;border:1.5px dashed var(--primary);border-radius:10px;color:var(--primary);font-size:13px;cursor:pointer;background:#f8faff;margin:8px 0">
                ➕ Tambah Item
            </button>
            <div style="border-top:1.5px solid #e2e8f0;margin:10px 0;padding-top:10px">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                    <span>Subtotal</span>
                    <span id="_tagihanSubtotal">Rp ${subtotal.toLocaleString('id-ID')}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;margin-bottom:10px">
                    <span>Diskon (Rp)</span>
                    <input id="_tagihanDiskon" type="number" value="0" min="0"
                        oninput="_recalcTagihan()"
                        style="width:120px;padding:5px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;text-align:right">
                </div>
                <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--primary)">
                    <span>TOTAL</span>
                    <span id="_tagihanTotal">Rp ${subtotal.toLocaleString('id-ID')}</span>
                </div>
            </div>
            <textarea id="_tagihanCatatan" placeholder="Catatan (opsional)" rows="2"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;margin-bottom:10px;resize:none"></textarea>
            <div style="display:flex;gap:8px">
                <button onclick="document.getElementById('_tagihanModal').remove()"
                    style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:13px;cursor:pointer;background:#fff">
                    Lewati
                </button>
                <button onclick="_simpanTagihan('${kunjunganId}','${pasienId}')"
                    style="flex:2;padding:12px;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--primary);color:#fff">
                    💾 Simpan Tagihan
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    window._tagihanItems = items;
}

function _tagihanItemRow(it, idx) {
    return `<div id="_trow_${idx}" style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #f1f5f9">
        <div style="flex:1;font-size:12px;font-weight:600">${it.nama_item}</div>
        <input type="number" value="${it.jumlah || 1}" min="1"
            oninput="window._tagihanItems[${idx}].jumlah=this.value;_recalcTagihan()"
            style="width:40px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:center">
        <input type="number" value="${it.harga_satuan}" min="0"
            oninput="window._tagihanItems[${idx}].harga_satuan=this.value;_recalcTagihan()"
            style="width:90px;padding:3px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:right">
        <button onclick="_removeTagihanItem(${idx})"
            style="padding:3px 7px;border:1px solid #ef4444;border-radius:6px;color:#ef4444;font-size:11px;cursor:pointer;background:#fff">✕</button>
    </div>`;
}

function _addTagihanItem() {
    window._tagihanItems = window._tagihanItems || [];
    window._tagihanItems.push({ nama_item: 'Item Baru', kategori: 'Lainnya', jumlah: 1, harga_satuan: 0 });
    const list = document.getElementById('_tagihanItemList');
    if (list) {
        const idx = window._tagihanItems.length - 1;
        list.insertAdjacentHTML('beforeend', _tagihanItemRow(window._tagihanItems[idx], idx));
    }
    _recalcTagihan();
}

function _removeTagihanItem(idx) {
    window._tagihanItems.splice(idx, 1);
    const list = document.getElementById('_tagihanItemList');
    if (list) list.innerHTML = window._tagihanItems.map((it, i) => _tagihanItemRow(it, i)).join('');
    _recalcTagihan();
}

function _recalcTagihan() {
    const items  = window._tagihanItems || [];
    const sub    = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const diskon = Number(document.getElementById('_tagihanDiskon')?.value) || 0;
    const total  = Math.max(0, sub - diskon);
    const subEl  = document.getElementById('_tagihanSubtotal');
    const totEl  = document.getElementById('_tagihanTotal');
    if (subEl) subEl.innerText = 'Rp ' + sub.toLocaleString('id-ID');
    if (totEl) totEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
}

async function _simpanTagihan(kunjunganId, pasienId) {
    const items   = window._tagihanItems || [];
    const diskon  = Number(document.getElementById('_tagihanDiskon')?.value) || 0;
    const catatan = document.getElementById('_tagihanCatatan')?.value || '';
    try {
        const result = await sb_saveTagihan(kunjunganId, pasienId, items, diskon, catatan);
        document.getElementById('_tagihanModal')?.remove();
        showToast(`✅ Tagihan Rp ${Number(result.total).toLocaleString('id-ID')} berhasil disimpan`, 'success');
    } catch(e) {
        showToast('❌ Gagal menyimpan tagihan', 'error');
    }
}
