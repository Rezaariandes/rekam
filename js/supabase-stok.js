// ════════════════════════════════════════════════════════
//  KLIKPRO RME — SUPABASE: MODUL STOK OBAT
//  Tabel: obat, resep_item
//  Dipisahkan dari supabase.js agar modular
// ════════════════════════════════════════════════════════

// ═══════════════════════════════════════
//  OBAT (Master Data)
// ═══════════════════════════════════════

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
