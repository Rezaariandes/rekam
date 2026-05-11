// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE-PATCH.JS
//
//  Patch supabase.js untuk mendukung field riwayat_penyakit
//  di tabel kunjungan.
//
//  Cara deploy:
//    Muat file ini SETELAH supabase.js di index.html:
//    <script src="supabase.js"></script>
//    <script src="supabase-patch.js"></script>
//
//  ALTERNATIF (jika ingin langsung edit supabase.js):
//    Lihat komentar "TAMBAHKAN DI SINI" di bawah.
// ════════════════════════════════════════════════════════

// ── Wrap sb_saveKunjungan agar ikutsertakan riwayat_penyakit ──
(function _patchSbSaveKunjunganRiwayat() {
    const _orig = window.sb_saveKunjungan;
    if (typeof _orig !== 'function') {
        // sb_saveKunjungan belum tersedia — tunggu
        document.addEventListener('DOMContentLoaded', _patchSbSaveKunjunganRiwayat);
        return;
    }
    if (_orig._riwayatPatched) return;

    window.sb_saveKunjungan = async function(payload) {
        // Ambil riwayat_penyakit dari form jika belum di payload
        const riwayatPenyakit = payload.riwayat_penyakit !== undefined
            ? payload.riwayat_penyakit
            : (document.getElementById('riwayat_penyakit') || {}).value || null;

        // Panggil original, lalu PATCH field tambahan jika kunjunganId tersedia
        const result = await _orig.apply(this, arguments);

        // Dapatkan kunjunganId dari result atau payload
        const kunjId = (result && result.kunjunganId) || payload.kunjunganId || null;

        if (kunjId && riwayatPenyakit !== undefined) {
            try {
                await _sbFetch(`kunjungan?id=eq.${kunjId}`, {
                    method: 'PATCH',
                    body: { riwayat_penyakit: riwayatPenyakit || null },
                    prefer: 'return=minimal'
                });
            } catch(e) {
                console.warn('[supabase-patch] riwayat_penyakit patch gagal:', e.message);
            }
        }

        return result;
    };
    window.sb_saveKunjungan._riwayatPatched = true;
})();

// ── Wrap sb_getKunjunganById agar ikutsertakan riwayat_penyakit dalam select ──
(function _patchSbGetKunjunganById() {
    const _orig = window.sb_getKunjunganById;
    if (typeof _orig !== 'function') return;
    if (_orig._riwayatPatched) return;

    window.sb_getKunjunganById = async function(kunjunganId) {
        // Panggil original (sudah return semua field)
        const data = await _orig.apply(this, arguments);
        if (!data) return data;
        // Jika riwayat_penyakit belum ada, fetch tambahan
        if (data.riwayat_penyakit === undefined) {
            try {
                const rows = await _sbFetch(`kunjungan?id=eq.${kunjunganId}&select=riwayat_penyakit&limit=1`);
                if (rows && rows[0]) data.riwayat_penyakit = rows[0].riwayat_penyakit || null;
            } catch(e) {}
        }
        return data;
    };
    window.sb_getKunjunganById._riwayatPatched = true;
})();
