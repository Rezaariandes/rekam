// ════════════════════════════════════════════════════════
// KLIKPRO RME — MODAL (GABUNGAN)
// Urutan modul:
//   1. modal-resep.js     — Modal resep profesional
//   2. modal.js           — Modal lihat & edit riwayat kunjungan
//   3. modal-konfirmasi.js — Modal konfirmasi universal
//   4. modal-pasien-detail.js — Modal detail & edit pasien
//   5. modal-dokumen.js   — Modal dokumen administrasi
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL RESEP PROFESIONAL
//  Sesuai kaidah resep dokter Indonesia
//  Menggantikan fungsi _tampilModalResep di kunjungan.js
//  
//  CARA INTEGRASI:
//  1. Tambahkan <script src="modal-resep.js"></script> di index.html
//     (setelah kunjungan.js)
//  2. Fungsi _tampilModalResep akan otomatis ter-override
// ════════════════════════════════════════════════════════

/**
 * Tampilkan modal resep profesional sesuai kaidah medis Indonesia.
 * 
 * @param {string}   kunjId      - ID kunjungan
 * @param {string}   namaPasien  - Nama pasien
 * @param {Array}    items       - Array item resep [{nama_obat, jumlah, frekuensi, catatan, obat:{satuan}}]
 * @param {string}   tgl         - Tanggal kunjungan (format YYYY-MM-DD)
 */
// ── HELPER GLOBAL: konversi satuan ke signa latin ──
// BUG-FIX: Dipindahkan ke scope global agar bisa diakses oleh _frekToLatin()
// Sebelumnya nested di dalam _tampilModalResep sehingga _frekToLatin (yang global)
// tidak bisa memanggilnya → ReferenceError: _satuanKeSig is not defined
function _satuanKeSig(sat) {
    const s = (sat || 'tablet').toLowerCase().trim();
    if (s === 'tablet' || s === 'tab' || s === 'kaplet' || s === 'kapl')
        return 'tab';
    if (s === 'kapsul' || s === 'kaps' || s === 'capsul' || s === 'caps' || s === 'kap')
        return 'caps';
    if (s === 'sirup'  || s === 'syrup'  || s === 'suspensi' || s === 'susp' ||
        s === 'botol'  || s === 'flakon' || s === 'sendok takar' ||
        s === 'cth'    || s === 'ml'     || s === 'cc')
        return 'cth';
    if (s === 'tetes'  || s === 'drop'   || s === 'gtt')
        return 'gtt';
    if (s === 'salep'  || s === 'krim'   || s === 'cream' || s === 'gel' ||
        s === 'lotion' || s === 'losion')
        return 'ue';
    if (s === 'suppositoria' || s === 'supp')
        return 'supp';
    if (s === 'inhaler' || s === 'puff' || s === 'spray' || s === 'semprot')
        return 'puff';
    if (s === 'sachet' || s === 'sach' || s === 'puyer')
        return 'sachet';
    if (s === 'ampul'  || s === 'amp'  || s === 'vial' || s === 'injeksi' || s === 'syringe')
        return 'amp';
    if (s === 'plester' || s === 'patch')
        return 'patch';
    if (s === 'ovula' || s === 'ovul')
        return 'ovul';
    return sat.length <= 6 ? sat : sat.substring(0, 6);
}

function _tampilModalResep(kunjId, namaPasien, items, tgl) {

    // ── 1. Hapus modal lama jika ada ──
    const old = document.getElementById('modalResepPro');
    if (old) old.remove();

    // ── 2. Kumpulkan data dari globals ──
    const s = window._settingsFull || {};

    const klinikNama   = window.KLINIK_NAMA  || s.klinik_nama  || 'Klinik';
    const klinikTitle  = window.KLINIK_TITLE || s.klinik_title || 'Praktik Dokter Umum';
    const klinikAlamat = s.klinik_alamat || '';
    const klinikTelp   = s.klinik_telp   || '';
    const klinikLogo   = s.klinik_logo   || localStorage.getItem('klikpro_logo') || '';

    // ── 3. Resolve nama & SIP dokter ──
    let dokterNama = '';
    let dokterSip  = '';
    let dokterSpesialis = '';

    // Cari dokter dari data kunjungan hari ini
    const kunjData = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : [])
        .find(x => x.id === kunjId);

    if (kunjData && kunjData.dokterNama) {
        dokterNama = kunjData.dokterNama;
    }

    // Fallback: gunakan dokter pertama dari _dokterAktif
    if (!dokterNama && window._dokterAktif && window._dokterAktif.length > 0) {
        const d = window._dokterAktif[0];
        dokterNama      = d.nama      || '';
        dokterSip       = d.sip       || '';
        dokterSpesialis = d.spesialis || '';
    }

    // Jika nama sudah ada tapi SIP belum, cari SIP dari _dokterAktif by nama
    if (dokterNama && !dokterSip && window._dokterAktif) {
        const match = window._dokterAktif.find(
            d => (d.nama || '').toLowerCase() === dokterNama.toLowerCase()
        );
        if (match) {
            dokterSip       = match.sip       || '';
            dokterSpesialis = match.spesialis || '';
        }
    }

    // ── 4. Resolve data pasien lengkap dari allPatients ──
    let pasienTglLahir = '';
    let pasienAlamat   = '';
    let pasienUmur     = '';

    // Cari dari allPatients — prioritaskan by ID, fallback by nama
    if (typeof allPatients !== 'undefined' && allPatients.length > 0) {
        let pData = null;
        // 1. By currentPasienId
        if (typeof currentPasienId !== 'undefined' && currentPasienId) {
            pData = allPatients.find(p => p.id === currentPasienId);
        }
        // 2. By pasienId dari data kunjungan
        if (!pData && kunjData && kunjData.pasienId) {
            pData = allPatients.find(p => p.id === kunjData.pasienId);
        }
        // 3. Fallback by nama
        if (!pData && namaPasien) {
            pData = allPatients.find(p => p.nama && p.nama.toLowerCase() === namaPasien.toLowerCase());
        }
        if (pData) {
            pasienTglLahir = pData.tgl    || '';
            pasienAlamat   = pData.alamat || '';
        }
    }

    // Hitung umur
    if (pasienTglLahir && typeof hitungUmur === 'function') {
        pasienUmur = hitungUmur(pasienTglLahir);
    }

    // Format tanggal lahir ke Indonesia (DD Bulan YYYY)
    let tglLahirFmt = '';
    if (pasienTglLahir) {
        try {
            // Tangani format DD/MM/YYYY dan YYYY-MM-DD
            let d;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(pasienTglLahir)) {
                const [dd, mm, yyyy] = pasienTglLahir.split('/');
                d = new Date(yyyy + '-' + mm + '-' + dd + 'T00:00:00');
            } else {
                d = new Date(pasienTglLahir + 'T00:00:00');
            }
            tglLahirFmt = d.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
        } catch(e) { tglLahirFmt = pasienTglLahir; }
    }

    // ── 5. Format tanggal resep ──
    let tglFmt = '';
    let hariIndo = '';
    let tglRaw = tgl;

    if (!tglRaw && kunjData) tglRaw = kunjData.tgl;
    if (!tglRaw) tglRaw = new Date().toISOString().slice(0, 10);

    try {
        const d = new Date(tglRaw + 'T00:00:00');
        const hariList = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        hariIndo = hariList[d.getDay()];
        tglFmt   = d.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch(e) { tglFmt = tglRaw; }

    // ── 6. Helper: label satuan — delegasi ke fungsi global _satuanKeSig ──
    // (fungsi lokal dihapus karena menyebabkan ReferenceError di _frekToLatin)
    function _labelSatuan(sat) { return _satuanKeSig(sat); }

    // ── 7. Render baris obat (format R/ kaidah resep) ──
    const obatHtml = items.length > 0 ? items.map((r) => {
        const satuan    = (r.obat && r.obat.satuan) || r.satuan || 'tablet';
        const frek      = r.frekuensi || '';
        const catatan   = r.catatan   || '';
        const jumlah    = parseInt(r.jumlah) || 1;
        const satuanLbl = _labelSatuan(satuan);

        // No. = jumlah SEDIAAN dalam romawi (bukan nomor urut)
        const noRomawi  = _toRoman(jumlah);

        // Signa latin (sertakan satuan agar cth/tab/dll benar)
        const frekLatin = _frekToLatin(frek, satuan);
        // Tampilkan keterangan Indonesia hanya jika berbeda
        const frekIdStr = (frek && frek.toLowerCase() !== frekLatin.toLowerCase()) ? frek : '';

        return [
            '<div class="_rx-item">',
            '  <div class="_rx-prefix">R/</div>',
            '  <div class="_rx-body">',
            '    <div class="_rx-namarow">',
            '      <span class="_rx-nama">' + _escHtml(r.nama_obat) + '</span>',
            '      <span class="_rx-no">No. ' + noRomawi + '</span>',
            '    </div>',
            '    <div class="_rx-signa">',
            frekLatin ? ('      <span class="_rx-frek">' + _escHtml(frekLatin) + '</span>') : '',
            frekIdStr ? ('      <span class="_rx-frek-id">(' + _escHtml(frekIdStr) + ')</span>') : '',
            catatan   ? ('      <span class="_rx-cat">&#10002; ' + _escHtml(catatan) + '</span>') : '',
            '    </div>',
            '  </div>',
            '</div>'
        ].filter(Boolean).join('\n');
    }).join('<div class="_rx-divider"></div>') : '<div style="padding:20px;text-align:center;color:#94a3b8;font-style:italic;font-size:12px;">\u2014 Tidak ada obat dalam resep ini \u2014</div>';

    // ── 8. Logo klinik ──
    const logoHtml = klinikLogo
        ? ('<img src="' + klinikLogo + '" alt="Logo" style="height:60px;width:60px;object-fit:contain;flex-shrink:0;">')
        : '<div style="width:60px;height:60px;border-radius:50%;border:2.5px solid #1a3a6b;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;background:#f0f5ff;">&#127973;</div>';

    // ── 9. Bangun konten resep ──
    const headerKlinik = [
        '<div style="display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px double #1a3a6b;">',
        '  ' + logoHtml,
        '  <div style="flex:1;min-width:0;text-align:center;">',
        klinikTitle ? ('    <div style="font-size:8.5px;letter-spacing:1.8px;text-transform:uppercase;color:#4a6fa5;font-family:Times New Roman,serif;margin-bottom:2px;">' + _escHtml(klinikTitle) + '</div>') : '',
        '    <div style="font-size:19px;font-weight:900;color:#1a3a6b;letter-spacing:-0.3px;line-height:1.15;font-family:Times New Roman,serif;">' + _escHtml(klinikNama) + '</div>',
        (klinikAlamat || klinikTelp) ? ('    <div style="font-size:9px;color:#64748b;margin-top:5px;line-height:1.7;font-family:Times New Roman,serif;">' + (klinikAlamat ? _escHtml(klinikAlamat) : '') + (klinikAlamat && klinikTelp ? ' &nbsp;&middot;&nbsp; ' : '') + (klinikTelp ? '&#9742; ' + _escHtml(klinikTelp) : '') + '</div>') : '',
        '  </div>',
        '</div>',
        '<div style="height:2px;background:#c8d8f0;"></div>'
    ].filter(Boolean).join('\n');

    const tanggalBaris = '<div style="display:flex;justify-content:flex-end;padding:8px 0 4px;">' +
        '<div style="font-size:9px;color:#64748b;font-family:Times New Roman,serif;">' +
        (hariIndo ? _escHtml(hariIndo) + ', ' : '') + _escHtml(tglFmt) +
        '</div></div>';

    const garisTengah = '<div style="display:flex;align-items:center;gap:10px;margin:6px 0 14px;">' +
        '<div style="height:1px;flex:1;background:#c8d8f0;"></div>' +
        '<div style="font-size:8.5px;letter-spacing:3px;font-weight:700;color:#1a3a6b;text-transform:uppercase;font-family:Times New Roman,serif;">Recipe</div>' +
        '<div style="height:1px;flex:1;background:#c8d8f0;"></div>' +
        '</div>';

    const ttdDokter = [
        '<div style="display:flex;justify-content:flex-end;margin-top:28px;margin-bottom:20px;">',
        '  <div style="text-align:center;min-width:150px;">',
        '    <div style="font-size:9.5px;color:#475569;font-family:Times New Roman,serif;margin-bottom:52px;">Dokter Pemeriksa,</div>',
        '    <div style="border-top:1.5px solid #1a3a6b;padding-top:5px;">',
        dokterNama
            ? ('<div style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:Times New Roman,serif;">dr. ' + _escHtml(dokterNama) + '</div>' +
               (dokterSip ? '<div style="font-size:9px;color:#64748b;margin-top:2px;">SIP: ' + _escHtml(dokterSip) + '</div>' : ''))
            : '<div style="font-size:12px;font-weight:700;color:#1a3a6b;font-family:Times New Roman,serif;">_____________________</div>',
        '    </div>',
        '  </div>',
        '</div>'
    ].filter(Boolean).join('\n');

    const identitasPasien = (function() {
        const rows = [];
        const tdLabel = 'style="color:#475569;font-weight:600;width:75px;padding:2px 0;vertical-align:top;font-family:Times New Roman,serif;font-size:10.5px;"';
        const tdSep   = 'style="color:#475569;padding:2px 4px;vertical-align:top;font-family:Times New Roman,serif;font-size:10.5px;"';
        const tdVal   = 'style="color:#1a1a2e;padding:2px 0;font-family:Times New Roman,serif;font-size:10.5px;"';

        // Nama
        rows.push(
            '<tr>' +
            '<td ' + tdLabel + '>Nama</td>' +
            '<td ' + tdSep   + '>:</td>' +
            '<td ' + tdVal   + '><strong>' + _escHtml(namaPasien || '\u2014') + '</strong></td>' +
            '</tr>'
        );

        // Tgl Lahir + umur
        if (tglLahirFmt || pasienUmur) {
            let tglUmurStr = '';
            if (tglLahirFmt) tglUmurStr += _escHtml(tglLahirFmt);
            if (pasienUmur)  tglUmurStr += (tglLahirFmt ? ' ' : '') + '<em style="color:#4a6fa5;">(' + _escHtml(pasienUmur) + ')</em>';
            rows.push(
                '<tr>' +
                '<td ' + tdLabel + '>Tgl. Lahir</td>' +
                '<td ' + tdSep   + '>:</td>' +
                '<td ' + tdVal   + '>' + tglUmurStr + '</td>' +
                '</tr>'
            );
        }

        // Alamat
        if (pasienAlamat) {
            rows.push(
                '<tr>' +
                '<td ' + tdLabel + '>Alamat</td>' +
                '<td ' + tdSep   + '>:</td>' +
                '<td ' + tdVal   + '>' + _escHtml(pasienAlamat) + '</td>' +
                '</tr>'
            );
        }

        return [
            '<div style="border-top:1.5px solid #1a3a6b;padding-top:8px;margin-bottom:4px;">',
            '<table style="width:100%;border-collapse:collapse;">',
            rows.join(''),
            '</table>',
            '</div>'
        ].join('');
    })();

    const catatanKaki = '<div style="margin-top:8px;font-size:8px;color:#94a3b8;font-style:italic;font-family:Times New Roman,serif;border-top:1px dashed #e2e8f0;padding-top:5px;">' +
        '&#9877; Harap hubungi dokter jika timbul reaksi yang tidak diinginkan &nbsp;|&nbsp; Resep ini hanya berlaku 1x pengambilan' +
        '</div>';

    const resepContent = '<div id="resepDokumenPro" style="font-family:Times New Roman,Georgia,serif;color:#1a1a2e;background:#fff;position:relative;">' +
        headerKlinik + tanggalBaris + garisTengah +
        '<div style="min-height:60px;margin-bottom:0;">' + obatHtml + '</div>' +
        '<div style="border-top:1px solid #1a3a6b;margin:10px 0 18px;opacity:0.5;"></div>' +
        ttdDokter + identitasPasien + catatanKaki +
        '</div>';

    // ── 9. Style komponen R/ ──
    const rxStyles = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap');
        @keyframes _rxFadeIn  { from{opacity:0}           to{opacity:1} }
        @keyframes _rxSlideUp { from{transform:translateY(50px);opacity:0} to{transform:translateY(0);opacity:1} }

        ._rx-item {
            display:flex; align-items:flex-start; gap:8px;
            padding:10px 4px;
        }
        ._rx-prefix {
            font-family:'IM Fell English','Times New Roman',serif;
            font-size:20px; font-weight:700; color:#1a3a6b;
            line-height:1; min-width:24px; padding-top:1px;
        }
        ._rx-body    { flex:1; min-width:0; }
        ._rx-namarow { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:2px; }
        ._rx-nama    { font-family:'Times New Roman',serif; font-size:13.5px; font-weight:700; color:#1a1a2e; }
        ._rx-no      { font-family:'Times New Roman',serif; font-size:13.5px; font-weight:700; color:#1a3a6b; white-space:nowrap; flex-shrink:0; }
        ._rx-signa   { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; margin-top:1px; }
        ._rx-frek    { font-size:13.5px; color:#1a1a2e; font-family:'Times New Roman',serif; font-weight:600; }
        ._rx-frek-id { font-size:10px; color:#94a3b8; font-style:italic; font-family:'Times New Roman',serif; }
        ._rx-cat     { font-size:10.5px; color:#b45309; font-style:italic; font-family:'Times New Roman',serif; }
        ._rx-divider { border-top:1px dashed #e2e8f0; margin:0 4px; }

        @media print {
            body > *:not(#modalResepPro) { display:none !important; }
            #modalResepPro { position:static!important; background:none!important; padding:0!important; }
            #resepProShell { box-shadow:none!important; border-radius:0!important; max-height:none!important; overflow:visible!important; width:100%!important; }
            #resepProActions { display:none!important; }
            @page { size:A5 portrait; margin:10mm; }
        }
    </style>`;

    // ── 10. Bangun elemen modal ──
    const modal = document.createElement('div');
    modal.id = 'modalResepPro';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:10000;
        background:rgba(15,23,42,0.6);
        display:flex;align-items:flex-end;justify-content:center;
        padding:0;animation:_rxFadeIn .2s ease;`;

    modal.innerHTML = `
    ${rxStyles}
    <div id="resepProShell" style="
        background:#fff;width:100%;max-width:480px;
        border-radius:20px 20px 0 0;
        box-shadow:0 -12px 48px rgba(0,0,0,0.22);
        max-height:92vh;display:flex;flex-direction:column;
        animation:_rxSlideUp .28s cubic-bezier(.34,1.3,.64,1);">

        <!-- ── Handle bar + Judul ── -->
        <div style="padding:14px 16px 6px;flex-shrink:0;">
            <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:0 auto 12px;"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:14px;font-weight:800;color:#1a3a6b;display:flex;align-items:center;gap:7px;">
                    <span style="background:linear-gradient(135deg,#1a3a6b,#2563eb);color:#fff;border-radius:8px;padding:3px 9px;font-size:12px;letter-spacing:.5px;">R/</span>
                    Resep Dokter
                </div>
                <button onclick="document.getElementById('modalResepPro').remove()"
                    style="background:rgba(100,116,139,0.1);border:none;border-radius:50%;
                           width:32px;height:32px;font-size:16px;cursor:pointer;
                           display:flex;align-items:center;justify-content:center;color:#64748b;">✕</button>
            </div>
        </div>

        <!-- ── Konten resep (scrollable) ── -->
        <div style="overflow-y:auto;padding:12px 16px 4px;flex:1;">
            <!-- Kertas resep dengan efek paper -->
            <div style="
                background:#fffef8;
                border:1px solid #e8e4d4;
                border-radius:10px;
                padding:18px 16px;
                box-shadow:inset 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06);
                position:relative;
                overflow:hidden;">

                <!-- Garis kertas dekoratif (background) -->
                <div style="
                    position:absolute;inset:0;
                    background:repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 23px,
                        rgba(200,210,230,0.18) 23px,
                        rgba(200,210,230,0.18) 24px
                    );pointer-events:none;"></div>

                <!-- Konten resep -->
                <div id="resepProContent" style="position:relative;">
                    ${resepContent}
                </div>
            </div>
        </div>

        <!-- ── Tombol aksi ── -->
        <div id="resepProActions" style="
            padding:12px 16px 20px;
            display:flex;gap:8px;
            border-top:1px solid #f1f5f9;
            flex-shrink:0;background:#fff;">

            <button onclick="_cetakResepIsolated()"
                style="flex:1;padding:12px 0;
                       background:linear-gradient(135deg,#1a3a6b,#2563eb);
                       color:#fff;border:none;border-radius:12px;
                       font-size:13px;font-weight:700;cursor:pointer;
                       display:flex;align-items:center;justify-content:center;gap:6px;
                       box-shadow:0 4px 14px rgba(37,99,235,0.35);
                       transition:all .2s;"
                onmouseover="this.style.transform='translateY(-1px)'"
                onmouseout="this.style.transform=''">
                🖨️ Cetak Resep
            </button>

            <button onclick="_bagikanResep()"
                style="padding:12px 14px;
                       background:rgba(37,99,235,0.08);color:#2563eb;
                       border:1.5px solid rgba(37,99,235,0.25);border-radius:12px;
                       font-size:13px;font-weight:700;cursor:pointer;">
                📤 Bagikan
            </button>

            <button onclick="document.getElementById('modalResepPro').remove()"
                style="padding:12px 16px;background:#f1f5f9;
                       color:#475569;border:none;border-radius:12px;
                       font-size:13px;font-weight:600;cursor:pointer;">
                Tutup
            </button>
        </div>
    </div>`;

    // Tutup saat klik backdrop
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

// ════════════════════════════════════════
//  CETAK RESEP (isolated window)
// ════════════════════════════════════════
function _cetakResepIsolated() {
    const contentEl = document.getElementById('resepProContent');
    if (!contentEl) { window.print(); return; }
    const content = contentEl.innerHTML;

    const win = window.open('', '_blank', 'width=520,height=760');
    if (!win) {
        if (typeof showToast === 'function') showToast('⚠️ Izinkan popup untuk cetak resep', 'error');
        return;
    }

    win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Resep Dokter</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap">
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body {
      font-family:'Times New Roman',Georgia,serif;
      font-size:12px;color:#1a1a2e;background:#fff;
      padding:16px;
  }
  ._rx-item { display:flex;align-items:flex-start;gap:8px;padding:10px 4px; }
  ._rx-prefix { font-family:'IM Fell English','Times New Roman',serif;font-size:18px;font-weight:700;color:#1a3a6b;line-height:1;min-width:22px;padding-top:1px; }
  ._rx-body  { flex:1;min-width:0; }
  ._rx-namarow { display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:2px; }
  ._rx-nama  { font-family:'Times New Roman',serif;font-size:13.5px;font-weight:700;color:#1a1a2e; }
  ._rx-no    { font-family:'Times New Roman',serif;font-size:13.5px;font-weight:700;color:#1a3a6b;white-space:nowrap;flex-shrink:0; }
  ._rx-signa { display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:1px; }
  ._rx-frek  { font-size:13.5px;color:#1a1a2e;font-family:'Times New Roman',serif;font-weight:600; }
  ._rx-frek-id { font-size:10px;color:#94a3b8;font-style:italic;font-family:'Times New Roman',serif; }
  ._rx-cat   { font-size:10.5px;color:#b45309;font-style:italic;font-family:'Times New Roman',serif; }
  ._rx-divider { border-top:1px dashed #e2e8f0;margin:0 4px; }
  @media print {
    @page { size:A5 portrait;margin:8mm; }
    body  { padding:0; }
  }
</style>
</head>
<body>${content}</body>
<script>
  window.onload = function(){
      window.print();
      window.onafterprint = function(){ window.close(); };
  };
<\/script>
</html>`);
    win.document.close();
}

// ════════════════════════════════════════
//  BAGIKAN RESEP (Web Share API)
// ════════════════════════════════════════
function _bagikanResep() {
    const contentEl = document.getElementById('resepProContent');
    if (!contentEl) return;

    // Buat teks plain dari konten resep
    const namaEl  = contentEl.querySelector('#resepDokumenPro');
    const teks    = namaEl ? namaEl.innerText : contentEl.innerText;

    if (navigator.share) {
        navigator.share({
            title: 'Resep Dokter',
            text:  teks
        }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(teks).then(() => {
            if (typeof showToast === 'function') showToast('✅ Teks resep disalin ke clipboard', 'success');
        }).catch(() => {
            if (typeof showToast === 'function') showToast('⚠️ Tidak dapat menyalin', 'warning');
        });
    } else {
        if (typeof showToast === 'function') showToast('⚠️ Fitur berbagi tidak didukung browser ini', 'warning');
    }
}

// ════════════════════════════════════════
//  HELPER UTILITIES
// ════════════════════════════════════════

/** Escape HTML — delegate ke window.escHtml (definisi kanonik di supabase.js) */
const _escHtml = (str) => window.escHtml(str);

/**
 * Konversi angka ke angka romawi (untuk nomor obat: No. I, No. II, dst.)
 */
function _toRoman(num) {
    const map = [
        [1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],
        [100,'C'],[90,'XC'],[50,'L'],[40,'XL'],
        [10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']
    ];
    let result = '';
    for (const [val, sym] of map) {
        while (num >= val) { result += sym; num -= val; }
    }
    return result;
}

/**
 * Konversi frekuensi Indonesia ke notasi latin medis
 * Contoh: "3x1" → "S 3 dd tab 1"
 */
function _frekToLatin(frek, satuan) {
    if (!frek) return '';
    const f = frek.toLowerCase().trim();

    // Konversi satuan obat ke singkatan signa (pakai fungsi terpusat)
    const sig = _satuanKeSig(satuan);

    // Mapping frekuensi umum — format: S {dd} dd {dose} {sig}
    // Contoh: "S 3 dd 1 cth", "S 2 dd 1 tab"
    const map = {
        '1x1'              : 'S 1 dd 1 ' + sig,
        '2x1'              : 'S 2 dd 1 ' + sig,
        '3x1'              : 'S 3 dd 1 ' + sig,
        '3x2'              : 'S 3 dd 2 ' + sig,
        '4x1'              : 'S 4 dd 1 ' + sig,
        '1x1 malam'        : 'S 1 dd 1 ' + sig + ' (nocte)',
        'prn'              : 'S prn (bila perlu)',
        'sekali sehari'    : 'S 1 dd 1 ' + sig,
        'dua kali sehari'  : 'S 2 dd 1 ' + sig,
        'tiga kali sehari' : 'S 3 dd 1 ' + sig,
        'empat kali sehari': 'S 4 dd 1 ' + sig,
        'bila perlu'       : 'S prn',
    };

    if (map[f]) return map[f];

    // Parse pola NxM (misal 2x2, 3x½, dll) — format: S {N} dd {M} {sig}
    const m = f.match(/^(\d+)\s*[xX×]\s*(\d+(?:[.,]\d+)?)(.*)$/);
    if (m) {
        const dd   = m[1];
        const dose = m[2].replace(',', '.');
        const suf  = m[3].trim();
        return 'S ' + dd + ' dd ' + dose + ' ' + sig + (suf ? ' ' + suf : '');
    }

    return frek;
}


// ════════════════════════════════════════════════════════
//  § 2 — MODAL RIWAYAT (lihat & edit kunjungan)
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL MODAL
//  Modal lihat & edit riwayat kunjungan
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  HELPER: CEK HAK AKSES EDIT
//  Mengembalikan { boleh: bool, alasan: string }
//
//  Aturan:
//  1. Data lebih dari 2 hari → TERKUNCI untuk semua
//  2. Dokter (jabatan='Dokter') → BOLEH edit kapan saja
//     dalam batas waktu 2 hari
//  3. User lain hanya boleh edit jika mereka yang menulis
//     (r.user_id === loggedInUser.id)
// ════════════════════════════════════════════════════════
function _cekHakAksesEdit(r) {
    // Cek batas waktu 2 hari
    if (r.tgl) {
        const tglRekam = new Date(r.tgl);        // format YYYY-MM-DD dari Supabase
        tglRekam.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selisihHari = Math.floor((today - tglRekam) / (1000 * 60 * 60 * 24));

        if (selisihHari > 2) {
            return {
                boleh: false,
                alasan: `Data tanggal ${formatTglIndo(r.tgl)} sudah melewati batas edit 2 hari. Hubungi Admin jika perlu koreksi.`
            };
        }
    }

    // Cek identitas user yang login
    const user = (typeof loggedInUser !== 'undefined') ? loggedInUser : null;
    if (!user) {
        return { boleh: false, alasan: 'Anda belum login.' };
    }

    const jabatan = (user.jabatan || '').toLowerCase();

    // Dokter boleh edit semua data (dalam 2 hari)
    if (jabatan === 'dokter') {
        return { boleh: true, alasan: '' };
    }

    // User lain hanya boleh edit data yang dia tulis sendiri
    if (r.user_id && user.id && r.user_id === user.id) {
        return { boleh: true, alasan: '' };
    }

    // Bukan dokter dan bukan penulis
    const penulisNama = _getNamaUserById(r.user_id);
    const pesanPenulis = penulisNama ? ` (ditulis oleh ${penulisNama})` : '';
    return {
        boleh: false,
        alasan: `Hanya Dokter atau petugas yang menulis data ini${pesanPenulis} yang dapat mengedit.`
    };
}

// Helper: cari nama user dari cache berdasarkan user_id
function _getNamaUserById(userId) {
    if (!userId) return null;
    const cache = window._usersCache || [];
    const u = cache.find(x => x.id === userId);
    return u ? u.nama : null;
}

// ════════════════════════════════════════════════════════
//  BUKA MODAL RIWAYAT
// ════════════════════════════════════════════════════════
function openModal(index) {
    const r = currentRiwayat[index];
    if (!r) return;
    if ($('modalIndex')) $('modalIndex').value = index;

    const access = window._currentAccess || [];
    const hasM   = id => access.length === 0 || access.includes(id);

    // ── VIEW: Header tanggal / identitas
    if ($('modalTanggalInfoView')) {
        $('modalTanggalInfoView').innerText =
            "📅 " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";
        $('modalTanggalInfoView').style.display = hasM('mod_modal_identitas') ? '' : 'none';
    }

    // ── VIEW: TTV ──
    const ttvViewRow = $('viewTtv')?.closest('.detail-row');
    if (ttvViewRow) ttvViewRow.style.display = hasM('mod_modal_ttv') ? '' : 'none';
    if ($('viewTtv') && hasM('mod_modal_ttv')) {
        const tdParts = (r.td || '').split('/');
        const sistol  = tdParts[0] ? tdParts[0].trim() : '-';
        const diastol = tdParts[1] ? tdParts[1].trim() : '-';
        $('viewTtv').innerHTML =
            `TD: ${sistol}/${diastol} mmHg &nbsp;|&nbsp; Nadi: ${r.nadi||'-'} x/m &nbsp;|&nbsp; Suhu: ${r.suhu||'-'} °C` +
            `<br>RR: ${r.rr||'-'} x/m &nbsp;|&nbsp; BB: ${r.bb||'-'} kg &nbsp;|&nbsp; TB: ${r.tb||'-'} cm`;
    }

    // ── VIEW: Alergi
    const alergiRow = $('viewAlergiRow');
    const alergiEl  = $('viewAlergi');
    if (alergiRow && alergiEl) {
        const pasienCache = (typeof allPatients !== 'undefined' ? allPatients : []);
        const pasienData  = pasienCache.find(p => p.id === currentPasienId);
        const alergiVal   = (pasienData && pasienData.alergi) ? pasienData.alergi.trim() : '';
        alergiEl.innerText      = alergiVal || 'Tidak ada / tidak tercatat';
        alergiRow.style.display = hasM('mod_modal_alergi') ? '' : 'none';
    }

    // ── VIEW: Keluhan
    const keluhanViewRow = $('viewKeluhan')?.closest('.detail-row');
    if (keluhanViewRow) keluhanViewRow.style.display = hasM('mod_modal_keluhan') ? '' : 'none';
    if ($('viewKeluhan')) $('viewKeluhan').innerText = r.keluhan || '-';

    // ── VIEW: Fisik
    const fisikViewRow = $('viewFisik')?.closest('.detail-row');
    if (fisikViewRow) fisikViewRow.style.display = hasM('mod_modal_fisik') ? '' : 'none';
    if ($('viewFisik')) $('viewFisik').innerText = r.fisik || '-';

    // ── VIEW: Lab ──
    const labRow = $('viewLabRow');
    const hasLab = r.lab_gds || r.lab_chol || r.lab_ua;
    if (labRow) labRow.style.display = (hasM('mod_modal_lab') && hasLab) ? '' : 'none';
    if ($('viewLab')) $('viewLab').innerHTML = hasLab
        ? `GDS: ${r.lab_gds||'-'} mg/dL &nbsp;|&nbsp; Kolesterol: ${r.lab_chol||'-'} mg/dL &nbsp;|&nbsp; Asam Urat: ${r.lab_ua||'-'} mg/dL`
        : '-';

    // ── VIEW: Diagnosa & Terapi ──
    if ($('viewDiag'))   $('viewDiag').innerText  = r.diag   || '-';
    if ($('viewTerapi')) $('viewTerapi').innerText = r.terapi || '-';
    if ($('viewDiagRow'))   $('viewDiagRow').style.display   = hasM('mod_modal_diagnosa') ? '' : 'none';
    if ($('viewTerapiRow')) $('viewTerapiRow').style.display  = hasM('mod_modal_diagnosa') ? '' : 'none';

    // ── VIEW: Dokter Pemeriksa ──
    const dokterRow = $('viewDokterRow');
    const dokterEl  = $('viewDokterPemeriksa');
    if (dokterEl && dokterRow) {
        if (hasM('mod_modal_dokter') && r.dokterNama) {
            dokterEl.innerText      = r.dokterNama;
            dokterRow.style.display = '';
        } else {
            dokterRow.style.display = 'none';
        }
    }

    // ── CEK HAK AKSES EDIT ──
    const hakEdit = _cekHakAksesEdit(r);
    const lockNotif  = $('editLockNotif');
    const lockMsg    = $('editLockMsg');
    const btnEdit    = $('btnToggleEdit');

    // Edit hanya jika punya mod_modal_edit
    const canEditByAccess = hasM('mod_modal_edit');

    if (!canEditByAccess) {
        if (btnEdit) btnEdit.style.display = 'none';
        if (lockNotif) lockNotif.style.display = 'none';
    } else if (hakEdit.boleh) {
        if (lockNotif) lockNotif.style.display = 'none';
        if (btnEdit) {
            btnEdit.style.display  = '';
            btnEdit.disabled       = false;
            btnEdit.innerText      = '✏️ Edit Data';
            btnEdit.style.opacity  = '1';
        }
    } else {
        if (lockNotif) lockNotif.style.display = '';
        if (lockMsg)   lockMsg.innerText        = hakEdit.alasan;
        if (btnEdit) {
            btnEdit.disabled       = true;
            btnEdit.innerText      = '🔒 Terkunci';
            btnEdit.style.opacity  = '0.5';
        }
    }

    // ── EDIT: Populate form ──
    if ($('modalTanggalInfoEdit'))
        $('modalTanggalInfoEdit').innerText =
            "✏️ Edit: " + (r.tgl ? formatTglIndo(r.tgl) : '-') + " (" + (r.waktu || '00:00') + ")";

    // TTV — pisahkan td "120/80"
    const tdParts2 = (r.td || '').split('/');
    if ($('modalSistol'))  $('modalSistol').value  = tdParts2[0] ? tdParts2[0].trim() : '';
    if ($('modalDiastol')) $('modalDiastol').value = tdParts2[1] ? tdParts2[1].trim() : '';
    if ($('modalNadi'))    $('modalNadi').value     = r.nadi    || '';
    if ($('modalSuhu'))    $('modalSuhu').value     = r.suhu    || '';
    if ($('modalRr'))      $('modalRr').value       = r.rr      || '';
    if ($('modalBb'))      $('modalBb').value       = r.bb      || '';
    if ($('modalTb'))      $('modalTb').value       = r.tb      || '';

    // Alergi — dari data pasien (permanen)
    if ($('modalAlergi')) {
        const pasienCache2 = (typeof allPatients !== 'undefined' ? allPatients : []);
        const pasienData2  = pasienCache2.find(p => p.id === currentPasienId);
        $('modalAlergi').value = (pasienData2 && pasienData2.alergi) ? pasienData2.alergi : '';
    }

    // Keluhan & Fisik
    if ($('modalKeluhan')) $('modalKeluhan').value = r.keluhan || '';
    if ($('modalFisik'))   $('modalFisik').value   = r.fisik   || '';

    // Lab
    if ($('modalLabGds'))  $('modalLabGds').value  = r.lab_gds  || '';
    if ($('modalLabChol')) $('modalLabChol').value = r.lab_chol || '';
    if ($('modalLabUa'))   $('modalLabUa').value   = r.lab_ua   || '';

    // Diagnosa — prioritaskan kolom diagnosa2 terpisah dari DB.
    // Fallback parse " | " hanya untuk data lama yang masih digabung.
    if (r.diagnosa2) {
        if ($('modalDiag1')) $('modalDiag1').value = r.diag      || '';
        if ($('modalDiag2')) $('modalDiag2').value = r.diagnosa2 || '';
    } else {
        const diagLama = String(r.diag || '');
        if (diagLama.includes(' | ')) {
            if ($('modalDiag1')) $('modalDiag1').value = diagLama.split(' | ')[0];
            if ($('modalDiag2')) $('modalDiag2').value = diagLama.split(' | ')[1];
        } else {
            if ($('modalDiag1')) $('modalDiag1').value = diagLama;
            if ($('modalDiag2')) $('modalDiag2').value = '';
        }
    }
    if ($('modalTerapi')) $('modalTerapi').value = r.terapi || '';

    // Sembunyikan seksi Diagnosa jika tidak punya akses
    const editDiagSection = $('modalEditDiagSection');
    if (editDiagSection) editDiagSection.style.display = hasM('mod_modal_diagnosa') ? '' : 'none';

    toggleEditModal(false);

    // Invoice button: tampil hanya jika modul biaya aktif, kunjungan punya ID, dan punya hak akses mod_modal_status_bayar
    const invRow = $('viewInvoiceRow');
    if (invRow) {
        const biayaAktif = window._biayaAktif === true;
        invRow.style.display = (biayaAktif && r.id && hasM('mod_modal_status_bayar')) ? '' : 'none';
        window._modalCurrentKunjId     = r.id  || null;
        window._modalCurrentPasienNama = (typeof allPatients !== 'undefined')
            ? (allPatients.find(p => p.id === currentPasienId)?.nama || '')
            : '';
        window._modalCurrentTgl = r.tgl || '';
    }

    const modal = $('modalRiwayat');
    if (modal) modal.classList.add('show');
}

// ── TOGGLE VIEW / EDIT ──
function toggleEditModal(isEdit) {
    if ($('modalTitle'))
        $('modalTitle').innerText = isEdit ? "✏️ Edit Rekam Medis" : "📋 Detail Rekam Medis";
    if ($('modalView')) $('modalView').style.display = isEdit ? 'none'  : 'block';
    if ($('modalEdit')) $('modalEdit').style.display = isEdit ? 'block' : 'none';
}

function closeModal() {
    const modal = $('modalRiwayat');
    if (modal) modal.classList.remove('show');
}

// ════════════════════════════════════════════════════════
//  SIMPAN EDIT DARI MODAL
// ════════════════════════════════════════════════════════
async function simpanEditModal() {
    const btn = $('btnSaveModal');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    const idx = $('modalIndex') ? parseInt($('modalIndex').value) : 0;
    const r   = currentRiwayat[idx];
    if (!r) {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
        return showToast("❌ Data tidak ditemukan", "error");
    }

    // Re-cek hak akses sebelum simpan (double guard)
    const hakEdit = _cekHakAksesEdit(r);
    if (!hakEdit.boleh) {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
        return showToast("⛔ " + hakEdit.alasan, "error");
    }

    const d1 = $('modalDiag1') ? $('modalDiag1').value.trim() : '';
    const d2 = $('modalDiag2') ? $('modalDiag2').value.trim() : '';
    // BUG FIX: kirim diagnosa & diagnosa2 sebagai kolom terpisah
    // (bukan digabung "d1 | d2") agar kolom diagnosa2 di DB tidak terhapus

    // Gabungkan sistol/diastol ke format "120/80"
    const sistol  = $('modalSistol')  ? $('modalSistol').value.trim()  : '';
    const diastol = $('modalDiastol') ? $('modalDiastol').value.trim() : '';
    const tdGabung = (sistol && diastol) ? `${sistol}/${diastol}` : (sistol || diastol || '');

    const payload = {
        pasienId:    currentPasienId,
        kunjunganId: r.id,
        keluhan:  $('modalKeluhan') ? $('modalKeluhan').value : '',
        fisik:    $('modalFisik')   ? $('modalFisik').value   : '',
        td:       tdGabung,
        nadi:     $('modalNadi')    ? $('modalNadi').value    : '',
        suhu:     $('modalSuhu')    ? $('modalSuhu').value    : '',
        rr:       $('modalRr')      ? $('modalRr').value      : '',
        bb:       $('modalBb')      ? $('modalBb').value      : '',
        tb:       $('modalTb')      ? $('modalTb').value      : '',
        alergi:   $('modalAlergi')  ? $('modalAlergi').value.trim()  : '',
        // Lab dasar (ada input di modal)
        lab_gds:  $('modalLabGds')  ? $('modalLabGds').value  : '',
        lab_chol: $('modalLabChol') ? $('modalLabChol').value : '',
        lab_ua:   $('modalLabUa')   ? $('modalLabUa').value   : '',
        // BUG-07 FIX: sertakan semua field lab lainnya dengan fallback ke nilai lama
        // agar sb_saveKunjungan() tidak meng-overwrite data yang ada ke null
        lab_hb:          r.lab_hb          || '',
        lab_trombosit:   r.lab_trombosit   || '',
        lab_leukosit:    r.lab_leukosit    || '',
        lab_eritrosit:   r.lab_eritrosit   || '',
        lab_hematokrit:  r.lab_hematokrit  || '',
        lab_hiv:         r.lab_hiv         || '',
        lab_sifilis:     r.lab_sifilis     || '',
        lab_hepatitis:   r.lab_hepatitis   || '',
        lab_hdl:         r.lab_hdl         || '',
        lab_ldl:         r.lab_ldl         || '',
        lab_tg:          r.lab_tg          || '',
        lab_gdp:         r.lab_gdp         || '',
        lab_hba1c:       r.lab_hba1c       || '',
        lab_sgot:        r.lab_sgot        || '',
        lab_sgpt:        r.lab_sgpt        || '',
        lab_ureum:       r.lab_ureum       || '',
        lab_creatinin:   r.lab_creatinin   || '',
        // BUG FIX: diagnosa & diagnosa2 terpisah
        diagnosa:   d1,
        diagnosa2:  d2,
        terapi:     $('modalTerapi') ? $('modalTerapi').value : '',
        // BUG FIX: pertahankan surat_sakit & req_lab dari data lama
        // agar tidak tertimpa null saat edit modal (field ini tidak ada di form modal)
        suratSakit: r.surat_sakit || null,
        req_lab:    r.req_lab     || null
    };

    try {
        await sb_saveKunjungan(payload);

        // Update alergi ke tabel pasien (data permanen) dan cache lokal allPatients
        const alergiVal = $('modalAlergi') ? $('modalAlergi').value.trim() : '';
        if (currentPasienId && currentPasienId !== 'null') {
            await _sbFetch(`pasien?id=eq.${currentPasienId}`, {
                method: 'PATCH',
                body: { alergi: alergiVal || null },
                prefer: 'return=minimal'
            });
        }
        // Sync cache allPatients agar tampilan modal langsung update
        if (typeof allPatients !== 'undefined') {
            const pIdx = allPatients.findIndex(p => p.id === currentPasienId);
            if (pIdx !== -1) allPatients[pIdx].alergi = alergiVal;
        }
        // Sync form utama jika sedang di halaman medis
        if ($('alergi')) $('alergi').value = alergiVal;
        localStorage.setItem('rme_alergi', alergiVal);

        showToast("✅ Perubahan berhasil disimpan", "success");

        // Update cache lokal kunjungan (tanpa alergi — sudah di pasien)
        Object.assign(r, {
            keluhan:  payload.keluhan,  fisik:    payload.fisik,
            td:       payload.td,       nadi:     payload.nadi,
            suhu:     payload.suhu,     rr:       payload.rr,
            bb:       payload.bb,       tb:       payload.tb,
            lab_gds:  payload.lab_gds,  lab_chol: payload.lab_chol,
            lab_ua:   payload.lab_ua,
            // BUG-07 FIX: sync semua field lab ke cache lokal
            lab_hb:        payload.lab_hb,        lab_trombosit: payload.lab_trombosit,
            lab_leukosit:  payload.lab_leukosit,  lab_eritrosit:  payload.lab_eritrosit,
            lab_hematokrit:payload.lab_hematokrit, lab_hiv:       payload.lab_hiv,
            lab_sifilis:   payload.lab_sifilis,   lab_hepatitis:  payload.lab_hepatitis,
            lab_hdl:       payload.lab_hdl,       lab_ldl:        payload.lab_ldl,
            lab_tg:        payload.lab_tg,        lab_gdp:        payload.lab_gdp,
            lab_hba1c:     payload.lab_hba1c,     lab_sgot:       payload.lab_sgot,
            lab_sgpt:      payload.lab_sgpt,      lab_ureum:      payload.lab_ureum,
            lab_creatinin: payload.lab_creatinin,
            // BUG FIX: sync diagnosa2 & surat_sakit ke cache agar modal berikutnya
            // menampilkan data yang benar tanpa perlu fetch ulang dari server
            diag:        payload.diagnosa,
            diagnosa2:   payload.diagnosa2,
            terapi:      payload.terapi,
            surat_sakit: payload.suratSakit
        });

        // BUG-08 FIX: Update status ke "Selesai" jika diagnosa & terapi sudah diisi,
        // baik di cache riwayat maupun di array kunjunganHariIni.
        const isSelesai = !!(payload.diagnosa && payload.terapi);
        if (isSelesai) {
            r.status = 'Selesai';
            if (typeof kunjunganHariIni !== 'undefined') {
                const kIdx = kunjunganHariIni.findIndex(x => x.id === r.id);
                if (kIdx !== -1) kunjunganHariIni[kIdx].status = 'Selesai';
            }
        }

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        if ($('riwayatDaftarContainer'))
            renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));
        closeModal();
    } catch (e) {
        showToast("❌ Gagal menyimpan perubahan: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
    }
}


// ── Invoice dari modal riwayat ──
function _viewInvoiceFromModal() {
    const kunjId    = window._modalCurrentKunjId;
    const nama      = window._modalCurrentPasienNama;
    const tgl       = window._modalCurrentTgl;
    if (!kunjId) return showToast('⚠️ Data kunjungan tidak tersedia', 'error');
    if (typeof lihatTagihanKunjungan === 'function') {
        lihatTagihanKunjungan(kunjId, nama, tgl);
    }
}

// ── LIHAT LENGKAP: buka kunjungan di pageMedis penuh ──
// Membuka rekam medis riwayat yang dipilih di modal langsung ke pageMedis
// dalam mode edit/view penuh — bukan modal ringkas.
async function _lihatLengkapDariModal() {
    const idx = parseInt(document.getElementById('modalIndex')?.value ?? '-1');
    const r   = (typeof currentRiwayat !== 'undefined' ? currentRiwayat : [])[idx];
    if (!r || !r.id) return showToast('⚠️ Data kunjungan tidak tersedia', 'error');

    // Simpan state ke localStorage agar initApp / _recoverLanjutkan bisa restore
    const pasienId = typeof currentPasienId !== 'undefined' ? currentPasienId : null;
    const pasien   = (typeof allPatients !== 'undefined' ? allPatients : []).find(p => p.id === pasienId) || {};

    localStorage.setItem('cP_id',       pasienId || '');
    localStorage.setItem('cK_id',       r.id);
    localStorage.setItem('cP_nama',     pasien.nama   || r.nama   || '—');
    localStorage.setItem('cP_nik',      pasien.nik    || '');
    localStorage.setItem('cP_umur',     pasien.tgl    ? (typeof hitungUmur === 'function' ? hitungUmur(pasien.tgl) : '') : '');
    localStorage.setItem('cP_tglLahir', pasien.tgl    || '');
    localStorage.setItem('cTglEdit',    r.tgl ? (typeof formatTglIndo === 'function' ? formatTglIndo(r.tgl) : r.tgl) : '');
    localStorage.setItem('activePage',  'pageMedis');

    closeModal();

    // Populate banner info pasien
    const $ = id => document.getElementById(id);
    if ($('infoPasienNama'))     $('infoPasienNama').innerText     = pasien.nama   || r.nama   || '—';
    if ($('infoPasienNik'))      $('infoPasienNik').innerText      = pasien.nik    || '';
    if ($('infoPasienUmur'))     $('infoPasienUmur').innerText     = pasien.tgl && typeof hitungUmur === 'function' ? hitungUmur(pasien.tgl) : '';
    if ($('infoTglPemeriksaan')) {
        $('infoTglPemeriksaan').innerText     = localStorage.getItem('cTglEdit') || '';
        $('infoTglPemeriksaan').style.display = 'block';
    }
    if ($('infoPasienTglLahir') && pasien.tgl) {
        $('infoPasienTglLahir').innerText     = pasien.tgl;
        $('infoPasienTglLahir').style.display = '';
    }

    // Set globals
    if (typeof window !== 'undefined') {
        window.currentPasienId    = pasienId;
        window.currentKunjunganId = r.id;
    }

    // Render section dinamis
    if (typeof _renderSectionLabDinamic === 'function') _renderSectionLabDinamic();

    // Fetch & isi form dari data kunjungan
    try {
        showToast('⏳ Memuat data pemeriksaan...', 'info');
        const kunjunganData = await sb_getKunjunganById(r.id);
        if (kunjunganData && typeof _isiFormDariKunjungan === 'function') {
            _isiFormDariKunjungan(kunjunganData);
            document.querySelectorAll('[data-save="true"]').forEach(el =>
                localStorage.setItem('rme_' + el.id, el.value)
            );
            if (typeof renderMedisDinamis === 'function') {
                window._ensureTarifCacheThen
                    ? window._ensureTarifCacheThen(() => renderMedisDinamis())
                    : renderMedisDinamis();
            }
            if (window._stokAktif && typeof loadResepByKunjungan === 'function') {
                loadResepByKunjungan(r.id).catch(() => {});
            }
            if (kunjunganData.riwayat_penyakit && $('riwayat_penyakit')) {
                $('riwayat_penyakit').value = kunjunganData.riwayat_penyakit;
            }
        }
    } catch(e) {
        console.warn('[Klikpro] _lihatLengkapDariModal: gagal fetch kunjungan:', e.message);
        if (typeof loadAutosave === 'function') loadAutosave();
    }

    // Fetch alergi
    if (pasienId && pasienId !== 'null') {
        try {
            const pr = await _sbFetch('pasien?id=eq.' + pasienId + '&select=alergi&limit=1');
            if (pr && pr[0]) {
                const av = pr[0].alergi || '';
                if ($('alergi')) $('alergi').value = av;
                localStorage.setItem('rme_alergi', av);
            }
        } catch(e) {}
    }

    if (typeof calculateIMT  === 'function') calculateIMT();
    if (typeof checkTensi    === 'function') checkTensi();
    if (typeof checkLabAlert === 'function') checkLabAlert();

    // Navigasi ke pageMedis
    if (typeof switchPage === 'function') switchPage('pageMedis', null);
    setTimeout(() => {
        if (typeof _applyLockUI === 'function') _applyLockUI();
        // Tandai mode riwayat (readonly jika di luar batas edit)
        if (typeof _cekHakAksesEdit === 'function') {
            const hakEdit = _cekHakAksesEdit(r);
            if (!hakEdit.boleh) {
                showToast('🔒 ' + hakEdit.alasan, 'info');
            }
        }
        // ── Scroll ke banner nama pasien (card paling atas pageMedis) ──
        const pageMedis = document.getElementById('pageMedis');
        const bannerCard = pageMedis
            ? pageMedis.querySelector('.rm-card')
            : document.querySelector('#pageMedis .rm-card');
        if (bannerCard) {
            bannerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Fallback: scroll window ke atas
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Highlight singkat pada nama pasien agar mata langsung tertuju
        const namaEl = document.getElementById('infoPasienNama');
        if (namaEl) {
            namaEl.style.transition = 'background .25s, border-radius .25s, padding .25s';
            namaEl.style.background = 'rgba(37,99,235,0.13)';
            namaEl.style.borderRadius = '6px';
            namaEl.style.padding = '2px 6px';
            setTimeout(() => {
                namaEl.style.background = '';
                namaEl.style.borderRadius = '';
                namaEl.style.padding = '';
            }, 1800);
        }
    }, 150);
}


// ════════════════════════════════════════════════════════
//  § 3 — MODAL KONFIRMASI UNIVERSAL
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL KONFIRMASI UNIVERSAL
//  Menggantikan window.confirm() di seluruh aplikasi
//  API:
//    showKonfirmasi(opsi) → Promise<boolean>
//    showKonfirmasiHapus(namaItem, opsi?) → Promise<boolean>
//    showKonfirmasiDangerZone(namaItem, opsi?) → Promise<boolean>
// ════════════════════════════════════════════════════════

(function _initModalKonfirmasi() {

    // ── Inject CSS sekali ──
    if (!document.getElementById('mk-style')) {
        const s = document.createElement('style');
        s.id = 'mk-style';
        s.textContent = `
        #mkOverlay {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15,23,42,0.6);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            opacity: 0; transition: opacity 0.22s ease;
            pointer-events: none;
        }
        #mkOverlay.mk-visible {
            opacity: 1; pointer-events: auto;
        }
        #mkSheet {
            background: #fff;
            width: 100%; max-width: 420px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            padding: 0 0 16px;
            transform: scale(0.92) translateY(10px);
            transition: transform 0.28s cubic-bezier(.34,1.56,.64,1), opacity 0.22s ease;
            opacity: 0;
            max-height: 90vh;
            overflow-y: auto;
        }
        #mkOverlay.mk-visible #mkSheet {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        .mk-handle {
            display: none;
        }
        .mk-icon-wrap {
            font-size: 40px; text-align: center;
            margin: 24px 0 8px;
            line-height: 1;
        }
        .mk-title {
            font-size: 15px; font-weight: 800;
            color: #0f172a; text-align: center;
            padding: 0 24px; line-height: 1.4;
            margin-bottom: 6px;
        }
        .mk-msg {
            font-size: 12.5px; color: #64748b;
            text-align: center; padding: 0 24px 14px;
            line-height: 1.65;
        }
        .mk-input-wrap {
            padding: 0 20px 10px;
        }
        .mk-input-label {
            font-size: 11px; font-weight: 700;
            color: #64748b; text-transform: none;
            letter-spacing: .3px; margin-bottom: 5px;
            display: block;
        }
        .mk-input {
            width: 100%; padding: 9px 12px;
            border: 1.5px solid #e2e8f0; border-radius: 10px;
            font-size: 13px; font-family: inherit;
            outline: none; transition: border-color .15s;
            box-sizing: border-box;
        }
        .mk-input:focus { border-color: #6366f1; }
        .mk-input.mk-input-error { border-color: #ef4444; }
        .mk-divider {
            height: 1px; background: #f1f5f9; margin: 0 0 4px;
        }
        .mk-btn-group {
            display: flex; flex-direction: column;
            gap: 6px; padding: 4px 16px 8px;
        }
        .mk-btn {
            width: 100%; padding: 13px;
            border: none; border-radius: 13px;
            font-size: 13.5px; font-weight: 700;
            cursor: pointer; font-family: inherit;
            transition: opacity .15s, transform .1s;
            letter-spacing: .1px;
        }
        .mk-btn:active { opacity: .85; transform: scale(.98); }
        .mk-btn-primary {
            background: linear-gradient(135deg,#3b82f6,#6366f1);
            color: #fff;
        }
        .mk-btn-danger {
            background: linear-gradient(135deg,#ef4444,#dc2626);
            color: #fff;
        }
        .mk-btn-warning {
            background: linear-gradient(135deg,#f59e0b,#d97706);
            color: #fff;
        }
        .mk-btn-success {
            background: linear-gradient(135deg,#10b981,#059669);
            color: #fff;
        }
        .mk-btn-cancel {
            background: #f1f5f9; color: #64748b;
            font-weight: 600;
        }
        .mk-badge-danger {
            display: inline-block;
            background: rgba(239,68,68,.1);
            color: #dc2626; border: 1px solid rgba(239,68,68,.25);
            border-radius: 20px; font-size: 11px; font-weight: 700;
            padding: 2px 10px; margin-bottom: 6px;
        }
        `;
        document.head.appendChild(s);
    }

    // ── Buat DOM overlay (sekali) ──
    function _ensureDOM() {
        if (document.getElementById('mkOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'mkOverlay';
        ov.innerHTML = `<div id="mkSheet"><div class="mk-handle"></div><div id="mkBody"></div></div>`;
        document.body.appendChild(ov);
        // Tutup jika klik backdrop — BUG 2+3 FIX:
        // guard _resolve null & blokir backdrop dismiss saat requireInput aktif
        ov.addEventListener('click', e => {
            if (e.target === ov && typeof _resolve === 'function' && !_requireInput) _resolve(false);
        });
    }

    let _resolve = null;
    let _requireInput = false; // BUG 3 FIX: flag blokir backdrop dismiss saat DangerZone

    function _open() {
        // _ensureDOM() sudah dipanggil sebelum _setBody(), ini hanya safety guard
        _ensureDOM();
        // Double rAF: pastikan konten sudah ter-render di DOM sebelum animasi CSS berjalan
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const ov = document.getElementById('mkOverlay');
                if (ov) ov.classList.add('mk-visible');
            });
        });
    }

    function _close() {
        const ov = document.getElementById('mkOverlay');
        if (!ov) return;
        ov.classList.remove('mk-visible');
    }

    function _setBody(html) {
        const b = document.getElementById('mkBody');
        if (b) b.innerHTML = html;
    }

    // ────────────────────────────────────────
    //  CORE: showKonfirmasi(opsi)
    //  Opsi:
    //    icon      : string emoji (default '❓')
    //    title     : string
    //    message   : string
    //    confirmText  : string (default 'Ya, Lanjutkan')
    //    cancelText   : string (default 'Batal')
    //    type      : 'primary'|'danger'|'warning'|'success' (default 'primary')
    //    badge     : string | null — badge kecil di atas judul (opsional)
    //    requireInput : null | { label, match, placeholder, errorMsg }
    //                  Jika diisi, user harus mengetik teks tertentu sebelum tombol konfirmasi aktif
    // ────────────────────────────────────────
    window.showKonfirmasi = function(opts = {}) {
        return new Promise(res => {
            _resolve = ok => {
                _close();
                setTimeout(() => res(ok), 280);
            };

            const {
                icon         = '❓',
                title        = 'Konfirmasi',
                message      = '',
                confirmText  = 'Ya, Lanjutkan',
                cancelText   = 'Batal',
                type         = 'primary',
                badge        = null,
                requireInput = null
            } = opts;

            const badgeHtml = badge
                ? `<div style="text-align:center;padding:0 24px 2px;"><span class="mk-badge-danger">${badge}</span></div>`
                : '';

            const inputHtml = requireInput
                ? `<div class="mk-input-wrap">
                     <label class="mk-input-label">${requireInput.label || 'Ketik untuk konfirmasi'}</label>
                     <input class="mk-input" id="mkRequireInput" type="text"
                            placeholder="${requireInput.placeholder || requireInput.match}"
                            autocomplete="off" spellcheck="false">
                     <div id="mkInputErr" style="font-size:10.5px;color:#ef4444;margin-top:4px;display:none;">
                       ${requireInput.errorMsg || 'Teks tidak sesuai'}
                     </div>
                   </div>`
                : '';

            // FIX: _ensureDOM() harus dipanggil SEBELUM _setBody()
            // agar #mkBody sudah ada di DOM saat diisi konten
            _requireInput = !!requireInput; // BUG 3 FIX: set flag backdrop dismiss
            _ensureDOM();

            _setBody(`
                <div class="mk-icon-wrap">${icon}</div>
                ${badgeHtml}
                <div class="mk-title">${title}</div>
                ${message ? `<div class="mk-msg">${message}</div>` : ''}
                ${inputHtml}
                <div class="mk-divider"></div>
                <div class="mk-btn-group">
                    <button class="mk-btn mk-btn-${type}" id="mkBtnConfirm">${confirmText}</button>
                    <button class="mk-btn mk-btn-cancel" id="mkBtnCancel">${cancelText}</button>
                </div>
            `);

            _open();

            // Pasang event setelah DOM ada
            setTimeout(() => {
                const btnOk  = document.getElementById('mkBtnConfirm');
                const btnCx  = document.getElementById('mkBtnCancel');
                const inp    = document.getElementById('mkRequireInput');
                const errEl  = document.getElementById('mkInputErr');

                if (requireInput && inp) {
                    btnOk.disabled = true;
                    btnOk.style.opacity = '.45';
                    inp.addEventListener('input', () => {
                        const ok = inp.value.trim() === requireInput.match;
                        btnOk.disabled = !ok;
                        btnOk.style.opacity = ok ? '1' : '.45';
                        if (errEl) errEl.style.display = (!ok && inp.value.length > 0) ? '' : 'none';
                        inp.classList.toggle('mk-input-error', !ok && inp.value.length > 0);
                    });
                    inp.focus();
                }

                if (btnOk)  btnOk.onclick  = () => { if (!btnOk.disabled) _resolve(true);  };
                if (btnCx)  btnCx.onclick  = () => _resolve(false);
            }, 50);
        });
    };

    // ────────────────────────────────────────
    //  SHORTCUT: Konfirmasi hapus standar
    // ────────────────────────────────────────
    window.showKonfirmasiHapus = function(namaItem, opts = {}) {
        return showKonfirmasi({
            icon:        opts.icon || '🗑️',
            title:       opts.title || `Hapus "${namaItem}"?`,
            message:     opts.message || 'Data yang dihapus tidak dapat dikembalikan.',
            confirmText: opts.confirmText || 'Ya, Hapus',
            cancelText:  opts.cancelText || 'Batal',
            type:        'danger',
            badge:       opts.badge || null,
        });
    };

    // ────────────────────────────────────────
    //  SHORTCUT: Konfirmasi danger zone
    //  (user harus mengetik nama item untuk konfirmasi)
    // ────────────────────────────────────────
    window.showKonfirmasiDangerZone = function(namaItem, opts = {}) {
        return showKonfirmasi({
            icon:        opts.icon || '⚠️',
            badge:       'TINDAKAN TIDAK DAPAT DIBATALKAN',
            title:       opts.title || `Hapus Permanen "${namaItem}"?`,
            message:     opts.message ||
                         `Semua data terkait akan ikut terhapus.<br>Ketik <b>${namaItem}</b> di bawah untuk mengkonfirmasi.`,
            confirmText: opts.confirmText || 'Hapus Permanen',
            cancelText:  opts.cancelText || 'Batal',
            type:        'danger',
            requireInput: {
                label:       `Ketik "${namaItem}" untuk melanjutkan`,
                match:       namaItem,
                placeholder: namaItem,
                errorMsg:    'Teks tidak sesuai, hapus dibatalkan'
            }
        });
    };

    // ────────────────────────────────────────
    //  PATCH: Ganti confirm() asli di seluruh app
    //  (opsional — aktifkan jika ingin global)
    // ────────────────────────────────────────
    // window._nativeConfirm = window.confirm;
    // window.confirm = () => { console.warn('[Klikpro] Gunakan showKonfirmasi() bukan confirm()'); return true; };

    console.log('[Klikpro] ✅ modal-konfirmasi.js loaded');

})();


// ════════════════════════════════════════
//  PATCH FUNGSI YANG PAKAI confirm() ASLI
//  Jalankan setelah semua modul siap
// ════════════════════════════════════════
(function _patchConfirmCalls() {
    const MAX_WAIT = 8000, TICK = 200;
    let elapsed = 0;
    const iv = setInterval(() => {
        elapsed += TICK;
        // BUG 6 FIX: trigger setelah modul utama siap — cek hapusObat ATAU elapsed MAX_WAIT
        // Tidak bergantung hanya pada hapusTarif yang mungkin tidak ada jika biaya.js tidak load
        const modulSiap = typeof hapusTarif === 'function' || typeof hapusObat === 'function' || typeof hapusUser === 'function';
        if (!modulSiap && elapsed < MAX_WAIT) return;
        clearInterval(iv);

        // ── PATCH hapusTarif (biaya.js) ──
        if (typeof hapusTarif === 'function') {
            const _origHapusTarif = hapusTarif;
            window.hapusTarif = async function(id) {
                const t = (window._tarifCache || []).find(x => String(x.id) === String(id));
                const nama = t ? t.nama : 'tarif ini';
                const isRegistry = t && (typeof TARIF_DEFAULT !== 'undefined')
                    && TARIF_DEFAULT.some(d => d.nama === t.nama && d.kategori === t.kategori);

                const ok = await showKonfirmasi({
                    icon:        '🗑️',
                    title:       `Hapus "${nama}"?`,
                    message:     isRegistry
                        ? `Ini adalah tarif bawaan sistem. Jika dihapus akan <b>muncul kembali</b> otomatis saat halaman Tarif dibuka ulang.<br><br>Untuk menyembunyikan permanen gunakan toggle ON/OFF.`
                        : 'Aksi ini tidak dapat dibatalkan.',
                    confirmText: isRegistry ? 'Hapus Sementara' : 'Ya, Hapus',
                    cancelText:  'Batal',
                    type:        'danger',
                    badge:       isRegistry ? 'TARIF BAWAAN SISTEM' : null,
                });
                if (!ok) return;

                try {
                    await sb_deleteTarif(id);
                    showToast('🗑️ Tarif dihapus', 'success');
                    await _refreshTarifCache();
                    renderDaftarTarif();
                } catch(e) {
                    showToast('❌ Gagal menghapus', 'error');
                }
            };
        }

        // ── PATCH hapusObat (stok.js) ──
        if (typeof hapusObat === 'function') {
            window.hapusObat = async function(id) {
                const o = (window._obatCache || []).find(o => String(o.id) === String(id));
                const ok = await showKonfirmasiHapus(o ? o.nama : 'obat ini', {
                    message: 'Stok dan data obat ini akan dihapus permanen dari sistem.'
                });
                if (!ok) return;
                try {
                    await sb_deleteObat(id);
                    showToast('🗑️ Obat dihapus', 'success');
                    await _refreshObatCache();
                    renderDaftarObat();
                } catch(e) {
                    showToast('❌ Gagal menghapus: ' + (e.message || ''), 'error');
                }
            };
        }

        // ── PATCH hapusUser (user.js) ──
        // BUG 1 FIX: TIDAK di-patch di sini — user.js versi baru sudah
        // memanggil showKonfirmasiDangerZone() langsung tanpa perlu patch override.
        // Patch ini dihapus agar tidak ada konflik dua definisi hapusUser.

        // ── PATCH toggleAllLabGroup di settings.js (konfirmasi sebelum reset) ──
        if (typeof _resetDefaultModul === 'function') {
            const _origReset = _resetDefaultModul;
            window._resetDefaultModul = async function(jab) {
                const ok = await showKonfirmasi({
                    icon:        '🔄',
                    title:       `Reset Akses ${jab}?`,
                    message:     `Semua pengaturan hak akses untuk jabatan <b>${jab}</b> akan dikembalikan ke default bawaan sistem.`,
                    confirmText: 'Ya, Reset',
                    cancelText:  'Batal',
                    type:        'warning',
                });
                if (!ok) return;
                _origReset(jab);
            };
        }

        console.log('[Klikpro] ✅ confirm() patches applied via modal-konfirmasi');
    }, TICK);
})();


// ════════════════════════════════════════════════════════
//  § 4 — MODAL DETAIL & EDIT DATA PASIEN
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL DETAIL & EDIT DATA PASIEN
//  Buka profil pasien lengkap + edit langsung tanpa
//  masuk ke pageMedis. Dipanggil dari mana saja.
//
//  API publik:
//    bukaModalPasien(pasienId)        — dari ID pasien
//    bukaModalPasienDariNama(nama)    — dari nama (lookup allPatients)
// ════════════════════════════════════════════════════════

(function _initModalPasienDetail() {

    // ── CSS ──
    if (!document.getElementById('mpd-style')) {
        const s = document.createElement('style');
        s.id = 'mpd-style';
        s.textContent = `
        #mpdOverlay {
            position: fixed; inset: 0; z-index: 8500;
            background: rgba(15,23,42,0.5);
            display: flex; align-items: flex-end; justify-content: center;
            opacity: 0; transition: opacity .22s ease;
            pointer-events: none;
        }
        #mpdOverlay.mpd-show { opacity: 1; pointer-events: auto; }
        #mpdSheet {
            background: #fff; width: 100%; max-width: 520px;
            border-radius: 22px 22px 0 0;
            max-height: 92vh; display: flex; flex-direction: column;
            box-shadow: 0 -8px 40px rgba(0,0,0,0.18);
            transform: translateY(60px);
            transition: transform .28s cubic-bezier(.34,1.56,.64,1);
        }
        #mpdOverlay.mpd-show #mpdSheet { transform: translateY(0); }

        .mpd-handle {
            width:40px; height:4px; background:#e2e8f0;
            border-radius:2px; margin:12px auto 0; flex-shrink:0;
        }
        .mpd-header {
            display:flex; align-items:flex-start;
            justify-content:space-between;
            padding:14px 18px 0; flex-shrink:0;
        }
        .mpd-header-title {
            font-size:15px; font-weight:800; color:#0f172a; line-height:1.3;
        }
        .mpd-header-sub {
            font-size:11px; color:#64748b; margin-top:2px;
        }
        .mpd-close-btn {
            background:rgba(100,116,139,.12); border:none;
            border-radius:50%; width:30px; height:30px;
            font-size:16px; cursor:pointer; flex-shrink:0;
            display:flex; align-items:center; justify-content:center;
            color:#64748b; transition:background .15s;
        }
        .mpd-close-btn:hover { background:rgba(100,116,139,.22); }
        .mpd-tabs {
            display:flex; gap:6px; padding:12px 18px 0; flex-shrink:0;
            border-bottom:1px solid #f1f5f9;
        }
        .mpd-tab {
            padding:7px 14px; border:none; background:none;
            font-size:12px; font-weight:700; cursor:pointer;
            color:#94a3b8; border-bottom:2.5px solid transparent;
            margin-bottom:-1px; font-family:inherit; transition:all .15s;
        }
        .mpd-tab.active { color:var(--primary,#2563eb); border-bottom-color:var(--primary,#2563eb); }
        .mpd-body { overflow-y:auto; flex:1; padding:14px 18px; }
        .mpd-section-label {
            font-size:10px; font-weight:700; text-transform:uppercase;
            letter-spacing:.6px; color:#94a3b8; margin:14px 0 7px;
        }
        .mpd-info-row {
            display:flex; justify-content:space-between;
            align-items:flex-start; padding:8px 0;
            border-bottom:1px solid #f8fafc; font-size:12.5px;
        }
        .mpd-info-label { color:#64748b; flex-shrink:0; min-width:110px; }
        .mpd-info-val { font-weight:600; color:#0f172a; text-align:right; flex:1; }
        .mpd-alergi-badge {
            display:inline-flex; align-items:center; gap:4px;
            background:rgba(180,83,9,.1); color:#b45309;
            border:1px solid rgba(180,83,9,.25); border-radius:8px;
            padding:4px 10px; font-size:11.5px; font-weight:700;
        }
        .mpd-no-alergi {
            color:#94a3b8; font-size:11.5px; font-style:italic;
        }
        .mpd-riwayat-item {
            border:1px solid #f1f5f9; border-radius:12px;
            padding:10px 12px; margin-bottom:8px;
            cursor:pointer; transition:background .15s;
        }
        .mpd-riwayat-item:hover { background:#f8fafc; }
        .mpd-riwayat-tgl { font-size:11.5px; font-weight:700; color:var(--primary,#2563eb); }
        .mpd-riwayat-diag { font-size:12px; font-weight:600; color:#0f172a; margin-top:2px; }
        .mpd-riwayat-kel { font-size:11px; color:#64748b; margin-top:1px; }
        .mpd-riwayat-ttv {
            font-size:10.5px; color:#94a3b8;
            background:#f8fafc; border-radius:7px;
            padding:3px 8px; margin-top:4px; display:inline-block;
        }
        .mpd-stat-grid {
            display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
            margin-bottom:10px;
        }
        .mpd-stat-tile {
            background:#f8fafc; border:1px solid #f1f5f9;
            border-radius:12px; padding:10px 8px; text-align:center;
        }
        .mpd-stat-val { font-size:18px; font-weight:900; color:var(--primary,#2563eb); }
        .mpd-stat-lbl { font-size:10px; color:#94a3b8; margin-top:2px; }
        .mpd-footer {
            padding:10px 18px calc(10px + env(safe-area-inset-bottom,0px));
            border-top:1px solid #f1f5f9; display:flex; gap:8px; flex-shrink:0;
        }
        .mpd-btn {
            flex:1; padding:12px 8px; border:none; border-radius:12px;
            font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
            transition:opacity .15s, transform .1s;
        }
        .mpd-btn:active { opacity:.85; transform:scale(.98); }
        .mpd-btn-primary { background:linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; }
        .mpd-btn-success { background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
        .mpd-btn-cancel  { background:#f1f5f9; color:#64748b; font-weight:600; }
        .mpd-form-label {
            font-size:10px; font-weight:700; text-transform:uppercase;
            letter-spacing:.4px; color:#94a3b8; margin-bottom:3px; display:block;
        }
        .mpd-saving { opacity:.5; pointer-events:none; }
        .mpd-badge-jk {
            display:inline-flex; align-items:center; gap:4px;
            padding:2px 9px; border-radius:20px; font-size:11px; font-weight:700;
        }
        .mpd-empty {
            text-align:center; color:#94a3b8; font-size:12px;
            padding:28px 0;
        }
        `;
        document.head.appendChild(s);
    }

    // ── State ──
    let _pasienData  = null;  // data pasien dari DB
    let _riwayatData = [];    // array kunjungan
    let _activeTab   = 'info';  // 'info' | 'edit' | 'riwayat'
    let _saving      = false;

    // ── Buat DOM (sekali) ──
    function _ensureDOM() {
        if (document.getElementById('mpdOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'mpdOverlay';
        ov.innerHTML = `
        <div id="mpdSheet">
            <div class="mpd-handle"></div>
            <div class="mpd-header">
                <div>
                    <div class="mpd-header-title" id="mpdName">—</div>
                    <div class="mpd-header-sub" id="mpdSub">Data Pasien</div>
                </div>
                <button class="mpd-close-btn" onclick="tutupModalPasien()">✕</button>
            </div>
            <div class="mpd-tabs" id="mpdTabs"></div>
            <div class="mpd-body" id="mpdBody">
                <div class="mpd-empty">⏳ Memuat data...</div>
            </div>
            <div class="mpd-footer" id="mpdFooter"></div>
        </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) tutupModalPasien(); });
    }

    // ── Buka & tutup ──
    window.tutupModalPasien = function() {
        const ov = document.getElementById('mpdOverlay');
        if (ov) ov.classList.remove('mpd-show');
    };

    function _open() {
        _ensureDOM();
        requestAnimationFrame(() => {
            document.getElementById('mpdOverlay').classList.add('mpd-show');
        });
    }

    function _setTab(tab) {
        _activeTab = tab;
        _renderTabs();
        _renderBody();
        _renderFooter();
    }

    // ════════════════════════════════════════
    //  API PUBLIK
    // ════════════════════════════════════════
    window.bukaModalPasien = async function(pasienId) {
        _ensureDOM();
        _pasienData  = null;
        _riwayatData = [];
        _activeTab   = 'info';

        document.getElementById('mpdName').textContent = 'Memuat...';
        document.getElementById('mpdSub').textContent  = '';
        document.getElementById('mpdBody').innerHTML   = '<div class="mpd-empty">⏳ Memuat data pasien...</div>';
        document.getElementById('mpdTabs').innerHTML   = '';
        document.getElementById('mpdFooter').innerHTML = '';
        _open();

        try {
            // Fetch data pasien
            const rows = await _sbFetch(`pasien?id=eq.${pasienId}&select=*&limit=1`);
            if (!rows || !rows.length) throw new Error('Pasien tidak ditemukan');
            _pasienData = rows[0];

            // Fetch riwayat kunjungan
            const rkwt = await _sbFetch(
                `kunjungan?pasien_id=eq.${pasienId}&order=tgl.desc,waktu.desc&select=*`
            );

            // Resolve nama dokter
            if (!window._usersCache || !window._usersCache.length) {
                try {
                    window._usersCache = await _sbFetch('users?select=id,nama,jabatan');
                } catch(e) { window._usersCache = []; }
            }

            _riwayatData = rkwt.map(r => ({
                id:       r.id,
                tgl:      r.tgl,
                waktu:    r.waktu,
                td:       r.td,
                suhu:     r.suhu,
                nadi:     r.nadi,
                keluhan:  r.keluhan,
                diag:     r.diagnosa,
                diagnosa2:r.diagnosa2,
                terapi:   r.terapi,
                status:   r.status,
                status_obat:  !!r.status_obat,
                status_bayar: !!r.status_bayar,
                dokterNama: _resolveDokterNama ? _resolveDokterNama(r.user_id) : null
            }));

            // Update header
            const jkLabel = _pasienData.jk === 'P' ? '👩 Perempuan' : '👨 Laki-Laki';
            document.getElementById('mpdName').textContent = _pasienData.nama || '—';
            document.getElementById('mpdSub').textContent  =
                `${jkLabel} · ${_hitungUmurStr(_pasienData.tgl_lahir)} · ${_riwayatData.length} kunjungan`;

            _renderTabs();
            _renderBody();
            _renderFooter();

        } catch(e) {
            document.getElementById('mpdBody').innerHTML =
                `<div class="mpd-empty">❌ ${e.message || 'Gagal memuat data'}</div>`;
        }
    };

    window.bukaModalPasienDariNama = function(nama) {
        const p = (typeof allPatients !== 'undefined' ? allPatients : [])
            .find(x => (x.nama || '').toLowerCase() === (nama || '').toLowerCase());
        if (!p) { showToast('⚠️ Pasien tidak ditemukan di daftar', 'warning'); return; }
        bukaModalPasien(p.id);
    };

    // ════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════
    function _renderTabs() {
        const tabs = [
            { id:'info',    label:'📋 Info' },
            { id:'edit',    label:'✏️ Edit' },
            { id:'riwayat', label:`📅 Riwayat (${_riwayatData.length})` },
        ];
        document.getElementById('mpdTabs').innerHTML = tabs.map(t =>
            `<button class="mpd-tab${_activeTab === t.id ? ' active' : ''}"
                     onclick="_mpdSetTab('${t.id}')">${t.label}</button>`
        ).join('');
    }
    window._mpdSetTab = _setTab;

    function _renderBody() {
        const el = document.getElementById('mpdBody');
        if (!_pasienData) return;
        if (_activeTab === 'info')    el.innerHTML = _htmlInfo();
        if (_activeTab === 'edit')    el.innerHTML = _htmlEdit();
        if (_activeTab === 'riwayat') el.innerHTML = _htmlRiwayat();
    }

    function _renderFooter() {
        const el = document.getElementById('mpdFooter');
        if (_activeTab === 'edit') {
            el.innerHTML = `
            <button class="mpd-btn mpd-btn-cancel" onclick="_mpdSetTab('info')">Batal</button>
            <button class="mpd-btn mpd-btn-success" id="mpdBtnSimpan" onclick="_mpdSimpan()">
                💾 Simpan Perubahan
            </button>`;
        } else if (_activeTab === 'info') {
            el.innerHTML = `
            <button class="mpd-btn mpd-btn-cancel" onclick="tutupModalPasien()">Tutup</button>
            <button class="mpd-btn mpd-btn-primary" onclick="_mpdSetTab('edit')">✏️ Edit Data</button>`;
        } else {
            el.innerHTML = `
            <button class="mpd-btn mpd-btn-cancel" onclick="tutupModalPasien()">Tutup</button>`;
        }
    }

    // ── Tab: Info ──
    function _htmlInfo() {
        const p = _pasienData;
        const jkBadge = p.jk === 'P'
            ? `<span class="mpd-badge-jk" style="background:rgba(236,72,153,.1);color:#be185d;">👩 Perempuan</span>`
            : `<span class="mpd-badge-jk" style="background:rgba(37,99,235,.1);color:#1d4ed8;">👨 Laki-Laki</span>`;

        const alergiHtml = (p.alergi && p.alergi.trim())
            ? `<div class="mpd-alergi-badge">⚠️ ${_esc(p.alergi)}</div>`
            : `<span class="mpd-no-alergi">Tidak ada riwayat alergi</span>`;

        // Statistik dari riwayat
        const selesai   = _riwayatData.filter(r => r.status === 'Selesai').length;
        const terakhirTgl = _riwayatData[0]?.tgl ? _fmt(new Date(_riwayatData[0].tgl)) : '—';

        // Lab terakhir
        const labTerakhir = _riwayatData.find(r => r.diag);
        const diagTerakhir = labTerakhir?.diag || '—';

        return `
        <!-- Statistik ringkas -->
        <div class="mpd-stat-grid">
            <div class="mpd-stat-tile">
                <div class="mpd-stat-val">${_riwayatData.length}</div>
                <div class="mpd-stat-lbl">Total Kunjungan</div>
            </div>
            <div class="mpd-stat-tile">
                <div class="mpd-stat-val">${selesai}</div>
                <div class="mpd-stat-lbl">Selesai</div>
            </div>
            <div class="mpd-stat-tile">
                <div class="mpd-stat-val" style="font-size:13px;">${terakhirTgl}</div>
                <div class="mpd-stat-lbl">Kunjungan Terakhir</div>
            </div>
        </div>

        <!-- Data diri -->
        <div class="mpd-section-label">Data Diri</div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">Jenis Kelamin</span>
            <span class="mpd-info-val">${jkBadge}</span>
        </div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">Tanggal Lahir</span>
            <span class="mpd-info-val">${p.tgl_lahir ? _fmtTgl(p.tgl_lahir) : '—'}</span>
        </div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">Umur</span>
            <span class="mpd-info-val">${_hitungUmurStr(p.tgl_lahir)}</span>
        </div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">NIK</span>
            <span class="mpd-info-val" style="font-family:monospace;">${_esc(p.nik || '—')}</span>
        </div>
        <div class="mpd-info-row" style="border:none;">
            <span class="mpd-info-label">Alamat</span>
            <span class="mpd-info-val" style="white-space:pre-line;">${_esc(p.alamat || '—')}</span>
        </div>

        <!-- Alergi -->
        <div class="mpd-section-label">Riwayat Alergi</div>
        <div style="margin-bottom:10px;">${alergiHtml}</div>

        <!-- Diagnosa terakhir -->
        ${labTerakhir ? `
        <div class="mpd-section-label">Diagnosa Terakhir</div>
        <div style="background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.15);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
            <div style="font-weight:700;font-size:12.5px;color:#0f172a;">${_esc(diagTerakhir)}</div>
            ${labTerakhir.dokterNama ? `<div style="font-size:10.5px;color:#059669;margin-top:3px;">👨‍⚕️ ${_esc(labTerakhir.dokterNama)}</div>` : ''}
        </div>` : ''}
        `;
    }

    // ── Tab: Edit ──
    function _htmlEdit() {
        const p = _pasienData;
        const tglVal = p.tgl_lahir
            ? (p.tgl_lahir.includes('/') ? _tglInvertToForm(p.tgl_lahir) : p.tgl_lahir)
            : '';

        return `
        <div style="display:flex;flex-direction:column;gap:10px;">

            <div>
                <label class="mpd-form-label">Nama Lengkap *</label>
                <input type="text" id="mpdEditNama" class="form-control"
                       value="${_esc(p.nama || '')}" placeholder="Nama lengkap pasien">
            </div>

            <div>
                <label class="mpd-form-label">NIK (16 Digit)</label>
                <input type="tel" id="mpdEditNik" class="form-control"
                       value="${_esc(p.nik || '')}" placeholder="NIK KTP" maxlength="16">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <label class="mpd-form-label">Jenis Kelamin</label>
                    <select id="mpdEditJk" class="form-control">
                        <option value="L" ${p.jk === 'L' ? 'selected' : ''}>Laki-Laki</option>
                        <option value="P" ${p.jk === 'P' ? 'selected' : ''}>Perempuan</option>
                    </select>
                </div>
                <div>
                    <label class="mpd-form-label">Tanggal Lahir</label>
                    <input type="tel" id="mpdEditTgl" class="form-control"
                           value="${_esc(_fmtTgl(p.tgl_lahir))}"
                           placeholder="DD/MM/YYYY"
                           oninput="_mpdAutoFormatTgl(this)">
                </div>
            </div>

            <div>
                <label class="mpd-form-label">Alamat</label>
                <textarea id="mpdEditAlamat" class="form-control" rows="2"
                          placeholder="Alamat lengkap pasien">${_esc(p.alamat || '')}</textarea>
            </div>

            <div style="background:rgba(180,83,9,.05);border:1px solid rgba(180,83,9,.2);border-radius:10px;padding:10px 12px;">
                <label class="mpd-form-label" style="color:#b45309;">⚠️ Riwayat Alergi</label>
                <input type="text" id="mpdEditAlergi" class="form-control"
                       value="${_esc(p.alergi || '')}"
                       placeholder="Contoh: Penisilin, Sulfa — kosongkan jika tidak ada"
                       style="border-color:rgba(180,83,9,.3);">
                <div style="font-size:10px;color:#92400e;margin-top:4px;">
                    Data alergi tersimpan permanen di profil pasien
                </div>
            </div>

        </div>`;
    }

    // ── Tab: Riwayat ──
    function _htmlRiwayat() {
        if (_riwayatData.length === 0) {
            return '<div class="mpd-empty">📂 Belum ada riwayat kunjungan</div>';
        }
        return _riwayatData.map(r => {
            const tglStr  = r.tgl ? _fmtTgl(r.tgl) : '—';
            const isDone  = r.status === 'Selesai';
            const ttvStr  = r.td ? `TD ${r.td}${r.nadi ? ` | N ${r.nadi}` : ''}${r.suhu ? ` | S ${r.suhu}°C` : ''}` : '';

            // Badge status
            const stBadge = isDone
                ? `<span style="font-size:9.5px;background:#dcfce7;color:#166534;border-radius:20px;padding:1px 7px;font-weight:700;">✅ Selesai</span>`
                : `<span style="font-size:9.5px;background:#fef9c3;color:#854d0e;border-radius:20px;padding:1px 7px;font-weight:700;">⏳ Menunggu</span>`;

            // Action buttons
            let btns = '';
            if (r.id && window._biayaAktif) {
                btns += `<button onclick="event.stopPropagation();_mpdBukaInvoice('${r.id}','${_esc(r.tgl||'')}');return false;"
                            style="padding:3px 8px;background:rgba(5,150,105,.1);color:#065f46;border:1px solid rgba(5,150,105,.25);border-radius:7px;font-size:9.5px;font-weight:700;cursor:pointer;">
                            🧾 Invoice</button>`;
            }
            if (r.id && window._stokAktif) {
                btns += `<button onclick="event.stopPropagation();_mpdBukaResep('${r.id}','${_esc(r.tgl||'')}');return false;"
                            style="padding:3px 8px;background:rgba(37,99,235,.1);color:#1e40af;border:1px solid rgba(37,99,235,.25);border-radius:7px;font-size:9.5px;font-weight:700;cursor:pointer;">
                            💊 Resep</button>`;
            }

            return `
            <div class="mpd-riwayat-item">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span class="mpd-riwayat-tgl">📅 ${tglStr} (${r.waktu||'—'})</span>
                    ${stBadge}
                </div>
                ${r.diag ? `<div class="mpd-riwayat-diag">🩺 ${_esc(r.diag)}${r.diagnosa2 ? ` / ${_esc(r.diagnosa2)}` : ''}</div>` : ''}
                ${r.keluhan ? `<div class="mpd-riwayat-kel">Keluhan: ${_esc(r.keluhan)}</div>` : ''}
                ${ttvStr ? `<div class="mpd-riwayat-ttv">${ttvStr}</div>` : ''}
                ${r.dokterNama ? `<div style="font-size:10px;color:#059669;font-weight:600;margin-top:3px;">👨‍⚕️ ${_esc(r.dokterNama)}</div>` : ''}
                ${btns ? `<div style="display:flex;gap:5px;margin-top:7px;padding-top:6px;border-top:1px dashed #f1f5f9;">${btns}</div>` : ''}
            </div>`;
        }).join('');
    }

    // ════════════════════════════════════════
    //  SIMPAN EDIT
    // ════════════════════════════════════════
    window._mpdSimpan = async function() {
        if (_saving || !_pasienData) return;

        const nama   = document.getElementById('mpdEditNama')?.value.trim();
        const nik    = document.getElementById('mpdEditNik')?.value.trim();
        const jk     = document.getElementById('mpdEditJk')?.value || 'L';
        const tglRaw = document.getElementById('mpdEditTgl')?.value.trim();
        const alamat = document.getElementById('mpdEditAlamat')?.value.trim();
        const alergi = document.getElementById('mpdEditAlergi')?.value.trim();

        if (!nama) { showToast('⚠️ Nama pasien wajib diisi', 'warning'); return; }

        // Konversi DD/MM/YYYY → YYYY-MM-DD untuk DB
        const tgl_lahir = _tglFormToDb(tglRaw);

        _saving = true;
        const btn = document.getElementById('mpdBtnSimpan');
        if (btn) { btn.textContent = '⏳ Menyimpan...'; btn.classList.add('mpd-saving'); }

        try {
            await sb_savePasienOnly({
                pasienId: _pasienData.id,
                nama, nik, jk,
                tgl_lahir: tgl_lahir || null,
                alamat: alamat || null,
                alergi: alergi || null
            });

            // Update cache lokal allPatients
            if (typeof allPatients !== 'undefined') {
                const idx = allPatients.findIndex(p => p.id === _pasienData.id);
                if (idx !== -1) {
                    allPatients[idx] = { ...allPatients[idx], nama, nik, jk, tgl: tgl_lahir, alamat, alergi };
                }
            }

            // Sync form pageDaftar jika pasien yang sama sedang aktif
            if (typeof currentPasienId !== 'undefined' && currentPasienId === _pasienData.id) {
                const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
                setV('nama', nama); setV('nik', nik); setV('jk', jk);
                setV('tgl_lahir', _fmtTgl(tgl_lahir)); setV('alamat', alamat);
                if (typeof window._pasienAlergi !== 'undefined') window._pasienAlergi = alergi;
            }

            // Update state & tampilan
            _pasienData = { ..._pasienData, nama, nik, jk, tgl_lahir, alamat, alergi };
            document.getElementById('mpdName').textContent = nama;

            showToast('✅ Data pasien berhasil disimpan', 'success');
            _setTab('info');

        } catch(e) {
            showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
        } finally {
            _saving = false;
            if (btn) { btn.textContent = '💾 Simpan Perubahan'; btn.classList.remove('mpd-saving'); }
        }
    };

    // ════════════════════════════════════════
    //  AKSI DARI RIWAYAT
    // ════════════════════════════════════════
    window._mpdBukaInvoice = function(kunjId, tgl) {
        if (typeof lihatTagihanKunjungan === 'function') {
            lihatTagihanKunjungan(kunjId, _pasienData?.nama || '—', tgl);
        }
    };
    window._mpdBukaResep = async function(kunjId, tgl) {
        if (typeof sb_getResepByKunjungan !== 'function') {
            showToast('⚠️ Modul resep belum dimuat', 'warning'); return;
        }
        try {
            const items = await sb_getResepByKunjungan(kunjId);
            if (!items || !items.length) {
                showToast('ℹ️ Tidak ada resep pada kunjungan ini', 'info'); return;
            }
            if (typeof _tampilModalResep === 'function') {
                _tampilModalResep(kunjId, _pasienData?.nama || '—', items, tgl);
            }
        } catch(e) {
            showToast('❌ Gagal memuat resep', 'error');
        }
    };

    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════
    window._mpdAutoFormatTgl = function(inp) {
        let v = inp.value.replace(/\D/g, '');
        if (v.length > 8) v = v.substring(0, 8);
        if (v.length >= 5)      inp.value = v.substring(0,2)+'/'+v.substring(2,4)+'/'+v.substring(4,8);
        else if (v.length >= 3) inp.value = v.substring(0,2)+'/'+v.substring(2,4);
        else                    inp.value = v;
    };

    function _esc(str) {
        return String(str||'')
            .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
            .replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function _fmtTgl(str) {
        if (!str) return '—';
        str = String(str).trim();
        if (str.includes('/')) return str;
        if (str.includes('-')) {
            const p = str.split('-');
            if (p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return str;
    }

    function _tglFormToDb(str) {
        // DD/MM/YYYY → YYYY-MM-DD
        if (!str || !str.includes('/')) return str || null;
        const p = str.split('/');
        if (p.length !== 3) return null;
        return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    }

    function _tglInvertToForm(str) {
        // Alias _fmtTgl — untuk kejelasan
        return _fmtTgl(str);
    }

    function _fmt(d) {
        if (!d || isNaN(d)) return '—';
        return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    }

    function _hitungUmurStr(tgl) {
        if (!tgl) return '—';
        let parts = String(tgl).includes('/')
            ? String(tgl).split('/') : String(tgl).split('-');
        let bd = parts.length === 3
            ? (parts[0].length === 4
                ? new Date(parts[0], parts[1]-1, parts[2])
                : new Date(parts[2], parts[1]-1, parts[0]))
            : new Date(tgl);
        if (isNaN(bd)) return '—';
        let age = new Date().getFullYear() - bd.getFullYear();
        if (new Date().getMonth() < bd.getMonth() ||
           (new Date().getMonth() === bd.getMonth() && new Date().getDate() < bd.getDate())) age--;
        return age + ' Tahun';
    }

    console.log('[Klikpro] ✅ modal-pasien-detail.js loaded');

})();


// ════════════════════════════════════════════════════════
//  § 5 — MODAL DOKUMEN ADMINISTRASI
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL DOKUMEN SEKALI CETAK
//
//  Sistem cetak dokumen administrasi (Surat Keterangan
//  Sehat, Surat Rujukan, Visum, dll) berbasis tarif
//  kategori "Administrasi" dari window._tarifCache.
//
//  ┌─────────────────────────────────────────────────────┐
//  │ ALUR                                               │
//  │  1. _loadDokumenTemplate()                         │
//  │     Fetch konfigurasi template dari Supabase        │
//  │     tabel konfigurasi (key: "tmpl_<slug>")          │
//  │                                                    │
//  │  2. openModalDokumen(pasienId, kunjunganId)         │
//  │     Modal pilih dokumen + preview data pasien       │
//  │                                                    │
//  │  3. _renderPilihDokumen()                           │
//  │     Tampilkan semua dokumen dari Administrasi       │
//  │     yang ada di _tarifCache (kecuali bawaan)        │
//  │                                                    │
//  │  4. _bukaDokumen(slug)                              │
//  │     Editor: isi field dinamis dari template         │
//  │     Preview → Print via window.open()               │
//  │                                                    │
//  │  5. pageSettings → _renderSettingsDokumen()         │
//  │     Admin bisa edit template HTML per dokumen       │
//  │     Field dinamis: {{nama}}, {{nik}}, dll           │
//  └─────────────────────────────────────────────────────┘
//
//  Template HTML disimpan di:
//    konfigurasi → key: "tmpl_<slug>", value: HTML string
//
//  Field yang tersedia di template:
//    {{nama}}         — nama pasien
//    {{nik}}          — NIK pasien
//    {{umur}}         — umur pasien
//    {{jk}}           — jenis kelamin (Laki-Laki / Perempuan)
//    {{tgl_lahir}}    — tanggal lahir (DD/MM/YYYY)
//    {{alamat}}       — alamat pasien
//    {{tgl}}          — tanggal hari ini (format indo)
//    {{tgl_iso}}      — tanggal hari ini (YYYY-MM-DD)
//    {{diagnosa}}     — diagnosa utama kunjungan
//    {{keluhan}}      — keluhan pasien
//    {{dokter}}       — nama dokter pemeriksa
//    {{klinik}}       — nama klinik
//    {{klinik_alamat}}— alamat klinik
//    {{klinik_telp}}  — telepon klinik
//    {{field_*}}      — field custom tambahan per template
// ════════════════════════════════════════════════════════

// ── Dokumen bawaan yang TIDAK dirender di picker
//    (sudah ditangani secara hardcode di HTML / sistem)
const _DOKUMEN_BAWAAN = ['Surat Keterangan Sakit'];

// ── Template default per jenis dokumen ──
const _TEMPLATE_DEFAULT = {

    'surat_keterangan_sehat': `
<div style="font-family:'Times New Roman',serif;max-width:700px;margin:0 auto;padding:32px 40px;border:2px solid #1e3a8a;border-radius:4px;">

  <!-- KOP SURAT -->
  <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:14px;margin-bottom:18px;">
    <div style="font-size:22px;font-weight:900;color:#1e3a8a;letter-spacing:1px;">{{klinik}}</div>
    <div style="font-size:12px;color:#475569;margin-top:4px;">{{klinik_alamat}}</div>
    <div style="font-size:12px;color:#475569;">Telp: {{klinik_telp}}</div>
  </div>

  <!-- JUDUL -->
  <div style="text-align:center;margin:20px 0;">
    <div style="font-size:17px;font-weight:900;text-decoration:underline;letter-spacing:2px;">SURAT KETERANGAN SEHAT</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">No: {{field_nomor}}</div>
  </div>

  <!-- BODY -->
  <p style="font-size:13px;line-height:2;margin:16px 0 8px;">Yang bertanda tangan di bawah ini, dokter pada {{klinik}}, menerangkan bahwa:</p>

  <table style="font-size:13px;line-height:2;margin:0 0 8px 20px;border-collapse:collapse;">
    <tr><td style="width:150px;">Nama</td><td style="padding-right:12px;">:</td><td><b>{{nama}}</b></td></tr>
    <tr><td>NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td>Tanggal Lahir</td><td>:</td><td>{{tgl_lahir}}</td></tr>
    <tr><td>Umur</td><td>:</td><td>{{umur}}</td></tr>
    <tr><td>Jenis Kelamin</td><td>:</td><td>{{jk}}</td></tr>
    <tr><td>Alamat</td><td>:</td><td>{{alamat}}</td></tr>
  </table>

  <p style="font-size:13px;line-height:2;margin:12px 0;">
    Berdasarkan hasil pemeriksaan yang telah dilakukan pada tanggal {{tgl}}, yang bersangkutan dalam keadaan <b>SEHAT</b> dan tidak ditemukan kelainan fisik maupun tanda-tanda penyakit yang berarti.
  </p>

  <p style="font-size:13px;line-height:2;margin:8px 0;">
    Surat keterangan ini dibuat untuk keperluan: <b>{{field_keperluan}}</b>
  </p>

  <!-- TTD -->
  <div style="margin-top:48px;display:flex;justify-content:flex-end;">
    <div style="text-align:center;min-width:200px;">
      <div style="font-size:13px;">{{klinik_kota}}, {{tgl}}</div>
      <div style="font-size:13px;margin-top:4px;">Dokter Pemeriksa,</div>
      <div style="height:70px;"></div>
      <div style="border-top:1px solid #000;padding-top:4px;font-size:13px;font-weight:700;">{{dokter}}</div>
    </div>
  </div>
</div>`,

    'surat_rujukan': `
<div style="font-family:'Times New Roman',serif;max-width:700px;margin:0 auto;padding:32px 40px;border:2px solid #1e3a8a;border-radius:4px;">

  <!-- KOP SURAT -->
  <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:14px;margin-bottom:18px;">
    <div style="font-size:22px;font-weight:900;color:#1e3a8a;letter-spacing:1px;">{{klinik}}</div>
    <div style="font-size:12px;color:#475569;margin-top:4px;">{{klinik_alamat}}</div>
    <div style="font-size:12px;color:#475569;">Telp: {{klinik_telp}}</div>
  </div>

  <!-- JUDUL -->
  <div style="text-align:center;margin:20px 0;">
    <div style="font-size:17px;font-weight:900;text-decoration:underline;letter-spacing:2px;">SURAT RUJUKAN</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">No: {{field_nomor}}</div>
  </div>

  <!-- BODY -->
  <p style="font-size:13px;line-height:2;margin:16px 0 8px;">Kepada Yth.<br><b>{{field_tujuan}}</b><br>di Tempat</p>

  <p style="font-size:13px;line-height:2;margin:12px 0;">Dengan hormat, kami merujuk pasien:</p>

  <table style="font-size:13px;line-height:2;margin:0 0 8px 20px;border-collapse:collapse;">
    <tr><td style="width:150px;">Nama</td><td style="padding-right:12px;">:</td><td><b>{{nama}}</b></td></tr>
    <tr><td>NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td>Tanggal Lahir</td><td>:</td><td>{{tgl_lahir}}</td></tr>
    <tr><td>Umur</td><td>:</td><td>{{umur}}</td></tr>
    <tr><td>Alamat</td><td>:</td><td>{{alamat}}</td></tr>
  </table>

  <p style="font-size:13px;line-height:2;margin:12px 0;">
    <b>Keluhan:</b> {{keluhan}}<br>
    <b>Diagnosa Sementara:</b> {{diagnosa}}<br>
    <b>Alasan Rujukan:</b> {{field_alasan}}
  </p>

  <p style="font-size:13px;line-height:2;margin:8px 0;">
    Mohon pemeriksaan dan penanganan lebih lanjut. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.
  </p>

  <!-- TTD -->
  <div style="margin-top:48px;display:flex;justify-content:flex-end;">
    <div style="text-align:center;min-width:200px;">
      <div style="font-size:13px;">{{klinik_kota}}, {{tgl}}</div>
      <div style="font-size:13px;margin-top:4px;">Dokter Pengirim,</div>
      <div style="height:70px;"></div>
      <div style="border-top:1px solid #000;padding-top:4px;font-size:13px;font-weight:700;">{{dokter}}</div>
    </div>
  </div>
</div>`,

    '_default': `
<div style="font-family:'Times New Roman',serif;max-width:700px;margin:0 auto;padding:32px 40px;border:2px solid #1e3a8a;border-radius:4px;">
  <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:14px;margin-bottom:18px;">
    <div style="font-size:22px;font-weight:900;color:#1e3a8a;">{{klinik}}</div>
    <div style="font-size:12px;color:#475569;">{{klinik_alamat}}</div>
    <div style="font-size:12px;color:#475569;">Telp: {{klinik_telp}}</div>
  </div>
  <div style="text-align:center;margin:20px 0;">
    <div style="font-size:17px;font-weight:900;text-decoration:underline;letter-spacing:2px;">{{_NAMA_DOKUMEN}}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">No: {{field_nomor}}</div>
  </div>
  <p style="font-size:13px;line-height:2;margin:16px 0;">Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
  <table style="font-size:13px;line-height:2;margin:0 0 8px 20px;border-collapse:collapse;">
    <tr><td style="width:150px;">Nama</td><td style="padding-right:12px;">:</td><td><b>{{nama}}</b></td></tr>
    <tr><td>NIK</td><td>:</td><td>{{nik}}</td></tr>
    <tr><td>Tanggal Lahir</td><td>:</td><td>{{tgl_lahir}}</td></tr>
    <tr><td>Umur</td><td>:</td><td>{{umur}}</td></tr>
    <tr><td>Jenis Kelamin</td><td>:</td><td>{{jk}}</td></tr>
    <tr><td>Alamat</td><td>:</td><td>{{alamat}}</td></tr>
  </table>
  <p style="font-size:13px;line-height:2;margin:16px 0;">{{field_isi}}</p>
  <div style="margin-top:48px;display:flex;justify-content:flex-end;">
    <div style="text-align:center;min-width:200px;">
      <div style="font-size:13px;">{{klinik_kota}}, {{tgl}}</div>
      <div style="font-size:13px;margin-top:4px;">Dokter Pemeriksa,</div>
      <div style="height:70px;"></div>
      <div style="border-top:1px solid #000;padding-top:4px;font-size:13px;font-weight:700;">{{dokter}}</div>
    </div>
  </div>
</div>`
};

// ── Cache template yang sudah diload dari DB ──
window._dokumenTemplateCache = window._dokumenTemplateCache || {};

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════

function _slugDokumen(nama) {
    return nama.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function _escD(str) {
    if (typeof escHtml === 'function') return escHtml(str);
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Ambil daftar dokumen Administrasi dari tarif cache, kecuali bawaan */
function _getDokumenList() {
    return (window._tarifCache || []).filter(t =>
        t.aktif &&
        t.kategori === 'Administrasi' &&
        !_DOKUMEN_BAWAAN.includes(t.nama)
    );
}

/** Ambil template dari cache/DB. Fallback ke default. */
async function _getTemplate(slug, namaDokumen) {
    if (window._dokumenTemplateCache[slug]) return window._dokumenTemplateCache[slug];

    try {
        const rows = await _sbFetch(`konfigurasi?key=eq.tmpl_${encodeURIComponent(slug)}&select=value&limit=1`);
        if (rows && rows[0] && rows[0].value) {
            window._dokumenTemplateCache[slug] = rows[0].value;
            return rows[0].value;
        }
    } catch(e) {}

    // Fallback ke template bawaan sistem
    const tmpl = _TEMPLATE_DEFAULT[slug] || _TEMPLATE_DEFAULT['_default'];
    return tmpl.replace('{{_NAMA_DOKUMEN}}', namaDokumen || slug);
}

/** Simpan template ke Supabase */
async function _saveTemplate(slug, html) {
    await _sbFetch('konfigurasi', {
        method: 'POST',
        body: { key: `tmpl_${slug}`, value: html },
        prefer: 'resolution=merge-duplicates,return=minimal'
    });
    window._dokumenTemplateCache[slug] = html;
}

/** Ekstrak semua {{field_*}} dari template */
function _extractFields(tmplHtml) {
    const found = [];
    const re = /\{\{field_([a-zA-Z0-9_]+)\}\}/g;
    let m;
    while ((m = re.exec(tmplHtml)) !== null) {
        if (!found.includes(m[1])) found.push(m[1]);
    }
    return found;
}

/** Label ramah untuk field_* */
function _fieldLabel(key) {
    const map = {
        nomor:     'Nomor Surat',
        keperluan: 'Keperluan / Tujuan',
        tujuan:    'Ditujukan Kepada (Instansi)',
        alasan:    'Alasan Rujukan',
        isi:       'Isi / Keterangan Surat',
        catatan:   'Catatan Tambahan',
    };
    return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Render template dengan data pasien + field values */
function _renderTemplate(tmpl, pasienData, kunjData, fieldValues) {
    const today = new Date();
    const tglIndo = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const tglIso  = today.toISOString().slice(0, 10);

    const jkStr  = (pasienData.jk === 'P') ? 'Perempuan' : 'Laki-Laki';
    const umur   = (typeof hitungUmur === 'function') ? hitungUmur(pasienData.tgl_lahir || pasienData.tgl || '') : '—';
    const tglLahirFmt = pasienData.tgl_lahir || pasienData.tgl
        ? (typeof formatTglIndo === 'function'
            ? formatTglIndo(pasienData.tgl_lahir || pasienData.tgl)
            : (pasienData.tgl_lahir || pasienData.tgl || '—'))
        : '—';

    // Nama dokter dari cache
    let dokterNama = '';
    if (kunjData && kunjData.user_id) {
        const du = (window._usersCache || []).find(u =>
            u.id === kunjData.user_id && u.jabatan?.toLowerCase() === 'dokter'
        );
        if (du) dokterNama = du.nama;
    }
    if (!dokterNama && window._dokterAktif && window._dokterAktif.length > 0) {
        dokterNama = window._dokterAktif[0].nama || '';
    }

    const klinikNama   = window.KLINIK_NAMA  || window._settingsFull?.klinik_nama  || 'Klinik';
    const klinikAlamat = window._settingsFull?.klinik_alamat || '';
    const klinikTelp   = window._settingsFull?.klinik_telp   || '';
    // Kota: ambil kata pertama dari alamat atau default
    const klinikKota   = (klinikAlamat || '').split(',')[0].trim() || klinikNama;

    let out = tmpl
        .replace(/\{\{nama\}\}/g,          _escD(pasienData.nama || '—'))
        .replace(/\{\{nik\}\}/g,           _escD(pasienData.nik  || '—'))
        .replace(/\{\{umur\}\}/g,          _escD(umur))
        .replace(/\{\{jk\}\}/g,            _escD(jkStr))
        .replace(/\{\{tgl_lahir\}\}/g,     _escD(tglLahirFmt))
        .replace(/\{\{alamat\}\}/g,        _escD(pasienData.alamat || '—'))
        .replace(/\{\{tgl\}\}/g,           tglIndo)
        .replace(/\{\{tgl_iso\}\}/g,       tglIso)
        .replace(/\{\{diagnosa\}\}/g,      _escD(kunjData?.diag || kunjData?.diagnosa || '—'))
        .replace(/\{\{keluhan\}\}/g,       _escD(kunjData?.keluhan || '—'))
        .replace(/\{\{dokter\}\}/g,        _escD(dokterNama || '_______________'))
        .replace(/\{\{klinik\}\}/g,        _escD(klinikNama))
        .replace(/\{\{klinik_alamat\}\}/g, _escD(klinikAlamat))
        .replace(/\{\{klinik_telp\}\}/g,   _escD(klinikTelp))
        .replace(/\{\{klinik_kota\}\}/g,   _escD(klinikKota));

    // Field custom
    Object.entries(fieldValues || {}).forEach(([k, v]) => {
        const re = new RegExp(`\\{\\{field_${k}\\}\\}`, 'g');
        out = out.replace(re, _escD(v || ''));
    });

    // Kosongkan field yang belum diisi
    out = out.replace(/\{\{field_[a-zA-Z0-9_]+\}\}/g, '');
    out = out.replace(/\{\{[^}]+\}\}/g, '—');

    return out;
}

// ════════════════════════════════════════
//  INJECT CSS (sekali)
// ════════════════════════════════════════

(function _injectDokumenStyle() {
    if (document.getElementById('mdok-style')) return;
    const s = document.createElement('style');
    s.id = 'mdok-style';
    s.textContent = `
    #mdokOverlay {
        position:fixed;inset:0;z-index:8000;
        background:rgba(15,23,42,0.5);
        display:flex;align-items:flex-end;justify-content:center;
        opacity:0;transition:opacity .22s ease;
        pointer-events:none;
    }
    #mdokOverlay.mdok-show { opacity:1;pointer-events:auto; }
    #mdokSheet {
        background:#fff;width:100%;max-width:520px;
        border-radius:20px 20px 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,0.18);
        max-height:92vh;display:flex;flex-direction:column;
        transform:translateY(60px);
        transition:transform .28s cubic-bezier(.34,1.56,.64,1);
    }
    #mdokOverlay.mdok-show #mdokSheet { transform:translateY(0); }
    .mdok-handle { width:40px;height:4px;background:#e2e8f0;border-radius:2px;margin:12px auto 0;flex-shrink:0; }
    .mdok-header { padding:14px 18px 0;flex-shrink:0; }
    .mdok-title  { font-size:15px;font-weight:800;color:#0f172a; }
    .mdok-sub    { font-size:11px;color:#64748b;margin-top:2px; }
    .mdok-body   { overflow-y:auto;flex:1;padding:12px 18px; }
    .mdok-footer { padding:10px 18px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #f1f5f9;display:flex;gap:8px;flex-shrink:0; }
    .mdok-btn {
        flex:1;padding:12px 8px;border:none;border-radius:12px;
        font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
        transition:opacity .15s,transform .1s;
    }
    .mdok-btn:active { opacity:.85;transform:scale(.98); }
    .mdok-btn-primary { background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff; }
    .mdok-btn-success { background:linear-gradient(135deg,#10b981,#059669);color:#fff; }
    .mdok-btn-cancel  { background:#f1f5f9;color:#64748b;font-weight:600; }

    .mdok-doc-card {
        display:flex;align-items:center;gap:12px;
        padding:12px 14px;border:1.5px solid #e2e8f0;
        border-radius:12px;margin-bottom:8px;cursor:pointer;
        transition:border-color .15s,background .15s;
    }
    .mdok-doc-card:hover { border-color:#6366f1;background:rgba(99,102,241,0.04); }
    .mdok-doc-icon { font-size:24px;flex-shrink:0; }
    .mdok-doc-nama { font-size:13px;font-weight:700;color:#0f172a; }
    .mdok-doc-harga { font-size:11px;color:var(--primary,#2563eb);font-weight:700;margin-top:2px; }
    .mdok-field-label { font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px; }
    .mdok-field-input { width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box; }
    .mdok-field-input:focus { border-color:#6366f1; }
    .mdok-field-textarea { resize:vertical;min-height:70px; }

    /* Settings accordion dokumen */
    .mdok-settings-card {
        border:1px solid rgba(99,102,241,.15);border-radius:12px;
        margin-bottom:10px;overflow:hidden;
    }
    .mdok-settings-header {
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 14px;cursor:pointer;background:rgba(99,102,241,.03);
        transition:background .15s;
    }
    .mdok-settings-header:hover { background:rgba(99,102,241,.07); }
    .mdok-settings-body { padding:14px;display:none; }
    .mdok-settings-body.open { display:block; }
    .mdok-tag {
        display:inline-block;background:rgba(99,102,241,.1);color:#4f46e5;
        border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700;
        margin:2px 2px 0 0;cursor:pointer;border:1px solid rgba(99,102,241,.2);
        transition:background .12s;
    }
    .mdok-tag:hover { background:rgba(99,102,241,.2); }
    `;
    document.head.appendChild(s);
})();

// ════════════════════════════════════════
//  MODAL UTAMA: PILIH & ISI DOKUMEN
// ════════════════════════════════════════

let _mdokPasienData  = null;
let _mdokKunjData    = null;
let _mdokStep        = 'list';  // 'list' | 'form'
let _mdokSlug        = '';
let _mdokNama        = '';
let _mdokTemplate    = '';
let _mdokFieldValues = {};

function _ensureMdokDOM() {
    if (document.getElementById('mdokOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'mdokOverlay';
    ov.innerHTML = `
    <div id="mdokSheet">
        <div class="mdok-handle"></div>
        <div class="mdok-header">
            <div class="mdok-title" id="mdokTitle">📄 Dokumen</div>
            <div class="mdok-sub" id="mdokSub"></div>
        </div>
        <div class="mdok-body" id="mdokBody"></div>
        <div class="mdok-footer" id="mdokFooter"></div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _tutupMdok(); });
}

function _tutupMdok() {
    const ov = document.getElementById('mdokOverlay');
    if (ov) ov.classList.remove('mdok-show');
    _mdokStep = 'list';
}

function _openMdok() {
    _ensureMdokDOM();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const ov = document.getElementById('mdokOverlay');
            if (ov) ov.classList.add('mdok-show');
        });
    });
}

/**
 * Buka modal dokumen untuk pasien tertentu.
 * @param {string} pasienId
 * @param {string} kunjunganId  — kunjungan aktif (untuk data diagnosa / dokter)
 */
window.openModalDokumen = async function(pasienId, kunjunganId) {
    _mdokStep        = 'list';
    _mdokPasienData  = null;
    _mdokKunjData    = null;
    _mdokFieldValues = {};

    _ensureMdokDOM();
    document.getElementById('mdokTitle').textContent = '📄 Cetak Dokumen';
    document.getElementById('mdokSub').textContent   = '';
    document.getElementById('mdokBody').innerHTML    = '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">⏳ Memuat...</div>';
    document.getElementById('mdokFooter').innerHTML  = '';
    _openMdok();

    try {
        // Fetch pasien
        const pRows = await _sbFetch(`pasien?id=eq.${pasienId}&select=*&limit=1`);
        _mdokPasienData = pRows[0] || null;

        // Fetch kunjungan
        if (kunjunganId) {
            const kRows = await _sbFetch(`kunjungan?id=eq.${kunjunganId}&select=*&limit=1`);
            _mdokKunjData = kRows[0] || null;
        }

        // Pastikan _usersCache tersedia untuk resolve dokter
        if (!window._usersCache || !window._usersCache.length) {
            window._usersCache = await _sbFetch('users?select=id,nama,jabatan').catch(() => []);
        }

        // Pastikan _tarifCache ada
        if (!window._tarifCache || !window._tarifCache.length) {
            if (typeof _refreshTarifCache === 'function') await _refreshTarifCache();
        }

        _renderMdokList();
    } catch(e) {
        document.getElementById('mdokBody').innerHTML =
            `<div style="text-align:center;color:#ef4444;padding:24px;font-size:12px;">❌ ${e.message || 'Gagal memuat'}</div>`;
    }
};

function _renderMdokList() {
    const p    = _mdokPasienData;
    const docs = _getDokumenList();

    document.getElementById('mdokTitle').textContent = '📄 Cetak Dokumen';
    document.getElementById('mdokSub').textContent   = p ? `Pasien: ${p.nama}` : '';

    const body = document.getElementById('mdokBody');
    const foot = document.getElementById('mdokFooter');

    if (docs.length === 0) {
        body.innerHTML = `
        <div style="text-align:center;padding:28px 16px;color:#94a3b8;">
            <div style="font-size:36px;margin-bottom:10px;">📋</div>
            <div style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:6px;">Belum ada dokumen tersedia</div>
            <div style="font-size:12px;line-height:1.7;">
                Tambahkan item di halaman <b>Tarif</b> dengan kategori <b>Administrasi</b>
                untuk membuat dokumen baru (mis: Surat Keterangan Sehat, Surat Rujukan).
            </div>
        </div>`;
        foot.innerHTML = `<button class="mdok-btn mdok-btn-cancel" onclick="_tutupMdok()">Tutup</button>`;
        return;
    }

    body.innerHTML = docs.map(t => {
        const slug = _slugDokumen(t.nama);
        return `
        <div class="mdok-doc-card" onclick="_pilihDokumen('${slug}','${_escD(t.nama)}')">
            <div class="mdok-doc-icon">📄</div>
            <div style="flex:1;min-width:0;">
                <div class="mdok-doc-nama">${_escD(t.nama)}</div>
                ${t.keterangan ? `<div style="font-size:11px;color:#64748b;">${_escD(t.keterangan)}</div>` : ''}
                <div class="mdok-doc-harga">Rp ${Number(t.harga||0).toLocaleString('id-ID')}</div>
            </div>
            <div style="color:#94a3b8;font-size:18px;">›</div>
        </div>`;
    }).join('');

    foot.innerHTML = `<button class="mdok-btn mdok-btn-cancel" onclick="_tutupMdok()">Tutup</button>`;
}

async function _pilihDokumen(slug, nama) {
    _mdokSlug        = slug;
    _mdokNama        = nama;
    _mdokFieldValues = {};

    // Load template
    document.getElementById('mdokBody').innerHTML =
        '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">⏳ Memuat template...</div>';

    _mdokTemplate = await _getTemplate(slug, nama);

    document.getElementById('mdokTitle').textContent = _escD(nama);
    document.getElementById('mdokSub').textContent   = _mdokPasienData ? `Pasien: ${_mdokPasienData.nama}` : '';

    _renderMdokForm();
}

function _renderMdokForm() {
    const fields = _extractFields(_mdokTemplate);
    const body   = document.getElementById('mdokBody');
    const foot   = document.getElementById('mdokFooter');

    if (fields.length === 0) {
        // Tidak ada field custom → langsung ke preview
        body.innerHTML = `
        <div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18);border-radius:12px;padding:14px;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:#4f46e5;margin-bottom:4px;">✅ Template siap dicetak</div>
            <div style="font-size:11.5px;color:#64748b;line-height:1.7;">
                Data pasien akan otomatis diisi dari rekam medis.<br>
                Klik <b>Preview & Cetak</b> untuk melihat dokumen.
            </div>
        </div>
        ${_htmlDataPreview()}`;
    } else {
        body.innerHTML = `
        <div style="font-size:11.5px;color:#64748b;background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:14px;line-height:1.7;">
            📝 Lengkapi data tambahan untuk <b>${_escD(_mdokNama)}</b>:
        </div>
        ${fields.map(k => `
        <div style="margin-bottom:12px;">
            <label class="mdok-field-label">${_fieldLabel(k)}</label>
            ${k === 'isi' || k === 'alasan' || k === 'catatan'
                ? `<textarea id="mdok_field_${k}" class="mdok-field-input mdok-field-textarea"
                      placeholder="${_fieldLabel(k)}..."
                      oninput="_mdokFieldValues['${k}']=this.value">${_mdokFieldValues[k]||''}</textarea>`
                : `<input type="text" id="mdok_field_${k}" class="mdok-field-input"
                      placeholder="${_fieldLabel(k)}..."
                      value="${_escD(_mdokFieldValues[k]||'')}"
                      oninput="_mdokFieldValues['${k}']=this.value">`
            }
        </div>`).join('')}
        ${_htmlDataPreview()}`;
    }

    foot.innerHTML = `
    <button class="mdok-btn mdok-btn-cancel" onclick="_renderMdokList()">← Kembali</button>
    <button class="mdok-btn mdok-btn-success" onclick="_previewDanCetakDokumen()">🖨️ Preview & Cetak</button>`;
}

function _htmlDataPreview() {
    const p = _mdokPasienData;
    if (!p) return '';
    const umur = (typeof hitungUmur === 'function') ? hitungUmur(p.tgl_lahir || p.tgl || '') : '—';
    const tglLahir = (typeof formatTglIndo === 'function')
        ? formatTglIndo(p.tgl_lahir || p.tgl || '')
        : (p.tgl_lahir || '—');
    return `
    <div style="background:rgba(5,150,105,.05);border:1px solid rgba(5,150,105,.2);border-radius:10px;padding:12px 14px;margin-top:10px;">
        <div style="font-size:10.5px;font-weight:700;color:#065f46;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Data Pasien (Otomatis)</div>
        <div style="font-size:12px;color:#374151;line-height:2;">
            <div><b>Nama:</b> ${_escD(p.nama||'—')}</div>
            <div><b>NIK:</b> ${_escD(p.nik||'—')}</div>
            <div><b>Tgl Lahir:</b> ${_escD(tglLahir)} (${_escD(umur)})</div>
            <div><b>Jenis Kelamin:</b> ${p.jk === 'P' ? 'Perempuan' : 'Laki-Laki'}</div>
            <div><b>Alamat:</b> ${_escD(p.alamat||'—')}</div>
        </div>
    </div>`;
}

function _previewDanCetakDokumen() {
    // Sync nilai field dari DOM (kasus user sudah ketik)
    const fields = _extractFields(_mdokTemplate);
    fields.forEach(k => {
        const el = document.getElementById(`mdok_field_${k}`);
        if (el) _mdokFieldValues[k] = el.value;
    });

    const html = _renderTemplate(
        _mdokTemplate,
        _mdokPasienData || {},
        _mdokKunjData || {},
        _mdokFieldValues
    );

    const klinikNama = window.KLINIK_NAMA || 'Klinik';
    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) { showToast('⚠️ Izinkan popup untuk mencetak dokumen', 'error'); return; }

    win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${_escD(_mdokNama)} — ${_escD(_mdokPasienData?.nama || '')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Sora',sans-serif;background:#f1f5f9;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact; }
  .page-wrap { max-width:780px;margin:28px auto;background:#fff;border-radius:12px;box-shadow:0 4px 30px rgba(0,0,0,.1);overflow:hidden; }
  .accent { height:4px;background:linear-gradient(90deg,#1d4ed8,#6366f1); }
  .content { padding:32px; }
  .no-print { text-align:center;padding:18px;background:#f8fafc; }
  .no-print button { padding:11px 32px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin:0 4px; }
  .no-print button.sec { background:#f1f5f9;color:#475569; }
  @media print {
    body { background:#fff; }
    .page-wrap { margin:0;box-shadow:none;border-radius:0;max-width:100%; }
    .no-print { display:none; }
    @page { margin:12mm;size:A4; }
  }
</style>
</head>
<body>
<div class="page-wrap">
  <div class="accent"></div>
  <div class="content">${html}</div>
</div>
<div class="no-print">
  <button onclick="window.print()">🖨️ Cetak Dokumen</button>
  <button class="sec" onclick="window.close()">Tutup</button>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script>
</body></html>`);
    win.document.close();

    showToast(`✅ ${_mdokNama} — dokumen dibuka untuk cetak`, 'success');
}

// ════════════════════════════════════════
//  SETTINGS DOKUMEN — Render accordion
//  Dipanggil dari settings.js atau
//  tombol "⚙️ Kelola Template" di pageSettings
// ════════════════════════════════════════

window.renderSettingsDokumen = async function(containerId) {
    const container = document.getElementById(containerId || 'settingsDokumenContainer');
    if (!container) return;

    // Pastikan tarif tersedia
    if (!window._tarifCache || !window._tarifCache.length) {
        if (typeof _refreshTarifCache === 'function') await _refreshTarifCache();
    }

    const docs = _getDokumenList();

    if (docs.length === 0) {
        container.innerHTML = `
        <div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;">
            Belum ada dokumen administrasi. Tambahkan di halaman <b>Tarif</b>
            dengan kategori <b>Administrasi</b>.
        </div>`;
        return;
    }

    container.innerHTML = `
    <div style="font-size:11.5px;color:#64748b;background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:14px;line-height:1.7;">
        💡 Setiap dokumen memiliki template HTML yang bisa disesuaikan.
        Gunakan <b>field dinamis</b> di bawah untuk menyisipkan data pasien secara otomatis.
    </div>

    <!-- Referensi field -->
    <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px;">Field Dinamis yang Tersedia</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${['{{nama}}','{{nik}}','{{umur}}','{{jk}}','{{tgl_lahir}}','{{alamat}}',
               '{{tgl}}','{{diagnosa}}','{{keluhan}}','{{dokter}}','{{klinik}}',
               '{{klinik_alamat}}','{{klinik_telp}}','{{klinik_kota}}',
               '{{field_nomor}}','{{field_keperluan}}','{{field_tujuan}}',
               '{{field_alasan}}','{{field_isi}}','{{field_catatan}}'
              ].map(f => `<span class="mdok-tag" onclick="_copyTag('${f}')">${f}</span>`).join('')}
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-top:5px;">💡 Klik tag untuk menyalin. <b>{{field_*}}</b> akan muncul sebagai input di modal cetak.</div>
    </div>

    ${docs.map(t => {
        const slug = _slugDokumen(t.nama);
        return `
        <div class="mdok-settings-card" id="mdoksc_${slug}">
            <div class="mdok-settings-header" onclick="_toggleMdokSection('${slug}')">
                <div>
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">📄 ${_escD(t.nama)}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">Rp ${Number(t.harga||0).toLocaleString('id-ID')} · ${_escD(t.kategori)}</div>
                </div>
                <span id="mdoksc_arrow_${slug}" style="font-size:11px;color:#6366f1;">▶</span>
            </div>
            <div class="mdok-settings-body" id="mdoksc_body_${slug}">
                <label class="mdok-field-label" style="margin-bottom:6px;">Template HTML</label>
                <textarea id="mdok_tmpl_${slug}"
                    style="width:100%;height:240px;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;
                           font-size:11.5px;font-family:monospace;resize:vertical;box-sizing:border-box;outline:none;
                           transition:border-color .15s;"
                    onfocus="this.style.borderColor='#6366f1'"
                    onblur="this.style.borderColor='#e2e8f0'"
                    placeholder="Loading...">
                </textarea>
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                    <button onclick="_simpanTemplate('${slug}')"
                        style="flex:1;min-width:120px;padding:10px;background:linear-gradient(135deg,#6366f1,#2563eb);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
                        💾 Simpan Template
                    </button>
                    <button onclick="_resetTemplate('${slug}','${_escD(t.nama)}')"
                        style="padding:10px 14px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-size:12px;cursor:pointer;">
                        🔄 Reset Default
                    </button>
                    <button onclick="_previewTemplateDummy('${slug}','${_escD(t.nama)}')"
                        style="padding:10px 14px;background:rgba(5,150,105,.1);color:#065f46;border:1px solid rgba(5,150,105,.25);border-radius:10px;font-size:12px;cursor:pointer;">
                        👁️ Preview
                    </button>
                </div>
            </div>
        </div>`;
    }).join('')}`;

    // Load semua template ke textarea
    for (const t of docs) {
        const slug = _slugDokumen(t.nama);
        const tmpl = await _getTemplate(slug, t.nama);
        const ta   = document.getElementById(`mdok_tmpl_${slug}`);
        if (ta) ta.value = tmpl;
    }
};

function _toggleMdokSection(slug) {
    const body  = document.getElementById(`mdoksc_body_${slug}`);
    const arrow = document.getElementById(`mdoksc_arrow_${slug}`);
    if (!body) return;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

window._copyTag = function(tag) {
    navigator.clipboard.writeText(tag).then(() => {
        showToast(`📋 Disalin: ${tag}`, 'info');
    }).catch(() => {
        showToast(`Tag: ${tag}`, 'info');
    });
};

window._simpanTemplate = async function(slug) {
    const ta = document.getElementById(`mdok_tmpl_${slug}`);
    if (!ta) return;
    try {
        await _saveTemplate(slug, ta.value);
        showToast('✅ Template berhasil disimpan', 'success');
    } catch(e) {
        showToast('❌ Gagal menyimpan template: ' + (e.message || ''), 'error');
    }
};

window._resetTemplate = async function(slug, nama) {
    const ok = (typeof showKonfirmasi === 'function')
        ? await showKonfirmasi({
            icon: '🔄', title: 'Reset Template?',
            message: `Template <b>${nama}</b> akan dikembalikan ke bawaan sistem. Perubahan yang ada akan hilang.`,
            confirmText: 'Ya, Reset', cancelText: 'Batal', type: 'warning'
          })
        : confirm(`Reset template "${nama}" ke default?`);
    if (!ok) return;

    const defaultTmpl = (_TEMPLATE_DEFAULT[slug] || _TEMPLATE_DEFAULT['_default'])
        .replace('{{_NAMA_DOKUMEN}}', nama);
    const ta = document.getElementById(`mdok_tmpl_${slug}`);
    if (ta) ta.value = defaultTmpl;
    delete window._dokumenTemplateCache[slug];
    showToast('♻️ Template direset ke default', 'info');
};

window._previewTemplateDummy = async function(slug, nama) {
    const ta = document.getElementById(`mdok_tmpl_${slug}`);
    const tmpl = ta ? ta.value : await _getTemplate(slug, nama);

    const dummyPasien = {
        nama: 'Nama Pasien Contoh', nik: '1234567890123456',
        tgl_lahir: '1990-05-15', jk: 'L',
        alamat: 'Jl. Contoh No. 1, Kota'
    };
    const dummyKunj = { diag: 'Sehat (Contoh)', keluhan: 'Tidak ada keluhan' };
    const dummyFields = {};
    _extractFields(tmpl).forEach(k => { dummyFields[k] = `[${_fieldLabel(k)}]`; });

    const html = _renderTemplate(tmpl, dummyPasien, dummyKunj, dummyFields);
    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) { showToast('⚠️ Izinkan popup untuk preview', 'error'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;background:#f1f5f9;}
.wrap{max-width:780px;margin:28px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 30px rgba(0,0,0,.1);}
.banner{background:#fef9c3;border:1px solid #fbbf24;border-radius:8px;padding:8px 14px;font-size:12px;color:#92400e;margin-bottom:18px;}
@media print{.banner{display:none}}</style>
</head><body>
<div class="wrap">
  <div class="banner">⚠️ Ini adalah <b>preview dengan data dummy</b>. Field dinamis ditampilkan dalam tanda kurung.</div>
  ${html}
</div>
</body></html>`);
    win.document.close();
};

// ════════════════════════════════════════
//  INTEGRASI KE KUNJUNGAN & RIWAYAT
// ════════════════════════════════════════

/**
 * Tombol "📄 Dokumen" di card kunjungan.
 * Dipanggil dari renderKunjunganHariIni di kunjungan.js.
 * Bisa di-patch dari luar atau dipanggil langsung.
 */
window.cetakDokumenKunjungan = function(kunjunganId, pasienId) {
    openModalDokumen(pasienId, kunjunganId);
};

/**
 * Tombol "📄 Dokumen" di riwayat pasien (modal riwayat).
 * Dipanggil dari renderRiwayatList.
 */
window.cetakDokumenRiwayat = function(btn) {
    const kunjId  = btn.getAttribute('data-kunjid') || '';
    const pasienId = (typeof currentPasienId !== 'undefined') ? currentPasienId : '';
    openModalDokumen(pasienId, kunjId);
};

// ════════════════════════════════════════
//  HOOK — inject tombol "Dokumen" ke card
//  kunjungan tanpa memodifikasi kunjungan.js
// ════════════════════════════════════════

(function _hookKunjunganDokumen() {
    function _doHook() {
        const _orig = window.renderKunjunganHariIni;
        if (typeof _orig !== 'function') return false;
        if (_orig._dokumenHooked) return true;

        window.renderKunjunganHariIni = function() {
            _orig.apply(this, arguments);
            // Patch: tambah tombol "📄 Dokumen" ke setiap visit-card
            // yang punya action row (ada div dengan border-top dashed)
            _injectDokumenButtons();
        };
        window.renderKunjunganHariIni._dokumenHooked = true;
        return true;
    }

    function _injectDokumenButtons() {
        if (!window._biayaAktif) return; // hanya jika modul biaya aktif (tarif tersedia)
        if (_getDokumenList().length === 0) return;

        const cards = document.querySelectorAll('#listHariIni .visit-card');
        cards.forEach(card => {
            // Cari action row
            const actionRow = card.querySelector('[style*="border-top:1px dashed"]');
            if (!actionRow) return;
            if (actionRow.querySelector('.mdok-inject-btn')) return; // sudah ada

            // Ambil kunjunganId dari badge id (badge_obat_<id> atau badge_bayar_<id>)
            const badge = actionRow.querySelector('[id^="badge_obat_"]') || actionRow.querySelector('[id^="badge_bayar_"]');
            if (!badge) return;
            const kId = (badge.id.match(/badge_(?:obat|bayar)_(.+)/) || [])[1];
            if (!kId) return;

            // Ambil pasienId dari kunjunganHariIni
            const kData = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : []).find(x => x.id === kId);
            const pId   = kData?.pasienId || '';

            const btn = document.createElement('button');
            btn.className = 'mdok-inject-btn';
            btn.innerHTML = '📄 Dokumen';
            btn.style.cssText = 'flex:1;padding:5px 0;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;';
            btn.onclick = (e) => {
                e.stopPropagation();
                openModalDokumen(pId, kId);
            };
            actionRow.appendChild(btn);
        });
    }

    if (!_doHook()) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (_doHook() || tries > 50) clearInterval(t);
        }, 150);
    }
})();

// ════════════════════════════════════════
//  HOOK — inject tombol ke renderRiwayatList
// ════════════════════════════════════════

(function _hookRiwayatDokumen() {
    function _doHook() {
        const _orig = window.renderRiwayatList;
        if (typeof _orig !== 'function') return false;
        if (_orig._dokumenRiwayatHooked) return true;

        window.renderRiwayatList = function(list, containerId) {
            _orig.apply(this, arguments);
            // Setelah render, patch setiap tombol action di riwayat
            const c = document.getElementById(containerId);
            if (!c || _getDokumenList().length === 0) return;

            // Cari div yang berisi tombol Invoice/Resep di tiap item riwayat
            c.querySelectorAll('.riwayat-item').forEach((item, idx) => {
                const r = (list || [])[idx];
                if (!r || !r.id) return;

                // Cari div baris tombol (top-right di header item)
                const topRow = item.querySelector('[style*="justify-content:space-between"]');
                if (!topRow) return;
                if (topRow.querySelector('.mdok-riwayat-btn')) return; // sudah ada

                const btn = document.createElement('button');
                btn.className = 'mdok-riwayat-btn';
                btn.setAttribute('data-kunjid', r.id);
                btn.setAttribute('data-tgl', r.tgl || '');
                btn.onclick = (e) => { e.stopPropagation(); cetakDokumenRiwayat(btn); };
                btn.innerHTML = '📄 Dokumen';
                btn.style.cssText = 'padding:2px 7px;background:rgba(124,58,237,0.1);color:#5b21b6;border:1px solid rgba(124,58,237,0.25);border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer;';
                topRow.appendChild(btn);
            });
        };
        window.renderRiwayatList._dokumenRiwayatHooked = true;
        return true;
    }

    if (!_doHook()) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (_doHook() || tries > 50) clearInterval(t);
        }, 150);
    }
})();

// ════════════════════════════════════════
//  INTEGRASI KE SETTINGS
//  Tambah seksi "Dokumen Administrasi"
//  ke halaman Settings (setelah modul biaya)
// ════════════════════════════════════════

(function _hookSettings() {
    function _doHook() {
        const _origInit = window.initSettings;
        if (typeof _origInit !== 'function') return false;
        if (_origInit._dokumenHooked) return true;

        window.initSettings = function() {
            _origInit.apply(this, arguments);
            // Setelah settings dirender, inject seksi dokumen
            _injectDokumenSettingsSection();
        };
        window.initSettings._dokumenHooked = true;
        return true;
    }

    function _injectDokumenSettingsSection() {
        const wrap = document.querySelector('.page-settings-wrap');
        if (!wrap) return;
        if (document.getElementById('sec_dokumen_wrap')) return; // sudah ada

        // Cari tombol "Simpan Semua" untuk inject sebelumnya
        const btnWrap = wrap.querySelector('[style*="padding:8px 0 32px"]');

        const sec = document.createElement('div');
        sec.id = 'sec_dokumen_wrap';
        sec.className = 'settings-accordion';
        sec.style.cssText = 'background:#fff;border:1px solid rgba(99,102,241,0.12);border-radius:14px;margin-bottom:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);';
        sec.innerHTML = `
        <div class="settings-accordion-header" onclick="_toggleDokumenSection()">
            <div>
                <div class="settings-acc-title">📄 Template Dokumen Administrasi</div>
                <div class="settings-acc-sub">Edit template HTML untuk surat keterangan, rujukan, dan dokumen lainnya</div>
            </div>
            <span id="sec_dokumen_arrow" class="settings-acc-arrow">▶</span>
        </div>
        <div class="settings-accordion-body" id="sec_dokumen_body" style="display:none;">
            <div class="settings-acc-content">
                <div id="settingsDokumenContainer">
                    <div style="text-align:center;color:#94a3b8;font-size:12px;padding:12px;">
                        ⏳ Memuat daftar dokumen...
                    </div>
                </div>
            </div>
        </div>`;

        if (btnWrap) {
            wrap.insertBefore(sec, btnWrap);
        } else {
            wrap.appendChild(sec);
        }
    }

    if (!_doHook()) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (_doHook() || tries > 50) clearInterval(t);
        }, 150);
    }
})();

window._toggleDokumenSection = async function() {
    const body  = document.getElementById('sec_dokumen_body');
    const arrow = document.getElementById('sec_dokumen_arrow');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
    if (!isOpen) {
        // Load settings dokumen saat accordion dibuka
        await renderSettingsDokumen('settingsDokumenContainer');
    }
};

console.log('[Klikpro] ✅ modal-dokumen.js loaded — sistem cetak dokumen aktif');
