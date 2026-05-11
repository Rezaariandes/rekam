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
            showToast('⚠️ Belum ada tarif. Jalankan seed_tarif_layanan.sql di Supabase.', 'error');
        }
    } catch(e) {
        showToast('❌ Gagal memuat tarif', 'error');
    }
}

// ════════════════════════════════════════
//  RENDER DAFTAR TARIF
// ════════════════════════════════════════
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
                ${isAll ? '🗂️ Semua' : (KAT_ICON[k] || '') + ' ' + k}
            </button>`;
        }).join('');
    }

    const filtered = _activeKatTab
        ? window._tarifCache.filter(t => t.kategori === _activeKatTab)
        : window._tarifCache;

    container.innerHTML = filtered.length === 0
        ? `<p style="text-align:center;color:#94a3b8;padding:32px 0">Belum ada tarif di database</p>`
        : filtered.map(t => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:13px">${KAT_ICON[t.kategori] || ''} ${t.nama}</div>
                    <div style="font-size:11px;color:#64748b">${t.kategori} · ${t.aktif ? '✅ Aktif' : '⛔ Nonaktif'}</div>
                </div>
                <div style="font-weight:700;color:var(--primary);font-size:13px;white-space:nowrap">
                    Rp ${Number(t.harga).toLocaleString('id-ID')}
                </div>
                <button onclick="openEditTarif('${t.id}')"
                    style="padding:4px 10px;border:1px solid var(--primary);border-radius:8px;color:var(--primary);font-size:11px;cursor:pointer;background:#fff">
                    Edit
                </button>
            </div>`).join('');
}

function _setBiayaTab(kat) {
    _activeKatTab = kat;
    renderDaftarTarif();
}

// ════════════════════════════════════════
//  FORM TAMBAH / EDIT TARIF
// ════════════════════════════════════════
function openAddTarif() {
    _openTarifModal(null);
}

function openEditTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    if (t) _openTarifModal(t);
}

function _openTarifModal(tarif) {
    const isEdit     = !!tarif;
    const categories = ['Pemeriksaan','Laboratorium','Penunjang','Tindakan','Administrasi','Obat','Lainnya'];

    document.getElementById('_tarifModal')?.remove();
    const modal = document.createElement('div');
    modal.id = '_tarifModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';

    // Saat edit: nama & kategori read-only, hanya harga & status aktif yang bisa diubah
    // Saat tambah baru: semua field bisa diisi
    const namaField = isEdit
        ? `<div style="padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;color:#475569">
               ${KAT_ICON[tarif.kategori] || ''} ${tarif.nama}
           </div>
           <input type="hidden" id="_tf_nama" value="${tarif.nama}">`
        : `<input id="_tf_nama" value="" placeholder="Nama layanan"
               style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">`;

    const katField = isEdit
        ? `<div style="padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;color:#475569">
               ${tarif.kategori}
           </div>
           <input type="hidden" id="_tf_kat" value="${tarif.kategori}">`
        : `<select id="_tf_kat" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">
               ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
           </select>`;

    const ketField = isEdit ? '' : `
        <label style="font-size:12px;font-weight:600">Keterangan (opsional)</label>
        <input id="_tf_ket" value="" placeholder="—"
            style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">`;

    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;width:340px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.18)">
            <h3 style="margin:0 0 16px;font-size:16px">${isEdit ? '✏️ Edit Tarif' : '➕ Tambah Tarif'}</h3>
            <label style="font-size:12px;font-weight:600">Nama Layanan</label>
            ${namaField}
            <label style="font-size:12px;font-weight:600">Kategori</label>
            ${katField}
            <label style="font-size:12px;font-weight:600">Harga (Rp)</label>
            <input id="_tf_harga" type="number" value="${isEdit ? tarif.harga : ''}" placeholder="0"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">
            ${ketField}
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:14px;cursor:pointer">
                <input type="checkbox" id="_tf_aktif" ${!isEdit || tarif.aktif ? 'checked' : ''}> Aktif
            </label>
            ${isEdit ? `<p style="font-size:11px;color:#94a3b8;margin:0 0 12px">💡 Nama & kategori tidak dapat diubah. Nonaktifkan layanan jika tidak ingin ditampilkan.</p>` : ''}
            <div style="display:flex;gap:8px">
                <button onclick="document.getElementById('_tarifModal').remove()"
                    style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;cursor:pointer;background:#fff">
                    Batal
                </button>
                <button onclick="_saveTarifFromModal(${isEdit ? "'" + tarif.id + "'" : 'null'})"
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
    const ket   = document.getElementById('_tf_ket').value.trim();
    const aktif = document.getElementById('_tf_aktif').checked;

    if (!nama) return showToast('❌ Nama layanan wajib diisi', 'error');

    try {
        await sb_saveTarif({
            id:         id || undefined,
            nama,
            kategori:   kat,
            harga:      Number(harga) || 0,
            keterangan: ket || null,
            aktif
        });
        document.getElementById('_tarifModal')?.remove();
        showToast('✅ Tarif berhasil disimpan', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        showToast('❌ Gagal menyimpan tarif', 'error');
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
