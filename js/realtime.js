// ════════════════════════════════════════════════════════
//  KLIKPRO RME — REALTIME.JS
//  Supabase Realtime WebSocket listener
//
//  Mendengarkan perubahan tabel:
//    • kunjungan  → UPDATE card kunjungan harian secara surgical
//    • pasien     → UPDATE nama/info di allPatients cache
//
//  TIDAK merender ulang seluruh daftar — hanya patch elemen
//  spesifik berdasarkan ID agar performa tetap optimal.
//
//  LOAD ORDER: harus di-load SETELAH supabase.js dan kunjungan.js
//  (didaftarkan di bootstrap index.html sebagai jsRealtime)
// ════════════════════════════════════════════════════════

'use strict';

// ── Guard: jangan inisialisasi lebih dari sekali ──
if (window._klikproRealtimeInit) {
    console.warn('[Realtime] Sudah diinisialisasi, skip.');
} else {

window._klikproRealtimeInit = true;

// ── Referensi ke WebSocket aktif (untuk cleanup) ──
let _rtSocket = null;
let _rtReconnectTimer = null;
let _rtReconnectDelay = 3000; // ms, dengan exponential backoff

// ════════════════════════════════════════════════════════
//  ENTRY POINT — dipanggil dari initApp() setelah data awal dimuat
// ════════════════════════════════════════════════════════
function initRealtime() {
    // _SB_URL dan _SB_KEY adalah const di supabase.js — sudah tersedia
    // karena realtime.js di-load setelah supabase.js.
    const sbUrl = typeof _SB_URL !== 'undefined' ? _SB_URL : (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
    const sbKey = typeof _SB_KEY !== 'undefined' ? _SB_KEY : (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '');

    if (!sbUrl || !sbKey) {
        console.warn('[Realtime] _SB_URL atau _SB_KEY belum tersedia — realtime tidak aktif.');
        return;
    }

    _connectRealtime(sbUrl, sbKey);
}

// ════════════════════════════════════════════════════════
//  KONEKSI WEBSOCKET
// ════════════════════════════════════════════════════════
function _connectRealtime(sbUrl, sbKey) {
    if (_rtSocket) {
        try { _rtSocket.close(); } catch(e) {}
        _rtSocket = null;
    }

    // Supabase Realtime endpoint: wss://<project>.supabase.co/realtime/v1/websocket
    const wsUrl = sbUrl.replace(/^https?:\/\//, 'wss://') +
        '/realtime/v1/websocket?apikey=' + encodeURIComponent(sbKey) + '&vsn=1.0.0';

    try {
        _rtSocket = new WebSocket(wsUrl);
    } catch(e) {
        console.warn('[Realtime] Gagal membuat WebSocket:', e.message);
        _scheduleReconnect(sbUrl, sbKey);
        return;
    }

    _rtSocket.onopen = function() {
        _rtReconnectDelay = 3000; // reset backoff
        console.log('[Realtime] ✅ Terhubung ke Supabase Realtime');

        // ── Subscribe ke channel postgres_changes ──
        // Satu channel untuk semua table yang dipantau
        _rtSend({
            topic:   'realtime:klikpro',
            event:   'phx_join',
            payload: {
                config: {
                    broadcast:   { self: false },
                    presence:    { key: '' },
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
        try {
            const msg = JSON.parse(event.data);
            _handleMessage(msg);
        } catch(e) {
            // Bukan JSON valid — abaikan
        }
    };

    _rtSocket.onerror = function(err) {
        console.warn('[Realtime] WebSocket error:', err);
    };

    _rtSocket.onclose = function(e) {
        console.warn('[Realtime] Koneksi tertutup (code:', e.code, ')— mencoba reconnect...');
        _scheduleReconnect(sbUrl, sbKey);
    };
}

function _rtSend(payload) {
    if (_rtSocket && _rtSocket.readyState === WebSocket.OPEN) {
        _rtSocket.send(JSON.stringify(payload));
    }
}

function _scheduleReconnect(sbUrl, sbKey) {
    clearTimeout(_rtReconnectTimer);
    _rtReconnectTimer = setTimeout(() => {
        _rtReconnectDelay = Math.min(_rtReconnectDelay * 1.5, 30000); // max 30 detik
        _connectRealtime(sbUrl, sbKey);
    }, _rtReconnectDelay);
}

// ════════════════════════════════════════════════════════
//  ROUTING PESAN
// ════════════════════════════════════════════════════════
function _handleMessage(msg) {
    // Heartbeat — balas agar koneksi tidak timeout
    if (msg.event === 'heartbeat') {
        _rtSend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: msg.ref || '1' });
        return;
    }

    // Konfirmasi join berhasil
    if (msg.event === 'phx_reply' && msg.payload?.status === 'ok') {
        console.log('[Realtime] Channel terdaftar:', msg.topic);
        return;
    }

    // Postgres change event
    if (msg.event === 'postgres_changes') {
        const change = msg.payload;
        if (!change) return;

        const table  = change.table || (change.data && change.data.table);
        const type   = change.type  || (change.data && change.data.type);
        const record = change.record || (change.data && change.data.record) || {};
        const old    = change.old_record || (change.data && change.data.old_record) || {};

        // Cek format nested (Supabase v2 kadang bungkus di change.data)
        _dispatch(table, type, record, old);
        return;
    }

    // Format alternatif Supabase Realtime v2
    if (msg.payload && msg.payload.data) {
        const d = msg.payload.data;
        _dispatch(d.table, d.type, d.record || {}, d.old_record || {});
    }
}

function _dispatch(table, type, record, old) {
    if (!table || !type) return;

    if (table === 'kunjungan') {
        _onKunjunganChange(type, record, old);
    } else if (table === 'pasien') {
        _onPasienChange(type, record, old);
    }
}

// ════════════════════════════════════════════════════════
//  HANDLER: KUNJUNGAN
// ════════════════════════════════════════════════════════
function _onKunjunganChange(type, record, old) {
    if (type === 'INSERT') {
        _handleKunjunganInsert(record);
    } else if (type === 'UPDATE') {
        _handleKunjunganUpdate(record);
    } else if (type === 'DELETE') {
        _handleKunjunganDelete(old.id || record.id);
    }
}

// ── INSERT: kunjungan baru (pasien baru daftar dari device lain) ──
function _handleKunjunganInsert(record) {
    if (!record || !record.id) return;

    // Hanya proses jika tanggal cocok dengan filter aktif
    const filterDate = document.getElementById('filterDate');
    const today = filterDate ? filterDate.value : _getTodayISO();
    if (record.tgl !== today) return;

    // Hindari duplikat di cache
    if ((typeof kunjunganHariIni !== 'undefined') && kunjunganHariIni.find(k => k.id === record.id)) return;

    // Resolve nama pasien dari cache
    const pasien = (typeof allPatients !== 'undefined')
        ? allPatients.find(p => p.id === record.pasien_id)
        : null;

    const entry = _mapRecordToEntry(record, pasien);

    if (typeof kunjunganHariIni !== 'undefined') {
        kunjunganHariIni.push(entry);
    }

    // Re-render penuh karena INSERT butuh urutan ulang
    if (typeof renderKunjunganHariIni === 'function') {
        renderKunjunganHariIni();
    }

    if (typeof showToast === 'function') {
        showToast(`🔔 Pasien baru: ${entry.nama || 'Unknown'}`, 'info');
    }
}

// ── UPDATE: surgical patch — hanya update elemen yang berubah ──
function _handleKunjunganUpdate(record) {
    if (!record || !record.id) return;

    const kId = record.id;

    // Hanya proses jika tanggal sesuai filter aktif
    const filterDate = document.getElementById('filterDate');
    const today = filterDate ? filterDate.value : _getTodayISO();
    if (record.tgl && record.tgl !== today) return;

    // 1. Update cache kunjunganHariIni
    if (typeof kunjunganHariIni !== 'undefined') {
        const idx = kunjunganHariIni.findIndex(k => k.id === kId);
        if (idx !== -1) {
            const existing = kunjunganHariIni[idx];
            // Merge perubahan ke entry yang ada
            kunjunganHariIni[idx] = _mergeEntry(existing, record);
        }
    }

    // 2. Update _statusCache jika status_obat / status_bayar berubah
    if (window._statusCache && window._statusCache[kId]) {
        if (record.status_obat  !== undefined) window._statusCache[kId].obat  = !!record.status_obat;
        if (record.status_bayar !== undefined) window._statusCache[kId].bayar = !!record.status_bayar;
    }

    // 3. Surgical DOM patch — update hanya elemen yang bisa diidentifikasi
    _patchCardStatus(kId, record);
    _patchCardTTV(kId, record);
    _patchCardDiagnosa(kId, record);
    _patchBadgeObat(kId, record);
    _patchBadgeBayar(kId, record);

    // 4. Jika status kunjungan berubah (Menunggu ↔ Selesai), re-render penuh
    //    karena warna card dan sorting berubah
    if (record.status !== undefined) {
        if (typeof renderKunjunganHariIni === 'function') {
            renderKunjunganHariIni();
        }
    }
}

// ── DELETE: hapus dari cache dan DOM ──
function _handleKunjunganDelete(kId) {
    if (!kId) return;

    if (typeof kunjunganHariIni !== 'undefined') {
        const idx = kunjunganHariIni.findIndex(k => k.id === kId);
        if (idx !== -1) kunjunganHariIni.splice(idx, 1);
    }

    if (typeof renderKunjunganHariIni === 'function') {
        renderKunjunganHariIni();
    }
}

// ════════════════════════════════════════════════════════
//  SURGICAL DOM PATCHES — per field
// ════════════════════════════════════════════════════════

/** Patch status kunjungan (Selesai / Menunggu) di status label card */
function _patchCardStatus(kId, record) {
    if (record.status === undefined) return;
    // Status label tidak punya ID unik — butuh re-render (sudah ditangani di caller)
}

/** Patch TTV di card jika field TTV berubah */
function _patchCardTTV(kId, record) {
    // TTV tidak punya elemen tersendiri dengan ID — skip surgical, biarkan re-render
    // jika status berubah (yang sudah trigger renderKunjunganHariIni di caller).
    // Jika hanya TTV yang berubah tanpa status, update cache saja sudah cukup untuk
    // next render. Tidak perlu full re-render hanya untuk TTV.
}

/** Patch diagnosa text di card */
function _patchCardDiagnosa(kId, record) {
    // Diagnosa tidak punya ID unik per card — sama seperti TTV
}

/** Surgical patch badge status obat */
function _patchBadgeObat(kId, record) {
    if (record.status_obat === undefined) return;
    const badge = document.getElementById(`badge_obat_${kId}`);
    if (!badge) return;

    const val     = !!record.status_obat;
    const label   = val ? '💊 Sudah' : '💊 Belum';
    const bg      = val ? 'rgba(5,150,105,0.12)'  : 'rgba(234,179,8,0.10)';
    const color   = val ? '#059669'               : '#b45309';
    const border  = val ? 'rgba(5,150,105,0.28)'  : 'rgba(234,179,8,0.28)';
    const shadow  = val ? 'rgba(5,150,105,0.15)'  : 'rgba(234,179,8,0.12)';

    badge.style.background  = bg;
    badge.style.color       = color;
    badge.style.border      = `1px solid ${border}`;
    badge.style.boxShadow   = `0 2px 6px ${shadow}`;

    const span = badge.querySelector('span');
    if (span) span.textContent = label;
}

/** Surgical patch badge status bayar */
function _patchBadgeBayar(kId, record) {
    if (record.status_bayar === undefined) return;
    const badge = document.getElementById(`badge_bayar_${kId}`);
    if (!badge) return;

    const val    = !!record.status_bayar;
    const label  = val ? '💰 Lunas' : '💰 Belum';
    const bg     = val ? 'rgba(5,150,105,0.12)'  : 'rgba(234,179,8,0.10)';
    const color  = val ? '#059669'               : '#b45309';
    const border = val ? 'rgba(5,150,105,0.28)'  : 'rgba(234,179,8,0.28)';
    const shadow = val ? 'rgba(5,150,105,0.15)'  : 'rgba(234,179,8,0.12)';

    badge.style.background  = bg;
    badge.style.color       = color;
    badge.style.border      = `1px solid ${border}`;
    badge.style.boxShadow   = `0 2px 6px ${shadow}`;

    const span = badge.querySelector('span');
    if (span) span.textContent = label;
}

// ════════════════════════════════════════════════════════
//  HANDLER: PASIEN
// ════════════════════════════════════════════════════════
function _onPasienChange(type, record, old) {
    if (!record || !record.id) return;

    if (type === 'UPDATE' || type === 'INSERT') {
        // Update cache allPatients
        if (typeof allPatients !== 'undefined') {
            const idx = allPatients.findIndex(p => p.id === record.id);
            if (idx !== -1) {
                allPatients[idx] = {
                    ...allPatients[idx],
                    nama:    record.nama    || allPatients[idx].nama,
                    nik:     record.nik     || allPatients[idx].nik,
                    jk:      record.jk      || allPatients[idx].jk,
                    tgl:     record.tgl_lahir || allPatients[idx].tgl,
                    alamat:  record.alamat  || allPatients[idx].alamat,
                    alergi:  record.alergi  || allPatients[idx].alergi
                };
            } else if (type === 'INSERT') {
                allPatients.push({
                    id: record.id, nama: record.nama, nik: record.nik,
                    jk: record.jk, tgl: record.tgl_lahir, alamat: record.alamat,
                    alergi: record.alergi || ''
                });
                // Update datalist autocomplete
                const listPasien = document.getElementById('list-pasien');
                if (listPasien && record.nama) {
                    const opt = document.createElement('option');
                    opt.value = record.nama;
                    listPasien.appendChild(opt);
                }
            }
        }

        // Jika pasien ini ada di kunjunganHariIni, patch nama di cache dan re-render
        if (typeof kunjunganHariIni !== 'undefined' && record.nama) {
            const changed = kunjunganHariIni.some(k => k.pasienId === record.id);
            if (changed) {
                kunjunganHariIni.forEach(k => {
                    if (k.pasienId === record.id) k.nama = record.nama;
                });
                if (typeof renderKunjunganHariIni === 'function') {
                    renderKunjunganHariIni();
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════

function _getTodayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

/** Map raw DB record ke format entry kunjunganHariIni */
function _mapRecordToEntry(record, pasien) {
    return {
        id:          record.id,
        pasienId:    record.pasien_id,
        nama:        pasien ? pasien.nama : '',
        waktu:       record.waktu,
        tgl:         record.tgl,
        td:          record.td,
        suhu:        record.suhu,
        nadi:        record.nadi,
        keluhan:     record.keluhan,
        diag:        record.diagnosa,
        status:      record.status || 'Menunggu',
        user_id:     record.user_id || null,
        req_lab:     record.req_lab || null,
        dokterNama:  null,
        status_obat:  !!record.status_obat,
        status_bayar: !!record.status_bayar
    };
}

/** Merge record dari Supabase ke entry cache yang sudah ada */
function _mergeEntry(existing, record) {
    return {
        ...existing,
        td:          record.td          !== undefined ? record.td          : existing.td,
        suhu:        record.suhu        !== undefined ? record.suhu        : existing.suhu,
        nadi:        record.nadi        !== undefined ? record.nadi        : existing.nadi,
        keluhan:     record.keluhan     !== undefined ? record.keluhan     : existing.keluhan,
        diag:        record.diagnosa    !== undefined ? record.diagnosa    : existing.diag,
        status:      record.status      !== undefined ? record.status      : existing.status,
        req_lab:     record.req_lab     !== undefined ? record.req_lab     : existing.req_lab,
        status_obat: record.status_obat !== undefined ? !!record.status_obat  : existing.status_obat,
        status_bayar:record.status_bayar!== undefined ? !!record.status_bayar : existing.status_bayar,
        user_id:     record.user_id     !== undefined ? record.user_id     : existing.user_id
    };
}

// ════════════════════════════════════════════════════════
//  CLEANUP — panggil jika user logout
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

// Ekspor entry point ke global
window.initRealtime = initRealtime;

console.log('[realtime] ✅ Modul Supabase Realtime siap — panggil initRealtime() untuk mengaktifkan.');

} // end guard
