// ════════════════════════════════════════════════════════
//  KLIKPRO RME — PEM-LABOR.JS
//  Modul: Koordinator State Laboratorium & Penunjang
//
//  Tanggung jawab file ini:
//    • Menyediakan getReqLabPayload() untuk saveAll()
//      → mengumpulkan state _reqLab (penunjang) + _reqTindakan (tindakan)
//      → disimpan sebagai JSON ke kolom req_lab di tabel kunjungan
//    • Menyediakan loadReqLabFromKunjungan() untuk _isiFormDariKunjungan()
//      → me-restore semua state chip saat buka/edit kunjungan lama
//    • Mengelola clearSession() agar state ter-reset bersih
//
//  Bergantung pada (harus di-load lebih dulu):
//    - pem-penunjang.js  → _getPenunjangList, _reqLab, _reqLabHasil, _refreshPenunjangChipUI
//    - tim-medis.js      → _getTindakanList,  _reqTindakan, _refreshTindakanChipUI
//
//  File ini MENGGANTIKAN peran koordinasi dari lab-request.js lama.
//  Nama tetap memakai prefix "pem-labor" sesuai kesepakatan penamaan.
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  PAYLOAD — getReqLabPayload()
//  Dipanggil oleh saveAll() (kunjungan.js / patch index.html)
//  Mengumpulkan semua pilihan penunjang + tindakan menjadi
//  satu JSON string yang disimpan ke kolom req_lab.
// ════════════════════════════════════════════════════════

function getReqLabPayload() {
    const payload = {};

    // ── Penunjang: simpan flag true + hasil jika ada ──
    Object.entries(window._reqLab || {}).forEach(([k, v]) => {
        if (!v) return;
        payload[k] = true;
        const hasil = (window._reqLabHasil || {})[k];
        if (hasil && hasil.trim()) {
            payload['hasil_' + k] = hasil.trim();
        }
    });

    // ── Tindakan: simpan flag true ──
    Object.entries(window._reqTindakan || {}).forEach(([k, v]) => {
        if (v) payload[k] = true;
    });

    return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
}

// ════════════════════════════════════════════════════════
//  LOAD — loadReqLabFromKunjungan()
//  Dipanggil oleh _isiFormDariKunjungan() (pasien.js)
//  Me-restore state pilihan chip dari data req_lab di DB.
// ════════════════════════════════════════════════════════

function loadReqLabFromKunjungan(reqLabJson) {
    // Reset semua state chip
    window._reqLab      = {};
    window._reqTindakan = {};
    window._reqLabHasil = {};

    if (!reqLabJson) {
        _refreshAllChipUI();
        return;
    }

    let parsed = {};
    try {
        parsed = typeof reqLabJson === 'string' ? JSON.parse(reqLabJson) : reqLabJson;
    } catch(e) {
        _refreshAllChipUI();
        return;
    }

    // ── Pisahkan state berdasarkan prefix key ──
    Object.entries(parsed).forEach(([k, v]) => {
        if (!v) return;

        // Penunjang — prefix "penunjang_"
        if (k.startsWith('penunjang_')) {
            if (typeof v === 'string' && v !== 'true' && v !== String(true)) {
                // Nilai string bukan boolean → ini adalah hasil pemeriksaan (format lama)
                window._reqLab[k]      = true;
                window._reqLabHasil[k] = v;
            } else {
                window._reqLab[k] = true;
            }
        }

        // Tindakan — prefix "tindakan_"
        if (k.startsWith('tindakan_')) {
            window._reqTindakan[k] = true;
        }

        // Hasil penunjang — prefix "hasil_penunjang_" (format baru)
        if (k.startsWith('hasil_penunjang_')) {
            const chipId = k.replace('hasil_penunjang_', 'penunjang_');
            window._reqLabHasil[chipId] = v;
        }
    });

    _refreshAllChipUI();
}

// ── Refresh UI semua chip (penunjang + tindakan) ──
function _refreshAllChipUI() {
    // Refresh chip penunjang (didelegasikan ke pem-penunjang.js)
    if (typeof _refreshPenunjangChipUI === 'function') {
        _refreshPenunjangChipUI();
    }
    // Refresh chip tindakan (didelegasikan ke tim-medis.js)
    if (typeof _refreshTindakanChipUI === 'function') {
        _refreshTindakanChipUI();
    }
}

// ── Alias _refreshChipUI lama agar kode yang masih memanggilnya tetap jalan ──
window._refreshChipUI = _refreshAllChipUI;

// ════════════════════════════════════════════════════════
//  CLEAR SESSION — reset state saat pasien berganti
//  Meng-wrap clearSession() dari utils.js
// ════════════════════════════════════════════════════════

(function _wrapClearSessionForLabor() {
    const _origClear = window.clearSession;
    if (typeof _origClear !== 'function') return;

    window.clearSession = function() {
        _origClear.apply(this, arguments);
        window._reqLab      = {};
        window._reqTindakan = {};
        window._reqLabHasil = {};
    };
})();
