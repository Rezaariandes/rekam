// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MEDIS-DINAMIS.JS
//
//  Engine: Render field/checkbox di page-medis secara
//  dinamis berdasarkan isi tarif_layanan (window._tarifCache).
//
//  ┌─────────────────────────────────────────────────────┐
//  │ KATEGORI TARIF  → SECTION PAGE MEDIS               │
//  ├─────────────────────────────────────────────────────┤
//  │ Pemeriksaan     → #sectionPemeriksaanDinamis        │
//  │                   (di bawah Pemeriksaan Fisik)      │
//  │ Penunjang       → #sectionPermintaanLab             │
//  │                   (sudah ada, dikelola pem-penunjang)│
//  │ Tindakan        → #sectionTindakan                  │
//  │                   (sudah ada, dikelola tin-medis)   │
//  │ Administrasi    → #sectionAdministrasiDinamis       │
//  │                   (di dalam card Dokumen Kesehatan) │
//  └─────────────────────────────────────────────────────┘
//
//  Item yang SUDAH DITANGANI secara hardcode (dilewati):
//    Pemeriksaan : Vital Sign, Konsultasi Medis,
//                  Pemeriksaan Fisik, Anamnesa
//    Administrasi: Surat Keterangan Sakit  (checkbox sudah ada di HTML)
//
//  Item BARU yang ditambahkan user di halaman Biaya akan
//  muncul otomatis sebagai:
//    • Pemeriksaan  → textarea dengan tombol mic
//    • Administrasi → checkbox (mirip Surat Keterangan Sakit)
//
//  State disimpan di: window._reqPemeriksaanExtra
//                     window._reqAdminExtra
//
//  Auto-tagihan: hook ke sb_autoTagihanFromKunjungan
//  Data ke DB   : disimpan dalam kolom req_lab (JSON) —
//                 key: "pemx_<slug>" dan "adm_<slug>"
// ════════════════════════════════════════════════════════

// ── State global ──
window._reqPemeriksaanExtra = window._reqPemeriksaanExtra || {};
window._reqAdminExtra       = window._reqAdminExtra       || {};

// ── Item Pemeriksaan hardcode (tidak dirender ulang) ──
const _PEMERIKSAAN_BAWAAN = [
    'Vital Sign', 'Konsultasi Medis', 'Pemeriksaan Fisik',
    'Anamnesa', 'Anamnesa (Keluhan Utama)'
];

// ── Item Administrasi hardcode (checkbox sudah ada di HTML) ──
const _ADMINISTRASI_BAWAAN = [
    'Surat Keterangan Sakit'
];

// ── Warna dot per sub-kategori pemeriksaan ──
const _PEMX_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#db2777', '#6366f1'];

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════

/** Buat slug dari nama tarif untuk dipakai sebagai ID elemen */
function _slugMedis(prefix, nama) {
    return prefix + '_' + nama
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/** Ambil tarif custom untuk satu kategori (bukan item bawaan) */
function _getTarifCustom(kategori, bawaanList) {
    return (window._tarifCache || []).filter(t =>
        t.aktif &&
        t.kategori === kategori &&
        !bawaanList.includes(t.nama)
    );
}

// ════════════════════════════════════════
//  RENDER — PEMERIKSAAN EXTRA
//  Tampil sebagai textarea + mic di dalam
//  card "Pemeriksaan Medis", setelah
//  sub-seksi Pemeriksaan Fisik.
// ════════════════════════════════════════

function _renderSectionPemeriksaanExtra() {
    const container = document.getElementById('sectionPemeriksaanDinamis');
    if (!container) return;

    const items = _getTarifCustom('Pemeriksaan', _PEMERIKSAAN_BAWAAN);

    if (items.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = '';

    const html = items.map((t, idx) => {
        const slug     = _slugMedis('pemx', t.nama);
        const dotColor = _PEMX_COLORS[idx % _PEMX_COLORS.length];
        return `
        <div class="rm-subsection" style="border-bottom:1px dashed var(--border);padding-bottom:14px;margin-bottom:14px;">
            <div class="rm-subsection-label">
                <span class="rm-subsection-dot" style="background:${dotColor};"></span>
                ${_escHtml(t.nama)}

            </div>
            <div class="form-group" style="position:relative;">
                <label class="form-label">${_escHtml(t.keterangan || t.nama)}</label>
                <textarea id="${slug}" class="form-control" data-save="true"
                          placeholder="Isi ${_escHtml(t.nama).toLowerCase()}..." rows="2"
                          oninput="_onPemxInput('${slug}')"></textarea>
                <button class="stt-btn" onclick="startSTT('${slug}')">🎙️</button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;

    // Pulihkan nilai dari localStorage (autosave)
    items.forEach(t => {
        const slug = _slugMedis('pemx', t.nama);
        const saved = localStorage.getItem('rme_' + slug);
        const el    = document.getElementById(slug);
        if (el && saved) {
            el.value = saved;
            window._reqPemeriksaanExtra[slug] = saved;
        }
    });
}

function _onPemxInput(slug) {
    const el = document.getElementById(slug);
    if (!el) return;
    window._reqPemeriksaanExtra[slug] = el.value;
    localStorage.setItem('rme_' + slug, el.value);
}

// ════════════════════════════════════════
//  RENDER — ADMINISTRASI EXTRA
//  Tampil sebagai checkbox di dalam
//  card "Dokumen Kesehatan", setelah
//  Surat Keterangan Sakit yang hardcode.
// ════════════════════════════════════════

function _renderSectionAdministrasiExtra() {
    const container = document.getElementById('sectionAdministrasiDinamis');
    if (!container) return;

    const items = _getTarifCustom('Administrasi', _ADMINISTRASI_BAWAAN);

    if (items.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = '';

    const html = items.map(t => {
        const slug    = _slugMedis('adm', t.nama);
        const checked = !!window._reqAdminExtra[slug];
        const modalId = 'modal_surat_' + slug;
        const ne      = _escHtml(t.nama);
        return `
        <div class="rm-doc-item" style="border-color:rgba(99,102,241,0.2);background:rgba(99,102,241,0.04);">
            <div class="rm-doc-check">
                <input type="checkbox" id="${slug}"
                    style="width:16px;height:16px;accent-color:var(--primary);"
                    onchange="_onAdmChange('${slug}')"
                    ${checked ? 'checked' : ''}>
                <label for="${slug}" class="rm-doc-label" style="color:var(--primary-dark);">${ne}</label>
                <button id="linkBtn_${slug}" class="rm-doc-link-btn"
                    style="display:${checked ? 'inline-flex' : 'none'};"
                    onclick="openModalSuratDinamis('${modalId}','${ne}')"
                    title="Buka ${ne}">🔗 Lihat Surat</button>
            </div>
            <div class="rm-doc-desc">${_escHtml(t.keterangan || 'Centang jika pasien memerlukan ' + t.nama.toLowerCase())}</div>
        </div>
        <div id="${modalId}" class="modal-surat-overlay" style="display:none;"
            onclick="if(event.target===this)this.style.display='none'">
            <div class="modal-surat-box">
                <div class="modal-surat-header">
                    <span>📄 ${ne}</span>
                    <button class="modal-surat-close"
                        onclick="document.getElementById('${modalId}').style.display='none'">✕</button>
                </div>
                <div class="modal-surat-body" id="body_${modalId}">
                    <div class="modal-surat-loading">Memuat data surat...</div>
                </div>
                <div class="modal-surat-footer">
                    <button onclick="window.print()" class="modal-surat-btn-print">🖨️ Cetak</button>
                    <button onclick="document.getElementById('${modalId}').style.display='none'"
                        class="modal-surat-btn-close">Tutup</button>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

function _onAdmChange(slug) {
    const el    = document.getElementById(slug);
    const btnEl = document.getElementById('linkBtn_' + slug);
    if (!el) return;
    window._reqAdminExtra[slug] = el.checked;
    if (btnEl) btnEl.style.display = el.checked ? 'inline-flex' : 'none';
}

/**
 * Isi dan tampilkan modal surat dinamis berdasarkan data pasien aktif.
 * Dipanggil saat tombol 🔗 Lihat Surat ditekan pada dokumen administrasi dinamis.
 */
function openModalSuratDinamis(modalId, namaSurat) {
    const modal  = document.getElementById(modalId);
    const bodyEl = document.getElementById('body_' + modalId);
    if (!modal || !bodyEl) return;

    const namaEl = document.getElementById('infoPasienNama');
    const nikEl  = document.getElementById('infoPasienNik');
    const umurEl = document.getElementById('infoPasienUmur');
    const nama   = (namaEl ? namaEl.innerText : localStorage.getItem('cP_nama') || '—').replace('—','').trim() || '—';
    const nik    = (nikEl  ? nikEl.innerText  : 'NIK: —').replace('NIK:','').replace(':','').trim();
    const umur   = (umurEl ? umurEl.innerText : 'Umur: —').replace('Umur:','').replace(':','').trim();
    const tgl    = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });

    bodyEl.innerHTML = `
        <div style="font-family:Georgia,serif;padding:20px 24px;line-height:1.7;color:#1e293b;">
            <div style="text-align:center;border-bottom:2px solid #1e293b;padding-bottom:10px;margin-bottom:18px;">
                <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${namaSurat}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">KlinikPro RME</div>
            </div>
            <p style="margin-bottom:8px;">Yang bertanda tangan di bawah ini, dokter pemeriksa, menerangkan bahwa:</p>
            <table style="width:100%;font-size:13px;margin-bottom:14px;border-collapse:collapse;">
                <tr><td style="width:130px;padding:3px 0;">Nama</td>
                    <td style="padding:3px 0;">: <strong>${nama}</strong></td></tr>
                <tr><td style="padding:3px 0;">NIK</td>
                    <td style="padding:3px 0;">: ${nik}</td></tr>
                <tr><td style="padding:3px 0;">Umur</td>
                    <td style="padding:3px 0;">: ${umur}</td></tr>
            </table>
            <p style="margin-bottom:18px;">Surat ini diterbitkan untuk keperluan
                <strong>${namaSurat.toLowerCase()}</strong>
                pada tanggal <strong>${tgl}</strong>.</p>
            <div style="text-align:right;margin-top:30px;">
                <div style="font-size:12px;">Pekanbaru, ${tgl}</div>
                <div style="font-size:12px;margin-top:4px;">Dokter Pemeriksa,</div>
                <div style="margin-top:52px;font-size:13px;font-weight:700;border-top:1px solid #1e293b;
                    display:inline-block;min-width:150px;text-align:center;">( ________________ )</div>
            </div>
        </div>`;

    modal.style.display = 'flex';
}

// ════════════════════════════════════════
//  RENDER UTAMA — dipanggil setiap kali
//  _tarifCache berubah / halaman dibuka
// ════════════════════════════════════════

function renderMedisDinamis() {
    // BUG FIX (refresh): Jika _tarifCache kosong, fetch dulu sebelum render
    // agar elemen DOM benar-benar terbentuk.
    if ((!window._tarifCache || window._tarifCache.length === 0)
        && window._biayaAktif && typeof sb_getTarif === 'function') {
        sb_getTarif().then(tarif => {
            window._tarifCache = tarif || [];
            try { _renderSectionPemeriksaanExtra(); } catch(e) {}
            try { _renderSectionAdministrasiExtra(); } catch(e) {}
        }).catch(() => {});
        return;
    }
    try { _renderSectionPemeriksaanExtra(); } catch(e) {
        console.warn('[medis-dinamis] Gagal render pemeriksaan extra:', e.message);
    }
    try { _renderSectionAdministrasiExtra(); } catch(e) {
        console.warn('[medis-dinamis] Gagal render administrasi extra:', e.message);
    }
}

// ════════════════════════════════════════
//  HOOK — ikut render saat _renderSectionLabDinamic
//  dipanggil (sama dengan pola tin-medis.js)
// ════════════════════════════════════════

(function _hookRenderMedisDinamis() {
    // Coba hook sekarang jika _renderSectionLabDinamic sudah ada
    function _doHook() {
        const _orig = window._renderSectionLabDinamic;
        if (typeof _orig !== 'function') return false;
        if (_orig._medisDinamisHooked) return true; // Sudah terpasang

        window._renderSectionLabDinamic = function() {
            _orig.apply(this, arguments);
            try { renderMedisDinamis(); } catch(e) {
                console.warn('[medis-dinamis] Hook render gagal:', e.message);
            }
        };
        window._renderSectionLabDinamic._medisDinamisHooked = true;
        return true;
    }

    if (!_doHook()) {
        // Belum tersedia, tunggu sampai DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                // Fallback: poll selama 5 detik
                let tries = 0;
                const t = setInterval(() => {
                    tries++;
                    if (_doHook() || tries > 50) clearInterval(t);
                }, 100);
            }
        });
    }
})();

// ════════════════════════════════════════
//  GET PAYLOAD — untuk disimpan ke DB
//  bersama data kunjungan (via req_lab JSON)
// ════════════════════════════════════════

/**
 * Kembalikan objek key-value semua field extra.
 * Digabungkan ke dalam req_lab JSON oleh getReqLabPayload()
 * di pem-labor.js atau fungsi simpan kunjungan.
 */
function getMedisDinamisPayload() {
    const out = {};

    // Pemeriksaan extra: hanya simpan yang tidak kosong
    Object.entries(window._reqPemeriksaanExtra || {}).forEach(([k, v]) => {
        if (v && String(v).trim()) out[k] = String(v).trim();
    });

    // Administrasi extra: hanya simpan yang dicentang
    Object.entries(window._reqAdminExtra || {}).forEach(([k, v]) => {
        if (v) out[k] = true;
    });

    return out;
}

/**
 * Isi ulang field dari data kunjungan yang tersimpan (req_lab JSON).
 * Dipanggil saat membuka rekam medis yang sudah ada.
 */
function loadMedisDinamisFromPayload(reqLabObj) {
    if (!reqLabObj || typeof reqLabObj !== 'object') return;

    // Reset state
    window._reqPemeriksaanExtra = {};
    window._reqAdminExtra       = {};

    Object.entries(reqLabObj).forEach(([k, v]) => {
        if (k.startsWith('pemx_') && v) {
            window._reqPemeriksaanExtra[k] = v;
            const el = document.getElementById(k);
            if (el) el.value = v;
        }
        if (k.startsWith('adm_') && v) {
            window._reqAdminExtra[k] = true;
            const el = document.getElementById(k);
            if (el) el.checked = true;
        }
    });
}

// ════════════════════════════════════════
//  HOOK AUTO-TAGIHAN
//  Tambah item ke tagihan otomatis dari
//  field pemeriksaan extra & admin extra
// ════════════════════════════════════════

(function _hookAutoTagihanMedisDinamis() {
    function _doHook() {
        const _orig = window.sb_autoTagihanFromKunjungan;
        if (typeof _orig !== 'function') return false;
        if (_orig._medisDinamisTagihanHooked) return true;

        window.sb_autoTagihanFromKunjungan = async function(kunjunganId, kunjunganData) {
            const items = await _orig.apply(this, arguments);

            const tarifAktif = (window._tarifCache || []).filter(t => t.aktif);

            // Parse req_lab untuk dapat state extra
            let reqObj = {};
            try {
                reqObj = kunjunganData.req_lab
                    ? (typeof kunjunganData.req_lab === 'string'
                        ? JSON.parse(kunjunganData.req_lab)
                        : kunjunganData.req_lab)
                    : {};
            } catch(e) {}

            // 1. Pemeriksaan extra → item tagihan
            _getTarifCustom('Pemeriksaan', _PEMERIKSAAN_BAWAAN).forEach(t => {
                const slug = _slugMedis('pemx', t.nama);
                const val  = reqObj[slug];
                if (val && String(val).trim()) {
                    items.push({
                        nama_item:    t.nama,
                        kategori:     'Pemeriksaan',
                        jumlah:       1,
                        harga_satuan: Number(t.harga) || 0,
                        keterangan:   null
                    });
                }
            });

            // 2. Administrasi extra → item tagihan
            _getTarifCustom('Administrasi', _ADMINISTRASI_BAWAAN).forEach(t => {
                const slug = _slugMedis('adm', t.nama);
                if (reqObj[slug]) {
                    items.push({
                        nama_item:    t.nama,
                        kategori:     'Administrasi',
                        jumlah:       1,
                        harga_satuan: Number(t.harga) || 0,
                        keterangan:   null
                    });
                }
            });

            return items;
        };

        window.sb_autoTagihanFromKunjungan._medisDinamisTagihanHooked = true;
        return true;
    }

    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let tries = 0;
                const t = setInterval(() => {
                    tries++;
                    if (_doHook() || tries > 50) clearInterval(t);
                }, 100);
            }
        });
    }
})();

// ════════════════════════════════════════
//  HOOK getReqLabPayload
//  Gabungkan payload medis-dinamis ke dalam
//  objek req_lab yang dikirim ke Supabase.
//  pem-labor.js menyediakan getReqLabPayload()
//  — kita wrap agar data extra ikut tersimpan.
// ════════════════════════════════════════

(function _hookGetReqLabPayload() {
    function _doHook() {
        const _orig = window.getReqLabPayload;
        if (typeof _orig !== 'function') return false;
        if (_orig._medisDinamisPayloadHooked) return true;

        window.getReqLabPayload = function() {
            const base  = _orig.apply(this, arguments) || {};
            const extra = getMedisDinamisPayload();
            // base bisa berupa objek atau string JSON
            let merged = {};
            if (typeof base === 'string') {
                try { merged = JSON.parse(base); } catch(e) { merged = {}; }
            } else {
                merged = { ...base };
            }
            Object.assign(merged, extra);
            return merged;
        };

        window.getReqLabPayload._medisDinamisPayloadHooked = true;
        return true;
    }

    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let tries = 0;
                const t = setInterval(() => {
                    tries++;
                    if (_doHook() || tries > 50) clearInterval(t);
                }, 100);
            }
        });
    }
})();

// ════════════════════════════════════════
//  HOOK _isiFormDariKunjungan
//  Saat buka rekam medis lama, isi kembali
//  field extra dari req_lab yang tersimpan.
// ════════════════════════════════════════

(function _hookIsiformDariKunjungan() {
    function _doHook() {
        const _orig = window._isiFormDariKunjungan;
        if (typeof _orig !== 'function') return false;
        if (_orig._medisDinamisIsiHooked) return true;

        window._isiFormDariKunjungan = function(kunjunganData) {
            _orig.apply(this, arguments);
            try {
                let reqObj = {};
                if (kunjunganData && kunjunganData.req_lab) {
                    reqObj = typeof kunjunganData.req_lab === 'string'
                        ? JSON.parse(kunjunganData.req_lab)
                        : kunjunganData.req_lab;
                }
                // BUG FIX (refresh): Pastikan _tarifCache terisi dulu agar elemen
                // DOM (textarea pemx_, checkbox adm_) sudah dibuat oleh renderMedisDinamis()
                // sebelum loadMedisDinamisFromPayload() mencoba mengisinya.
                const _doLoad = () => {
                    renderMedisDinamis();
                    loadMedisDinamisFromPayload(reqObj);
                };
                if (typeof window._ensureTarifCacheThen === 'function') {
                    window._ensureTarifCacheThen(_doLoad);
                } else {
                    _doLoad();
                }
            } catch(e) {
                console.warn('[medis-dinamis] Gagal load dari kunjungan:', e.message);
            }
        };

        window._isiFormDariKunjungan._medisDinamisIsiHooked = true;
        return true;
    }

    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let tries = 0;
                const t = setInterval(() => {
                    tries++;
                    if (_doHook() || tries > 50) clearInterval(t);
                }, 100);
            }
        });
    }
})();

// ════════════════════════════════════════
//  HOOK initPageBiaya
//  Setelah tarif di-refresh, re-render
//  section dinamis di page medis juga.
// ════════════════════════════════════════

(function _hookInitPageBiaya() {
    function _doHook() {
        const _orig = window.initPageBiaya;
        if (typeof _orig !== 'function') return false;
        if (_orig._medisDinamisBiayaHooked) return true;

        window.initPageBiaya = async function() {
            await _orig.apply(this, arguments);
            // Re-render section dinamis agar perubahan tarif langsung terlihat
            try { renderMedisDinamis(); } catch(e) {}
        };

        window.initPageBiaya._medisDinamisBiayaHooked = true;
        return true;
    }

    if (!_doHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (!_doHook()) {
                let tries = 0;
                const t = setInterval(() => {
                    tries++;
                    if (_doHook() || tries > 50) clearInterval(t);
                }, 100);
            }
        });
    }
})();

// ════════════════════════════════════════
//  HELPER LOKAL (tidak konflik global)
// ════════════════════════════════════════

function _escHtml(str) {
    if (typeof escHtml === 'function') return escHtml(str);
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _fmtRpMedis(n) {
    return Number(n || 0).toLocaleString('id-ID');
}

console.log('[medis-dinamis] ✅ Engine loaded — render dinamis dari tarif_layanan aktif');
