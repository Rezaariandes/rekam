// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SURAT-TEMPLATE.JS
//
//  Engine template surat keterangan yang dapat dikustomisasi.
//  Fitur:
//    • Editor template per jenis surat di Settings
//    • Variabel dinamis: {{nama}}, {{nik}}, {{umur}}, {{tgl}},
//      {{kota}}, {{klinik_nama}}, {{klinik_alamat}}, {{klinik_telp}},
//      {{nama_dokter}}, {{tujuan}}
//    • Simpan ke Supabase (kolom surat_templates, tipe JSON)
//    • openModalSuratDinamis() membaca template ini jika ada,
//      fallback ke template bawaan jika belum dikonfigurasi
//
//  Dipanggil dari:
//    • medis-dinamis.js → openModalSuratDinamis()  (render surat)
//    • settings.js      → seksi "📄 Template Surat" (editor)
// ════════════════════════════════════════════════════════

// ── Cache template: { "Surat Keterangan Sehat": { ...templateObj }, ... }
window._suratTemplates = window._suratTemplates || {};

// ── Variabel yang tersedia untuk disisipkan ke template ──
const SURAT_VARS = [
    { key: '{{nama}}',          label: 'Nama Pasien' },
    { key: '{{nik}}',           label: 'NIK Pasien' },
    { key: '{{umur}}',          label: 'Umur Pasien' },
    { key: '{{jk}}',            label: 'Jenis Kelamin (L/P)' },
    { key: '{{tgl}}',           label: 'Tanggal Hari Ini' },
    { key: '{{kota}}',          label: 'Kota Klinik' },
    { key: '{{klinik_nama}}',   label: 'Nama Klinik' },
    { key: '{{klinik_alamat}}', label: 'Alamat Klinik' },
    { key: '{{klinik_telp}}',   label: 'Telepon Klinik' },
    { key: '{{nama_dokter}}',   label: 'Nama Dokter Login' },
    { key: '{{tujuan}}',        label: 'Keperluan Surat (= nama surat)' },
    { key: '{{diagnosa}}',      label: 'Diagnosa Utama' },
    { key: '{{terapi}}',        label: 'Terapi / Resep' },
];

// ── Template bawaan (dipakai jika user belum buat template sendiri) ──
const _TEMPLATE_DEFAULT_PEMBUKA =
    'Yang bertanda tangan di bawah ini, dokter pemeriksa, menerangkan bahwa:';

const _TEMPLATE_DEFAULT_PENUTUP =
    'Surat ini diterbitkan untuk keperluan <strong>{{tujuan}}</strong> pada tanggal <strong>{{tgl}}</strong>.\n\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.';

// ════════════════════════════════════════════════════════
//  HELPER — ambil info klinik & dokter dari globals
// ════════════════════════════════════════════════════════

function _getInfoKlinik() {
    const s = window._settingsFull || {};
    return {
        klinik_nama:   s.klinik_nama   || (typeof KLINIK_NAMA  !== 'undefined' ? KLINIK_NAMA  : 'KlinikPro RME'),
        klinik_alamat: s.klinik_alamat || '',
        klinik_telp:   s.klinik_telp   || '',
        kota:          s.klinik_kota   || _extractKota(s.klinik_alamat || ''),
    };
}

/** Coba ekstrak nama kota dari string alamat (kata pertama setelah "kota"/"kab.", fallback ke seluruhnya) */
function _extractKota(alamat) {
    if (!alamat) return '';
    const m = alamat.match(/(?:kota|kab\.?)\s+([A-Za-z\s]+)/i);
    if (m) return _titleCase(m[1].trim().split(/\s+/).slice(0, 2).join(' '));
    return _titleCase(alamat.split(',')[0].trim().split(/\s+/).slice(0, 2).join(' '));
}

function _titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function _getNamaDokterLogin() {
    if (typeof loggedInUser === 'undefined' || !loggedInUser) return '';
    const jab = (loggedInUser.jabatan || '').toLowerCase();
    // Tampilkan nama dokter hanya jika jabatannya dokter
    if (jab === 'dokter') return loggedInUser.nama || '';
    // Jika bukan dokter, coba cari dokter pertama dari _dokterAktif
    const dok = (window._dokterAktif || []).find(d => d.nama);
    return dok ? dok.nama : (loggedInUser.nama || '');
}

// ════════════════════════════════════════════════════════
//  RENDER — ganti variabel dalam teks template
// ════════════════════════════════════════════════════════

/**
 * Render teks template dengan data aktual pasien.
 * @param {string} tpl   - Teks template dengan placeholder {{...}}
 * @param {object} data  - { nama, nik, umur, jk, tujuan, diagnosa, terapi }
 * @returns {string}     - HTML siap render
 */
function _renderTemplate(tpl, data) {
    const klinik = _getInfoKlinik();
    const tgl    = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const kota   = klinik.kota || 'Pekanbaru';

    const map = {
        '{{nama}}':          data.nama          || '—',
        '{{nik}}':           data.nik           || '-',
        '{{umur}}':          data.umur          || '-',
        '{{jk}}':            data.jk            || '-',
        '{{tgl}}':           tgl,
        '{{kota}}':          kota,
        '{{klinik_nama}}':   klinik.klinik_nama,
        '{{klinik_alamat}}': klinik.klinik_alamat,
        '{{klinik_telp}}':   klinik.klinik_telp,
        '{{nama_dokter}}':   _getNamaDokterLogin(),
        '{{tujuan}}':        data.tujuan        || '',
        '{{diagnosa}}':      data.diagnosa      || '-',
        '{{terapi}}':        data.terapi        || '-',
    };

    let result = tpl;
    Object.entries(map).forEach(([k, v]) => {
        result = result.split(k).join(v);
    });
    // Konversi newline ke <br> untuk HTML
    return result.replace(/\n/g, '<br>');
}

// ════════════════════════════════════════════════════════
//  RENDER SURAT — Dipanggil oleh openModalSuratDinamis()
//  Menggantikan template hardcode di medis-dinamis.js
// ════════════════════════════════════════════════════════

/**
 * Hasilkan HTML lengkap isi surat untuk modalId tertentu.
 * Dipanggil dari openModalSuratDinamis() di medis-dinamis.js.
 *
 * @param {string} namaSurat - Nama surat, misalnya "Surat Keterangan Sehat"
 * @param {object} pasienData - { nama, nik, umur, jk, diagnosa, terapi }
 * @returns {string} HTML surat
 */
function renderSuratHTML(namaSurat, pasienData) {
    const tpl      = window._suratTemplates[namaSurat] || {};
    const klinik   = _getInfoKlinik();
    const tgl      = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const kota     = tpl.kota || klinik.kota || 'Pekanbaru';
    const dokter   = tpl.nama_dokter || _getNamaDokterLogin() || '________________';

    const data = {
        ...pasienData,
        tujuan:   namaSurat.toLowerCase(),
        diagnosa: pasienData.diagnosa || '',
        terapi:   pasienData.terapi   || '',
    };

    // ── Header klinik ──
    const showKlinikHeader = tpl.show_klinik !== false;
    const headerKlinik = showKlinikHeader ? `
        <div style="text-align:center;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:700;color:#1e293b;">${klinik.klinik_nama}</div>
            ${klinik.klinik_alamat
                ? `<div style="font-size:10px;color:#64748b;">${klinik.klinik_alamat}</div>` : ''}
            ${klinik.klinik_telp
                ? `<div style="font-size:10px;color:#64748b;">Telp: ${klinik.klinik_telp}</div>` : ''}
        </div>` : '';

    // ── Judul surat ──
    const judulSurat = tpl.judul || namaSurat.toUpperCase();

    // ── Nomor surat ──
    const nomorSurat = tpl.nomor
        ? `<div style="text-align:center;font-size:11px;color:#64748b;margin-bottom:10px;">
               Nomor: ${_renderTemplate(tpl.nomor, data)}
           </div>` : '';

    // ── Identitas pasien — bisa dikustomisasi baris-per-baris ──
    const fieldIdentitas = tpl.field_identitas || ['nama', 'nik', 'umur'];
    const labelMap = { nama: 'Nama', nik: 'NIK', umur: 'Umur', jk: 'Jenis Kelamin',
                       diagnosa: 'Diagnosa', terapi: 'Terapi' };
    const identitasRows = fieldIdentitas.map(f => `
        <tr>
            <td style="width:130px;padding:3px 0;vertical-align:top;">${labelMap[f] || f}</td>
            <td style="padding:3px 0;vertical-align:top;">: <strong>${data[f] || '-'}</strong></td>
        </tr>`).join('');

    // ── Paragraf pembuka ──
    const pembuka = tpl.pembuka !== undefined ? tpl.pembuka : _TEMPLATE_DEFAULT_PEMBUKA;

    // ── Paragraf penutup ──
    const penutup = tpl.penutup !== undefined ? tpl.penutup : _TEMPLATE_DEFAULT_PENUTUP;

    // ── TTD ──
    const showTtd = tpl.show_ttd !== false;
    const ttdHtml = showTtd ? `
        <div style="text-align:right;margin-top:30px;">
            <div style="font-size:12px;">${kota}, ${tgl}</div>
            <div style="font-size:12px;margin-top:4px;">${tpl.label_ttd || 'Dokter Pemeriksa,'}</div>
            <div style="margin-top:52px;font-size:13px;font-weight:700;border-top:1px solid #1e293b;
                display:inline-block;min-width:160px;text-align:center;padding-top:4px;">
                ${dokter || '( ________________ )'}
            </div>
            ${tpl.nip_dokter ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">NIP/SIP: ${tpl.nip_dokter}</div>` : ''}
        </div>` : '';

    // ── Catatan tambahan ──
    const catatan = tpl.catatan
        ? `<div style="margin-top:14px;padding:8px 12px;background:#f8fafc;border-left:3px solid #6366f1;
               font-size:11px;color:#475569;border-radius:0 6px 6px 0;">
               ${_renderTemplate(tpl.catatan, data)}
           </div>` : '';

    return `
    <div style="font-family:Georgia,serif;padding:20px 24px;line-height:1.7;color:#1e293b;">
        ${headerKlinik}
        <div style="border-bottom:2px solid #1e293b;padding-bottom:10px;margin-bottom:14px;">
            <div style="text-align:center;font-size:15px;font-weight:700;
                text-transform:uppercase;letter-spacing:1px;">${judulSurat}</div>
        </div>
        ${nomorSurat}
        ${pembuka ? `<p style="margin-bottom:10px;">${_renderTemplate(pembuka, data)}</p>` : ''}
        <table style="width:100%;font-size:13px;margin-bottom:14px;border-collapse:collapse;">
            ${identitasRows}
        </table>
        ${penutup ? `<p style="margin-bottom:8px;">${_renderTemplate(penutup, data)}</p>` : ''}
        ${catatan}
        ${ttdHtml}
    </div>`;
}

// ════════════════════════════════════════════════════════
//  OVERRIDE openModalSuratDinamis dari medis-dinamis.js
//  Ganti implementasi hardcode dengan engine template ini.
// ════════════════════════════════════════════════════════

window.openModalSuratDinamis = function(modalId, namaSurat) {
    const modal  = document.getElementById(modalId);
    const bodyEl = document.getElementById('body_' + modalId);
    if (!modal || !bodyEl) return;

    // Ambil data pasien aktif
    const namaEl = document.getElementById('infoPasienNama');
    const nikEl  = document.getElementById('infoPasienNik');
    const umurEl = document.getElementById('infoPasienUmur');

    const nama = (namaEl ? namaEl.innerText : localStorage.getItem('cP_nama') || '—')
        .replace('—','').trim() || '—';
    const nik  = (nikEl  ? nikEl.innerText  : 'NIK: —').replace(/NIK\s*:/i,'').trim();
    const umur = (umurEl ? umurEl.innerText : 'Umur: —').replace(/Umur\s*:/i,'').trim();

    // Ambil diagnosa & terapi dari form aktif jika ada
    const diagEl   = document.getElementById('diagnosa');
    const terapiEl = document.getElementById('terapi');
    const diagnosa = diagEl   ? (diagEl.value   || '') : '';
    const terapi   = terapiEl ? (terapiEl.value || '') : '';

    const pasienData = { nama, nik, umur, diagnosa, terapi };

    bodyEl.innerHTML = renderSuratHTML(namaSurat, pasienData);
    modal.style.display = 'flex';
};

// ════════════════════════════════════════════════════════
//  LOAD TEMPLATES dari _settingsFull (diisi oleh app.js)
// ════════════════════════════════════════════════════════

function loadSuratTemplates() {
    const s = window._settingsFull || {};
    if (!s.surat_templates) return;
    try {
        window._suratTemplates = JSON.parse(s.surat_templates);
    } catch(e) {
        window._suratTemplates = {};
    }
}

// Auto-load saat _settingsFull tersedia
(function _waitSettingsFull() {
    if (window._settingsFull) { loadSuratTemplates(); return; }
    let tries = 0;
    const t = setInterval(() => {
        tries++;
        if (window._settingsFull || tries > 60) {
            clearInterval(t);
            loadSuratTemplates();
        }
    }, 300);
})();

// ════════════════════════════════════════════════════════
//  UI SETTINGS — Editor template surat
//  Dipanggil dari settings.js seksi "Template Surat"
// ════════════════════════════════════════════════════════

/** Kembalikan HTML untuk seksi Template Surat di Settings */
function _htmlSuratTemplateSection() {
    return `
    <div id="suratTemplateWrap">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;line-height:1.6;">
            Atur isi setiap surat keterangan yang bisa dicetak dari halaman pemeriksaan.<br>
            Gunakan variabel berikut: ${SURAT_VARS.map(v =>
                `<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:10px;">${v.key}</code>`
            ).join(' ')}
        </div>

        <!-- Daftar surat yang tersedia dari tarif Administrasi -->
        <div id="suratTemplateList">
            <div style="font-size:12px;color:var(--text-muted);">⏳ Memuat daftar surat...</div>
        </div>
    </div>`;
}

/** Render daftar editor per nama surat (dipanggil setelah _tarifCache tersedia) */
function _renderSuratTemplateList() {
    const container = document.getElementById('suratTemplateList');
    if (!container) return;

    // Kumpulkan semua nama surat dari tarif Administrasi + hardcode
    const tarifAdm = (window._tarifCache || [])
        .filter(t => t.aktif && t.kategori === 'Administrasi')
        .map(t => t.nama);
    const hardcode = ['Surat Keterangan Sakit'];
    const semuaSurat = [...new Set([...hardcode, ...tarifAdm])];

    if (semuaSurat.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:12px 0;">
            Belum ada item Administrasi aktif di halaman Tarif & Biaya.</div>`;
        return;
    }

    container.innerHTML = semuaSurat.map((nama, idx) => {
        const tpl  = window._suratTemplates[nama] || {};
        const slug = 'st_' + idx;
        return `
        <div style="border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:14px;margin-bottom:12px;background:#fafafa;">
            <!-- Header accordion per surat -->
            <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:0;"
                 onclick="_toggleSuratEditor('editor_${slug}')">
                <div style="font-size:13px;font-weight:700;color:var(--primary-dark);">📄 ${nama}</div>
                <span style="font-size:11px;color:var(--text-muted);" id="arrow_${slug}">▼</span>
            </div>

            <!-- Body editor -->
            <div id="editor_${slug}" style="display:none;margin-top:12px;">

                <!-- Kota & identitas klinik di TTD -->
                <div class="row g-2 mb-2">
                    <div class="col-6">
                        <label class="cfg-label">Kota (di TTD)</label>
                        <input type="text" class="form-control" id="${slug}_kota"
                            value="${_esc(tpl.kota || '')}"
                            placeholder="Pekanbaru"
                            style="font-size:12px;">
                    </div>
                    <div class="col-6">
                        <label class="cfg-label">Nama Dokter TTD</label>
                        <input type="text" class="form-control" id="${slug}_nama_dokter"
                            value="${_esc(tpl.nama_dokter || '')}"
                            placeholder="Otomatis dari login"
                            style="font-size:12px;">
                    </div>
                </div>

                <!-- Judul surat -->
                <div class="mb-2">
                    <label class="cfg-label">Judul Surat</label>
                    <input type="text" class="form-control" id="${slug}_judul"
                        value="${_esc(tpl.judul || '')}"
                        placeholder="${nama.toUpperCase()}"
                        style="font-size:12px;">
                </div>

                <!-- Nomor surat -->
                <div class="mb-2">
                    <label class="cfg-label">Nomor Surat <span style="font-weight:400;color:var(--text-muted);">(kosongkan jika tidak perlu)</span></label>
                    <input type="text" class="form-control" id="${slug}_nomor"
                        value="${_esc(tpl.nomor || '')}"
                        placeholder="Contoh: 445/{{tgl}}/SKS/{{klinik_nama}}"
                        style="font-size:12px;">
                </div>

                <!-- Field identitas yang ditampilkan -->
                <div class="mb-2">
                    <label class="cfg-label">Field Identitas Pasien</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
                        ${['nama','nik','umur','jk','diagnosa','terapi'].map(f => `
                        <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;">
                            <input type="checkbox" id="${slug}_fi_${f}"
                                ${(tpl.field_identitas || ['nama','nik','umur']).includes(f) ? 'checked' : ''}
                                style="accent-color:var(--primary);">
                            ${f.charAt(0).toUpperCase() + f.slice(1)}
                        </label>`).join('')}
                    </div>
                </div>

                <!-- Paragraf pembuka -->
                <div class="mb-2">
                    <label class="cfg-label">Paragraf Pembuka</label>
                    <textarea class="form-control" id="${slug}_pembuka" rows="2"
                        placeholder="${_TEMPLATE_DEFAULT_PEMBUKA}"
                        style="font-size:12px;resize:vertical;">${_esc(tpl.pembuka !== undefined ? tpl.pembuka : _TEMPLATE_DEFAULT_PEMBUKA)}</textarea>
                </div>

                <!-- Paragraf penutup -->
                <div class="mb-2">
                    <label class="cfg-label">Paragraf Penutup</label>
                    <textarea class="form-control" id="${slug}_penutup" rows="3"
                        placeholder="${_TEMPLATE_DEFAULT_PENUTUP}"
                        style="font-size:12px;resize:vertical;">${_esc(tpl.penutup !== undefined ? tpl.penutup : _TEMPLATE_DEFAULT_PENUTUP)}</textarea>
                </div>

                <!-- Catatan tambahan -->
                <div class="mb-2">
                    <label class="cfg-label">Catatan Tambahan <span style="font-weight:400;color:var(--text-muted);">(kosongkan jika tidak perlu)</span></label>
                    <textarea class="form-control" id="${slug}_catatan" rows="2"
                        placeholder="Contoh: Berlaku selama 3 hari sejak tanggal {{tgl}}"
                        style="font-size:12px;resize:vertical;">${_esc(tpl.catatan || '')}</textarea>
                </div>

                <!-- Opsi tampilan -->
                <div class="mb-2" style="display:flex;flex-wrap:wrap;gap:14px;">
                    <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="checkbox" id="${slug}_show_klinik"
                            ${tpl.show_klinik !== false ? 'checked' : ''}
                            style="accent-color:var(--primary);">
                        Tampilkan nama &amp; alamat klinik
                    </label>
                    <label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="checkbox" id="${slug}_show_ttd"
                            ${tpl.show_ttd !== false ? 'checked' : ''}
                            style="accent-color:var(--primary);">
                        Tampilkan area tanda tangan
                    </label>
                </div>

                <!-- Label TTD -->
                <div class="mb-2">
                    <label class="cfg-label">Label di atas TTD</label>
                    <input type="text" class="form-control" id="${slug}_label_ttd"
                        value="${_esc(tpl.label_ttd || '')}"
                        placeholder="Dokter Pemeriksa,"
                        style="font-size:12px;">
                </div>

                <!-- Preview -->
                <div style="margin-top:10px;margin-bottom:10px;display:flex;gap:8px;">
                    <button onclick="_previewSuratTemplate('${slug}','${_esc(nama)}')"
                        style="flex:1;padding:8px;background:rgba(99,102,241,0.1);color:var(--primary-dark);
                               border:1px solid rgba(99,102,241,0.3);border-radius:8px;font-size:11px;
                               font-weight:700;cursor:pointer;">
                        👁️ Preview Surat
                    </button>
                    <button onclick="_simpanSuratTemplate('${slug}','${_esc(nama)}')"
                        style="flex:2;padding:8px;background:var(--primary);color:#fff;border:none;
                               border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">
                        💾 Simpan Template
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _toggleSuratEditor(editorId) {
    const el = document.getElementById(editorId);
    const idx = editorId.replace('editor_','');
    const arrow = document.getElementById('arrow_' + idx);
    if (!el) return;
    const open = el.style.display === 'none' || el.style.display === '';
    el.style.display = open ? 'block' : 'none';
    if (arrow) arrow.textContent = open ? '▲' : '▼';
}

/** Kumpulkan nilai form editor untuk satu surat */
function _collectTemplateForm(slug) {
    const fi = ['nama','nik','umur','jk','diagnosa','terapi']
        .filter(f => {
            const el = document.getElementById(`${slug}_fi_${f}`);
            return el && el.checked;
        });

    return {
        kota:           (document.getElementById(`${slug}_kota`)        || {}).value || '',
        nama_dokter:    (document.getElementById(`${slug}_nama_dokter`) || {}).value || '',
        judul:          (document.getElementById(`${slug}_judul`)       || {}).value || '',
        nomor:          (document.getElementById(`${slug}_nomor`)       || {}).value || '',
        pembuka:        (document.getElementById(`${slug}_pembuka`)     || {}).value || '',
        penutup:        (document.getElementById(`${slug}_penutup`)     || {}).value || '',
        catatan:        (document.getElementById(`${slug}_catatan`)     || {}).value || '',
        label_ttd:      (document.getElementById(`${slug}_label_ttd`)  || {}).value || '',
        field_identitas: fi,
        show_klinik:    !!(document.getElementById(`${slug}_show_klinik`) || {}).checked,
        show_ttd:       !!(document.getElementById(`${slug}_show_ttd`)    || {}).checked,
    };
}

/** Preview surat dalam overlay sementara */
function _previewSuratTemplate(slug, namaSurat) {
    const tpl = _collectTemplateForm(slug);
    const demoData = {
        nama: 'Budi Santoso', nik: '1234567890123456',
        umur: '35 Thn', jk: 'L',
        diagnosa: 'Z00.0 — Pemeriksaan Umum',
        terapi: 'Vitamin C 3x1 tablet'
    };

    // Simpan sementara ke cache untuk dipakai renderSuratHTML
    const backup = window._suratTemplates[namaSurat];
    window._suratTemplates[namaSurat] = tpl;
    const html = renderSuratHTML(namaSurat, demoData);
    window._suratTemplates[namaSurat] = backup;

    // Tampilkan di overlay preview
    let overlay = document.getElementById('_suratPreviewOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = '_suratPreviewOverlay';
        overlay.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);
            display:flex;align-items:center;justify-content:center;padding:16px;`;
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:520px;width:100%;
                        max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="position:sticky;top:0;background:#fff;padding:12px 16px;
                             border-bottom:1px solid #e2e8f0;display:flex;align-items:center;
                             justify-content:space-between;border-radius:16px 16px 0 0;">
                    <div style="font-size:13px;font-weight:700;color:var(--primary);">👁️ Preview Surat</div>
                    <button onclick="document.getElementById('_suratPreviewOverlay').remove()"
                        style="background:none;border:none;font-size:18px;cursor:pointer;color:#64748b;">✕</button>
                </div>
                <div id="_suratPreviewBody" style="padding:4px 8px;"></div>
                <div style="padding:12px 16px;border-top:1px solid #e2e8f0;display:flex;gap:8px;">
                    <button onclick="window.print()"
                        style="flex:1;padding:9px;background:#059669;color:#fff;border:none;
                               border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                        🖨️ Cetak
                    </button>
                    <button onclick="document.getElementById('_suratPreviewOverlay').remove()"
                        style="flex:1;padding:9px;background:#e2e8f0;color:#475569;border:none;
                               border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                        Tutup
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }
    document.getElementById('_suratPreviewBody').innerHTML = html;
}

/** Simpan template satu surat ke Supabase */
async function _simpanSuratTemplate(slug, namaSurat) {
    const tpl = _collectTemplateForm(slug);
    window._suratTemplates[namaSurat] = tpl;

    try {
        if (typeof sb_saveSettings === 'function') {
            await sb_saveSettings({ surat_templates: JSON.stringify(window._suratTemplates) });
            // Update _settingsFull agar reload tidak perlu ke server
            if (window._settingsFull) window._settingsFull.surat_templates = JSON.stringify(window._suratTemplates);
            if (typeof showToast === 'function') showToast(`✅ Template "${namaSurat}" disimpan`, 'success');
        } else {
            if (typeof showToast === 'function') showToast('⚠️ sb_saveSettings belum tersedia', 'error');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('❌ Gagal simpan: ' + e.message, 'error');
    }
}

// ════════════════════════════════════════════════════════
//  INTEGRASI SETTINGS.JS
//  Tambahkan seksi "Template Surat" ke halaman Settings
//  dengan cara meng-hook _renderSettingsPage().
// ════════════════════════════════════════════════════════

(function _hookRenderSettingsPage() {
    function _doHook() {
        if (typeof window._renderSettingsPage !== 'function' &&
            typeof window._buildAccordion     !== 'function') return false;

        // Sudah hook sebelumnya?
        if (window._suratTemplateSettingsHooked) return true;
        window._suratTemplateSettingsHooked = true;

        // Hook initSettings agar seksi template muncul setelah render
        const origInitSettings = window.initSettings;
        if (typeof origInitSettings === 'function') {
            window.initSettings = async function() {
                await origInitSettings.apply(this, arguments);
                _injectSuratTemplateSection();
            };
        }

        // Juga hook switchPage agar dipanggil saat masuk pageSettings
        return true;
    }

    if (!_doHook()) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (_doHook() || tries > 80) clearInterval(t);
        }, 150);
    }
})();

/**
 * Sisipkan seksi Template Surat ke halaman Settings setelah render.
 * Menggunakan DOM insertion agar tidak perlu modifikasi settings.js.
 */
function _injectSuratTemplateSection() {
    // Cegah duplikat
    if (document.getElementById('sec_surat_template_wrap')) return;

    const settingsWrap = document.querySelector('.page-settings-wrap');
    if (!settingsWrap) return;

    // Buat container seksi
    const div = document.createElement('div');
    div.id = 'sec_surat_template_wrap';

    // Pakai _buildAccordion jika tersedia, fallback ke HTML manual
    if (typeof _buildAccordion === 'function') {
        div.innerHTML = _buildAccordion(
            'sec_surat_template',
            '📄 Template Surat Keterangan',
            'Atur isi teks, identitas, dan format setiap surat yang bisa dicetak',
            _htmlSuratTemplateSection(),
            'surat_template'
        );
    } else {
        div.innerHTML = `
        <div style="border:1px solid rgba(0,0,0,0.08);border-radius:14px;margin-bottom:12px;overflow:hidden;">
            <div style="padding:14px 16px;background:#f8fafc;cursor:pointer;display:flex;
                        align-items:center;justify-content:space-between;"
                 onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
                <div>
                    <div style="font-size:13px;font-weight:700;">📄 Template Surat Keterangan</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">
                        Atur isi teks, identitas, dan format setiap surat yang bisa dicetak
                    </div>
                </div>
                <span>▼</span>
            </div>
            <div style="display:none;padding:14px 16px;">
                ${_htmlSuratTemplateSection()}
            </div>
        </div>`;
    }

    // Sisipkan sebelum tombol "Simpan Semua"
    const btnSimpanDiv = settingsWrap.querySelector('#btnSimpanSettings')?.closest('div') ||
                         settingsWrap.lastElementChild;
    settingsWrap.insertBefore(div, btnSimpanDiv);

    // Render daftar editor setelah tarif tersedia
    if (typeof window._ensureTarifCacheThen === 'function') {
        window._ensureTarifCacheThen(_renderSuratTemplateList);
    } else {
        setTimeout(_renderSuratTemplateList, 500);
    }
}

// ════════════════════════════════════════════════════════
//  INTEGRASI loadRuntimeSettings (app.js)
//  Pastikan surat_templates diload dari server settings
//  ke window._suratTemplates saat startup.
// ════════════════════════════════════════════════════════

(function _hookLoadRuntimeSettings() {
    function _doHook() {
        if (typeof window.loadRuntimeSettings !== 'function') return false;
        if (window._suratTemplateRTHooked) return true;
        window._suratTemplateRTHooked = true;

        const _orig = window.loadRuntimeSettings;
        window.loadRuntimeSettings = async function() {
            await _orig.apply(this, arguments);
            // _settingsFull sudah diisi oleh loadRuntimeSettings
            loadSuratTemplates();
        };
        return true;
    }

    if (!_doHook()) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (_doHook() || tries > 60) clearInterval(t);
        }, 200);
    }
})();

console.log('[surat-template] ✅ Engine template surat loaded');
