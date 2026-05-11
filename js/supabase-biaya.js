// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE: MODUL PEMBIAYAAN
//  Tabel: tarif_layanan, tagihan, tagihan_item
// ════════════════════════════════════════════════════════

// ═══════════════════════════════════════
//  TARIF LAYANAN (Master)
// ═══════════════════════════════════════

/** Ambil semua tarif layanan */
async function sb_getTarif() {
    return await _sbFetch('tarif_layanan?select=*&order=kategori.asc,nama.asc');
}

/** Simpan tarif (upsert by id) */
async function sb_saveTarif(payload) {
    const { id, nama, kategori, harga, keterangan, aktif, sub_group, sub_group_order } = payload;
    const body = {
        nama:             (nama || '').trim(),
        kategori:         kategori  || 'Umum',
        harga:            Number(harga) || 0,
        keterangan:       keterangan || null,
        aktif:            aktif !== false,
        sub_group:        sub_group || null,
        sub_group_order:  sub_group_order != null ? Number(sub_group_order) : 99
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
