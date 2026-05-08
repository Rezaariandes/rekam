// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL LAPORAN & STATISTIK (v1.0)
//  Filter: Bulan, Tahun, Diagnosa, Dokter, JK, Status
//  Output: Ringkasan statistik + grafik + tabel detail
// ════════════════════════════════════════════════════════

// ── Cache data laporan ──
let _lprData        = [];   // hasil mentah dari Supabase
let _lprFiltered    = [];   // setelah difilter
let _lprDokterList  = [];   // [{id, nama}] dari tabel users jabatan Dokter

// ════════════════════════════════════════════════════════
//  INISIALISASI — dipanggil saat switchPage ke pageLaporan
// ════════════════════════════════════════════════════════
async function initLaporan() {
    _initFilterTahun();
    _initFilterBulan();
    _initFilterDiagnosa();
    await _initFilterDokter();
    _resetTampilan();
}

// ── Set bulan default ke bulan saat ini ──
function _initFilterBulan() {
    const el = document.getElementById('lpr_bulan');
    if (!el) return;
    const bulanIni = String(new Date().getMonth() + 1).padStart(2, '0');
    el.value = bulanIni;
}

// ── Isi dropdown tahun (5 tahun ke belakang + tahun ini) ──
function _initFilterTahun() {
    const el = document.getElementById('lpr_tahun');
    if (!el) return;
    const tahunIni = new Date().getFullYear();
    el.innerHTML = '';
    for (let y = tahunIni; y >= tahunIni - 4; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        el.appendChild(opt);
    }
}

// ── Isi dropdown diagnosa dari icd10Data (icd10.js) ──
function _initFilterDiagnosa() {
    const el = document.getElementById('lpr_diagnosa');
    if (!el) return;
    // Bersihkan dulu, sisakan option "Semua"
    while (el.options.length > 1) el.remove(1);
    if (typeof icd10Data !== 'undefined' && Array.isArray(icd10Data)) {
        icd10Data.forEach(diag => {
            const opt = document.createElement('option');
            opt.value = diag.split(' - ')[0].trim(); // kode ICD saja, mis: "J06.9"
            opt.textContent = diag;
            el.appendChild(opt);
        });
    }
}

// ── Isi dropdown dokter dari users cache / Supabase ──
async function _initFilterDokter() {
    const el = document.getElementById('lpr_dokter');
    if (!el) return;
    while (el.options.length > 1) el.remove(1);

    try {
        // Gunakan cache global dari supabase.js jika sudah ada
        let users = window._usersCache || [];
        if (!users.length) {
            const res = await sb_getUsers();
            users = res.data || [];
            window._usersCache = users;
        }
        _lprDokterList = users.filter(u =>
            u.jabatan && u.jabatan.toLowerCase() === 'dokter'
        );
        _lprDokterList.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.nama;
            el.appendChild(opt);
        });
    } catch(e) {
        console.warn('[Laporan] Gagal load dokter:', e.message);
    }
}

// ── Reset tampilan ke state awal ──
function _resetTampilan() {
    _el('lpr_summary_wrap').style.display = 'none';
    _el('lpr_result_card').style.display  = 'none';
    _el('lpr_empty').style.display        = 'block';
    _el('lpr_loading').style.display      = 'none';
    _el('btnExportCsv').style.display     = 'none';
    _el('btnCetakLaporan').style.display  = 'none';
}

// ════════════════════════════════════════════════════════
//  AMBIL & FILTER DATA DARI SUPABASE
// ════════════════════════════════════════════════════════
async function jalankanLaporan() {
    const bulan  = _valEl('lpr_bulan');
    const tahun  = _valEl('lpr_tahun');
    const dokter = _valEl('lpr_dokter');
    const diag   = _valEl('lpr_diagnosa');
    const jk     = _valEl('lpr_jk');
    const status = _valEl('lpr_status');

    if (!bulan || !tahun) {
        if (typeof showToast === 'function') showToast("⚠️ Pilih bulan dan tahun terlebih dahulu", "warning");
        return;
    }

    // Tampilkan loading
    _el('lpr_empty').style.display    = 'none';
    _el('lpr_loading').style.display  = 'block';
    _el('lpr_summary_wrap').style.display = 'none';
    _el('lpr_result_card').style.display  = 'none';
    _el('btnExportCsv').style.display     = 'none';
    _el('btnCetakLaporan').style.display  = 'none';

    const btn = _el('btnJalankanLaporan');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memuat...'; }

    try {
        // ─── Query Supabase: kunjungan bulan+tahun tertentu ───
        const tglAwal = `${tahun}-${bulan}-01`;
        const tglAkhir = _akhirBulan(tahun, bulan);

        // Fetch kunjungan dalam rentang
        let qKunjungan = `kunjungan?tgl=gte.${tglAwal}&tgl=lte.${tglAkhir}&select=*&order=tgl.asc,waktu.asc`;
        if (status)  qKunjungan += `&status=eq.${encodeURIComponent(status)}`;
        if (dokter)  qKunjungan += `&user_id=eq.${encodeURIComponent(dokter)}`;

        const kunjunganRaw = await _sbFetch(qKunjungan);

        // Fetch semua pasien sekaligus (lebih efisien)
        const pasienIds = [...new Set(kunjunganRaw.map(k => k.pasien_id).filter(Boolean))];
        let pasienMap   = {};
        if (pasienIds.length > 0) {
            const pasienRaw = await _sbFetch(
                `pasien?id=in.(${pasienIds.join(',')})&select=id,nama,nik,jk,tgl_lahir,alamat`
            );
            pasienRaw.forEach(p => { pasienMap[p.id] = p; });
        }

        // Ambil users jika belum ada di cache
        if (!window._usersCache || !window._usersCache.length) {
            const res = await sb_getUsers();
            window._usersCache = res.data || [];
        }
        const usersCache = window._usersCache;

        // Gabungkan kunjungan + pasien + dokter
        _lprData = kunjunganRaw.map(k => {
            const p       = pasienMap[k.pasien_id] || {};
            const dokterU = k.user_id ? usersCache.find(u => u.id === k.user_id) : null;
            const dokterNama = (dokterU && dokterU.jabatan &&
                               dokterU.jabatan.toLowerCase() === 'dokter')
                              ? dokterU.nama : (dokterU ? dokterU.nama : '-');
            return {
                id:           k.id,
                pasien_id:    k.pasien_id,
                tgl:          k.tgl,
                waktu:        k.waktu || '—',
                status:       k.status || 'Menunggu',
                nama:         p.nama  || '—',
                nik:          p.nik   || '—',
                jk:           p.jk   || '—',
                tgl_lahir:    p.tgl_lahir || '',
                umur:         p.tgl_lahir ? _hitungUmur(p.tgl_lahir) : '—',
                alamat:       p.alamat || '—',
                keluhan:      k.keluhan  || '—',
                diagnosa:     k.diagnosa || '—',
                diagnosa2:    k.diagnosa2 || '',
                terapi:       k.terapi   || '—',
                td:           k.td       || '—',
                nadi:         k.nadi     || '—',
                suhu:         k.suhu     || '—',
                rr:           k.rr       || '—',
                bb:           k.bb       || '—',
                tb:           k.tb       || '—',
                user_id:      k.user_id  || null,
                dokterNama:   dokterNama || '—',
            };
        });

        // ─── Filter sisi klien (JK, Diagnosa prefix) ───
        _lprFiltered = _lprData.filter(row => {
            if (jk && row.jk !== jk) return false;
            if (diag) {
                const diagAll = [row.diagnosa, row.diagnosa2].join(' ').toLowerCase();
                if (!diagAll.includes(diag.toLowerCase())) return false;
            }
            return true;
        });

        _renderHasil(bulan, tahun);

    } catch(e) {
        console.error('[Laporan] Error:', e);
        if (typeof showToast === 'function') showToast("❌ Gagal memuat laporan: " + e.message, "error");
        _resetTampilan();
    } finally {
        _el('lpr_loading').style.display = 'none';
        if (btn) { btn.disabled = false; btn.textContent = '🔍 Tampilkan Laporan'; }
    }
}

// ── Hitung tanggal akhir bulan ──
function _akhirBulan(tahun, bulan) {
    const d = new Date(parseInt(tahun), parseInt(bulan), 0);
    return `${tahun}-${bulan}-${String(d.getDate()).padStart(2,'0')}`;
}

// ════════════════════════════════════════════════════════
//  RENDER HASIL
// ════════════════════════════════════════════════════════
function _renderHasil(bulan, tahun) {
    const namaBulan = ['','Januari','Februari','Maret','April','Mei','Juni',
                       'Juli','Agustus','September','Oktober','November','Desember'];
    const labelBulan = namaBulan[parseInt(bulan)] + ' ' + tahun;

    const data = _lprFiltered;

    if (data.length === 0) {
        _el('lpr_empty').style.display = 'block';
        _el('lpr_empty').innerHTML = `
            <div class="empty-icon">📭</div>
            <div>Tidak ada data kunjungan untuk filter yang dipilih<br>
            <span style="font-size:11px;color:var(--text-muted);">Periode: ${labelBulan}</span></div>`;
        return;
    }

    // Sembunyikan empty, tampilkan hasil
    _el('lpr_empty').style.display = 'none';
    _el('lpr_summary_wrap').style.display = 'block';
    _el('lpr_result_card').style.display  = 'block';
    _el('btnExportCsv').style.display     = 'inline-flex';
    _el('btnCetakLaporan').style.display  = 'inline-flex';

    _renderSummaryCards(data, labelBulan);
    _renderGrafikDiagnosa(data);
    _renderTabelDetail(data, labelBulan);
}

// ── Kartu Ringkasan Statistik ──
function _renderSummaryCards(data, labelBulan) {
    const totalKunjungan = data.length;

    // Pasien unik
    const pasienUnik = new Set(data.map(r => r.pasien_id)).size;

    // Distribusi JK
    const jkL = data.filter(r => r.jk === 'L').length;
    const jkP = data.filter(r => r.jk === 'P').length;

    // Diagnosa terbanyak
    const diagCount = {};
    data.forEach(r => {
        [r.diagnosa, r.diagnosa2].forEach(d => {
            if (d && d !== '—' && d.trim()) {
                const key = d.trim();
                diagCount[key] = (diagCount[key] || 0) + 1;
            }
        });
    });
    const topDiag = Object.entries(diagCount).sort((a,b) => b[1]-a[1])[0];

    // Dokter terbanyak
    const dokterCount = {};
    data.forEach(r => {
        if (r.dokterNama && r.dokterNama !== '—') {
            dokterCount[r.dokterNama] = (dokterCount[r.dokterNama] || 0) + 1;
        }
    });
    const topDokter = Object.entries(dokterCount).sort((a,b) => b[1]-a[1])[0];

    // Status selesai
    const selesai = data.filter(r => r.status === 'Selesai').length;

    const cards = [
        {
            icon: '🏥', label: 'Total Kunjungan',
            value: totalKunjungan,
            sub: labelBulan,
            color: '#2563eb'
        },
        {
            icon: '👤', label: 'Pasien Unik',
            value: pasienUnik,
            sub: `${totalKunjungan - pasienUnik} kunjungan ulang`,
            color: '#7c3aed'
        },
        {
            icon: '⚧️', label: 'L / P',
            value: `${jkL} / ${jkP}`,
            sub: `dari ${totalKunjungan} kunjungan`,
            color: '#0891b2'
        },
        {
            icon: '✅', label: 'Selesai',
            value: selesai,
            sub: `${totalKunjungan - selesai} menunggu`,
            color: '#059669'
        },
        {
            icon: '🏆', label: 'Diagnosa Terbanyak',
            value: topDiag ? topDiag[1] + 'x' : '—',
            sub: topDiag ? _potongTeks(topDiag[0], 28) : 'Belum ada diagnosa',
            color: '#d97706'
        },
        {
            icon: '👨‍⚕️', label: 'Dokter Terbanyak',
            value: topDokter ? topDokter[1] + 'x' : '—',
            sub: topDokter ? topDokter[0] : 'Tidak ada data',
            color: '#db2777'
        },
    ];

    _el('lpr_summary_cards').innerHTML = cards.map(c => `
        <div style="background:var(--card-bg,#fff);border:1px solid rgba(0,0,0,0.07);
            border-radius:14px;padding:14px 12px;
            box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <div style="font-size:20px;margin-bottom:6px;">${c.icon}</div>
            <div style="font-size:22px;font-weight:800;color:${c.color};line-height:1;">${c.value}</div>
            <div style="font-size:11px;font-weight:700;color:var(--text-primary,#1e293b);margin-top:4px;">${c.label}</div>
            <div style="font-size:10px;color:var(--text-muted,#64748b);margin-top:2px;">${c.sub}</div>
        </div>
    `).join('');
}

// ── Grafik Bar Distribusi Diagnosa ──
function _renderGrafikDiagnosa(data) {
    const diagCount = {};
    data.forEach(r => {
        [r.diagnosa, r.diagnosa2].forEach(d => {
            if (d && d !== '—' && d.trim()) {
                const key = d.trim();
                diagCount[key] = (diagCount[key] || 0) + 1;
            }
        });
    });

    const sorted = Object.entries(diagCount).sort((a,b) => b[1]-a[1]).slice(0, 10);
    if (!sorted.length) {
        _el('lpr_chart_body').innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px 0;">Tidak ada data diagnosa</div>`;
        return;
    }

    const maxVal = sorted[0][1];
    const colors = ['#2563eb','#7c3aed','#059669','#d97706','#db2777',
                    '#0891b2','#dc2626','#65a30d','#9333ea','#ea580c'];

    _el('lpr_chart_body').innerHTML = sorted.map(([diag, count], i) => {
        const pct = Math.round((count / maxVal) * 100);
        const kode = diag.split(' - ')[0].trim();
        const nama = diag.includes(' - ') ? diag.split(' - ').slice(1).join(' - ') : diag;
        return `
        <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                <div style="font-size:11px;font-weight:700;color:var(--text-primary,#1e293b);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_escHtml(diag)}">
                    <span style="background:rgba(37,99,235,0.08);color:#2563eb;padding:1px 5px;border-radius:4px;font-size:9px;margin-right:5px;flex-shrink:0;">${_escHtml(kode)}</span>${_escHtml(nama)}
                </div>
                <div style="font-size:12px;font-weight:800;color:${colors[i % colors.length]};margin-left:8px;flex-shrink:0;">${count}x</div>
            </div>
            <div style="height:8px;background:rgba(0,0,0,0.06);border-radius:20px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${colors[i % colors.length]};border-radius:20px;transition:width 0.6s ease;"></div>
            </div>
        </div>`;
    }).join('');
}

// ── Tabel Detail Kunjungan ──
function _renderTabelDetail(data, labelBulan) {
    const totalKunjunganPerPasien = {};
    data.forEach(r => {
        totalKunjunganPerPasien[r.pasien_id] = (totalKunjunganPerPasien[r.pasien_id] || 0) + 1;
    });

    // Title dan count
    _el('lpr_result_title').textContent = `Detail Kunjungan — ${labelBulan}`;
    _el('lpr_result_count').textContent = `${data.length} record`;

    const thead = `
    <thead>
        <tr style="background:rgba(37,99,235,0.06);">
            <th style="${_thStyle()}">No</th>
            <th style="${_thStyle()}">Tanggal</th>
            <th style="${_thStyle()}">Nama Pasien</th>
            <th style="${_thStyle()}">Usia / JK</th>
            <th style="${_thStyle()}">Keluhan</th>
            <th style="${_thStyle()}">Diagnosa</th>
            <th style="${_thStyle()}">Terapi</th>
            <th style="${_thStyle()}">TTV</th>
            <th style="${_thStyle()}">Dokter</th>
            <th style="${_thStyle()}">Jumlah Kunjungan</th>
            <th style="${_thStyle()}">Status</th>
        </tr>
    </thead>`;

    const tbody = `<tbody>` + data.map((r, i) => {
        const jkLabel  = r.jk === 'L' ? '♂️ L' : r.jk === 'P' ? '♀️ P' : r.jk;
        const statusBadge = r.status === 'Selesai'
            ? `<span style="background:#ecfdf5;color:#059669;border:1px solid #6ee7b7;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">✅ Selesai</span>`
            : `<span style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">⏳ Menunggu</span>`;
        const diagGabung = [r.diagnosa, r.diagnosa2].filter(d => d && d !== '—' && d !== '').join(' | ');
        const tglFmt = r.tgl ? _formatTglIndo(r.tgl) : '—';
        const ttvStr = _buildTTV(r);
        const jmlKunj = totalKunjunganPerPasien[r.pasien_id] || 1;
        const jmlBadge = jmlKunj > 1
            ? `<span style="background:rgba(37,99,235,0.1);color:#2563eb;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">${jmlKunj}x</span>`
            : `<span style="font-size:10px;color:var(--text-muted);">1x</span>`;

        return `<tr style="border-bottom:1px solid rgba(0,0,0,0.05);${i%2===1?'background:rgba(0,0,0,0.015)':''}">
            <td style="${_tdStyle('center')}">${i + 1}</td>
            <td style="${_tdStyle()}">${tglFmt}<br><span style="font-size:10px;color:var(--text-muted);">${r.waktu}</span></td>
            <td style="${_tdStyle()}"><div style="font-weight:700;font-size:12px;">${_escHtml(r.nama)}</div><div style="font-size:10px;color:var(--text-muted);">NIK: ${_escHtml(r.nik)}</div></td>
            <td style="${_tdStyle('center')}">${r.umur}<br><span style="font-size:11px;">${jkLabel}</span></td>
            <td style="${_tdStyle()}">${_potongTeks(r.keluhan, 40)}</td>
            <td style="${_tdStyle()}"><span style="font-size:11px;font-weight:600;">${_escHtml(diagGabung || '—')}</span></td>
            <td style="${_tdStyle()}">${_potongTeks(r.terapi, 40)}</td>
            <td style="${_tdStyle()}">${ttvStr}</td>
            <td style="${_tdStyle()}"><span style="font-size:11px;font-weight:600;color:#2563eb;">${_escHtml(r.dokterNama)}</span></td>
            <td style="${_tdStyle('center')}">${jmlBadge}</td>
            <td style="${_tdStyle('center')}">${statusBadge}</td>
        </tr>`;
    }).join('') + `</tbody>`;

    _el('lpr_table_wrap').innerHTML = `
    <table style="width:100%;border-collapse:collapse;min-width:900px;font-family:inherit;">
        ${thead}
        ${tbody}
    </table>`;
}

// ── Helper: bangun string TTV ringkas ──
function _buildTTV(r) {
    const parts = [];
    if (r.td   && r.td   !== '—') parts.push(`TD: ${r.td}`);
    if (r.nadi && r.nadi !== '—') parts.push(`N: ${r.nadi}`);
    if (r.suhu && r.suhu !== '—') parts.push(`S: ${r.suhu}`);
    if (r.bb   && r.bb   !== '—') parts.push(`BB: ${r.bb}`);
    if (!parts.length) return '<span style="color:var(--text-muted);font-size:10px;">—</span>';
    return `<span style="font-size:10px;line-height:1.7;">${parts.join('<br>')}</span>`;
}

// ════════════════════════════════════════════════════════
//  EXPORT CSV
// ════════════════════════════════════════════════════════
function exportLaporanCSV() {
    if (!_lprFiltered.length) {
        if (typeof showToast === 'function') showToast("⚠️ Tidak ada data untuk di-export", "warning");
        return;
    }

    const headers = [
        'No','Tanggal','Waktu','Nama Pasien','NIK','Usia','JK','Keluhan',
        'Diagnosa','Diagnosa 2','Terapi','TD','Nadi','Suhu','RR','BB','TB',
        'Dokter Pemeriksa','Status','Jumlah Kunjungan Bulan Ini'
    ];

    const totalKunjunganPerPasien = {};
    _lprFiltered.forEach(r => {
        totalKunjunganPerPasien[r.pasien_id] = (totalKunjunganPerPasien[r.pasien_id] || 0) + 1;
    });

    const rows = _lprFiltered.map((r, i) => [
        i + 1,
        r.tgl || '',
        r.waktu || '',
        r.nama,
        r.nik,
        r.umur,
        r.jk === 'L' ? 'Laki-laki' : r.jk === 'P' ? 'Perempuan' : r.jk,
        _csvEsc(r.keluhan),
        _csvEsc(r.diagnosa),
        _csvEsc(r.diagnosa2),
        _csvEsc(r.terapi),
        r.td,
        r.nadi,
        r.suhu,
        r.rr,
        r.bb,
        r.tb,
        _csvEsc(r.dokterNama),
        r.status,
        totalKunjunganPerPasien[r.pasien_id] || 1
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))
        .join('\n');

    const BOM = '\uFEFF'; // UTF-8 BOM agar Excel baca benar
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');

    const bulan  = document.getElementById('lpr_bulan')?.value  || 'xx';
    const tahun  = document.getElementById('lpr_tahun')?.value  || 'xxxx';
    a.href     = url;
    a.download = `Laporan_Kunjungan_${tahun}-${bulan}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') showToast("✅ File CSV berhasil diunduh", "success");
}

// ════════════════════════════════════════════════════════
//  CETAK LAPORAN
// ════════════════════════════════════════════════════════
function cetakLaporan() {
    if (!_lprFiltered.length) {
        if (typeof showToast === 'function') showToast("⚠️ Tidak ada data untuk dicetak", "warning");
        return;
    }

    const bulan  = document.getElementById('lpr_bulan')?.value  || '—';
    const tahun  = document.getElementById('lpr_tahun')?.value  || '—';
    const namaBulan = ['','Januari','Februari','Maret','April','Mei','Juni',
                       'Juli','Agustus','September','Oktober','November','Desember'];
    const labelBulan = namaBulan[parseInt(bulan)] + ' ' + tahun;

    const klinikNama  = window.KLINIK_NAMA  || 'Klikpro RME';
    const klinikTitle = window.KLINIK_TITLE || '';

    const totalKunjunganPerPasien = {};
    _lprFiltered.forEach(r => {
        totalKunjunganPerPasien[r.pasien_id] = (totalKunjunganPerPasien[r.pasien_id] || 0) + 1;
    });

    const rowsHtml = _lprFiltered.map((r, i) => {
        const diagGabung = [r.diagnosa, r.diagnosa2].filter(d => d && d !== '—' && d !== '').join(' | ');
        return `<tr>
            <td>${i+1}</td>
            <td>${_formatTglIndo(r.tgl)}</td>
            <td><strong>${_escHtml(r.nama)}</strong><br><small>NIK: ${_escHtml(r.nik)}</small></td>
            <td>${r.umur} / ${r.jk === 'L' ? 'L' : r.jk === 'P' ? 'P' : r.jk}</td>
            <td>${_escHtml(diagGabung || '—')}</td>
            <td>${_escHtml(r.terapi || '—')}</td>
            <td>${_escHtml(r.dokterNama || '—')}</td>
            <td style="text-align:center;">${totalKunjunganPerPasien[r.pasien_id] || 1}x</td>
            <td style="text-align:center;">${r.status}</td>
        </tr>`;
    }).join('');

    const filterDiag   = document.getElementById('lpr_diagnosa')?.selectedOptions?.[0]?.textContent || 'Semua';
    const filterDokter = document.getElementById('lpr_dokter')?.selectedOptions?.[0]?.textContent   || 'Semua';
    const filterJK     = document.getElementById('lpr_jk')?.selectedOptions?.[0]?.textContent        || 'Semua';

    const printHtml = `<!DOCTYPE html><html lang="id"><head>
    <meta charset="UTF-8">
    <title>Laporan Kunjungan ${labelBulan}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 16px; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
        .header h1 { font-size: 16px; margin: 0; color: #2563eb; }
        .header h2 { font-size: 13px; margin: 4px 0 0; font-weight: 600; }
        .header p  { margin: 4px 0 0; font-size: 10px; color: #64748b; }
        .filter-info { background: #f0f6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #2563eb; color: #fff; padding: 6px 8px; text-align: left; font-weight: 700; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 16px; text-align: right; font-size: 9px; color: #94a3b8; }
        @media print { @page { margin: 1cm; } body { padding: 0; } }
    </style>
    </head><body>
    <div class="header">
        <h1>${_escHtml(klinikNama)}</h1>
        <h2>LAPORAN KUNJUNGAN PASIEN</h2>
        <p>Periode: ${labelBulan} &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleString('id-ID')}</p>
    </div>
    <div class="filter-info">
        <strong>Filter:</strong> Diagnosa: ${_escHtml(filterDiag)} &nbsp;|&nbsp;
        Dokter: ${_escHtml(filterDokter)} &nbsp;|&nbsp;
        JK: ${_escHtml(filterJK)} &nbsp;|&nbsp;
        Total: <strong>${_lprFiltered.length} kunjungan</strong>
    </div>
    <table>
        <thead><tr>
            <th>No</th><th>Tanggal</th><th>Nama / NIK</th><th>Usia/JK</th>
            <th>Diagnosa</th><th>Terapi</th><th>Dokter</th><th>Kunjungan</th><th>Status</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">Klikpro RME — ${_escHtml(klinikNama)}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
        if (typeof showToast === 'function') showToast("⚠️ Izinkan popup untuk mencetak", "warning");
        return;
    }
    w.document.write(printHtml);
    w.document.close();
    w.onload = () => { w.print(); };
}

// ════════════════════════════════════════════════════════
//  HELPER PRIVAT
// ════════════════════════════════════════════════════════
function _el(id) {
    return document.getElementById(id) || { style: {}, innerHTML: '', textContent: '' };
}
function _valEl(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
function _escHtml(str) {
    return String(str||'')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _potongTeks(str, maxLen) {
    if (!str || str === '—') return '—';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}
function _csvEsc(str) {
    return String(str || '').replace(/"/g, '""');
}
function _formatTglIndo(tglStr) {
    if (typeof formatTglIndo === 'function') return formatTglIndo(tglStr);
    if (!tglStr) return '—';
    const p = tglStr.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    return tglStr;
}
function _hitungUmur(tglStr) {
    if (typeof hitungUmur === 'function') return hitungUmur(tglStr);
    if (!tglStr) return '—';
    const bD = new Date(tglStr);
    if (isNaN(bD)) return '—';
    let age = new Date().getFullYear() - bD.getFullYear();
    const m = new Date().getMonth() - bD.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < bD.getDate())) age--;
    return age + ' Thn';
}
function _thStyle() {
    return 'padding:9px 10px;font-size:11px;font-weight:700;color:#1e293b;white-space:nowrap;border-bottom:2px solid rgba(37,99,235,0.15);';
}
function _tdStyle(align) {
    return `padding:9px 10px;font-size:11px;vertical-align:top;${align ? 'text-align:' + align + ';' : ''}`;
}
