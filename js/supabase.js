// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE CLIENT
//  Menggantikan semua komunikasi ke Google Apps Script
//
//  ✅ supabase-patch.js  → sudah digabung (riwayat_penyakit)
//  ✅ supabase-stok.js   → sudah digabung (modul stok obat)
//  ✅ supabase-biaya.js  → sudah digabung (modul pembiayaan)
//  Cukup load 1 file ini saja — supabase-stok.js & supabase-biaya.js
//  TIDAK perlu di-load lagi.
// ════════════════════════════════════════════════════════

const _SB_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
const _SB_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';

// ── Helper fetch ke Supabase REST API ──
async function _sbFetch(path, opts = {}) {
    const res = await fetch(_SB_URL + '/rest/v1/' + path, {
        headers: {
            'apikey':        _SB_KEY,
            'Authorization': 'Bearer ' + _SB_KEY,
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
    const dokter = await _sbFetch('dokter?select=*');
    return { status: 'success', settings, dokter };
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
        // FIX: Ganti PATCH ke UPSERT (POST + Prefer: resolution=merge-duplicates).
        // PATCH ke ?key=eq.xxx mengembalikan HTTP 200 dengan 0 rows affected jika key
        // belum ada di tabel konfigurasi — data tidak tersimpan tanpa ada error sama sekali.
        // UPSERT memastikan baris dibuat jika belum ada, atau diupdate jika sudah ada.
        updates.push(
            _sbFetch('konfigurasi', {
                method: 'POST',
                body: { key, value: payload[key] },
                prefer: 'resolution=merge-duplicates,return=minimal'
            })
        );
    }
    await Promise.all(updates);

    // BUG FIX: Perbaikan syntax DELETE dokter — path filter harus masuk ke URL, bukan headers
    if (payload.dokter) {
        const dokterList = JSON.parse(payload.dokter);
        // Hapus semua dokter yang ada
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

async function sb_verifyPin(userId, pin) {
    const hashed = await _sha256(pin);
    const rows = await _sbFetch(`users?id=eq.${userId}&pin_hash=eq.${hashed}&select=id,nama,jabatan`);
    if (rows.length > 0) {
        return { isValid: true, user: rows[0] };
    }
    return { isValid: false };
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
        // Gunakan return=representation agar mendapat ID user yang baru dibuat
        const rows = await _sbFetch('users', {
            method: 'POST',
            body: { nama, jabatan, pin_hash: pinHash },
            prefer: 'return=representation'
        });
        const newId = rows && rows[0] ? rows[0].id : null;
        return { status: 'success', userId: newId };
    }
}

// ── HAPUS USER PERMANEN ──
// BUG-01 FIX: Fungsi ini sebelumnya tidak ada, menyebabkan tombol hapus user selalu error.
async function sb_deleteUser(userId) {
    await _sbFetch(`users?id=eq.${userId}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

// ── TAMBAH DOKTER DARI REGISTRASI USER BARU ──
// Dipanggil oleh user.js saat user baru dengan jabatan Dokter berhasil dibuat.
// Fungsi ini menambahkan entri ke tabel dokter dengan user_id terhubung
// sehingga dokter tidak perlu di-input ulang di halaman Settings.
async function sb_tambahDokterDariUser({ nama, jabatan, nik, ihs, sip, spesialis, user_id }) {
    // Cek apakah sudah ada dokter dengan user_id yang sama (hindari duplikasi)
    const existing = await _sbFetch(`dokter?user_id=eq.${user_id}&select=id`);
    if (existing && existing.length > 0) return { status: 'already_exists' };

    await _sbFetch('dokter', {
        method: 'POST',
        body: { nama, jabatan: jabatan || 'Dokter', nik: nik || '', ihs: ihs || '', sip: sip || '', spesialis: spesialis || '', user_id },
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

// SHA-256 untuk hash PIN di browser
async function _sha256(text) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ═══════════════════════════════════════
//  PASIEN
// ═══════════════════════════════════════
async function sb_initData(filterDate) {
    const [pasien, kunjungan, users] = await Promise.all([
        _sbFetch('pasien?select=id,nama,nik,jk,tgl_lahir,alamat,alergi&order=nama.asc'),
        _sbFetch(`kunjungan?tgl=eq.${filterDate}&select=*&order=waktu.asc`),
        _sbFetch('users?select=id,nama,jabatan&order=nama.asc')
    ]);

    // Simpan ke window global agar modul lain bisa resolve nama dokter
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
            lab_gds: k.lab_gds, lab_chol: k.lab_chol, lab_ua: k.lab_ua,
            diag: k.diagnosa, status: k.status || 'Menunggu',
            user_id: k.user_id || null,
            req_lab: k.req_lab || null,
            dokterNama,
            // Status obat & bayar — disimpan di Supabase agar persist lintas sesi
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
        // BUG-10 FIX: Nama pasien dengan karakter & # ? bisa menyebabkan Supabase
        // misparsing query. Trim dulu, lalu encodeURIComponent untuk encode semua karakter
        // khusus (& → %26, # → %23, ? → %3F, + → %2B).
        // NIK sudah dicoba di atas dan tidak ketemu — ini fallback terakhir.
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

    // ── Ambil atau buat kunjungan hari ini ──
    // ROOT CAUSE FIX: ignore-duplicates hanya bekerja jika tabel kunjungan punya
    // UNIQUE constraint (pasien_id, tgl) di database. Jika constraint belum ada,
    // Supabase tetap insert duplikat. Solusi: SELALU cek lebih dulu via SELECT,
    // baru insert jika memang belum ada. Ini tidak bergantung pada constraint apapun.
    let kunjunganHariIni = null;
    if (createVisitToday && localDate) {
        // Langkah 1: cek apakah sudah ada kunjungan hari ini untuk pasien ini
        const existing = await _sbFetch(
            `kunjungan?pasien_id=eq.${pasienRow.id}&tgl=eq.${localDate}&select=*&limit=1`
        );

        if (existing && existing.length > 0) {
            // Sudah ada → pakai yang existing, JANGAN buat baru
            kunjunganHariIni = existing[0];
        } else {
            // Belum ada → insert baru
            // Tetap pakai ignore-duplicates sebagai safety net untuk race condition
            // (misal: dua klik cepat bersamaan)
            try {
                const inserted = await _sbFetch('kunjungan', {
                    method: 'POST',
                    body: { pasien_id: pasienRow.id, tgl: localDate, waktu: localTime || '00:00', status: 'Menunggu' },
                    prefer: 'resolution=ignore-duplicates,return=representation'
                });
                if (inserted && inserted.length > 0) {
                    kunjunganHariIni = inserted[0];
                } else {
                    // Race condition: insert diabaikan karena ada yang masuk duluan
                    const fallback = await _sbFetch(
                        `kunjungan?pasien_id=eq.${pasienRow.id}&tgl=eq.${localDate}&select=*&limit=1`
                    );
                    kunjunganHariIni = (fallback && fallback.length > 0) ? fallback[0] : null;
                }
            } catch(e) {
                // Kalau insert error (mis. constraint violation) → fallback fetch
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

    // BUG-04 FIX: _mapKunjungan memanggil _resolveDokterNama() yang bergantung pada
    // window._usersCache. Jika sb_checkAndUpsertPasien dipanggil sebelum sb_initData
    // (misalnya saat reload pageMedis), cache kosong dan dokterNama selalu null.
    // Solusi: isi cache dari server jika belum terisi.
    if (!window._usersCache || window._usersCache.length === 0) {
        try {
            const users = await _sbFetch('users?select=id,nama,jabatan&order=nama.asc');
            window._usersCache = users || [];
        } catch(e) {
            window._usersCache = [];
        }
    }

    // Mapper helper agar konsisten
    const _mapKunjungan = r => ({
        id: r.id, tgl: r.tgl, waktu: r.waktu,
        user_id: r.user_id || null,
        dokterNama: _resolveDokterNama(r.user_id),
        td: r.td, nadi: r.nadi, suhu: r.suhu, rr: r.rr,
        bb: r.bb, tb: r.tb,
        // Lab dasar
        lab_gds: r.lab_gds, lab_chol: r.lab_chol, lab_ua: r.lab_ua,
        // Darah rutin
        lab_hb: r.lab_hb, lab_trombosit: r.lab_trombosit,
        lab_leukosit: r.lab_leukosit, lab_eritrosit: r.lab_eritrosit,
        lab_hematokrit: r.lab_hematokrit,
        // Triple eliminasi
        lab_hiv: r.lab_hiv, lab_sifilis: r.lab_sifilis, lab_hepatitis: r.lab_hepatitis,
        // Profil lemak
        lab_hdl: r.lab_hdl, lab_ldl: r.lab_ldl, lab_tg: r.lab_tg,
        // Gula darah
        lab_gdp: r.lab_gdp, lab_hba1c: r.lab_hba1c,
        // Fungsi hati
        lab_sgot: r.lab_sgot, lab_sgpt: r.lab_sgpt,
        // Fungsi ginjal
        lab_ureum: r.lab_ureum, lab_creatinin: r.lab_creatinin,
        keluhan: r.keluhan, fisik: r.fisik,
        diag: r.diagnosa, diagnosa2: r.diagnosa2,
        terapi: r.terapi, surat_sakit: r.surat_sakit,
        req_lab: r.req_lab || null,
        status: r.status
    });

    return {
        pasien: {
            id: pasienRow.id, nama: pasienRow.nama, nik: pasienRow.nik,
            jk: pasienRow.jk, tgl_lahir: pasienRow.tgl_lahir, alamat: pasienRow.alamat,
            alergi: pasienRow.alergi || ''
        },
        // kunjunganHariIni: data kunjungan aktif (lengkap) untuk di-populate ke form
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

// ═══════════════════════════════════════
//  KUNJUNGAN
// ═══════════════════════════════════════

// ── Helper: resolve nama dokter pemeriksa dari user_id → window._usersCache ──
// Mengembalikan nama dokter (string) jika user jabatan=Dokter, null jika bukan
function _resolveDokterNama(userId) {
    if (!userId) return null;
    const users = window._usersCache || [];
    const u = users.find(u => u.id === userId);
    if (!u) return null;
    return (u.jabatan && u.jabatan.toLowerCase() === 'dokter') ? u.nama : null;
}

// ── Ambil satu kunjungan lengkap by ID (untuk populate form pemeriksaan) ──
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
        // Lab dasar
        lab_gds: r.lab_gds, lab_chol: r.lab_chol, lab_ua: r.lab_ua,
        // Darah rutin
        lab_hb: r.lab_hb, lab_trombosit: r.lab_trombosit,
        lab_leukosit: r.lab_leukosit, lab_eritrosit: r.lab_eritrosit,
        lab_hematokrit: r.lab_hematokrit,
        // Triple eliminasi
        lab_hiv: r.lab_hiv, lab_sifilis: r.lab_sifilis, lab_hepatitis: r.lab_hepatitis,
        // Profil lemak
        lab_hdl: r.lab_hdl, lab_ldl: r.lab_ldl, lab_tg: r.lab_tg,
        // Gula darah
        lab_gdp: r.lab_gdp, lab_hba1c: r.lab_hba1c,
        // Fungsi hati
        lab_sgot: r.lab_sgot, lab_sgpt: r.lab_sgpt,
        // Fungsi ginjal
        lab_ureum: r.lab_ureum, lab_creatinin: r.lab_creatinin,
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
        lab_gds, lab_chol, lab_ua,
        lab_hb, lab_trombosit, lab_leukosit, lab_eritrosit, lab_hematokrit,
        lab_hiv, lab_sifilis, lab_hepatitis,
        lab_hdl, lab_ldl, lab_tg,
        lab_gdp, lab_hba1c,
        lab_sgot, lab_sgpt,
        lab_ureum, lab_creatinin,
        keluhan, fisik, diagnosa, diagnosa2, terapi, suratSakit,
        alergi, req_lab, riwayat_penyakit
    } = payload;

    // BUG E FIX: Guard — jangan PATCH pasien jika pasienId tidak valid
    // BUG EXTRA: Jangan PATCH jika nama kosong — mencegah korupsi data pasien
    if (pasienId && pasienId !== 'null' && pasienId !== 'undefined' && nama) {
        await _sbFetch(`pasien?id=eq.${pasienId}`, {
            method: 'PATCH',
            body: { nama, nik, jk, ...(tgl_lahir && {tgl_lahir}), ...(alamat && {alamat}), alergi: alergi || null },
            prefer: 'return=minimal'
        });
    }

    // BUG A FIX: Konversi string kosong '' ke null untuk kolom numerik di Supabase
    // Supabase menolak '' pada kolom INTEGER/NUMERIC — harus null
    const _num = v => (v === '' || v === null || v === undefined) ? null : v;

    const isSelesai = diagnosa && terapi;

    // ══════════════════════════════════════════════════════════
    //  GUARD TANGGAL — Root cause fix: tanggal kunjungan berubah
    // ══════════════════════════════════════════════════════════
    // Masalah: beberapa jalur kode selalu mengisi localDate = hari ini,
    // terlepas apakah ini edit kunjungan lama atau baru.
    // Solusi berlapis:
    // 1. kunjunganId ada → PATCH saja, tgl/waktu/pasien_id tidak disentuh.
    // 2. kunjunganId null → cek DB: jika sudah ada kunjungan pasienId+tanggal,
    //    PATCH itu. Jika belum ada, INSERT baru.
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
        nadi:     _num(nadi),
        rr:       _num(rr),
        suhu:     _num(suhu),
        bb:       _num(bb),
        tb:       _num(tb),
        // Lab dasar
        lab_gds:  _num(lab_gds),
        lab_chol: _num(lab_chol),
        lab_ua:   _num(lab_ua),
        // Darah rutin
        lab_hb:          _num(lab_hb),
        lab_trombosit:   _num(lab_trombosit),
        lab_leukosit:    _num(lab_leukosit),
        lab_eritrosit:   _num(lab_eritrosit),
        lab_hematokrit:  _num(lab_hematokrit),
        // Triple eliminasi (TEXT — non-reaktif/reaktif)
        lab_hiv:      lab_hiv      || null,
        lab_sifilis:  lab_sifilis  || null,
        lab_hepatitis:lab_hepatitis|| null,
        // Profil lemak
        lab_hdl: _num(lab_hdl),
        lab_ldl: _num(lab_ldl),
        lab_tg:  _num(lab_tg),
        // Gula darah
        lab_gdp:   _num(lab_gdp),
        lab_hba1c: _num(lab_hba1c),
        // Fungsi hati
        lab_sgot: _num(lab_sgot),
        lab_sgpt: _num(lab_sgpt),
        // Fungsi ginjal
        lab_ureum:    _num(lab_ureum),
        lab_creatinin:_num(lab_creatinin),
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

    // Eksekusi: PATCH jika _finalKunjId ada, INSERT jika belum ada
    let kId = _finalKunjId;
    if (_finalKunjId) {
        // Hapus paksa field yang tidak boleh diubah (double-guard)
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
//  (digabung dari supabase-stok.js)
//  Tabel: obat, resep_item
// ════════════════════════════════════════════════════════

/** Ambil semua obat, urut nama */
async function sb_getObat({ search = '', kategori = '' } = {}) {
    let path = 'obat?select=*&order=nama.asc';
    if (search)   path += `&nama=ilike.*${encodeURIComponent(search)}*`;
    if (kategori) path += `&kategori=eq.${encodeURIComponent(kategori)}`;
    return await _sbFetch(path);
}

/** Ambil satu obat by ID */
async function sb_getObatById(id) {
    const rows = await _sbFetch(`obat?id=eq.${id}&limit=1`);
    return rows[0] || null;
}

/** Simpan obat (insert atau update) */
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

/** Hapus obat by ID */
async function sb_deleteObat(id) {
    await _sbFetch(`obat?id=eq.${id}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    return { status: 'success' };
}

/** Kurangi stok setelah resep disimpan */
async function sb_kurangiStok(obatId, jumlah) {
    // Pakai RPC agar atomic (hindari race condition)
    // Fallback: PATCH langsung jika RPC belum tersedia
    try {
        await _sbFetch(`rpc/kurangi_stok_obat`, {
            method: 'POST',
            body: { p_obat_id: obatId, p_jumlah: Number(jumlah) }
        });
    } catch (e) {
        // Fallback manual: ambil stok sekarang lalu PATCH
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

/** Tambah stok (pembelian/restock) */
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

// ═══════════════════════════════════════
//  RESEP ITEM (per Kunjungan)
// ═══════════════════════════════════════

/** Ambil item resep untuk satu kunjungan */
async function sb_getResepByKunjungan(kunjunganId) {
    const rows = await _sbFetch(
        `resep_item?kunjungan_id=eq.${kunjunganId}&select=*,obat(id,nama,satuan,harga_jual)&order=created_at.asc`
    );
    return rows;
}

/** Simpan seluruh resep untuk satu kunjungan (replace semua) */
async function sb_saveResep(kunjunganId, items) {
    // BUG-B FIX: Baca resep lama dulu sebelum dihapus, agar bisa hitung selisih stok.
    // Sebelumnya: setiap simpan selalu kurangi stok penuh → stok berkurang ganda saat edit.
    let resepLama = [];
    try {
        resepLama = await _sbFetch(
            `resep_item?kunjungan_id=eq.${kunjunganId}&select=obat_id,jumlah`
        );
    } catch(e) { resepLama = []; }

    // Hapus resep lama
    await _sbFetch(`resep_item?kunjungan_id=eq.${kunjunganId}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });

    if (!items || items.length === 0) {
        // Kalau resep dikosongkan, kembalikan stok lama
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

    // BUG-B FIX: Hitung selisih jumlah per obat antara resep lama dan baru.
    // Hanya kurangi stok jika jumlah baru > jumlah lama (tambahan), atau
    // kembalikan stok jika jumlah baru < jumlah lama (pengurangan).
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
            // Tambah lebih banyak dari sebelumnya → kurangi stok sebesar selisih
            await sb_kurangiStok(item.obat_id, selisih).catch(() => {});
        } else if (selisih < 0) {
            // Dikurangi → kembalikan stok sebesar |selisih|
            const obat = await sb_getObatById(item.obat_id).catch(() => null);
            if (obat) {
                await _sbFetch(`obat?id=eq.${item.obat_id}`, {
                    method: 'PATCH',
                    body: { stok: (obat.stok || 0) + Math.abs(selisih) },
                    prefer: 'return=minimal'
                }).catch(() => {});
            }
        }
        // Jika selisih = 0, stok tidak perlu diubah
        delete lamaMap[item.obat_id]; // tandai sudah diproses
    }

    // Obat yang ada di resep lama tapi tidak ada di resep baru → kembalikan stok penuh
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

/** Ambil daftar kategori obat yang ada */
async function sb_getKategoriObat() {
    const rows = await _sbFetch('obat?select=kategori&order=kategori.asc');
    const unique = [...new Set(rows.map(r => r.kategori).filter(Boolean))];
    return unique;
}


// ═══════════════════════════════════════
//  IMPORT OBAT DARI EXCEL (bulk insert)
// ═══════════════════════════════════════

/** Import array obat dari hasil parse Excel ke Supabase.
 *  Setiap item: { nama, kategori, satuan, harga_beli, harga_jual,
 *                 stok, stok_minimum, frekuensi_default, keterangan, exp_date }
 *  Return: { sukses, gagal, errors }
 */
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
//  (digabung dari supabase-biaya.js)
//  Tabel: tarif_layanan, tagihan, tagihan_item
// ════════════════════════════════════════════════════════

/** Ambil semua tarif layanan */
async function sb_getTarif() {
    return await _sbFetch('tarif_layanan?select=*&order=kategori.asc,nama.asc');
}

/** Simpan tarif (upsert by id) */
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

/** Hapus tarif */
async function sb_deleteTarif(id) {
    await _sbFetch(`tarif_layanan?id=eq.${id}`, {
        method: 'DELETE', prefer: 'return=minimal'
    });
    return { status: 'success' };
}

// ═══════════════════════════════════════
//  TAGIHAN (per Kunjungan)
// ═══════════════════════════════════════

/** Ambil tagihan + item untuk satu kunjungan */
async function sb_getTagihan(kunjunganId) {
    const rows = await _sbFetch(
        `tagihan?kunjungan_id=eq.${kunjunganId}&select=*,tagihan_item(*)`
    );
    return rows[0] || null;
}

/** Buat atau update tagihan untuk kunjungan */
async function sb_saveTagihan(kunjunganId, pasienId, items, diskon, catatan) {
    // Hitung total
    const subtotal = items.reduce((s, i) => s + (Number(i.jumlah) * Number(i.harga_satuan)), 0);
    const nominalDiskon = Number(diskon) || 0;
    const total = Math.max(0, subtotal - nominalDiskon);

    // Cek apakah tagihan sudah ada
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
        // Hapus item lama
        await _sbFetch(`tagihan_item?tagihan_id=eq.${tagihanId}`, {
            method: 'DELETE', prefer: 'return=minimal'
        });
    } else {
        const rows = await _sbFetch('tagihan', {
            method: 'POST', body: tagihanBody, prefer: 'return=representation'
        });
        tagihanId = rows[0]?.id;
    }

    // Insert item baru
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

/** Update status pembayaran tagihan */
async function sb_updateStatusTagihan(tagihanId, status) {
    await _sbFetch(`tagihan?id=eq.${tagihanId}`, {
        method: 'PATCH',
        body: { status },
        prefer: 'return=minimal'
    });
    return { status: 'success' };
}

/** Ambil semua tagihan untuk laporan keuangan */
async function sb_getLaporanTagihan(tglMulai, tglSelesai) {
    let path = `tagihan?select=*,tagihan_item(*),pasien(nama,nik)&order=created_at.desc`;
    if (tglMulai)   path += `&created_at=gte.${tglMulai}T00:00:00`;
    if (tglSelesai) path += `&created_at=lte.${tglSelesai}T23:59:59`;
    return await _sbFetch(path);
}

/** Auto-generate item tagihan dari data kunjungan */
async function sb_autoTagihanFromKunjungan(kunjunganId, kunjunganData) {
    // Ambil tarif aktif
    const tarif = await sb_getTarif();

    const tarifAktif = tarif.filter(t => t.aktif);

    const items = [];

    const addItem = (nama, kategori, harga, jumlah = 1, ket = null) => {
        items.push({ nama_item: nama, kategori, jumlah, harga_satuan: Number(harga) || 0, keterangan: ket });
    };

    // 1. Tarif pemeriksaan vital sign
    const hasTtv = kunjunganData.td || kunjunganData.nadi || kunjunganData.suhu;
    if (hasTtv) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Vital Sign');
        if (t) addItem('Pemeriksaan Vital Sign', 'Pemeriksaan', t.harga);
    }

    // 2a. Anamnesa
    const hasKeluhan = kunjunganData.keluhan;
    if (hasKeluhan) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Anamnesa');
        if (t) addItem('Anamnesa (Keluhan Utama)', 'Pemeriksaan', t.harga);
    }

    // 2b. Pemeriksaan fisik
    const hasFisik = kunjunganData.fisik;
    if (hasFisik) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Pemeriksaan Fisik');
        if (t) addItem('Pemeriksaan Fisik Umum', 'Pemeriksaan', t.harga);
    }

    // 2c. Konsultasi dokter
    const hasDiag = kunjunganData.diag || kunjunganData.diagnosa;
    if (hasDiag) {
        const t = tarifAktif.find(x => x.kategori === 'Pemeriksaan' && x.nama === 'Konsultasi Medis');
        if (t) addItem('Konsultasi / Visite Dokter', 'Pemeriksaan', t.harga);
    }

    // 3. Tarif lab per item
    const labFields = [
        { key: 'lab_gds',       nama: 'GDS' },
        { key: 'lab_chol',      nama: 'Kolesterol' },
        { key: 'lab_ua',        nama: 'Asam Urat' },
        { key: 'lab_hb',        nama: 'Hemoglobin (HB)' },
        { key: 'lab_trombosit', nama: 'Trombosit' },
        { key: 'lab_leukosit',  nama: 'Leukosit' },
        { key: 'lab_eritrosit', nama: 'Eritrosit' },
        { key: 'lab_hematokrit',nama: 'Hematokrit' },
        { key: 'lab_hiv',       nama: 'HIV' },
        { key: 'lab_sifilis',   nama: 'Sifilis' },
        { key: 'lab_hepatitis', nama: 'Hepatitis B' },
        { key: 'lab_hdl',       nama: 'HDL' },
        { key: 'lab_ldl',       nama: 'LDL' },
        { key: 'lab_tg',        nama: 'Trigliserida' },
        { key: 'lab_gdp',       nama: 'GDP' },
        { key: 'lab_hba1c',     nama: 'HbA1c' },
        { key: 'lab_sgot',      nama: 'SGOT' },
        { key: 'lab_sgpt',      nama: 'SGPT' },
        { key: 'lab_ureum',     nama: 'Ureum' },
        { key: 'lab_creatinin', nama: 'Creatinin' }
    ];
    labFields.forEach(f => {
        if (kunjunganData[f.key] && kunjunganData[f.key] !== '—') {
            const t = tarifAktif.find(x => x.kategori === 'Laboratorium' && x.nama === f.nama);
            if (t) addItem('Lab: ' + f.nama, 'Laboratorium', t.harga);
        }
    });

    // 4. ── PEMERIKSAAN PENUNJANG ──
    // Ambil dari tabel penunjang_item berdasarkan kunjunganId
    try {
        const penunjangRows = await _sbFetch(`penunjang_item?kunjungan_id=eq.${kunjunganId}&select=jenis`);
        penunjangRows.forEach(r => {
            if (!r.jenis) return;
            // Cari tarif di kategori Penunjang dengan nama yang sama
            const t = tarifAktif.find(x => x.kategori === 'Penunjang' && x.nama === r.jenis);
            const harga = t ? t.harga : 0;
            addItem('Penunjang: ' + r.jenis, 'Penunjang', harga);
        });
    } catch(e) { /* penunjang_item mungkin belum ada saat migrasi pertama */ }

    // 5. ── TINDAKAN MEDIS ──
    // Ambil dari tabel tindakan_item berdasarkan kunjunganId
    try {
        const tindakanRows = await _sbFetch(`tindakan_item?kunjungan_id=eq.${kunjunganId}&select=*`);
        tindakanRows.forEach(r => {
            addItem(r.nama_tindakan, 'Tindakan', r.harga_satuan, r.jumlah || 1, r.catatan || null);
        });
    } catch(e) { /* tindakan_item mungkin belum ada saat migrasi pertama */ }

    // 6. Obat dari resep (jika modul stok aktif)
    if (window._stokAktif) {
        try {
            const resepRows = await sb_getResepByKunjungan(kunjunganId);
            resepRows.forEach(r => {
                addItem(r.nama_obat, 'Obat', r.harga_satuan, r.jumlah, r.frekuensi);
            });
        } catch(e) {}
    }

    // 7. Surat keterangan
    if (kunjunganData.surat_sakit === 'YA' || kunjunganData.suratSakit === 'YA') {
        const t = tarifAktif.find(x => x.kategori === 'Administrasi' && x.nama === 'Surat Keterangan Sakit');
        if (t) addItem('Surat Keterangan Sakit', 'Administrasi', t.harga);
    }

    return items;
}

// ═══════════════════════════════════════
//  PENUNJANG ITEM (per Kunjungan)
// ═══════════════════════════════════════

/** Simpan seluruh penunjang untuk satu kunjungan (replace) */
async function sb_savePenunjang(kunjunganId, items) {
    // Hapus lama dulu
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

// ═══════════════════════════════════════
//  TINDAKAN ITEM (per Kunjungan)
// ═══════════════════════════════════════

/** Simpan seluruh tindakan untuk satu kunjungan (replace) */
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

// ═══════════════════════════════════════
//  JENIS TINDAKAN (Master — dari Settings)
// ═══════════════════════════════════════

/** Simpan/upsert seluruh daftar jenis tindakan dari halaman Settings */
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
