// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE CLIENT (CONSOLIDATED & SECURED)
//
//  ✅ Integrasi dengan Supabase Edge Function (Custom JWT)
//  ✅ supabase-secure.js, supabase-patch.js, supabase-stok.js, 
//     supabase-biaya.js sudah digabung.
//  Cukup load 1 file ini saja.
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  SHARED UTILITIES
// ════════════════════════════════════════════════════════

/** Escape HTML — satu-satunya definisi kanonik. */
if (typeof window.escHtml !== 'function') {
    window.escHtml = function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
}

/** Format Rupiah — satu-satunya definisi kanonik. */
if (typeof window.fmtRp !== 'function') {
    window.fmtRp = function fmtRp(n) {
        return Number(n || 0).toLocaleString('id-ID');
    };
}

/**
 * Generic accordion toggle.
 */
window.accToggle = function accToggle(id) {
    if (!window._accordionState) window._accordionState = {};
    const body  = document.getElementById(id + '_body');
    const arrow = document.getElementById(id + '_arrow');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
    window._accordionState[id] = !isOpen;
};

/**
 * Badge status kunjungan — satu-satunya definisi kanonik.
 */
window.badgeKunjungan = function badgeKunjungan(type) {
    switch (type) {
        case 'selesai':
            return `<span style="background:#ecfdf5;color:#059669;border:1px solid #6ee7b7;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">✅ Selesai</span>`;
        case 'lunas':
            return `<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">✓ LUNAS</span>`;
        case 'menunggu':
        default:
            return `<span style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">⏳ Menunggu</span>`;
    }
};

// ════════════════════════════════════════════════════════
// SUPABASE CLIENT & FETCH WRAPPER
// ════════════════════════════════════════════════════════

const _SB_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
const _SB_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';

// ── Helper fetch ke Supabase REST API (DIUPDATE UNTUK JWT) ──
async function _sbFetch(path, opts = {}) {
    // 1. Ambil Custom JWT dari localStorage yang diset oleh login-pin
    const jwtToken = localStorage.getItem('session_jwt');
    
    // 2. Tentukan header Authorization: Jika ada JWT, gunakan itu. Jika tidak, fallback ke Anon Key.
    const authHeader = jwtToken ? 'Bearer ' + jwtToken : 'Bearer ' + _SB_KEY;

    const res = await fetch(_SB_URL + '/rest/v1/' + path, {
        headers: {
            'apikey':        _SB_KEY,         // Apikey tetap dibutuhkan oleh API Gateway Supabase
            'Authorization': authHeader,      // Authorization header menentukan role RLS (authenticated/anon)
            'Content-Type':  'application/json',
            'Prefer':        opts.prefer || 'return=representation',
            ...(opts.headers || {})
        },
        method: opts.method || 'GET',
        body:   opts.body ? JSON.stringify(opts.body) : undefined
    });
    
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Supabase error ' + res.status);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
}

// ═══════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════
async function sb_getSettings() {
    const rows = await _sbFetch('konfigurasi?select=key,value');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    const _toBool = v => v === true || v === 'true' || v === '1';
    window._stokAktif  = _toBool(settings['stok_aktif']);
    window._biayaAktif = _toBool(settings['biaya_aktif']);
    window._labAktif   = _toBool(settings['lab_aktif']);

    const dokter = await _sbFetch('dokter?select=*');
    return { status: 'success', settings, dokter };
}

async function sb_initFlags() {
    try {
        const rows = await _sbFetch('konfigurasi?select=key,value');
        const cfg = {};
        rows.forEach(r => { cfg[r.key] = r.value; });
        const _toBool = v => v === true || v === 'true' || v === '1';
        window._stokAktif  = _toBool(cfg['stok_aktif']);
        window._biayaAktif = _toBool(cfg['biaya_aktif']);
        window._labAktif   = _toBool(cfg['lab_aktif']);
    } catch(e) {
        console.warn('[sb_initFlags] Gagal memuat flags:', e.message);
    }
}

async function sb_saveSettings(payload) {
    const updates = [];
    const keys = ['klinik_nama','klinik_title','klinik_alamat','klinik_telp',
                   'klinik_email','jabatan_medis','ocr_api_key','ss_env',
                   'ss_org_id','ss_client_id','ss_client_secret',
                   'ai_gemini','ai_groq','ai_openrouter','ai_openai','ai_mistral',
                   'module_access','lab_aktif','stok_aktif','biaya_aktif','klinik_logo'];
                   
    for (const key of keys) {
        if (payload[key] === undefined) continue;
        if (key === 'ss_client_secret' && !payload[key]) continue;
        updates.push(
            _sbFetch('konfigurasi', {
                method: 'POST',
                body: { key, value: payload[key] },
                prefer: 'resolution=merge-duplicates,return=minimal'
            })
        );
    }
    await Promise.all(updates);

    if (payload.dokter) {
        const dokterList = JSON.parse(payload.dokter);
        await _sbFetch('dokter?id=neq.00000000-0000-0000-0000-000000000000', {
            method: 'DELETE',
            prefer: 'return=minimal'
        });
        if (dokterList.length > 0) {
            await _sbFetch('dokter', { method: 'POST', body: dokterList, prefer: 'return=minimal' });
        }
    }
    return { status: 'success' };
}

// ═══════════════════════════════════════
//  USERS & AUTH
// ═══════════════════════════════════════
async function sb_getUsers() {
    const data = await _sbFetch('users?select=id,nama,jabatan&order=nama.asc');
    return { status: 'success', data };
}

async function sb_saveUser(payload) {
    const { userId, nama, jabatan, pin } = payload;
    const pinHash = pin ? await _sha256(pin) : null;

    if (userId) {
        const body = {};
        if (pinHash) body.pin_hash = pinHash;
        if (nama)    body.nama     = nama;
        if (jabatan) body.jabatan  = jabatan;
        await _sbFetch(`users?id=eq.${userId}`, { method: 'PATCH', body, prefer: 'return=minimal' });
        return { status: 'success', userId };
    } else {
        const rows = await _sbFetch('users', {
            method: 'POST',
            body: { nama, jabatan, pin_hash: pinHash },
            prefer: 'return=representation'
        });
        const newId = rows && rows[0] ? rows[0].id : null;
        return { status: 'success', userId: newId };
    }
}

async function sb_deleteUser(userId) {
    await _sbFetch(`users?id=eq.${userId}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_tambahDokterDariUser({ nama, jabatan, nik, ihs, sip, spesialis, user_id }) {
    const existing = await _sbFetch(`dokter?user_id=eq.${user_id}&select=id`);
    if (existing && existing.length > 0) return { status: 'already_exists' };

    await _sbFetch('dokter', {
        method: 'POST',
        body: { nama, jabatan: jabatan || 'Dokter', nik: nik || '', ihs: ihs || '', sip: sip || '', spesialis: spesialis || '', user_id },
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_getDokterByUserId(userId) {
    if (!userId) return null;
    const rows = await _sbFetch(`dokter?user_id=eq.${userId}&select=*&limit=1`);
    return rows.length > 0 ? rows[0] : null;
}

async function sb_upsertDokterFromUser({ userId, nama, nik, ihs, sip, spesialis }) {
    const existing = await _sbFetch(`dokter?user_id=eq.${userId}&select=id`);
    const body = { nama, nik: nik||'', ihs: ihs||'', sip: sip||'', spesialis: spesialis||'', user_id: userId, jabatan: 'Dokter' };
    if (existing && existing.length > 0) {
        await _sbFetch(`dokter?id=eq.${existing[0].id}`, { method: 'PATCH', body, prefer: 'return=minimal' });
        return { status: 'updated', id: existing[0].id };
    } else {
        await _sbFetch('dokter', { method: 'POST', body, prefer: 'return=minimal' });
        return { status: 'created' };
    }
}

async function sb_deleteDokterByUserId(userId) {
    await _sbFetch(`dokter?user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { status: 'success' };
}

async function sb_deleteDokterByNama(nama) {
    if (!nama) return { status: 'skip' };
    await _sbFetch(`dokter?nama=ilike.${encodeURIComponent(nama)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { status: 'success' };
}

async function _sha256(text) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ═══════════════════════════════════════
//  PASIEN & KUNJUNGAN
// ═══════════════════════════════════════
async function sb_initData(filterDate) {
    const [pasien, kunjungan, users] = await Promise.all([
        _sbFetch('pasien?select=id,nama,nik,jk,tgl_lahir,alamat,alergi&order=nama.asc'),
        _sbFetch(`kunjungan?tgl=eq.${filterDate}&select=*&order=waktu.asc`),
        _sbFetch('users?select=id,nama,jabatan&order=nama.asc')
    ]);

    window._usersCache = users || [];

    const hariIni = kunjungan.map(k => {
        const p = pasien.find(p => p.id === k.pasien_id) || {};
        const dokterUser = k.user_id ? users.find(u => u.id === k.user_id) : null;
        const dokterNama = (dokterUser && dokterUser.jabatan &&
                           dokterUser.jabatan.toLowerCase() === 'dokter')
                          ? dokterUser.nama : null;
        return {
            id: k.id, pasienId: k.pasien_id,
            nama: p.nama || '', waktu: k.waktu, tgl: k.tgl,
            td: k.td, suhu: k.suhu, nadi: k.nadi, keluhan: k.keluhan,
            diag: k.diagnosa, status: k.status || 'Menunggu',
            user_id: k.user_id || null,
            req_lab: k.req_lab || null,
            dokterNama,
            status_obat:  !!k.status_obat,
            status_bayar: !!k.status_bayar
        };
    });

    return {
        pasien: pasien.map(p => ({
            id: p.id, nama: p.nama, nik: p.nik,
            jk: p.jk, tgl: p.tgl_lahir, alamat: p.alamat,
            alergi: p.alergi || ''
        })),
        hariIni
    };
}

async function sb_checkAndUpsertPasien(payload) {
    const { nama, nik, tgl_lahir, jk, alamat, localDate, createVisitToday, localTime } = payload;

    let pasienRow = null;
    if (nik) {
        const rows = await _sbFetch(`pasien?nik=eq.${encodeURIComponent(nik)}&limit=1`);
        if (rows.length) pasienRow = rows[0];
    }
    if (!pasienRow) {
        const namaTrim    = (nama || '').trim();
        const namaEncoded = encodeURIComponent(namaTrim);
        const rows = await _sbFetch(`pasien?nama=eq.${namaEncoded}&limit=1`);
        if (rows.length) pasienRow = rows[0];
    }

    if (!pasienRow) {
        const inserted = await _sbFetch('pasien', {
            method: 'POST',
            body: { nama, nik: nik||null, jk: jk||'L', tgl_lahir: tgl_lahir||null, alamat: alamat||null }
        });
        pasienRow = inserted[0];
    } else if (tgl_lahir || alamat) {
        await _sbFetch(`pasien?id=eq.${pasienRow.id}`, {
            method: 'PATCH',
            body: { ...(tgl_lahir && {tgl_lahir}), ...(alamat && {alamat}), ...(jk && {jk}), ...(nik && {nik}) },
            prefer: 'return=minimal'
        });
    }

    let kunjunganHariIni = null;
    if (createVisitToday && localDate) {
        const existing = await _sbFetch(
            `kunjungan?pasien_id=eq.${pasienRow.id}&tgl=eq.${localDate}&select=*&limit=1`
        );

        if (existing && existing.length > 0) {
            kunjunganHariIni = existing[0];
        } else {
            try {
                const inserted = await _sbFetch('kunjungan', {
                    method: 'POST',
                    body: { pasien_id: pasienRow.id, tgl: localDate, waktu: localTime || '00:00', status: 'Menunggu' },
                    prefer: 'resolution=ignore-duplicates,return=representation'
                });
                if (inserted && inserted.length > 0) {
                    kunjunganHariIni = inserted[0];
                } else {
                    const fallback = await _sbFetch(
                        `kunjungan?pasien_id=eq.${pasienRow.id}&tgl=eq.${localDate}&select=*&limit=1`
                    );
                    kunjunganHariIni = (fallback && fallback.length > 0) ? fallback[0] : null;
                }
            } catch(e) {
                const fallback = await _sbFetch(
                    `kunjungan?pasien_id=eq.${pasienRow.id}&tgl=eq.${localDate}&select=*&limit=1`
                );
                kunjunganHariIni = (fallback && fallback.length > 0) ? fallback[0] : null;
            }
        }
    }

    const riwayat = await _sbFetch(
        `kunjungan?pasien_id=eq.${pasienRow.id}&order=tgl.desc,waktu.desc&select=*`
    );

    if (!window._usersCache || window._usersCache.length === 0) {
        try {
            const users = await _sbFetch('users?select=id,nama,jabatan&order=nama.asc');
            window._usersCache = users || [];
        } catch(e) {
            window._usersCache = [];
        }
    }

    const _mapKunjungan = r => ({
        id: r.id, tgl: r.tgl, waktu: r.waktu,
        user_id: r.user_id || null,
        dokterNama: _resolveDokterNama(r.user_id),
        td: r.td, nadi: r.nadi, suhu: r.suhu, rr: r.rr,
        bb: r.bb, tb: r.tb,
        keluhan: r.keluhan, fisik: r.fisik,
        diag: r.diagnosa, diagnosa: r.diagnosa, diagnosa2: r.diagnosa2,
        terapi: r.terapi, surat_sakit: r.surat_sakit,
        req_lab: r.req_lab || null,
        riwayat_penyakit: r.riwayat_penyakit || null,
        status: r.status
    });

    return {
        pasien: {
            id: pasienRow.id, nama: pasienRow.nama, nik: pasienRow.nik,
            jk: pasienRow.jk, tgl_lahir: pasienRow.tgl_lahir, alamat: pasienRow.alamat,
            alergi: pasienRow.alergi || ''
        },
        kunjunganHariIni: kunjunganHariIni ? _mapKunjungan(kunjunganHariIni) : null,
        riwayat: riwayat.map(_mapKunjungan)
    };
}

async function sb_savePasienOnly(payload) {
    const { pasienId, nama, nik, jk, tgl_lahir, alamat, alergi } = payload;
    if (pasienId) {
        await _sbFetch(`pasien?id=eq.${pasienId}`, {
            method: 'PATCH',
            body: { nama, nik, jk, tgl_lahir, alamat, alergi: alergi || null },
            prefer: 'return=minimal'
        });
        return { status: 'Sukses', pasienId };
    } else {
        const rows = await _sbFetch('pasien', { method: 'POST', body: { nama, nik, jk, tgl_lahir, alamat, alergi: alergi || null } });
        return { status: 'Sukses', pasienId: rows[0]?.id };
    }
}

function _resolveDokterNama(userId) {
    if (!userId) return null;
    const users = window._usersCache || [];
    const u = users.find(u => u.id === userId);
    if (!u) return null;
    return (u.jabatan && u.jabatan.toLowerCase() === 'dokter') ? u.nama : null;
}

async function sb_getKunjunganById(kunjunganId) {
    const rows = await _sbFetch(`kunjungan?id=eq.${kunjunganId}&select=*&limit=1`);
    if (!rows.length) return null;
    const r = rows[0];
    return {
        id: r.id, pasien_id: r.pasien_id, tgl: r.tgl, waktu: r.waktu,
        user_id: r.user_id || null,
        dokterNama: _resolveDokterNama(r.user_id),
        td: r.td, nadi: r.nadi, suhu: r.suhu, rr: r.rr,
        bb: r.bb, tb: r.tb,
        keluhan: r.keluhan, fisik: r.fisik,
        diag: r.diagnosa, diagnosa2: r.diagnosa2,
        terapi: r.terapi, surat_sakit: r.surat_sakit,
        req_lab: r.req_lab || null,
        riwayat_penyakit: r.riwayat_penyakit || null,
        status: r.status
    };
}

async function sb_saveKunjungan(payload) {
    const {
        pasienId, kunjunganId, localDate, localTime,
        userId,
        nama, nik, tgl_lahir, jk, alamat,
        td, nadi, rr, suhu, bb, tb,
        keluhan, fisik, diagnosa, diagnosa2, terapi, suratSakit,
        alergi, req_lab, riwayat_penyakit
    } = payload;

    if (pasienId && pasienId !== 'null' && pasienId !== 'undefined' && nama) {
        await _sbFetch(`pasien?id=eq.${pasienId}`, {
            method: 'PATCH',
            body: { nama, nik, jk, ...(tgl_lahir && {tgl_lahir}), ...(alamat && {alamat}), alergi: alergi || null },
            prefer: 'return=minimal'
        });
    }

    const _num = v => (v === '' || v === null || v === undefined) ? null : v;
    const isSelesai = diagnosa && terapi;

    let _finalKunjId  = kunjunganId || null;
    let _insertFields = {};

    if (!kunjunganId && pasienId && localDate) {
        try {
            const _exist = await _sbFetch(
                `kunjungan?pasien_id=eq.${pasienId}&tgl=eq.${localDate}&select=id&limit=1`
            );
            if (_exist && _exist.length > 0) {
                _finalKunjId  = _exist[0].id;
                _insertFields = {};
            } else {
                _insertFields = { pasien_id: pasienId, tgl: localDate, waktu: localTime || '00:00' };
            }
        } catch(e) {
            _insertFields = { pasien_id: pasienId, tgl: localDate, waktu: localTime || '00:00' };
        }
    }

    const body = {
        ..._insertFields,
        user_id: userId || null,
        td: td || null,
        nadi:  _num(nadi),
        rr:    _num(rr),
        suhu:  _num(suhu),
        bb:    _num(bb),
        tb:    _num(tb),
        keluhan: keluhan || null,
        fisik:   fisik   || null,
        diagnosa:  diagnosa  || null,
        diagnosa2: diagnosa2 || null,
        terapi:    terapi    || null,
        surat_sakit: suratSakit || null,
        req_lab: req_lab || null,
        riwayat_penyakit: riwayat_penyakit || null,
        status: isSelesai ? 'Selesai' : 'Menunggu'
    };

    let kId = _finalKunjId;
    if (_finalKunjId) {
        delete body.tgl;
        delete body.waktu;
        delete body.pasien_id;
        await _sbFetch(`kunjungan?id=eq.${_finalKunjId}`, {
            method: 'PATCH', body, prefer: 'return=minimal'
        });
    } else {
        const rows = await _sbFetch('kunjungan', { method: 'POST', body });
        kId = rows[0]?.id;
    }

    return { status: 'Sukses', kunjunganId: kId };
}

// ════════════════════════════════════════════════════════
//  MODUL STOK OBAT
// ════════════════════════════════════════════════════════
async function sb_getObat({ search = '', kategori = '' } = {}) {
    let path = 'obat?select=*&order=nama.asc';
    if (search)   path += `&nama=ilike.*${encodeURIComponent(search)}*`;
    if (kategori) path += `&kategori=eq.${encodeURIComponent(kategori)}`;
    return await _sbFetch(path);
}

async function sb_getObatById(id) {
    const rows = await _sbFetch(`obat?id=eq.${id}&limit=1`);
    return rows[0] || null;
}

async function sb_saveObat(payload) {
    const {
        id, nama, kategori, satuan, harga_beli, harga_jual,
        stok, stok_minimum, frekuensi_default, keterangan, exp_date
    } = payload;

    const body = {
        nama:               (nama || '').trim(),
        kategori:           kategori || 'Umum',
        satuan:             satuan   || 'tablet',
        harga_beli:         harga_beli  ? Number(harga_beli)  : 0,
        harga_jual:         harga_jual  ? Number(harga_jual)  : 0,
        stok:               stok        ? Number(stok)        : 0,
        stok_minimum:       stok_minimum? Number(stok_minimum): 5,
        frekuensi_default:  frekuensi_default || '3x1',
        keterangan:         keterangan || null,
        exp_date:           exp_date   || null
    };

    if (id) {
        await _sbFetch(`obat?id=eq.${id}`, {
            method: 'PATCH', body, prefer: 'return=minimal'
        });
        return { status: 'success', id };
    } else {
        const rows = await _sbFetch('obat', {
            method: 'POST', body, prefer: 'return=representation'
        });
        return { status: 'success', id: rows[0]?.id };
    }
}

async function sb_deleteObat(id) {
    await _sbFetch(`obat?id=eq.${id}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_kurangiStok(obatId, jumlah) {
    try {
        await _sbFetch(`rpc/kurangi_stok_obat`, {
            method: 'POST',
            body: { p_obat_id: obatId, p_jumlah: Number(jumlah) }
        });
    } catch (e) {
        const obat = await sb_getObatById(obatId);
        if (obat) {
            const newStok = Math.max(0, (obat.stok || 0) - Number(jumlah));
            await _sbFetch(`obat?id=eq.${obatId}`, {
                method: 'PATCH',
                body: { stok: newStok },
                prefer: 'return=minimal'
            });
        }
    }
    return { status: 'success' };
}

async function sb_tambahStok(obatId, jumlah, harga_beli_baru) {
    const obat = await sb_getObatById(obatId);
    if (!obat) throw new Error('Obat tidak ditemukan');
    const body = { stok: (obat.stok || 0) + Number(jumlah) };
    if (harga_beli_baru) body.harga_beli = Number(harga_beli_baru);
    await _sbFetch(`obat?id=eq.${obatId}`, {
        method: 'PATCH', body, prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_getResepByKunjungan(kunjunganId) {
    const rows = await _sbFetch(
        `resep_item?kunjungan_id=eq.${kunjunganId}&select=*,obat(id,nama,satuan,harga_jual)&order=created_at.asc`
    );
    return rows;
}

async function sb_saveResep(kunjunganId, items) {
    let resepLama = [];
    try {
        resepLama = await _sbFetch(
            `resep_item?kunjungan_id=eq.${kunjunganId}&select=obat_id,jumlah`
        );
    } catch(e) { resepLama = []; }

    await _sbFetch(`resep_item?kunjungan_id=eq.${kunjunganId}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });

    if (!items || items.length === 0) {
        for (const lama of resepLama) {
            if (lama.obat_id && lama.jumlah) {
                const obat = await sb_getObatById(lama.obat_id).catch(() => null);
                if (obat) {
                    await _sbFetch(`obat?id=eq.${lama.obat_id}`, {
                        method: 'PATCH',
                        body: { stok: (obat.stok || 0) + Number(lama.jumlah) },
                        prefer: 'return=minimal'
                    }).catch(() => {});
                }
            }
        }
        return { status: 'success' };
    }

    const rows = items.map(item => ({
        kunjungan_id:  kunjunganId,
        obat_id:       item.obat_id,
        nama_obat:     item.nama_obat,
        jumlah:        Number(item.jumlah) || 1,
        frekuensi:     item.frekuensi || '3x1',
        catatan:       item.catatan || null,
        harga_satuan:  Number(item.harga_satuan) || 0,
        subtotal:      (Number(item.jumlah) || 1) * (Number(item.harga_satuan) || 0)
    }));

    await _sbFetch('resep_item', {
        method: 'POST', body: rows, prefer: 'return=minimal'
    });

    const lamaMap = {};
    resepLama.forEach(r => {
        if (r.obat_id) lamaMap[r.obat_id] = (lamaMap[r.obat_id] || 0) + Number(r.jumlah);
    });

    for (const item of rows) {
        if (!item.obat_id) continue;
        const jumlahBaru = Number(item.jumlah) || 0;
        const jumlahLama = lamaMap[item.obat_id] || 0;
        const selisih    = jumlahBaru - jumlahLama;

        if (selisih > 0) {
            await sb_kurangiStok(item.obat_id, selisih).catch(() => {});
        } else if (selisih < 0) {
            const obat = await sb_getObatById(item.obat_id).catch(() => null);
            if (obat) {
                await _sbFetch(`obat?id=eq.${item.obat_id}`, {
                    method: 'PATCH',
                    body: { stok: (obat.stok || 0) + Math.abs(selisih) },
                    prefer: 'return=minimal'
                }).catch(() => {});
            }
        }
        delete lamaMap[item.obat_id]; 
    }

    for (const [obatId, jumlahLama] of Object.entries(lamaMap)) {
        const obat = await sb_getObatById(obatId).catch(() => null);
        if (obat && jumlahLama > 0) {
            await _sbFetch(`obat?id=eq.${obatId}`, {
                method: 'PATCH',
                body: { stok: (obat.stok || 0) + jumlahLama },
                prefer: 'return=minimal'
            }).catch(() => {});
        }
    }

    return { status: 'success' };
}

async function sb_getKategoriObat() {
    const rows = await _sbFetch('obat?select=kategori&order=kategori.asc');
    const unique = [...new Set(rows.map(r => r.kategori).filter(Boolean))];
    return unique;
}

async function sb_importObat(rows) {
    let sukses = 0, gagal = 0;
    const errors = [];

    for (const row of rows) {
        if (!row.nama || !row.nama.trim()) {
            gagal++;
            errors.push('Baris dilewati: nama kosong');
            continue;
        }
        try {
            await sb_saveObat(row);
            sukses++;
        } catch(e) {
            gagal++;
            errors.push(`${row.nama}: ${e.message || 'error'}`);
        }
    }
    return { sukses, gagal, errors };
}

// ════════════════════════════════════════════════════════
//  MODUL PEMBIAYAAN
// ════════════════════════════════════════════════════════
async function sb_getTarif() {
    return await _sbFetch('tarif_layanan?select=*&order=kategori.asc,nama.asc');
}

async function sb_saveTarif(payload) {
    const { id, nama, kategori, harga, keterangan, aktif, sub_group, sub_group_order, sub_group_2 } = payload;
    const body = {
        nama:             (nama || '').trim(),
        kategori:         kategori  || 'Umum',
        harga:            Number(harga) || 0,
        keterangan:       keterangan || null,
        aktif:            aktif !== false,
        sub_group:        sub_group || null,
        sub_group_order:  sub_group_order != null ? Number(sub_group_order) : 99,
        sub_group_2:      sub_group_2 || null
    };
    if (id) {
        await _sbFetch(`tarif_layanan?id=eq.${id}`, {
            method: 'PATCH', body, prefer: 'return=minimal'
        });
        return { status: 'success', id };
    } else {
        const rows = await _sbFetch('tarif_layanan', {
            method: 'POST', body, prefer: 'return=representation'
        });
        return { status: 'success', id: rows[0]?.id };
    }
}

async function sb_deleteTarif(id) {
    await _sbFetch(`tarif_layanan?id=eq.${id}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_getTagihan(kunjunganId) {
    const rows = await _sbFetch(
        `tagihan?kunjungan_id=eq.${kunjunganId}&select=*,tagihan_item(*)`
    );
    return rows[0] || null;
}

async function sb_saveTagihan(kunjunganId, pasienId, items, diskon, catatan) {
    const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const nominalDiskon = Number(diskon) || 0;
    const total = Math.max(0, subtotal - nominalDiskon);

    const existing = await _sbFetch(
        `tagihan?kunjungan_id=eq.${kunjunganId}&select=id&limit=1`
    );

    let tagihanId;
    const tagihanBody = {
        kunjungan_id: kunjunganId,
        pasien_id:    pasienId,
        subtotal,
        diskon:       nominalDiskon,
        total,
        catatan:      catatan || null,
        status:       'Lunas'
    };

    if (existing.length > 0) {
        tagihanId = existing[0].id;
        await _sbFetch(`tagihan?id=eq.${tagihanId}`, {
            method: 'PATCH', body: tagihanBody, prefer: 'return=minimal'
        });
        await _sbFetch(`tagihan_item?tagihan_id=eq.${tagihanId}`, {
            method: 'DELETE', prefer: 'return=minimal'
        });
    } else {
        const rows = await _sbFetch('tagihan', {
            method: 'POST', body: tagihanBody, prefer: 'return=representation'
        });
        tagihanId = rows[0]?.id;
    }

    if (items.length > 0 && tagihanId) {
        const itemRows = items.map(i => ({
            tagihan_id:   tagihanId,
            nama_item:    i.nama_item,
            kategori:     i.kategori  || 'Layanan',
            jumlah:       Number(i.jumlah) || 1,
            harga_satuan: Number(i.harga_satuan) || 0,
            subtotal:     (Number(i.jumlah) || 1) * (Number(i.harga_satuan) || 0),
            keterangan:   i.keterangan || null
        }));
        await _sbFetch('tagihan_item', {
            method: 'POST', body: itemRows, prefer: 'return=minimal'
        });
    }

    return { status: 'success', tagihanId, total };
}

async function sb_updateStatusTagihan(tagihanId, status) {
    await _sbFetch(`tagihan?id=eq.${tagihanId}`, {
        method: 'PATCH',
        body: { status },
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_getLaporanTagihan(tglMulai, tglSelesai) {
    let path = `tagihan?select=*,tagihan_item(*),pasien(nama,nik)&order=created_at.desc`;
    if (tglMulai)   path += `&created_at=gte.${tglMulai}T00:00:00`;
    if (tglSelesai) path += `&created_at=lte.${tglSelesai}T23:59:59`;
    return await _sbFetch(path);
}

async function sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData) {
    const tarif = await sb_getTarif();
    const tarifAktif = tarif.filter(t => t.aktif);
    const items = [];

    const addItem = (nama, kategori, harga, jumlah = 1, ket = null) => {
        items.push({ nama_item: nama, kategori, jumlah, harga_satuan: Number(harga) || 0, keterangan: ket });
    };

    const hasTtv     = kunjunganData.td || kunjunganData.nadi || kunjunganData.suhu;
    const hasKeluhan = kunjunganData.keluhan;
    const hasFisik   = kunjunganData.fisik;
    const hasDiag    = kunjunganData.diag || kunjunganData.diagnosa;

    const adaPemeriksaanMedis = hasTtv || hasKeluhan || hasFisik || hasDiag;
    if (adaPemeriksaanMedis) {
        addItem('Pemeriksaan & Konsultasi Dokter', 'Pemeriksaan', 50000);
    }

    if (hasTtv) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Vital Sign');
        if (t) addItem('Pemeriksaan Vital Sign', 'Pemeriksaan', t.harga);
    }

    if (hasKeluhan) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Anamnesa');
        if (t) addItem('Anamnesa (Keluhan Utama)', 'Pemeriksaan', t.harga);
    }

    if (hasFisik) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Pemeriksaan Fisik');
        if (t) addItem('Pemeriksaan Fisik Umum', 'Pemeriksaan', t.harga);
    }

    if (hasDiag) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Konsultasi Medis');
        if (t) addItem('Konsultasi / Visite Dokter', 'Pemeriksaan', t.harga);
    }

    const labFields = [
        { key: 'lab_gds',       slugs: ['lab_hasil_gds', 'lab_gds'],               nama: 'GDS' },
        { key: 'lab_chol',      slugs: ['lab_hasil_kolesterol', 'lab_chol'],        nama: 'Kolesterol' },
        { key: 'lab_ua',        slugs: ['lab_hasil_asam_urat', 'lab_ua'],           nama: 'Asam Urat' },
        { key: 'lab_hb',        slugs: ['lab_hasil_hemoglobin_hb_', 'lab_hb'],      nama: 'Hemoglobin (HB)' },
        { key: 'lab_trombosit', slugs: ['lab_hasil_trombosit', 'lab_trombosit'],    nama: 'Trombosit' },
        { key: 'lab_leukosit',  slugs: ['lab_hasil_leukosit', 'lab_leukosit'],      nama: 'Leukosit' },
        { key: 'lab_eritrosit', slugs: ['lab_hasil_eritrosit', 'lab_eritrosit'],    nama: 'Eritrosit' },
        { key: 'lab_hematokrit',slugs: ['lab_hasil_hematokrit', 'lab_hematokrit'],  nama: 'Hematokrit' },
        { key: 'lab_hiv',       slugs: ['lab_hasil_hiv', 'lab_hiv'],                nama: 'HIV' },
        { key: 'lab_sifilis',   slugs: ['lab_hasil_sifilis', 'lab_sifilis'],        nama: 'Sifilis' },
        { key: 'lab_hepatitis', slugs: ['lab_hasil_hepatitis_b', 'lab_hepatitis'],  nama: 'Hepatitis B' },
        { key: 'lab_hdl',       slugs: ['lab_hasil_hdl', 'lab_hdl'],                nama: 'HDL' },
        { key: 'lab_ldl',       slugs: ['lab_hasil_ldl', 'lab_ldl'],                nama: 'LDL' },
        { key: 'lab_tg',        slugs: ['lab_hasil_trigliserida', 'lab_tg'],        nama: 'Trigliserida' },
        { key: 'lab_gdp',       slugs: ['lab_hasil_gdp', 'lab_gdp'],                nama: 'GDP' },
        { key: 'lab_hba1c',     slugs: ['lab_hasil_hba1c', 'lab_hba1c'],            nama: 'HbA1c' },
        { key: 'lab_sgot',      slugs: ['lab_hasil_sgot', 'lab_sgot'],              nama: 'SGOT' },
        { key: 'lab_sgpt',      slugs: ['lab_hasil_sgpt', 'lab_sgpt'],              nama: 'SGPT' },
        { key: 'lab_ureum',     slugs: ['lab_hasil_ureum', 'lab_ureum'],            nama: 'Ureum' },
        { key: 'lab_creatinin', slugs: ['lab_hasil_creatinin', 'lab_creatinin'],    nama: 'Creatinin' }
    ];

    let reqLabObj = {};
    try {
        if (kunjunganData.req_lab) {
            reqLabObj = typeof kunjunganData.req_lab === 'string'
                ? JSON.parse(kunjunganData.req_lab)
                : kunjunganData.req_lab;
        }
    } catch(e) { reqLabObj = {}; }

    labFields.forEach(f => {
        const hasInReqLab = f.slugs.some(s => reqLabObj[s] && reqLabObj[s] !== '—' && String(reqLabObj[s]).trim() !== '');
        const hasLegacy   = kunjunganData[f.key] && kunjunganData[f.key] !== '—';
        if (!hasInReqLab && !hasLegacy) return;
        const t = tarifAktif.find(x => x.kategori === 'Laboratorium' && x.nama === f.nama);
        if (t) addItem('Lab: ' + f.nama, 'Laboratorium', t.harga);
    });

    try {
        const penunjangRows = await _sbFetch(`penunjang_item?kunjungan_id=eq.${kunjunganId}&select=jenis`);
        penunjangRows.forEach(r => {
            if (!r.jenis) return;
            const t = tarifAktif.find(x => x.kategori === 'Penunjang' && x.nama === r.jenis);
            const harga = t ? t.harga : 0;
            addItem('Penunjang: ' + r.jenis, 'Penunjang', harga);
        });
    } catch(e) {}

    try {
        const tindakanRows = await _sbFetch(`tindakan_item?kunjungan_id=eq.${kunjunganId}&select=*`);
        tindakanRows.forEach(r => {
            addItem(r.nama_tindakan, 'Tindakan', r.harga_satuan, r.jumlah || 1, r.catatan || null);
        });
    } catch(e) {}

    if (window._stokAktif) {
        try {
            const resepRows = await sb_getResepByKunjungan(kunjunganId);
            resepRows.forEach(r => {
                addItem(r.nama_obat, 'Obat', r.harga_satuan, r.jumlah, r.frekuensi);
            });
        } catch(e) {}
    }

    if (kunjunganData.surat_sakit === 'YA' || kunjunganData.suratSakit === 'YA') {
        const t = tarifAktif.find(x => x.kategori === 'Administrasi' && x.nama === 'Surat Keterangan Sakit');
        if (t) addItem('Surat Keterangan Sakit', 'Administrasi', t.harga);
    }

    return items;
}

async function sb_savePenunjang(kunjunganId, items) {
    await _sbFetch(`penunjang_item?kunjungan_id=eq.${kunjunganId}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    if (!items || items.length === 0) return { status: 'success' };

    const rows = items.map(it => ({
        kunjungan_id: kunjunganId,
        jenis:        it.jenis || '',
        hasil:        it.hasil || null,
        catatan:      it.catatan || null
    }));
    await _sbFetch('penunjang_item', {
        method: 'POST', body: rows, prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_saveTindakanKunjungan(kunjunganId, items) {
    await _sbFetch(`tindakan_item?kunjungan_id=eq.${kunjunganId}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    if (!items || items.length === 0) return { status: 'success' };

    const rows = items.map(it => ({
        kunjungan_id:     kunjunganId,
        jenis_tindakan_id: it.jenis_tindakan_id || null,
        nama_tindakan:    it.nama_tindakan || '',
        harga_satuan:     Number(it.harga_satuan) || 0,
        jumlah:           Number(it.jumlah) || 1,
        catatan:          it.catatan || null
    }));
    await _sbFetch('tindakan_item', {
        method: 'POST', body: rows, prefer: 'return=minimal'
    });
    return { status: 'success' };
}

async function sb_saveTindakanList(list) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
        if (!item.nama || !item.nama.trim()) continue;
        const body = {
            nama:       item.nama.trim(),
            harga:      Number(item.harga) || 0,
            keterangan: item.keterangan || null,
            aktif:      item.aktif !== false
        };
        if (item.id) {
            await _sbFetch(`jenis_tindakan?id=eq.${item.id}`, {
                method: 'PATCH', body, prefer: 'return=minimal'
            });
        } else {
            await _sbFetch('jenis_tindakan', {
                method: 'POST', body, prefer: 'return=representation'
            });
        }
    }
}