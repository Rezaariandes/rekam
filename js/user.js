// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL USER
//  Manajemen akun user & PIN
// ════════════════════════════════════════════════════════

let userListCache = [];

// ── POPULATE DROPDOWN JABATAN DARI JABATAN_MEDIS (DINAMIS) ──
// Dipanggil saat halaman pageUser dibuka (via switchPage di app.js)
function renderJabatanSelect() {
    const sel = $('u_jabatan');
    if (!sel) return;
    // Jabatan default mencakup semua peran baru
    const jabDefault = ['Dokter', 'Admin', 'Paramedis', 'Apoteker', 'Kasir', 'ATLM'];
    const jabList = (typeof JABATAN_MEDIS !== 'undefined' && Array.isArray(JABATAN_MEDIS) && JABATAN_MEDIS.length > 0)
        ? JABATAN_MEDIS
        : jabDefault;
    // Pastikan jabatan baru selalu ada meski tidak di list lama
    const jabatanTambahan = ['Apoteker', 'Kasir', 'ATLM'];
    jabatanTambahan.forEach(j => { if (!jabList.includes(j)) jabList.push(j); });
    // Pastikan 'Sudah Resign' selalu tersedia sebagai opsi terakhir
    const jabListWithResign = jabList.includes('Sudah Resign') ? jabList : [...jabList, 'Sudah Resign'];
    const current = sel.value;
    sel.innerHTML = jabListWithResign.map(j =>
        `<option value="${j}" ${j === current ? 'selected' : ''}>${j}</option>`
    ).join('');
    // Tampilkan/sembunyikan form Satu Sehat sesuai jabatan saat ini
    _toggleFormDokterBaru();
}

// ── TOGGLE TAMPILAN FORM DATA SATU SEHAT (saat jabatan = Dokter) ──
function _toggleFormDokterBaru() {
    const sel   = $('u_jabatan');
    const panel = $('panelDataDokterBaru');
    if (!sel || !panel) return;
    const isDokter = sel.value.toLowerCase() === 'dokter';
    panel.style.display = isDokter ? 'block' : 'none';
}

// ── AMBIL DAFTAR USER DARI SUPABASE ──
async function fetchUsers() {
    const listEl = $('listUserContainer');
    if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat data user...</div>`;

    // Refresh dropdown jabatan setiap kali halaman dibuka
    renderJabatanSelect();

    try {
        const data = await sb_getUsers();
        userListCache = (data.data || []).map(u => ({
            id:      u.id,
            nama:    u.nama,
            jabatan: u.jabatan
        }));
        renderUserList();
    } catch (e) {
        if (listEl) listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div>Gagal memuat daftar user.</div>`;
    }
}

// ── RENDER DAFTAR USER ──
function renderUserList() {
    const c = $('listUserContainer');
    if (!c) return;
    if (userListCache.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>Belum ada user.</div>`;
        return;
    }

    // Pisahkan user aktif dan resign
    const aktif  = userListCache.filter(u => (u.jabatan || '').toLowerCase() !== 'sudah resign');
    const resign = userListCache.filter(u => (u.jabatan || '').toLowerCase() === 'sudah resign');

    const renderCard = (u) => {
        const isDokter   = u.jabatan && u.jabatan.toLowerCase() === 'dokter';
        const isResign   = u.jabatan && u.jabatan.toLowerCase() === 'sudah resign';
        const isApoteker = u.jabatan && u.jabatan.toLowerCase() === 'apoteker';
        const isKasir    = u.jabatan && u.jabatan.toLowerCase() === 'kasir';
        const isAtlm     = u.jabatan && u.jabatan.toLowerCase() === 'atlm';

        const roleIcon = isDokter ? '👨‍⚕️' : isApoteker ? '💊' : isKasir ? '💰' : isAtlm ? '🔬' : isResign ? '🚪' : '👤';

        const badge = isDokter
            ? `<div class="status-badge" style="background:rgba(5,150,105,0.12);color:#065f46;border:1px solid rgba(5,150,105,0.25);font-size:10px;">👨‍⚕️ Dokter Pemeriksa</div>`
            : isApoteker
                ? `<div class="status-badge" style="background:rgba(124,58,237,0.12);color:#5b21b6;border:1px solid rgba(124,58,237,0.25);font-size:10px;">💊 Apoteker</div>`
                : isKasir
                    ? `<div class="status-badge" style="background:rgba(245,158,11,0.12);color:#92400e;border:1px solid rgba(245,158,11,0.25);font-size:10px;">💰 Kasir</div>`
                    : isAtlm
                        ? `<div class="status-badge" style="background:rgba(6,182,212,0.12);color:#155e75;border:1px solid rgba(6,182,212,0.25);font-size:10px;">🔬 ATLM</div>`
                        : isResign
                            ? `<div class="status-badge" style="background:rgba(107,114,128,0.12);color:#6b7280;border:1px solid rgba(107,114,128,0.25);font-size:10px;">🚪 Resign</div>`
                            : `<div class="status-badge status-wait">${u.jabatan}</div>`;

        const cardStyle = isResign ? `opacity:0.6;background:rgba(107,114,128,0.05);` : '';

        let subDesc = '';
        if (isDokter)   subDesc = `<div style="font-size:10px;color:#059669;margin-top:2px;">✅ Kunjungan pasien akan tercatat atas nama dokter ini</div>`;
        if (isApoteker) subDesc = `<div style="font-size:10px;color:#7c3aed;margin-top:2px;">💊 Akses resep & konfirmasi pemberian obat</div>`;
        if (isKasir)    subDesc = `<div style="font-size:10px;color:#b45309;margin-top:2px;">💰 Akses invoice & konfirmasi pembayaran pasien</div>`;
        if (isAtlm)     subDesc = `<div style="font-size:10px;color:#0891b2;margin-top:2px;">🔬 Akses input & lihat hasil laboratorium</div>`;
        if (isResign)   subDesc = `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">📁 Data historis tetap tersimpan & dapat dilacak</div>`;

        return `
        <div class="visit-card" style="${cardStyle}" onclick="openEditUserModal('${u.id}')">
            <div class="visit-time-badge" style="font-size:18px;">${roleIcon}</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:14px;${isResign ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${u.nama}</div>
                <div style="font-size:11px; color:var(--text-muted);">${u.jabatan}</div>
                ${subDesc}
            </div>
            ${badge}
        </div>`;
    };

    let html = aktif.map(renderCard).join('');

    if (resign.length > 0) {
        html += `
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;padding:10px 4px 6px;margin-top:6px;border-top:1px dashed var(--border);">
            🚪 Sudah Resign (${resign.length})
        </div>`;
        html += resign.map(renderCard).join('');
    }

    c.innerHTML = html;
}

// ── SIMPAN USER BARU ──
async function simpanUserBaru() {
    const nama    = $('u_nama')    ? $('u_nama').value.trim()    : '';
    const jabatan = $('u_jabatan') ? $('u_jabatan').value.trim() : '';
    const pin     = $('u_pin')     ? $('u_pin').value.trim()     : '';

    if (!nama || !jabatan || !pin) return showToast("⚠️ Semua kolom wajib diisi!", "warning");
    if (pin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const isDokter = jabatan.toLowerCase() === 'dokter';

    // Validasi data Satu Sehat jika jabatan Dokter
    if (isDokter) {
        const nik = $('u_nik') ? $('u_nik').value.trim() : '';
        if (!nik) return showToast("⚠️ NIK wajib diisi untuk akun Dokter!", "warning");
    }

    const btn = $('btnSimpanUser');
    if (btn) { btn.disabled = true; btn.innerText = "Menyimpan..."; }

    try {
        // 1. Simpan user ke tabel users, dapatkan ID user yang baru dibuat
        const newUser = await sb_saveUser({ nama, jabatan, pin });

        // 2. Jika jabatan Dokter → otomatis daftarkan ke tabel dokter
        if (isDokter && newUser && newUser.userId) {
            const nik       = $('u_nik')       ? $('u_nik').value.trim()       : '';
            const ihs       = $('u_ihs')       ? $('u_ihs').value.trim()       : '';
            const sip       = $('u_sip')       ? $('u_sip').value.trim()       : '';
            const spesialis = $('u_spesialis') ? $('u_spesialis').value.trim() : '';

            await sb_tambahDokterDariUser({
                nama, jabatan: 'Dokter',
                nik, ihs, sip, spesialis,
                user_id: newUser.userId
            });

            // Refresh cache dokter di settings jika sudah dimuat
            if (typeof _dokterList !== 'undefined') {
                try {
                    const data = await sb_getSettings();
                    if (data.dokter) window._dokterAktif = data.dokter;
                } catch(e) {}
            }
        }

        showToast(
            isDokter
                ? `✅ Akun Dokter "${nama}" berhasil dibuat & terdaftar di Data Dokter`
                : `✅ User baru "${nama}" (${jabatan}) berhasil disimpan`,
            "success"
        );

        // Reset form
        if ($('u_nama'))      $('u_nama').value      = '';
        if ($('u_pin'))       $('u_pin').value        = '';
        if ($('u_nik'))       $('u_nik').value        = '';
        if ($('u_ihs'))       $('u_ihs').value        = '';
        if ($('u_sip'))       $('u_sip').value        = '';
        if ($('u_spesialis')) $('u_spesialis').value  = '';
        renderJabatanSelect();

        fetchUsers();
        if (typeof loadLoginUsers === "function") loadLoginUsers();
    } catch (e) {
        showToast("❌ Gagal menyimpan user: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Akun User"; }
    }
}

// ── BUKA MODAL EDIT USER ──
function openEditUserModal(id) {
    const u = userListCache.find(x => x.id === id);
    if (!u) return;
    if ($('edit_u_id'))   $('edit_u_id').value   = u.id;
    if ($('edit_u_nama')) $('edit_u_nama').value = u.nama;
    if ($('edit_u_pin'))  $('edit_u_pin').value  = '';

    // Populate dropdown jabatan di modal edit (termasuk Sudah Resign)
    const jabSel = $('edit_u_jabatan');
    if (jabSel) {
        const jabDefault = ['Dokter', 'Admin', 'Paramedis', 'Apoteker', 'Kasir', 'ATLM'];
        const jabList = (typeof JABATAN_MEDIS !== 'undefined' && Array.isArray(JABATAN_MEDIS) && JABATAN_MEDIS.length > 0)
            ? JABATAN_MEDIS
            : jabDefault;
        const jabatanTambahan = ['Apoteker', 'Kasir', 'ATLM'];
        jabatanTambahan.forEach(j => { if (!jabList.includes(j)) jabList.push(j); });
        const jabListWithResign = jabList.includes('Sudah Resign') ? jabList : [...jabList, 'Sudah Resign'];
        jabSel.innerHTML = jabListWithResign.map(j =>
            `<option value="${j}" ${j === u.jabatan ? 'selected' : ''}>${j}</option>`
        ).join('');
    }

    // Tampilkan info resign jika user sudah resign
    const resignInfo = $('editResignInfo');
    if (resignInfo) {
        resignInfo.style.display = (u.jabatan || '').toLowerCase() === 'sudah resign' ? 'block' : 'none';
    }

    const modal = $('modalUser');
    if (modal) modal.classList.add('show');
}

// ── UPDATE USER (PIN + JABATAN) ──
async function updatePinUser() {
    const id      = $('edit_u_id')      ? $('edit_u_id').value             : '';
    const newPin  = $('edit_u_pin')     ? $('edit_u_pin').value.trim()     : '';
    const jabatan = $('edit_u_jabatan') ? $('edit_u_jabatan').value.trim() : '';

    if (!newPin && !jabatan) return showToast("⚠️ Tidak ada perubahan untuk disimpan", "warning");
    if (newPin && newPin.length < 4) return showToast("⚠️ PIN minimal 4 digit", "warning");

    const btn = $('btnUpdateUser');
    if (btn) { btn.disabled = true; btn.innerText = "Mengupdate..."; }

    try {
        const payload = { userId: id };
        if (newPin)  payload.pin     = newPin;
        if (jabatan) payload.jabatan = jabatan;

        await sb_saveUser(payload);
        showToast("✅ Data user berhasil diupdate", "success");

        // Update cache lokal agar render langsung
        const idx = userListCache.findIndex(x => x.id === id);
        if (idx !== -1 && jabatan) userListCache[idx].jabatan = jabatan;

        const modal = $('modalUser');
        if (modal) modal.classList.remove('show');
        fetchUsers();
        if (typeof loadLoginUsers === "function") loadLoginUsers();
    } catch (e) {
        showToast("❌ Gagal update user: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "💾 Simpan Perubahan"; }
    }
}

// ── HAPUS USER (PERMANEN) ──
async function hapusUser() {
    const id   = $('edit_u_id')   ? $('edit_u_id').value   : '';
    const nama = $('edit_u_nama') ? $('edit_u_nama').value : 'user ini';

    // Konfirmasi ganda karena penghapusan permanen
    if (!confirm(`⚠️ Hapus akun "${nama}"?\n\nCatatan: Data kunjungan & rekam medis yang pernah dibuat tetap tersimpan di database.\nAksi ini tidak dapat dibatalkan.`)) return;
    if (!confirm(`Konfirmasi sekali lagi: hapus permanen akun "${nama}"?`)) return;

    const btn = $('btnHapusUser');
    if (btn) { btn.disabled = true; btn.innerText = "Menghapus..."; }

    try {
        await sb_deleteUser(id);
        showToast(`🗑️ Akun "${nama}" berhasil dihapus`, "success");

        // Hapus dari cache lokal
        userListCache = userListCache.filter(x => x.id !== id);

        const modal = $('modalUser');
        if (modal) modal.classList.remove('show');
        renderUserList();
        if (typeof loadLoginUsers === "function") loadLoginUsers();
    } catch (e) {
        showToast("❌ Gagal menghapus user: " + (e.message || ''), "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "🗑️ Hapus User"; }
    }
}
