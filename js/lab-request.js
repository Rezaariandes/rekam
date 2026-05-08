// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PERMINTAAN PENUNJANG & TINDAKAN
//  Renders:
//    • Tombol permintaan lab / penunjang (di bawah seksi lab)
//    • Tombol tindakan medis (di bawah seksi diagnosa/terapi)
//  State disimpan sebagai JSON di field req_lab pada tabel kunjungan.
// ════════════════════════════════════════════════════════

// ── State ──
window._reqLab      = window._reqLab      || {};
window._reqTindakan = window._reqTindakan || {};

// ════════════════════════════════════════════════════════
//  DAFTAR PENUNJANG & TINDAKAN — DINAMIS DARI TARIF DB
//  Membaca dari window._tarifCache (diisi oleh biaya.js).
//  Fallback ke list default jika cache belum tersedia.
//  Dengan ini, tombol di form medis SELALU sinkron dengan
//  data yang ada di halaman Tarif & Biaya.
// ════════════════════════════════════════════════════════

// Icon map untuk rendering chip
const _PENUNJANG_ICONS = {
    'EKG':'🫀','EKG / Elektrokardiogram':'🫀',
    'Rontgen Thorax':'🦴','Rontgen':'🦴',
    'USG Abdomen':'📡','USG':'📡',
    'Spirometri':'🌬️',
};
const _TINDAKAN_ICONS = {
    'Hecting / Jahit Luka':'🪡','Hecting':'🪡','Jahit Luka':'🪡',
    'Ganti Verband':'🩹','Verband':'🩹',
    'Injeksi / Suntik':'💉','Injeksi':'💉','Suntik':'💉',
    'Pemasangan Infus':'🩺','Pasang Infus':'🩺','Infus':'🩺',
    'Nebulisasi':'😮‍💨','Nebul':'😮‍💨',
    'Insisi Abses':'⚕️','Insisi':'⚕️',
    'Pemasangan Kateter':'🔗','Pasang Kateter':'🔗','Kateter':'🔗',
};

/** Buat slug id dari nama tarif. Contoh: "EKG / Elektrokardiogram" → "penunjang_ekg_elektrokardiogram" */
function _slugTarifId(prefix, nama) {
    return prefix + '_' + nama.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/** Ambil icon untuk nama tarif, fallback ke emoji default */
function _iconForNama(nama, map, def) {
    for (const [k, v] of Object.entries(map)) {
        if (nama.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return def;
}

/** Daftar penunjang aktif dari window._tarifCache,
 *  dengan fallback ke window._penunjangList (dari Settings) jika tarif cache kosong.
 *  Ini memastikan section penunjang tampil meski modul Biaya tidak aktif.
 */
function _getPenunjangList() {
    const cache = window._tarifCache || [];
    const fromTarif = cache.filter(t => t.aktif && t.kategori === 'Penunjang');

    // Jika tarif cache tersedia, pakai itu (data paling lengkap dengan harga)
    if (fromTarif.length > 0) {
        return fromTarif.map(t => ({
            id:         _slugTarifId('penunjang', t.nama),
            label:      t.nama,
            icon:       _iconForNama(t.nama, _PENUNJANG_ICONS, '🔭'),
            _tarifNama: t.nama
        }));
    }

    // Fallback: baca dari window._penunjangList yang diisi oleh Settings
    const fromSettings = (window._penunjangList || []).filter(n => n && n.trim());
    if (fromSettings.length > 0) {
        return fromSettings.map(nama => ({
            id:         _slugTarifId('penunjang', nama),
            label:      nama,
            icon:       _iconForNama(nama, _PENUNJANG_ICONS, '🔭'),
            _tarifNama: nama
        }));
    }

    return []; // kosong = tidak tampilkan section
}

/** Daftar tindakan aktif dari window._tarifCache,
 *  dengan fallback ke window._tindakanList (dari Settings) jika tarif cache kosong.
 */
function _getTindakanList() {
    const cache = window._tarifCache || [];
    const fromTarif = cache.filter(t => t.aktif && t.kategori === 'Tindakan');

    if (fromTarif.length > 0) {
        return fromTarif.map(t => ({
            id:         _slugTarifId('tindakan', t.nama),
            label:      t.nama,
            icon:       _iconForNama(t.nama, _TINDAKAN_ICONS, '⚕️'),
            _tarifNama: t.nama
        }));
    }

    // Fallback: baca dari window._tindakanList yang diisi oleh Settings
    const fromSettings = (window._tindakanList || []).filter(it => it && it.aktif !== false && it.nama && it.nama.trim());
    if (fromSettings.length > 0) {
        return fromSettings.map(it => ({
            id:         _slugTarifId('tindakan', it.nama),
            label:      it.nama,
            icon:       _iconForNama(it.nama, _TINDAKAN_ICONS, '⚕️'),
            _tarifNama: it.nama
        }));
    }

    return [];
}

// Alias global agar kode lama yang masih pakai PENUNJANG_LIST/TINDAKAN_LIST tetap jalan
Object.defineProperty(window, 'PENUNJANG_LIST', { get: _getPenunjangList, configurable: true });
Object.defineProperty(window, 'TINDAKAN_LIST',  { get: _getTindakanList,  configurable: true });

// ════════════════════════════════════════════════════════
//  RENDER — PERMINTAAN PENUNJANG (bawah sectionLab)
// ════════════════════════════════════════════════════════
function renderSectionPermintaanLab() {
    const container = document.getElementById('sectionPermintaanLab');
    if (!container) return;

    // Jika _tarifCache belum ada tapi biaya aktif, muat dulu
    if ((!window._tarifCache || window._tarifCache.length === 0) && window._biayaAktif && typeof sb_getTarif === 'function') {
        sb_getTarif().then(tarif => {
            window._tarifCache = tarif || [];
            renderSectionPermintaanLab();
        }).catch(() => _renderPenunjangChips(container));
        return;
    }

    _renderPenunjangChips(container);
}

function _renderPenunjangChips(container) {
    // Baca daftar penunjang (dari tarifCache atau fallback settings)
    const penunjangList = _getPenunjangList();

    // Jika tidak ada penunjang aktif → sembunyikan section
    if (penunjangList.length === 0) {
        container.innerHTML = '';
        return;
    }

    const chips = penunjangList.map(p => {
        const active = !!window._reqLab[p.id];
        const hasilVal = (window._reqLabHasil && window._reqLabHasil[p.id]) || '';
        return `
        <div style="display:inline-block;margin:3px 3px 0 0;vertical-align:top;">
            <button
                id="chip_${p.id}"
                onclick="_togglePenunjang('${p.id}')"
                style="
                    display:inline-flex;align-items:center;gap:5px;
                    padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;
                    cursor:pointer;border:1.5px solid ${active ? 'var(--primary,#2563eb)' : '#e2e8f0'};
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
                    value="${hasilVal.replace(/"/g,'&quot;')}"
                    oninput="_simpanHasilPenunjang('${p.id}', this.value)"
                    style="width:100%;font-size:11px;padding:5px 9px;border:1.5px solid var(--primary,#2563eb);border-radius:8px;outline:none;background:#f0f6ff;color:#1e3a8a;min-width:160px;box-sizing:border-box;">
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="section-divider"><span>🔭 Pemeriksaan Penunjang</span></div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px;">
            Pilih pemeriksaan lalu isi hasil. Item terpilih akan masuk ke tagihan otomatis.
        </div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:14px;align-items:flex-start;">
            ${chips}
        </div>
    `;
}

function _togglePenunjang(id) {
    window._reqLab[id] = !window._reqLab[id];
    const btn  = document.getElementById('chip_' + id);
    const wrap = document.getElementById('hasil_wrap_' + id);
    if (!btn) return;
    const active = window._reqLab[id];
    btn.style.background   = active ? 'var(--primary,#2563eb)' : '#fff';
    btn.style.borderColor  = active ? 'var(--primary,#2563eb)' : '#e2e8f0';
    btn.style.color        = active ? '#fff' : 'var(--text,#334155)';
    if (wrap) {
        wrap.style.display = active ? 'block' : 'none';
        if (active) {
            const inp = wrap.querySelector('input');
            if (inp) setTimeout(() => inp.focus(), 80);
        } else {
            // Hapus nilai hasil jika item di-uncheck
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
//  RENDER — TOMBOL TINDAKAN (inject di bawah sectionDiagnosa/terapi)
// ════════════════════════════════════════════════════════

// Dipanggil oleh _renderSectionLabDinamic (kunjungan.js) setelah seksi lab selesai.
// Kita inject seksi tindakan setelah sectionDiagnosa karena HTML menyediakannya di sana.
function _renderSectionTindakan() {
    // Cari container: taruh setelah checkbox surat sakit atau sebelum tombol simpan
    const sectionDiagnosa = document.getElementById('sectionDiagnosa');
    if (!sectionDiagnosa) return;

    // Hapus seksi tindakan lama jika sudah ada (avoid duplicate)
    const old = document.getElementById('sectionTindakanMedis');
    if (old) old.remove();

    // Baca daftar tindakan dari tarif aktif di DB (via _tarifCache)
    const tindakanList = _getTindakanList();

    // Jika tidak ada tindakan aktif di tarif → sembunyikan section
    if (tindakanList.length === 0) { return; }

    const chips = tindakanList.map(t => {
        const active = !!window._reqTindakan[t.id];
        return `<button
            id="chip_${t.id}"
            onclick="_toggleTindakan('${t.id}')"
            style="
                display:inline-flex;align-items:center;gap:5px;
                padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;
                cursor:pointer;border:1.5px solid ${active ? '#dc2626' : '#e2e8f0'};
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
        <div class="section-divider"><span>⚕️ Tindakan Medis</span></div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:8px;">
            Tandai tindakan yang dilakukan. Item terpilih akan masuk ke tagihan secara otomatis.
        </div>
        <div style="display:flex;flex-wrap:wrap;margin-bottom:14px;">
            ${chips}
        </div>
    `;

    // Sisipkan setelah checkbox surat sakit (sebelum tombol simpan)
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.closest('.card-body')?.insertBefore(div, btnSave);
    } else {
        sectionDiagnosa.insertAdjacentElement('afterend', div);
    }
}

function _toggleTindakan(id) {
    window._reqTindakan[id] = !window._reqTindakan[id];
    const btn = document.getElementById('chip_' + id);
    if (!btn) return;
    const active = window._reqTindakan[id];
    btn.style.background  = active ? '#dc2626' : '#fff';
    btn.style.borderColor = active ? '#dc2626' : '#e2e8f0';
    btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
}

// ════════════════════════════════════════════════════════
//  PAYLOAD — getReqLabPayload()
//  Dipanggil oleh saveAll() di kunjungan.js untuk
//  mendapatkan data penunjang & tindakan yang dipilih.
// ════════════════════════════════════════════════════════
function getReqLabPayload() {
    const payload = {};
    // Penunjang: simpan true untuk pilihan, tambah kunci hasil_ jika ada isi
    Object.entries(window._reqLab || {}).forEach(([k, v]) => {
        if (v) {
            payload[k] = true;
            const hasil = (window._reqLabHasil || {})[k];
            if (hasil && hasil.trim()) {
                payload['hasil_' + k] = hasil.trim();
            }
        }
    });
    // Tindakan
    Object.entries(window._reqTindakan || {}).forEach(([k, v]) => {
        if (v) payload[k] = true;
    });
    return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
}

// ════════════════════════════════════════════════════════
//  LOAD — loadReqLabFromKunjungan()
//  Dipanggil oleh _isiFormDariKunjungan() di pasien.js
//  untuk me-restore pilihan penunjang & tindakan.
// ════════════════════════════════════════════════════════
function loadReqLabFromKunjungan(reqLabJson) {
    // Reset state
    window._reqLab      = {};
    window._reqTindakan = {};
    window._reqLabHasil = {};

    if (!reqLabJson) {
        _refreshChipUI();
        return;
    }

    let parsed = {};
    try {
        parsed = typeof reqLabJson === 'string' ? JSON.parse(reqLabJson) : reqLabJson;
    } catch(e) {
        _refreshChipUI();
        return;
    }

    // Pisahkan ke reqLab, reqTindakan, dan hasil berdasarkan prefix id
    Object.entries(parsed).forEach(([k, v]) => {
        if (!v) return;
        if (k.startsWith('penunjang_')) {
            if (typeof v === 'string' && v !== 'true' && v !== true) {
                // nilai adalah hasil pemeriksaan
                window._reqLab[k]       = true;
                window._reqLabHasil[k]  = v;
            } else {
                window._reqLab[k] = true;
            }
        }
        if (k.startsWith('tindakan_'))  window._reqTindakan[k] = true;
        // hasil terpisah — kunci dengan suffix _hasil
        if (k.startsWith('hasil_penunjang_')) {
            const chipId = k.replace('hasil_penunjang_', 'penunjang_');
            window._reqLabHasil[chipId] = v;
        }
    });

    _refreshChipUI();
}

// Refresh visual state semua chips setelah load
function _refreshChipUI() {
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
        if (inp && active && window._reqLabHasil && window._reqLabHasil[p.id]) {
            inp.value = window._reqLabHasil[p.id];
        }
    });
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
//  HOOK — Tambahkan seksi tindakan ke _renderSectionLabDinamic
//  Wrap fungsi asli agar tindakan selalu dirender ulang
//  bersamaan dengan lab section.
// ════════════════════════════════════════════════════════
(function _hookRenderSectionLabDinamic() {
    const _orig = window._renderSectionLabDinamic;
    if (typeof _orig !== 'function') return;

    window._renderSectionLabDinamic = function() {
        _orig.apply(this, arguments);
        // Render tombol tindakan setelah lab section selesai
        try { _renderSectionTindakan(); } catch(e) {}
    };
})();

// Reset state saat sesi baru dimulai (clearSession dipanggil di utils.js)
const _origClearSession = window.clearSession;
if (typeof _origClearSession === 'function') {
    window.clearSession = function() {
        _origClearSession.apply(this, arguments);
        window._reqLab      = {};
        window._reqTindakan = {};
        window._reqLabHasil = {};
    };
}

// ════════════════════════════════════════════════════════
//  AUTO-TAGIHAN: tambahkan penunjang & tindakan yang dipilih
//  ke sb_autoTagihanFromKunjungan (supabase-biaya.js)
//  Override fungsi agar turut membaca req_lab dari kunjungan
// ════════════════════════════════════════════════════════
(function _hookAutoTagihan() {
    const _origAutoTagihan = window.sb_autoTagihanFromKunjungan;
    if (typeof _origAutoTagihan !== 'function') return;

    window.sb_autoTagihanFromKunjungan = async function(kunjunganId, kunjunganData) {
        // Jalankan versi asli terlebih dahulu
        const items = await _origAutoTagihan.apply(this, [kunjunganId, kunjunganData]);

        // Ambil tarif aktif
        let tarifAktif = [];
        try {
            const semua = await sb_getTarif();
            tarifAktif  = semua.filter(t => t.aktif);
        } catch(e) { return items; }

        const reqLabParsed = (() => {
            try {
                return kunjunganData.req_lab
                    ? JSON.parse(kunjunganData.req_lab)
                    : {};
            } catch(e) { return {}; }
        })();

        // Penunjang — baca dari _tarifCache agar sinkron dengan halaman Biaya
        _getPenunjangList().forEach(p => {
            if (!reqLabParsed[p.id]) return;
            const namaTarif = p._tarifNama || p.label;
            const t = tarifAktif.find(x => x.kategori === 'Penunjang' && x.nama === namaTarif);
            items.push({
                nama_item:    'Penunjang: ' + p.label,
                kategori:     'Penunjang',
                jumlah:       1,
                harga_satuan: t ? Number(t.harga) : 0,
                keterangan:   null
            });
        });

        // Tindakan — baca dari _tarifCache agar sinkron dengan halaman Biaya
        _getTindakanList().forEach(t => {
            if (!reqLabParsed[t.id]) return;
            const namaTarif = t._tarifNama || t.label;
            const tarif = tarifAktif.find(x => x.kategori === 'Tindakan' && x.nama === namaTarif);
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
