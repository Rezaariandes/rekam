// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PEMBIAYAAN (biaya.js)
//  • Manajemen tarif layanan
//  • Auto-generate & simpan tagihan dari kunjungan
//  • Modal tagihan (muncul setelah simpan rekam medis)
//
//  Fungsi invoice (lihat, edit, print) → invoice.js
// ════════════════════════════════════════════════════════

// ── State ──
if (typeof window._tarifCache === 'undefined') window._tarifCache = [];
let _activeKatTab = '';

const TARIF_DEFAULT = [
    { nama: 'Vital Sign',                kategori: 'Pemeriksaan', harga: 15000  },
    { nama: 'Konsultasi Medis',          kategori: 'Pemeriksaan', harga: 50000  },
    { nama: 'Pemeriksaan Fisik',         kategori: 'Pemeriksaan', harga: 25000  },
    { nama: 'GDS',                       kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Kolesterol',                kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Asam Urat',                 kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Hemoglobin (HB)',           kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Trombosit',                 kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Leukosit',                  kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Eritrosit',                 kategori: 'Laboratorium', harga: 15000  },
    { nama: 'Hematokrit',               kategori: 'Laboratorium', harga: 15000  },
    { nama: 'HIV',                       kategori: 'Laboratorium', harga: 35000  },
    { nama: 'Sifilis',                   kategori: 'Laboratorium', harga: 35000  },
    { nama: 'Hepatitis B',               kategori: 'Laboratorium', harga: 35000  },
    { nama: 'HDL',                       kategori: 'Laboratorium', harga: 20000  },
    { nama: 'LDL',                       kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Trigliserida',             kategori: 'Laboratorium', harga: 20000  },
    { nama: 'GDP',                       kategori: 'Laboratorium', harga: 15000  },
    { nama: 'HbA1c',                    kategori: 'Laboratorium', harga: 45000  },
    { nama: 'SGOT',                      kategori: 'Laboratorium', harga: 20000  },
    { nama: 'SGPT',                      kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Ureum',                     kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Creatinin',                kategori: 'Laboratorium', harga: 20000  },
    { nama: 'Surat Keterangan Sakit',   kategori: 'Administrasi', harga: 15000  },
    { nama: 'Surat Keterangan Sehat',   kategori: 'Administrasi', harga: 25000  },
    { nama: 'Surat Rujukan',            kategori: 'Administrasi', harga: 10000  },
    { nama: 'EKG / Elektrokardiogram',  kategori: 'Penunjang',    harga: 50000  },
    { nama: 'Rontgen Thorax',           kategori: 'Penunjang',    harga: 100000 },
    { nama: 'USG Abdomen',              kategori: 'Penunjang',    harga: 150000 },
    { nama: 'Spirometri',               kategori: 'Penunjang',    harga: 75000  },
    { nama: 'Hecting / Jahit Luka',     kategori: 'Tindakan',     harga: 100000 },
    { nama: 'Ganti Verband',            kategori: 'Tindakan',     harga: 30000  },
    { nama: 'Injeksi / Suntik',         kategori: 'Tindakan',     harga: 25000  },
    { nama: 'Pemasangan Infus',         kategori: 'Tindakan',     harga: 75000  },
    { nama: 'Nebulisasi',               kategori: 'Tindakan',     harga: 50000  },
    { nama: 'Insisi Abses',             kategori: 'Tindakan',     harga: 150000 },
    { nama: 'Pemasangan Kateter',       kategori: 'Tindakan',     harga: 100000 },
];

const KAT_ICON = {
    'Pemeriksaan': '🩺',
    'Laboratorium': '🔬',
    'Obat': '💊',
    'Administrasi': '📋',
    'Penunjang': '🔭',
    'Tindakan': '⚕️',
    'Lainnya': '📌'
};

// ── Sub-grup Laboratorium — untuk pengelompokan di Page Biaya ──
// Nama `tarifNama` HARUS persis sama dengan kolom `nama` di tarif_layanan
const LAB_SUB_GROUPS = [
    {
        id: 'lab_dasar', label: '🩸 Lab Dasar',
        items: ['GDS', 'Kolesterol', 'Asam Urat']
    },
    {
        id: 'lab_darah_rutin', label: '🔴 Darah Rutin',
        items: ['Hemoglobin (HB)', 'Trombosit', 'Leukosit', 'Eritrosit', 'Hematokrit']
    },
    {
        id: 'lab_triple', label: '🧬 Triple Eliminasi',
        items: ['HIV', 'Sifilis', 'Hepatitis B']
    },
    {
        id: 'lab_lemak', label: '💧 Profil Lemak',
        items: ['HDL', 'LDL', 'Trigliserida']
    },
    {
        id: 'lab_gula', label: '🍬 Gula Darah',
        items: ['GDP', 'HbA1c']
    },
    {
        id: 'lab_hati', label: '🫀 Fungsi Hati',
        items: ['SGOT', 'SGPT']
    },
    {
        id: 'lab_ginjal', label: '🫘 Fungsi Ginjal',
        items: ['Ureum', 'Creatinin']
    }
];

// ════════════════════════════════════════
//  INIT HALAMAN TARIF
// ════════════════════════════════════════
async function initPageBiaya() {
    await _refreshTarifCache();
    renderDaftarTarif();
}

async function _refreshTarifCache() {
    try {
        window._tarifCache = await sb_getTarif();
        if (window._tarifCache.length === 0) {
            await _seedTarifDefault();
            window._tarifCache = await sb_getTarif();
        }
    } catch(e) {
        showToast('❌ Gagal memuat tarif', 'error');
    }
}

async function _seedTarifDefault() {
    const isFirstTime = window._tarifCache.length === 0;
    let added = 0;
    try {
        for (const t of TARIF_DEFAULT) {
            await sb_saveTarif({ ...t, aktif: true });
            added++;
        }
        if (added > 0) {
            showToast(
                isFirstTime
                    ? `✅ ${added} tarif default berhasil diinisialisasi`
                    : `ℹ️ ${added} tarif registry dikembalikan`,
                isFirstTime ? 'success' : 'info'
            );
        }
    } catch(e) {}
}

function renderDaftarTarif() {
    const container = document.getElementById('daftarTarif');
    const tabsEl    = document.getElementById('biayaKategoriTabs');
    if (!container) return;

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
                ${isAll ? '📋 Semua' : (KAT_ICON[k]||'📌') + ' ' + k}
            </button>`;
        }).join('');
    }

    const list = _activeKatTab
        ? window._tarifCache.filter(t => t.kategori === _activeKatTab)
        : window._tarifCache;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div>Belum ada tarif</div>`;
        return;
    }

    // Kelompokkan per kategori
    const grouped = {};
    list.forEach(t => {
        if (!grouped[t.kategori]) grouped[t.kategori] = [];
        grouped[t.kategori].push(t);
    });

    container.innerHTML = Object.entries(grouped).map(([kat, items]) => {
        if (kat === 'Laboratorium') {
            return _renderLabKategori(items);
        }
        const activeCount = items.filter(t => t.aktif).length;
        return `
        <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        margin-bottom:8px;padding:0 2px;flex-wrap:wrap;gap:6px;">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;
                             letter-spacing:.6px;color:var(--text-muted);">
                    ${KAT_ICON[kat]||'📌'} ${kat}
                    <span style="font-size:9.5px;background:rgba(var(--primary-rgb,37,99,235),0.08);
                                 color:var(--primary);border-radius:20px;padding:1px 7px;
                                 font-weight:700;margin-left:4px;">${activeCount}/${items.length} aktif</span>
                </div>
                <div style="display:flex;gap:5px;">
                    <button onclick="toggleSemuaTarifKategori('${kat}', true)"
                        style="padding:3px 8px;background:rgba(5,150,105,0.08);color:#059669;
                               border:1px solid rgba(5,150,105,0.25);border-radius:7px;
                               font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
                        ✅ Aktifkan Semua
                    </button>
                    <button onclick="toggleSemuaTarifKategori('${kat}', false)"
                        style="padding:3px 8px;background:rgba(100,116,139,0.08);color:#64748b;
                               border:1px solid rgba(100,116,139,0.2);border-radius:7px;
                               font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
                        ⏸️ Nonaktifkan Semua
                    </button>
                </div>
            </div>
            ${items.map(t => _htmlTarifRow(t)).join('')}
        </div>`;
    }).join('');
}

/** Render kategori Laboratorium dengan sub-grup */
function _renderLabKategori(allLabItems) {
    // Buat map: nama tarif → record
    const byNama = {};
    allLabItems.forEach(t => { byNama[t.nama] = t; });

    // Item yang tidak masuk sub-grup mana pun (tambahan manual admin)
    const knownNames = new Set(LAB_SUB_GROUPS.flatMap(g => g.items));
    const extras = allLabItems.filter(t => !knownNames.has(t.nama));

    const subGrupHtml = LAB_SUB_GROUPS.map(grp => {
        const grpItems = grp.items.map(nm => byNama[nm]).filter(Boolean);
        if (grpItems.length === 0) return ''; // sub-grup belum ada di DB sama sekali

        const activeCount = grpItems.filter(t => t.aktif).length;
        return `
        <div style="margin-bottom:10px;border:1px solid rgba(var(--primary-rgb,37,99,235),0.1);border-radius:10px;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:9px 12px;background:rgba(var(--primary-rgb,37,99,235),0.04);
                        cursor:pointer;" onclick="_toggleLabSubGrup('${grp.id}')">
                <span style="font-size:12px;font-weight:700;color:var(--text-primary,#1e293b);">${grp.label}</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:10px;font-weight:600;color:var(--primary,#2563eb);
                                 background:rgba(var(--primary-rgb,37,99,235),0.1);
                                 padding:2px 8px;border-radius:20px;">${activeCount}/${grpItems.length} aktif</span>
                    <span id="labgrp_arrow_biaya_${grp.id}" style="font-size:10px;color:var(--primary,#2563eb);">▶</span>
                </div>
            </div>
            <div id="labgrp_body_biaya_${grp.id}" style="display:none;padding:8px 12px;">
                ${grpItems.map(t => _htmlTarifRow(t)).join('')}
            </div>
        </div>`;
    }).join('');

    const extrasHtml = extras.length > 0
        ? `<div style="margin-bottom:10px;">
               <div style="font-size:10px;font-weight:700;color:var(--text-muted);
                           text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;padding:0 2px;">
                   📌 Lab Lainnya
               </div>
               ${extras.map(t => _htmlTarifRow(t)).join('')}
           </div>`
        : '';

    return `
    <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:8px;padding:0 2px;flex-wrap:wrap;gap:6px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;
                         letter-spacing:.6px;color:var(--text-muted);">
                🔬 Laboratorium
            </div>
            <div style="display:flex;gap:5px;">
                <button onclick="toggleSemuaTarifKategori('Laboratorium', true)"
                    style="padding:3px 8px;background:rgba(5,150,105,0.08);color:#059669;
                           border:1px solid rgba(5,150,105,0.25);border-radius:7px;
                           font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
                    ✅ Aktifkan Semua
                </button>
                <button onclick="toggleSemuaTarifKategori('Laboratorium', false)"
                    style="padding:3px 8px;background:rgba(100,116,139,0.08);color:#64748b;
                           border:1px solid rgba(100,116,139,0.2);border-radius:7px;
                           font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
                    ⏸️ Nonaktifkan Semua
                </button>
            </div>
        </div>
        ${subGrupHtml}
        ${extrasHtml}
    </div>`;
}

function _toggleLabSubGrup(id) {
    const body  = document.getElementById(`labgrp_body_biaya_${id}`);
    const arrow = document.getElementById(`labgrp_arrow_biaya_${id}`);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

/** Satu baris item tarif: toggle ON/OFF inline + edit + hapus */
function _htmlTarifRow(t) {
    const aktif = t.aktif !== false;
    return `
    <div id="tarifrow_${escHtml(String(t.id))}"
         style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                background:${aktif ? '#fff' : '#f8fafc'};
                border:1px solid ${aktif ? 'rgba(0,0,0,0.08)' : '#e2e8f0'};
                border-radius:10px;margin-bottom:6px;
                transition:opacity .2s;opacity:${aktif ? 1 : 0.55};">
        <!-- Toggle ON/OFF -->
        <label style="display:flex;align-items:center;cursor:pointer;flex-shrink:0;" title="${aktif ? 'Nonaktifkan' : 'Aktifkan'}">
            <input type="checkbox" ${aktif ? 'checked' : ''} style="display:none;"
                onchange="toggleAktifTarif('${escHtml(String(t.id))}', this.checked)">
            <div style="width:36px;height:20px;background:${aktif ? 'var(--primary,#2563eb)' : '#cbd5e1'};
                        border-radius:20px;position:relative;transition:background .2s;">
                <div style="position:absolute;top:2px;left:${aktif ? '18px' : '2px'};
                            width:16px;height:16px;background:#fff;border-radius:50%;
                            transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
            </div>
        </label>
        <!-- Info -->
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:12.5px;color:var(--primary-dark);">${escHtml(t.nama)}</div>
            ${t.keterangan ? `<div style="font-size:10.5px;color:var(--text-muted);">${escHtml(t.keterangan)}</div>` : ''}
            ${!aktif ? '<div style="font-size:10px;color:#94a3b8;font-style:italic;margin-top:1px;">⏸️ Non-aktif — tidak muncul di form & tagihan</div>' : ''}
        </div>
        <!-- Harga -->
        <div style="font-weight:800;font-size:13px;color:var(--primary);white-space:nowrap;margin-right:4px;">
            Rp ${_fmtRp(t.harga)}
        </div>
        <!-- Aksi -->
        <div style="display:flex;gap:4px;flex-shrink:0;">
            <button onclick="openModalTarif('${escHtml(String(t.id))}')"
                style="padding:5px 8px;background:var(--primary);color:#fff;border:none;border-radius:7px;font-size:11px;cursor:pointer;"
                title="Edit">✏️</button>
            <button onclick="hapusTarif('${escHtml(String(t.id))}')"
                style="padding:5px 8px;background:rgba(220,38,38,0.08);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:7px;font-size:11px;cursor:pointer;"
                title="Hapus">🗑️</button>
        </div>
    </div>`;
}

/** Kumpulkan state accordion lab yang sedang terbuka sebelum re-render */
function _getOpenLabGroups() {
    const open = new Set();
    LAB_SUB_GROUPS.forEach(grp => {
        const el = document.getElementById(`labgrp_body_biaya_${grp.id}`);
        if (el && el.style.display !== 'none') open.add(grp.id);
    });
    return open;
}

/** Restore state accordion lab setelah re-render */
function _restoreOpenLabGroups(openSet) {
    openSet.forEach(id => {
        const body  = document.getElementById(`labgrp_body_biaya_${id}`);
        const arrow = document.getElementById(`labgrp_arrow_biaya_${id}`);
        if (body)  body.style.display  = 'block';
        if (arrow) arrow.textContent   = '▼';
    });
}

/** Toggle aktif/nonaktif langsung dari baris tanpa buka modal */
async function toggleAktifTarif(id, aktif) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    if (!t) return;
    // Catat accordion lab yang sedang terbuka sebelum re-render
    const openGroups = _getOpenLabGroups();
    // Update UI optimistis dulu
    const row = document.getElementById(`tarifrow_${id}`);
    if (row) row.style.opacity = '0.5';
    try {
        await sb_saveTarif({ ...t, aktif });
        await _refreshTarifCache();
        renderDaftarTarif();
        // Kembalikan accordion yang tadinya terbuka
        _restoreOpenLabGroups(openGroups);
        // Refresh chip page medis jika sudah terbuka
        if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
        if (typeof renderSectionPermintaanLab === 'function') renderSectionPermintaanLab();
        if (typeof _renderSectionTindakan === 'function') _renderSectionTindakan();
    } catch(e) {
        showToast('❌ Gagal update status: ' + (e.message || ''), 'error');
        await _refreshTarifCache();
        renderDaftarTarif();
        _restoreOpenLabGroups(openGroups);
    }
}

/** Toggle semua tarif di satu kategori sekaligus */
async function toggleSemuaTarifKategori(kategori, aktif) {
    const items = window._tarifCache.filter(t => t.kategori === kategori);
    if (!items.length) return;
    const openGroups = _getOpenLabGroups();
    try {
        await Promise.all(items.map(t => sb_saveTarif({ ...t, aktif })));
        await _refreshTarifCache();
        renderDaftarTarif();
        _restoreOpenLabGroups(openGroups);
        showToast(
            `${aktif ? '✅' : '⏸️'} Semua ${items.length} item "${kategori}" ${aktif ? 'diaktifkan' : 'dinonaktifkan'}`,
            aktif ? 'success' : 'info'
        );
        if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
        if (typeof renderSectionPermintaanLab === 'function') renderSectionPermintaanLab();
        if (typeof _renderSectionTindakan === 'function') _renderSectionTindakan();
    } catch(e) {
        showToast('❌ Gagal update: ' + (e.message || ''), 'error');
        await _refreshTarifCache();
        renderDaftarTarif();
        _restoreOpenLabGroups(openGroups);
    }
}

function _setBiayaTab(kat) {
    _activeKatTab = kat;
    renderDaftarTarif();
}

// ════════════════════════════════════════
//  MODAL TAMBAH / EDIT TARIF
// ════════════════════════════════════════
function openModalTarif(id = null) {
    const modal = document.getElementById('modalTarif');
    if (!modal) return;
    _clearFormTarif();
    if (id) {
        document.getElementById('modalTarifTitle').textContent = '✏️ Edit Tarif';
        const t = window._tarifCache.find(x => String(x.id) === String(id));
        if (t) {
            document.getElementById('tarif_id').value         = t.id;
            document.getElementById('tarif_nama').value       = t.nama;
            document.getElementById('tarif_kategori').value   = t.kategori;
            document.getElementById('tarif_harga').value      = t.harga;
            document.getElementById('tarif_keterangan').value = t.keterangan || '';
            document.getElementById('tarif_aktif').checked    = t.aktif !== false;
            _onKategoriTarifChange(t.kategori);
        }
    } else {
        document.getElementById('modalTarifTitle').textContent = '➕ Tambah Tarif';
    }
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('tarif_nama')?.focus(), 100);
}

function closeModalTarif() {
    const m = document.getElementById('modalTarif');
    if (m) m.style.display = 'none';
}

function _clearFormTarif() {
    ['tarif_id','tarif_nama','tarif_harga','tarif_keterangan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const akt = document.getElementById('tarif_aktif');
    if (akt) akt.checked = true;
    const kat = document.getElementById('tarif_kategori');
    if (kat) { kat.value = 'Pemeriksaan'; _onKategoriTarifChange('Pemeriksaan'); }
}

function _onKategoriTarifChange(val) {
    const info = document.getElementById('infoTarifLab');
    if (info) info.style.display = val === 'Laboratorium' ? '' : 'none';
}

async function simpanTarif() {
    const nama  = document.getElementById('tarif_nama')?.value.trim();
    const harga = document.getElementById('tarif_harga')?.value;
    if (!nama)  return showToast('⚠️ Nama layanan wajib diisi', 'error');
    if (!harga && harga !== '0') return showToast('⚠️ Harga wajib diisi', 'error');

    const btn = document.querySelector('#modalTarif button[onclick="simpanTarif()"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }

    try {
        await sb_saveTarif({
            id:         document.getElementById('tarif_id')?.value || null,
            nama,
            kategori:   document.getElementById('tarif_kategori')?.value  || 'Pemeriksaan',
            harga,
            keterangan: document.getElementById('tarif_keterangan')?.value || null,
            aktif:      document.getElementById('tarif_aktif')?.checked !== false
        });
        // Tutup modal DULU sebelum tampilkan toast
        // agar toast tidak tertutup oleh overlay modal (z-index conflict)
        closeModalTarif();
        await _refreshTarifCache();
        renderDaftarTarif();
        showToast('✅ Tarif berhasil disimpan', 'success');
        // BUG-3 FIX: Refresh chip di page medis agar item baru langsung muncul
        if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();
        if (typeof renderSectionPermintaanLab === 'function') renderSectionPermintaanLab();
        if (typeof _renderSectionTindakan === 'function') _renderSectionTindakan();
    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan'; }
    }
}

async function hapusTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    const isRegistry = t && TARIF_DEFAULT.some(d => d.nama === t.nama && d.kategori === t.kategori);
    const msg = isRegistry
        ? `⚠️ "${t?.nama}" adalah layanan bawaan sistem.\n\nJika dihapus akan muncul kembali otomatis. Gunakan toggle ON/OFF untuk menyembunyikan permanen.\n\nTetap hapus sementara?`
        : `Hapus tarif "${t?.nama || 'ini'}"? Aksi ini tidak dapat dibatalkan.`;
    if (!confirm(msg)) return;
    try {
        await sb_deleteTarif(id);
        showToast('🗑️ Tarif dihapus', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        showToast('❌ Gagal menghapus', 'error');
    }
}

// ════════════════════════════════════════
//  MODAL TAGIHAN — muncul setelah simpan rekam medis
// ════════════════════════════════════════
let _tagihanItems    = [];
let _tagihanKunjId   = null;
let _tagihanPasienId = null;
let _tagihanPasienNama = '';
let _tagihanTgl      = '';
let _tagihanDiskon   = 0;

async function openModalTagihan(kunjunganId, pasienId, pasienNama, tgl, kunjunganData) {
    if (!window._biayaAktif) return;
    try {
        await _sbFetch('tarif_layanan?select=id&limit=1');
    } catch(e) {
        const msg = e.message || '';
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) return;
    }

    _tagihanKunjId     = kunjunganId;
    _tagihanPasienId   = pasienId;
    _tagihanPasienNama = pasienNama || '—';
    _tagihanTgl        = tgl || '';
    _tagihanDiskon     = 0;

    if (window._tarifCache.length === 0) await _refreshTarifCache();

    try { _tagihanItems = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData); }
    catch(e) { _tagihanItems = []; }

    let modal = document.getElementById('modalTagihan');
    if (!modal) { modal = _buildModalTagihan(); document.body.appendChild(modal); }
    _renderModalTagihanContent();
    modal.style.display = 'block';
}

function closeModalTagihan() {
    const m = document.getElementById('modalTagihan');
    if (m) m.style.display = 'none';
}

function _buildModalTagihan() {
    const div = document.createElement('div');
    div.id = 'modalTagihan';
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.5);overflow-y:auto;padding:12px;';
    div.innerHTML = `<div id="modalTagihanInner" style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;"></div>`;
    return div;
}

function _renderModalTagihanContent() {
    const inner = document.getElementById('modalTagihanInner');
    if (!inner) return;

    const subtotal = _tagihanItems.reduce((s, i) => s + (i.jumlah * i.harga_satuan), 0);
    const diskon   = _tagihanDiskon;
    const total    = Math.max(0, subtotal - diskon);

    inner.innerHTML = `
    <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:18px 20px 16px;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
                <div style="font-size:16px;font-weight:800;margin-bottom:2px;">🧾 Tagihan Kunjungan</div>
                <div style="font-size:11.5px;opacity:.85;">${escHtml(_tagihanPasienNama)} · ${_tagihanTgl ? formatTglIndo(_tagihanTgl) : '—'}</div>
            </div>
            <button onclick="closeModalTagihan()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:8px;padding:5px 9px;font-size:16px;cursor:pointer;line-height:1;">✕</button>
        </div>
    </div>
    <div style="padding:16px 18px;">
        <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:12px;font-weight:800;color:var(--primary-dark);">Item Tagihan</div>
                <button onclick="_addItemTagihanManual()"
                    style="padding:4px 10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                    ➕ Tambah Item
                </button>
            </div>
            <div id="tagihanItemList">
                ${_tagihanItems.length === 0
                    ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:16px;">Tidak ada item. Klik "➕ Tambah Item" untuk menambah manual.</div>'
                    : _tagihanItems.map((item, idx) => _htmlTagihanItem(item, idx)).join('')}
            </div>
        </div>
        <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:var(--text-muted);">
                <span>Subtotal</span><span style="font-weight:700;color:var(--text);">Rp ${_fmtRp(subtotal)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:12px;color:var(--text-muted);flex-shrink:0;">Diskon (Rp)</span>
                <input type="number" id="inp_diskon" value="${diskon}" min="0" max="${subtotal}" placeholder="0"
                    style="flex:1;padding:5px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:right;"
                    oninput="window._tagihanDiskon=Number(this.value)||0;_renderModalTagihanContent()">
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                <span style="font-size:14px;font-weight:800;color:var(--primary-dark);">TOTAL</span>
                <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(total)}</span>
            </div>
        </div>
        <div style="margin-bottom:14px;">
            <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Catatan</label>
            <input type="text" id="inp_catatan_tagihan" placeholder="Opsional"
                style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="simpanTagihan()" style="flex:1;min-width:100px;padding:11px;background:var(--success);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                💾 Simpan Tagihan
            </button>
            <button onclick="simpanDanPrintTagihan()" style="flex:1;min-width:100px;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                🖨️ Simpan & Print
            </button>
            <button onclick="closeModalTagihan()" style="padding:11px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                Lewati
            </button>
        </div>
    </div>`;
}

function _htmlTagihanItem(item, idx) {
    const sub = Number(item.jumlah) * Number(item.harga_satuan);
    const katColor = {'Pemeriksaan':'#3b82f6','Laboratorium':'#7c3aed','Obat':'#059669','Administrasi':'#d97706','Tindakan':'#dc2626'}[item.kategori] || '#64748b';
    return `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:#fff;border:1px solid rgba(0,0,0,0.07);border-radius:9px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:12px;color:var(--primary-dark);">${escHtml(item.nama_item)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:9.5px;background:${katColor}18;color:${katColor};padding:1px 6px;border-radius:10px;font-weight:700;">${escHtml(item.kategori)}</span>
                <span style="font-size:10.5px;color:var(--text-muted);">Rp ${_fmtRp(item.harga_satuan)}</span>
                ${item.keterangan ? `<span style="font-size:10px;color:var(--text-muted);">(${escHtml(item.keterangan)})</span>` : ''}
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            <input type="number" value="${item.jumlah}" min="1"
                style="width:42px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;text-align:center;"
                onchange="_updateTagihanItem(${idx},'jumlah',this.value)">
            <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:70px;text-align:right;">Rp ${_fmtRp(sub)}</div>
            <button onclick="_hapusTagihanItem(${idx})" style="background:none;border:none;color:#dc2626;font-size:15px;cursor:pointer;padding:0;line-height:1;">✕</button>
        </div>
    </div>`;
}

function _hapusTagihanItem(idx) {
    _tagihanItems.splice(idx, 1);
    _renderModalTagihanContent();
}

function _updateTagihanItem(idx, field, val) {
    if (_tagihanItems[idx]) {
        _tagihanItems[idx][field] = Number(val) || 1;
        _renderModalTagihanContent();
    }
}

function _addItemTagihanManual() {
    let modal = document.getElementById('modalTambahItemTagihan');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalTambahItemTagihan';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);overflow-y:auto;padding:16px;';
        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:400px;margin:0 auto;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
            <div style="font-size:14px;font-weight:800;margin-bottom:12px;color:var(--primary-dark);">➕ Tambah Item Tagihan</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div>
                    <label class="form-label" style="font-size:11px;">Pilih dari tarif</label>
                    <select id="selTarifPilih" class="form-control" style="font-size:12px;" onchange="_onPilihTarifManual(this.value)">
                        <option value="">-- Pilih tarif yang ada --</option>
                        <option value="__manual__">-- Input manual --</option>
                    </select>
                </div>
                <div id="formItemManual" style="display:none;flex-direction:column;gap:6px;">
                    <input type="text" id="inp_item_nama" class="form-control" placeholder="Nama item" style="font-size:12px;">
                    <select id="inp_item_kat" class="form-control" style="font-size:12px;">
                        ${Object.keys(KAT_ICON).map(k => `<option value="${k}">${KAT_ICON[k]} ${k}</option>`).join('')}
                    </select>
                    <input type="number" id="inp_item_harga" class="form-control" placeholder="Harga (Rp)" min="0" style="font-size:12px;">
                </div>
                <input type="number" id="inp_item_qty" class="form-control" placeholder="Jumlah" value="1" min="1" style="font-size:12px;">
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button onclick="_konfirmasiTambahItem()" style="flex:1;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;">✅ Tambah</button>
                <button onclick="document.getElementById('modalTambahItemTagihan').style.display='none'"
                    style="padding:10px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:9px;font-size:12px;cursor:pointer;">Batal</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    // Selalu rebuild dropdown
    const selTarif = document.getElementById('selTarifPilih');
    if (selTarif) {
        selTarif.innerHTML = `<option value="">-- Pilih tarif yang ada --</option>
            ${window._tarifCache.filter(t => t.aktif).map(t =>
                `<option value="${t.id}">${escHtml(t.nama)} (Rp ${_fmtRp(t.harga)})</option>`
            ).join('')}
            <option value="__manual__">-- Input manual --</option>`;
        selTarif.value = '';
    }
    const frm = document.getElementById('formItemManual');
    if (frm) frm.style.display = 'none';
    const qty = document.getElementById('inp_item_qty');
    if (qty) qty.value = 1;
    modal.style.display = 'block';
}

function _onPilihTarifManual(val) {
    const frm = document.getElementById('formItemManual');
    if (frm) frm.style.display = val === '__manual__' ? 'flex' : 'none';
}

function _konfirmasiTambahItem() {
    const selVal = document.getElementById('selTarifPilih')?.value;
    const qty    = Number(document.getElementById('inp_item_qty')?.value) || 1;
    if (!selVal) return showToast('⚠️ Pilih item terlebih dahulu', 'error');
    let item;
    if (selVal === '__manual__') {
        const nama  = document.getElementById('inp_item_nama')?.value.trim();
        const kat   = document.getElementById('inp_item_kat')?.value  || 'Lainnya';
        const harga = Number(document.getElementById('inp_item_harga')?.value) || 0;
        if (!nama) return showToast('⚠️ Nama item wajib diisi', 'error');
        item = { nama_item: nama, kategori: kat, jumlah: qty, harga_satuan: harga };
    } else {
        const t = window._tarifCache.find(x => String(x.id) === String(selVal));
        if (!t) return;
        item = { nama_item: t.nama, kategori: t.kategori, jumlah: qty, harga_satuan: t.harga };
    }
    _tagihanItems.push(item);
    document.getElementById('modalTambahItemTagihan').style.display = 'none';
    _renderModalTagihanContent();
}

// ════════════════════════════════════════
//  SIMPAN TAGIHAN
// ════════════════════════════════════════
async function simpanTagihan() {
    if (!_tagihanKunjId) return showToast('⚠️ Kunjungan tidak valid', 'error');
    const diskon  = _tagihanDiskon || 0;
    const catatan = document.getElementById('inp_catatan_tagihan')?.value || '';
    try {
        const result = await sb_saveTagihan(_tagihanKunjId, _tagihanPasienId, _tagihanItems, diskon, catatan);
        showToast(`✅ Tagihan Rp ${_fmtRp(result.total)} tersimpan`, 'success');
        closeModalTagihan();
        if (typeof renderRiwayatList === 'function' && typeof currentRiwayat !== 'undefined') {
            renderRiwayatList(currentRiwayat, 'historyListMedis');
        }
        return true;
    } catch(e) {
        showToast('❌ Gagal simpan tagihan: ' + (e.message || ''), 'error');
        return false;
    }
}

async function simpanDanPrintTagihan() {
    const ok = await simpanTagihan();
    if (!ok) return;
    // printInvoice tersedia dari invoice.js
    const tagihan = await sb_getTagihan(_tagihanKunjId).catch(() => null);
    if (tagihan && typeof printInvoice === 'function') {
        printInvoice(tagihan, _tagihanPasienNama, _tagihanTgl);
    }
}

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════
function _fmtRp(n) {
    return Number(n || 0).toLocaleString('id-ID');
}
