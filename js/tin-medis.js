// ════════════════════════════════════════════════════════
//  KLIKPRO RME — TIM-MEDIS.JS
//  Modul: Tindakan Medis (Hecting, Injeksi, Infus, dll.)
//
//  Tanggung jawab file ini:
//    • Mendefinisikan daftar tindakan dari tarif DB
//    • Merender chip button di #sectionTindakan
//    • Menyimpan state pilihan ke window._reqTindakan
//    • Menyediakan _getTindakanList() untuk dipakai modul lain
//    • Hook ke _renderSectionLabDinamic agar render ikut dipanggil
//
//  Data bersumber dari: window._tarifCache (diisi biaya.js)
//  Sumber tunggal: window._tarifCache (Page Biaya)
//  State disimpan di kolom req_lab tabel kunjungan (via getReqLabPayload di pem-labor.js)
//
//  Bergantung pada (harus di-load lebih dulu):
//    - pem-penunjang.js  → _slugTarifId, _iconForNama (helpers bersama)
//    - supabase-biaya.js → sb_getTarif (untuk hook auto-tagihan)
// ════════════════════════════════════════════════════════

// ── State tindakan ──
window._reqTindakan = window._reqTindakan || {};

// ── Icon map tindakan ──
const _TINDAKAN_ICONS = {
    'Hecting / Jahit Luka': '🪡',
    'Hecting'             : '🪡',
    'Jahit Luka'          : '🪡',
    'Ganti Verband'       : '🩹',
    'Verband'             : '🩹',
    'Injeksi / Suntik'    : '💉',
    'Injeksi'             : '💉',
    'Suntik'              : '💉',
    'Pemasangan Infus'    : '🩺',
    'Pasang Infus'        : '🩺',
    'Infus'               : '🩺',
    'Nebulisasi'          : '😮‍💨',
    'Nebul'               : '😮‍💨',
    'Insisi Abses'        : '⚕️',
    'Insisi'              : '⚕️',
    'Pemasangan Kateter'  : '🔗',
    'Pasang Kateter'      : '🔗',
    'Kateter'             : '🔗',
};

// ════════════════════════════════════════════════════════
//  DAFTAR TINDAKAN — dinamis dari tarif DB
// ════════════════════════════════════════════════════════

/**
 * Kembalikan daftar tindakan aktif.
 * Sumber tunggal: window._tarifCache (Page Biaya).
 * Tidak ada fallback ke Settings — tarif_layanan adalah single source of truth.
 */
function _getTindakanList() {
    const cache     = window._tarifCache || [];
    const fromTarif = cache.filter(t => t.aktif && t.kategori === 'Tindakan');

    return fromTarif.map(t => ({
        id        : _slugTarifId('tindakan', t.nama),
        label     : t.nama,
        icon      : _iconForNama(t.nama, _TINDAKAN_ICONS, '⚕️'),
        _tarifNama: t.nama
    }));
}

// Alias global agar kode lama yang masih pakai TINDAKAN_LIST tetap jalan
Object.defineProperty(window, 'TINDAKAN_LIST', { get: _getTindakanList, configurable: true });

// ════════════════════════════════════════════════════════
//  RENDER — chip button tindakan medis
//  Mengisi #sectionTindakan yang tersedia di page-medis baru.
//  Dipanggil oleh hook _renderSectionLabDinamic di bawah.
// ════════════════════════════════════════════════════════

function _renderSectionTindakan() {
    const container = document.getElementById('sectionTindakan');
    if (!container) return;

    // Hapus render lama agar tidak duplikat
    const old = document.getElementById('sectionTindakanMedis');
    if (old) old.remove();

    const tindakanList = _getTindakanList();

    // Jika tidak ada tindakan aktif → kosongkan dan sembunyikan pembatas
    if (tindakanList.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }

    // Tampilkan kembali garis pembatas sub-section
    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:8px;';

    const chips = tindakanList.map(t => {
        const active = !!window._reqTindakan[t.id];
        return `<button
            id="chip_${t.id}"
            onclick="_toggleTindakan('${t.id}')"
            style="
                display:inline-flex;align-items:center;gap:5px;
                padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;
                cursor:pointer;
                border:1.5px solid ${active ? '#dc2626' : '#e2e8f0'};
                background:${active ? '#dc2626' : '#fff'};
                color:${active ? '#fff' : 'var(--text,#334155)'};
                transition:all .15s;margin:3px 3px 0 0;
            ">
            ${t.icon} ${t.label}
        </button>`;
    }).join('');

    const div = document.createElement('div');
    div.id = 'sectionTindakanMedis';
    div.innerHTML = `
        <div class="rm-subsection-label" style="margin-bottom:8px;">
            <span class="rm-subsection-dot"
                style="background:#dc2626;width:6px;height:6px;border-radius:50%;
                       flex-shrink:0;display:inline-block;margin-right:6px;"></span>
            <span style="font-size:11.5px;font-weight:700;color:var(--text-muted);
                         text-transform:uppercase;letter-spacing:0.5px;">Tindakan Medis</span>
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px;">
            Tandai tindakan yang dilakukan. Item terpilih akan masuk ke tagihan otomatis.
        </div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
            ${chips}
        </div>
    `;

    container.innerHTML = '';
    container.appendChild(div);
}

// ── Toggle satu chip tindakan ──
function _toggleTindakan(id) {
    window._reqTindakan[id] = !window._reqTindakan[id];
    const btn = document.getElementById('chip_' + id);
    if (!btn) return;
    const active = window._reqTindakan[id];
    btn.style.background  = active ? '#dc2626' : '#fff';
    btn.style.borderColor = active ? '#dc2626' : '#e2e8f0';
    btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
}

// ── Refresh visual semua chip tindakan (dipanggil oleh pem-labor.js) ──
function _refreshTindakanChipUI() {
    const container = document.getElementById('sectionTindakan');

    // BUG FIX: jika #sectionTindakan ada di DOM tapi chip belum dirender
    // (terjadi setelah page refresh / buka kunjungan lama), render ulang dulu.
    if (container) {
        _renderSectionTindakan();
    }

    // Update gaya chip sesuai state terkini
    _getTindakanList().forEach(t => {
        const btn = document.getElementById('chip_' + t.id);
        if (!btn) return;
        const active = !!window._reqTindakan[t.id];
        btn.style.background  = active ? '#dc2626' : '#fff';
        btn.style.borderColor = active ? '#dc2626' : '#e2e8f0';
        btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
    });
}

// ════════════════════════════════════════════════════════
//  HOOK — ikut dirender saat _renderSectionLabDinamic dipanggil
//  Wrap fungsi dari kunjungan.js agar tindakan selalu sinkron.
//
//  BUG FIX: hook lama gagal karena _renderSectionLabDinamic
//  belum terdefinisi saat tin-medis.js di-load (race condition).
//  Solusi: retry loop sampai fungsi tersedia, lalu wrap.
// ════════════════════════════════════════════════════════

(function _hookRenderSectionLabDinamicTindakan() {
    function _tryHook() {
        const _orig = window._renderSectionLabDinamic;

        if (typeof _orig !== 'function') {
            // Belum tersedia — coba lagi 100 ms kemudian
            setTimeout(_tryHook, 100);
            return;
        }

        // Cegah double-wrap
        if (_orig._tindakanHooked) return;

        window._renderSectionLabDinamic = function() {
            _orig.apply(this, arguments);
            try { _renderSectionTindakan(); } catch(e) {
                console.warn('[tin-medis] Gagal render tindakan:', e.message);
            }
        };
        window._renderSectionLabDinamic._tindakanHooked = true;
    }

    _tryHook();
})();

// ════════════════════════════════════════════════════════
//  SAFETY NET — render tindakan saat DOM siap
//  Jika #sectionTindakan sudah ada di halaman saat script
//  ini di-load (misal setelah hard-refresh), render langsung
//  tanpa menunggu hook _renderSectionLabDinamic dipanggil.
// ════════════════════════════════════════════════════════
(function _renderOnDOMReady() {
    function _tryRender() {
        if (document.getElementById('sectionTindakan')) {
            _renderSectionTindakan();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _tryRender);
    } else {
        setTimeout(_tryRender, 0);
    }
})();

// ════════════════════════════════════════════════════════
//  AUTO-TAGIHAN — kontribusi tindakan ke tagihan
//  Hook ke sb_autoTagihanFromKunjungan (supabase-biaya.js)
//  Dijalankan setelah hook dari pem-penunjang.js
// ════════════════════════════════════════════════════════

(function _hookAutoTagihanTindakan() {
    const _orig = window.sb_autoTagihanFromKunjungan;
    if (typeof _orig !== 'function') return;

    window.sb_autoTagihanFromKunjungan = async function(kunjunganId, kunjunganData) {
        // Jalankan chain sebelumnya (termasuk penunjang dari pem-penunjang.js)
        const items = await _orig.apply(this, arguments);

        // Gunakan _tarifCache yang sudah ada — hindari fetch ulang
        // pem-penunjang.js sudah fetch sb_getTarif() sebelumnya dalam chain ini
        const tarifAktif = (window._tarifCache || []).filter(t => t.aktif);

        const reqParsed = (() => {
            try { return kunjunganData.req_lab ? JSON.parse(kunjunganData.req_lab) : {}; }
            catch(e) { return {}; }
        })();

        _getTindakanList().forEach(t => {
            if (!reqParsed[t.id]) return;
            const tarif = tarifAktif.find(x =>
                x.kategori === 'Tindakan' && x.nama === (t._tarifNama || t.label)
            );
            items.push({
                nama_item:    'Tindakan: ' + t.label,
                kategori:     'Tindakan',
                jumlah:       1,
                harga_satuan: tarif ? Number(tarif.harga) : 0,
                keterangan:   null
            });
        });

        return items;
    };
})();
