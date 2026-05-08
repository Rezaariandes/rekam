// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL DETAIL & EDIT DATA PASIEN
//  Buka profil pasien lengkap + edit langsung tanpa
//  masuk ke pageMedis. Dipanggil dari mana saja.
//
//  API publik:
//    bukaModalPasien(pasienId)        — dari ID pasien
//    bukaModalPasienDariNama(nama)    — dari nama (lookup allPatients)
// ════════════════════════════════════════════════════════

(function _initModalPasienDetail() {

    // ── CSS ──
    if (!document.getElementById('mpd-style')) {
        const s = document.createElement('style');
        s.id = 'mpd-style';
        s.textContent = `
        #mpdOverlay {
            position: fixed; inset: 0; z-index: 8500;
            background: rgba(15,23,42,0.5);
            display: flex; align-items: flex-end; justify-content: center;
            opacity: 0; transition: opacity .22s ease;
            pointer-events: none;
        }
        #mpdOverlay.mpd-show { opacity: 1; pointer-events: auto; }
        #mpdSheet {
            background: #fff; width: 100%; max-width: 520px;
            border-radius: 22px 22px 0 0;
            max-height: 92vh; display: flex; flex-direction: column;
            box-shadow: 0 -8px 40px rgba(0,0,0,0.18);
            transform: translateY(60px);
            transition: transform .28s cubic-bezier(.34,1.56,.64,1);
        }
        #mpdOverlay.mpd-show #mpdSheet { transform: translateY(0); }

        .mpd-handle {
            width:40px; height:4px; background:#e2e8f0;
            border-radius:2px; margin:12px auto 0; flex-shrink:0;
        }
        .mpd-header {
            display:flex; align-items:flex-start;
            justify-content:space-between;
            padding:14px 18px 0; flex-shrink:0;
        }
        .mpd-header-title {
            font-size:15px; font-weight:800; color:#0f172a; line-height:1.3;
        }
        .mpd-header-sub {
            font-size:11px; color:#64748b; margin-top:2px;
        }
        .mpd-close-btn {
            background:rgba(100,116,139,.12); border:none;
            border-radius:50%; width:30px; height:30px;
            font-size:16px; cursor:pointer; flex-shrink:0;
            display:flex; align-items:center; justify-content:center;
            color:#64748b; transition:background .15s;
        }
        .mpd-close-btn:hover { background:rgba(100,116,139,.22); }
        .mpd-tabs {
            display:flex; gap:6px; padding:12px 18px 0; flex-shrink:0;
            border-bottom:1px solid #f1f5f9;
        }
        .mpd-tab {
            padding:7px 14px; border:none; background:none;
            font-size:12px; font-weight:700; cursor:pointer;
            color:#94a3b8; border-bottom:2.5px solid transparent;
            margin-bottom:-1px; font-family:inherit; transition:all .15s;
        }
        .mpd-tab.active { color:var(--primary,#2563eb); border-bottom-color:var(--primary,#2563eb); }
        .mpd-body { overflow-y:auto; flex:1; padding:14px 18px; }
        .mpd-section-label {
            font-size:10px; font-weight:700; text-transform:uppercase;
            letter-spacing:.6px; color:#94a3b8; margin:14px 0 7px;
        }
        .mpd-info-row {
            display:flex; justify-content:space-between;
            align-items:flex-start; padding:8px 0;
            border-bottom:1px solid #f8fafc; font-size:12.5px;
        }
        .mpd-info-label { color:#64748b; flex-shrink:0; min-width:110px; }
        .mpd-info-val { font-weight:600; color:#0f172a; text-align:right; flex:1; }
        .mpd-alergi-badge {
            display:inline-flex; align-items:center; gap:4px;
            background:rgba(180,83,9,.1); color:#b45309;
            border:1px solid rgba(180,83,9,.25); border-radius:8px;
            padding:4px 10px; font-size:11.5px; font-weight:700;
        }
        .mpd-no-alergi {
            color:#94a3b8; font-size:11.5px; font-style:italic;
        }
        .mpd-riwayat-item {
            border:1px solid #f1f5f9; border-radius:12px;
            padding:10px 12px; margin-bottom:8px;
            cursor:pointer; transition:background .15s;
        }
        .mpd-riwayat-item:hover { background:#f8fafc; }
        .mpd-riwayat-tgl { font-size:11.5px; font-weight:700; color:var(--primary,#2563eb); }
        .mpd-riwayat-diag { font-size:12px; font-weight:600; color:#0f172a; margin-top:2px; }
        .mpd-riwayat-kel { font-size:11px; color:#64748b; margin-top:1px; }
        .mpd-riwayat-ttv {
            font-size:10.5px; color:#94a3b8;
            background:#f8fafc; border-radius:7px;
            padding:3px 8px; margin-top:4px; display:inline-block;
        }
        .mpd-stat-grid {
            display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
            margin-bottom:10px;
        }
        .mpd-stat-tile {
            background:#f8fafc; border:1px solid #f1f5f9;
            border-radius:12px; padding:10px 8px; text-align:center;
        }
        .mpd-stat-val { font-size:18px; font-weight:900; color:var(--primary,#2563eb); }
        .mpd-stat-lbl { font-size:10px; color:#94a3b8; margin-top:2px; }
        .mpd-footer {
            padding:10px 18px calc(10px + env(safe-area-inset-bottom,0px));
            border-top:1px solid #f1f5f9; display:flex; gap:8px; flex-shrink:0;
        }
        .mpd-btn {
            flex:1; padding:12px 8px; border:none; border-radius:12px;
            font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
            transition:opacity .15s, transform .1s;
        }
        .mpd-btn:active { opacity:.85; transform:scale(.98); }
        .mpd-btn-primary { background:linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; }
        .mpd-btn-success { background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
        .mpd-btn-cancel  { background:#f1f5f9; color:#64748b; font-weight:600; }
        .mpd-form-label {
            font-size:10px; font-weight:700; text-transform:uppercase;
            letter-spacing:.4px; color:#94a3b8; margin-bottom:3px; display:block;
        }
        .mpd-saving { opacity:.5; pointer-events:none; }
        .mpd-badge-jk {
            display:inline-flex; align-items:center; gap:4px;
            padding:2px 9px; border-radius:20px; font-size:11px; font-weight:700;
        }
        .mpd-empty {
            text-align:center; color:#94a3b8; font-size:12px;
            padding:28px 0;
        }
        `;
        document.head.appendChild(s);
    }

    // ── State ──
    let _pasienData  = null;  // data pasien dari DB
    let _riwayatData = [];    // array kunjungan
    let _activeTab   = 'info';  // 'info' | 'edit' | 'riwayat'
    let _saving      = false;

    // ── Buat DOM (sekali) ──
    function _ensureDOM() {
        if (document.getElementById('mpdOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'mpdOverlay';
        ov.innerHTML = `
        <div id="mpdSheet">
            <div class="mpd-handle"></div>
            <div class="mpd-header">
                <div>
                    <div class="mpd-header-title" id="mpdName">—</div>
                    <div class="mpd-header-sub" id="mpdSub">Data Pasien</div>
                </div>
                <button class="mpd-close-btn" onclick="tutupModalPasien()">✕</button>
            </div>
            <div class="mpd-tabs" id="mpdTabs"></div>
            <div class="mpd-body" id="mpdBody">
                <div class="mpd-empty">⏳ Memuat data...</div>
            </div>
            <div class="mpd-footer" id="mpdFooter"></div>
        </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) tutupModalPasien(); });
    }

    // ── Buka & tutup ──
    window.tutupModalPasien = function() {
        const ov = document.getElementById('mpdOverlay');
        if (ov) ov.classList.remove('mpd-show');
    };

    function _open() {
        _ensureDOM();
        requestAnimationFrame(() => {
            document.getElementById('mpdOverlay').classList.add('mpd-show');
        });
    }

    function _setTab(tab) {
        _activeTab = tab;
        _renderTabs();
        _renderBody();
        _renderFooter();
    }

    // ════════════════════════════════════════
    //  API PUBLIK
    // ════════════════════════════════════════
    window.bukaModalPasien = async function(pasienId) {
        _ensureDOM();
        _pasienData  = null;
        _riwayatData = [];
        _activeTab   = 'info';

        document.getElementById('mpdName').textContent = 'Memuat...';
        document.getElementById('mpdSub').textContent  = '';
        document.getElementById('mpdBody').innerHTML   = '<div class="mpd-empty">⏳ Memuat data pasien...</div>';
        document.getElementById('mpdTabs').innerHTML   = '';
        document.getElementById('mpdFooter').innerHTML = '';
        _open();

        try {
            // Fetch data pasien
            const rows = await _sbFetch(`pasien?id=eq.${pasienId}&select=*&limit=1`);
            if (!rows || !rows.length) throw new Error('Pasien tidak ditemukan');
            _pasienData = rows[0];

            // Fetch riwayat kunjungan
            const rkwt = await _sbFetch(
                `kunjungan?pasien_id=eq.${pasienId}&order=tgl.desc,waktu.desc&select=*`
            );

            // Resolve nama dokter
            if (!window._usersCache || !window._usersCache.length) {
                try {
                    window._usersCache = await _sbFetch('users?select=id,nama,jabatan');
                } catch(e) { window._usersCache = []; }
            }

            _riwayatData = rkwt.map(r => ({
                id:       r.id,
                tgl:      r.tgl,
                waktu:    r.waktu,
                td:       r.td,
                suhu:     r.suhu,
                nadi:     r.nadi,
                keluhan:  r.keluhan,
                diag:     r.diagnosa,
                diagnosa2:r.diagnosa2,
                terapi:   r.terapi,
                status:   r.status,
                status_obat:  !!r.status_obat,
                status_bayar: !!r.status_bayar,
                dokterNama: _resolveDokterNama ? _resolveDokterNama(r.user_id) : null
            }));

            // Update header
            const jkLabel = _pasienData.jk === 'P' ? '👩 Perempuan' : '👨 Laki-Laki';
            document.getElementById('mpdName').textContent = _pasienData.nama || '—';
            document.getElementById('mpdSub').textContent  =
                `${jkLabel} · ${_hitungUmurStr(_pasienData.tgl_lahir)} · ${_riwayatData.length} kunjungan`;

            _renderTabs();
            _renderBody();
            _renderFooter();

        } catch(e) {
            document.getElementById('mpdBody').innerHTML =
                `<div class="mpd-empty">❌ ${e.message || 'Gagal memuat data'}</div>`;
        }
    };

    window.bukaModalPasienDariNama = function(nama) {
        const p = (typeof allPatients !== 'undefined' ? allPatients : [])
            .find(x => (x.nama || '').toLowerCase() === (nama || '').toLowerCase());
        if (!p) { showToast('⚠️ Pasien tidak ditemukan di daftar', 'warning'); return; }
        bukaModalPasien(p.id);
    };

    // ════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════
    function _renderTabs() {
        const tabs = [
            { id:'info',    label:'📋 Info' },
            { id:'edit',    label:'✏️ Edit' },
            { id:'riwayat', label:`📅 Riwayat (${_riwayatData.length})` },
        ];
        document.getElementById('mpdTabs').innerHTML = tabs.map(t =>
            `<button class="mpd-tab${_activeTab === t.id ? ' active' : ''}"
                     onclick="_mpdSetTab('${t.id}')">${t.label}</button>`
        ).join('');
    }
    window._mpdSetTab = _setTab;

    function _renderBody() {
        const el = document.getElementById('mpdBody');
        if (!_pasienData) return;
        if (_activeTab === 'info')    el.innerHTML = _htmlInfo();
        if (_activeTab === 'edit')    el.innerHTML = _htmlEdit();
        if (_activeTab === 'riwayat') el.innerHTML = _htmlRiwayat();
    }

    function _renderFooter() {
        const el = document.getElementById('mpdFooter');
        if (_activeTab === 'edit') {
            el.innerHTML = `
            <button class="mpd-btn mpd-btn-cancel" onclick="_mpdSetTab('info')">Batal</button>
            <button class="mpd-btn mpd-btn-success" id="mpdBtnSimpan" onclick="_mpdSimpan()">
                💾 Simpan Perubahan
            </button>`;
        } else if (_activeTab === 'info') {
            el.innerHTML = `
            <button class="mpd-btn mpd-btn-cancel" onclick="tutupModalPasien()">Tutup</button>
            <button class="mpd-btn mpd-btn-primary" onclick="_mpdSetTab('edit')">✏️ Edit Data</button>`;
        } else {
            el.innerHTML = `
            <button class="mpd-btn mpd-btn-cancel" onclick="tutupModalPasien()">Tutup</button>`;
        }
    }

    // ── Tab: Info ──
    function _htmlInfo() {
        const p = _pasienData;
        const jkBadge = p.jk === 'P'
            ? `<span class="mpd-badge-jk" style="background:rgba(236,72,153,.1);color:#be185d;">👩 Perempuan</span>`
            : `<span class="mpd-badge-jk" style="background:rgba(37,99,235,.1);color:#1d4ed8;">👨 Laki-Laki</span>`;

        const alergiHtml = (p.alergi && p.alergi.trim())
            ? `<div class="mpd-alergi-badge">⚠️ ${_esc(p.alergi)}</div>`
            : `<span class="mpd-no-alergi">Tidak ada riwayat alergi</span>`;

        // Statistik dari riwayat
        const selesai   = _riwayatData.filter(r => r.status === 'Selesai').length;
        const terakhirTgl = _riwayatData[0]?.tgl ? _fmt(new Date(_riwayatData[0].tgl)) : '—';

        // Lab terakhir
        const labTerakhir = _riwayatData.find(r => r.diag);
        const diagTerakhir = labTerakhir?.diag || '—';

        return `
        <!-- Statistik ringkas -->
        <div class="mpd-stat-grid">
            <div class="mpd-stat-tile">
                <div class="mpd-stat-val">${_riwayatData.length}</div>
                <div class="mpd-stat-lbl">Total Kunjungan</div>
            </div>
            <div class="mpd-stat-tile">
                <div class="mpd-stat-val">${selesai}</div>
                <div class="mpd-stat-lbl">Selesai</div>
            </div>
            <div class="mpd-stat-tile">
                <div class="mpd-stat-val" style="font-size:13px;">${terakhirTgl}</div>
                <div class="mpd-stat-lbl">Kunjungan Terakhir</div>
            </div>
        </div>

        <!-- Data diri -->
        <div class="mpd-section-label">Data Diri</div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">Jenis Kelamin</span>
            <span class="mpd-info-val">${jkBadge}</span>
        </div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">Tanggal Lahir</span>
            <span class="mpd-info-val">${p.tgl_lahir ? _fmtTgl(p.tgl_lahir) : '—'}</span>
        </div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">Umur</span>
            <span class="mpd-info-val">${_hitungUmurStr(p.tgl_lahir)}</span>
        </div>
        <div class="mpd-info-row">
            <span class="mpd-info-label">NIK</span>
            <span class="mpd-info-val" style="font-family:monospace;">${_esc(p.nik || '—')}</span>
        </div>
        <div class="mpd-info-row" style="border:none;">
            <span class="mpd-info-label">Alamat</span>
            <span class="mpd-info-val" style="white-space:pre-line;">${_esc(p.alamat || '—')}</span>
        </div>

        <!-- Alergi -->
        <div class="mpd-section-label">Riwayat Alergi</div>
        <div style="margin-bottom:10px;">${alergiHtml}</div>

        <!-- Diagnosa terakhir -->
        ${labTerakhir ? `
        <div class="mpd-section-label">Diagnosa Terakhir</div>
        <div style="background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.15);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
            <div style="font-weight:700;font-size:12.5px;color:#0f172a;">${_esc(diagTerakhir)}</div>
            ${labTerakhir.dokterNama ? `<div style="font-size:10.5px;color:#059669;margin-top:3px;">👨‍⚕️ ${_esc(labTerakhir.dokterNama)}</div>` : ''}
        </div>` : ''}
        `;
    }

    // ── Tab: Edit ──
    function _htmlEdit() {
        const p = _pasienData;
        const tglVal = p.tgl_lahir
            ? (p.tgl_lahir.includes('/') ? _tglInvertToForm(p.tgl_lahir) : p.tgl_lahir)
            : '';

        return `
        <div style="display:flex;flex-direction:column;gap:10px;">

            <div>
                <label class="mpd-form-label">Nama Lengkap *</label>
                <input type="text" id="mpdEditNama" class="form-control"
                       value="${_esc(p.nama || '')}" placeholder="Nama lengkap pasien">
            </div>

            <div>
                <label class="mpd-form-label">NIK (16 Digit)</label>
                <input type="tel" id="mpdEditNik" class="form-control"
                       value="${_esc(p.nik || '')}" placeholder="NIK KTP" maxlength="16">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <label class="mpd-form-label">Jenis Kelamin</label>
                    <select id="mpdEditJk" class="form-control">
                        <option value="L" ${p.jk === 'L' ? 'selected' : ''}>Laki-Laki</option>
                        <option value="P" ${p.jk === 'P' ? 'selected' : ''}>Perempuan</option>
                    </select>
                </div>
                <div>
                    <label class="mpd-form-label">Tanggal Lahir</label>
                    <input type="tel" id="mpdEditTgl" class="form-control"
                           value="${_esc(_fmtTgl(p.tgl_lahir))}"
                           placeholder="DD/MM/YYYY"
                           oninput="_mpdAutoFormatTgl(this)">
                </div>
            </div>

            <div>
                <label class="mpd-form-label">Alamat</label>
                <textarea id="mpdEditAlamat" class="form-control" rows="2"
                          placeholder="Alamat lengkap pasien">${_esc(p.alamat || '')}</textarea>
            </div>

            <div style="background:rgba(180,83,9,.05);border:1px solid rgba(180,83,9,.2);border-radius:10px;padding:10px 12px;">
                <label class="mpd-form-label" style="color:#b45309;">⚠️ Riwayat Alergi</label>
                <input type="text" id="mpdEditAlergi" class="form-control"
                       value="${_esc(p.alergi || '')}"
                       placeholder="Contoh: Penisilin, Sulfa — kosongkan jika tidak ada"
                       style="border-color:rgba(180,83,9,.3);">
                <div style="font-size:10px;color:#92400e;margin-top:4px;">
                    Data alergi tersimpan permanen di profil pasien
                </div>
            </div>

        </div>`;
    }

    // ── Tab: Riwayat ──
    function _htmlRiwayat() {
        if (_riwayatData.length === 0) {
            return '<div class="mpd-empty">📂 Belum ada riwayat kunjungan</div>';
        }
        return _riwayatData.map(r => {
            const tglStr  = r.tgl ? _fmtTgl(r.tgl) : '—';
            const isDone  = r.status === 'Selesai';
            const ttvStr  = r.td ? `TD ${r.td}${r.nadi ? ` | N ${r.nadi}` : ''}${r.suhu ? ` | S ${r.suhu}°C` : ''}` : '';

            // Badge status
            const stBadge = isDone
                ? `<span style="font-size:9.5px;background:#dcfce7;color:#166534;border-radius:20px;padding:1px 7px;font-weight:700;">✅ Selesai</span>`
                : `<span style="font-size:9.5px;background:#fef9c3;color:#854d0e;border-radius:20px;padding:1px 7px;font-weight:700;">⏳ Menunggu</span>`;

            // Action buttons
            let btns = '';
            if (r.id && window._biayaAktif) {
                btns += `<button onclick="event.stopPropagation();_mpdBukaInvoice('${r.id}','${_esc(r.tgl||'')}');return false;"
                            style="padding:3px 8px;background:rgba(5,150,105,.1);color:#065f46;border:1px solid rgba(5,150,105,.25);border-radius:7px;font-size:9.5px;font-weight:700;cursor:pointer;">
                            🧾 Invoice</button>`;
            }
            if (r.id && window._stokAktif) {
                btns += `<button onclick="event.stopPropagation();_mpdBukaResep('${r.id}','${_esc(r.tgl||'')}');return false;"
                            style="padding:3px 8px;background:rgba(37,99,235,.1);color:#1e40af;border:1px solid rgba(37,99,235,.25);border-radius:7px;font-size:9.5px;font-weight:700;cursor:pointer;">
                            💊 Resep</button>`;
            }

            return `
            <div class="mpd-riwayat-item">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span class="mpd-riwayat-tgl">📅 ${tglStr} (${r.waktu||'—'})</span>
                    ${stBadge}
                </div>
                ${r.diag ? `<div class="mpd-riwayat-diag">🩺 ${_esc(r.diag)}${r.diagnosa2 ? ` / ${_esc(r.diagnosa2)}` : ''}</div>` : ''}
                ${r.keluhan ? `<div class="mpd-riwayat-kel">Keluhan: ${_esc(r.keluhan)}</div>` : ''}
                ${ttvStr ? `<div class="mpd-riwayat-ttv">${ttvStr}</div>` : ''}
                ${r.dokterNama ? `<div style="font-size:10px;color:#059669;font-weight:600;margin-top:3px;">👨‍⚕️ ${_esc(r.dokterNama)}</div>` : ''}
                ${btns ? `<div style="display:flex;gap:5px;margin-top:7px;padding-top:6px;border-top:1px dashed #f1f5f9;">${btns}</div>` : ''}
            </div>`;
        }).join('');
    }

    // ════════════════════════════════════════
    //  SIMPAN EDIT
    // ════════════════════════════════════════
    window._mpdSimpan = async function() {
        if (_saving || !_pasienData) return;

        const nama   = document.getElementById('mpdEditNama')?.value.trim();
        const nik    = document.getElementById('mpdEditNik')?.value.trim();
        const jk     = document.getElementById('mpdEditJk')?.value || 'L';
        const tglRaw = document.getElementById('mpdEditTgl')?.value.trim();
        const alamat = document.getElementById('mpdEditAlamat')?.value.trim();
        const alergi = document.getElementById('mpdEditAlergi')?.value.trim();

        if (!nama) { showToast('⚠️ Nama pasien wajib diisi', 'warning'); return; }

        // Konversi DD/MM/YYYY → YYYY-MM-DD untuk DB
        const tgl_lahir = _tglFormToDb(tglRaw);

        _saving = true;
        const btn = document.getElementById('mpdBtnSimpan');
        if (btn) { btn.textContent = '⏳ Menyimpan...'; btn.classList.add('mpd-saving'); }

        try {
            await sb_savePasienOnly({
                pasienId: _pasienData.id,
                nama, nik, jk,
                tgl_lahir: tgl_lahir || null,
                alamat: alamat || null,
                alergi: alergi || null
            });

            // Update cache lokal allPatients
            if (typeof allPatients !== 'undefined') {
                const idx = allPatients.findIndex(p => p.id === _pasienData.id);
                if (idx !== -1) {
                    allPatients[idx] = { ...allPatients[idx], nama, nik, jk, tgl: tgl_lahir, alamat, alergi };
                }
            }

            // Sync form pageDaftar jika pasien yang sama sedang aktif
            if (typeof currentPasienId !== 'undefined' && currentPasienId === _pasienData.id) {
                const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
                setV('nama', nama); setV('nik', nik); setV('jk', jk);
                setV('tgl_lahir', _fmtTgl(tgl_lahir)); setV('alamat', alamat);
                if (typeof window._pasienAlergi !== 'undefined') window._pasienAlergi = alergi;
            }

            // Update state & tampilan
            _pasienData = { ..._pasienData, nama, nik, jk, tgl_lahir, alamat, alergi };
            document.getElementById('mpdName').textContent = nama;

            showToast('✅ Data pasien berhasil disimpan', 'success');
            _setTab('info');

        } catch(e) {
            showToast('❌ Gagal menyimpan: ' + (e.message || ''), 'error');
        } finally {
            _saving = false;
            if (btn) { btn.textContent = '💾 Simpan Perubahan'; btn.classList.remove('mpd-saving'); }
        }
    };

    // ════════════════════════════════════════
    //  AKSI DARI RIWAYAT
    // ════════════════════════════════════════
    window._mpdBukaInvoice = function(kunjId, tgl) {
        if (typeof lihatTagihanKunjungan === 'function') {
            lihatTagihanKunjungan(kunjId, _pasienData?.nama || '—', tgl);
        }
    };
    window._mpdBukaResep = async function(kunjId, tgl) {
        if (typeof sb_getResepByKunjungan !== 'function') {
            showToast('⚠️ Modul resep belum dimuat', 'warning'); return;
        }
        try {
            const items = await sb_getResepByKunjungan(kunjId);
            if (!items || !items.length) {
                showToast('ℹ️ Tidak ada resep pada kunjungan ini', 'info'); return;
            }
            if (typeof _tampilModalResep === 'function') {
                _tampilModalResep(kunjId, _pasienData?.nama || '—', items, tgl);
            }
        } catch(e) {
            showToast('❌ Gagal memuat resep', 'error');
        }
    };

    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════
    window._mpdAutoFormatTgl = function(inp) {
        let v = inp.value.replace(/\D/g, '');
        if (v.length > 8) v = v.substring(0, 8);
        if (v.length >= 5)      inp.value = v.substring(0,2)+'/'+v.substring(2,4)+'/'+v.substring(4,8);
        else if (v.length >= 3) inp.value = v.substring(0,2)+'/'+v.substring(2,4);
        else                    inp.value = v;
    };

    function _esc(str) {
        return String(str||'')
            .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
            .replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function _fmtTgl(str) {
        if (!str) return '—';
        str = String(str).trim();
        if (str.includes('/')) return str;
        if (str.includes('-')) {
            const p = str.split('-');
            if (p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return str;
    }

    function _tglFormToDb(str) {
        // DD/MM/YYYY → YYYY-MM-DD
        if (!str || !str.includes('/')) return str || null;
        const p = str.split('/');
        if (p.length !== 3) return null;
        return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    }

    function _tglInvertToForm(str) {
        // Alias _fmtTgl — untuk kejelasan
        return _fmtTgl(str);
    }

    function _fmt(d) {
        if (!d || isNaN(d)) return '—';
        return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    }

    function _hitungUmurStr(tgl) {
        if (!tgl) return '—';
        let parts = String(tgl).includes('/')
            ? String(tgl).split('/') : String(tgl).split('-');
        let bd = parts.length === 3
            ? (parts[0].length === 4
                ? new Date(parts[0], parts[1]-1, parts[2])
                : new Date(parts[2], parts[1]-1, parts[0]))
            : new Date(tgl);
        if (isNaN(bd)) return '—';
        let age = new Date().getFullYear() - bd.getFullYear();
        if (new Date().getMonth() < bd.getMonth() ||
           (new Date().getMonth() === bd.getMonth() && new Date().getDate() < bd.getDate())) age--;
        return age + ' Tahun';
    }

    console.log('[Klikpro] ✅ modal-pasien-detail.js loaded');

})();
