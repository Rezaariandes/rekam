// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL INVOICE (invoice.js)
//  SATU-SATUNYA sumber semua modal & fungsi invoice:
//
//  openModalTagihan()        → modal INPUT tagihan baru
//                              (dipanggil setelah simpan rekam medis)
//                              sudah include cek tagihan existing di DB
//  lihatTagihanKunjungan()   → modal LIHAT invoice tersimpan (dari riwayat)
//  _showInvoiceModal()       → render modal view/edit invoice
//  printInvoice()            → print invoice ke jendela baru
//
//  Dipisah dari biaya.js agar struktur lebih modular.
//  biaya.js hanya mengurus tarif layanan & kalkulasi.
// ════════════════════════════════════════════════════════

/** Format angka ke Rupiah tanpa simbol, misal 15000 → "15.000" */
function _fmtRp(n) {
    return Number(n || 0).toLocaleString('id-ID');
}

// ════════════════════════════════════════
//  STATE MODAL TAGIHAN (input baru)
// ════════════════════════════════════════
let _tagihanKunjId     = null;
let _tagihanPasienId   = null;
let _tagihanPasienNama = '';
let _tagihanTgl        = '';
let _tagihanItems      = [];
let _tagihanDiskon     = 0;

// ════════════════════════════════════════
//  openModalTagihan — dipanggil setelah simpan rekam medis
//  Menggantikan showTagihanModal lama di biaya.js
// ════════════════════════════════════════
async function openModalTagihan(kunjunganId, pasienId, pasienNama, tgl, kunjunganData) {
    if (!window._biayaAktif) return;
    _tagihanKunjId     = kunjunganId;
    _tagihanPasienId   = pasienId;
    _tagihanPasienNama = pasienNama || '—';
    _tagihanTgl        = tgl || '';
    _tagihanDiskon     = 0;

    // Pastikan tarif cache terisi
    if (!window._tarifCache || window._tarifCache.length === 0) {
        try { await _refreshTarifCache(); } catch(e) {}
    }

    // BUG-FIX: Cek dulu apakah tagihan sudah ada di DB untuk kunjungan ini.
    // Jika sudah ada → tampilkan data dari DB (konsisten dengan invoice riwayat).
    // Jika belum ada → generate otomatis dari data kunjungan.
    let existingTagihan = null;
    try { existingTagihan = await sb_getTagihan(kunjunganId); } catch(e) { /* ignore */ }

    if (existingTagihan && existingTagihan.tagihan_item && existingTagihan.tagihan_item.length > 0) {
        // Tagihan sudah tersimpan — pakai data dari DB
        _tagihanItems = existingTagihan.tagihan_item.map(it => ({
            nama_item:    it.nama_item,
            kategori:     it.kategori,
            jumlah:       Number(it.jumlah) || 1,
            harga_satuan: Number(it.harga_satuan) || 0,
            keterangan:   it.keterangan || null
        }));
        _tagihanDiskon = Number(existingTagihan.diskon) || 0;
    } else {
        // Tagihan belum ada — generate otomatis
        try {
            _tagihanItems = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData || {});
        } catch(e) {
            _tagihanItems = [];
            showToast('⚠️ Gagal generate tagihan otomatis', 'error');
        }
    }

    // Isi catatan awal jika ada dari DB
    window._tagihanCatatanInit = (existingTagihan && existingTagihan.catatan) ? existingTagihan.catatan : '';

    let modal = document.getElementById('modalTagihan');
    if (!modal) {
        modal = _buildModalTagihan();
        document.body.appendChild(modal);
    }
    _renderModalTagihanContent();
    modal.style.display = 'flex';
}

// ════════════════════════════════════════
//  _buildModalTagihan — buat elemen modal sekali
// ════════════════════════════════════════
function _buildModalTagihan() {
    const modal = document.createElement('div');
    modal.id = 'modalTagihan';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div id="modalTagihanInner"
        style="background:#fff;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;box-shadow:0 -4px 24px rgba(0,0,0,.15)">
    </div>`;
    return modal;
}

// ════════════════════════════════════════
//  _renderModalTagihanContent — render/re-render isi modal tagihan
// ════════════════════════════════════════
function _renderModalTagihanContent() {
    const inner = document.getElementById('modalTagihanInner');
    if (!inner) return;

    const items    = _tagihanItems || [];
    const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const diskon   = Number(_tagihanDiskon) || 0;
    const total    = Math.max(0, subtotal - diskon);

    inner.innerHTML = `
        <h3 style="margin:0 0 4px;font-size:16px">🧾 Rincian Tagihan</h3>
        <p style="font-size:12px;color:#64748b;margin:0 0 14px">${_tagihanPasienNama} · ${_tagihanTgl ? formatTglIndo(_tagihanTgl) : ''}</p>
        <div id="_mtItemList">
            ${items.length === 0
                ? '<div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px">Belum ada item tagihan.</div>'
                : items.map((it, i) => _mtItemRow(it, i)).join('')}
        </div>
        <button onclick="_mtTambahItem()"
            style="width:100%;padding:9px;border:1.5px dashed var(--primary);border-radius:10px;color:var(--primary);font-size:13px;cursor:pointer;background:#f8faff;margin:8px 0">
            ➕ Tambah Item
        </button>
        <div style="border-top:1.5px solid #e2e8f0;margin:10px 0;padding-top:10px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                <span>Subtotal</span>
                <span id="_mtSubtotal">Rp ${_fmtRp(subtotal)}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;margin-bottom:10px">
                <span>Diskon (Rp)</span>
                <input id="_mtDiskon" type="number" value="${diskon}" min="0"
                    oninput="_tagihanDiskon=Number(this.value)||0;_mtRecalc()"
                    style="width:120px;padding:5px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;text-align:right">
            </div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--primary)">
                <span>TOTAL</span>
                <span id="_mtTotal">Rp ${_fmtRp(total)}</span>
            </div>
        </div>
        <textarea id="_mtCatatan" placeholder="Catatan (opsional)" rows="2"
            style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;margin-bottom:10px;resize:none">${escHtml(window._tagihanCatatanInit || '')}</textarea>
        <div style="display:flex;gap:8px">
            <button onclick="document.getElementById('modalTagihan').style.display='none'"
                style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:13px;cursor:pointer;background:#fff">
                Lewati
            </button>
            <button onclick="_mtSimpan()"
                style="flex:2;padding:12px;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--primary);color:#fff">
                💾 Simpan Tagihan
            </button>
        </div>`;
}

function _mtItemRow(it, idx) {
    return `<div id="_mtrow_${idx}" style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #f1f5f9">
        <div style="flex:1;font-size:12px;font-weight:600">${escHtml(it.nama_item)}</div>
        <input type="number" value="${it.jumlah||1}" min="1"
            oninput="_tagihanItems[${idx}].jumlah=Number(this.value);_mtRecalc()"
            style="width:40px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:center">
        <input type="number" value="${it.harga_satuan}" min="0"
            oninput="_tagihanItems[${idx}].harga_satuan=Number(this.value);_mtRecalc()"
            style="width:90px;padding:3px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:right">
        <button onclick="_mtHapusItem(${idx})"
            style="padding:3px 7px;border:1px solid #ef4444;border-radius:6px;color:#ef4444;font-size:11px;cursor:pointer;background:#fff">✕</button>
    </div>`;
}

function _mtTambahItem() {
    _tagihanItems = _tagihanItems || [];
    _tagihanItems.push({ nama_item: 'Item Baru', kategori: 'Lainnya', jumlah: 1, harga_satuan: 0 });
    _renderModalTagihanContent();
}

function _mtHapusItem(idx) {
    _tagihanItems.splice(idx, 1);
    _renderModalTagihanContent();
}

function _mtRecalc() {
    const items  = _tagihanItems || [];
    const sub    = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const diskon = Number(document.getElementById('_mtDiskon')?.value) || 0;
    const total  = Math.max(0, sub - diskon);
    const subEl  = document.getElementById('_mtSubtotal');
    const totEl  = document.getElementById('_mtTotal');
    if (subEl) subEl.innerText = 'Rp ' + _fmtRp(sub);
    if (totEl) totEl.innerText = 'Rp ' + _fmtRp(total);
}

async function _mtSimpan() {
    const diskon  = Number(document.getElementById('_mtDiskon')?.value)   || 0;
    const catatan = document.getElementById('_mtCatatan')?.value           || '';
    if (!_tagihanKunjId) return showToast('⚠️ ID kunjungan tidak tersedia', 'error');
    try {
        const result = await sb_saveTagihan(_tagihanKunjId, _tagihanPasienId, _tagihanItems, diskon, catatan);
        document.getElementById('modalTagihan').style.display = 'none';
        showToast(`✅ Tagihan Rp ${_fmtRp(Number(result.total))} berhasil disimpan`, 'success');
    } catch(e) {
        showToast('❌ Gagal menyimpan tagihan: ' + (e.message || ''), 'error');
    }
}

// ════════════════════════════════════════
//  LIHAT TAGIHAN DARI RIWAYAT / KUNJUNGAN
// ════════════════════════════════════════
async function lihatTagihanKunjungan(kunjunganId, pasienNama, tgl) {
    if (!kunjunganId) { showToast('⚠️ ID kunjungan tidak tersedia', 'error'); return; }
    if (!window._biayaAktif) { showToast('ℹ️ Modul pembiayaan belum diaktifkan di Settings', 'info'); return; }

    showToast('⏳ Memuat tagihan...', 'info');
    try {
        const tagihan = await sb_getTagihan(kunjunganId);
        if (!tagihan) {
            if (confirm(`ℹ️ Belum ada tagihan untuk kunjungan ini.\n\nBuat tagihan sekarang?`)) {
                try {
                    const kunjData = await sb_getKunjunganById(kunjunganId);
                    if (kunjData) {
                        _tagihanKunjId     = kunjunganId;
                        _tagihanPasienId   = kunjData.pasien_id || null;
                        _tagihanPasienNama = pasienNama || '—';
                        _tagihanTgl        = tgl || '';
                        _tagihanDiskon     = 0;
                        if (window._tarifCache.length === 0) await _refreshTarifCache();
                        try { _tagihanItems = await sb_autoTagihanFromKunjungan(kunjunganId, kunjData); }
                        catch(e) { _tagihanItems = []; }
                        let modal = document.getElementById('modalTagihan');
                        if (!modal) { modal = _buildModalTagihan(); document.body.appendChild(modal); }
                        _renderModalTagihanContent();
                        modal.style.display = 'block';
                    }
                } catch(e) { showToast('❌ Gagal memuat data kunjungan', 'error'); }
            }
            return;
        }
        _showInvoiceModal(tagihan, pasienNama || '—', tgl || '');
    } catch(e) {
        const msg = e.message || '';
        if (msg.includes('does not exist') || msg.includes('relation')) {
            showToast('⚠️ Tabel tagihan belum dibuat. Jalankan SETUP_DATABASE.sql di Supabase.', 'error');
        } else {
            showToast('❌ Gagal memuat tagihan: ' + msg, 'error');
        }
    }
}

// ════════════════════════════════════════
//  MODAL INVOICE — TAMPILKAN
// ════════════════════════════════════════
function _showInvoiceModal(tagihan, pasienNama, tgl) {
    window._invoiceData      = tagihan;
    window._invoiceNama      = pasienNama || '';
    window._invoiceTgl       = tgl || '';
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

// ════════════════════════════════════════
//  RENDER MODAL — VIEW / EDIT MODE
// ════════════════════════════════════════
function _renderInvoiceModal() {
    const modal = document.getElementById('modalInvoiceView');
    if (!modal) return;
    const tagihan    = window._invoiceData;
    const pasienNama = window._invoiceNama || '';
    const tgl        = window._invoiceTgl  || '';
    const editMode   = window._invoiceEditMode === true;

    if (!editMode) {
        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;">
            ${_buildInvoiceHtml(tagihan, pasienNama, tgl)}
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
        const items    = window._invoiceEditItems;
        const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
        const diskon   = Number(window._invoiceEditDiskon) || 0;
        const total    = Math.max(0, subtotal - diskon);

        modal.innerHTML = `
        <div style="background:#fff;border-radius:18px;max-width:520px;margin:0 auto;padding:0;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden;">
            <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:16px 20px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:15px;font-weight:800;">✏️ Edit Invoice</div>
                    <div style="font-size:11px;opacity:.9;margin-top:2px;">${escHtml(pasienNama)} · ${tgl ? formatTglIndo(tgl) : '—'}</div>
                </div>
                <button onclick="_batalEditInvoice()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:8px;padding:5px 9px;font-size:15px;cursor:pointer;">✕</button>
            </div>
            <div style="padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-size:12px;font-weight:800;color:var(--primary-dark);">Item Tagihan</div>
                    <button onclick="_addItemInvoiceEdit()" style="padding:5px 11px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">➕ Tambah Item</button>
                </div>
                <div id="invoiceEditItemList">
                    ${items.length === 0
                        ? '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:14px;">Belum ada item.</div>'
                        : items.map((item, idx) => _htmlInvoiceEditItem(item, idx)).join('')}
                </div>
                <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-top:10px;margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:var(--text-muted);">
                        <span>Subtotal</span><span style="font-weight:700;color:var(--text);">Rp ${_fmtRp(subtotal)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        <span style="font-size:12px;color:var(--text-muted);flex-shrink:0;">Diskon (Rp)</span>
                        <input type="number" id="inp_edit_diskon" value="${diskon}" min="0" placeholder="0"
                            style="flex:1;padding:5px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:right;"
                            oninput="window._invoiceEditDiskon=Number(this.value)||0;_renderInvoiceModal();">
                    </div>
                    <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                        <span style="font-size:14px;font-weight:800;color:var(--primary-dark);">TOTAL</span>
                        <span style="font-size:16px;font-weight:900;color:var(--primary);">Rp ${_fmtRp(total)}</span>
                    </div>
                </div>
                <div style="margin-bottom:14px;">
                    <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Catatan</label>
                    <input type="text" id="inp_edit_catatan" value="${escHtml(tagihan.catatan || '')}" placeholder="Opsional"
                        style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"
                        oninput="window._invoiceEditCatatan=this.value">
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="_simpanEditInvoice()" style="flex:1;min-width:110px;padding:11px;background:var(--success);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">💾 Simpan Perubahan</button>
                    <button onclick="_simpanDanPrintEditInvoice()" style="flex:1;min-width:110px;padding:11px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">🖨️ Simpan & Print</button>
                    <button onclick="_batalEditInvoice()" style="padding:11px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:10px;font-size:12px;cursor:pointer;">Batal</button>
                </div>
            </div>
        </div>`;
    }
}

function _buildInvoiceHtml(tagihan, pasienNama, tgl) {
    const isLunas    = (tagihan.status || '').toLowerCase() === 'lunas';
    const subtotal   = Number(tagihan.subtotal || 0);
    const diskon     = Number(tagihan.diskon   || 0);
    const total      = Number(tagihan.total    || subtotal - diskon);

    // Kelompokkan item per kategori
    const KAT_ICON = {'Pemeriksaan':'🩺','Laboratorium':'🔬','Penunjang':'🔭','Tindakan':'⚕️','Obat':'💊','Administrasi':'📋','Lainnya':'📌'};
    const KAT_COLOR= {'Pemeriksaan':'#3b82f6','Laboratorium':'#7c3aed','Penunjang':'#0891b2','Tindakan':'#dc2626','Obat':'#059669','Administrasi':'#d97706','Lainnya':'#64748b'};
    const grouped  = {};
    (tagihan.tagihan_item || []).forEach(i => {
        const k = i.kategori || 'Lainnya';
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(i);
    });
    const KAT_ORDER = ['Pemeriksaan','Laboratorium','Penunjang','Tindakan','Obat','Administrasi','Lainnya'];
    const katUrut   = [...KAT_ORDER.filter(k => grouped[k]), ...Object.keys(grouped).filter(k => !KAT_ORDER.includes(k))];

    // Render section per kategori
    const sectionsHtml = katUrut.map(kat => {
        const clr   = KAT_COLOR[kat] || '#64748b';
        const icon  = KAT_ICON[kat]  || '📌';
        const items = grouped[kat];
        const rows  = items.map(i => {
            const sub = Number(i.subtotal || (Number(i.jumlah) * Number(i.harga_satuan)));
            return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;
                        padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;color:#1e293b;">${escHtml(i.nama_item)}</div>
                    <div style="font-size:10.5px;color:#64748b;margin-top:1px;">
                        Rp ${_fmtRp(i.harga_satuan)} × ${Number(i.jumlah)}
                        ${i.keterangan ? ` · <em>${escHtml(i.keterangan)}</em>` : ''}
                    </div>
                </div>
                <div style="font-weight:700;color:#1e293b;white-space:nowrap;padding-left:10px;">
                    Rp ${_fmtRp(sub)}
                </div>
            </div>`;
        }).join('');

        return `
        <!-- Section ${kat} -->
        <div style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <!-- Section header -->
            <div style="display:flex;align-items:center;gap:6px;
                        padding:7px 10px;
                        background:${clr}12;
                        border-bottom:1.5px solid ${clr}30;">
                <span style="font-size:13px;line-height:1;">${icon}</span>
                <span style="font-size:10px;font-weight:800;text-transform:uppercase;
                             letter-spacing:.7px;color:${clr};">${kat}</span>
            </div>
            <!-- Item rows -->
            <div style="background:#fff;">${rows}</div>
        </div>`;
    }).join('');

    return `
    <!-- ── Header modal ── -->
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:16px 18px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div>
                <div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:3px;">🧾 Invoice Kunjungan</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.8);">${escHtml(pasienNama)}</div>
                ${tgl ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.7);margin-top:1px;">📅 ${formatTglIndo(tgl)}</div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.5px;
                            background:${isLunas ? '#dcfce7' : '#fef3c7'};
                            color:${isLunas ? '#166534' : '#92400e'};">
                    ${isLunas ? '✓ LUNAS' : '⏳ BELUM LUNAS'}
                </div>
            </div>
        </div>
    </div>

    <div style="padding:14px 16px;">

        <!-- ── Section: Item Tagihan ── -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
            <div style="width:3px;height:14px;background:var(--primary,#3b82f6);border-radius:2px;flex-shrink:0;"></div>
            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-muted,#64748b);">Item Tagihan</span>
        </div>

        ${katUrut.length === 0
            ? `<div style="text-align:center;color:#94a3b8;font-size:12px;padding:18px;">Tidak ada item tagihan.</div>`
            : sectionsHtml}

        <!-- ── Section: Ringkasan Pembayaran ── -->
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-top:4px;">
            <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:#f8fafc;border-bottom:1.5px solid #e2e8f0;">
                <div style="width:3px;height:14px;background:#059669;border-radius:2px;flex-shrink:0;"></div>
                <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#059669;">Ringkasan Pembayaran</span>
            </div>
            <div style="padding:10px 12px;background:#fff;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:5px;">
                    <span>Subtotal</span>
                    <span style="font-weight:600;color:#1e293b;">Rp ${_fmtRp(subtotal)}</span>
                </div>
                ${diskon > 0 ? `
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#dc2626;margin-bottom:5px;">
                    <span>Diskon</span>
                    <span style="font-weight:600;">– Rp ${_fmtRp(diskon)}</span>
                </div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;
                            border-top:2px solid #e2e8f0;padding-top:8px;margin-top:4px;">
                    <span style="font-size:13px;font-weight:800;color:#0f172a;">TOTAL</span>
                    <span style="font-size:17px;font-weight:900;color:var(--primary,#3b82f6);">Rp ${_fmtRp(total)}</span>
                </div>
            </div>
        </div>

        <!-- ── Section: Catatan (jika ada) ── -->
        ${tagihan.catatan ? `
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-top:10px;">
            <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:#f8fafc;border-bottom:1.5px solid #e2e8f0;">
                <div style="width:3px;height:14px;background:#d97706;border-radius:2px;flex-shrink:0;"></div>
                <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#d97706;">Catatan</span>
            </div>
            <div style="padding:9px 12px;font-size:12px;color:#475569;background:#fff;">
                📝 ${escHtml(tagihan.catatan)}
            </div>
        </div>` : ''}

    </div>`;
}

// ════════════════════════════════════════
//  EDIT INVOICE — HELPERS
// ════════════════════════════════════════
function _mulaiEditInvoice() {
    const tagihan = window._invoiceData;
    if (!tagihan) return;
    window._invoiceEditItems  = (tagihan.tagihan_item || []).map(i => ({
        nama_item:    i.nama_item,
        kategori:     i.kategori     || 'Lainnya',
        jumlah:       Number(i.jumlah)       || 1,
        harga_satuan: Number(i.harga_satuan) || 0,
        keterangan:   i.keterangan   || null
    }));
    window._invoiceEditDiskon  = Number(tagihan.diskon) || 0;
    window._invoiceEditCatatan = tagihan.catatan || '';
    window._invoiceEditMode    = true;
    if (window._tarifCache.length === 0) _refreshTarifCache();
    _renderInvoiceModal();
}

function _batalEditInvoice() {
    window._invoiceEditMode  = false;
    window._invoiceEditItems = null;
    _renderInvoiceModal();
}

function _htmlInvoiceEditItem(item, idx) {
    const sub = Number(item.jumlah) * Number(item.harga_satuan);
    const katColor = {'Pemeriksaan':'#3b82f6','Laboratorium':'#7c3aed','Obat':'#059669','Administrasi':'#d97706','Tindakan':'#dc2626'}[item.kategori] || '#64748b';
    return `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:9px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:12px;color:var(--primary-dark);">${escHtml(item.nama_item)}</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:3px;">
                <span style="font-size:9.5px;background:${katColor}18;color:${katColor};padding:1px 6px;border-radius:10px;font-weight:700;">${escHtml(item.kategori)}</span>
                <span style="font-size:10.5px;color:var(--text-muted);">Rp ${_fmtRp(item.harga_satuan)}/item</span>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            <input type="number" value="${item.jumlah}" min="1"
                style="width:42px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;text-align:center;"
                onchange="_updateInvoiceEditItem(${idx},'jumlah',this.value)">
            <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:72px;text-align:right;">Rp ${_fmtRp(sub)}</div>
            <button onclick="_hapusInvoiceEditItem(${idx})" style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0;line-height:1;">✕</button>
        </div>
    </div>`;
}

function _updateInvoiceEditItem(idx, field, val) {
    if (!window._invoiceEditItems?.[idx]) return;
    window._invoiceEditItems[idx][field] = Number(val) || 1;
    _renderInvoiceModal();
}

function _hapusInvoiceEditItem(idx) {
    if (!window._invoiceEditItems) return;
    window._invoiceEditItems.splice(idx, 1);
    _renderInvoiceModal();
}

function _addItemInvoiceEdit() {
    const KAT_ICON = {'Pemeriksaan':'🩺','Laboratorium':'🔬','Obat':'💊','Administrasi':'📋','Penunjang':'🔭','Tindakan':'⚕️','Lainnya':'📌'};
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
                    <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block;">Pilih dari tarif</label>
                    <select id="selTarifInvoiceEdit" class="form-control" style="font-size:12px;" onchange="_onPilihTarifInvoiceEdit(this.value)">
                        <option value="">-- Pilih tarif --</option>
                    </select>
                </div>
                <div id="formItemInvoiceManual" style="display:none;flex-direction:column;gap:7px;">
                    <input type="text" id="inv_item_nama" class="form-control" placeholder="Nama item" style="font-size:12px;">
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
                <button onclick="_konfirmasiTambahItemInvoice()" style="flex:1;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;">✅ Tambah</button>
                <button onclick="document.getElementById('modalTambahItemInvoice').style.display='none'" style="padding:10px 14px;background:#f1f5f9;color:var(--text);border:none;border-radius:9px;font-size:12px;cursor:pointer;">Batal</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }
    // Selalu rebuild dropdown tarif
    const sel = document.getElementById('selTarifInvoiceEdit');
    if (sel) {
        sel.innerHTML = `<option value="">-- Pilih tarif --</option>
            ${(window._tarifCache || []).filter(t => t.aktif).map(t =>
                `<option value="${t.id}">${escHtml(t.nama)} · Rp ${_fmtRp(t.harga)} (${escHtml(t.kategori)})</option>`
            ).join('')}
            <option value="__manual__">✏️ Input manual</option>`;
        sel.value = '';
    }
    const frm = document.getElementById('formItemInvoiceManual');
    if (frm) frm.style.display = 'none';
    const qty = document.getElementById('inv_item_qty');
    if (qty) qty.value = '1';
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
        const kat   = document.getElementById('inv_item_kat')?.value  || 'Lainnya';
        const harga = Number(document.getElementById('inv_item_harga')?.value) || 0;
        if (!nama) return showToast('⚠️ Nama item wajib diisi', 'error');
        item = { nama_item: nama, kategori: kat, jumlah: qty, harga_satuan: harga, keterangan: null };
    } else {
        const t = (window._tarifCache || []).find(x => String(x.id) === String(selVal));
        if (!t) return;
        item = { nama_item: t.nama, kategori: t.kategori, jumlah: qty, harga_satuan: t.harga, keterangan: null };
    }
    if (!window._invoiceEditItems) window._invoiceEditItems = [];
    window._invoiceEditItems.push(item);
    document.getElementById('modalTambahItemInvoice').style.display = 'none';
    _renderInvoiceModal();
}

async function _simpanEditInvoice() {
    const tagihan = window._invoiceData;
    if (!tagihan?.kunjungan_id) return showToast('⚠️ Data tagihan tidak valid', 'error');
    const items   = window._invoiceEditItems || [];
    const diskon  = Number(window._invoiceEditDiskon) || 0;
    const catatan = window._invoiceEditCatatan ?? (document.getElementById('inp_edit_catatan')?.value || '');
    try {
        const result = await sb_saveTagihan(tagihan.kunjungan_id, tagihan.pasien_id, items, diskon, catatan);
        showToast(`✅ Invoice diperbarui · Rp ${_fmtRp(result.total)}`, 'success');
        const tagihanBaru = await sb_getTagihan(tagihan.kunjungan_id);
        window._invoiceData    = tagihanBaru || tagihan;
        window._invoiceEditMode = false;
        _renderInvoiceModal();
    } catch(e) {
        showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
    }
}

async function _simpanDanPrintEditInvoice() {
    await _simpanEditInvoice();
    setTimeout(() => {
        if (window._invoiceData && !window._invoiceEditMode) {
            printInvoice(window._invoiceData, window._invoiceNama, window._invoiceTgl);
        }
    }, 500);
}

function _printInvoiceFromWindow() {
    if (!window._invoiceData) return showToast('⚠️ Data invoice tidak tersedia', 'error');
    printInvoice(window._invoiceData, window._invoiceNama || '', window._invoiceTgl || '');
}

// ════════════════════════════════════════
//  PRINT INVOICE PROFESIONAL (A4)
// ════════════════════════════════════════
function printInvoice(tagihan, pasienNama, tgl) {
    const s          = window._settingsFull || {};
    const klinikNama = window.KLINIK_NAMA || 'Klinik';
    const logoUrl    = s.klinik_logo    || '';
    const noInvoice  = 'INV-' + String(tagihan.id || '').substring(0, 8).toUpperCase();
    const tglCetak   = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    const tglInvoice = tgl ? formatTglIndo(tgl) : tglCetak;
    const subtotal   = Number(tagihan.subtotal || 0);
    const diskon     = Number(tagihan.diskon   || 0);
    const total      = Number(tagihan.total    || subtotal - diskon);
    const lunas      = (tagihan.status || '').toLowerCase() === 'lunas' || !!tagihan.status_bayar;
    const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(noInvoice)}&size=80x80&margin=2`;

    function _terbilang(n) {
        const sat = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
        if (n === 0) return 'nol';
        if (n < 12)  return sat[n];
        if (n < 20)  return sat[n-10] + ' belas';
        if (n < 100) return sat[Math.floor(n/10)] + ' puluh' + (n%10 ? ' '+sat[n%10] : '');
        if (n < 200) return 'seratus' + (n%100 ? ' '+_terbilang(n%100) : '');
        if (n < 1000)return sat[Math.floor(n/100)] + ' ratus' + (n%100 ? ' '+_terbilang(n%100) : '');
        if (n < 2000)return 'seribu' + (n%1000 ? ' '+_terbilang(n%1000) : '');
        if (n < 1e6) return _terbilang(Math.floor(n/1000)) + ' ribu' + (n%1000 ? ' '+_terbilang(n%1000) : '');
        if (n < 1e9) return _terbilang(Math.floor(n/1e6)) + ' juta' + (n%1e6 ? ' '+_terbilang(n%1e6) : '');
        return _terbilang(Math.floor(n/1e9)) + ' miliar' + (n%1e9 ? ' '+_terbilang(n%1e9) : '');
    }
    const totalTerbilang = _terbilang(total).replace(/\b\w/g, c => c.toUpperCase()) + ' Rupiah';

    const KAT_ICON = {'Pemeriksaan':'🩺','Laboratorium':'🔬','Penunjang':'🔭','Tindakan':'⚕️','Obat':'💊','Administrasi':'📋','Lainnya':'📌'};
    const KAT_ORDER = ['Pemeriksaan','Laboratorium','Penunjang','Tindakan','Obat','Administrasi','Lainnya'];
    const grouped = {};
    (tagihan.tagihan_item || []).forEach(i => {
        const k = i.kategori || 'Lainnya';
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(i);
    });
    const katUrut = [...KAT_ORDER.filter(k => grouped[k]), ...Object.keys(grouped).filter(k => !KAT_ORDER.includes(k))];
    let rowNum = 0;
    const tableBody = katUrut.map(kat => {
        const rows = grouped[kat].map(i => {
            rowNum++;
            const sub = Number(i.subtotal || (Number(i.jumlah) * Number(i.harga_satuan)));
            return `<tr><td class="row-no">${rowNum}</td><td><div class="item-nama">${escHtml(i.nama_item)}</div></td><td class="tc">${Number(i.jumlah)}</td><td class="tr">Rp ${_fmtRp(i.harga_satuan)}</td><td class="tr">Rp ${_fmtRp(sub)}</td></tr>`;
        }).join('');
        return `<tr class="kat-header"><td colspan="5"><span class="kat-icon">${KAT_ICON[kat]||'📌'}</span> ${kat}</td></tr>${rows}`;
    }).join('');

    const logoHtml = logoUrl
        ? `<img src="${escHtml(logoUrl)}" class="logo" alt="Logo">`
        : `<div class="logo-initials">${escHtml(klinikNama.substring(0,2).toUpperCase())}</div>`;

    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return showToast('⚠️ Izinkan popup untuk print invoice', 'error');

    win.document.write(`<!DOCTYPE html><html lang="id"><head>
<meta charset="utf-8">
<title>Invoice ${noInvoice}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--ink:#0f172a;--ink2:#334155;--muted:#64748b;--border:#e2e8f0;--border2:#cbd5e1;--soft:#f8fafc;--blue:#1d4ed8;--blue2:#3b82f6}
body{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--ink);background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:760px;margin:28px auto;background:#fff;border-radius:16px;box-shadow:0 6px 40px rgba(0,0,0,.12);overflow:hidden}
.accent{height:5px;background:linear-gradient(90deg,#1d4ed8,#3b82f6,#818cf8)}
.hdr{display:grid;grid-template-columns:1fr auto;gap:20px;padding:32px 40px 26px;border-bottom:1.5px solid var(--border)}
.logo{width:52px;height:52px;border-radius:10px;object-fit:contain;border:1px solid var(--border);margin-bottom:10px;display:block}
.logo-initials{width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;margin-bottom:10px}
.klinik-nama{font-size:19px;font-weight:800;letter-spacing:-.3px}
.klinik-info{font-size:11.5px;color:var(--muted);margin-top:5px;line-height:1.9}
.klinik-info span{display:block}
.hdr-right{text-align:right}
.inv-badge{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--blue);background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 10px;display:inline-block;margin-bottom:8px}
.inv-no{font-family:'DM Mono',monospace;font-size:17px;font-weight:500;letter-spacing:.5px}
.inv-dates{margin-top:8px;font-size:11.5px;color:var(--muted);line-height:1.9}
.inv-dates span{display:block}
.inv-dates strong{color:var(--ink2)}
.info-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--border)}
.info-box{padding:18px 40px}
.info-box+.info-box{border-left:1px solid var(--border)}
.lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:6px}
.val{font-size:14px;font-weight:700}
.items{padding:22px 40px 0}
table{width:100%;border-collapse:collapse}
.row-no{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);width:28px;padding:10px 8px}
thead th{padding:9px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);background:var(--soft);border-bottom:1px solid var(--border)}
thead th.tc{text-align:center} thead th.tr{text-align:right}
tbody td{padding:10px;font-size:12.5px;color:var(--ink2);vertical-align:middle}
tbody td.tc{text-align:center} tbody td.tr{text-align:right;font-weight:600;color:var(--ink)}
.item-nama{font-weight:700;color:var(--ink);font-size:13px}
tr.kat-header td{padding:8px 10px 5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);background:var(--soft);border-top:2px solid var(--border2);border-bottom:1px solid var(--border)}
tr.kat-header:first-child td{border-top:none}
tbody tr:not(.kat-header){border-bottom:1px solid var(--border)}
.tbl-wrap{position:relative}
.lunas-stamp{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:72px;font-weight:900;letter-spacing:4px;color:rgba(22,163,74,.09);border:6px solid rgba(22,163,74,.09);padding:8px 24px;border-radius:8px;pointer-events:none;white-space:nowrap}
.summary{display:grid;grid-template-columns:1fr 280px;padding:22px 40px;border-top:1px solid var(--border);align-items:start}
.terbilang-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px}
.terbilang-txt{font-size:12px;color:var(--ink2);font-style:italic;line-height:1.5;border-left:3px solid var(--blue2);padding-left:10px}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;color:var(--muted)}
.sum-row .sv{font-weight:600;color:var(--ink2)}
.sum-row.dk .sv{color:#dc2626}
.sum-row.tot{border-top:2px solid var(--ink);margin-top:8px;padding-top:12px;font-size:15px;font-weight:800;color:var(--ink)}
.sum-row.tot .sv{font-size:18px;color:var(--blue)}
.ftr{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;padding:18px 40px 26px;border-top:1px solid var(--border);background:var(--soft)}
.ftr-note{font-size:11.5px;color:var(--muted);line-height:1.7}
.ftr-cetak{font-size:11px;color:var(--muted);margin-top:4px;font-style:italic}
.qr-col{text-align:center}
.qr-col img{border:1px solid var(--border);border-radius:8px;display:block}
.qr-cap{font-size:9.5px;color:var(--muted);margin-top:3px;font-family:'DM Mono',monospace}
.ttd-space{flex:1;min-height:60px;border-bottom:1.5px solid var(--ink2);margin-top:8px;margin-right:24px}
.no-print{text-align:center;padding:18px}
.no-print button{padding:11px 32px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin:0 4px}
.no-print button.sec{background:#f1f5f9;color:var(--ink2)}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;border-radius:0;max-width:100%}.no-print{display:none}@page{margin:8mm;size:A4}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="hdr">
    <div>${logoHtml}
      <div class="klinik-nama">${escHtml(klinikNama)}</div>
      <div class="klinik-info">
        ${s.klinik_alamat ? `<span>📍 ${escHtml(s.klinik_alamat)}</span>` : ''}
        ${s.klinik_telp   ? `<span>📞 ${escHtml(s.klinik_telp)}</span>`   : ''}
        ${s.klinik_email  ? `<span>✉️ ${escHtml(s.klinik_email)}</span>`  : ''}
        ${s.dokter_nama   ? `<span>👨‍⚕️ ${escHtml(s.dokter_nama)}</span>`: ''}
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
  <div class="info-row">
    <div class="info-box">
      <div class="lbl">Tagihan Kepada</div>
      <div class="val">${escHtml(pasienNama)}</div>
    </div>
    <div class="info-box" style="display:flex;flex-direction:column;">
      <div class="lbl">Tanda Tangan &amp; Cap Praktek</div>
      <div class="ttd-space"></div>
    </div>
  </div>
  <div class="items">
    <div class="tbl-wrap">
      ${lunas ? '<div class="lunas-stamp">LUNAS</div>' : ''}
      <table>
        <thead><tr><th class="row-no">#</th><th>Layanan / Item</th><th class="tc">Qty</th><th class="tr">Harga Satuan</th><th class="tr">Total</th></tr></thead>
        <tbody>${tableBody}</tbody>
      </table>
    </div>
  </div>
  <div class="summary">
    <div>
      <div class="terbilang-lbl">Terbilang</div>
      <div class="terbilang-txt">${totalTerbilang}</div>
    </div>
    <div>
      <div class="sum-row"><span>Subtotal</span><span class="sv">Rp ${_fmtRp(subtotal)}</span></div>
      ${diskon > 0 ? `<div class="sum-row dk"><span>Diskon</span><span class="sv">– Rp ${_fmtRp(diskon)}</span></div>` : ''}
      <div class="sum-row tot"><span>TOTAL</span><span class="sv">Rp ${_fmtRp(total)}</span></div>
    </div>
  </div>
  <div class="ftr">
    <div>
      <div class="ftr-note">Terima kasih atas kepercayaan Anda kepada ${escHtml(klinikNama)}.</div>
      <div class="ftr-cetak">Dicetak pada ${tglCetak}</div>
    </div>
    <div class="qr-col">
      <img src="${qrUrl}" width="80" height="80" alt="QR">
      <div class="qr-cap">${noInvoice}</div>
    </div>
  </div>
</div>
<div class="no-print">
  <button onclick="window.print()">🖨️ Cetak Invoice</button>
  <button class="sec" onclick="window.close()">Tutup</button>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`);
    win.document.close();
}
