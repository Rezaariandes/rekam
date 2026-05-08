// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PEMBIAYAAN (biaya.js)
//  • Manajemen tarif layanan
//  • Auto-generate tagihan dari kunjungan
//  • Invoice viewer + print
// ════════════════════════════════════════════════════════

// ── State ──
// BUG-FIX: Simpan di window._tarifCache (bukan let lokal) agar lab-request.js
// dan modul lain bisa membaca tarif aktif tanpa fetch ulang.
if (typeof window._tarifCache === 'undefined') window._tarifCache = [];
let _activeKatTab = '';  // tab kategori aktif di page-biaya

// Kategori bawaan yang harus ada saat tarif pertama kali dimuat
const TARIF_DEFAULT = [
    { nama: 'Vital Sign',                kategori: 'Pemeriksaan', harga: 15000  },
    { nama: 'Konsultasi Medis',          kategori: 'Pemeriksaan', harga: 50000  },
    { nama: 'Pemeriksaan Fisik',         kategori: 'Pemeriksaan', harga: 25000  },
    { nama: 'GDS',                        kategori: 'Laboratorium', harga: 15000  },
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
    // Pemeriksaan Penunjang
    { nama: 'EKG / Elektrokardiogram',  kategori: 'Penunjang',    harga: 50000  },
    { nama: 'Rontgen Thorax',           kategori: 'Penunjang',    harga: 100000 },
    { nama: 'USG Abdomen',              kategori: 'Penunjang',    harga: 150000 },
    { nama: 'Spirometri',               kategori: 'Penunjang',    harga: 75000  },
    // Tindakan Medis
    { nama: 'Hecting / Jahit Luka',     kategori: 'Tindakan',     harga: 100000 },
    { nama: 'Ganti Verband',            kategori: 'Tindakan',     harga: 30000  },
    { nama: 'Injeksi / Suntik',         kategori: 'Tindakan',     harga: 25000  },
    { nama: 'Pemasangan Infus',         kategori: 'Tindakan',     harga: 75000  },
    { nama: 'Nebulisasi',               kategori: 'Tindakan',     harga: 50000  },
    { nama: 'Insisi Abses',             kategori: 'Tindakan',     harga: 150000 },
    { nama: 'Pemasangan Kateter',       kategori: 'Tindakan',     harga: 100000 }
];

// Ikon per kategori
const KAT_ICON = {
    'Pemeriksaan': '🩺',
    'Laboratorium': '🔬',
    'Obat': '💊',
    'Administrasi': '📋',
    'Penunjang': '🔭',
    'Tindakan': '⚕️',
    'Lainnya': '📌'
};

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
        // Seed default jika kosong
        if (window._tarifCache.length === 0) {
            await _seedTarifDefault();
            window._tarifCache = await sb_getTarif();
        }
    } catch(e) {
        showToast('❌ Gagal memuat tarif', 'error');
    }
}

async function _seedTarifDefault() {
    // BUG-12 FIX: gunakan flag isFirstTime agar pesan berbeda antara setup awal dan pemulihan
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
                    : `ℹ️ ${added} tarif registry dikembalikan (mungkin sebelumnya terhapus)`,
                isFirstTime ? 'success' : 'info'
            );
        }
    } catch(e) {}
}

function renderDaftarTarif() {
    const container = document.getElementById('daftarTarif');
    const tabsEl    = document.getElementById('biayaKategoriTabs');
    if (!container) return;

    // Build kategori tabs
    const categories = [...new Set(window._tarifCache.map(t => t.kategori))].sort();
    if (tabsEl) {
        tabsEl.innerHTML = ['', ...categories].map(k => {
            const isAll = k === '';
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

    // Filter
    const list = _activeKatTab
        ? window._tarifCache.filter(t => t.kategori === _activeKatTab)
        : window._tarifCache;

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div>Belum ada tarif</div>`;
        return;
    }

    // Group by kategori
    const grouped = {};
    list.forEach(t => {
        if (!grouped[t.kategori]) grouped[t.kategori] = [];
        grouped[t.kategori].push(t);
    });

    container.innerHTML = Object.entries(grouped).map(([kat, items]) => `
        <div style="margin-bottom:16px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-muted);margin-bottom:8px;padding:0 2px;">
                ${KAT_ICON[kat]||'📌'} ${kat}
            </div>
            ${items.map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${t.aktif ? '#fff' : '#f8fafc'};
                        border:1px solid ${t.aktif ? 'rgba(0,0,0,0.08)' : '#e2e8f0'};
                        border-radius:10px;margin-bottom:6px;opacity:${t.aktif ? 1 : 0.6};">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:12.5px;color:var(--primary-dark);">${escHtml(t.nama)}</div>
                    ${t.keterangan ? `<div style="font-size:10.5px;color:var(--text-muted);">${escHtml(t.keterangan)}</div>` : ''}
                    ${!t.aktif ? '<div style="font-size:10px;color:#94a3b8;font-style:italic;">⏸️ Non-aktif</div>' : ''}
                </div>
                <div style="font-weight:800;font-size:14px;color:var(--primary);white-space:nowrap;">Rp ${_fmtRp(t.harga)}</div>
                <div style="display:flex;gap:5px;flex-shrink:0;">
                    <button onclick="openModalTarif('${escHtml(String(t.id))}')"
                        style="padding:5px 8px;background:var(--primary);color:#fff;border:none;border-radius:7px;font-size:11px;cursor:pointer;">✏️</button>
                    <button onclick="hapusTarif('${escHtml(String(t.id))}')"
                        style="padding:5px 8px;background:rgba(220,38,38,0.08);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:7px;font-size:11px;cursor:pointer;">🗑️</button>
                </div>
            </div>`).join('')}
        </div>
    `).join('');
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
    const nama = document.getElementById('tarif_nama')?.value.trim();
    const harga = document.getElementById('tarif_harga')?.value;
    if (!nama)  return showToast('⚠️ Nama layanan wajib diisi', 'error');
    if (!harga) return showToast('⚠️ Harga wajib diisi', 'error');

    try {
        await sb_saveTarif({
            id:         document.getElementById('tarif_id')?.value || null,
            nama,
            kategori:   document.getElementById('tarif_kategori')?.value  || 'Pemeriksaan',
            harga,
            keterangan: document.getElementById('tarif_keterangan')?.value || null,
            aktif:      document.getElementById('tarif_aktif')?.checked !== false
        });
        showToast('✅ Tarif tersimpan', 'success');
        closeModalTarif();
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    }
}

async function hapusTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    const isRegistry = t && TARIF_DEFAULT.some(d => d.nama === t.nama && d.kategori === t.kategori);

    let msg;
    if (isRegistry) {
        // BUG-13 FIX: jelaskan dengan akurat bahwa item registry akan muncul kembali
        msg = `⚠️ "${t?.nama || 'Tarif ini'}" adalah layanan bawaan sistem.\n\nJika dihapus, layanan ini akan MUNCUL KEMBALI otomatis saat halaman Tarif dibuka ulang karena terhubung ke registry sistem.\n\nUntuk menyembunyikan permanen, gunakan toggle ON/OFF pada item tersebut.\n\nTetap hapus sementara?`;
    } else {
        msg = `Hapus tarif "${t?.nama || 'ini'}"? Aksi ini tidak dapat dibatalkan.`;
    }

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
let _tagihanItems   = [];
let _tagihanKunjId  = null;
let _tagihanPasienId= null;
let _tagihanPasienNama = '';
let _tagihanTgl     = '';
// BUG-05 FIX: simpan diskon di state module-level, bukan hanya di DOM
// agar tidak ter-reset saat _renderModalTagihanContent() dipanggil ulang
let _tagihanDiskon  = 0;

/** Dipanggil dari kunjungan.js setelah saveAll sukses */
async function openModalTagihan(kunjunganId, pasienId, pasienNama, tgl, kunjunganData) {
    // Guard: modul harus aktif
    if (!window._biayaAktif) return;
    // Guard: tabel harus ada — cek dulu tanpa crash
    try {
        await _sbFetch('tarif_layanan?select=id&limit=1');
    } catch(e) {
        const msg = e.message || '';
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
            console.warn('[Biaya] Tabel belum ada — skip modal tagihan. Jalankan SETUP_DATABASE.sql');
            return; // silent skip — jangan ganggu flow rekam medis
        }
    }

    _tagihanKunjId   = kunjunganId;
    _tagihanPasienId = pasienId;
    _tagihanPasienNama = pasienNama || '—';
    _tagihanTgl      = tgl || '';
    _tagihanDiskon   = 0; // BUG-05 FIX: reset state diskon setiap kali modal dibuka

    // Pastikan tarif cache tersedia
    if (window._tarifCache.length === 0) {
        await _refreshTarifCache();
    }

    // Auto-generate items dari kunjungan
    try {
        _tagihanItems = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData);
    } catch(e) {
        _tagihanItems = [];
    }

    // Bangun modal jika belum ada
    let modal = document.getElementById('modalTagihan');
    if (!modal) {
        modal = _buildModalTagihan();
        document.body.appendChild(modal);
    }
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
    <!-- Header -->
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

        <!-- Item list -->
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
                    ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:16px;">Tidak ada item tagihan. Klik "➕ Tambah Item" untuk menambah manual.</div>'
                    : _tagihanItems.map((item, idx) => _htmlTagihanItem(item, idx)).join('')
                }
            </div>
        </div>

        <!-- Diskon & Total -->
        <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:var(--text-muted);">
                <span>Subtotal</span><span style="font-weight:700;color:var(--text);">Rp ${_fmtRp(subtotal)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:12px;color:var(--text-muted);flex-shrink:0;">Diskon (Rp)</span>
                <input type="number" id="inp_diskon" value="${diskon}" min="0" max="${subtotal}" placeholder="0"
                    style="flex:1;padding:5px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:right;"
                    oninput="window._tagihanDiskon=Number(this.value)||0; _renderModalTagihanContent()">
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                <span style="font-size:14px;font-weight:800;color:var(--primary-dark);">TOTAL</span>
                <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(total)}</span>
            </div>
        </div>

        <!-- Catatan -->
        <div style="margin-bottom:14px;">
            <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Catatan</label>
            <input type="text" id="inp_catatan_tagihan" placeholder="Opsional"
                style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;">
        </div>

        <!-- Tombol aksi -->
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
    const sub = (Number(item.jumlah) * Number(item.harga_satuan));
    const katColor = {
        'Pemeriksaan': '#3b82f6', 'Laboratorium': '#7c3aed',
        'Obat': '#059669', 'Administrasi': '#d97706', 'Tindakan': '#dc2626'
    }[item.kategori] || '#64748b';

    return `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:#fff;
                border:1px solid rgba(0,0,0,0.07);border-radius:9px;margin-bottom:5px;">
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
                onchange="_updateTagihanItem(${idx}, 'jumlah', this.value)">
            <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:70px;text-align:right;">Rp ${_fmtRp(sub)}</div>
            <button onclick="_hapusTagihanItem(${idx})"
                style="background:none;border:none;color:#dc2626;font-size:15px;cursor:pointer;padding:0;line-height:1;">✕</button>
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
    // Build mini inline-form atau ambil dari tarif
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

    // BUG-08 FIX: Selalu rebuild dropdown saat modal dibuka agar daftar tarif selalu terkini
    const selTarif = document.getElementById('selTarifPilih');
    if (selTarif) {
        selTarif.innerHTML = `<option value="">-- Pilih tarif yang ada --</option>
            ${window._tarifCache.filter(t => t.aktif).map(t =>
                `<option value="${t.id}" data-nama="${escHtml(t.nama)}" data-kat="${escHtml(t.kategori)}" data-harga="${t.harga}">
                    ${escHtml(t.nama)} (Rp ${_fmtRp(t.harga)})
                </option>`
            ).join('')}
            <option value="__manual__">-- Input manual --</option>`;
    }
    const sel = document.getElementById('selTarifPilih');
    if (sel) sel.value = '';
    const frm = document.getElementById('formItemManual');
    if (frm) frm.style.display = 'none';
    const qty = document.getElementById('inp_item_qty');
    if (qty) qty.value = 1;

    modal.style.display = 'block';
}

function _onPilihTarifManual(val) {
    const frm = document.getElementById('formItemManual');
    if (val === '__manual__') {
        if (frm) frm.style.display = 'flex';
    } else {
        if (frm) frm.style.display = 'none';
    }
}

function _konfirmasiTambahItem() {
    const selVal = document.getElementById('selTarifPilih')?.value;
    const qty    = Number(document.getElementById('inp_item_qty')?.value) || 1;

    if (!selVal) return showToast('⚠️ Pilih item terlebih dahulu', 'error');

    let item;
    if (selVal === '__manual__') {
        const nama  = document.getElementById('inp_item_nama')?.value.trim();
        const kat   = document.getElementById('inp_item_kat')?.value || 'Lainnya';
        const harga = Number(document.getElementById('inp_item_harga')?.value) || 0;
        if (!nama)  return showToast('⚠️ Nama item wajib diisi', 'error');
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
    // BUG-05 FIX: baca diskon dari state module-level, bukan dari DOM
    const diskon  = _tagihanDiskon || 0;
    const catatan = document.getElementById('inp_catatan_tagihan')?.value || '';

    try {
        const result = await sb_saveTagihan(
            _tagihanKunjId, _tagihanPasienId, _tagihanItems, diskon, catatan
        );
        showToast(`✅ Tagihan Rp ${_fmtRp(result.total)} tersimpan`, 'success');
        closeModalTagihan();
        // Refresh riwayat jika ada
        if (typeof renderRiwayatList === 'function' && currentRiwayat) {
            renderRiwayatList(currentRiwayat, 'historyListMedis');
        }
        return true; // BUG-04 FIX: return true agar simpanDanPrintTagihan bisa cek status
    } catch(e) {
        showToast('❌ Gagal simpan tagihan: ' + (e.message || ''), 'error');
        return false; // BUG-04 FIX: return false saat gagal
    }
}

async function simpanDanPrintTagihan() {
    // BUG-04 FIX: cek apakah simpan berhasil sebelum lanjut ke print
    const ok = await simpanTagihan();
    if (!ok) return; // batalkan print jika simpan gagal
    const tagihan = await sb_getTagihan(_tagihanKunjId).catch(() => null);
    if (tagihan) printInvoice(tagihan, _tagihanPasienNama, _tagihanTgl);
}

// ════════════════════════════════════════
//  LIHAT TAGIHAN DARI RIWAYAT
// ════════════════════════════════════════
async function lihatTagihanKunjungan(kunjunganId, pasienNama, tgl) {
    if (!kunjunganId) {
        showToast('⚠️ ID kunjungan tidak tersedia', 'error');
        return;
    }
    if (!window._biayaAktif) {
        showToast('ℹ️ Modul pembiayaan belum diaktifkan di Settings', 'info');
        return;
    }

    // Tampilkan loading agar tidak terkesan freeze
    showToast('⏳ Memuat tagihan...', 'info');

    try {
        const tagihan = await sb_getTagihan(kunjunganId);
        if (!tagihan) {
            // BUG-4 FIX: Jika belum ada tagihan, tawarkan untuk membuat dari riwayat
            if (confirm(`ℹ️ Belum ada tagihan untuk kunjungan ini.\n\nBuat tagihan sekarang?`)) {
                // Ambil data kunjungan untuk auto-generate
                try {
                    const kunjData = await sb_getKunjunganById(kunjunganId);
                    if (kunjData) {
                        _tagihanKunjId    = kunjunganId;
                        _tagihanPasienId  = kunjData.pasien_id || null;
                        _tagihanPasienNama = pasienNama || '—';
                        _tagihanTgl       = tgl || '';
                        if (window._tarifCache.length === 0) await _refreshTarifCache();
                        try {
                            _tagihanItems = await sb_autoTagihanFromKunjungan(kunjunganId, kunjData);
                        } catch(e) { _tagihanItems = []; }
                        let modal = document.getElementById('modalTagihan');
                        if (!modal) { modal = _buildModalTagihan(); document.body.appendChild(modal); }
                        _renderModalTagihanContent();
                        modal.style.display = 'block';
                    }
                } catch(e) {
                    showToast('❌ Gagal memuat data kunjungan', 'error');
                }
            }
            return;
        }
        _showInvoiceModal(tagihan, pasienNama || '—', tgl || '');
    } catch(e) {
        const msg = e.message || '';
        if (msg.includes('does not exist') || msg.includes('relation')) {
            showToast('⚠️ Tabel tagihan belum dibuat. Jalankan SETUP_DATABASE.sql di Supabase terlebih dahulu.', 'error');
        } else {
            showToast('❌ Gagal memuat tagihan: ' + msg, 'error');
        }
        console.error('[lihatTagihanKunjungan]', e);
    }
}

function _showInvoiceModal(tagihan, pasienNama, tgl) {
    // Simpan tagihan ke window var — JANGAN pakai JSON.stringify di onclick attribute
    window._invoiceData    = tagihan;
    window._invoiceNama    = pasienNama || '';
    window._invoiceTgl     = tgl || '';
    // Reset mode edit
    window._invoiceEditMode  = false;
    window._invoiceEditItems = null;

    let modal = document.getElementById('modalInvoiceView');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalInvoiceView';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.5);overflow-y:auto;padding:12px;';
        document.body.appendChild(modal);
    }

    _renderInvoiceModal();
    modal.style.display = 'block';
}

/** Render ulang seluruh isi modal invoice (view atau edit mode) */
function _renderInvoiceModal() {
    const modal = document.getElementById('modalInvoiceView');
    if (!modal) return;
    const tagihan   = window._invoiceData;
    const pasienNama = window._invoiceNama || '';
    const tgl        = window._invoiceTgl  || '';
    const editMode   = window._invoiceEditMode === true;

    if (!editMode) {
        // ── VIEW MODE ──
        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;">
            ${_buildInvoiceHtml(tagihan, pasienNama, tgl, false)}
            <div style="padding:12px 18px 18px;display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="_printInvoiceFromWindow()"
                    style="flex:1;min-width:110px;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                    🖨️ Print Invoice
                </button>
                <button onclick="_mulaiEditInvoice()"
                    style="flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                    ✏️ Edit Invoice
                </button>
                <button onclick="document.getElementById('modalInvoiceView').style.display='none'"
                    style="padding:11px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                    Tutup
                </button>
            </div>
        </div>`;
    } else {
        // ── EDIT MODE ──
        const items  = window._invoiceEditItems;
        const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
        const diskon   = Number(window._invoiceEditDiskon) || 0;
        const total    = Math.max(0, subtotal - diskon);

        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;">

            <!-- Header edit -->
            <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:16px 20px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:15px;font-weight:800;">✏️ Edit Invoice</div>
                    <div style="font-size:11px;opacity:.9;margin-top:2px;">${escHtml(pasienNama)} · ${tgl ? formatTglIndo(tgl) : '—'}</div>
                </div>
                <button onclick="_batalEditInvoice()"
                    style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:8px;padding:5px 9px;font-size:15px;cursor:pointer;">✕</button>
            </div>

            <div style="padding:16px 18px;">

                <!-- Daftar item edit -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-size:12px;font-weight:800;color:var(--primary-dark);">Item Tagihan</div>
                    <button onclick="_addItemInvoiceEdit()"
                        style="padding:5px 11px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                        ➕ Tambah Item
                    </button>
                </div>

                <div id="invoiceEditItemList">
                    ${items.length === 0
                        ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:14px;">Belum ada item. Klik "➕ Tambah Item".</div>'
                        : items.map((item, idx) => _htmlInvoiceEditItem(item, idx)).join('')
                    }
                </div>

                <!-- Diskon & Total -->
                <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-top:10px;margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:var(--text-muted);">
                        <span>Subtotal</span>
                        <span style="font-weight:700;color:var(--text);">Rp ${_fmtRp(subtotal)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        <span style="font-size:12px;color:var(--text-muted);flex-shrink:0;">Diskon (Rp)</span>
                        <input type="number" id="inp_edit_diskon" value="${diskon}" min="0" placeholder="0"
                            style="flex:1;padding:5px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:right;"
                            oninput="window._invoiceEditDiskon=Number(this.value)||0; _renderInvoiceModal();">
                    </div>
                    <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                        <span style="font-size:14px;font-weight:800;color:var(--primary-dark);">TOTAL</span>
                        <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(total)}</span>
                    </div>
                </div>

                <!-- Catatan -->
                <div style="margin-bottom:14px;">
                    <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Catatan</label>
                    <input type="text" id="inp_edit_catatan" value="${escHtml(tagihan.catatan || '')}" placeholder="Opsional"
                        style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"
                        oninput="window._invoiceEditCatatan=this.value">
                </div>

                <!-- Tombol aksi -->
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="_simpanEditInvoice()"
                        style="flex:1;min-width:110px;padding:11px;background:var(--success);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                        💾 Simpan Perubahan
                    </button>
                    <button onclick="_simpanDanPrintEditInvoice()"
                        style="flex:1;min-width:110px;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                        🖨️ Simpan & Print
                    </button>
                    <button onclick="_batalEditInvoice()"
                        style="padding:11px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                        Batal
                    </button>
                </div>
            </div>
        </div>`;
    }
}

/** HTML satu baris item di mode edit invoice */
function _htmlInvoiceEditItem(item, idx) {
    const sub = Number(item.jumlah) * Number(item.harga_satuan);
    const katColor = {
        'Pemeriksaan': '#3b82f6', 'Laboratorium': '#7c3aed',
        'Obat': '#059669', 'Administrasi': '#d97706', 'Tindakan': '#dc2626'
    }[item.kategori] || '#64748b';

    return `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:#fff;
                border:1px solid rgba(0,0,0,0.08);border-radius:9px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:12px;color:var(--primary-dark);">${escHtml(item.nama_item)}</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:9.5px;background:${katColor}18;color:${katColor};padding:1px 6px;border-radius:10px;font-weight:700;">${escHtml(item.kategori)}</span>
                <span style="font-size:10.5px;color:var(--text-muted);">Rp ${_fmtRp(item.harga_satuan)}/item</span>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            <input type="number" value="${item.jumlah}" min="1"
                style="width:42px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;text-align:center;"
                onchange="_updateInvoiceEditItem(${idx},'jumlah',this.value)">
            <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:72px;text-align:right;">Rp ${_fmtRp(sub)}</div>
            <button onclick="_hapusInvoiceEditItem(${idx})"
                style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0;line-height:1;">✕</button>
        </div>
    </div>`;
}

/** Masuk ke mode edit — inisialisasi state dari data tagihan yang ada */
function _mulaiEditInvoice() {
    const tagihan = window._invoiceData;
    if (!tagihan) return;

    // Deep-copy items agar perubahan tidak merusak data view
    window._invoiceEditItems  = (tagihan.tagihan_item || []).map(i => ({
        nama_item:    i.nama_item,
        kategori:     i.kategori  || 'Lainnya',
        jumlah:       Number(i.jumlah)      || 1,
        harga_satuan: Number(i.harga_satuan) || 0,
        keterangan:   i.keterangan || null
    }));
    window._invoiceEditDiskon   = Number(tagihan.diskon)  || 0;
    window._invoiceEditCatatan  = tagihan.catatan || '';
    window._invoiceEditMode     = true;

    // Pastikan tarif cache tersedia untuk modal tambah item
    if (window._tarifCache.length === 0) _refreshTarifCache();

    _renderInvoiceModal();
}

/** Batal edit — kembali ke view mode */
function _batalEditInvoice() {
    window._invoiceEditMode  = false;
    window._invoiceEditItems = null;
    _renderInvoiceModal();
}

function _updateInvoiceEditItem(idx, field, val) {
    if (!window._invoiceEditItems || !window._invoiceEditItems[idx]) return;
    window._invoiceEditItems[idx][field] = Number(val) || 1;
    _renderInvoiceModal();
}

function _hapusInvoiceEditItem(idx) {
    if (!window._invoiceEditItems) return;
    window._invoiceEditItems.splice(idx, 1);
    _renderInvoiceModal();
}

/** Buka sub-modal tambah item (reuse modal yang sudah ada, atau buat baru) */
function _addItemInvoiceEdit() {
    let modal = document.getElementById('modalTambahItemInvoice');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalTambahItemInvoice';
        modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1400;background:rgba(0,0,0,0.55);overflow-y:auto;padding:16px;';
        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:400px;margin:0 auto;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,0.22);">
            <div style="font-size:14px;font-weight:800;margin-bottom:14px;color:var(--primary-dark);">➕ Tambah Item ke Invoice</div>
            <div style="display:flex;flex-direction:column;gap:9px;">

                <div>
                    <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block;">Pilih dari tarif yang ada</label>
                    <select id="selTarifInvoiceEdit" class="form-control" style="font-size:12px;"
                        onchange="_onPilihTarifInvoiceEdit(this.value)">
                        <option value="">-- Pilih tarif --</option>
                        ${window._tarifCache.filter(t => t.aktif).map(t =>
                            `<option value="${t.id}">${escHtml(t.nama)} · Rp ${_fmtRp(t.harga)} (${escHtml(t.kategori)})</option>`
                        ).join('')}
                        <option value="__manual__">✏️ Input manual</option>
                    </select>
                </div>

                <div id="formItemInvoiceManual" style="display:none;flex-direction:column;gap:7px;">
                    <input type="text" id="inv_item_nama" class="form-control" placeholder="Nama item / layanan" style="font-size:12px;">
                    <select id="inv_item_kat" class="form-control" style="font-size:12px;">
                        ${Object.keys(KAT_ICON).map(k => `<option value="${k}">${KAT_ICON[k]} ${k}</option>`).join('')}
                    </select>
                    <input type="number" id="inv_item_harga" class="form-control" placeholder="Harga satuan (Rp)" min="0" style="font-size:12px;">
                </div>

                <div>
                    <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block;">Jumlah</label>
                    <input type="number" id="inv_item_qty" class="form-control" value="1" min="1" style="font-size:12px;width:90px;">
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:14px;">
                <button onclick="_konfirmasiTambahItemInvoice()"
                    style="flex:1;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;">
                    ✅ Tambah
                </button>
                <button onclick="document.getElementById('modalTambahItemInvoice').style.display='none'"
                    style="padding:10px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:9px;font-size:12px;cursor:pointer;">
                    Batal
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    } else {
        // Refresh daftar tarif di select (bisa berubah)
        const sel = modal.querySelector('#selTarifInvoiceEdit');
        if (sel) {
            sel.innerHTML = `<option value="">-- Pilih tarif --</option>
                ${window._tarifCache.filter(t => t.aktif).map(t =>
                    `<option value="${t.id}">${escHtml(t.nama)} · Rp ${_fmtRp(t.harga)} (${escHtml(t.kategori)})</option>`
                ).join('')}
                <option value="__manual__">✏️ Input manual</option>`;
        }
    }

    // Reset form
    const sel  = document.getElementById('selTarifInvoiceEdit');
    const frm  = document.getElementById('formItemInvoiceManual');
    const qty  = document.getElementById('inv_item_qty');
    const nama = document.getElementById('inv_item_nama');
    const harga= document.getElementById('inv_item_harga');
    if (sel)  sel.value  = '';
    if (frm)  frm.style.display = 'none';
    if (qty)  qty.value  = '1';
    if (nama) nama.value = '';
    if (harga)harga.value= '';

    modal.style.display = 'block';
}

function _onPilihTarifInvoiceEdit(val) {
    const frm = document.getElementById('formItemInvoiceManual');
    if (frm) frm.style.display = val === '__manual__' ? 'flex' : 'none';
}

function _konfirmasiTambahItemInvoice() {
    const selVal = document.getElementById('selTarifInvoiceEdit')?.value;
    const qty    = Number(document.getElementById('inv_item_qty')?.value) || 1;

    if (!selVal) return showToast('⚠️ Pilih item terlebih dahulu', 'error');

    let item;
    if (selVal === '__manual__') {
        const nama  = document.getElementById('inv_item_nama')?.value.trim();
        const kat   = document.getElementById('inv_item_kat')?.value   || 'Lainnya';
        const harga = Number(document.getElementById('inv_item_harga')?.value) || 0;
        if (!nama) return showToast('⚠️ Nama item wajib diisi', 'error');
        item = { nama_item: nama, kategori: kat, jumlah: qty, harga_satuan: harga, keterangan: null };
    } else {
        const t = window._tarifCache.find(x => String(x.id) === String(selVal));
        if (!t) return;
        item = { nama_item: t.nama, kategori: t.kategori, jumlah: qty, harga_satuan: t.harga, keterangan: null };
    }

    if (!window._invoiceEditItems) window._invoiceEditItems = [];
    window._invoiceEditItems.push(item);
    document.getElementById('modalTambahItemInvoice').style.display = 'none';
    _renderInvoiceModal();
}

/** Simpan hasil edit invoice ke Supabase */
async function _simpanEditInvoice() {
    const tagihan  = window._invoiceData;
    if (!tagihan || !tagihan.kunjungan_id) return showToast('⚠️ Data tagihan tidak valid', 'error');

    const items    = window._invoiceEditItems || [];
    const diskon   = Number(window._invoiceEditDiskon)  || 0;
    const catatan  = window._invoiceEditCatatan !== undefined
        ? window._invoiceEditCatatan
        : (document.getElementById('inp_edit_catatan')?.value || '');

    const btnSave = document.querySelector('#modalInvoiceView button[onclick="_simpanEditInvoice()"]');
    if (btnSave) { btnSave.disabled = true; btnSave.textContent = '⏳ Menyimpan...'; }

    try {
        const result = await sb_saveTagihan(
            tagihan.kunjungan_id,
            tagihan.pasien_id,
            items,
            diskon,
            catatan
        );

        showToast(`✅ Invoice diperbarui · Rp ${_fmtRp(result.total)}`, 'success');

        // Reload data tagihan terbaru lalu kembali ke view mode
        const tagihanBaru = await sb_getTagihan(tagihan.kunjungan_id);
        window._invoiceData     = tagihanBaru || tagihan;
        window._invoiceEditMode = false;
        _renderInvoiceModal();

    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    } finally {
        if (btnSave) { btnSave.disabled = false; btnSave.textContent = '💾 Simpan Perubahan'; }
    }
}

/** Simpan edit lalu print */
async function _simpanDanPrintEditInvoice() {
    await _simpanEditInvoice();
    // Tunggu sebentar agar data terupdate, lalu print
    setTimeout(() => {
        const tagihan = window._invoiceData;
        if (tagihan && window._invoiceEditMode === false) {
            printInvoice(tagihan, window._invoiceNama, window._invoiceTgl);
        }
    }, 500);
}

/** Ambil data dari window var lalu print — dipanggil dari tombol di _showInvoiceModal */
function _printInvoiceFromWindow() {
    const tagihan   = window._invoiceData;
    const nama      = window._invoiceNama || '';
    const tgl       = window._invoiceTgl  || '';
    if (!tagihan) return showToast('⚠️ Data invoice tidak tersedia', 'error');
    printInvoice(tagihan, nama, tgl);
}

// ════════════════════════════════════════
//  PRINT INVOICE — VERSI PROFESIONAL
// ════════════════════════════════════════
function printInvoice(tagihan, pasienNama, tgl) {
    const klinikNama   = window.KLINIK_NAMA                   || 'Klinik';
    const klinikAlamat = window._settingsFull?.klinik_alamat  || '';
    const klinikTelp   = window._settingsFull?.klinik_telp    || '';
    const klinikEmail  = window._settingsFull?.klinik_email   || '';
    const dokterNama   = window._settingsFull?.dokter_nama    || '';
    const logoUrl      = window._settingsFull?.klinik_logo    || '';

    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return showToast('⚠️ Izinkan popup untuk print invoice', 'error');

    // ── Nomor & tanggal invoice ──
    const noInvoice  = 'INV-' + String(tagihan.id || '').substring(0, 8).toUpperCase();
    const tglCetak   = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    const tglInvoice = tgl ? formatTglIndo(tgl) : tglCetak;

    // ── Status ──
    const lunas       = (tagihan.status || '').toLowerCase() === 'lunas' || !!tagihan.status_bayar;
    const statusLabel = lunas ? 'LUNAS' : 'BELUM LUNAS';
    const statusColor = lunas ? '#16a34a' : '#dc2626';
    const statusBg    = lunas ? '#dcfce7' : '#fee2e2';
    const statusBorder= lunas ? '#86efac' : '#fca5a5';

    // ── Angka ──
    const subtotal = Number(tagihan.subtotal || 0);
    const diskon   = Number(tagihan.diskon   || 0);
    const total    = Number(tagihan.total    || subtotal - diskon);

    // ── Terbilang ──
    function _terbilang(n) {
        const sat = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
        if (n === 0)  return 'nol';
        if (n < 12)   return sat[n];
        if (n < 20)   return sat[n-10] + ' belas';
        if (n < 100)  return sat[Math.floor(n/10)] + ' puluh' + (n%10 ? ' '+sat[n%10] : '');
        if (n < 200)  return 'seratus' + (n%100 ? ' '+_terbilang(n%100) : '');
        if (n < 1000) return sat[Math.floor(n/100)] + ' ratus' + (n%100 ? ' '+_terbilang(n%100) : '');
        if (n < 2000) return 'seribu' + (n%1000 ? ' '+_terbilang(n%1000) : '');
        if (n < 1e6)  return _terbilang(Math.floor(n/1000)) + ' ribu' + (n%1000 ? ' '+_terbilang(n%1000) : '');
        if (n < 1e9)  return _terbilang(Math.floor(n/1e6)) + ' juta' + (n%1e6 ? ' '+_terbilang(n%1e6) : '');
        return _terbilang(Math.floor(n/1e9)) + ' miliar' + (n%1e9 ? ' '+_terbilang(n%1e9) : '');
    }
    const totalTerbilang = _terbilang(total).replace(/\b\w/g, c => c.toUpperCase()) + ' Rupiah';

    // ── QR Code dari nomor invoice ──
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(noInvoice)}&size=80x80&margin=2`;

    // ── Kelompokkan item per kategori ──
    const items = tagihan.tagihan_item || [];
    const KAT_ORDER = ['Pemeriksaan','Laboratorium','Penunjang','Tindakan','Obat','Administrasi','Lainnya'];
    const grouped = {};
    items.forEach(i => {
        const kat = i.kategori || 'Lainnya';
        if (!grouped[kat]) grouped[kat] = [];
        grouped[kat].push(i);
    });
    // Susun sesuai urutan prioritas
    const katUrut = [
        ...KAT_ORDER.filter(k => grouped[k]),
        ...Object.keys(grouped).filter(k => !KAT_ORDER.includes(k))
    ];

    const KAT_ICON = {
        'Pemeriksaan':'🩺','Laboratorium':'🔬','Penunjang':'🔭',
        'Tindakan':'⚕️','Obat':'💊','Administrasi':'📋','Lainnya':'📌'
    };

    // ── Build baris tabel per grup ──
    let rowNum = 0;
    const tableBody = katUrut.map(kat => {
        const rows = grouped[kat].map(i => {
            rowNum++;
            const sub = Number(i.subtotal || (Number(i.jumlah) * Number(i.harga_satuan)));
            return `<tr>
              <td class="row-no">${rowNum}</td>
              <td><div class="item-nama">${escHtml(i.nama_item)}</div></td>
              <td class="tc">${Number(i.jumlah)}</td>
              <td class="tr">Rp ${_fmtRp(i.harga_satuan)}</td>
              <td class="tr">Rp ${_fmtRp(sub)}</td>
            </tr>`;
        }).join('');
        return `<tr class="kat-header">
          <td colspan="5">
            <span class="kat-icon">${KAT_ICON[kat]||'📌'}</span> ${kat}
          </td>
        </tr>${rows}`;
    }).join('');

    // ── Logo HTML ──
    const logoHtml = logoUrl
        ? `<img src="${escHtml(logoUrl)}" class="logo" alt="Logo">`
        : `<div class="logo-initials">${escHtml(klinikNama.substring(0,2).toUpperCase())}</div>`;

    win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Invoice ${noInvoice} — ${escHtml(pasienNama)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  :root{
    --ink:#0f172a;--ink2:#334155;--muted:#64748b;
    --border:#e2e8f0;--border2:#cbd5e1;--soft:#f8fafc;
    --blue:#1d4ed8;--blue2:#3b82f6;--green:#16a34a;--red:#dc2626;
  }
  body{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--ink);background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:760px;margin:28px auto;background:#fff;border-radius:16px;box-shadow:0 6px 40px rgba(0,0,0,.12);overflow:hidden}
  .accent{height:5px;background:linear-gradient(90deg,#1d4ed8,#3b82f6,#818cf8)}

  /* HEADER */
  .hdr{display:grid;grid-template-columns:1fr auto;gap:20px;padding:32px 40px 26px;border-bottom:1.5px solid var(--border)}
  .logo{width:52px;height:52px;border-radius:10px;object-fit:contain;border:1px solid var(--border);margin-bottom:10px;display:block}
  .logo-initials{width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;margin-bottom:10px;letter-spacing:-1px}
  .klinik-nama{font-size:19px;font-weight:800;color:var(--ink);letter-spacing:-.3px;line-height:1.2}
  .klinik-info{font-size:11.5px;color:var(--muted);margin-top:5px;line-height:1.9}
  .klinik-info span{display:block}
  .hdr-right{text-align:right}
  .inv-badge{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--blue);background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 10px;display:inline-block;margin-bottom:8px}
  .inv-no{font-family:'DM Mono',monospace;font-size:17px;font-weight:500;color:var(--ink);letter-spacing:.5px}
  .inv-dates{margin-top:8px;font-size:11.5px;color:var(--muted);line-height:1.9}
  .inv-dates span{display:block}
  .inv-dates strong{color:var(--ink2)}

  /* INFO PASIEN */
  .info-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--border)}
  .info-box{padding:18px 40px}
  .info-box+.info-box{border-left:1px solid var(--border)}
  .lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:6px}
  .val{font-size:14px;font-weight:700;color:var(--ink)}
  .sub{font-size:11.5px;color:var(--muted);margin-top:2px}

  /* TABEL ITEM */
  .items{padding:22px 40px 0}
  table{width:100%;border-collapse:collapse}
  .row-no{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);width:28px;padding:10px 8px}
  thead th{padding:9px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);background:var(--soft);border-bottom:1px solid var(--border)}
  thead th.tc{text-align:center}
  thead th.tr{text-align:right}
  tbody td{padding:10px 10px;font-size:12.5px;color:var(--ink2);vertical-align:middle}
  tbody td.tc{text-align:center}
  tbody td.tr{text-align:right;font-weight:600;color:var(--ink)}
  .item-nama{font-weight:700;color:var(--ink);font-size:13px}
  /* Kategori header row */
  tr.kat-header td{
    padding:8px 10px 5px;
    font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;
    color:var(--muted);background:var(--soft);
    border-top:2px solid var(--border2);border-bottom:1px solid var(--border);
  }
  tr.kat-header:first-child td{border-top:none}
  .kat-icon{font-size:12px}
  /* garis antar item */
  tbody tr:not(.kat-header){border-bottom:1px solid var(--border)}
  tbody tr:not(.kat-header):last-child{border-bottom:none}

  /* Watermark */
  .tbl-wrap{position:relative}
  .lunas-stamp{
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%) rotate(-28deg);
    font-size:72px;font-weight:900;letter-spacing:4px;
    color:rgba(22,163,74,.09);border:6px solid rgba(22,163,74,.09);
    padding:8px 24px;border-radius:8px;pointer-events:none;white-space:nowrap;user-select:none
  }

  /* RINGKASAN */
  .summary{display:grid;grid-template-columns:1fr 280px;padding:22px 40px;border-top:1px solid var(--border);align-items:start}
  .terbilang-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px}
  .terbilang-txt{font-size:12px;color:var(--ink2);font-style:italic;line-height:1.5;border-left:3px solid var(--blue2);padding-left:10px}
  .sum-rows{}
  .sum-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12.5px;color:var(--muted)}
  .sum-row .sv{font-weight:600;color:var(--ink2)}
  .sum-row.dk .sv{color:var(--red)}
  .sum-row.tot{border-top:2px solid var(--ink);margin-top:8px;padding-top:12px;font-size:15px;font-weight:800;color:var(--ink)}
  .sum-row.tot .sv{font-size:18px;color:var(--blue)}

  /* FOOTER */
  .ftr{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;padding:18px 40px 26px;border-top:1px solid var(--border);background:var(--soft)}
  .ftr-note{font-size:11.5px;color:var(--muted);line-height:1.7}
  .ftr-cetak{font-size:11px;color:var(--muted);margin-top:4px;font-style:italic}
  .qr-col{text-align:center}
  .qr-col img{border:1px solid var(--border);border-radius:8px;display:block}
  .qr-cap{font-size:9.5px;color:var(--muted);margin-top:3px;font-family:'DM Mono',monospace}

  /* TTD inline di info-box */
  .ttd-inline{display:flex;flex-direction:column;justify-content:space-between}
  .ttd-space-inline{flex:1;min-height:60px;border-bottom:1.5px solid var(--ink2);margin-top:8px;margin-right:24px}

  /* PRINT */
  .no-print{text-align:center;padding:18px}
  .no-print button{padding:11px 32px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(29,78,216,.3);margin:0 4px}
  .no-print button.sec{background:#f1f5f9;color:var(--ink2);box-shadow:none}
  @media print{
    body{background:#fff}
    .page{margin:0;box-shadow:none;border-radius:0;max-width:100%}
    .no-print{display:none}
    @page{margin:8mm;size:A4}
  }
</style>
</head>
<body>
<div class="page">
  <div class="accent"></div>

  <!-- HEADER -->
  <div class="hdr">
    <div>
      ${logoHtml}
      <div class="klinik-nama">${escHtml(klinikNama)}</div>
      <div class="klinik-info">
        ${klinikAlamat ? `<span>📍 ${escHtml(klinikAlamat)}</span>` : ''}
        ${klinikTelp   ? `<span>📞 ${escHtml(klinikTelp)}</span>`   : ''}
        ${klinikEmail  ? `<span>✉️ ${escHtml(klinikEmail)}</span>`  : ''}
        ${dokterNama   ? `<span>👨‍⚕️ ${escHtml(dokterNama)}</span>`: ''}
      </div>
    </div>
    <div class="hdr-right">
      <div class="inv-badge">Invoice</div>
      <div class="inv-no">${noInvoice}</div>
      <div class="inv-dates">
        <span>Tanggal: <strong>${tglInvoice}</strong></span>
        <span>Dicetak: <strong>${tglCetak}</strong></span>
      </div>

    </div>
  </div>

  <!-- INFO PASIEN + TTD -->
  <div class="info-row">
    <div class="info-box">
      <div class="lbl">Tagihan Kepada</div>
      <div class="val">${escHtml(pasienNama)}</div>
      <div class="sub">Pasien</div>
    </div>
    <div class="info-box ttd-inline">
      <div class="lbl">Tanda Tangan &amp; Cap Praktek</div>
      <div class="ttd-space-inline"></div>
    </div>
  </div>

  <!-- TABEL ITEM -->
  <div class="items">
    <div class="tbl-wrap">
      ${lunas ? '<div class="lunas-stamp">LUNAS</div>' : ''}
      <table>
        <thead>
          <tr>
            <th class="row-no">#</th>
            <th>Layanan / Item</th>
            <th class="tc">Qty</th>
            <th class="tr">Harga Satuan</th>
            <th class="tr">Total</th>
          </tr>
        </thead>
        <tbody>${tableBody}</tbody>
      </table>
    </div>
  </div>

  <!-- RINGKASAN -->
  <div class="summary">
    <div>
      <div class="terbilang-lbl">Terbilang</div>
      <div class="terbilang-txt">${totalTerbilang}</div>
    </div>
    <div class="sum-rows">
      <div class="sum-row"><span>Subtotal</span><span class="sv">Rp ${_fmtRp(subtotal)}</span></div>
      ${diskon > 0 ? `<div class="sum-row dk"><span>Diskon</span><span class="sv">– Rp ${_fmtRp(diskon)}</span></div>` : ''}
      <div class="sum-row tot"><span>TOTAL</span><span class="sv">Rp ${_fmtRp(total)}</span></div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="ftr">
    <div>
      <div class="ftr-note">Terima kasih atas kepercayaan Anda kepada ${escHtml(klinikNama)}.</div>
      <div class="ftr-cetak">Dicetak pada ${tglCetak}</div>
    </div>
    <div class="qr-col">
      <img src="${qrUrl}" width="80" height="80" alt="QR Invoice">
      <div class="qr-cap">${noInvoice}</div>
    </div>
  </div>


</div>

<div class="no-print">
  <button onclick="window.print()">🖨️ Cetak Invoice</button>
  <button class="sec" onclick="window.close()">Tutup</button>
</div>

<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script>
</body></html>`);
    win.document.close();
}

function _buildInvoiceHtml(tagihan, pasienNama, tgl, compact) {
    return `
    <div style="padding:18px 20px 4px;">
        <div style="font-size:15px;font-weight:800;color:var(--primary-dark);margin-bottom:2px;">🧾 Invoice Kunjungan</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(pasienNama)} · ${tgl ? formatTglIndo(tgl) : '—'}</div>
        <div style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:20px;font-size:10.5px;font-weight:800;
             background:${tagihan.status === 'Lunas' ? '#dcfce7' : '#fef3c7'};
             color:${tagihan.status === 'Lunas' ? '#166534' : '#92400e'};">
             ${escHtml(tagihan.status || 'Lunas')}
        </div>
    </div>
    <div style="padding:12px 18px;">
        ${(tagihan.tagihan_item || []).map(i => `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
            <div>
                <span style="font-weight:600;">${escHtml(i.nama_item)}</span>
                ${i.keterangan ? `<span style="font-size:10px;color:var(--text-muted);"> · ${escHtml(i.keterangan)}</span>` : ''}
                <div style="font-size:10.5px;color:var(--text-muted);">Rp ${_fmtRp(i.harga_satuan)} × ${i.jumlah}</div>
            </div>
            <div style="font-weight:700;white-space:nowrap;">Rp ${_fmtRp(i.subtotal)}</div>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-muted);">
            <span>Subtotal</span><span>Rp ${_fmtRp(tagihan.subtotal)}</span>
        </div>
        ${tagihan.diskon > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#dc2626;"><span>Diskon</span><span>- Rp ${_fmtRp(tagihan.diskon)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;margin-top:6px;">
            <span style="font-size:14px;font-weight:800;">TOTAL</span>
            <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(tagihan.total)}</span>
        </div>
        ${tagihan.catatan ? `<div style="margin-top:8px;font-size:11px;color:var(--text-muted);">📝 ${escHtml(tagihan.catatan)}</div>` : ''}
    </div>`;
}

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════
function _fmtRp(n) {
    return Number(n || 0).toLocaleString('id-ID');
}
