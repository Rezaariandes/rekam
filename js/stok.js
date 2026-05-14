// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL STOK OBAT (stok.js)
//
//  ✅ Bersih dari duplikat:
//     canAccessMedis() — DIHAPUS dari sini; definisi kanonik di auth.js
//     _fmt() — delegate ke fmtRp() global (app.js)
//  Halaman manajemen + picker resep di page-medis
// ════════════════════════════════════════════════════════

// ── State ──
let _obatCache    = [];   // semua obat dari server
let _resepItems   = [];   // item resep aktif (kunjungan sedang berjalan)
let _stokAktif    = false; // diambil dari konfigurasi

// BUG-C FIX: _getResepItems dipanggil di saveAll (index.html patch) tapi tidak pernah
// didefinisikan. Letakkan di sini karena _resepItems didefinisikan di file ini.
function _getResepItems() {
    return _resepItems;
}

// canAccessMedis() didefinisikan di auth.js (definisi kanonik).
// stok.js tidak perlu mendefinisikan ulang — auth.js di-load lebih dulu.
// Pengecekan kasir/atlm sudah ditangani di bukaRekamMedisHariIni (kunjungan.js).

// ════════════════════════════════════════
//  INIT — dipanggil dari app.js saat load
// ════════════════════════════════════════
async function initStokModule() {
    // Cek apakah modul stok aktif dari settings
    _stokAktif = (window._stokAktif === true);
    if (!_stokAktif) return;

    try {
        _obatCache = await sb_getObat();
    } catch(e) {
        _obatCache = [];
    }

    // Jika halaman stok sudah ada di DOM, render
    if (document.getElementById('pageStok')) {
        await initPageStok();
    }
}

// ════════════════════════════════════════
//  HALAMAN STOK OBAT
// ════════════════════════════════════════
async function initPageStok() {
    await _refreshObatCache();
    renderDaftarObat();
    _renderStokSummary();
    _isiDatalistKategori();
}

async function _refreshObatCache() {
    try {
        _obatCache = await sb_getObat();
    } catch(e) {
        showToast('❌ Gagal memuat data obat', 'error');
    }
}

function renderDaftarObat() {
    const container = document.getElementById('daftarObat');
    if (!container) return;

    const search   = (document.getElementById('stokSearch')?.value || '').toLowerCase();
    const kategori = document.getElementById('stokFilterKategori')?.value || '';

    let list = _obatCache.filter(o => {
        const matchSearch   = !search   || o.nama.toLowerCase().includes(search);
        const matchKategori = !kategori || o.kategori === kategori;
        return matchSearch && matchKategori;
    });

    // Isi filter kategori dropdown
    const selKat = document.getElementById('stokFilterKategori');
    if (selKat) {
        const categories = [...new Set(_obatCache.map(o => o.kategori).filter(Boolean))].sort();
        const currentVal = selKat.value;
        selKat.innerHTML = '<option value="">Semua Kategori</option>' +
            categories.map(k => `<option value="${escHtml(k)}" ${currentVal===k?'selected':''}>${escHtml(k)}</option>`).join('');
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💊</div>${search ? 'Obat tidak ditemukan' : 'Belum ada data obat'}</div>`;
        return;
    }

    container.innerHTML = list.map(o => {
        // Cek exp_date
        const today = new Date(); today.setHours(0,0,0,0);
        const expDate   = o.exp_date ? new Date(o.exp_date) : null;
        const expDays   = expDate ? Math.floor((expDate - today)/(1000*60*60*24)) : null;
        const isExpired = expDays !== null && expDays < 0;
        const isExpSoon = expDays !== null && expDays >= 0 && expDays <= 90;

        const isKritis   = o.stok <= o.stok_minimum;
        const stokColor  = isKritis ? '#dc2626' : (o.stok <= o.stok_minimum * 2 ? '#d97706' : 'var(--success)');
        const stokBg     = isKritis ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.06)';
        const margin     = _hitungMargin(o.harga_beli, o.harga_jual);

        return `
        <div style="background:${stokBg};border:1px solid ${isKritis ? 'rgba(220,38,38,0.25)' : 'rgba(0,0,0,0.07)'};border-radius:12px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:13px;color:var(--primary-dark);margin-bottom:2px;">${escHtml(o.nama)}</div>
                    <div style="font-size:10.5px;color:var(--text-muted);">
                        ${escHtml(o.kategori || '—')} · ${escHtml(o.satuan)} · ${escHtml(o.frekuensi_default || '3x1')}
                    </div>
                    <div style="font-size:11px;margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;">
                        <span>Beli: <b>Rp ${_fmt(o.harga_beli)}</b></span>
                        <span>Jual: <b style="color:var(--primary)">Rp ${_fmt(o.harga_jual)}</b></span>
                        <span style="color:${margin >= 0 ? 'var(--success)' : '#dc2626'}">Margin: ${margin}%</span>
                    </div>
                    ${o.keterangan ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">📌 ${escHtml(o.keterangan)}</div>` : ''}
            ${expDate ? `<div style="font-size:10.5px;margin-top:3px;${isExpired ? 'color:#dc2626;font-weight:700;' : isExpSoon ? 'color:#d97706;font-weight:600;' : 'color:var(--text-muted);'}">
                ${isExpired ? '🚫 KADALUARSA' : isExpSoon ? '⚠️ Exp Soon'  : '📅 Exp'}: ${_formatExpDate(o.exp_date)}
            </div>` : ''}
                </div>
                <div style="text-align:center;flex-shrink:0;">
                    <div style="font-size:20px;font-weight:900;color:${stokColor};line-height:1;">${o.stok ?? 0}</div>
                    <div style="font-size:9px;color:${stokColor};font-weight:600;">${isKritis ? '⚠️ KRITIS' : 'stok'}</div>
                    <div style="font-size:9px;color:var(--text-muted);">min. ${o.stok_minimum ?? 5}</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                <button onclick="openModalObat('${escHtml(String(o.id))}')"
                    style="flex:1;padding:6px 8px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;min-width:70px;">
                    ✏️ Edit
                </button>
                <button onclick="openModalRestock('${escHtml(String(o.id))}')"
                    style="flex:1;padding:6px 8px;background:var(--success);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;min-width:70px;">
                    📦 Restock
                </button>
                <button onclick="hapusObat('${escHtml(String(o.id))}')"
                    style="padding:6px 10px;background:rgba(220,38,38,0.09);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                    🗑️
                </button>
            </div>
        </div>`;
    }).join('');

    _renderStokSummary();
}

function _renderStokSummary() {
    const el = document.getElementById('stokSummary');
    if (!el) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const total   = _obatCache.length;
    const kritis  = _obatCache.filter(o => (o.stok ?? 0) <= (o.stok_minimum ?? 5)).length;
    const nilaiStok = _obatCache.reduce((s, o) => s + ((o.stok ?? 0) * (o.harga_beli ?? 0)), 0);
    const expired = _obatCache.filter(o => o.exp_date && new Date(o.exp_date) < today).length;

    const tile = (icon, label, val, color) =>
        `<div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:10px;text-align:center;">
            <div style="font-size:18px;">${icon}</div>
            <div style="font-size:17px;font-weight:900;color:${color};">${val}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">${label}</div>
        </div>`;

    el.innerHTML =
        tile('💊', 'Total Jenis', total, 'var(--primary)') +
        tile('⚠️', 'Stok Kritis', kritis, kritis > 0 ? '#dc2626' : 'var(--success)') +
        tile('🚫', 'Kadaluarsa', expired, expired > 0 ? '#dc2626' : 'var(--success)') +
        tile('💰', 'Nilai Stok', 'Rp ' + _fmt(nilaiStok), 'var(--primary-dark)');
}

function _isiDatalistKategori() {
    const dl = document.getElementById('list-kategori-obat');
    if (!dl) return;
    const cats = [...new Set(_obatCache.map(o => o.kategori).filter(Boolean))].sort();
    dl.innerHTML = cats.map(k => `<option value="${escHtml(k)}">`).join('');
}

// ════════════════════════════════════════
//  MODAL: TAMBAH / EDIT OBAT
// ════════════════════════════════════════
async function openModalObat(id = null) {
    const modal = document.getElementById('modalObat');
    if (!modal) return;

    _clearFormObat();
    window._pendingFrekuensiBaru = null;

    if (id) {
        document.getElementById('modalObatTitle').textContent = '✏️ Edit Obat';
        const obat = _obatCache.find(o => String(o.id) === String(id)) || await sb_getObatById(id);
        if (obat) _isiFormObat(obat);
        else _renderFrekuensiObatSelect('3x1');
    } else {
        document.getElementById('modalObatTitle').textContent = '➕ Tambah Obat Baru';
        _renderFrekuensiObatSelect('3x1');
    }

    _isiDatalistKategori();
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('obat_nama')?.focus(), 100);
}

function closeModalObat() {
    const modal = document.getElementById('modalObat');
    if (modal) modal.style.display = 'none';
}

function _clearFormObat() {
    ['obat_id','obat_nama','obat_kategori','obat_harga_beli','obat_harga_jual',
     'obat_stok','obat_stok_minimum','obat_keterangan','obat_exp_date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const sat = document.getElementById('obat_satuan');
    if (sat) sat.value = 'tablet';
    // frekuensi_default akan di-re-render oleh _renderFrekuensiObatSelect — tidak perlu di-set manual
    window._pendingFrekuensiBaru = null;
}

function _isiFormObat(o) {
    const _set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    _set('obat_id',              o.id);
    _set('obat_nama',            o.nama);
    _set('obat_kategori',        o.kategori);
    _set('obat_satuan',          o.satuan);
    _set('obat_harga_beli',      o.harga_beli);
    _set('obat_harga_jual',      o.harga_jual);
    _set('obat_stok',            o.stok);
    _set('obat_stok_minimum',    o.stok_minimum);
    _set('obat_keterangan',      o.keterangan);
    _set('obat_exp_date',        o.exp_date ? o.exp_date.substring(0,7) : '');
    // Render frekuensi select dengan opsi yang sudah ada
    _renderFrekuensiObatSelect(o.frekuensi_default || '3x1');
}

/** Render select frekuensi di form edit obat, dengan semua opsi unik dari cache + bawaan */
function _renderFrekuensiObatSelect(currentVal) {
    const wrap = document.getElementById('frekuensiObatWrap');
    if (!wrap) return;
    const opts = [...new Set([..._FREKUENSI_DEFAULT, ..._obatCache.map(o => (o.frekuensi_default||'').trim()).filter(Boolean)])].sort();
    const isCustom = currentVal && !opts.includes(currentVal);
    if (isCustom) opts.push(currentVal);
    wrap.innerHTML = `
    <div style="margin-bottom:12px;">
        <label class="form-label small fw-bold text-muted text-uppercase mb-1">Frekuensi Default</label>
        <select id="obat_frekuensi_default" class="form-control">
            ${opts.map(f => `<option value="${escHtml(f)}" ${currentVal===f?'selected':''}>${escHtml(f)}</option>`).join('')}
        </select>
    </div>
    <div style="margin-bottom:12px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:10px 12px;">
        <label class="form-label small fw-bold mb-1" style="color:var(--primary);">➕ Tambah Frekuensi Baru ke Daftar</label>
        <div style="display:flex;gap:6px;">
            <input type="text" id="obat_frekuensi_baru" class="form-control" placeholder="cth: 2x½, 1x2 malam, tiap 8 jam" style="flex:1;font-size:12px;">
            <button type="button" onclick="_tambahFrekuensiBaru()"
                style="padding:6px 12px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
                + Tambah
            </button>
        </div>
        <div style="font-size:9.5px;color:var(--text-muted);margin-top:4px;">Ketik frekuensi lalu klik Tambah — langsung tersimpan & otomatis terpilih</div>
    </div>`;
}

/** Ketika select frekuensi di form obat diubah */
function _onFrekuensiObatChange(val) {
    // Tidak perlu action khusus — value langsung dipakai saat simpanObat
}

/** Tambah frekuensi baru: simpan sebagai frekuensi_default obat dummy atau langsung ke select */
async function _tambahFrekuensiBaru() {
    const inp = document.getElementById('obat_frekuensi_baru');
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) return showToast('⚠️ Ketik frekuensi yang ingin ditambahkan', 'error');

    // Cek apakah sudah ada di daftar
    const sel = document.getElementById('obat_frekuensi_default');
    if (sel) {
        const existing = Array.from(sel.options).find(o => o.value === val);
        if (existing) {
            sel.value = val;
            inp.value = '';
            showToast(`ℹ️ "${val}" sudah ada, dipilih otomatis`, 'info');
            return;
        }
        // Tambah opsi baru ke select & pilih
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        opt.selected = true;
        sel.appendChild(opt);
        inp.value = '';
        showToast(`✅ Frekuensi "${val}" ditambahkan`, 'success');

        // Simpan ke database: update frekuensi_default obat yang sedang diedit (jika ada id)
        // atau tandai untuk disimpan saat simpanObat dipanggil
        window._pendingFrekuensiBaru = val;
    }
}

async function simpanObat() {
    const nama = document.getElementById('obat_nama')?.value.trim();
    if (!nama) return showToast('⚠️ Nama obat wajib diisi', 'error');

    const expRaw = document.getElementById('obat_exp_date')?.value; // format YYYY-MM
    const payload = {
        id:                 document.getElementById('obat_id')?.value || null,
        nama,
        kategori:           document.getElementById('obat_kategori')?.value.trim()  || 'Umum',
        satuan:             document.getElementById('obat_satuan')?.value            || 'tablet',
        harga_beli:         document.getElementById('obat_harga_beli')?.value        || 0,
        harga_jual:         document.getElementById('obat_harga_jual')?.value        || 0,
        stok:               document.getElementById('obat_stok')?.value             || 0,
        stok_minimum:       document.getElementById('obat_stok_minimum')?.value     || 5,
        frekuensi_default:  document.getElementById('obat_frekuensi_default')?.value || '3x1',
        keterangan:         document.getElementById('obat_keterangan')?.value.trim() || null,
        exp_date:           expRaw ? expRaw + '-01' : null  // simpan sebagai DATE YYYY-MM-01
    };

    try {
        await sb_saveObat(payload);
        showToast('✅ Data obat tersimpan', 'success');
        closeModalObat();
        await _refreshObatCache();
        renderDaftarObat();
    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    }
}

async function hapusObat(id) {
    if (!confirm('Hapus obat ini? Tindakan tidak dapat dibatalkan.')) return;
    try {
        await sb_deleteObat(id);
        showToast('🗑️ Obat dihapus', 'success');
        await _refreshObatCache();
        renderDaftarObat();
    } catch(e) {
        showToast('❌ Gagal menghapus: ' + (e.message || ''), 'error');
    }
}

// ════════════════════════════════════════
//  MODAL: RESTOCK
// ════════════════════════════════════════
function openModalRestock(obatId) {
    const modal = document.getElementById('modalRestock');
    if (!modal) return;
    const obat = _obatCache.find(o => String(o.id) === String(obatId));
    document.getElementById('restock_obat_id').value    = obatId;
    document.getElementById('restock_nama_obat').textContent = obat ? `💊 ${obat.nama}  (Stok saat ini: ${obat.stok ?? 0} ${obat.satuan})` : '';
    document.getElementById('restock_jumlah').value     = '';
    document.getElementById('restock_harga').value      = '';
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('restock_jumlah')?.focus(), 100);
}

function closeModalRestock() {
    const modal = document.getElementById('modalRestock');
    if (modal) modal.style.display = 'none';
}

async function simpanRestock() {
    const id     = document.getElementById('restock_obat_id')?.value;
    const jumlah = Number(document.getElementById('restock_jumlah')?.value);
    const harga  = document.getElementById('restock_harga')?.value;

    if (!jumlah || jumlah < 1) return showToast('⚠️ Jumlah harus minimal 1', 'error');

    try {
        await sb_tambahStok(id, jumlah, harga || null);
        showToast(`✅ Stok ditambah ${jumlah}`, 'success');
        closeModalRestock();
        await _refreshObatCache();
        renderDaftarObat();
    } catch(e) {
        showToast('❌ Gagal restock: ' + (e.message || ''), 'error');
    }
}

// ════════════════════════════════════════
//  RESEP PICKER — untuk page-medis
// ════════════════════════════════════════

/** Render section resep di page-medis.
 *  Dipanggil dari kunjungan.js saat _stokAktif = true */
function renderSectionResep(kunjunganId) {
    const container = document.getElementById('sectionResep');
    if (!container) return;

    container.innerHTML = `
    <div class="section-divider"><span>💊 Resep Obat</span>
        <button onclick="openModalPilihObat()"
            style="margin-left:auto;padding:4px 10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
            ➕ Pilih Obat
        </button>
    </div>

    <div id="resepItemList" style="margin-bottom:8px;min-height:40px;">
        ${_resepItems.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:10px;">Belum ada obat ditambahkan</div>'
            : _resepItems.map((item, idx) => _htmlResepItem(item, idx)).join('')
        }
    </div>

    ${_resepItems.length > 0 ? `
    <div id="resepTotalBox" style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:10px 12px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--primary-dark);">
            <span>Total Biaya Obat:</span>
            <span>Rp ${_fmt(_resepItems.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0))}</span>
        </div>
    </div>` : '<div id="resepTotalBox" style="display:none;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:10px 12px;font-size:12px;"><div style="display:flex;justify-content:space-between;font-weight:700;color:var(--primary-dark);"><span>Total Biaya Obat:</span><span></span></div></div>'}
    `;
}

function _htmlResepItem(item, idx) {
    const subtotal = Number(item.jumlah) * Number(item.harga_satuan);
    return `
    <div style="background:#fff;border:1px solid rgba(0,0,0,0.09);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;">
                <div style="font-weight:700;font-size:12.5px;color:var(--primary-dark);">${escHtml(item.nama_obat)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">Rp ${_fmt(item.harga_satuan)} / ${escHtml(item.satuan || 'tablet')}</div>
            </div>
            <button onclick="_hapusResepItem(${idx})"
                style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0;line-height:1;">✕</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:4px;">
                <label style="font-size:10.5px;color:var(--text-muted);">Jumlah:</label>
                <input type="number" value="${item.jumlah}" min="1"
                    style="width:52px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:center;"
                    onchange="_updateResepItem(${idx}, 'jumlah', this.value)">
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex:1;">
                <label style="font-size:10.5px;color:var(--text-muted);">Frekuensi:</label>
                ${_buildFrekuensiResepInput(idx, item.frekuensi)}
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:6px;">
            <label style="font-size:10.5px;color:var(--text-muted);">Catatan:</label>
            <input type="text" value="${escHtml(item.catatan || '')}" placeholder="Sesudah makan, dll."
                style="flex:1;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;"
                onchange="_updateResepItem(${idx}, 'catatan', this.value)">
        </div>
        <div style="text-align:right;font-size:11px;color:var(--primary);font-weight:700;margin-top:6px;">
            Subtotal: Rp ${_fmt(subtotal)}
        </div>
    </div>`;
}

function _hapusResepItem(idx) {
    _resepItems.splice(idx, 1);
    _rerenderResepList();
    _syncTerapiField();
}

function _updateResepItem(idx, field, val) {
    if (_resepItems[idx]) {
        _resepItems[idx][field] = field === 'jumlah' ? Math.max(1, Number(val)) : val;
        _rerenderResepList();
        _syncTerapiField();
    }
}

function _rerenderResepList() {
    const el = document.getElementById('resepItemList');
    if (!el) return;
    if (_resepItems.length === 0) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:10px;">Belum ada obat ditambahkan</div>';
    } else {
        el.innerHTML = _resepItems.map((item, idx) => _htmlResepItem(item, idx)).join('');
    }
    // BUG-F FIX: Pakai getElementById bukan nextElementSibling yang rapuh
    const totalEl = document.getElementById('resepTotalBox');
    if (totalEl) {
        if (_resepItems.length > 0) {
            const total = _resepItems.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
            totalEl.style.display = '';
            const spanTotal = totalEl.querySelector('span:last-child');
            if (spanTotal) spanTotal.textContent = 'Rp ' + _fmt(total);
        } else {
            totalEl.style.display = 'none';
        }
    }
}

/** Sinkron field #terapi dengan teks ringkasan resep */
function _syncTerapiField() {
    const terapiEl = document.getElementById('terapi');
    if (!terapiEl) return;
    if (_resepItems.length === 0) {
        terapiEl.value = '';
        terapiEl.dataset.fromResep = '';
        return;
    }
    terapiEl.value = _resepItems.map(item =>
        `${item.nama_obat} ${item.frekuensi}${item.catatan ? ' (' + item.catatan + ')' : ''}`
    ).join('\n');
    // Tandai agar clearSession tahu isi ini berasal dari resep (bukan ketikan manual)
    terapiEl.dataset.fromResep = 'true';
}

// ════════════════════════════════════════
//  FREKUENSI — helper
// ════════════════════════════════════════

// Frekuensi bawaan sistem
const _FREKUENSI_DEFAULT = ['1x1','2x1','3x1','3x2','4x1','1x1 malam','prn'];

/** Kumpulkan semua frekuensi unik: default + dari cache obat */
function _getAllFrekuensiOptions() {
    const fromCache = _obatCache
        .map(o => (o.frekuensi_default || '').trim())
        .filter(f => f && !_FREKUENSI_DEFAULT.includes(f));
    return [..._FREKUENSI_DEFAULT, ...new Set(fromCache)];
}

/** Render select frekuensi di item resep, dengan opsi "Lainnya..." untuk input manual */
function _buildFrekuensiResepInput(idx, currentVal) {
    const opts  = _getAllFrekuensiOptions();
    const isCustom = currentVal && !opts.includes(currentVal);
    const optsHtml = opts.map(f =>
        `<option value="${escHtml(f)}" ${currentVal === f ? 'selected' : ''}>${escHtml(f)}</option>`
    ).join('');
    const customSelected = isCustom ? 'selected' : '';
    return `
    <div style="flex:1;display:flex;gap:4px;align-items:center;">
        <select id="frekSelect_${idx}"
            style="flex:1;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;"
            onchange="_onFrekSelectChange(${idx}, this)">
            ${optsHtml}
            <option value="__custom__" ${customSelected}>✏️ Lainnya...</option>
        </select>
        ${isCustom ? `
        <input type="text" id="frekInput_${idx}" value="${escHtml(currentVal)}" placeholder="cth: 2x½"
            style="width:72px;padding:4px 6px;border:1px solid #93c5fd;border-radius:6px;font-size:12px;"
            onchange="_updateResepItem(${idx}, 'frekuensi', this.value)">` : ''}
    </div>`;
}

/** Handler saat select frekuensi berubah */
function _onFrekSelectChange(idx, selectEl) {
    const val = selectEl.value;
    if (val === '__custom__') {
        // Tampilkan input manual inline
        const wrap = selectEl.parentElement;
        let inp = wrap.querySelector(`#frekInput_${idx}`);
        if (!inp) {
            inp = document.createElement('input');
            inp.type = 'text';
            inp.id   = `frekInput_${idx}`;
            inp.placeholder = 'cth: 2x½';
            inp.style.cssText = 'width:72px;padding:4px 6px;border:1px solid #93c5fd;border-radius:6px;font-size:12px;';
            inp.addEventListener('change', () => {
                _updateResepItem(idx, 'frekuensi', inp.value.trim() || '3x1');
            });
            wrap.appendChild(inp);
        }
        inp.focus();
    } else {
        // Sembunyikan input manual jika ada
        const inp = document.getElementById(`frekInput_${idx}`);
        if (inp) inp.remove();
        _updateResepItem(idx, 'frekuensi', val);
    }
}

// ════════════════════════════════════════
//  MODAL: PILIH OBAT (di page-medis)
// ════════════════════════════════════════
function openModalPilihObat() {
    let modal = document.getElementById('modalPilihObat');
    if (!modal) {
        modal = _buildModalPilihObat();
        document.body.appendChild(modal);
    }
    _renderPilihObatList('');
    modal.style.display = 'block';
    setTimeout(() => document.getElementById('searchPilihObat')?.focus(), 100);
}

function _buildModalPilihObat() {
    const div = document.createElement('div');
    div.id = 'modalPilihObat';
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.5);overflow-y:auto;padding:16px;';
    div.innerHTML = `
    <div style="background:#fff;border-radius:18px;max-width:480px;margin:0 auto;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:14px;font-weight:800;color:var(--primary-dark);">💊 Pilih Obat</div>
            <button onclick="closeModalPilihObat()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">✕</button>
        </div>
        <input type="text" id="searchPilihObat" placeholder="🔍 Cari nama obat..." class="form-control"
            style="margin-bottom:10px;" oninput="_renderPilihObatList(this.value)">
        <div id="pilihObatList" style="max-height:360px;overflow-y:auto;"></div>
    </div>`;
    return div;
}

function closeModalPilihObat() {
    const modal = document.getElementById('modalPilihObat');
    if (modal) modal.style.display = 'none';
}

function _renderPilihObatList(search) {
    const container = document.getElementById('pilihObatList');
    if (!container) return;

    const q = (search || '').toLowerCase();
    const list = _obatCache.filter(o => !q || o.nama.toLowerCase().includes(q));

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px;">Obat tidak ditemukan</div>';
        return;
    }

    container.innerHTML = list.map(o => {
        const stokKritis = (o.stok ?? 0) <= (o.stok_minimum ?? 5);
        const stokHabis  = (o.stok ?? 0) === 0;
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #f1f5f9;cursor:${stokHabis ? 'not-allowed' : 'pointer'};opacity:${stokHabis ? '0.5' : '1'}"
            ${stokHabis ? '' : `onclick="_pilihObat('${escHtml(String(o.id))}')"`}>
            <div style="flex:1;">
                <div style="font-weight:700;font-size:12.5px;">${escHtml(o.nama)}</div>
                <div style="font-size:10.5px;color:var(--text-muted);">${escHtml(o.kategori||'—')} · ${escHtml(o.frekuensi_default||'3x1')}</div>
                <div style="font-size:10.5px;color:var(--primary);">Rp ${_fmt(o.harga_jual)} / ${escHtml(o.satuan)}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:15px;font-weight:800;color:${stokKritis ? '#dc2626' : 'var(--success)'};">${o.stok ?? 0}</div>
                <div style="font-size:9px;color:var(--text-muted);">${stokHabis ? '❌ HABIS' : stokKritis ? '⚠️ tipis' : 'stok'}</div>
            </div>
        </div>`;
    }).join('');
}

function _pilihObat(obatId) {
    const obat = _obatCache.find(o => String(o.id) === String(obatId));
    if (!obat) return;

    // Jika sudah ada di resep, tambah jumlahnya
    const existing = _resepItems.find(i => String(i.obat_id) === String(obatId));
    if (existing) {
        existing.jumlah = (existing.jumlah || 10) + 10;
    } else {
        _resepItems.push({
            obat_id:      obat.id,
            nama_obat:    obat.nama,
            satuan:       obat.satuan,
            jumlah:       10,
            frekuensi:    obat.frekuensi_default || '3x1',
            harga_satuan: obat.harga_jual || 0,
            catatan:      obat.keterangan || ''
        });
    }

    closeModalPilihObat();
    _rerenderResepList();
    _syncTerapiField();
    showToast(`✅ ${obat.nama} ditambahkan ke resep`, 'success');
}

// ════════════════════════════════════════
//  SIMPAN RESEP (dipanggil dari saveAll di kunjungan.js)
// ════════════════════════════════════════
async function simpanResepKunjungan(kunjunganId) {
    if (!_stokAktif || !kunjunganId) return;
    // FIX: Selalu panggil sb_saveResep meski _resepItems kosong,
    // agar data lama di DB terhapus saat dokter mengosongkan resep.
    try {
        await sb_saveResep(kunjunganId, _resepItems || []);
    } catch(e) {
        showToast('⚠️ Resep tersimpan sebagian: ' + (e.message || ''), 'error');
    }
}

/** Reset state resep saat sesi pasien diganti */
function resetResepSession() {
    _resepItems = [];
    const el = document.getElementById('resepItemList');
    if (el) el.innerHTML = '';
}

/** Load resep lama saat kunjungan di-resume */
async function loadResepByKunjungan(kunjunganId) {
    if (!_stokAktif || !kunjunganId) return;
    try {
        const rows = await sb_getResepByKunjungan(kunjunganId);
        _resepItems = rows.map(r => ({
            obat_id:      r.obat_id,
            nama_obat:    r.nama_obat || (r.obat && r.obat.nama) || '—',
            satuan:       (r.obat && r.obat.satuan) || 'tablet',
            jumlah:       r.jumlah,
            frekuensi:    r.frekuensi,
            harga_satuan: r.harga_satuan,
            catatan:      r.catatan || ''
        }));
        _rerenderResepList();
        _syncTerapiField();
    } catch(e) {
        _resepItems = [];
    }
}

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════
// _fmt: alias ke fmtRp() global (app.js) — tidak perlu definisi lokal
// _fmt — definisi kanonik ada di supabase.js sebagai window.fmtRp.
const _fmt = (n) => window.fmtRp(n);

function _hitungMargin(beli, jual) {
    if (!beli || beli == 0) return jual > 0 ? 100 : 0;
    return Math.round(((jual - beli) / beli) * 100);
}


// ════════════════════════════════════════
//  IMPORT OBAT DARI EXCEL
// ════════════════════════════════════════

/** Buka modal import Excel */
function openModalImportObat() {
    let modal = document.getElementById('modalImportObat');
    if (!modal) {
        modal = _buildModalImportObat();
        document.body.appendChild(modal);
    }
    // Reset state
    document.getElementById('importObatFile').value = '';
    document.getElementById('importPreviewArea').innerHTML = '';
    document.getElementById('btnKonfirmasiImport').style.display = 'none';
    window._importObatRows = [];
    modal.style.display = 'block';
}

function closeModalImportObat() {
    const m = document.getElementById('modalImportObat');
    if (m) m.style.display = 'none';
}

function _buildModalImportObat() {
    const div = document.createElement('div');
    div.id = 'modalImportObat';
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.5);overflow-y:auto;padding:16px;';
    div.innerHTML = `
    <div style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:22px 20px;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:15px;font-weight:800;color:var(--primary-dark);">📥 Import Obat dari Excel</div>
            <button onclick="closeModalImportObat()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">✕</button>
        </div>

        <!-- Template download -->
        <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11.5px;font-weight:700;color:var(--primary-dark);margin-bottom:6px;">📋 Format Kolom Excel</div>
            <div style="font-size:10.5px;color:var(--text-muted);line-height:1.8;">
                Baris pertama = header. Urutan kolom:<br>
                <span style="font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px;">
                nama | kategori | satuan | harga_beli | harga_jual | stok | stok_minimum | frekuensi_default | exp_date | keterangan
                </span><br>
                <span style="font-size:10px;">exp_date format: <b>YYYY-MM</b> (contoh: 2026-08) atau kosongkan</span>
            </div>
            <button onclick="_downloadTemplateExcel()" style="margin-top:8px;padding:6px 12px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                ⬇️ Download Template Excel
            </button>
        </div>

        <!-- File picker -->
        <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;">Pilih File Excel (.xlsx / .xls / .csv)</label>
            <input type="file" id="importObatFile" accept=".xlsx,.xls,.csv"
                style="width:100%;padding:8px;border:1.5px dashed #e2e8f0;border-radius:10px;font-size:12px;cursor:pointer;"
                onchange="_parseExcelObat(this)">
        </div>

        <!-- Preview -->
        <div id="importPreviewArea" style="max-height:280px;overflow-y:auto;margin-bottom:12px;"></div>

        <!-- Tombol konfirmasi -->
        <div style="display:flex;gap:8px;">
            <button id="btnKonfirmasiImport" onclick="_eksekusiImportObat()"
                style="display:none;flex:1;padding:11px;background:var(--success);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
                ✅ Import Sekarang
            </button>
            <button onclick="closeModalImportObat()" style="padding:11px 16px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                Batal
            </button>
        </div>
    </div>`;
    return div;
}

/** Parse file Excel / CSV menggunakan SheetJS */
async function _parseExcelObat(input) {
    const file = input.files[0];
    if (!file) return;

    const preview = document.getElementById('importPreviewArea');
    preview.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">⏳ Membaca file...</div>';

    try {
        // Load SheetJS dari CDN jika belum ada
        if (typeof XLSX === 'undefined') {
            await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        }

        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (raw.length === 0) {
            preview.innerHTML = '<div style="color:#dc2626;font-size:12px;padding:10px;">❌ File kosong atau format tidak dikenali.</div>';
            return;
        }

        // Normalize: mapping fleksibel header kolom
        const rows = raw.map((r, i) => _normalizeImportRow(r, i + 2));
        const valid = rows.filter(r => r.nama && r.nama.trim());

        window._importObatRows = valid;
        _renderImportPreview(valid, rows.length - valid.length);

    } catch(e) {
        preview.innerHTML = `<div style="color:#dc2626;font-size:12px;padding:10px;">❌ Gagal membaca file: ${escHtml(e.message || '')}</div>`;
        console.error('[Import Obat]', e);
    }
}

/** Normalisasi baris Excel — toleran terhadap variasi nama header */
function _normalizeImportRow(r, baris) {
    const _get = (...keys) => {
        for (const k of keys) {
            const found = Object.keys(r).find(rk => rk.toLowerCase().replace(/\s+/g,'_') === k.toLowerCase());
            if (found && r[found] !== '' && r[found] !== undefined) return String(r[found]).trim();
        }
        return '';
    };

    // Proses exp_date — bisa YYYY-MM, YYYY-MM-DD, atau Date object dari SheetJS
    let expRaw = _get('exp_date','expired','kadaluarsa','tanggal_exp','expiry');
    let expDate = null;
    if (expRaw) {
        if (expRaw instanceof Date || (typeof expRaw === 'object')) {
            expDate = expRaw.toISOString().substring(0,7) + '-01';
        } else if (/^\d{4}-\d{2}$/.test(expRaw)) {
            expDate = expRaw + '-01';
        } else if (/^\d{4}-\d{2}-\d{2}/.test(expRaw)) {
            expDate = expRaw.substring(0,10);
        } else if (/^\d{1,2}\/\d{4}$/.test(expRaw)) {
            // format MM/YYYY
            const [mm, yyyy] = expRaw.split('/');
            expDate = `${yyyy}-${mm.padStart(2,'0')}-01`;
        }
    }

    return {
        _baris:           baris,
        nama:             _get('nama','name','nama_obat'),
        kategori:         _get('kategori','category','golongan') || 'Umum',
        satuan:           _get('satuan','unit','kemasan') || 'tablet',
        harga_beli:       Number(_get('harga_beli','modal','cost','harga beli').replace(/[^0-9.]/g,'')) || 0,
        harga_jual:       Number(_get('harga_jual','harga','price','jual','harga jual').replace(/[^0-9.]/g,'')) || 0,
        stok:             Number(_get('stok','stock','qty','jumlah').replace(/[^0-9.]/g,'')) || 0,
        stok_minimum:     Number(_get('stok_minimum','min','minimum','min_stok').replace(/[^0-9.]/g,'')) || 5,
        frekuensi_default:_get('frekuensi_default','frekuensi','dosis','dose') || '3x1',
        exp_date:         expDate,
        keterangan:       _get('keterangan','note','catatan','ket') || null
    };
}

/** Render preview tabel sebelum import */
function _renderImportPreview(rows, dilewati) {
    const preview = document.getElementById('importPreviewArea');
    const btn     = document.getElementById('btnKonfirmasiImport');

    if (rows.length === 0) {
        preview.innerHTML = '<div style="color:#dc2626;font-size:12px;padding:10px;">❌ Tidak ada data valid. Pastikan kolom "nama" terisi.</div>';
        btn.style.display = 'none';
        return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    preview.innerHTML = `
    <div style="font-size:11.5px;font-weight:700;color:var(--success);margin-bottom:8px;">
        ✅ ${rows.length} obat siap diimport${dilewati > 0 ? ` · ⚠️ ${dilewati} baris dilewati (nama kosong)` : ''}
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
        <thead>
            <tr style="background:#f8fafc;">
                <th style="padding:5px 8px;text-align:left;border-bottom:1px solid #e2e8f0;font-weight:700;">Nama</th>
                <th style="padding:5px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Kat.</th>
                <th style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">Stok</th>
                <th style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">Jual</th>
                <th style="padding:5px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">Exp</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(r => {
                const expD = r.exp_date ? new Date(r.exp_date) : null;
                const isExp = expD && expD < today;
                const isSoon = expD && !isExp && Math.floor((expD-today)/(1000*60*60*24)) <= 90;
                return `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:5px 8px;font-weight:600;">${escHtml(r.nama)}</td>
                    <td style="padding:5px 8px;color:var(--text-muted);">${escHtml(r.kategori)}</td>
                    <td style="padding:5px 8px;text-align:right;">${r.stok}</td>
                    <td style="padding:5px 8px;text-align:right;">Rp ${_fmt(r.harga_jual)}</td>
                    <td style="padding:5px 8px;text-align:center;color:${isExp?'#dc2626':isSoon?'#d97706':'var(--text-muted)'};">
                        ${r.exp_date ? _formatExpDate(r.exp_date) : '—'}${isExp?' 🚫':isSoon?' ⚠️':''}
                    </td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>
    </div>`;
    btn.style.display = '';
}

/** Eksekusi import ke Supabase */
async function _eksekusiImportObat() {
    const rows = window._importObatRows || [];
    if (rows.length === 0) return;

    const btn = document.getElementById('btnKonfirmasiImport');
    btn.disabled = true;
    btn.textContent = `⏳ Mengimport 0/${rows.length}...`;

    let sukses = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        btn.textContent = `⏳ Mengimport ${i+1}/${rows.length}...`;
        try {
            await sb_saveObat(rows[i]);
            sukses++;
        } catch(e) {
            errors.push(`${rows[i].nama}: ${e.message || 'error'}`);
        }
    }

    btn.disabled = false;
    btn.textContent = '✅ Import Sekarang';

    if (sukses > 0) {
        showToast(`✅ ${sukses} obat berhasil diimport${errors.length > 0 ? `, ${errors.length} gagal` : ''}`, 'success');
        closeModalImportObat();
        await _refreshObatCache();
        renderDaftarObat();
    } else {
        showToast('❌ Semua import gagal. Periksa koneksi & format data.', 'error');
    }
    if (errors.length > 0) console.warn('[Import Obat] Errors:', errors);
}

/** Download template Excel kosong */
function _downloadTemplateExcel() {
    if (typeof XLSX === 'undefined') {
        _loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(_downloadTemplateExcel);
        return;
    }
    const data = [
        ['nama','kategori','satuan','harga_beli','harga_jual','stok','stok_minimum','frekuensi_default','exp_date','keterangan'],
        ['Amoxicillin 500mg','Antibiotik','tablet',3000,8000,100,10,'3x1','2026-08','Sesudah makan'],
        ['Paracetamol 500mg','Analgesik','tablet',500,2000,200,20,'3x1','2026-12',''],
        ['Antasida Doen','Antasida','tablet',800,3000,150,15,'3x1 AC','2025-11','Sebelum makan'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Style header
    ws['!cols'] = [20,14,10,12,12,8,14,18,12,20].map(w => ({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Obat');
    XLSX.writeFile(wb, 'template_import_obat.xlsx');
}

/** Load script dinamis */
function _loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

/** Format exp_date YYYY-MM-DD → Agu 2026 */
function _formatExpDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

/** Ringkasan summary — tambah tile exp kadaluarsa */
function _getExpiredCount() {
    const today = new Date(); today.setHours(0,0,0,0);
    return _obatCache.filter(o => o.exp_date && new Date(o.exp_date) < today).length;
}

// ════════════════════════════════════════════════════════
//  CLEAR SESSION — reset _resepItems saat pasien berganti
//  BUG FIX: stok.js tidak pernah hook clearSession(), sehingga
//  _resepItems dari pasien sebelumnya tetap terisi saat pasien
//  baru didaftarkan. Akibatnya obat milik pasien lain muncul
//  di field terapi pasien baru tanpa ada input apapun.
// ════════════════════════════════════════════════════════

(function _wrapClearSessionForResep() {
    function _doWrap() {
        if (typeof window.clearSession !== 'function') return false;
        if (window._clearSessionResepWrapped) return true;
        window._clearSessionResepWrapped = true;

        const _origClear = window.clearSession;
        window.clearSession = function() {
            _origClear.apply(this, arguments);
            // Reset state resep agar tidak bocor ke pasien berikutnya
            _resepItems = [];
            const resepList = document.getElementById('resepItemList');
            if (resepList) resepList.innerHTML = '';
            // Kosongkan field terapi jika diisi otomatis dari resep
            const terapiEl = document.getElementById('terapi');
            if (terapiEl && terapiEl.dataset.fromResep === 'true') {
                terapiEl.value = '';
                terapiEl.dataset.fromResep = '';
            }
        };
        return true;
    }

    if (!_doWrap()) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (_doWrap() || tries > 60) clearInterval(t);
        }, 150);
    }
})();
