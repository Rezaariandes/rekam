// ════════════════════════════════════════════════════════
//  KLIKPRO RME — PEM-PENUNJANG.JS
//  Modul: Pemeriksaan Penunjang (EKG, Rontgen, USG, dll.)
//
//  Tanggung jawab file ini:
//    • Mendefinisikan daftar penunjang dari tarif DB
//    • Merender chip button di #sectionPermintaanLab
//    • Menyimpan state pilihan ke window._reqLab
//    • Menyediakan _getPenunjangList() untuk dipakai modul lain
//
//  Data bersumber dari: window._tarifCache (diisi biaya.js)
//  Fallback ke: window._penunjangList (dari Settings)
//  State disimpan di kolom req_lab tabel kunjungan (via getReqLabPayload)
// ════════════════════════════════════════════════════════

// ── State penunjang ──
window._reqLab      = window._reqLab      || {};
window._reqLabHasil = window._reqLabHasil || {};

// ── Icon map penunjang ──
const _PENUNJANG_ICONS = {
    'EKG'                    : '🫀',
    'EKG / Elektrokardiogram': '🫀',
    'Rontgen Thorax'         : '🦴',
    'Rontgen'                : '🦴',
    'USG Abdomen'            : '📡',
    'USG'                    : '📡',
    'Spirometri'             : '🌬️',
};

// ════════════════════════════════════════════════════════
//  HELPERS BERSAMA (dipakai juga oleh pem-labor.js & tim-medis.js)
// ════════════════════════════════════════════════════════

/**
 * Buat slug id dari nama tarif.
 * Contoh: "EKG / Elektrokardiogram" → "penunjang_ekg_elektrokardiogram"
 */
function _slugTarifId(prefix, nama) {
    return prefix + '_' + nama.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Cari icon dari map berdasarkan nama, fallback ke emoji default.
 */
function _iconForNama(nama, map, def) {
    for (const [k, v] of Object.entries(map)) {
        if (nama.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return def;
}

// ════════════════════════════════════════════════════════
//  DAFTAR PENUNJANG — dinamis dari tarif DB
// ════════════════════════════════════════════════════════

/**
 * Kembalikan daftar penunjang aktif.
 * Prioritas: window._tarifCache → window._penunjangList (Settings) → []
 */
function _getPenunjangList() {
    const cache     = window._tarifCache || [];
    const fromTarif = cache.filter(t => t.aktif && t.kategori === 'Penunjang');

    if (fromTarif.length > 0) {
        return fromTarif.map(t => ({
            id        : _slugTarifId('penunjang', t.nama),
            label     : t.nama,
            icon      : _iconForNama(t.nama, _PENUNJANG_ICONS, '🔭'),
            _tarifNama: t.nama
        }));
    }

    const fromSettings = (window._penunjangList || []).filter(n => n && n.trim());
    if (fromSettings.length > 0) {
        return fromSettings.map(nama => ({
            id        : _slugTarifId('penunjang', nama),
            label     : nama,
            icon      : _iconForNama(nama, _PENUNJANG_ICONS, '🔭'),
            _tarifNama: nama
        }));
    }

    return [];
}

// Alias global agar kode lama yang masih pakai PENUNJANG_LIST tetap jalan
Object.defineProperty(window, 'PENUNJANG_LIST', { get: _getPenunjangList, configurable: true });

// ════════════════════════════════════════════════════════
//  RENDER — chip button pemeriksaan penunjang
// ════════════════════════════════════════════════════════

/**
 * Render chip penunjang ke dalam #sectionPermintaanLab.
 * Dipanggil oleh kunjungan.js setelah lab section selesai dirender.
 */
function renderSectionPermintaanLab() {
    const container = document.getElementById('sectionPermintaanLab');
    if (!container) return;

    // Jika tarif cache belum tersedia tapi modul biaya aktif → muat dulu
    if ((!window._tarifCache || window._tarifCache.length === 0)
        && window._biayaAktif
        && typeof sb_getTarif === 'function') {
        sb_getTarif().then(tarif => {
            window._tarifCache = tarif || [];
            renderSectionPermintaanLab();
        }).catch(() => _renderPenunjangChips(container));
        return;
    }

    _renderPenunjangChips(container);
}

function _renderPenunjangChips(container) {
    const penunjangList = _getPenunjangList();

    if (penunjangList.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }

    // Pastikan border sub-section terlihat saat ada konten
    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:4px;';

    const chips = penunjangList.map(p => {
        const active   = !!window._reqLab[p.id];
        const hasilVal = (window._reqLabHasil && window._reqLabHasil[p.id]) || '';
        return `
        <div style="display:inline-block;margin:3px 3px 0 0;vertical-align:top;">
            <button
                id="chip_${p.id}"
                onclick="_togglePenunjang('${p.id}')"
                style="
                    display:inline-flex;align-items:center;gap:5px;
                    padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;
                    cursor:pointer;
                    border:1.5px solid ${active ? 'var(--primary,#2563eb)' : '#e2e8f0'};
                    background:${active ? 'var(--primary,#2563eb)' : '#fff'};
                    color:${active ? '#fff' : 'var(--text,#334155)'};
                    transition:all .15s;
                ">
                ${p.icon} ${p.label}
            </button>
            <div id="hasil_wrap_${p.id}" style="display:${active ? 'block' : 'none'};margin-top:4px;">
                <input type="text"
                    id="hasil_${p.id}"
                    placeholder="Tulis hasil ${p.label}..."
                    value="${hasilVal.replace(/"/g, '&quot;')}"
                    oninput="_simpanHasilPenunjang('${p.id}', this.value)"
                    style="width:100%;font-size:11px;padding:5px 9px;
                           border:1.5px solid var(--primary,#2563eb);border-radius:8px;
                           outline:none;background:#f0f6ff;color:#1e3a8a;
                           min-width:160px;box-sizing:border-box;">
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="rm-subsection-label" style="margin-bottom:8px;">
            <span class="rm-subsection-dot" style="background:#0891b2;width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block;margin-right:6px;"></span>
            <span style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Pemeriksaan Penunjang</span>
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px;">
            Pilih pemeriksaan lalu isi hasil. Item terpilih akan masuk ke tagihan otomatis.
        </div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:4px;align-items:flex-start;">
            ${chips}
        </div>
    `;
}

// ── Toggle satu chip penunjang ──
function _togglePenunjang(id) {
    window._reqLab[id] = !window._reqLab[id];
    const btn  = document.getElementById('chip_' + id);
    const wrap = document.getElementById('hasil_wrap_' + id);
    if (!btn) return;
    const active = window._reqLab[id];
    btn.style.background  = active ? 'var(--primary,#2563eb)' : '#fff';
    btn.style.borderColor = active ? 'var(--primary,#2563eb)' : '#e2e8f0';
    btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
    if (wrap) {
        wrap.style.display = active ? 'block' : 'none';
        if (active) {
            const inp = wrap.querySelector('input');
            if (inp) setTimeout(() => inp.focus(), 80);
        } else {
            if (window._reqLabHasil) delete window._reqLabHasil[id];
        }
    }
}

/** Simpan nilai hasil penunjang ke state global */
function _simpanHasilPenunjang(id, val) {
    if (!window._reqLabHasil) window._reqLabHasil = {};
    window._reqLabHasil[id] = val;
}

// ════════════════════════════════════════════════════════
//  RESTORE state chip dari data kunjungan
//  Dipanggil oleh pem-labor.js → loadReqLabFromKunjungan()
// ════════════════════════════════════════════════════════

function _refreshPenunjangChipUI() {
    _getPenunjangList().forEach(p => {
        const btn  = document.getElementById('chip_' + p.id);
        const wrap = document.getElementById('hasil_wrap_' + p.id);
        const inp  = document.getElementById('hasil_' + p.id);
        if (!btn) return;
        const active = !!window._reqLab[p.id];
        btn.style.background  = active ? 'var(--primary,#2563eb)' : '#fff';
        btn.style.borderColor = active ? 'var(--primary,#2563eb)' : '#e2e8f0';
        btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
        if (wrap) wrap.style.display = active ? 'block' : 'none';
        if (inp && active && window._reqLabHasil?.[p.id]) {
            inp.value = window._reqLabHasil[p.id];
        }
    });
}

// ════════════════════════════════════════════════════════
//  AUTO-TAGIHAN — kontribusi penunjang ke tagihan
//  Hook ke sb_autoTagihanFromKunjungan (supabase-biaya.js)
// ════════════════════════════════════════════════════════

(function _hookAutoTagihanPenunjang() {
    const _orig = window.sb_autoTagihanFromKunjungan;
    if (typeof _orig !== 'function') return;

    window.sb_autoTagihanFromKunjungan = async function(kunjunganId, kunjunganData) {
        const items = await _orig.apply(this, arguments);

        let tarifAktif = [];
        try {
            const semua = await sb_getTarif();
            tarifAktif  = semua.filter(t => t.aktif);
        } catch(e) { return items; }

        const reqParsed = (() => {
            try { return kunjunganData.req_lab ? JSON.parse(kunjunganData.req_lab) : {}; }
            catch(e) { return {}; }
        })();

        _getPenunjangList().forEach(p => {
            if (!reqParsed[p.id]) return;
            const t = tarifAktif.find(x => x.kategori === 'Penunjang' && x.nama === (p._tarifNama || p.label));
            items.push({
                nama_item:    'Penunjang: ' + p.label,
                kategori:     'Penunjang',
                jumlah:       1,
                harga_satuan: t ? Number(t.harga) : 0,
                keterangan:   null
            });
        });

        return items;
    };
})();
