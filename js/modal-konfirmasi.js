// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODAL KONFIRMASI UNIVERSAL
//  Menggantikan window.confirm() di seluruh aplikasi
//  API:
//    showKonfirmasi(opsi) → Promise<boolean>
//    showKonfirmasiHapus(namaItem, opsi?) → Promise<boolean>
//    showKonfirmasiDangerZone(namaItem, opsi?) → Promise<boolean>
// ════════════════════════════════════════════════════════

(function _initModalKonfirmasi() {

    // ── Inject CSS sekali ──
    if (!document.getElementById('mk-style')) {
        const s = document.createElement('style');
        s.id = 'mk-style';
        s.textContent = `
        #mkOverlay {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15,23,42,0.6);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            opacity: 0; transition: opacity 0.22s ease;
            pointer-events: none;
        }
        #mkOverlay.mk-visible {
            opacity: 1; pointer-events: auto;
        }
        #mkSheet {
            background: #fff;
            width: 100%; max-width: 420px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            padding: 0 0 16px;
            transform: scale(0.92) translateY(10px);
            transition: transform 0.28s cubic-bezier(.34,1.56,.64,1), opacity 0.22s ease;
            opacity: 0;
            max-height: 90vh;
            overflow-y: auto;
        }
        #mkOverlay.mk-visible #mkSheet {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        .mk-handle {
            display: none;
        }
        .mk-icon-wrap {
            font-size: 40px; text-align: center;
            margin: 24px 0 8px;
            line-height: 1;
        }
        .mk-title {
            font-size: 15px; font-weight: 800;
            color: #0f172a; text-align: center;
            padding: 0 24px; line-height: 1.4;
            margin-bottom: 6px;
        }
        .mk-msg {
            font-size: 12.5px; color: #64748b;
            text-align: center; padding: 0 24px 14px;
            line-height: 1.65;
        }
        .mk-input-wrap {
            padding: 0 20px 10px;
        }
        .mk-input-label {
            font-size: 11px; font-weight: 700;
            color: #64748b; text-transform: none;
            letter-spacing: .3px; margin-bottom: 5px;
            display: block;
        }
        .mk-input {
            width: 100%; padding: 9px 12px;
            border: 1.5px solid #e2e8f0; border-radius: 10px;
            font-size: 13px; font-family: inherit;
            outline: none; transition: border-color .15s;
            box-sizing: border-box;
        }
        .mk-input:focus { border-color: #6366f1; }
        .mk-input.mk-input-error { border-color: #ef4444; }
        .mk-divider {
            height: 1px; background: #f1f5f9; margin: 0 0 4px;
        }
        .mk-btn-group {
            display: flex; flex-direction: column;
            gap: 6px; padding: 4px 16px 8px;
        }
        .mk-btn {
            width: 100%; padding: 13px;
            border: none; border-radius: 13px;
            font-size: 13.5px; font-weight: 700;
            cursor: pointer; font-family: inherit;
            transition: opacity .15s, transform .1s;
            letter-spacing: .1px;
        }
        .mk-btn:active { opacity: .85; transform: scale(.98); }
        .mk-btn-primary {
            background: linear-gradient(135deg,#3b82f6,#6366f1);
            color: #fff;
        }
        .mk-btn-danger {
            background: linear-gradient(135deg,#ef4444,#dc2626);
            color: #fff;
        }
        .mk-btn-warning {
            background: linear-gradient(135deg,#f59e0b,#d97706);
            color: #fff;
        }
        .mk-btn-success {
            background: linear-gradient(135deg,#10b981,#059669);
            color: #fff;
        }
        .mk-btn-cancel {
            background: #f1f5f9; color: #64748b;
            font-weight: 600;
        }
        .mk-badge-danger {
            display: inline-block;
            background: rgba(239,68,68,.1);
            color: #dc2626; border: 1px solid rgba(239,68,68,.25);
            border-radius: 20px; font-size: 11px; font-weight: 700;
            padding: 2px 10px; margin-bottom: 6px;
        }
        `;
        document.head.appendChild(s);
    }

    // ── Buat DOM overlay (sekali) ──
    function _ensureDOM() {
        if (document.getElementById('mkOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'mkOverlay';
        ov.innerHTML = `<div id="mkSheet"><div class="mk-handle"></div><div id="mkBody"></div></div>`;
        document.body.appendChild(ov);
        // Tutup jika klik backdrop — BUG 2+3 FIX:
        // guard _resolve null & blokir backdrop dismiss saat requireInput aktif
        ov.addEventListener('click', e => {
            if (e.target === ov && typeof _resolve === 'function' && !_requireInput) _resolve(false);
        });
    }

    let _resolve = null;
    let _requireInput = false; // BUG 3 FIX: flag blokir backdrop dismiss saat DangerZone

    function _open() {
        // _ensureDOM() sudah dipanggil sebelum _setBody(), ini hanya safety guard
        _ensureDOM();
        // Double rAF: pastikan konten sudah ter-render di DOM sebelum animasi CSS berjalan
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const ov = document.getElementById('mkOverlay');
                if (ov) ov.classList.add('mk-visible');
            });
        });
    }

    function _close() {
        const ov = document.getElementById('mkOverlay');
        if (!ov) return;
        ov.classList.remove('mk-visible');
    }

    function _setBody(html) {
        const b = document.getElementById('mkBody');
        if (b) b.innerHTML = html;
    }

    // ────────────────────────────────────────
    //  CORE: showKonfirmasi(opsi)
    //  Opsi:
    //    icon      : string emoji (default '❓')
    //    title     : string
    //    message   : string
    //    confirmText  : string (default 'Ya, Lanjutkan')
    //    cancelText   : string (default 'Batal')
    //    type      : 'primary'|'danger'|'warning'|'success' (default 'primary')
    //    badge     : string | null — badge kecil di atas judul (opsional)
    //    requireInput : null | { label, match, placeholder, errorMsg }
    //                  Jika diisi, user harus mengetik teks tertentu sebelum tombol konfirmasi aktif
    // ────────────────────────────────────────
    window.showKonfirmasi = function(opts = {}) {
        return new Promise(res => {
            _resolve = ok => {
                _close();
                setTimeout(() => res(ok), 280);
            };

            const {
                icon         = '❓',
                title        = 'Konfirmasi',
                message      = '',
                confirmText  = 'Ya, Lanjutkan',
                cancelText   = 'Batal',
                type         = 'primary',
                badge        = null,
                requireInput = null
            } = opts;

            const badgeHtml = badge
                ? `<div style="text-align:center;padding:0 24px 2px;"><span class="mk-badge-danger">${badge}</span></div>`
                : '';

            const inputHtml = requireInput
                ? `<div class="mk-input-wrap">
                     <label class="mk-input-label">${requireInput.label || 'Ketik untuk konfirmasi'}</label>
                     <input class="mk-input" id="mkRequireInput" type="text"
                            placeholder="${requireInput.placeholder || requireInput.match}"
                            autocomplete="off" spellcheck="false">
                     <div id="mkInputErr" style="font-size:10.5px;color:#ef4444;margin-top:4px;display:none;">
                       ${requireInput.errorMsg || 'Teks tidak sesuai'}
                     </div>
                   </div>`
                : '';

            // FIX: _ensureDOM() harus dipanggil SEBELUM _setBody()
            // agar #mkBody sudah ada di DOM saat diisi konten
            _requireInput = !!requireInput; // BUG 3 FIX: set flag backdrop dismiss
            _ensureDOM();

            _setBody(`
                <div class="mk-icon-wrap">${icon}</div>
                ${badgeHtml}
                <div class="mk-title">${title}</div>
                ${message ? `<div class="mk-msg">${message}</div>` : ''}
                ${inputHtml}
                <div class="mk-divider"></div>
                <div class="mk-btn-group">
                    <button class="mk-btn mk-btn-${type}" id="mkBtnConfirm">${confirmText}</button>
                    <button class="mk-btn mk-btn-cancel" id="mkBtnCancel">${cancelText}</button>
                </div>
            `);

            _open();

            // Pasang event setelah DOM ada
            setTimeout(() => {
                const btnOk  = document.getElementById('mkBtnConfirm');
                const btnCx  = document.getElementById('mkBtnCancel');
                const inp    = document.getElementById('mkRequireInput');
                const errEl  = document.getElementById('mkInputErr');

                if (requireInput && inp) {
                    btnOk.disabled = true;
                    btnOk.style.opacity = '.45';
                    inp.addEventListener('input', () => {
                        const ok = inp.value.trim() === requireInput.match;
                        btnOk.disabled = !ok;
                        btnOk.style.opacity = ok ? '1' : '.45';
                        if (errEl) errEl.style.display = (!ok && inp.value.length > 0) ? '' : 'none';
                        inp.classList.toggle('mk-input-error', !ok && inp.value.length > 0);
                    });
                    inp.focus();
                }

                if (btnOk)  btnOk.onclick  = () => { if (!btnOk.disabled) _resolve(true);  };
                if (btnCx)  btnCx.onclick  = () => _resolve(false);
            }, 50);
        });
    };

    // ────────────────────────────────────────
    //  SHORTCUT: Konfirmasi hapus standar
    // ────────────────────────────────────────
    window.showKonfirmasiHapus = function(namaItem, opts = {}) {
        return showKonfirmasi({
            icon:        opts.icon || '🗑️',
            title:       opts.title || `Hapus "${namaItem}"?`,
            message:     opts.message || 'Data yang dihapus tidak dapat dikembalikan.',
            confirmText: opts.confirmText || 'Ya, Hapus',
            cancelText:  opts.cancelText || 'Batal',
            type:        'danger',
            badge:       opts.badge || null,
        });
    };

    // ────────────────────────────────────────
    //  SHORTCUT: Konfirmasi danger zone
    //  (user harus mengetik nama item untuk konfirmasi)
    // ────────────────────────────────────────
    window.showKonfirmasiDangerZone = function(namaItem, opts = {}) {
        return showKonfirmasi({
            icon:        opts.icon || '⚠️',
            badge:       'TINDAKAN TIDAK DAPAT DIBATALKAN',
            title:       opts.title || `Hapus Permanen "${namaItem}"?`,
            message:     opts.message ||
                         `Semua data terkait akan ikut terhapus.<br>Ketik <b>${namaItem}</b> di bawah untuk mengkonfirmasi.`,
            confirmText: opts.confirmText || 'Hapus Permanen',
            cancelText:  opts.cancelText || 'Batal',
            type:        'danger',
            requireInput: {
                label:       `Ketik "${namaItem}" untuk melanjutkan`,
                match:       namaItem,
                placeholder: namaItem,
                errorMsg:    'Teks tidak sesuai, hapus dibatalkan'
            }
        });
    };

    // ────────────────────────────────────────
    //  PATCH: Ganti confirm() asli di seluruh app
    //  (opsional — aktifkan jika ingin global)
    // ────────────────────────────────────────
    // window._nativeConfirm = window.confirm;
    // window.confirm = () => { console.warn('[Klikpro] Gunakan showKonfirmasi() bukan confirm()'); return true; };

    console.log('[Klikpro] ✅ modal-konfirmasi.js loaded');

})();


// ════════════════════════════════════════
//  PATCH FUNGSI YANG PAKAI confirm() ASLI
//  Jalankan setelah semua modul siap
// ════════════════════════════════════════
(function _patchConfirmCalls() {
    const MAX_WAIT = 8000, TICK = 200;
    let elapsed = 0;
    const iv = setInterval(() => {
        elapsed += TICK;
        // BUG 6 FIX: trigger setelah modul utama siap — cek hapusObat ATAU elapsed MAX_WAIT
        // Tidak bergantung hanya pada hapusTarif yang mungkin tidak ada jika biaya.js tidak load
        const modulSiap = typeof hapusTarif === 'function' || typeof hapusObat === 'function' || typeof hapusUser === 'function';
        if (!modulSiap && elapsed < MAX_WAIT) return;
        clearInterval(iv);

        // ── PATCH hapusTarif (biaya.js) ──
        if (typeof hapusTarif === 'function') {
            const _origHapusTarif = hapusTarif;
            window.hapusTarif = async function(id) {
                const t = (window._tarifCache || []).find(x => String(x.id) === String(id));
                const nama = t ? t.nama : 'tarif ini';
                const isRegistry = t && (typeof TARIF_DEFAULT !== 'undefined')
                    && TARIF_DEFAULT.some(d => d.nama === t.nama && d.kategori === t.kategori);

                const ok = await showKonfirmasi({
                    icon:        '🗑️',
                    title:       `Hapus "${nama}"?`,
                    message:     isRegistry
                        ? `Ini adalah tarif bawaan sistem. Jika dihapus akan <b>muncul kembali</b> otomatis saat halaman Tarif dibuka ulang.<br><br>Untuk menyembunyikan permanen gunakan toggle ON/OFF.`
                        : 'Aksi ini tidak dapat dibatalkan.',
                    confirmText: isRegistry ? 'Hapus Sementara' : 'Ya, Hapus',
                    cancelText:  'Batal',
                    type:        'danger',
                    badge:       isRegistry ? 'TARIF BAWAAN SISTEM' : null,
                });
                if (!ok) return;

                try {
                    await sb_deleteTarif(id);
                    showToast('🗑️ Tarif dihapus', 'success');
                    await _refreshTarifCache();
                    renderDaftarTarif();
                } catch(e) {
                    showToast('❌ Gagal menghapus', 'error');
                }
            };
        }

        // ── PATCH hapusObat (stok.js) ──
        if (typeof hapusObat === 'function') {
            window.hapusObat = async function(id) {
                const o = (window._obatCache || []).find(o => String(o.id) === String(id));
                const ok = await showKonfirmasiHapus(o ? o.nama : 'obat ini', {
                    message: 'Stok dan data obat ini akan dihapus permanen dari sistem.'
                });
                if (!ok) return;
                try {
                    await sb_deleteObat(id);
                    showToast('🗑️ Obat dihapus', 'success');
                    await _refreshObatCache();
                    renderDaftarObat();
                } catch(e) {
                    showToast('❌ Gagal menghapus: ' + (e.message || ''), 'error');
                }
            };
        }

        // ── PATCH hapusUser (user.js) ──
        // BUG 1 FIX: TIDAK di-patch di sini — user.js versi baru sudah
        // memanggil showKonfirmasiDangerZone() langsung tanpa perlu patch override.
        // Patch ini dihapus agar tidak ada konflik dua definisi hapusUser.

        // ── PATCH toggleAllLabGroup di settings.js (konfirmasi sebelum reset) ──
        if (typeof _resetDefaultModul === 'function') {
            const _origReset = _resetDefaultModul;
            window._resetDefaultModul = async function(jab) {
                const ok = await showKonfirmasi({
                    icon:        '🔄',
                    title:       `Reset Akses ${jab}?`,
                    message:     `Semua pengaturan hak akses untuk jabatan <b>${jab}</b> akan dikembalikan ke default bawaan sistem.`,
                    confirmText: 'Ya, Reset',
                    cancelText:  'Batal',
                    type:        'warning',
                });
                if (!ok) return;
                _origReset(jab);
            };
        }

        console.log('[Klikpro] ✅ confirm() patches applied via modal-konfirmasi');
    }, TICK);
})();
