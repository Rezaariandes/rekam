// ════════════════════════════════════════════════════════
//  KLIKPRO RME — REALTIME.JS
//  Supabase Realtime WebSocket listener
//
//  Tabel yang dipantau:
//    • kunjungan  → surgical DOM patch card harian + live-refresh pageMedis
//    • pasien     → update cache allPatients
//
//  LOAD ORDER: di-load setelah supabase.js dan kunjungan.js.
//  AKTIVASI   : initRealtime() dipanggil dari initApp() setelah
//               sb_initData() selesai — bukan dari bootstrap.
// ════════════════════════════════════════════════════════

'use strict';

// ── Guard: jangan inisialisasi lebih dari sekali ──
if (window._klikproRealtimeInit) {
    console.warn('[Realtime] Sudah diinisialisasi, skip.');
} else {

window._klikproRealtimeInit = true;

// ════════════════════════════════════════════════════════
//  SELF-CONTAINED ESCAPE HTML
//  Tidak bergantung pada window.escHtml / app.js / supabase.js.
//  Eliminasi ReferenceError apapun saat pesan WebSocket masuk.
// ════════════════════════════════════════════════════════
const _esc = (str) => {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

let _rtSocket         = null;
let _rtReconnectTimer = null;
let _rtReconnectDelay = 3000;
let _rtSbUrl          = '';
let _rtSbKey          = '';

// ════════════════════════════════════════════════════════
//  ENTRY POINT — dipanggil dari initApp() setelah sb_initData() selesai
// ════════════════════════════════════════════════════════
function initRealtime() {
    _rtSbUrl = (typeof _SB_URL !== 'undefined' ? _SB_URL : '') ||
               (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
    _rtSbKey = (typeof _SB_KEY !== 'undefined' ? _SB_KEY : '') ||
               (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '');

    if (!_rtSbUrl || !_rtSbKey) {
        console.warn('[Realtime] _SB_URL atau _SB_KEY kosong — realtime tidak aktif.');
        return;
    }
    _connectRealtime();
}

// ════════════════════════════════════════════════════════
//  KONEKSI WEBSOCKET
// ════════════════════════════════════════════════════════
function _connectRealtime() {
    if (_rtSocket) {
        try { _rtSocket.close(); } catch(e) {}
        _rtSocket = null;
    }

    const wsUrl = _rtSbUrl.replace(/^https?:\/\//, 'wss://') +
        '/realtime/v1/websocket?apikey=' + encodeURIComponent(_rtSbKey) + '&vsn=1.0.0';

    try {
        _rtSocket = new WebSocket(wsUrl);
    } catch(e) {
        console.warn('[Realtime] Gagal membuat WebSocket:', e.message);
        _scheduleReconnect();
        return;
    }

    _rtSocket.onopen = function() {
        _rtReconnectDelay = 3000;
        console.log('[Realtime] Terhubung ke Supabase Realtime');
        _rtSend({
            topic:   'realtime:klikpro',
            event:   'phx_join',
            payload: {
                config: {
                    broadcast:        { self: false },
                    presence:         { key: '' },
                    postgres_changes: [
                        { event: '*', schema: 'public', table: 'kunjungan' },
                        { event: '*', schema: 'public', table: 'pasien' }
                    ]
                }
            },
            ref: '1'
        });
    };

    _rtSocket.onmessage = function(event) {
        let msg;
        try { msg = JSON.parse(event.data); } catch(e) { return; }
        _handleMessage(msg);
    };

    _rtSocket.onerror = function() {};

    _rtSocket.onclose = function(e) {
        console.warn('[Realtime] Koneksi tertutup (code:', e.code, ') — reconnect...');
        _scheduleReconnect();
    };
}

function _rtSend(payload) {
    if (_rtSocket && _rtSocket.readyState === WebSocket.OPEN) {
        _rtSocket.send(JSON.stringify(payload));
    }
}

function _scheduleReconnect() {
    clearTimeout(_rtReconnectTimer);
    _rtReconnectTimer = setTimeout(() => {
        _rtReconnectDelay = Math.min(_rtReconnectDelay * 1.5, 30000);
        _connectRealtime();
    }, _rtReconnectDelay);
}

// ════════════════════════════════════════════════════════
//  ROUTING PESAN
// ════════════════════════════════════════════════════════
function _handleMessage(msg) {
    if (msg.event === 'heartbeat') {
        _rtSend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: msg.ref || '1' });
        return;
    }
    if (msg.event === 'phx_reply') {
        if (msg.payload && msg.payload.status === 'ok') console.log('[Realtime] Channel aktif:', msg.topic);
        return;
    }
    if (msg.event === 'postgres_changes') {
        const p = msg.payload || {};
        _dispatch(p.table, p.type, p.record || {}, p.old_record || {});
        return;
    }
    if (msg.payload && msg.payload.data) {
        const d = msg.payload.data;
        _dispatch(d.table, d.type, d.record || {}, d.old_record || {});
    }
}

function _dispatch(table, type, record, old) {
    if (!table || !type) return;
    if (table === 'kunjungan') _onKunjunganChange(type, record, old);
    else if (table === 'pasien') _onPasienChange(type, record, old);
}

// ════════════════════════════════════════════════════════
//  HANDLER: KUNJUNGAN
// ════════════════════════════════════════════════════════
function _onKunjunganChange(type, record, old) {
    if      (type === 'INSERT') _handleKunjunganInsert(record);
    else if (type === 'UPDATE') _handleKunjunganUpdate(record);
    else if (type === 'DELETE') _handleKunjunganDelete(old.id || record.id);
}

function _handleKunjunganInsert(record) {
    if (!record || !record.id) return;
    if (record.tgl !== _getFilterDate()) return;
    if (typeof kunjunganHariIni !== 'undefined' && kunjunganHariIni.find(k => k.id === record.id)) return;

    const pasien = typeof allPatients !== 'undefined' ? allPatients.find(p => p.id === record.pasien_id) : null;
    const entry  = _mapRecordToEntry(record, pasien);

    if (typeof kunjunganHariIni !== 'undefined') kunjunganHariIni.push(entry);
    if (typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();
    if (typeof showToast === 'function') showToast('Pasien baru: ' + _esc(entry.nama || 'Unknown'), 'info');
}

function _handleKunjunganUpdate(record) {
    if (!record || !record.id) return;
    const kId = record.id;
    if (record.tgl && record.tgl !== _getFilterDate()) return;

    // 1. Patch cache
    if (typeof kunjunganHariIni !== 'undefined') {
        const idx = kunjunganHariIni.findIndex(k => k.id === kId);
        if (idx !== -1) kunjunganHariIni[idx] = _mergeEntry(kunjunganHariIni[idx], record);
    }

    // 2. Patch _statusCache
    if (window._statusCache && window._statusCache[kId]) {
        if (record.status_obat  !== undefined) window._statusCache[kId].obat  = !!record.status_obat;
        if (record.status_bayar !== undefined) window._statusCache[kId].bayar = !!record.status_bayar;
    }

    // 3. Surgical DOM patch — hanya badge yang berubah
    _patchBadgeObat(kId, record);
    _patchBadgeBayar(kId, record);

    // 4. Re-render card list hanya jika status berubah (warna & sorting)
    if (record.status !== undefined) {
        if (typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();
    }

    // 5. Live-refresh form pageMedis jika kunjungan ini sedang aktif
    _refreshPageMedisIfActive(kId, record);
}

function _handleKunjunganDelete(kId) {
    if (!kId) return;
    if (typeof kunjunganHariIni !== 'undefined') {
        const idx = kunjunganHariIni.findIndex(k => k.id === kId);
        if (idx !== -1) kunjunganHariIni.splice(idx, 1);
    }
    if (typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();
}

// ════════════════════════════════════════════════════════
//  LIVE-REFRESH PAGEMED IS
//  Jika device lain mengupdate kunjungan yang sedang terbuka di sini,
//  patch field form secara langsung tanpa perlu refresh halaman.
// ════════════════════════════════════════════════════════
function _refreshPageMedisIfActive(kId, record) {
    const pageMedis = document.getElementById('pageMedis');
    if (!pageMedis || pageMedis.style.display === 'none') return;

    // currentKunjunganId adalah let di kunjungan.js — tidak window-scoped.
    // Gunakan localStorage sebagai jembatan (sudah di-set saat bukaRekamMedisHariIni).
    const activeKId = localStorage.getItem('cK_id');
    if (!activeKId || activeKId === 'null' || activeKId !== String(kId)) return;

    // Patch field form jika tidak sedang dalam fokus user
    const fieldMap = { td: 'td', suhu: 'suhu', nadi: 'nadi', diagnosa: 'diagnosa', keluhan: 'keluhan' };
    let didPatch = false;
    for (const [dbField, elId] of Object.entries(fieldMap)) {
        if (record[dbField] === undefined || record[dbField] === null) continue;
        const el = document.getElementById(elId);
        if (!el || document.activeElement === el) continue;
        if (el.value !== String(record[dbField])) {
            el.value = record[dbField];
            didPatch = true;
        }
    }

    // Patch badge status di pageMedis jika ada elemen data-rt-badge
    _patchPageMedisBadge('status_obat',  record);
    _patchPageMedisBadge('status_bayar', record);

    if (didPatch && typeof showToast === 'function') {
        showToast('Data kunjungan diperbarui secara live', 'info');
    }
}

function _patchPageMedisBadge(field, record) {
    if (record[field] === undefined) return;
    const el = document.querySelector('[data-rt-badge="' + field + '"]');
    if (!el) return;
    const val = !!record[field];
    el.textContent = field === 'status_obat'
        ? (val ? '💊 Sudah' : '💊 Belum')
        : (val ? '💰 Lunas' : '💰 Belum');
    el.style.color = val ? '#059669' : '#b45309';
}

// ════════════════════════════════════════════════════════
//  SURGICAL BADGE PATCHES
// ════════════════════════════════════════════════════════
function _patchBadgeObat(kId, record) {
    if (record.status_obat === undefined) return;
    const badge = document.getElementById('badge_obat_' + kId);
    if (!badge) return;
    const val = !!record.status_obat;
    badge.style.background = val ? 'rgba(5,150,105,0.12)' : 'rgba(234,179,8,0.10)';
    badge.style.color      = val ? '#059669' : '#b45309';
    badge.style.border     = val ? '1px solid rgba(5,150,105,0.28)' : '1px solid rgba(234,179,8,0.28)';
    badge.style.boxShadow  = val ? '0 2px 6px rgba(5,150,105,0.15)' : '0 2px 6px rgba(234,179,8,0.12)';
    const span = badge.querySelector('span');
    if (span) span.textContent = val ? '💊 Sudah' : '💊 Belum';
}

function _patchBadgeBayar(kId, record) {
    if (record.status_bayar === undefined) return;
    const badge = document.getElementById('badge_bayar_' + kId);
    if (!badge) return;
    const val = !!record.status_bayar;
    badge.style.background = val ? 'rgba(5,150,105,0.12)' : 'rgba(234,179,8,0.10)';
    badge.style.color      = val ? '#059669' : '#b45309';
    badge.style.border     = val ? '1px solid rgba(5,150,105,0.28)' : '1px solid rgba(234,179,8,0.28)';
    badge.style.boxShadow  = val ? '0 2px 6px rgba(5,150,105,0.15)' : '0 2px 6px rgba(234,179,8,0.12)';
    const span = badge.querySelector('span');
    if (span) span.textContent = val ? '💰 Lunas' : '💰 Belum';
}

// ════════════════════════════════════════════════════════
//  HANDLER: PASIEN
// ════════════════════════════════════════════════════════
function _onPasienChange(type, record, old) {
    if (!record || !record.id) return;
    if (type !== 'UPDATE' && type !== 'INSERT') return;

    if (typeof allPatients !== 'undefined') {
        const idx = allPatients.findIndex(p => p.id === record.id);
        if (idx !== -1) {
            allPatients[idx] = {
                ...allPatients[idx],
                nama:   record.nama      || allPatients[idx].nama,
                nik:    record.nik       || allPatients[idx].nik,
                jk:     record.jk        || allPatients[idx].jk,
                tgl:    record.tgl_lahir || allPatients[idx].tgl,
                alamat: record.alamat    || allPatients[idx].alamat,
                alergi: record.alergi    !== undefined ? record.alergi : allPatients[idx].alergi
            };
        } else if (type === 'INSERT') {
            allPatients.push({
                id: record.id, nama: record.nama, nik: record.nik,
                jk: record.jk, tgl: record.tgl_lahir, alamat: record.alamat,
                alergi: record.alergi || ''
            });
            const listPasien = document.getElementById('list-pasien');
            if (listPasien && record.nama) {
                const opt = document.createElement('option');
                opt.value = record.nama;
                listPasien.appendChild(opt);
            }
        }
    }

    if (typeof kunjunganHariIni !== 'undefined' && record.nama) {
        let changed = false;
        kunjunganHariIni.forEach(k => {
            if (k.pasienId === record.id) { k.nama = record.nama; changed = true; }
        });
        if (changed && typeof renderKunjunganHariIni === 'function') renderKunjunganHariIni();
    }
}

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════
function _getFilterDate() {
    const fd = document.getElementById('filterDate');
    return (fd && fd.value) ? fd.value : new Date().toISOString().slice(0, 10);
}

function _mapRecordToEntry(record, pasien) {
    return {
        id: record.id, pasienId: record.pasien_id,
        nama: pasien ? pasien.nama : '', waktu: record.waktu, tgl: record.tgl,
        td: record.td, suhu: record.suhu, nadi: record.nadi,
        keluhan: record.keluhan, diag: record.diagnosa,
        status: record.status || 'Menunggu', user_id: record.user_id || null,
        req_lab: record.req_lab || null, dokterNama: null,
        status_obat: !!record.status_obat, status_bayar: !!record.status_bayar
    };
}

function _mergeEntry(existing, record) {
    return {
        ...existing,
        td:           record.td           !== undefined ? record.td           : existing.td,
        suhu:         record.suhu         !== undefined ? record.suhu         : existing.suhu,
        nadi:         record.nadi         !== undefined ? record.nadi         : existing.nadi,
        keluhan:      record.keluhan      !== undefined ? record.keluhan      : existing.keluhan,
        diag:         record.diagnosa     !== undefined ? record.diagnosa     : existing.diag,
        status:       record.status       !== undefined ? record.status       : existing.status,
        req_lab:      record.req_lab      !== undefined ? record.req_lab      : existing.req_lab,
        status_obat:  record.status_obat  !== undefined ? !!record.status_obat  : existing.status_obat,
        status_bayar: record.status_bayar !== undefined ? !!record.status_bayar : existing.status_bayar,
        user_id:      record.user_id      !== undefined ? record.user_id      : existing.user_id
    };
}

// ════════════════════════════════════════════════════════
//  CLEANUP
// ════════════════════════════════════════════════════════
window.destroyRealtime = function() {
    clearTimeout(_rtReconnectTimer);
    if (_rtSocket) {
        try { _rtSocket.close(1000, 'User logout'); } catch(e) {}
        _rtSocket = null;
    }
    window._klikproRealtimeInit = false;
    console.log('[Realtime] Koneksi diputus.');
};

window.initRealtime = initRealtime;
console.log('[realtime] Modul siap — menunggu initRealtime() dari initApp().');

} // end guard
