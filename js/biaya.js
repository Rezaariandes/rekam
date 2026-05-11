// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PEMBIAYAAN (biaya.js)
//  • Manajemen tarif layanan (4 level: Kategori→Sub→Sub-Sub→Nama)
//  • Tambah tarif baru via modal lengkap
//  • Auto-generate & simpan tagihan dari kunjungan
//  • Modal tagihan (muncul setelah simpan rekam medis)
//  • Alias openModalTagihan → untuk dipanggil dari kunjungan.js
//  • _viewInvoiceFromModal → untuk dipanggil dari modal-riwayat.html
//
//  Struktur DB tarif_layanan:
//  id, kategori, sub_group, sub_sub_group, nama, harga, keterangan,
//  aktif, sub_group_order, created_at
//
//  Fungsi invoice (lihat, edit, print) → invoice.js
// ════════════════════════════════════════════════════════

// ── State ──
if (typeof window._tarifCache     === 'undefined') window._tarifCache     = [];
if (typeof window._accordionState === 'undefined') window._accordionState = {};
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

const KATEGORI_LIST = ['Administrasi','Laboratorium','Pemeriksaan','Penunjang','Tindakan','Obat','Lainnya'];

// ════════════════════════════════════════
//  INIT HALAMAN TARIF
// ════════════════════════════════════════
async function initPageBiaya() {
    await _refreshTarifCache();
    renderDaftarTarif();
}

async function _refreshTarifCache() {
    try {
        const data = await _sbFetch(
            'tarif_layanan?select=*&order=kategori.asc,sub_group.asc,sub_sub_group.asc,nama.asc'
        );
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
//  RENDER DAFTAR TARIF
// ════════════════════════════════════════
function renderDaftarTarif() {
    const container = document.getElementById('daftarTarif');
    const tabsEl    = document.getElementById('biayaKategoriTabs');

    if (!container) { console.error('[biaya] ❌ #daftarTarif tidak ditemukan.'); return; }

    const categories = [...new Set(window._tarifCache.map(t => t.kategori))].sort();

    // ── Tabs kategori ──
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

    // ── Tombol aksi massal + Tambah Tarif ──
    let bulkEl = document.getElementById('_biayaBulkActions');
    if (!bulkEl) {
        bulkEl = document.createElement('div');
        bulkEl.id = '_biayaBulkActions';
        container.parentElement.insertBefore(bulkEl, container);
    }
    bulkEl.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center;';
    bulkEl.innerHTML = `
        <button onclick="openTambahTarif()"
            style="padding:6px 14px;border:1.5px solid var(--primary);border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:var(--primary);color:#fff;white-space:nowrap;display:flex;align-items:center;gap:4px;">
            ➕ Tambah Tarif Baru
        </button>
        <button onclick="bulkToggleTarif(true)"
            style="padding:5px 14px;border:1.5px solid #22c55e;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:#f0fdf4;color:#16a34a;white-space:nowrap">
            ✅ Aktifkan semua ${_activeKatTab ? '"' + _activeKatTab + '"' : ''}
        </button>
        <button onclick="bulkToggleTarif(false)"
            style="padding:5px 14px;border:1.5px solid #e2e8f0;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:#f8fafc;color:#94a3b8;white-space:nowrap">
            ⛔ Nonaktifkan semua ${_activeKatTab ? '"' + _activeKatTab + '"' : ''}
        </button>`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:#94a3b8;">
                <div style="font-size:36px;margin-bottom:10px;">🗂️</div>
                <div style="font-size:13px;font-weight:600;">Belum ada tarif di database</div>
                <div style="font-size:11px;margin-top:4px;">Klik <b>➕ Tambah Tarif Baru</b> di atas untuk mulai</div>
            </div>`;
        return;
    }

    if (_activeKatTab) {
        container.innerHTML = _renderAccordionByKategori(_activeKatTab, filtered);
    } else {
        container.innerHTML = _renderAccordionSemua(filtered);
    }
}

// ─── Render accordion: Tab "Semua" ─────────────────────
function _renderAccordionSemua(filtered) {
    const byKat = {};
    filtered.forEach(t => {
        if (!byKat[t.kategori]) byKat[t.kategori] = [];
        byKat[t.kategori].push(t);
    });
    return Object.keys(byKat).sort().map(kat => {
        const groupId    = 'grp_all_' + kat;
        const isOpen     = window._accordionState[groupId] === true;
        const count      = byKat[kat].length;
        const aktifCount = byKat[kat].filter(t => t.aktif).length;
        return _accordionShell({
            groupId, label: `${KAT_ICON[kat] || ''} ${kat}`,
            count, aktifCount, isOpen,
            bodyHtml: byKat[kat].map(t => _renderTarifRow(t, true)).join('')
        });
    }).join('');
}

// ─── Render accordion: Tab kategori tertentu — 4 level ─
function _renderAccordionByKategori(kat, filtered) {
    // Level 1: sub_group
    const subGroupMap = {};
    const noGroup     = [];

    filtered.forEach(t => {
        const sg = (t.sub_group || '').trim();
        if (sg) {
            if (!subGroupMap[sg]) subGroupMap[sg] = [];
            subGroupMap[sg].push(t);
        } else {
            noGroup.push(t);
        }
    });

    let html = '';

    Object.keys(subGroupMap).sort().forEach(sg => {
        const items   = subGroupMap[sg];
        const groupId = 'sg_' + kat + '_' + sg.replace(/\W+/g, '_');
        const isOpen  = window._accordionState[groupId] === true;
        const aktifCount = items.filter(t => t.aktif).length;

        // Level 2: sub_sub_group di dalam sg
        const ssgMap  = {};
        const noSsg   = [];
        items.forEach(t => {
            const ssg = (t.sub_sub_group || '').trim();
            if (ssg) {
                if (!ssgMap[ssg]) ssgMap[ssg] = [];
                ssgMap[ssg].push(t);
            } else {
                noSsg.push(t);
            }
        });

        const hasSsg = Object.keys(ssgMap).length > 0;
        let bodyHtml = '';

        if (hasSsg) {
            // Render sub_sub_group sebagai inner accordion
            Object.keys(ssgMap).sort().forEach(ssg => {
                const ssgItems   = ssgMap[ssg];
                const ssgGroupId = 'ssg_' + kat + '_' + sg.replace(/\W+/g,'_') + '_' + ssg.replace(/\W+/g,'_');
                const ssgOpen    = window._accordionState[ssgGroupId] === true;
                const ssgAktif   = ssgItems.filter(t => t.aktif).length;
                bodyHtml += _accordionShellInner({
                    groupId: ssgGroupId, label: ssg,
                    count: ssgItems.length, aktifCount: ssgAktif, isOpen: ssgOpen,
                    bodyHtml: ssgItems.map(t => _renderTarifRow(t)).join('')
                });
            });
            if (noSsg.length > 0) {
                bodyHtml += noSsg.map(t => _renderTarifRow(t)).join('');
            }
        } else {
            bodyHtml = items.map(t => _renderTarifRow(t)).join('');
        }

        html += _accordionShell({
            groupId, label: sg,
            count: items.length, aktifCount, isOpen, bodyHtml
        });
    });

    if (noGroup.length > 0) {
        const groupId    = kat + '_tanpa_grup';
        const isOpen     = window._accordionState[groupId] === true;
        const aktifCount = noGroup.filter(t => t.aktif).length;
        html += _accordionShell({
            groupId, label: '📌 Lainnya / Tanpa Kelompok',
            count: noGroup.length, aktifCount, isOpen,
            bodyHtml: noGroup.map(t => _renderTarifRow(t)).join('')
        });
    }

    if (!html) {
        html = `<p style="text-align:center;color:#94a3b8;padding:32px 0">Belum ada tarif untuk kategori ini</p>`;
    }

    return html;
}

// ─── Shell HTML accordion utama ─────────────────────────
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
                   border:none;cursor:pointer;text-align:left;">
            <span style="font-size:13px;font-weight:700;color:var(--primary-dark);flex:1;">${label}</span>
            ${badgeAktif}${badgeNon}
            <span style="font-size:10px;color:#94a3b8;font-weight:600;">${count} item</span>
            <span style="font-size:14px;color:#94a3b8;transform:rotate(${isOpen ? '90' : '0'}deg);transition:transform .2s;">▶</span>
        </button>
        <div id="acc_body_${groupId}" style="display:${isOpen ? 'block' : 'none'};padding:0 14px 6px;">
            ${bodyHtml}
        </div>
    </div>`;
}

// ─── Shell HTML accordion dalam (sub_sub_group) ──────────
function _accordionShellInner({ groupId, label, count, aktifCount, isOpen, bodyHtml }) {
    return `
    <div style="border:1px solid #e8edf5;border-radius:9px;margin:6px 0;overflow:hidden;">
        <button onclick="_toggleAccordion('${groupId}')"
            style="width:100%;display:flex;align-items:center;gap:6px;padding:7px 10px;
                   background:${isOpen ? 'rgba(99,102,241,0.04)' : '#f8fafc'};
                   border:none;cursor:pointer;text-align:left;">
            <span style="font-size:11.5px;font-weight:700;color:#4338ca;flex:1;">📂 ${label}</span>
            <span style="font-size:9px;color:#94a3b8;">${aktifCount}/${count} aktif</span>
            <span style="font-size:12px;color:#94a3b8;transform:rotate(${isOpen ? '90' : '0'}deg);transition:transform .2s;">▶</span>
        </button>
        <div id="acc_body_${groupId}" style="display:${isOpen ? 'block' : 'none'};padding:0 8px 4px 8px;background:#fff;">
            ${bodyHtml}
        </div>
    </div>`;
}

function _toggleAccordion(groupId) {
    const body = document.getElementById('acc_body_' + groupId);
    if (!body) return;
    const nowOpen = body.style.display === 'none';
    window._accordionState[groupId] = nowOpen;
    body.style.display = nowOpen ? 'block' : 'none';
    const btn   = body.previousElementSibling;
    if (btn) {
        const arrow = btn.querySelector('span:last-child');
        if (arrow) arrow.style.transform = `rotate(${nowOpen ? '90' : '0'}deg)`;
        btn.style.background = nowOpen
            ? (btn.parentElement.style.border.includes('1.5px')
                ? 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))'
                : 'rgba(99,102,241,0.04)')
            : (btn.parentElement.style.border.includes('1.5px') ? '#fafbfc' : '#f8fafc');
    }
}

// ─── Render satu baris tarif ─────────────────────────────
function _renderTarifRow(t, showKat = false) {
    const ssgBadge = t.sub_sub_group
        ? `<span style="font-size:9px;color:#7c3aed;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:1px 5px;margin-left:3px;">${t.sub_sub_group}</span>`
        : '';
    const subGroupBadge = (showKat && t.sub_group)
        ? `<span style="font-size:9px;color:#6366f1;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:1px 6px;margin-left:4px;">${t.sub_group}</span>`
        : '';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;${!t.aktif ? 'color:#94a3b8;' : ''}">${t.nama}${subGroupBadge}${ssgBadge}</div>
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
        <button onclick="_confirmHapusTarif('${t.id}')"
            style="padding:4px 8px;border:1px solid #fca5a5;border-radius:8px;color:#ef4444;font-size:11px;cursor:pointer;background:#fff">
            🗑️
        </button>
    </div>`;
}

function _setBiayaTab(kat) {
    _activeKatTab = kat;
    renderDaftarTarif();
}

// ════════════════════════════════════════
//  HELPER: opsi dropdown untuk sub_group & sub_sub_group
// ════════════════════════════════════════
function _getSubGroupOptions(kat, currentVal) {
    const existing = [...new Set(
        window._tarifCache
            .filter(x => x.kategori === kat && x.sub_group)
            .map(x => x.sub_group.trim())
    )].sort();
    return existing.map(sg =>
        `<option value="${sg}" ${sg === (currentVal || '') ? 'selected' : ''}>${sg}</option>`
    ).join('');
}

function _getSubSubGroupOptions(kat, sg, currentVal) {
    if (!sg) return '';
    const existing = [...new Set(
        window._tarifCache
            .filter(x => x.kategori === kat && x.sub_group === sg && x.sub_sub_group)
            .map(x => x.sub_sub_group.trim())
    )].sort();
    return existing.map(ssg =>
        `<option value="${ssg}" ${ssg === (currentVal || '') ? 'selected' : ''}>${ssg}</option>`
    ).join('');
}

// ════════════════════════════════════════
//  MODAL TAMBAH TARIF BARU (4 level)
// ════════════════════════════════════════
function openTambahTarif() {
    _openTarifModal(null);
}

function openEditTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    if (t) _openTarifModal(t);
}

function _openTarifModal(tarif) {
    const isEdit    = !!tarif;
    const kat0      = tarif ? tarif.kategori : (KATEGORI_LIST[0]);
    const subOpts   = _getSubGroupOptions(kat0, tarif?.sub_group);
    const ssgOpts   = _getSubSubGroupOptions(kat0, tarif?.sub_group, tarif?.sub_sub_group);

    document.getElementById('_tarifModal')?.remove();
    const modal = document.createElement('div');
    modal.id = '_tarifModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:0;width:380px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,var(--primary,#4f46e5),#7c3aed);padding:16px 20px;color:#fff;">
                <div style="font-size:15px;font-weight:800;">${isEdit ? '✏️ Edit Tarif' : '➕ Tambah Tarif Baru'}</div>
                <div style="font-size:11px;opacity:.8;margin-top:2px;">Isi 4 level hierarki tarif layanan</div>
            </div>

            <div style="padding:18px 20px;">

                <!-- Level 1: Kategori -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">
                        📂 Level 1: Kategori <span style="color:#ef4444;">*</span>
                    </label>
                    <select id="_tf_kat"
                        onchange="_onKatChangeTarif(this.value)"
                        style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box;">
                        ${KATEGORI_LIST.map(k => `<option value="${k}" ${k === kat0 ? 'selected' : ''}>${KAT_ICON[k]||''} ${k}</option>`).join('')}
                    </select>
                </div>

                <!-- Level 2: Sub Kelompok -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">
                        📁 Level 2: Sub Kelompok
                        <span style="font-weight:400;color:#94a3b8;font-size:10px;"> — pengelompokan utama dalam kategori</span>
                    </label>
                    <select id="_tf_sub_select"
                        onchange="_onSubSelectChange(this.value)"
                        style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box;margin-bottom:4px;">
                        <option value="">— Tanpa sub kelompok —</option>
                        ${subOpts}
                        <option value="__new__">✏️ Ketik sub kelompok baru...</option>
                    </select>
                    <input id="_tf_sub_new" type="text" placeholder="Nama sub kelompok baru (mis: 🩸 Darah Rutin)"
                        style="width:100%;padding:8px;border:1.5px solid #6366f1;border-radius:8px;font-size:13px;display:none;box-sizing:border-box;"
                        oninput="_onSubNewInput(this.value)">
                </div>

                <!-- Level 3: Sub-Sub Kelompok -->
                <div style="margin-bottom:12px;" id="_tf_ssg_wrap">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">
                        📄 Level 3: Sub-Sub Kelompok
                        <span style="font-weight:400;color:#94a3b8;font-size:10px;"> — pengelompokan lebih spesifik (opsional)</span>
                    </label>
                    <select id="_tf_ssg_select"
                        onchange="_onSsgSelectChange(this.value)"
                        style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box;margin-bottom:4px;">
                        <option value="">— Tanpa sub-sub kelompok —</option>
                        ${ssgOpts}
                        <option value="__new__">✏️ Ketik sub-sub kelompok baru...</option>
                    </select>
                    <input id="_tf_ssg_new" type="text" placeholder="Nama sub-sub kelompok baru"
                        style="width:100%;padding:8px;border:1.5px solid #7c3aed;border-radius:8px;font-size:13px;display:none;box-sizing:border-box;">
                </div>

                <!-- Level 4: Nama Item -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">
                        🏷️ Level 4: Nama Item / Layanan <span style="color:#ef4444;">*</span>
                    </label>
                    <input id="_tf_nama" type="text" value="${tarif ? tarif.nama : ''}" placeholder="Contoh: Pemeriksaan Darah Lengkap"
                        style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
                </div>

                <!-- Harga -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">💰 Harga (Rp) <span style="color:#ef4444;">*</span></label>
                    <input id="_tf_harga" type="number" value="${tarif ? tarif.harga : ''}" placeholder="0" min="0"
                        style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
                </div>

                <!-- Keterangan -->
                <div style="margin-bottom:16px;">
                    <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">📝 Keterangan (opsional)</label>
                    <input id="_tf_ket" type="text" value="${tarif ? (tarif.keterangan || '') : ''}" placeholder="Deskripsi singkat tarif ini"
                        style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
                </div>

                <!-- Tombol -->
                <div style="display:flex;gap:8px;">
                    <button onclick="document.getElementById('_tarifModal').remove()"
                        style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;cursor:pointer;background:#fff;font-weight:600;">
                        Batal
                    </button>
                    <button onclick="_saveTarifFromModal('${tarif ? tarif.id : ''}')"
                        style="flex:2;padding:10px;border:none;border-radius:10px;font-size:13px;cursor:pointer;background:var(--primary,#4f46e5);color:#fff;font-weight:700;">
                        💾 ${isEdit ? 'Simpan Perubahan' : 'Tambah Tarif'}
                    </button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    // Set nilai awal dropdown sub & ssg jika edit
    if (tarif) {
        const subSel = document.getElementById('_tf_sub_select');
        const ssgSel = document.getElementById('_tf_ssg_select');
        if (subSel && tarif.sub_group) {
            const found = [...subSel.options].some(o => o.value === tarif.sub_group);
            if (found) {
                subSel.value = tarif.sub_group;
            } else {
                subSel.value = '__new__';
                const inp = document.getElementById('_tf_sub_new');
                if (inp) { inp.style.display = 'block'; inp.value = tarif.sub_group; }
            }
        }
        if (ssgSel && tarif.sub_sub_group) {
            const found = [...ssgSel.options].some(o => o.value === tarif.sub_sub_group);
            if (found) {
                ssgSel.value = tarif.sub_sub_group;
            } else {
                ssgSel.value = '__new__';
                const inp = document.getElementById('_tf_ssg_new');
                if (inp) { inp.style.display = 'block'; inp.value = tarif.sub_sub_group; }
            }
        }
    }
}

// ── Event handlers dropdown tarif modal ──
function _onKatChangeTarif(kat) {
    // Rebuild sub_group options
    const subSel = document.getElementById('_tf_sub_select');
    if (subSel) {
        subSel.innerHTML = `<option value="">— Tanpa sub kelompok —</option>
            ${_getSubGroupOptions(kat, '')}
            <option value="__new__">✏️ Ketik sub kelompok baru...</option>`;
        subSel.value = '';
    }
    const subNew = document.getElementById('_tf_sub_new');
    if (subNew) { subNew.style.display = 'none'; subNew.value = ''; }
    // Reset ssg
    _rebuildSsgDropdown(kat, '');
}

function _onSubSelectChange(val) {
    const inp = document.getElementById('_tf_sub_new');
    if (inp) {
        inp.style.display = val === '__new__' ? 'block' : 'none';
        if (val !== '__new__') inp.value = '';
    }
    // Rebuild ssg
    const kat = document.getElementById('_tf_kat')?.value || '';
    const sg  = val === '__new__' ? '' : val;
    _rebuildSsgDropdown(kat, sg);
}

function _onSubNewInput(val) {
    const kat = document.getElementById('_tf_kat')?.value || '';
    _rebuildSsgDropdown(kat, val);
}

function _onSsgSelectChange(val) {
    const inp = document.getElementById('_tf_ssg_new');
    if (inp) {
        inp.style.display = val === '__new__' ? 'block' : 'none';
        if (val !== '__new__') inp.value = '';
    }
}

function _rebuildSsgDropdown(kat, sg) {
    const ssgSel = document.getElementById('_tf_ssg_select');
    if (!ssgSel) return;
    const opts = _getSubSubGroupOptions(kat, sg, '');
    ssgSel.innerHTML = `<option value="">— Tanpa sub-sub kelompok —</option>
        ${opts}
        <option value="__new__">✏️ Ketik sub-sub kelompok baru...</option>`;
    ssgSel.value = '';
    const inp = document.getElementById('_tf_ssg_new');
    if (inp) { inp.style.display = 'none'; inp.value = ''; }
}

async function _saveTarifFromModal(id) {
    const nama  = (document.getElementById('_tf_nama')?.value  || '').trim();
    const kat   = document.getElementById('_tf_kat')?.value    || KATEGORI_LIST[0];
    const harga = document.getElementById('_tf_harga')?.value  || '0';
    const ket   = (document.getElementById('_tf_ket')?.value   || '').trim() || null;

    // sub_group
    const subSel = document.getElementById('_tf_sub_select')?.value || '';
    let sub_group = null;
    if (subSel === '__new__') {
        sub_group = (document.getElementById('_tf_sub_new')?.value || '').trim() || null;
    } else {
        sub_group = subSel || null;
    }

    // sub_sub_group
    const ssgSel = document.getElementById('_tf_ssg_select')?.value || '';
    let sub_sub_group = null;
    if (ssgSel === '__new__') {
        sub_sub_group = (document.getElementById('_tf_ssg_new')?.value || '').trim() || null;
    } else {
        sub_sub_group = ssgSel || null;
    }

    if (!nama) return showToast('❌ Nama layanan (Level 4) wajib diisi', 'error');
    if (Number(harga) < 0) return showToast('❌ Harga tidak boleh negatif', 'error');

    // Untuk edit, pertahankan aktif existing
    const existing = id ? window._tarifCache.find(x => String(x.id) === String(id)) : null;
    const aktif    = existing ? existing.aktif : true;

    try {
        await sb_saveTarif({
            id: id || undefined,
            nama, kategori: kat,
            harga: Number(harga) || 0,
            keterangan: ket,
            aktif, sub_group, sub_sub_group
        });
        document.getElementById('_tarifModal')?.remove();
        showToast(id ? '✅ Tarif berhasil diperbarui' : '✅ Tarif baru berhasil ditambahkan', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        console.error('[biaya] ❌ Gagal simpan tarif:', e);
        showToast('❌ Gagal menyimpan tarif: ' + (e.message || e), 'error');
    }
}

// ════════════════════════════════════════
//  HAPUS TARIF
// ════════════════════════════════════════
async function _confirmHapusTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    if (!t) return;
    if (!confirm(`Hapus tarif "${t.nama}"?\nTindakan ini tidak bisa dibatalkan.`)) return;
    try {
        await sb_deleteTarif(id);
        showToast('✅ Tarif berhasil dihapus', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        showToast('❌ Gagal menghapus tarif: ' + (e.message || ''), 'error');
    }
}

// ════════════════════════════════════════
//  TOGGLE AKTIF & BULK
// ════════════════════════════════════════
async function toggleAktifTarif(id, aktifBaru) {
    try {
        const t = window._tarifCache.find(x => String(x.id) === String(id));
        if (!t) return;
        await sb_saveTarif({
            id, nama: t.nama, kategori: t.kategori, harga: t.harga,
            keterangan: t.keterangan, aktif: aktifBaru,
            sub_group: t.sub_group || null, sub_sub_group: t.sub_sub_group || null
        });
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
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
            sb_saveTarif({
                id: t.id, nama: t.nama, kategori: t.kategori, harga: t.harga,
                keterangan: t.keterangan, aktif: aktifBaru,
                sub_group: t.sub_group || null, sub_sub_group: t.sub_sub_group || null
            })
        ));
        await _refreshTarifCache();
        renderDaftarTarif();
        const label = _activeKatTab ? `"${_activeKatTab}"` : 'semua';
        showToast(`✅ ${perlu.length} layanan ${label} berhasil di${aktifBaru ? 'aktifkan' : 'nonaktifkan'}`, 'success');
    } catch(e) {
        showToast('❌ Gagal mengubah status massal', 'error');
    }
}


// ════════════════════════════════════════
//  MODAL TAGIHAN (setelah simpan rekam medis)
//  openModalTagihan = alias dari showTagihanModal
//  Dipanggil oleh kunjungan.js → saveAll()
// ════════════════════════════════════════
async function openModalTagihan(kunjunganId, pasienId, pasienNama, tgl, kunjunganData) {
    if (!window._biayaAktif) return;

    // Simpan konteks untuk invoice dari modal riwayat
    window._lastTagihanKunjId    = kunjunganId;
    window._lastTagihanPasienNama = pasienNama || '';
    window._lastTagihanTgl        = tgl         || '';

    let items = [];
    try {
        items = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData || {});
    } catch(e) {
        console.warn('[biaya] ⚠️ Gagal generate tagihan otomatis:', e.message);
    }

    _renderTagihanModal(kunjunganId, pasienId, items);
}

/** Alias agar compatible dengan pemanggil lama */
async function showTagihanModal(kunjunganId, pasienId, kunjunganData) {
    await openModalTagihan(kunjunganId, pasienId, '', '', kunjunganData);
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

// ════════════════════════════════════════
//  _viewInvoiceFromModal
//  Dipanggil oleh tombol "Lihat & Print Invoice" di modal-riwayat.html
//  Konteks: currentRiwayat[idx] harus tersedia di window scope
// ════════════════════════════════════════
function _viewInvoiceFromModal() {
    // Coba ambil data dari state modal riwayat (modal.js menyimpannya)
    const kunjId = window._modalRiwayatKunjId || window._currentModalKunjId || null;
    const nama   = window._modalRiwayatNama   || window._currentModalNama   ||
                   (typeof currentRiwayat !== 'undefined' && window._modalRiwayatIdx != null
                       ? (currentRiwayat[window._modalRiwayatIdx]?.namaPasien || '')
                       : '');
    const tgl    = window._modalRiwayatTgl    || window._currentModalTgl    || '';

    if (!kunjId) {
        showToast('⚠️ ID kunjungan tidak tersedia', 'error');
        return;
    }
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kunjId, nama, tgl);
    } else {
        showToast('⚠️ Modul invoice belum dimuat', 'warning');
    }
}
