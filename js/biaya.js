// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PEMBIAYAAN (biaya.js)
//  • Manajemen tarif layanan (data dari database)
//  • Sub-group dibaca dari kolom `sub_group` di tarif_layanan
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
if (typeof window._tarifCache    === 'undefined') window._tarifCache    = [];
if (typeof window._accordionState=== 'undefined') window._accordionState = {};
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

// ════════════════════════════════════════
//  INIT HALAMAN TARIF
// ════════════════════════════════════════
async function initPageBiaya() {
    await _refreshTarifCache();
    renderDaftarTarif();
}

async function _refreshTarifCache() {
    try {
        const data = await _sbFetch('tarif_layanan?select=*&order=kategori.asc,sub_group.asc,nama.asc');
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

    console.log('[biaya] renderDaftarTarif() dipanggil, cache:', window._tarifCache?.length ?? 'undefined');

    if (!container) {
        console.error('[biaya] ❌ Elemen #daftarTarif tidak ditemukan.');
        return;
    }

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

    // ── Tombol aksi massal ──
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

    if (_activeKatTab) {
        container.innerHTML = _renderAccordionByKategori(_activeKatTab, filtered);
    } else {
        container.innerHTML = _renderAccordionSemua(filtered);
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
        const groupId    = 'grp_all_' + kat;
        const isOpen     = window._accordionState[groupId] === true; // default TERTUTUP
        const count      = byKat[kat].length;
        const aktifCount = byKat[kat].filter(t => t.aktif).length;
        return _accordionShell({
            groupId, label: `${KAT_ICON[kat] || ''} ${kat}`,
            count, aktifCount, isOpen,
            bodyHtml: byKat[kat].map(t => _renderTarifRow(t, true)).join('')
        });
    }).join('');
}

// ─── Render accordion: Tab kategori tertentu — sub-group dari DB ─
function _renderAccordionByKategori(kat, filtered) {
    // Kumpulkan sub_group unik dari DB, urut alfabet
    const subGroupMap = {};   // sub_group_label → { items: [], sub2Map: {} }
    const noGroup     = [];   // item tanpa sub_group

    filtered.forEach(t => {
        const sg  = (t.sub_group  || '').trim();
        const sg2 = (t.sub_group_2 || '').trim();
        if (sg) {
            if (!subGroupMap[sg]) subGroupMap[sg] = { items: [], sub2Map: {} };
            if (sg2) {
                if (!subGroupMap[sg].sub2Map[sg2]) subGroupMap[sg].sub2Map[sg2] = [];
                subGroupMap[sg].sub2Map[sg2].push(t);
            } else {
                subGroupMap[sg].items.push(t);
            }
        } else {
            noGroup.push(t);
        }
    });

    let html = '';

    Object.keys(subGroupMap).sort().forEach(sg => {
        const { items, sub2Map } = subGroupMap[sg];
        const allItems   = [...items, ...Object.values(sub2Map).flat()];
        const groupId    = 'sg_' + kat + '_' + sg.replace(/\W+/g, '_');
        const isOpen     = window._accordionState[groupId] === true;
        const aktifCount = allItems.filter(t => t.aktif).length;

        // Bangun isi body: items langsung + nested sub_group_2
        let bodyHtml = items.map(t => _renderTarifRow(t)).join('');

        Object.keys(sub2Map).sort().forEach(sg2 => {
            const sg2Items   = sub2Map[sg2];
            const sg2Id      = groupId + '_sg2_' + sg2.replace(/\W+/g, '_');
            const sg2Open    = window._accordionState[sg2Id] === true;
            const sg2Aktif   = sg2Items.filter(t => t.aktif).length;
            bodyHtml += `
            <div style="border:1px solid rgba(8,145,178,0.2);border-radius:10px;margin:6px 0;overflow:hidden;">
                <button onclick="_toggleAccordion('${sg2Id}')"
                    style="width:100%;display:flex;align-items:center;gap:6px;padding:7px 12px;
                           background:${sg2Open ? 'rgba(8,145,178,0.07)' : 'rgba(8,145,178,0.03)'};
                           border:none;cursor:pointer;text-align:left;">
                    <span style="font-size:11px;font-weight:700;color:#0891b2;flex:1;">📂 ${sg2}</span>
                    <span style="font-size:9px;color:#94a3b8;font-weight:600;">${sg2Aktif}/${sg2Items.length} aktif</span>
                    <span style="font-size:12px;color:#94a3b8;transition:transform 0.2s;transform:rotate(${sg2Open ? '90' : '0'}deg);">▶</span>
                </button>
                <div id="acc_body_${sg2Id}" style="display:${sg2Open ? 'block' : 'none'};padding:0 12px 4px;">
                    ${sg2Items.map(t => _renderTarifRow(t)).join('')}
                </div>
            </div>`;
        });

        html += _accordionShell({
            groupId, label: sg,
            count: allItems.length, aktifCount, isOpen,
            bodyHtml
        });
    });

    // Item tanpa sub_group → accordion "Lainnya"
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

    // Jika sama sekali tidak ada data
    if (!html) {
        html = `<p style="text-align:center;color:#94a3b8;padding:32px 0">Belum ada tarif untuk kategori ini</p>`;
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
    const subGroupBadge = t.sub_group
        ? `<span style="font-size:9px;color:#6366f1;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:1px 6px;margin-left:4px;">${t.sub_group}</span>`
        : '';
    const subGroup2Badge = t.sub_group_2
        ? `<span style="font-size:9px;color:#0891b2;background:rgba(8,145,178,0.08);border:1px solid rgba(8,145,178,0.2);border-radius:10px;padding:1px 6px;margin-left:4px;">📂 ${t.sub_group_2}</span>`
        : '';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;${!t.aktif ? 'color:#94a3b8;' : ''}">${t.nama}${showKat ? subGroupBadge : ''}${subGroup2Badge}</div>
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
//  MODAL TAMBAH TARIF BARU (Input Manual)
// ════════════════════════════════════════
function openTambahTarif() {
    _openTambahTarifModal();
}

function _openTambahTarifModal() {
    const KATEGORI_LIST = ['Administrasi', 'Laboratorium', 'Pemeriksaan', 'Penunjang', 'Tindakan', 'Obat', 'Lainnya'];

    // Ambil sub_group yang sudah ada (grouped by kategori)
    const subsByKat = {};
    KATEGORI_LIST.forEach(k => {
        subsByKat[k] = [...new Set(
            window._tarifCache.filter(x => x.kategori === k && x.sub_group).map(x => x.sub_group.trim())
        )].sort();
    });

    // Build option sub_group untuk default kategori pertama
    const defaultKat = 'Administrasi';
    const subOpts = _buildSubOptions(subsByKat[defaultKat] || [], '');
    const sub2Opts = _buildSubOptions([], '');

    document.getElementById('_tarifModal')?.remove();
    const modal = document.createElement('div');
    modal.id = '_tarifModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:0 -4px 32px rgba(0,0,0,.18)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
                <h3 style="margin:0;font-size:16px;font-weight:800;">➕ Tambah Tarif Baru</h3>
                <button onclick="document.getElementById('_tarifModal').remove()"
                    style="padding:4px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;cursor:pointer;background:#f8fafc;color:#64748b;">✕</button>
            </div>

            <!-- Nama Layanan -->
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Nama Layanan <span style="color:#ef4444">*</span></label>
            <input id="_nt_nama" type="text" placeholder="cth: Pemeriksaan EKG, GDS Strip, Konsultasi Gizi..."
                style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:14px;box-sizing:border-box;"
                oninput="this.style.borderColor=this.value?'#6366f1':'#e2e8f0'">

            <!-- Kategori -->
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Kategori <span style="color:#ef4444">*</span></label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;" id="_nt_katPills">
                ${KATEGORI_LIST.map((k, i) => `
                    <label style="cursor:pointer;">
                        <input type="radio" name="_nt_kat" value="${k}" ${i===0?'checked':''} style="display:none"
                            onchange="_onTambahKatChange('${k}')">
                        <span id="_nt_kat_pill_${k}"
                            style="display:inline-block;padding:5px 12px;border:1.5px solid ${i===0?'var(--primary)':'#e2e8f0'};border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:${i===0?'var(--primary)':'#fff'};color:${i===0?'#fff':'var(--text)'};white-space:nowrap;transition:all 0.15s;">
                            ${KAT_ICON[k]||'📌'} ${k}
                        </span>
                    </label>`).join('')}
            </div>

            <!-- Harga -->
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Harga (Rp) <span style="color:#ef4444">*</span></label>
            <input id="_nt_harga" type="number" placeholder="0" min="0"
                style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:14px;box-sizing:border-box;"
                oninput="this.style.borderColor=this.value?'#6366f1':'#e2e8f0'">

            <!-- Sub Kelompok (level 1) -->
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:2px;">Sub Kelompok
                <span style="font-weight:400;color:#94a3b8;font-size:10px;">— pengelompokan level 1 (opsional)</span>
            </label>
            <select id="_nt_sub_select" onchange="_onNtSubSelect(this.value)"
                style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 6px;box-sizing:border-box;background:#fff">
                <option value="">— Tanpa kelompok —</option>
                ${subOpts}
                <option value="__new__">✏️ Ketik kelompok baru...</option>
            </select>
            <input id="_nt_sub_new" type="text" placeholder="Nama sub kelompok baru (misal: 🩸 Darah Rutin)"
                style="width:100%;padding:8px;border:1.5px solid #6366f1;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;display:none;">

            <!-- Sub Sub Kelompok (level 2) -->
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:2px;">Sub Sub Kelompok
                <span style="font-weight:400;color:#94a3b8;font-size:10px;">— pengelompokan level 2, di dalam Sub Kelompok (opsional)</span>
            </label>
            <select id="_nt_sub2_select" onchange="_onNtSub2Select(this.value)"
                style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 6px;box-sizing:border-box;background:#fff">
                <option value="">— Tanpa sub sub kelompok —</option>
                ${sub2Opts}
                <option value="__new__">✏️ Ketik sub sub kelompok baru...</option>
            </select>
            <input id="_nt_sub2_new" type="text" placeholder="Nama sub sub kelompok baru (misal: 🧬 Metabolisme)"
                style="width:100%;padding:8px;border:1.5px solid #0891b2;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;display:none;">

            <!-- Keterangan -->
            <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Keterangan <span style="color:#94a3b8;font-weight:400">(opsional)</span></label>
            <input id="_nt_ket" type="text" placeholder="cth: Untuk pasien BPJS, termasuk reagen"
                style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:18px;box-sizing:border-box;">

            <!-- Aktif toggle -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <span style="font-size:12px;font-weight:700;color:#374151;flex:1;">Status Tarif</span>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="_nt_aktif" checked style="width:16px;height:16px;accent-color:var(--primary);">
                    <span style="font-size:12px;font-weight:600;color:#16a34a">Aktif (masuk tagihan otomatis)</span>
                </label>
            </div>

            <div style="display:flex;gap:8px">
                <button onclick="document.getElementById('_tarifModal').remove()"
                    style="flex:1;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:13px;cursor:pointer;background:#fff;font-weight:600">
                    Batal
                </button>
                <button onclick="_simpanTarifBaru()"
                    style="flex:2;padding:12px;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--primary);color:#fff;">
                    💾 Simpan Tarif
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    // Simpan subsByKat ke window untuk dipakai onchange
    window._ntSubsByKat = subsByKat;
}

function _onTambahKatChange(kat) {
    // Update pill style semua kategori
    const allKats = ['Administrasi', 'Laboratorium', 'Pemeriksaan', 'Penunjang', 'Tindakan', 'Obat', 'Lainnya'];
    allKats.forEach(k => {
        const pill = document.getElementById('_nt_kat_pill_' + k);
        if (!pill) return;
        if (k === kat) {
            pill.style.background = 'var(--primary)'; pill.style.color = '#fff'; pill.style.borderColor = 'var(--primary)';
        } else {
            pill.style.background = '#fff'; pill.style.color = 'var(--text)'; pill.style.borderColor = '#e2e8f0';
        }
    });

    // Update opsi sub_group sesuai kategori baru
    const subs = (window._ntSubsByKat || {})[kat] || [];
    const sel = document.getElementById('_nt_sub_select');
    if (sel) {
        sel.innerHTML = `<option value="">— Tanpa kelompok —</option>` + _buildSubOptions(subs, '') + `<option value="__new__">✏️ Ketik kelompok baru...</option>`;
        document.getElementById('_nt_sub_new').style.display = 'none';
    }
    // Reset sub2
    const sel2 = document.getElementById('_nt_sub2_select');
    if (sel2) {
        sel2.innerHTML = `<option value="">— Tanpa sub sub kelompok —</option><option value="__new__">✏️ Ketik sub sub kelompok baru...</option>`;
        document.getElementById('_nt_sub2_new').style.display = 'none';
    }
}

function _buildSubOptions(list, selected) {
    return list.map(sg => `<option value="${sg}" ${sg === selected ? 'selected' : ''}>${sg}</option>`).join('');
}

function _onNtSubSelect(val) {
    const inp = document.getElementById('_nt_sub_new');
    if (!inp) return;
    if (val === '__new__') { inp.style.display = 'block'; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = ''; }

    // Update sub2 options berdasarkan sub_group yang dipilih
    const katEl = document.querySelector('input[name="_nt_kat"]:checked');
    const kat = katEl ? katEl.value : '';
    const subGroup = val === '__new__' ? '' : val;
    const subs2 = [...new Set(
        window._tarifCache.filter(x => x.kategori === kat && x.sub_group === subGroup && x.sub_group_2).map(x => x.sub_group_2.trim())
    )].sort();
    const sel2 = document.getElementById('_nt_sub2_select');
    if (sel2) {
        sel2.innerHTML = `<option value="">— Tanpa sub sub kelompok —</option>` + _buildSubOptions(subs2, '') + `<option value="__new__">✏️ Ketik sub sub kelompok baru...</option>`;
        document.getElementById('_nt_sub2_new').style.display = 'none';
    }
}

function _onNtSub2Select(val) {
    const inp = document.getElementById('_nt_sub2_new');
    if (!inp) return;
    if (val === '__new__') { inp.style.display = 'block'; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = ''; }
}

async function _simpanTarifBaru() {
    const nama  = (document.getElementById('_nt_nama')?.value || '').trim();
    const katEl = document.querySelector('input[name="_nt_kat"]:checked');
    const kat   = katEl ? katEl.value : 'Lainnya';
    const harga = Number(document.getElementById('_nt_harga')?.value) || 0;
    const ket   = (document.getElementById('_nt_ket')?.value || '').trim() || null;
    const aktif = document.getElementById('_nt_aktif')?.checked !== false;

    if (!nama) {
        showToast('❌ Nama layanan wajib diisi', 'error');
        document.getElementById('_nt_nama')?.focus();
        return;
    }

    // sub_group
    const sv = document.getElementById('_nt_sub_select')?.value;
    let sub_group = null;
    if (sv === '__new__') sub_group = (document.getElementById('_nt_sub_new')?.value || '').trim() || null;
    else sub_group = sv || null;

    // sub_group_2
    const sv2 = document.getElementById('_nt_sub2_select')?.value;
    let sub_group_2 = null;
    if (sv2 === '__new__') sub_group_2 = (document.getElementById('_nt_sub2_new')?.value || '').trim() || null;
    else sub_group_2 = sv2 || null;

    try {
        await sb_saveTarif({ nama, kategori: kat, harga, keterangan: ket, aktif, sub_group, sub_group_2 });
        document.getElementById('_tarifModal')?.remove();
        showToast('✅ Tarif baru berhasil ditambahkan', 'success');
        await _refreshTarifCache();
        // Pindah ke tab kategori yang baru ditambahkan
        _activeKatTab = kat;
        renderDaftarTarif();
    } catch(e) {
        console.error('[biaya] ❌ Gagal tambah tarif:', e);
        showToast('❌ Gagal menyimpan tarif: ' + (e.message || e), 'error');
    }
}

// ════════════════════════════════════════
//  MODAL EDIT TARIF
//  (termasuk edit sub_group langsung dari UI)
// ════════════════════════════════════════
function openEditTarif(id) {
    const t = window._tarifCache.find(x => String(x.id) === String(id));
    if (t) _openTarifModal(t);
}

function _openTarifModal(tarif) {
    if (!tarif) return;

    // Kumpulkan daftar sub_group yang sudah ada di DB untuk kategori ini
    const existingSubs = [...new Set(
        window._tarifCache
            .filter(x => x.kategori === tarif.kategori && x.sub_group)
            .map(x => x.sub_group.trim())
    )].sort();

    // Kumpulkan daftar sub_group_2 yang sudah ada untuk sub_group yang sama
    const existingSubs2 = [...new Set(
        window._tarifCache
            .filter(x => x.kategori === tarif.kategori && x.sub_group === tarif.sub_group && x.sub_group_2)
            .map(x => x.sub_group_2.trim())
    )].sort();

    const subOptions = existingSubs.map(sg =>
        `<option value="${sg}" ${sg === (tarif.sub_group || '') ? 'selected' : ''}>${sg}</option>`
    ).join('');

    const sub2Options = existingSubs2.map(sg =>
        `<option value="${sg}" ${sg === (tarif.sub_group_2 || '') ? 'selected' : ''}>${sg}</option>`
    ).join('');

    document.getElementById('_tarifModal')?.remove();
    const modal = document.createElement('div');
    modal.id = '_tarifModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;width:380px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.18)">
            <h3 style="margin:0 0 16px;font-size:16px">✏️ Edit Tarif</h3>

            <label style="font-size:12px;font-weight:600">Nama Layanan</label>
            <div style="padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 12px;color:#475569">
                ${KAT_ICON[tarif.kategori] || ''} ${tarif.nama}
            </div>
            <input type="hidden" id="_tf_nama" value="${tarif.nama}">

            <label style="font-size:12px;font-weight:600">Kategori</label>
            <div style="padding:8px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 12px;color:#475569">
                ${tarif.kategori}
            </div>
            <input type="hidden" id="_tf_kat" value="${tarif.kategori}">

            <label style="font-size:12px;font-weight:600">Harga (Rp)</label>
            <input id="_tf_harga" type="number" value="${tarif.harga}" placeholder="0"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 12px;box-sizing:border-box">

            <label style="font-size:12px;font-weight:600">Sub Kelompok
                <span style="font-weight:400;color:#94a3b8;font-size:10px;margin-left:4px;">— level 1 pengelompokan accordion</span>
            </label>
            <select id="_tf_sub_select"
                onchange="_onSubGroupSelect(this.value)"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 6px;box-sizing:border-box;background:#fff">
                <option value="">— Tanpa kelompok —</option>
                ${subOptions}
                <option value="__new__">✏️ Ketik kelompok baru...</option>
            </select>
            <input id="_tf_sub_new" type="text" placeholder="Nama sub kelompok baru (misal: 🩸 Darah Rutin)"
                style="width:100%;padding:8px;border:1.5px solid #6366f1;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;display:${tarif.sub_group && !existingSubs.includes(tarif.sub_group) ? 'block' : 'none'};"
                value="${tarif.sub_group && !existingSubs.includes(tarif.sub_group) ? tarif.sub_group : ''}">

            <label style="font-size:12px;font-weight:600">Sub Sub Kelompok
                <span style="font-weight:400;color:#94a3b8;font-size:10px;margin-left:4px;">— level 2 (opsional, di dalam Sub Kelompok)</span>
            </label>
            <select id="_tf_sub2_select"
                onchange="_onSub2GroupSelect(this.value)"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 6px;box-sizing:border-box;background:#fff">
                <option value="">— Tanpa sub sub kelompok —</option>
                ${sub2Options}
                <option value="__new__">✏️ Ketik sub sub kelompok baru...</option>
            </select>
            <input id="_tf_sub2_new" type="text" placeholder="Nama sub sub kelompok baru (misal: 🧬 Metabolisme)"
                style="width:100%;padding:8px;border:1.5px solid #0891b2;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;display:${tarif.sub_group_2 && !existingSubs2.includes(tarif.sub_group_2) ? 'block' : 'none'};"
                value="${tarif.sub_group_2 && !existingSubs2.includes(tarif.sub_group_2) ? tarif.sub_group_2 : ''}">

            <label style="font-size:12px;font-weight:600">Keterangan</label>
            <input id="_tf_ket" type="text" value="${tarif.keterangan || ''}" placeholder="Opsional"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;margin:4px 0 16px;box-sizing:border-box">

            <div style="display:flex;gap:8px">
                <button onclick="document.getElementById('_tarifModal').remove()"
                    style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;cursor:pointer;background:#fff">
                    Batal
                </button>
                <button onclick="_saveTarifFromModal('${tarif.id}')"
                    style="flex:1;padding:10px;border:none;border-radius:10px;font-size:13px;cursor:pointer;background:var(--primary);color:#fff;font-weight:700">
                    💾 Simpan
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function _onSubGroupSelect(val) {
    const inp = document.getElementById('_tf_sub_new');
    if (!inp) return;
    if (val === '__new__') {
        inp.style.display = 'block';
        inp.focus();
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
}

function _onSub2GroupSelect(val) {
    const inp = document.getElementById('_tf_sub2_new');
    if (!inp) return;
    if (val === '__new__') {
        inp.style.display = 'block';
        inp.focus();
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
}

async function _saveTarifFromModal(id) {
    const nama  = document.getElementById('_tf_nama').value.trim();
    const kat   = document.getElementById('_tf_kat').value;
    const harga = document.getElementById('_tf_harga').value;
    const ket   = document.getElementById('_tf_ket').value.trim() || null;
    const existing = window._tarifCache.find(x => String(x.id) === String(id));
    const aktif = existing ? existing.aktif : true;

    // Tentukan sub_group
    const selVal = document.getElementById('_tf_sub_select').value;
    let sub_group = null;
    if (selVal === '__new__') {
        sub_group = (document.getElementById('_tf_sub_new').value || '').trim() || null;
    } else {
        sub_group = selVal || null;
    }

    // Tentukan sub_group_2
    const sel2Val = document.getElementById('_tf_sub2_select').value;
    let sub_group_2 = null;
    if (sel2Val === '__new__') {
        sub_group_2 = (document.getElementById('_tf_sub2_new').value || '').trim() || null;
    } else {
        sub_group_2 = sel2Val || null;
    }

    if (!nama) return showToast('❌ Nama layanan wajib diisi', 'error');

    try {
        await sb_saveTarif({ id: id || undefined, nama, kategori: kat, harga: Number(harga) || 0, keterangan: ket, aktif, sub_group, sub_group_2 });
        document.getElementById('_tarifModal')?.remove();
        showToast('✅ Tarif berhasil disimpan', 'success');
        await _refreshTarifCache();
        renderDaftarTarif();
    } catch(e) {
        console.error('[biaya] ❌ Gagal simpan tarif:', e);
        showToast('❌ Gagal menyimpan tarif: ' + (e.message || e), 'error');
    }
}

// ════════════════════════════════════════
//  TOGGLE AKTIF & BULK
// ════════════════════════════════════════
async function toggleAktifTarif(id, aktifBaru) {
    try {
        const t = window._tarifCache.find(x => String(x.id) === String(id));
        if (!t) return;
        await sb_saveTarif({ id, nama: t.nama, kategori: t.kategori, harga: t.harga, keterangan: t.keterangan, aktif: aktifBaru, sub_group: t.sub_group || null });
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
            sb_saveTarif({ id: t.id, nama: t.nama, kategori: t.kategori, harga: t.harga, keterangan: t.keterangan, aktif: aktifBaru, sub_group: t.sub_group || null })
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

    // BUG-FIX-2: Cek dulu apakah tagihan sudah ada di DB untuk kunjungan ini.
    // Jika sudah ada, tampilkan data dari DB (konsisten dengan invoice riwayat).
    // Jika belum ada, generate otomatis dari data kunjungan.
    let items = [];
    let existingTagihan = null;
    try {
        existingTagihan = await sb_getTagihan(kunjunganId);
    } catch(e) { /* ignore */ }

    if (existingTagihan && existingTagihan.tagihan_item && existingTagihan.tagihan_item.length > 0) {
        // Tagihan sudah tersimpan — gunakan data dari DB agar konsisten dengan riwayat
        items = existingTagihan.tagihan_item.map(it => ({
            nama_item:    it.nama_item,
            kategori:     it.kategori,
            jumlah:       Number(it.jumlah) || 1,
            harga_satuan: Number(it.harga_satuan) || 0,
            keterangan:   it.keterangan || null
        }));
    } else {
        // Tagihan belum ada — generate otomatis
        try {
            items = await sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData);
        } catch(e) {
            showToast('⚠️ Gagal generate tagihan otomatis', 'error');
        }
    }

    _renderTagihanModal(kunjunganId, pasienId, items,
        existingTagihan ? Number(existingTagihan.diskon) || 0 : 0,
        existingTagihan ? (existingTagihan.catatan || '') : '');
}

function _renderTagihanModal(kunjunganId, pasienId, items, initDiskon = 0, initCatatan = '') {
    document.getElementById('_tagihanModal')?.remove();

    const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const diskon   = Number(initDiskon) || 0;
    const total    = Math.max(0, subtotal - diskon);
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
                    <input id="_tagihanDiskon" type="number" value="${diskon}" min="0"
                        oninput="_recalcTagihan()"
                        style="width:120px;padding:5px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;text-align:right">
                </div>
                <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--primary)">
                    <span>TOTAL</span>
                    <span id="_tagihanTotal">Rp ${total.toLocaleString('id-ID')}</span>
                </div>
            </div>
            <textarea id="_tagihanCatatan" placeholder="Catatan (opsional)" rows="2"
                style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;box-sizing:border-box;margin-bottom:10px;resize:none">${initCatatan ? _escHtmlBiaya(initCatatan) : ''}</textarea>
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

function _escHtmlBiaya(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
