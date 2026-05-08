// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL RESEP PROFESIONAL
//  Sesuai kaidah resep dokter Indonesia
//  Menggantikan fungsi _tampilModalResep di kunjungan.js
//  
//  CARA INTEGRASI:
//  1. Tambahkan <script src="resep-modal.js"></script> di index.html
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

/** Escape HTML untuk keamanan */
function _escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
}

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
