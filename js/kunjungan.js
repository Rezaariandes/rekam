// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL KUNJUNGAN PASIEN
//  Mengelola daftar kunjungan harian & rekam medis
//
//  ✅ kunjungan-patch.js sudah digabung ke file ini:
//     - riwayat_penyakit field di saveAll() payload
//     - Tampil tgl_lahir di banner info pasien
//     - Indikator permintaan lab di card kunjungan
//  File kunjungan-patch.js TIDAK perlu di-load lagi.
// ════════════════════════════════════════════════════════

let kunjunganHariIni   = [];
let currentKunjunganId = null;

// ════════════════════════════════════════════════════════
//  VALIDASI NILAI TANDA VITAL
//  Rentang absolut yang masih physiologically possible
// ════════════════════════════════════════════════════════
const VITAL_RULES = {
    sistol:        { min: 50,   max: 300,  label: 'Sistol',        unit: 'mmHg' },
    diastol:       { min: 30,   max: 200,  label: 'Diastol',       unit: 'mmHg' },
    nadi:          { min: 20,   max: 300,  label: 'Nadi',          unit: 'x/mnt' },
    suhu:          { min: 30,   max: 45,   label: 'Suhu',          unit: '°C' },
    rr:            { min: 5,    max: 60,   label: 'Laju Napas',    unit: 'x/mnt' },
    bb:            { min: 1,    max: 300,  label: 'Berat Badan',   unit: 'kg' },
    tb:            { min: 30,   max: 250,  label: 'Tinggi Badan',  unit: 'cm' },
    // Lab dasar
    lab_gds:       { min: 20,   max: 800,  label: 'GDS',           unit: 'mg/dL' },
    lab_chol:      { min: 50,   max: 800,  label: 'Kolesterol',    unit: 'mg/dL' },
    lab_ua:        { min: 1,    max: 20,   label: 'Asam Urat',     unit: 'mg/dL' },
    // BUG-10 FIX: tambahkan rentang fisiologis untuk semua lab field yang ada di form
    lab_hb:        { min: 2,    max: 25,   label: 'HB',            unit: 'g/dL' },
    lab_trombosit: { min: 10,   max: 1500, label: 'Trombosit',     unit: 'ribu/µL' },
    lab_leukosit:  { min: 0.5,  max: 100,  label: 'Leukosit',      unit: 'ribu/µL' },
    lab_eritrosit: { min: 0.5,  max: 10,   label: 'Eritrosit',     unit: 'juta/µL' },
    lab_hematokrit:{ min: 5,    max: 70,   label: 'Hematokrit',    unit: '%' },
    lab_hiv:       { min: 0,    max: 10,   label: 'HIV (index)',   unit: '' },
    lab_sifilis:   { min: 0,    max: 10,   label: 'Sifilis (index)',unit: '' },
    lab_hepatitis: { min: 0,    max: 10,   label: 'Hepatitis B (index)', unit: '' },
    lab_hdl:       { min: 5,    max: 200,  label: 'HDL',           unit: 'mg/dL' },
    lab_ldl:       { min: 10,   max: 500,  label: 'LDL',           unit: 'mg/dL' },
    lab_tg:        { min: 10,   max: 2000, label: 'Trigliserida',  unit: 'mg/dL' },
    lab_gdp:       { min: 20,   max: 800,  label: 'GDP',           unit: 'mg/dL' },
    lab_hba1c:     { min: 2,    max: 20,   label: 'HbA1c',         unit: '%' },
    lab_sgot:      { min: 5,    max: 5000, label: 'SGOT',          unit: 'U/L' },
    lab_sgpt:      { min: 5,    max: 5000, label: 'SGPT',          unit: 'U/L' },
    lab_ureum:     { min: 5,    max: 500,  label: 'Ureum',         unit: 'mg/dL' },
    lab_creatinin: { min: 0.1,  max: 50,   label: 'Creatinin',     unit: 'mg/dL' },
};

function validasiNilaiVital() {
    const errors = [];
    Object.entries(VITAL_RULES).forEach(([id, rule]) => {
        const el = $(id);
        if (!el || el.value === '') return; // boleh kosong
        const val = parseFloat(el.value);
        if (isNaN(val)) {
            errors.push(`${rule.label}: bukan angka valid`);
            return;
        }
        if (val < rule.min || val > rule.max) {
            errors.push(`${rule.label}: ${val} ${rule.unit} (rentang valid: ${rule.min}–${rule.max})`);
        }
    });
    // Validasi silang: sistol harus > diastol
    const sis = parseFloat($('sistol')?.value  || '');
    const dia = parseFloat($('diastol')?.value || '');
    if (!isNaN(sis) && !isNaN(dia) && sis <= dia) {
        errors.push(`Tekanan darah tidak valid: Sistol (${sis}) harus lebih besar dari Diastol (${dia})`);
    }
    return errors;
}

// ════════════════════════════════════════════════════════
//  STATUS PENANDA: OBAT & PEMBAYARAN
//  Disimpan di Supabase (kolom status_obat, status_bayar di tabel kunjungan)
//  + cache lokal agar UI responsif
// ════════════════════════════════════════════════════════

window._statusCache = window._statusCache || {};

function _getStatusKunjungan(kId) {
    if (window._statusCache[kId]) return window._statusCache[kId];
    const k = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : []).find(x => x.id === kId);
    if (k) {
        const s = { obat: !!k.status_obat, bayar: !!k.status_bayar };
        window._statusCache[kId] = s;
        return s;
    }
    return { obat: false, bayar: false };
}

function _setStatusKunjungan(kId, field, value) {
    const s = _getStatusKunjungan(kId);
    s[field] = value;
    window._statusCache[kId] = s;
    const k = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : []).find(x => x.id === kId);
    if (k) k[field === 'obat' ? 'status_obat' : 'status_bayar'] = value;
}

/** Toggle status obat / bayar — simpan ke Supabase agar persist lintas sesi */
async function toggleStatusKunjungan(event, kId, field) {
    event.stopPropagation();
    const s   = _getStatusKunjungan(kId);
    const val = !s[field];
    _setStatusKunjungan(kId, field, val);

    const badge = document.getElementById(`badge_${field}_${kId}`);
    if (badge) {
        badge.innerHTML  = _badgeHtml(field, val);
        badge.style.cssText = _badgeStyleAttr(field, val);
    }

    const label = field === 'obat' ? 'Resep' : 'Pembayaran';
    showToast(val ? `✅ ${label} sudah ditandai` : `↩️ ${label} dibatalkan`, val ? 'success' : 'info');

    try {
        const col = field === 'obat' ? 'status_obat' : 'status_bayar';
        await _sbFetch(`kunjungan?id=eq.${kId}`, {
            method: 'PATCH',
            body: { [col]: val },
            prefer: 'return=minimal'
        });
    } catch(e) {
        console.warn('[Klikpro] Gagal simpan status ke server:', e.message);
    }
}

/** Helper: HTML isi badge */
function _badgeHtml(field, active) {
    if (field === 'obat') {
        return active
            ? `<span style="font-size:10px;">💊</span> Resep ✓`
            : `<span style="font-size:10px;">✕</span> Resep`;
    }
    return active
        ? `<span style="font-size:10px;">💰</span> Bayar ✓`
        : `<span style="font-size:10px;">✕</span> Bayar`;
}

/** Helper: inline style string untuk badge */
function _badgeStyleAttr(field, active) {
    const base = `cursor:pointer;display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;transition:all .15s;`;
    if (active) {
        return base + (field === 'obat'
            ? 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;opacity:1;'
            : 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;opacity:1;');
    }
    return base + 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;opacity:0.85;';
}

/** Legacy compat */
function _badgeStyle(field, active) {
    return active
        ? (field === 'obat' ? 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;' : 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;')
        : 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;';
}

// ── AMBIL DATA KUNJUNGAN BERDASARKAN TANGGAL ──
let _searchKunjungan = '';

async function fetchByDate() {
    const filterEl = $('filterDate');
    if (!filterEl || !filterEl.value) return;

    const today     = new Date();
    const tzOffset  = today.getTimezoneOffset() * 60000;
    const localToday = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);

    filterEl.max = localToday;

    if (filterEl.value > localToday) {
        showToast("⚠️ Tidak bisa melihat data tanggal masa depan", "warning");
        filterEl.value = localToday;
        return;
    }

    // Reset pencarian & cache status saat tanggal berubah
    _searchKunjungan = '';
    const searchEl = $('searchKunjungan');
    if (searchEl) searchEl.value = '';
    window._statusCache = {};

    const listEl = $('listHariIni');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data...</div>`;
    try {
        const data = await sb_initData(filterEl.value);
        if (data.pasien) allPatients = data.pasien;
        kunjunganHariIni = data.hariIni || [];
        renderKunjunganHariIni();
    } catch (e) {
        showToast("❌ Gagal memuat data kunjungan", "error");
        if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div>Gagal memuat. Cek koneksi.</div>`;
    }
}

// ── RENDER DAFTAR KUNJUNGAN HARI INI ──
function renderKunjunganHariIni() {
    const container = $('listHariIni');
    const statTotal = $('statTotal');
    if (statTotal) statTotal.innerText = kunjunganHariIni.length;
    if (!container) return;

    if (kunjunganHariIni.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div>Belum ada pasien hari ini.</div>`;
        return;
    }

    const sorted = [...kunjunganHariIni].sort((a, b) => {
        if (a.status !== b.status) return a.status === "Selesai" ? 1 : -1;
        return String(a.waktu || "00:00").localeCompare(String(b.waktu || "00:00"));
    });

    // Filter pencarian nama
    const q = (_searchKunjungan || '').toLowerCase().trim();
    const filtered = q ? sorted.filter(h => (h.nama || '').toLowerCase().includes(q)) : sorted;

    const access     = window._currentAccess || [];
    const has        = id => access.length === 0 || access.includes(id); // fallback: tampilkan semua jika access kosong

    container.innerHTML = filtered.map(h => {
        const isDone     = h.status === 'Selesai';
        const tampilNama = h.nama || (allPatients.find(x => x.id === h.pasienId) || {}).nama || '(Nama tidak diketahui)';

        // ── TTV ringkas
        const ttvRow = has('mod_kunjungan_ttv')
            ? `<div style="font-size:11px;color:var(--text-muted);">TTV: ${h.td || '-'} mmHg | ${h.suhu || '-'}°C | N: ${h.nadi || '-'}</div>`
            : '';

        // ── Keluhan
        const keluhanRow = has('mod_kunjungan_keluhan')
            ? `<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">Keluhan: ${h.keluhan || '-'}</div>`
            : '';

        // ── Lab ringkas
        const hasLab = h.lab_gds || h.lab_chol || h.lab_ua;
        const labRow = (has('mod_kunjungan_lab') && hasLab)
            ? `<div style="font-size:10.5px;color:#7c3aed;background:rgba(124,58,237,0.07);padding:3px 7px;border-radius:6px;margin-top:3px;">
                 🔬 GDS: ${h.lab_gds||'—'} | Kol: ${h.lab_chol||'—'} | AU: ${h.lab_ua||'—'}
               </div>`
            : '';

        // ── Diagnosa
        const diagRow = has('mod_kunjungan_diagnosa')
            ? `<div style="font-size:11px;color:var(--text-muted);">Diagnosa: ${h.diag || '-'}</div>`
            : '';

        // ── Indikator permintaan lab (req_lab)
        let labReqRow = '';
        if (h.req_lab) {
            try {
                const reqObj = typeof h.req_lab === 'string' ? JSON.parse(h.req_lab) : h.req_lab;
                // Gunakan nama asli (_labname_) jika tersedia, fallback ke rekonstruksi slug
                const labReqs = Object.entries(reqObj)
                    .filter(([k, v]) => v && k.startsWith('lab_req_'))
                    .map(([k]) => {
                        const nameKey = '_labname_' + k;
                        return reqObj[nameKey] || k.replace('lab_req_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    });
                const pnjReqs = Object.entries(reqObj)
                    .filter(([k, v]) => v && k.startsWith('penunjang_'))
                    .map(([k]) => k.replace('penunjang_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

                let rowParts = [];

                // Badge permintaan labor yang menonjol
                if (labReqs.length > 0) {
                    const labChips = labReqs.map(r =>
                        `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;
                            background:rgba(37,99,235,0.12);color:#1d4ed8;font-size:9.5px;font-weight:700;
                            border:1px solid rgba(37,99,235,0.3);">🔬 ${r}</span>`
                    ).join('');
                    rowParts.push(
                        `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;
                            background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);
                            border-radius:8px;padding:4px 8px;margin-top:4px;">
                            <span style="font-size:9.5px;font-weight:800;color:#1d4ed8;white-space:nowrap;">🧪 Permintaan Lab:</span>
                            ${labChips}
                        </div>`
                    );
                }

                // Chip penunjang seperti sebelumnya
                if (pnjReqs.length > 0) {
                    const pnjChips = pnjReqs.map(r =>
                        `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;
                            background:rgba(124,58,237,0.1);color:#6d28d9;font-size:9.5px;font-weight:700;
                            border:1px solid rgba(124,58,237,0.25);">✔ ${r}</span>`
                    ).join('');
                    rowParts.push(`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${pnjChips}</div>`);
                }

                // ── Chip tindakan medis
                const tidReqs = Object.entries(reqObj)
                    .filter(([k, v]) => v === true && k.startsWith('tindakan_'))
                    .map(([k]) => {
                        const nameKey = '_tidname_' + k;
                        return reqObj[nameKey] || k.replace('tindakan_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    });
                if (tidReqs.length > 0) {
                    const tidChips = tidReqs.map(r =>
                        `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;
                            background:rgba(220,38,38,0.1);color:#b91c1c;font-size:9.5px;font-weight:700;
                            border:1px solid rgba(220,38,38,0.25);">⚕️ ${r}</span>`
                    ).join('');
                    rowParts.push(
                        `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;
                            background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.18);
                            border-radius:8px;padding:4px 8px;margin-top:4px;">
                            <span style="font-size:9.5px;font-weight:800;color:#b91c1c;white-space:nowrap;">🩺 Tindakan:</span>
                            ${tidChips}
                        </div>`
                    );
                }

                // ── Chip pemeriksaan extra
                const pemxReqs = Object.entries(reqObj)
                    .filter(([k, v]) => v && typeof v === 'string' && k.startsWith('pemx_'))
                    .map(([k]) => {
                        const nameKey = '_pemxname_' + k;
                        return reqObj[nameKey] || k.replace('pemx_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    });
                if (pemxReqs.length > 0) {
                    const pemxChips = pemxReqs.map(r =>
                        `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;
                            background:rgba(124,58,237,0.08);color:#6d28d9;font-size:9.5px;font-weight:700;
                            border:1px solid rgba(124,58,237,0.2);">🩺 ${r}</span>`
                    ).join('');
                    rowParts.push(`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${pemxChips}</div>`);
                }

                if (rowParts.length > 0) {
                    labReqRow = rowParts.join('');
                }
            } catch(e) {}
        }

        // ── Dokter pemeriksa
        const dokterRow = (has('mod_kunjungan_dokter') && h.dokterNama)
            ? `<div style="font-size:10px;color:#059669;font-weight:600;margin-top:2px;">👨‍⚕️ dr. ${h.dokterNama}</div>`
            : '';

        // ── Status badges
        const st        = _getStatusKunjungan(h.id);
        const obatDone  = st.obat;
        const bayarDone = st.bayar;

        const jabatan        = ((typeof loggedInUser !== 'undefined' && loggedInUser) ? (loggedInUser.jabatan || '') : '').toLowerCase();
        const canToggleObat  = has('mod_kunjungan_status_obat')  && ['apoteker','admin','dokter'].includes(jabatan);
        const canToggleBayar = has('mod_kunjungan_status_bayar') && ['kasir','admin','dokter'].includes(jabatan);

        const badgeObat  = has('mod_kunjungan_status_obat')
            ? `<span id="badge_obat_${h.id}"
                onclick="${canToggleObat ? `toggleStatusKunjungan(event,'${h.id}','obat')` : 'event.stopPropagation()'}"
                style="${_badgeStyleAttr('obat', obatDone)}${canToggleObat ? '' : 'cursor:default;'}">
                ${_badgeHtml('obat', obatDone)}</span>`
            : '';

        const badgeBayar = has('mod_kunjungan_status_bayar')
            ? `<span id="badge_bayar_${h.id}"
                onclick="${canToggleBayar ? `toggleStatusKunjungan(event,'${h.id}','bayar')` : 'event.stopPropagation()'}"
                style="${_badgeStyleAttr('bayar', bayarDone)}${canToggleBayar ? '' : 'cursor:default;'}">
                ${_badgeHtml('bayar', bayarDone)}</span>`
            : '';

        // ── Action buttons
        let actionBtns = '';
        if (has('mod_kunjungan_btn_invoice') && window._biayaAktif) {
            actionBtns += `<button onclick="event.stopPropagation();_quickInvoice('${h.id}','${escHtml(tampilNama)}')"
                style="flex:1;padding:5px 0;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                🧾 Invoice</button>`;
        }
        if (has('mod_kunjungan_btn_resep') && window._stokAktif) {
            actionBtns += `<button onclick="event.stopPropagation();_quickResep('${h.id}','${escHtml(tampilNama)}')"
                style="flex:1;padding:5px 0;background:linear-gradient(135deg,#2563eb,#60a5fa);color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;">
                💊 Resep</button>`;
        }

        // ── Status kunjungan badge (menunggu/selesai)
        const statusBadge = has('mod_kunjungan_status_kunjungan')
            ? `<div class="status-badge ${isDone ? 'status-done' : 'status-wait'}" style="flex-shrink:0;">${isDone ? '✅ Selesai' : '⏳ Menunggu'}</div>`
            : '';

        const hasActionRow = badgeObat || badgeBayar || actionBtns;

        return `
        <div class="visit-card" style="opacity:${isDone ? '0.72' : '1'};flex-direction:column;gap:0;padding:10px 12px;" onclick="bukaRekamMedisHariIni('${h.id}')">
            <div style="display:flex;align-items:flex-start;gap:10px;width:100%;">
                <div class="visit-time-badge" style="flex-shrink:0;">${h.waktu || '-'}</div>
                <div style="flex:1; min-width:0;">
                    ${has('mod_kunjungan_identitas') ? `<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tampilNama}</div>` : ''}
                    ${keluhanRow}${ttvRow}${labRow}${diagRow}${dokterRow}${labReqRow}
                </div>
                ${statusBadge}
            </div>
            ${hasActionRow ? `
            <div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:7px;border-top:1px dashed var(--border);" onclick="event.stopPropagation()">
                ${badgeObat}${badgeBayar}
                <div style="flex:1;"></div>
                ${actionBtns}
            </div>` : ''}
        </div>`;
    }).join('');
}

/** Buka invoice langsung dari card kunjungan */
function _quickInvoice(kId, namaPasien) {
    const tgl = $('filterDate') ? $('filterDate').value : '';
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kId, namaPasien, tgl);
    } else {
        showToast("⚠️ Modul biaya belum dimuat", "warning");
    }
}

/** Tampilkan resep dari kunjungan dalam modal profesional */
async function _quickResep(kId, namaPasien) {
    // Guard: modul stok harus aktif
    if (!window._stokAktif) {
        showToast('ℹ️ Modul Stok Obat belum diaktifkan di Settings', 'info');
        return;
    }
    // Guard: pastikan fungsi tersedia
    if (typeof sb_getResepByKunjungan !== 'function') {
        showToast('⚠️ Modul resep belum dimuat', 'warning');
        return;
    }
    try {
        const items = await sb_getResepByKunjungan(kId);
        if (!items || items.length === 0) {
            showToast(`ℹ️ Belum ada resep untuk ${namaPasien}`, 'info');
            return;
        }
        // Cari data kunjungan untuk tanggal
        const kunjData = kunjunganHariIni.find(x => x.id === kId);
        const tgl = kunjData ? (kunjData.tgl || ($('filterDate') ? $('filterDate').value : '')) : '';
        _tampilModalResep(kId, namaPasien, items, tgl);
    } catch(e) {
        showToast("❌ Gagal memuat resep: " + (e.message || ''), "error");
    }
}

// ── BUKA REKAM MEDIS DARI KUNJUNGAN HARI INI ──
async function bukaRekamMedisHariIni(kId) {
    // Kasir dan ATLM tidak bisa buka pageMedis penuh, redirect ke invoice/info saja
    const jabatan = ((typeof loggedInUser !== 'undefined' && loggedInUser) ? (loggedInUser.jabatan || '') : '').toLowerCase();
    if (jabatan === 'kasir') {
        const h = kunjunganHariIni.find(x => x.id === kId);
        const nama = h ? (h.nama || '') : '';
        _quickInvoice(kId, nama);
        return;
    }
    if (jabatan === 'atlm') {
        showToast("ℹ️ ATLM hanya dapat melihat data lab dari daftar kunjungan", "info");
        return;
    }

    if (!canAccessMedis()) return;

    const h = kunjunganHariIni.find(x => x.id === kId);
    if (!h) return showToast("❌ Data tidak ditemukan", "error");

    const p = allPatients.find(x => x.id === h.pasienId) || allPatients.find(x => x.nama && h.nama && x.nama === h.nama);
    const namaPasien = (p && p.nama) ? p.nama : (h.nama || '');

    if (p) {
        if ($('nama'))      $('nama').value      = p.nama;
        if ($('nik'))       $('nik').value        = p.nik    || '';
        if ($('jk'))        $('jk').value         = p.jk     || 'L';
        if ($('alamat'))    $('alamat').value     = p.alamat || '';
        if ($('tgl_lahir')) $('tgl_lahir').value  = formatTglIndo(p.tgl) || '';
        if ($('alergi'))    $('alergi').value     = p.alergi || '';
        localStorage.setItem('rme_alergi', p.alergi || '');
    } else {
        if ($('nama')) $('nama').value = namaPasien;
    }

    currentPasienId    = h.pasienId;
    currentKunjunganId = h.id;
    const umur         = p ? hitungUmur(p.tgl) : '-';

    if ($('infoPasienNama')) $('infoPasienNama').innerText = namaPasien || '—';
    if ($('infoPasienNik'))  $('infoPasienNik').innerText  = "NIK: " + (p ? (p.nik || '-') : '-');
    if ($('infoPasienUmur')) $('infoPasienUmur').innerText = "Umur: " + umur;

    // Tampilkan tanggal lahir di banner info pasien
    const tglLahirEl = document.getElementById('infoPasienTglLahir');
    if (tglLahirEl && p && p.tgl) {
        tglLahirEl.innerText  = formatTglIndo(p.tgl);
        tglLahirEl.style.display = '';
    } else if (tglLahirEl) {
        tglLahirEl.style.display = 'none';
    }

    // BUG-DATE FIX: Gunakan h.tgl (tanggal asli kunjungan) bukan filterDate.
    // Sebelumnya pakai filterDate → saat buka kunjungan hari lama, banner
    // header menampilkan tanggal hari ini, bukan tanggal asli kunjungan.
    const tglKunjungan = h.tgl || ($('filterDate') ? $('filterDate').value : '');
    if ($('infoTglPemeriksaan') && tglKunjungan) {
        $('infoTglPemeriksaan').innerText     = "Tgl: " + formatTglIndo(tglKunjungan);
        $('infoTglPemeriksaan').style.display = 'block';
    }

    localStorage.setItem('cP_id',    currentPasienId    || '');
    localStorage.setItem('cK_id',    currentKunjunganId || '');
    localStorage.setItem('cP_nama',  namaPasien);
    localStorage.setItem('cP_nik',   p ? (p.nik || '') : '');
    localStorage.setItem('cP_umur',  "Umur: " + umur);
    localStorage.setItem('cP_tglLahir', (p && p.tgl) ? formatTglIndo(p.tgl) : '');
    localStorage.setItem('cTglEdit', tglKunjungan ? "Tgl: " + formatTglIndo(tglKunjungan) : '');
    localStorage.setItem('activePage', 'pageMedis');

    // BUG-3 FIX: Render dynamic lab section BEFORE _isiFormDariKunjungan so that
    // dynamically-created input fields (lab_hb, lab_trombosit, etc.) already
    // exist in the DOM when we try to fill them. Without this, those fields are
    // null and the data appears "empty" even though the fetch succeeded.
    if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();

    // FIX-DEFAULT-DATA: Reset semua state penunjang/tindakan sebelum mengisi data kunjungan.
    // Tanpa ini, state dari kunjungan sebelumnya (window._reqLab, _reqTindakan, dll)
    // bisa terbawa ke kunjungan baru jika clearSession tidak dipanggil.
    if (typeof loadReqLabFromKunjungan === 'function') {
        loadReqLabFromKunjungan(null);  // Reset semua chip ke kosong dulu
    }

    try {
        const kunjunganData = await sb_getKunjunganById(currentKunjunganId);
        if (kunjunganData && typeof _isiFormDariKunjungan === 'function') {
            _isiFormDariKunjungan(kunjunganData);
        } else {
            if (typeof loadAutosave === 'function') loadAutosave();
        }
    } catch(e) {
        if (typeof loadAutosave === 'function') loadAutosave();
    }

    try {
        let riwayatRows = [];
        if (currentPasienId) {
            // FIX: Hapus join dokter(nama_dokter) — tabel kunjungan tidak punya FK ke dokter.
            // Nama dokter di-resolve dari window._usersCache via user_id (sama seperti sb_initData).
            riwayatRows = await _sbFetch(
                `kunjungan?pasien_id=eq.${currentPasienId}&order=tgl.desc,waktu.desc&select=*`
            );
        }

        // Pastikan users cache tersedia untuk resolve nama dokter
        if (!window._usersCache || window._usersCache.length === 0) {
            try {
                const users = await _sbFetch('users?select=id,nama,jabatan&order=nama.asc');
                window._usersCache = users || [];
            } catch(e) { window._usersCache = []; }
        }

        currentRiwayat = riwayatRows.map(r => {
            // Resolve nama dokter dari cache users berdasarkan user_id
            const dokterUser = r.user_id
                ? (window._usersCache || []).find(u => u.id === r.user_id && u.jabatan?.toLowerCase() === 'dokter')
                : null;
            return {
                id:        r.id,
                tgl:       r.tgl,
                waktu:     r.waktu,
                td:        r.td,
                nadi:      r.nadi,
                suhu:      r.suhu,
                rr:        r.rr,
                bb:        r.bb,
                tb:        r.tb,
                keluhan:   r.keluhan,
                fisik:     r.fisik,
                lab_gds:   r.lab_gds,
                lab_chol:  r.lab_chol,
                lab_ua:    r.lab_ua,
                lab_hb:         r.lab_hb,
                lab_trombosit:  r.lab_trombosit,
                lab_leukosit:   r.lab_leukosit,
                lab_eritrosit:  r.lab_eritrosit,
                lab_hematokrit: r.lab_hematokrit,
                lab_hiv:        r.lab_hiv,
                lab_sifilis:    r.lab_sifilis,
                lab_hepatitis:  r.lab_hepatitis,
                lab_hdl:        r.lab_hdl,
                lab_ldl:        r.lab_ldl,
                lab_tg:         r.lab_tg,
                lab_gdp:        r.lab_gdp,
                lab_hba1c:      r.lab_hba1c,
                lab_sgot:       r.lab_sgot,
                lab_sgpt:       r.lab_sgpt,
                lab_ureum:      r.lab_ureum,
                lab_creatinin:  r.lab_creatinin,
                req_lab:   r.req_lab,
                diag:      r.diagnosa,   // FIX: kolom di DB adalah 'diagnosa', bukan 'diag'
                diagnosa2: r.diagnosa2,
                terapi:    r.terapi,
                surat_sakit: r.surat_sakit,
                status:    r.status,
                user_id:   r.user_id,
                status_obat:  !!r.status_obat,
                status_bayar: !!r.status_bayar,
                dokterNama: dokterUser ? dokterUser.nama : ''
            };
        });
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        if (typeof renderRiwayatList === 'function') renderRiwayatList(currentRiwayat, 'historyListMedis');
    } catch(e) {
        currentRiwayat = [];
        try { currentRiwayat = JSON.parse(localStorage.getItem('cP_riwayat') || '[]'); } catch(e2) {}
        if (typeof renderRiwayatList === 'function') renderRiwayatList(currentRiwayat, 'historyListMedis');
    }

    calculateIMT();
    checkTensi();
    checkLabAlert();

    switchPage('pageMedis', null);
    // Terapkan lock UI setelah halaman aktif — setTimeout agar DOM render dulu
    setTimeout(_applyLockUI, 50);
}

// ── ESCAPE HTML ──
function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════
//  MODAL DETAIL PASIEN (dari riwayat list)
//  Urutan tampilan sesuai section pemeriksaan medis:
//  1. Keluhan  2. Tanda Vital  3. Pemeriksaan Labor
//  4. Penunjang  5. Diagnosa  6. Tindakan  7. Dokter
// ════════════════════════════════════════════════════════

function openModal(idx) {
    const list = (typeof currentRiwayat !== 'undefined' ? currentRiwayat : []);
    const r    = list[idx];
    if (!r) return;

    // Hapus modal lama jika ada
    const old = document.getElementById('_modalDetailPasien');
    if (old) old.remove();

    // ── Helper row ──
    function _row(label, val, color) {
        if (!val || String(val).trim() === '' || String(val).trim() === '-') return '';
        const c = color ? `color:${color};` : '';
        return `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:3px;">${label}</div>
            <div style="font-size:13px;${c}color:${color||'#1e293b'};">${escHtml(String(val))}</div>
        </div>`;
    }

    // ── 1. Keluhan ──
    let sectHtml = '';
    sectHtml += _row('💬 Keluhan', r.keluhan);

    // ── 2. Tanda Vital ──
    const ttvParts = [
        r.td    ? `TD ${r.td} mmHg`   : '',
        r.nadi  ? `N ${r.nadi} x/mnt` : '',
        r.suhu  ? `S ${r.suhu}°C`     : '',
        r.rr    ? `RR ${r.rr} x/mnt`  : '',
        r.bb    ? `BB ${r.bb} kg`     : '',
        r.tb    ? `TB ${r.tb} cm`     : '',
    ].filter(Boolean).join('  |  ');
    if (ttvParts) {
        sectHtml += `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:3px;">❤️ Tanda Vital</div>
            <div style="font-size:12px;color:#1e293b;line-height:1.7;">${escHtml(ttvParts)}</div>
        </div>`;
    }

    // ── 3. Pemeriksaan Labor ──
    // Parse req_lab untuk cek apakah hasil sudah ada atau masih permintaan
    let reqObj = {};
    try { reqObj = r.req_lab ? (typeof r.req_lab === 'string' ? JSON.parse(r.req_lab) : r.req_lab) : {}; } catch(e) {}

    // Lab dari field numerik kunjungan (GDS, Kol, AU, dll.)
    const labFieldMap = {
        'GDS': r.lab_gds, 'Kolesterol': r.lab_chol, 'Asam Urat': r.lab_ua,
        'HB': r.lab_hb, 'Trombosit': r.lab_trombosit, 'Leukosit': r.lab_leukosit,
        'Eritrosit': r.lab_eritrosit, 'Hematokrit': r.lab_hematokrit,
        'HIV': r.lab_hiv, 'Sifilis': r.lab_sifilis, 'Hepatitis B': r.lab_hepatitis,
        'HDL': r.lab_hdl, 'LDL': r.lab_ldl, 'Trigliserida': r.lab_tg,
        'GDP': r.lab_gdp, 'HbA1c': r.lab_hba1c,
        'SGOT': r.lab_sgot, 'SGPT': r.lab_sgpt,
        'Ureum': r.lab_ureum, 'Kreatinin': r.lab_creatinin,
    };
    const labHasilItems = Object.entries(labFieldMap).filter(([, v]) => v && String(v).trim() && String(v).trim() !== '0');

    // Lab dari req_lab accordion (lab_req_*)
    const labReqItems  = []; // permintaan (belum ada hasil)
    const labReqHasil  = []; // sudah ada nilai hasil di field
    Object.entries(reqObj).forEach(([k, v]) => {
        if (!v || !k.startsWith('lab_req_')) return;
        const nameKey = '_labname_' + k;
        const labNama = reqObj[nameKey] || k.replace('lab_req_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        // Cek apakah hasil sudah ada di labFieldMap (by name)
        const sudahAda = labHasilItems.some(([n]) => n.toLowerCase() === labNama.toLowerCase());
        if (sudahAda) labReqHasil.push(labNama);
        else          labReqItems.push(labNama);
    });

    // Gabung semua lab: hasil dulu, permintaan belum ada hasil setelahnya
    let laborHtml = '';
    if (labHasilItems.length > 0) {
        const rows = labHasilItems.map(([n, v]) => `<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:3px 9px;font-size:11px;margin:2px 3px 2px 0;"><b style="color:#1d4ed8;">${escHtml(n)}</b><span style="color:#334155;">${escHtml(String(v))}</span></span>`).join('');
        laborHtml += `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:5px;">🔬 Hasil Labor</div>
            <div style="display:flex;flex-wrap:wrap;">${rows}</div>
        </div>`;
    }
    if (labReqItems.length > 0) {
        const chips = labReqItems.map(n => `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(37,99,235,0.09);border:1px solid rgba(37,99,235,0.25);border-radius:8px;padding:3px 9px;font-size:11px;color:#1d4ed8;margin:2px 3px 2px 0;">🧪 ${escHtml(n)}</span>`).join('');
        laborHtml += `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:5px;">🧪 Permintaan Labor</div>
            <div style="display:flex;flex-wrap:wrap;">${chips}</div>
        </div>`;
    }
    sectHtml += laborHtml;

    // ── 4. Penunjang ──
    // Cek apakah setiap penunjang sudah ada hasil (hasil_penunjang_*) atau masih permintaan
    const pnjHasil   = []; // { nama, hasil }
    const pnjReqOnly = []; // hanya permintaan
    Object.entries(reqObj).forEach(([k, v]) => {
        if (!v || !k.startsWith('penunjang_') || k.startsWith('hasil_') || k.startsWith('foto_')) return;
        const namaRaw  = k.replace('penunjang_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const hasilKey = 'hasil_' + k;
        const hasilVal = reqObj[hasilKey];
        if (hasilVal && String(hasilVal).trim()) {
            pnjHasil.push({ nama: namaRaw, hasil: String(hasilVal).trim() });
        } else {
            pnjReqOnly.push(namaRaw);
        }
    });

    let pnjHtml = '';
    if (pnjHasil.length > 0) {
        const rows = pnjHasil.map(p => `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:7px 10px;margin-bottom:5px;font-size:12px;"><b style="color:#15803d;">${escHtml(p.nama)}</b><div style="color:#1e293b;margin-top:3px;white-space:pre-wrap;">${escHtml(p.hasil)}</div></div>`).join('');
        pnjHtml += `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:5px;">🔊 Hasil Penunjang</div>
            ${rows}
        </div>`;
    }
    if (pnjReqOnly.length > 0) {
        const chips = pnjReqOnly.map(n => `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(124,58,237,0.09);border:1px solid rgba(124,58,237,0.25);border-radius:8px;padding:3px 9px;font-size:11px;color:#6d28d9;margin:2px 3px 2px 0;">🔬 ${escHtml(n)}</span>`).join('');
        pnjHtml += `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:5px;">🔊 Permintaan Penunjang</div>
            <div style="display:flex;flex-wrap:wrap;">${chips}</div>
        </div>`;
    }
    sectHtml += pnjHtml;

    // ── 5. Diagnosa ──
    const diagStr = [r.diag, r.diagnosa2].filter(Boolean).join(' / ');
    sectHtml += _row('🩺 Diagnosa', diagStr, '#7c3aed');

    // ── 6. Tindakan ──
    const tidItems = Object.entries(reqObj)
        .filter(([k, v]) => v === true && k.startsWith('tindakan_'))
        .map(([k]) => {
            const nameKey = '_tidname_' + k;
            return reqObj[nameKey] || k.replace('tindakan_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        });
    if (tidItems.length > 0) {
        const chips = tidItems.map(n => `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(220,38,38,0.09);border:1px solid rgba(220,38,38,0.22);border-radius:8px;padding:3px 9px;font-size:11px;color:#b91c1c;margin:2px 3px 2px 0;">⚕️ ${escHtml(n)}</span>`).join('');
        sectHtml += `<div style="padding:7px 0;border-bottom:1px dashed rgba(0,0,0,0.07);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:5px;">⚕️ Tindakan</div>
            <div style="display:flex;flex-wrap:wrap;">${chips}</div>
        </div>`;
    }

    // ── 7. Dokter Pemeriksa ──
    if (r.dokterNama) {
        sectHtml += `<div style="padding:7px 0;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:3px;">👨‍⚕️ Dokter Pemeriksa</div>
            <div style="font-size:13px;color:#059669;font-weight:600;">dr. ${escHtml(r.dokterNama)}</div>
        </div>`;
    }

    // ── Bangun modal ──
    const modal = document.createElement('div');
    modal.id = '_modalDetailPasien';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.52);display:flex;align-items:flex-end;justify-content:center;animation:_dm_fadein .18s ease;';

    modal.innerHTML = `
    <style>
        @keyframes _dm_fadein  { from{opacity:0} to{opacity:1} }
        @keyframes _dm_slideup { from{transform:translateY(50px);opacity:0} to{transform:translateY(0);opacity:1} }
    </style>
    <div style="background:#fff;width:100%;max-width:520px;border-radius:22px 22px 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,0.18);max-height:88vh;display:flex;flex-direction:column;
        animation:_dm_slideup .22s cubic-bezier(.34,1.56,.64,1);">

        <!-- Handle bar -->
        <div style="flex-shrink:0;padding:12px 16px 0;">
            <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:0 auto 12px;"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:13px;font-weight:800;color:#1e293b;">📋 Detail Kunjungan</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">📅 ${formatTglIndo(r.tgl)} &nbsp;·&nbsp; ${r.waktu || '00:00'}</div>
                </div>
                <button onclick="document.getElementById('_modalDetailPasien').remove()"
                    style="background:#f1f5f9;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
        </div>

        <!-- Content -->
        <div style="overflow-y:auto;padding:10px 16px 20px;flex:1;">
            ${sectHtml || '<div style="padding:20px;text-align:center;color:#94a3b8;">Belum ada data.</div>'}
        </div>
    </div>`;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

// ════════════════════════════════════════════════════════
//  RENDER LIST RIWAYAT (HISTORY)
// ════════════════════════════════════════════════════════
function renderRiwayatList(list, containerId) {
    const c = $(containerId);
    if (!c) return;

    if (list && list.length > 0) {
        c.innerHTML = list.map((r, i) => {
            const labStr = [
                r.lab_gds  ? `GDS ${r.lab_gds}`   : '',
                r.lab_chol ? `Kol ${r.lab_chol}`  : '',
                r.lab_ua   ? `AU ${r.lab_ua}`      : ''
            ].filter(Boolean).join(' | ');

            const st       = r.id ? _getStatusKunjungan(r.id) : { obat: false, bayar: false };
            const obatDone = st.obat;
            const bayarDone= st.bayar;

            const jabatan = ((typeof loggedInUser !== 'undefined' && loggedInUser) ? (loggedInUser.jabatan || '') : '').toLowerCase();
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
                    ${labStr ? `<div style="font-size:11px;margin-bottom:6px;color:#7c3aed;background:rgba(124,58,237,0.07);padding:4px 8px;border-radius:8px;"><b>🔬 Lab:</b> ${labStr}</div>` : ''}
                    ${window._isParamedis ? '' : `<div class="riwayat-diag" style="margin-bottom:3px;">🩺 ${r.diag || 'Menunggu Diagnosa'}</div>`}
                    <div class="riwayat-keluhan" style="color:var(--text); border-top:1px dashed var(--border); padding-top:4px; margin-bottom:3px;"><b>Keluhan:</b> ${r.keluhan || '-'}</div>
                    <div class="riwayat-keluhan" style="color:var(--text);margin-bottom:6px;"><b>Terapi:</b> ${r.terapi || '-'}</div>
                    ${r.dokterNama ? `<div style="font-size:10px;color:#059669;font-weight:600;padding-top:4px;border-top:1px dashed var(--border);">👨‍⚕️ Diperiksa oleh: ${r.dokterNama}</div>` : ''}
                    <!-- Penanda status -->
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

// ════════════════════════════════════════════════════════
//  DYNAMIC LAB SECTION
//  Sumber data: window._tarifCache (Page Biaya) — single source of truth
//  Fallback ke window._labAktif (Settings) jika _tarifCache kosong
// ════════════════════════════════════════════════════════

// Peta nama tarif di DB → id field input di form
// Nama HARUS persis sama dengan kolom `nama` di tarif_layanan
const LAB_TARIF_TO_FIELD = {
    'GDS'               : 'lab_gds',
    'Kolesterol'        : 'lab_chol',
    'Asam Urat'         : 'lab_ua',
    'Hemoglobin (HB)'   : 'lab_hb',
    'Trombosit'         : 'lab_trombosit',
    'Leukosit'          : 'lab_leukosit',
    'Eritrosit'         : 'lab_eritrosit',
    'Hematokrit'        : 'lab_hematokrit',
    'HIV'               : 'lab_hiv',
    'Sifilis'           : 'lab_sifilis',
    'Hepatitis B'       : 'lab_hepatitis',
    'HDL'               : 'lab_hdl',
    'LDL'               : 'lab_ldl',
    'Trigliserida'      : 'lab_tg',
    'GDP'               : 'lab_gdp',
    'HbA1c'             : 'lab_hba1c',
    'SGOT'              : 'lab_sgot',
    'SGPT'              : 'lab_sgpt',
    'Ureum'             : 'lab_ureum',
    'Creatinin'         : 'lab_creatinin',
};

const ALL_LAB_FIELDS = [
    { id: 'lab_gds',       label: 'GDS',           unit: 'mg/dL',    step: '1',   group: 'dasar' },
    { id: 'lab_chol',      label: 'Kolesterol',     unit: 'mg/dL',    step: '1',   group: 'dasar' },
    { id: 'lab_ua',        label: 'Asam Urat',      unit: 'mg/dL',    step: '0.1', group: 'dasar' },
    { id: 'lab_hb',        label: 'HB',             unit: 'g/dL',     step: '0.1', group: 'darah_rutin' },
    { id: 'lab_trombosit', label: 'Trombosit',      unit: 'ribu/µL',  step: '1',   group: 'darah_rutin' },
    { id: 'lab_leukosit',  label: 'Leukosit',       unit: 'ribu/µL',  step: '0.1', group: 'darah_rutin' },
    { id: 'lab_eritrosit', label: 'Eritrosit',      unit: 'juta/µL',  step: '0.01',group: 'darah_rutin' },
    { id: 'lab_hematokrit',label: 'Hematokrit',     unit: '%',        step: '0.1', group: 'darah_rutin' },
    { id: 'lab_hiv',       label: 'HIV',            unit: 'hasil',    step: null,  group: 'triple', type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    { id: 'lab_sifilis',   label: 'Sifilis',        unit: 'hasil',    step: null,  group: 'triple', type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    { id: 'lab_hepatitis', label: 'Hepatitis B',    unit: 'hasil',    step: null,  group: 'triple', type: 'select', opts: ['—','Non-Reaktif','Reaktif'] },
    { id: 'lab_hdl',       label: 'HDL',            unit: 'mg/dL',    step: '1',   group: 'lemak' },
    { id: 'lab_ldl',       label: 'LDL',            unit: 'mg/dL',    step: '1',   group: 'lemak' },
    { id: 'lab_tg',        label: 'Trigliserida',   unit: 'mg/dL',    step: '1',   group: 'lemak' },
    { id: 'lab_gdp',       label: 'GDP',            unit: 'mg/dL',    step: '1',   group: 'gula' },
    { id: 'lab_hba1c',     label: 'HbA1c',          unit: '%',        step: '0.1', group: 'gula' },
    { id: 'lab_sgot',      label: 'SGOT',           unit: 'U/L',      step: '1',   group: 'hati' },
    { id: 'lab_sgpt',      label: 'SGPT',           unit: 'U/L',      step: '1',   group: 'hati' },
    { id: 'lab_ureum',     label: 'Ureum',          unit: 'mg/dL',    step: '1',   group: 'ginjal' },
    { id: 'lab_creatinin', label: 'Kreatinin',      unit: 'mg/dL',    step: '0.01',group: 'ginjal' },
];

const LAB_GROUP_LABELS = {
    dasar:       '🩸 Lab Dasar',
    darah_rutin: '🔴 Darah Rutin',
    triple:      '🧬 Triple Eliminasi',
    lemak:       '💧 Profil Lemak',
    gula:        '🍬 Gula Darah',
    hati:        '🫀 Fungsi Hati',
    ginjal:      '🫘 Fungsi Ginjal',
};

function _renderSectionLabDinamic() {
    const section = $('sectionLab');
    if (!section) return;

    // ── Tangani section resep / terapi (tidak berubah) ──
    if (window._stokAktif && typeof renderSectionResep === 'function') {
        renderSectionResep(currentKunjunganId || null);
        const secResep  = document.getElementById('sectionResep');
        const secManual = document.getElementById('sectionTerapiManual');
        if (secResep)  secResep.style.display  = '';
        if (secManual) secManual.style.display = 'none';
    }

    // ── Section lab lama (field group per baris) dihapus.
    //    Semua input laboratorium kini dirender oleh accordion _renderChipPermintaanLab()
    //    di pemeriksaan-medis.js. Fungsi ini hanya memastikan section terlihat dan
    //    memicu render accordion + penunjang.
    // ──

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

    // Render accordion lab (dari pemeriksaan-medis.js)
    if (typeof _renderChipPermintaanLab === 'function') _renderChipPermintaanLab();

    // Render section permintaan penunjang setelah lab
    if (typeof renderSectionPermintaanLab === 'function') renderSectionPermintaanLab();
}

// ── Helper: buka invoice dari tombol di riwayat list ──
function _bukaInvoiceRiwayat(btn) {
    const kunjId = btn.getAttribute('data-kunjid');
    const tgl    = btn.getAttribute('data-tgl');
    const nama   = (typeof allPatients !== 'undefined' && currentPasienId)
        ? (allPatients.find(p => p.id === currentPasienId)?.nama || '')
        : '';
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kunjId, nama, tgl);
    }
}

/** Helper: buka resep dari tombol di riwayat list */
async function _bukaResepRiwayat(btn) {
    const kunjId = btn.getAttribute('data-kunjid');
    const tgl    = btn.getAttribute('data-tgl') || '';
    // Cari nama pasien dari currentRiwayat atau allPatients
    let nama = btn.getAttribute('data-nama') || '';
    if (!nama && typeof currentPasienId !== 'undefined' && currentPasienId) {
        const p = (typeof allPatients !== 'undefined' ? allPatients : []).find(x => x.id === currentPasienId);
        if (p) nama = p.nama || '';
    }
    try {
        const items = await sb_getResepByKunjungan(kunjId);
        if (!items || items.length === 0) {
            showToast('ℹ️ Tidak ada resep pada kunjungan ini', 'info');
            return;
        }
        _tampilModalResep(kunjId, nama, items, tgl);
    } catch(e) {
        showToast("❌ Gagal memuat resep", "error");
    }
}

// ════════════════════════════════════════════════════════
//  MODAL RESEP PROFESIONAL
// ════════════════════════════════════════════════════════

function _tampilModalResep(kunjId, namaPasien, items, tgl) {
    // Hapus modal lama jika ada
    const old = document.getElementById('modalResepPro');
    if (old) old.remove();

    // Ambil info klinik & dokter dari window globals
    const klinikNama   = window.KLINIK_NAMA  || 'Klinik';
    const klinikAlamat = (window._settingsFull && window._settingsFull.klinik_alamat) || '';
    const klinikTelp   = (window._settingsFull && window._settingsFull.klinik_telp)   || '';

    // Cari dokter dari kunjungan (ambil dari cache atau _dokterAktif)
    let dokterNama = '';
    const kunjData = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : []).find(x => x.id === kunjId);
    if (kunjData && kunjData.dokterNama) {
        dokterNama = kunjData.dokterNama;
    } else if (window._dokterAktif && window._dokterAktif.length > 0) {
        dokterNama = window._dokterAktif[0].nama || '';
    }

    // Format tanggal
    const tglFmt = tgl ? (typeof formatTglIndo === 'function' ? formatTglIndo(tgl) : tgl) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Baris item resep
    const itemsHtml = items.map((r, i) => {
        const satuan   = r.obat?.satuan || 'tablet';
        const frek     = r.frekuensi || '';
        const catatan  = r.catatan   || '';
        return `
        <tr style="border-bottom:1px dashed #e2e8f0;">
            <td style="padding:9px 6px;font-weight:700;color:#1e293b;vertical-align:top;width:24px;">
                ${i + 1}.
            </td>
            <td style="padding:9px 6px;vertical-align:top;">
                <div style="font-weight:700;font-size:13px;color:#1e293b;">${escHtml(r.nama_obat)}</div>
                ${catatan ? `<div style="font-size:10.5px;color:#64748b;margin-top:2px;font-style:italic;">${escHtml(catatan)}</div>` : ''}
            </td>
            <td style="padding:9px 6px;text-align:center;vertical-align:top;white-space:nowrap;">
                <div style="font-size:13px;font-weight:700;color:#2563eb;">${r.jumlah} ${escHtml(satuan)}</div>
            </td>
            <td style="padding:9px 6px;text-align:center;vertical-align:top;white-space:nowrap;">
                <div style="font-size:12px;font-weight:600;color:#059669;background:#ecfdf5;border-radius:6px;padding:2px 8px;display:inline-block;">${escHtml(frek)}</div>
            </td>
        </tr>`;
    }).join('');

    // Konten yang akan dicetak
    const printContent = `
        <div style="text-align:center;border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:14px;">
            <div style="font-size:18px;font-weight:800;color:#1e3a8a;letter-spacing:-0.5px;">${escHtml(klinikNama)}</div>
            ${klinikAlamat ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${escHtml(klinikAlamat)}</div>` : ''}
            ${klinikTelp   ? `<div style="font-size:11px;color:#64748b;">Telp: ${escHtml(klinikTelp)}</div>` : ''}
        </div>
        <div style="text-align:center;margin-bottom:14px;">
            <div style="display:inline-block;background:#2563eb;color:#fff;font-size:12px;font-weight:800;padding:3px 20px;border-radius:20px;letter-spacing:1px;">R E S E P</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:12px;gap:10px;">
            <div>
                <span style="color:#64748b;">Pasien:</span>
                <strong style="color:#1e293b;"> ${escHtml(namaPasien)}</strong>
            </div>
            <div style="text-align:right;">
                <span style="color:#64748b;">Tanggal:</span>
                <strong style="color:#1e293b;"> ${tglFmt}</strong>
            </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
            <thead>
                <tr style="background:#eff6ff;border-bottom:2px solid #bfdbfe;">
                    <th style="padding:7px 6px;font-size:10px;color:#1e40af;text-align:left;font-weight:800;text-transform:uppercase;letter-spacing:.5px;" colspan="2">Nama Obat</th>
                    <th style="padding:7px 6px;font-size:10px;color:#1e40af;text-align:center;font-weight:800;text-transform:uppercase;letter-spacing:.5px;">Jumlah</th>
                    <th style="padding:7px 6px;font-size:10px;color:#1e40af;text-align:center;font-weight:800;text-transform:uppercase;letter-spacing:.5px;">Frekuensi</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;">
            <div style="font-size:10.5px;color:#94a3b8;font-style:italic;">*Harap hubungi dokter jika ada reaksi tidak diinginkan</div>
            <div style="text-align:center;min-width:110px;">
                <div style="font-size:11px;color:#64748b;margin-bottom:36px;">Dokter Pemeriksa,</div>
                <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:11.5px;font-weight:700;color:#1e293b;">${escHtml(dokterNama || '_______________')}</div>
            </div>
        </div>`;

    // Bangun modal
    const modal = document.createElement('div');
    modal.id = 'modalResepPro';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:10000;
        background:rgba(15,23,42,0.55);
        display:flex;align-items:flex-end;justify-content:center;
        padding:0;animation:_fadeInModal .2s ease;`;

    modal.innerHTML = `
    <style>
        @keyframes _fadeInModal { from{opacity:0} to{opacity:1} }
        @keyframes _slideUpModal { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
        @media print {
            body > *:not(#modalResepPro) { display:none !important; }
            #modalResepPro { position:static!important;background:none!important;padding:0!important; }
            #resepProShell { box-shadow:none!important;border-radius:0!important;max-height:none!important;overflow:visible!important;width:100%!important; }
            #resepProActions { display:none!important; }
        }
    </style>
    <div id="resepProShell" style="
        background:#fff;width:100%;max-width:480px;
        border-radius:20px 20px 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,0.18);
        max-height:90vh;display:flex;flex-direction:column;
        animation:_slideUpModal .25s cubic-bezier(.34,1.56,.64,1);">

        <!-- Handle -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 0;">
            <div style="font-size:14px;font-weight:800;color:#1e293b;">💊 Resep Obat</div>
            <button onclick="document.getElementById('modalResepPro').remove()"
                style="background:rgba(100,116,139,0.1);border:none;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;">✕</button>
        </div>
        <div style="width:40px;height:4px;background:#e2e8f0;border-radius:2px;margin:8px auto 0;"></div>

        <!-- Body resep (scrollable) -->
        <div style="overflow-y:auto;padding:16px 16px 0;flex:1;">
            <div id="resepProContent" style="font-family:'Sora',sans-serif;font-size:12px;color:#1e293b;">
                ${printContent}
            </div>
        </div>

        <!-- Tombol aksi -->
        <div id="resepProActions" style="padding:12px 16px 20px;display:flex;gap:8px;border-top:1px solid #f1f5f9;flex-shrink:0;">
            <button onclick="_cetakResepIsolated()"
                style="flex:1;padding:11px 0;background:linear-gradient(135deg,#2563eb,#60a5fa);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
                🖨️ Cetak Resep
            </button>
            <button onclick="document.getElementById('modalResepPro').remove()"
                style="padding:11px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;">
                Tutup
            </button>
        </div>
    </div>`;

    // Tutup modal saat klik backdrop
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

/**
 * BUG-11 FIX: Cetak resep via window baru yang terisolasi agar tidak mencetak
 * seluruh halaman. Pola ini sama dengan printInvoice() sehingga konsisten.
 */
function _cetakResepIsolated() {
    const contentEl = document.getElementById('resepProContent');
    if (!contentEl) { window.print(); return; }
    const content = contentEl.innerHTML;

    const win = window.open('', '_blank', 'width=480,height=700');
    if (!win) {
        if (typeof showToast === 'function') showToast('⚠️ Izinkan popup untuk cetak resep', 'error');
        return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Resep Obat</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:16px; }
  @media print { @page { size:A5;margin:8mm; } body { padding:0; } }
</style>
</head>
<body>${content}</body>
<script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
</html>`);
    win.document.close();
}

// ════════════════════════════════════════════════════════
//  EDIT LOCK — kunjungan > 2 hari tidak bisa disimpan
// ════════════════════════════════════════════════════════

/**
 * Kembalikan true jika kunjungan yang sedang dibuka sudah lewat 2 hari
 * (tanggal kunjungan < hari ini - 2 hari), sehingga tidak boleh diedit.
 * Kunjungan BARU (currentKunjunganId null) selalu false (tidak terkunci).
 */
function _isKunjunganTerkunci() {
    if (!currentKunjunganId || currentKunjunganId === 'null') return false;

    let tglStr = null;
    const kCache = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : [])
        .find(x => x.id === currentKunjunganId);
    if (kCache && kCache.tgl) {
        tglStr = kCache.tgl; // format YYYY-MM-DD
    } else {
        // Fallback: baca cTglEdit "Tgl: DD/MM/YYYY" dari localStorage
        const raw = localStorage.getItem('cTglEdit') || '';
        const m = raw.replace('Tgl: ', '').trim();
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
 * Dipanggil setelah switchPage('pageMedis') dan saat initApp restore pageMedis.
 */
function _applyLockUI() {
    const terkunci = _isKunjunganTerkunci();

    // ── Tombol utama Simpan Rekam Medis ──
    const btnSave = $('btnSave');
    if (btnSave) {
        btnSave.disabled = terkunci;
        if (terkunci) {
            btnSave.innerText = '🔒 Rekam Medis Terkunci (> 2 Hari)';
            btnSave.style.cssText = 'width:100%;padding:12px;border-radius:12px;font-size:13px;font-weight:800;background:#e2e8f0;color:#94a3b8;border:none;cursor:not-allowed;';
        } else {
            btnSave.innerText = '✓ Simpan Rekam Medis';
            btnSave.style.cssText = '';
        }
    }

    // ── Tombol mini save di tiap section ──
    document.querySelectorAll('._mini-save-btn').forEach(b => {
        b.disabled = terkunci;
        b.style.opacity     = terkunci ? '0.38' : '';
        b.style.cursor      = terkunci ? 'not-allowed' : '';
        b.style.borderStyle = terkunci ? 'dashed' : '';
    });

    // ── Banner notifikasi di atas pageMedis ──
    const LOCK_ID = 'pageMedisLockBanner';
    let banner = $(LOCK_ID);
    if (terkunci) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = LOCK_ID;
            banner.style.cssText = 'position:sticky;top:0;z-index:200;padding:9px 16px;background:rgba(239,68,68,0.1);border-bottom:1.5px solid rgba(239,68,68,0.3);color:#dc2626;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:8px;border-radius:0 0 10px 10px;';
            banner.innerHTML = '🔒 Rekam medis ini sudah lebih dari 2 hari dan tidak dapat diubah.';
            const page = $('pageMedis');
            if (page) page.insertBefore(banner, page.firstChild);
        }
    } else {
        if (banner) banner.remove();
    }
}

// ════════════════════════════════════════════════════════
//  SIMPAN REKAM MEDIS — saveAll()
//  Dipanggil dari tombol "✓ Simpan Rekam Medis" di page-medis.html
//  Mengumpulkan semua nilai form dan mengirim ke sb_saveKunjungan()
// ════════════════════════════════════════════════════════
async function saveAll(showInvoice = true) {
    const btn = $('btnSave');
    if (btn) { btn.disabled = true; btn.innerText = '⏳ Menyimpan...'; }

    try {
        // ── Cek edit lock (kunjungan > 2 hari) ──
        if (_isKunjunganTerkunci()) {
            showToast('🔒 Rekam medis ini sudah lebih dari 2 hari dan tidak dapat diubah.', 'warning');
            return;
        }

        // ── Validasi minimal ──
        if (!currentPasienId || currentPasienId === 'null') {
            showToast('⚠️ Data pasien tidak ditemukan. Daftar ulang dari halaman Daftar.', 'warning');
            return;
        }

        // ── Validasi nilai vital ──
        const vitalErrors = (typeof validasiNilaiVital === 'function') ? validasiNilaiVital() : [];
        if (vitalErrors && vitalErrors.length > 0) {
            showToast('⚠️ ' + vitalErrors[0], 'warning');
            return;
        }

        // ── Tanggal & waktu ──
        // BUG-DATE FIX: Jika ini EDIT kunjungan lama (currentKunjunganId sudah ada),
        // ambil tgl & waktu dari data kunjungan asli (via cache kunjunganHariIni
        // atau cTglEdit localStorage), BUKAN dari new Date() hari ini.
        // Nilai localDate/localTime hanya benar-benar dipakai saat INSERT kunjungan baru
        // (sb_saveKunjungan sudah guard: tgl/waktu tidak di-PATCH jika kunjunganId ada),
        // tapi kita tetap kirim nilai yang benar agar tidak membingungkan.
        const today      = new Date();
        const tzOffset   = today.getTimezoneOffset() * 60000;
        const _todayDate = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
        const _todayTime = String(today.getHours()).padStart(2,'0') + ':' + String(today.getMinutes()).padStart(2,'0');

        // Jika edit kunjungan lama — pakai tgl/waktu asli dari cache
        let localDate = _todayDate;
        let localTime = _todayTime;
        if (currentKunjunganId) {
            // Coba ambil dari kunjunganHariIni cache (sudah ada tgl & waktu)
            const _kCache = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : [])
                .find(x => x.id === currentKunjunganId);
            if (_kCache && _kCache.tgl) {
                localDate = _kCache.tgl;
                if (_kCache.waktu) localTime = _kCache.waktu;
            } else {
                // Fallback: baca dari localStorage cTglEdit (format "Tgl: DD/MM/YYYY")
                const _cTgl = localStorage.getItem('cTglEdit') || '';
                const _tglMatch = _cTgl.replace('Tgl: ', '').trim();
                if (_tglMatch && _tglMatch.includes('/')) {
                    // Format DD/MM/YYYY → YYYY-MM-DD
                    const _p = _tglMatch.split('/');
                    if (_p.length === 3) localDate = `${_p[2]}-${_p[1]}-${_p[0]}`;
                }
            }
        }

        // ── Gabungkan sistol/diastol ──
        const sistol  = $('sistol')  ? $('sistol').value.trim()  : '';
        const diastol = $('diastol') ? $('diastol').value.trim() : '';
        const td      = (sistol && diastol) ? `${sistol}/${diastol}` : (sistol || diastol || '');

        // ── Diagnosa 1 + 2 ──
        const diag1 = $('diagnosa')  ? $('diagnosa').value.trim()  : '';
        const diag2 = $('diagnosa2') ? $('diagnosa2').value.trim() : '';

        // ── Surat sakit ──
        const suratSakit = ($('suratSakit') && $('suratSakit').checked) ? 'YA' : null;

        // ── User ID (dokter yang login) ──
        const userId = (typeof loggedInUser !== 'undefined' && loggedInUser) ? loggedInUser.id : null;

        // ── Ambil data pasien dari form (untuk update profil) ──
        // Guard: jika $('nama') kosong (field di pageDaftar tidak visible/belum terisi),
        // fallback ke localStorage cP_nama agar pasien record tidak ter-PATCH dengan nama kosong.
        const _namaDariForm = $('nama') ? $('nama').value.trim() : '';
        const namaPasien = _namaDariForm || localStorage.getItem('cP_nama') || '';
        const nik        = $('nik')       ? $('nik').value.trim()       : '';
        const jk         = $('jk')        ? $('jk').value               : 'L';
        const tgl_lahir  = $('tgl_lahir') ? $('tgl_lahir').value.trim() : '';
        const alamat     = $('alamat')    ? $('alamat').value.trim()    : '';
        const alergi     = $('alergi')    ? $('alergi').value.trim()    : '';

        const payload = {
            pasienId:    currentPasienId,
            kunjunganId: currentKunjunganId,
            localDate, localTime,
            userId,
            nama: namaPasien, nik, tgl_lahir, jk, alamat, alergi,
            td,
            nadi:  $('nadi') ? $('nadi').value : '',
            suhu:  $('suhu') ? $('suhu').value : '',
            rr:    $('rr')   ? $('rr').value   : '',
            bb:    $('bb')   ? $('bb').value   : '',
            tb:    $('tb')   ? $('tb').value   : '',
            // Lab dasar
            lab_gds:  $('lab_gds')  ? $('lab_gds').value  : '',
            lab_chol: $('lab_chol') ? $('lab_chol').value : '',
            lab_ua:   $('lab_ua')   ? $('lab_ua').value   : '',
            // Darah rutin
            lab_hb:         $('lab_hb')         ? $('lab_hb').value         : '',
            lab_trombosit:  $('lab_trombosit')  ? $('lab_trombosit').value  : '',
            lab_leukosit:   $('lab_leukosit')   ? $('lab_leukosit').value   : '',
            lab_eritrosit:  $('lab_eritrosit')  ? $('lab_eritrosit').value  : '',
            lab_hematokrit: $('lab_hematokrit') ? $('lab_hematokrit').value : '',
            // Triple eliminasi
            lab_hiv:      $('lab_hiv')      ? $('lab_hiv').value      : '',
            lab_sifilis:  $('lab_sifilis')  ? $('lab_sifilis').value  : '',
            lab_hepatitis:$('lab_hepatitis')? $('lab_hepatitis').value : '',
            // Profil lemak
            lab_hdl: $('lab_hdl') ? $('lab_hdl').value : '',
            lab_ldl: $('lab_ldl') ? $('lab_ldl').value : '',
            lab_tg:  $('lab_tg')  ? $('lab_tg').value  : '',
            // Gula darah
            lab_gdp:   $('lab_gdp')   ? $('lab_gdp').value   : '',
            lab_hba1c: $('lab_hba1c') ? $('lab_hba1c').value : '',
            // Fungsi hati
            lab_sgot: $('lab_sgot') ? $('lab_sgot').value : '',
            lab_sgpt: $('lab_sgpt') ? $('lab_sgpt').value : '',
            // Fungsi ginjal
            lab_ureum:    $('lab_ureum')    ? $('lab_ureum').value    : '',
            lab_creatinin:$('lab_creatinin')? $('lab_creatinin').value : '',
            // Klinis
            keluhan:  $('keluhan') ? $('keluhan').value  : '',
            fisik:    $('fisik')   ? $('fisik').value    : '',
            diagnosa: diag1,
            diagnosa2: diag2,
            terapi:   $('terapi')  ? $('terapi').value   : '',
            suratSakit,
            // ── Permintaan Lab ──
            req_lab: (typeof getReqLabPayload === 'function') ? getReqLabPayload() : null,
            // ── Riwayat Penyakit Dahulu ──
            riwayat_penyakit: $('riwayat_penyakit') ? ($('riwayat_penyakit').value || null) : null
        };

        const result = await sb_saveKunjungan(payload);

        // Update currentKunjunganId jika ini kunjungan baru
        if (result && result.kunjunganId) {
            currentKunjunganId = result.kunjunganId;
            localStorage.setItem('cK_id', currentKunjunganId);
        }

        // Simpan resep obat jika modul stok aktif
        if (window._stokAktif && currentKunjunganId && typeof _getResepItems === 'function') {
            try {
                const resepItems = _getResepItems();
                if (resepItems && resepItems.length > 0) {
                    await sb_saveResep(currentKunjunganId, resepItems);
                }
            } catch(e) {
                console.warn('[Klikpro] Resep gagal disimpan:', e.message);
            }
        }

        // Update status kunjungan di cache lokal
        if (typeof kunjunganHariIni !== 'undefined' && currentKunjunganId) {
            // BUG-06 FIX: kondisi isSelesai harus identik dengan sb_saveKunjungan()
            // yaitu diagnosa && terapi — bukan diagnosa && (terapi || td)
            const isSelesai = !!(diag1 && payload.terapi);
            const kIdx = kunjunganHariIni.findIndex(x => x.id === currentKunjunganId);
            if (kIdx !== -1) {
                kunjunganHariIni[kIdx].status = isSelesai ? 'Selesai' : 'Menunggu';
                kunjunganHariIni[kIdx].td      = td;
                kunjunganHariIni[kIdx].suhu    = payload.suhu;
                kunjunganHariIni[kIdx].nadi    = payload.nadi;
                kunjunganHariIni[kIdx].keluhan = payload.keluhan;
                kunjunganHariIni[kIdx].diag    = diag1;
            }
        }

        showToast('✅ Rekam medis berhasil disimpan!', 'success');

        // Buka modal tagihan setelah simpan rekam medis
        // Gunakan openModalTagihan (bukan lihatTagihanKunjungan) agar:
        // 1. Data req_lab diambil langsung dari DB (bukan dari form state)
        // 2. Item baru dari rekam medis di-merge ke tagihan existing
        if (showInvoice && window._biayaAktif && currentKunjunganId && diag1) {
            try {
                const namaPasienDisplay = $('infoPasienNama') ? $('infoPasienNama').innerText : namaPasien;
                if (typeof openModalTagihan === 'function') {
                    // Ambil data kunjungan fresh dari DB agar req_lab sudah tersimpan
                    let kunjunganDataFresh = null;
                    try {
                        kunjunganDataFresh = await sb_getKunjunganById(currentKunjunganId);
                    } catch(e) {
                        console.warn('[Klikpro] Gagal ambil kunjungan fresh:', e.message);
                    }
                    openModalTagihan(
                        currentKunjunganId,
                        currentPasienId,
                        namaPasienDisplay,
                        localDate,
                        kunjunganDataFresh || payload  // fallback ke payload form jika fetch gagal
                    );
                }
            } catch(e) {
                console.warn('[Klikpro] Modal invoice gagal:', e.message);
            }
        }

        // Refresh riwayat di halaman medis
        try {
            if (currentPasienId) {
                const riwayatRows = await _sbFetch(
                    `kunjungan?pasien_id=eq.${currentPasienId}&order=tgl.desc,waktu.desc&select=*`
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
                        keluhan: r.keluhan, fisik: r.fisik,
                        lab_gds: r.lab_gds, lab_chol: r.lab_chol, lab_ua: r.lab_ua,
                        lab_hb: r.lab_hb, lab_trombosit: r.lab_trombosit, lab_leukosit: r.lab_leukosit,
                        lab_eritrosit: r.lab_eritrosit, lab_hematokrit: r.lab_hematokrit,
                        lab_hiv: r.lab_hiv, lab_sifilis: r.lab_sifilis, lab_hepatitis: r.lab_hepatitis,
                        lab_hdl: r.lab_hdl, lab_ldl: r.lab_ldl, lab_tg: r.lab_tg,
                        lab_gdp: r.lab_gdp, lab_hba1c: r.lab_hba1c,
                        lab_sgot: r.lab_sgot, lab_sgpt: r.lab_sgpt,
                        lab_ureum: r.lab_ureum, lab_creatinin: r.lab_creatinin,
                        req_lab: r.req_lab,
                        diag: r.diagnosa, diagnosa2: r.diagnosa2,
                        terapi: r.terapi, surat_sakit: r.surat_sakit,
                        status: r.status, user_id: r.user_id,
                        status_obat: !!r.status_obat, status_bayar: !!r.status_bayar,
                        dokterNama: dokterUser ? dokterUser.nama : ''
                    };
                });
                localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
                if (typeof renderRiwayatList === 'function') renderRiwayatList(currentRiwayat, 'historyListMedis');
            }
        } catch(e) {
            console.warn('[Klikpro] Gagal refresh riwayat:', e.message);
        }

    } catch (e) {
        console.error('[Klikpro] saveAll error:', e);
        showToast('❌ Gagal menyimpan: ' + (e.message || 'Cek koneksi internet'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '✓ Simpan Rekam Medis'; }
    }
}
