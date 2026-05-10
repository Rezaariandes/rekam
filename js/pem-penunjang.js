// ════════════════════════════════════════════════════════
//  KLIKPRO RME — PEM-PENUNJANG.JS  (v3 — Supabase Storage)
//  Modul: Pemeriksaan Penunjang (EKG, Rontgen, USG, dll.)
//
//  Tanggung jawab file ini:
//    • Mendefinisikan daftar penunjang dari tarif DB
//    • Merender chip button di #sectionPermintaanLab
//    • Setiap chip yang diklik menampilkan panel hasil besar di bawah
//      (textarea min-height 96px + upload foto ke Supabase Storage)
//    • Menyimpan state ke window._reqLab, _reqLabHasil, _reqLabFoto
//    • Menyediakan _getPenunjangList() untuk dipakai modul lain
//
//  ┌──────────────────────────────────────────────────────┐
//  │  PRASYARAT Supabase Storage (buat sekali):           │
//  │  Storage → New bucket                                │
//  │    Nama   : penunjang-foto                           │
//  │    Public : ✅                                        │
//  │  Policies → INSERT allowed for anon/authenticated    │
//  └──────────────────────────────────────────────────────┘
//
//  Data bersumber dari: window._tarifCache (Page Biaya)
//  Bergantung pada: supabase-secure.js (_SB_URL, _SB_KEY)
// ════════════════════════════════════════════════════════

// ── State ──
window._reqLab      = window._reqLab      || {};
window._reqLabHasil = window._reqLabHasil || {};
window._reqLabFoto  = window._reqLabFoto  || {};   // { [id]: ['https://…', …] }

// ── Nama bucket Supabase Storage ──
const _PNJ_BUCKET = 'penunjang-foto';

// ════════════════════════════════════════════════════════
//  SUPABASE STORAGE HELPERS
// ════════════════════════════════════════════════════════

async function _sbStorageUploadFoto(file, penunjangId) {
    const ext      = file.name.split('.').pop().toLowerCase() || 'jpg';
    const ts       = Date.now();
    const rand     = Math.random().toString(36).slice(2, 7);
    const filePath = `${penunjangId}/${ts}_${rand}.${ext}`;

    const res = await fetch(
        `${_SB_URL}/storage/v1/object/${_PNJ_BUCKET}/${filePath}`,
        {
            method: 'POST',
            headers: {
                'apikey':        _SB_KEY,
                'Authorization': 'Bearer ' + _SB_KEY,
                'Content-Type':  file.type || 'image/jpeg',
                'x-upsert':      'true'
            },
            body: file
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Storage upload gagal (HTTP ' + res.status + ')');
    }
    return `${_SB_URL}/storage/v1/object/public/${_PNJ_BUCKET}/${filePath}`;
}

async function _sbStorageDeleteFoto(publicUrl) {
    try {
        const marker   = `/object/public/${_PNJ_BUCKET}/`;
        const filePath = publicUrl.includes(marker) ? publicUrl.split(marker)[1] : null;
        if (!filePath) return;
        await fetch(`${_SB_URL}/storage/v1/object/${_PNJ_BUCKET}/${filePath}`, {
            method: 'DELETE',
            headers: { 'apikey': _SB_KEY, 'Authorization': 'Bearer ' + _SB_KEY }
        });
    } catch(e) { console.warn('[pem-penunjang] Gagal hapus Storage:', e.message); }
}

// ════════════════════════════════════════════════════════
//  CSS — inject sekali ke <head>
// ════════════════════════════════════════════════════════
(function _injectPenunjangCSS() {
    if (document.getElementById('_css_penunjang_panel')) return;
    const s = document.createElement('style');
    s.id = '_css_penunjang_panel';
    s.textContent = `
    @keyframes _pnj_fadeIn {
        from { opacity:0; transform:translateY(-6px); }
        to   { opacity:1; transform:translateY(0); }
    }
    .pnj-panel {
        animation: _pnj_fadeIn .22s ease forwards;
        background: #f0f7ff;
        border: 1.5px solid var(--primary,#2563eb);
        border-radius: 12px;
        padding: 10px 12px 12px;
        margin-top: 8px;
        position: relative;
    }
    .pnj-panel-label {
        font-size: 11px; font-weight: 700;
        color: var(--primary,#2563eb);
        margin-bottom: 6px;
        display: flex; align-items: center; gap: 5px;
    }
    .pnj-textarea {
        width: 100%; min-height: 96px; resize: vertical;
        font-size: 12px; line-height: 1.55;
        padding: 9px 44px 9px 10px;
        border: 1.5px solid #c7d9f5; border-radius: 8px;
        background: #fff; color: #1e3a8a; outline: none;
        box-sizing: border-box; font-family: inherit;
        transition: border-color .15s;
    }
    .pnj-textarea:focus {
        border-color: var(--primary,#2563eb);
        box-shadow: 0 0 0 3px rgba(37,99,235,.1);
    }
    .pnj-stt-btn {
        position: absolute; top: 38px; right: 18px;
        width: 30px; height: 30px; border-radius: 50%;
        border: 1.5px solid #c7d9f5; background: #fff;
        cursor: pointer; font-size: 15px; padding: 0;
        display: flex; align-items: center; justify-content: center;
        transition: all .15s; z-index: 2;
    }
    .pnj-stt-btn:hover { background:#e0eaff; border-color:var(--primary,#2563eb); }
    .pnj-stt-btn.recording { background:#fee2e2; border-color:#ef4444; animation:_pnj_pulse 1s infinite; }
    @keyframes _pnj_pulse {
        0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.4); }
        50%      { box-shadow:0 0 0 6px rgba(239,68,68,0); }
    }
    .pnj-foto-label { font-size:10px; font-weight:600; color:#64748b; margin:10px 0 6px; display:flex; align-items:center; gap:4px; }
    .pnj-foto-area  { display:flex; flex-wrap:wrap; gap:7px; align-items:flex-start; }
    .pnj-foto-add {
        width:58px; height:58px; border:2px dashed #c7d9f5; border-radius:9px;
        background:#f8fbff; cursor:pointer;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        font-size:20px; color:#93afd4; user-select:none;
        transition:border-color .15s, background .15s, color .15s; flex-shrink:0;
    }
    .pnj-foto-add:hover { border-color:var(--primary,#2563eb); background:#e8f0fe; color:var(--primary,#2563eb); }
    .pnj-foto-add.uploading { pointer-events:none; opacity:.6; }
    .pnj-spinner { width:20px; height:20px; border:2.5px solid #c7d9f5; border-top-color:var(--primary,#2563eb); border-radius:50%; animation:_pnj_spin .7s linear infinite; }
    @keyframes _pnj_spin { to { transform:rotate(360deg); } }
    .pnj-foto-thumb { position:relative; width:58px; height:58px; border-radius:9px; overflow:hidden; border:1.5px solid #c7d9f5; flex-shrink:0; cursor:pointer; transition:border-color .15s; }
    .pnj-foto-thumb:hover { border-color:var(--primary,#2563eb); }
    .pnj-foto-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
    .pnj-foto-del { position:absolute; top:2px; right:2px; width:17px; height:17px; border-radius:50%; background:rgba(220,38,38,.88); color:#fff; font-size:10px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900; padding:0; z-index:3; }
    .pnj-foto-del:hover { background:#b91c1c; }
    `;
    document.head.appendChild(s);
})();

// ── Icon map penunjang ──
const _PENUNJANG_ICONS = {
    'EKG'                    : '🫀',
    'EKG / Elektrokardiogram': '🫀',
    'Rontgen Thorax'         : '🦴',
    'Rontgen'                : '🦴',
    'USG Abdomen'            : '📡',
    'USG'                    : '📡',
    'Spirometri'             : '🌬️',
    'Otoscopy'               : '🔬',
    'Otoskop'                : '🔬',
};

// ════════════════════════════════════════════════════════
//  HELPERS BERSAMA (dipakai juga oleh pem-labor.js & tin-medis.js)
// ════════════════════════════════════════════════════════

function _slugTarifId(prefix, nama) {
    return prefix + '_' + nama.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function _iconForNama(nama, map, def) {
    for (const [k, v] of Object.entries(map)) {
        if (nama.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return def;
}

// ════════════════════════════════════════════════════════
//  DAFTAR PENUNJANG — dinamis dari tarif DB
// ════════════════════════════════════════════════════════

function _getPenunjangList() {
    const cache     = window._tarifCache || [];
    const fromTarif = cache.filter(t => t.aktif && t.kategori === 'Penunjang');

    return fromTarif.map(t => ({
        id        : _slugTarifId('penunjang', t.nama),
        label     : t.nama,
        icon      : _iconForNama(t.nama, _PENUNJANG_ICONS, '🔭'),
        _tarifNama: t.nama
    }));
}

Object.defineProperty(window, 'PENUNJANG_LIST', { get: _getPenunjangList, configurable: true });

// ════════════════════════════════════════════════════════
//  RENDER UTAMA
// ════════════════════════════════════════════════════════

function renderSectionPermintaanLab() {
    const container = document.getElementById('sectionPermintaanLab');
    if (!container) return;

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

// ────────────────────────────────────────────────────────
//  Layout:
//   [chip A] [chip B ✓] [chip C]   ← baris chip tetap
//  ┌──────────────────────────────────────────────────┐
//  │ ✏️ Hasil 📡 USG Abdomen                          │
//  │ [___textarea lebar penuh___________________] 🎙️  │
//  │ 📎 Foto  [📷+] [thumb1 ✕] [thumb2 ✕]            │
//  └──────────────────────────────────────────────────┘
// ────────────────────────────────────────────────────────
function _renderPenunjangChips(container) {
    const penunjangList = _getPenunjangList();

    if (penunjangList.length === 0) {
        container.innerHTML = '';
        container.style.cssText = 'border-top:none;padding-top:0;margin-top:0;';
        return;
    }

    container.style.cssText = 'border-top:1px dashed var(--border);padding-top:14px;margin-top:4px;';

    const chipsHtml = penunjangList.map(p => {
        const active = !!window._reqLab[p.id];
        return `<button
            id="chip_${p.id}"
            onclick="_togglePenunjang('${p.id}')"
            style="
                display:inline-flex;align-items:center;gap:5px;
                padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;
                cursor:pointer;margin:3px 3px 0 0;
                border:1.5px solid ${active ? 'var(--primary,#2563eb)' : '#e2e8f0'};
                background:${active ? 'var(--primary,#2563eb)' : '#fff'};
                color:${active ? '#fff' : 'var(--text,#334155)'};
                transition:all .15s;
            ">${p.icon} ${p.label}</button>`;
    }).join('');

    container.innerHTML = `
        <div class="rm-subsection-label" style="margin-bottom:8px;">
            <span class="rm-subsection-dot" style="background:#0891b2;width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block;margin-right:6px;"></span>
            <span style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Pemeriksaan Penunjang</span>
        </div>
        <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:10px;">
            Pilih pemeriksaan lalu isi hasil &amp; foto. Item terpilih akan masuk ke tagihan otomatis.
        </div>
        <div id="_pnj_chips_row" style="display:flex;flex-wrap:wrap;margin-bottom:4px;">
            ${chipsHtml}
        </div>
        <div id="_pnj_panels_area"></div>
    `;

    _renderSemuaPanel();
}

function _renderSemuaPanel() {
    const area = document.getElementById('_pnj_panels_area');
    if (!area) return;
    area.innerHTML = '';
    _getPenunjangList().forEach(p => {
        if (!window._reqLab[p.id]) return;
        area.appendChild(_buatPanel(p));
    });
}

function _buatPanel(p) {
    const hasilVal = (window._reqLabHasil || {})[p.id] || '';
    const fotoUrls = (window._reqLabFoto  || {})[p.id] || [];

    const panel = document.createElement('div');
    panel.className = 'pnj-panel';
    panel.id        = `_pnj_panel_${p.id}`;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'pnj-panel-label';
    labelDiv.innerHTML = `✏️ Hasil&nbsp;${p.icon}&nbsp;<strong>${p.label}</strong>`;
    panel.appendChild(labelDiv);

    const taWrapper = document.createElement('div');
    taWrapper.style.position = 'relative';

    const ta = document.createElement('textarea');
    ta.className   = 'pnj-textarea';
    ta.id          = `hasil_${p.id}`;
    ta.placeholder = `Tulis hasil atau interpretasi ${p.label} di sini…`;
    ta.value       = hasilVal;
    ta.addEventListener('input', () => _simpanHasilPenunjang(p.id, ta.value));
    taWrapper.appendChild(ta);

    const sttBtn = document.createElement('button');
    sttBtn.type      = 'button';
    sttBtn.className = 'pnj-stt-btn';
    sttBtn.title     = 'Ucapkan hasil (Speech-to-Text)';
    sttBtn.innerHTML = '🎙️';
    sttBtn.addEventListener('click', () => _startSTTPenunjang(p.id, sttBtn));
    taWrapper.appendChild(sttBtn);
    panel.appendChild(taWrapper);

    const fotoLbl = document.createElement('div');
    fotoLbl.className = 'pnj-foto-label';
    fotoLbl.innerHTML = '📎 Foto hasil pemeriksaan <span style="font-weight:400;color:#94a3b8;">(opsional · maks 5 MB/foto)</span>';
    panel.appendChild(fotoLbl);

    const fotoArea = document.createElement('div');
    fotoArea.className = 'pnj-foto-area';
    fotoArea.id        = `_pnj_foto_area_${p.id}`;
    fotoArea.appendChild(_buatAddBtn(p.id, fotoArea));
    fotoUrls.forEach(url => _tambahThumb(fotoArea, p.id, url));
    panel.appendChild(fotoArea);

    requestAnimationFrame(() => ta.focus());
    return panel;
}

// ════════════════════════════════════════════════════════
//  TOGGLE CHIP
// ════════════════════════════════════════════════════════
function _togglePenunjang(id) {
    window._reqLab[id] = !window._reqLab[id];

    const chipBtn = document.getElementById('chip_' + id);
    if (chipBtn) {
        const active = window._reqLab[id];
        chipBtn.style.background  = active ? 'var(--primary,#2563eb)' : '#fff';
        chipBtn.style.borderColor = active ? 'var(--primary,#2563eb)' : '#e2e8f0';
        chipBtn.style.color       = active ? '#fff' : 'var(--text,#334155)';
    }

    const area = document.getElementById('_pnj_panels_area');
    if (!area) return;

    if (window._reqLab[id]) {
        const p = _getPenunjangList().find(x => x.id === id);
        if (p) area.appendChild(_buatPanel(p));
    } else {
        const panel = document.getElementById('_pnj_panel_' + id);
        if (panel) {
            panel.style.transition = 'opacity .18s, transform .18s';
            panel.style.opacity    = '0';
            panel.style.transform  = 'translateY(-6px)';
            setTimeout(() => panel.remove(), 185);
        }
        if (window._reqLabHasil) delete window._reqLabHasil[id];
        if (window._reqLabFoto)  delete window._reqLabFoto[id];
    }
}

// ════════════════════════════════════════════════════════
//  SIMPAN TEKS HASIL
// ════════════════════════════════════════════════════════
function _simpanHasilPenunjang(id, val) {
    if (!window._reqLabHasil) window._reqLabHasil = {};
    window._reqLabHasil[id] = val;
}

// ════════════════════════════════════════════════════════
//  SPEECH-TO-TEXT
// ════════════════════════════════════════════════════════
function _startSTTPenunjang(id, btn) {
    const ta = document.getElementById('hasil_' + id);
    if (!ta) return;
    const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SRClass) {
        if (typeof showToast === 'function') showToast('❌ Mikrofon tidak didukung browser ini', 'error');
        return;
    }
    const rec = new SRClass();
    rec.lang = 'id-ID'; rec.continuous = false; rec.interimResults = false;
    btn.classList.add('recording');
    if (typeof showToast === 'function') showToast('🎙️ Mendengarkan…', 'info');
    rec.start();
    rec.onresult = (e) => {
        ta.value += (ta.value ? ' ' : '') + e.results[0][0].transcript;
        _simpanHasilPenunjang(id, ta.value);
        if (typeof showToast === 'function') showToast('✅ Teks ditambahkan', 'success');
        btn.classList.remove('recording');
    };
    rec.onerror = (e) => {
        if (typeof showToast === 'function') showToast('❌ Gagal: ' + e.error, 'error');
        btn.classList.remove('recording');
    };
    rec.onend = () => btn.classList.remove('recording');
}

// ════════════════════════════════════════════════════════
//  UPLOAD FOTO → SUPABASE STORAGE
// ════════════════════════════════════════════════════════

function _buatAddBtn(penunjangId, fotoArea) {
    const addBtn = document.createElement('div');
    addBtn.className = 'pnj-foto-add';
    addBtn.title     = 'Tambah foto hasil (maks 5 MB/foto)';

    function _reset() {
        addBtn.innerHTML = '<span style="font-size:22px">📷</span><span style="font-size:9px;margin-top:2px">Foto</span>';
        addBtn.classList.remove('uploading');
    }
    _reset();

    addBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
        input.addEventListener('change', async () => {
            const files = Array.from(input.files);
            if (!files.length) return;
            files.filter(f => f.size > 5 * 1024 * 1024).forEach(f => {
                if (typeof showToast === 'function') showToast(`❌ "${f.name}" melebihi 5 MB`, 'error');
            });
            const valid = files.filter(f => f.size <= 5 * 1024 * 1024);
            if (!valid.length) return;

            addBtn.classList.add('uploading');
            addBtn.innerHTML = '<div class="pnj-spinner"></div>';

            for (const file of valid) {
                try {
                    const url = await _sbStorageUploadFoto(file, penunjangId);
                    if (!window._reqLabFoto)              window._reqLabFoto = {};
                    if (!window._reqLabFoto[penunjangId]) window._reqLabFoto[penunjangId] = [];
                    window._reqLabFoto[penunjangId].push(url);
                    _tambahThumb(fotoArea, penunjangId, url);
                    if (typeof showToast === 'function') showToast('📷 Foto berhasil diupload', 'success');
                } catch(err) {
                    console.error('[pem-penunjang] Upload gagal:', err);
                    if (typeof showToast === 'function') showToast('❌ Upload gagal: ' + err.message, 'error');
                }
            }
            _reset();
        });
        input.click();
    });
    return addBtn;
}

function _tambahThumb(fotoArea, penunjangId, url) {
    const wrap = document.createElement('div');
    wrap.className = 'pnj-foto-thumb';
    wrap.title     = 'Klik untuk buka foto ukuran penuh';
    wrap.addEventListener('click', (e) => {
        if (e.target.classList.contains('pnj-foto-del')) return;
        window.open(url, '_blank', 'noopener');
    });

    const img = document.createElement('img');
    img.src = url; img.alt = 'Foto hasil'; img.loading = 'lazy';
    wrap.appendChild(img);

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'pnj-foto-del';
    del.innerHTML = '✕'; del.title = 'Hapus foto';
    del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window._reqLabFoto?.[penunjangId]) {
            const idx = window._reqLabFoto[penunjangId].indexOf(url);
            if (idx !== -1) window._reqLabFoto[penunjangId].splice(idx, 1);
        }
        _sbStorageDeleteFoto(url);
        wrap.remove();
        if (typeof showToast === 'function') showToast('🗑️ Foto dihapus', 'info');
    });
    wrap.appendChild(del);

    const addBtn = fotoArea.querySelector('.pnj-foto-add');
    if (addBtn) fotoArea.insertBefore(wrap, addBtn);
    else        fotoArea.appendChild(wrap);
}

// ════════════════════════════════════════════════════════
//  RESTORE STATE — dipanggil oleh pem-labor.js
// ════════════════════════════════════════════════════════
function _refreshPenunjangChipUI() {
    const penunjangList = _getPenunjangList();

    // BUG FIX (refresh): Jika _tarifCache belum terisi, chip belum ada di DOM.
    // Jalankan renderSectionPermintaanLab() yang sudah bisa auto-fetch tarif,
    // lalu jadwalkan refresh ulang setelah render selesai.
    if (penunjangList.length === 0 && window._biayaAktif && typeof sb_getTarif === 'function') {
        sb_getTarif().then(tarif => {
            window._tarifCache = tarif || [];
            const container = document.getElementById('sectionPermintaanLab');
            if (container) _renderPenunjangChips(container);
            // Update visual chip setelah render
            _getPenunjangList().forEach(p => {
                const btn = document.getElementById('chip_' + p.id);
                if (!btn) return;
                const active = !!window._reqLab[p.id];
                btn.style.background  = active ? 'var(--primary,#2563eb)' : '#fff';
                btn.style.borderColor = active ? 'var(--primary,#2563eb)' : '#e2e8f0';
                btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
            });
            _renderSemuaPanel();
        }).catch(() => {});
        return;
    }

    // Jika chip sudah ada di DOM, cukup update visual & panel
    const anyChipExists = penunjangList.some(p => !!document.getElementById('chip_' + p.id));
    if (!anyChipExists && penunjangList.length > 0) {
        // Chip belum dirender (misalnya setelah _renderSectionLabDinamic belum sempat jalan)
        const container = document.getElementById('sectionPermintaanLab');
        if (container) _renderPenunjangChips(container);
    }

    penunjangList.forEach(p => {
        const btn = document.getElementById('chip_' + p.id);
        if (!btn) return;
        const active = !!window._reqLab[p.id];
        btn.style.background  = active ? 'var(--primary,#2563eb)' : '#fff';
        btn.style.borderColor = active ? 'var(--primary,#2563eb)' : '#e2e8f0';
        btn.style.color       = active ? '#fff' : 'var(--text,#334155)';
    });
    _renderSemuaPanel();
}

// ════════════════════════════════════════════════════════
//  getReqLabPayload — sertakan URL foto ke JSON
// ════════════════════════════════════════════════════════
(function _wrapGetReqLabPayloadForFoto() {
    function _doWrap() {
        const _orig = window.getReqLabPayload;
        if (typeof _orig !== 'function') { setTimeout(_doWrap, 400); return; }
        window.getReqLabPayload = function() {
            const json = _orig.apply(this, arguments);
            let payload = {};
            try { payload = json ? JSON.parse(json) : {}; } catch(e) {}
            Object.entries(window._reqLabFoto || {}).forEach(([id, urls]) => {
                if (Array.isArray(urls) && urls.length > 0) payload['foto_' + id] = urls;
            });
            return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
        };
    }
    _doWrap();
})();

// ════════════════════════════════════════════════════════
//  loadReqLabFromKunjungan — restore URL foto dari DB
// ════════════════════════════════════════════════════════
(function _wrapLoadReqLabForFoto() {
    function _doWrap() {
        const _orig = window.loadReqLabFromKunjungan;
        if (typeof _orig !== 'function') { setTimeout(_doWrap, 400); return; }
        window.loadReqLabFromKunjungan = function(reqLabJson) {
            window._reqLabFoto = {};
            if (reqLabJson) {
                let parsed = {};
                try { parsed = typeof reqLabJson === 'string' ? JSON.parse(reqLabJson) : reqLabJson; } catch(e) {}
                Object.entries(parsed).forEach(([k, v]) => {
                    if (k.startsWith('foto_penunjang_') && Array.isArray(v) && v.length > 0) {
                        window._reqLabFoto[k.replace(/^foto_/, '')] = v;
                    }
                });
            }
            _orig.apply(this, arguments);
        };
    }
    _doWrap();
})();

// ════════════════════════════════════════════════════════
//  AUTO-TAGIHAN — hook ke supabase-biaya.js
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
