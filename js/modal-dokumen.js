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
