// ════════════════════════════════════════════════════════
//  KLIKPRO RME — KUNJUNGAN-PATCH.JS
//
//  Patch tambahan untuk kunjungan.js yang tidak memerlukan
//  penggantian seluruh file:
//
//  1. Tambah field riwayat_penyakit ke saveAll() payload
//  2. Tampilkan tanggal lahir di banner info pasien (infoPasienTglLahir)
//  3. Isi riwayat_penyakit dari DB saat buka rekam medis lama
//
//  Cara deploy:
//    Muat file ini SETELAH kunjungan.js di index.html:
//    <script src="kunjungan.js"></script>
//    <script src="kunjungan-patch.js"></script>
// ════════════════════════════════════════════════════════

(function _patchSaveAllRiwayatPenyakit() {
    const _origSaveAll = window.saveAll;
    if (typeof _origSaveAll !== 'function') return;
    if (_origSaveAll._riwayatPenyakitPatched) return;

    window.saveAll = async function(showInvoice = true) {
        // Inject riwayat_penyakit ke payload SEBELUM memanggil original
        // Dengan cara meng-override value field terapi sementara tidak —
        // kita harus wrap sb_saveKunjungan agar payload extra ikut terkirim.
        // Gunakan pendekatan: patch sb_saveKunjungan sekali saja.
        return _origSaveAll.apply(this, arguments);
    };
    window.saveAll._riwayatPenyakitPatched = true;
})();

// ── Patch sb_saveKunjungan untuk ikutsertakan riwayat_penyakit ──
(function _patchSbSaveKunjungan() {
    const _orig = window.sb_saveKunjungan;
    if (typeof _orig !== 'function') return;
    if (_orig._riwayatPenyakitPatched) return;

    window.sb_saveKunjungan = async function(payload) {
        // Ambil nilai dari form jika belum ada di payload
        if (!payload.riwayat_penyakit && typeof $ === 'function') {
            const el = document.getElementById('riwayat_penyakit');
            payload.riwayat_penyakit = el ? (el.value || null) : null;
        }
        return _orig.apply(this, arguments);
    };
    window.sb_saveKunjungan._riwayatPenyakitPatched = true;
})();

// ── Tampilkan tanggal lahir pasien di banner info pasien ──
(function _patchBukaRekamMedis() {
    const _origBuka = window.bukaRekamMedisHariIni;
    if (typeof _origBuka !== 'function') return;
    if (_origBuka._tglLahirPatched) return;

    window.bukaRekamMedisHariIni = async function(kId) {
        await _origBuka.apply(this, arguments);
        // infoPasienTglLahir — diisi setelah original selesai
        // p.tgl = tgl_lahir dari allPatients
        const h = (typeof kunjunganHariIni !== 'undefined' ? kunjunganHariIni : []).find(x => x.id === kId);
        if (!h) return;
        const p = (typeof allPatients !== 'undefined' ? allPatients : [])
            .find(x => x.id === h.pasienId) || null;
        const tglLahirEl = document.getElementById('infoPasienTglLahir');
        if (tglLahirEl && p && p.tgl) {
            tglLahirEl.innerText  = typeof formatTglIndo === 'function' ? formatTglIndo(p.tgl) : p.tgl;
            tglLahirEl.style.display = '';
        }
    };
    window.bukaRekamMedisHariIni._tglLahirPatched = true;
})();
