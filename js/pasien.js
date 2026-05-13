// ════════════════════════════════════════════════════════
//  KLIKPRO RME — MODUL PASIEN
//  Pendaftaran, pencarian, auto-fill, scan KTP
//  OCR: Claude Vision API (menggantikan Tesseract)
// ════════════════════════════════════════════════════════

let allPatients     = [];
let currentPasienId = null;
let currentRiwayat  = [];

// ── AUTO-FILL DATA PASIEN DARI LIST ──
async function autoFillPasien() {
    const namaVal = $('nama') ? $('nama').value : '';
    const p = allPatients.find(x => x.nama === namaVal);
    if (!p) return;

    if ($('nik'))       $('nik').value       = p.nik    || '';
    if ($('jk'))        $('jk').value        = p.jk     || 'L';
    if ($('alamat'))    $('alamat').value    = p.alamat || '';
    if ($('tgl_lahir')) $('tgl_lahir').value = formatTglIndo(p.tgl) || '';
    currentPasienId = p.id;

    const riwayatEl = $('riwayatDaftarContainer');
    if (riwayatEl) {
        riwayatEl.innerHTML =
            `<div style="text-align:center;color:var(--primary);padding:10px;font-size:13px;">⏳ Mencari riwayat...</div>`;
    }

    try {
        // FIX: Ganti fetch(APP_URL) → sb_checkAndUpsertPasien()
        const data = await sb_checkAndUpsertPasien({ nama: p.nama, nik: p.nik });
        // BUG FIX: Guard — data.pasien bisa null jika server error
        if (data && data.pasien && data.pasien.id) {
            currentPasienId = data.pasien.id;
        }
        currentRiwayat  = (data && data.riwayat) ? data.riwayat : [];
        renderRiwayatList(currentRiwayat, 'riwayatDaftarContainer');
    } catch (e) {
        if (riwayatEl) riwayatEl.innerHTML = '';
    }
}

// ── SIMPAN DATA PASIEN (TANPA KUNJUNGAN) ──
async function simpanDataPasienOnly() {
    const nama      = $('nama')      ? $('nama').value.trim()      : '';
    const tgl_lahir = $('tgl_lahir') ? $('tgl_lahir').value.trim() : '';
    const alamat    = $('alamat')    ? $('alamat').value.trim()    : '';

    if (!nama) return showToast("⚠️ Nama wajib diisi!", "warning");
    if (!tgl_lahir && !alamat) return showToast("⚠️ Isi minimal Tgl Lahir atau Alamat!", "warning");

    const btn = $('btnSimpanPasien');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Menyimpan...'; }

    try {
        const payload = {
            action: "savePasienOnly",
            pasienId: currentPasienId,
            nik: $('nik') ? $('nik').value : '',
            nama, tgl_lahir,
            jk:     $('jk')     ? $('jk').value     : 'L',
            alamat
        };
        // FIX: Ganti fetch(APP_URL) → sb_savePasienOnly()
        const result = await sb_savePasienOnly(payload);
        if (result.status === "Sukses") currentPasienId = result.pasienId;
        showToast("✅ Profil pasien disimpan", "success");
    } catch (e) {
        showToast("❌ Gagal menyimpan", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '💾 Simpan Data'; }
    }
}

// ── LANJUT KE PEMERIKSAAN MEDIS ──
let _lanjutBusy = false; // guard double-click

async function lanjutPemeriksaan() {
    if (!canAccessMedis()) return;
    if (_lanjutBusy) return; // blokir klik ganda

    const namaPasien = $('nama') ? $('nama').value.trim() : '';
    if (!namaPasien) return showToast("⚠️ Nama wajib diisi!", "error");

    const btn = $('btnNext');
    _lanjutBusy = true;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Memproses...'; }

    const today        = new Date();
    const tzOffset     = today.getTimezoneOffset() * 60000;
    const localDateStr = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
    const localTimeStr = String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0');
    const parts        = localDateStr.split('-');
    const tglIndoFull  = `${parts[2]}/${parts[1]}/${parts[0]}`;

    const umur = hitungUmur($('tgl_lahir') ? $('tgl_lahir').value : '');

    if ($('infoPasienNama'))     $('infoPasienNama').innerText     = namaPasien;
    if ($('infoPasienNik'))      $('infoPasienNik').innerText      = "NIK: " + ($('nik') ? $('nik').value : '-');
    if ($('infoPasienUmur'))     $('infoPasienUmur').innerText     = "Umur: " + umur;
    if ($('infoTglPemeriksaan')) {
        $('infoTglPemeriksaan').innerText     = "Tgl: " + tglIndoFull;
        $('infoTglPemeriksaan').style.display = 'block';
    }

    const tanggalRekamLabel = "Tgl: " + tglIndoFull;
    localStorage.setItem('activePage', 'pageMedis');
    localStorage.setItem('cP_nama',   namaPasien);
    localStorage.setItem('cP_nik',    "NIK: " + ($('nik') ? $('nik').value : '-'));
    localStorage.setItem('cP_umur',   "Umur: " + umur);
    localStorage.setItem('cTglEdit',  tanggalRekamLabel);
    const _tglLahirRaw = $('tgl_lahir') ? $('tgl_lahir').value.trim() : '';
    localStorage.setItem('cP_tglLahir', _tglLahirRaw ? (typeof formatTglIndo === 'function' ? formatTglIndo(_tglLahirRaw) : _tglLahirRaw) : '');

    if ($('historyListMedis')) {
        $('historyListMedis').innerHTML =
            `<div class="empty-state"><div class="empty-icon">⏳</div>Memuat riwayat...</div>`;
    }

    switchPage('pageMedis', null);
    if (btn) { btn.disabled = false; btn.innerHTML = 'Lanjut Periksa ›'; }

    try {
        const payload = {
            action: "checkAndUpsertPasien",
            createVisitToday: true,
            localDate: localDateStr, localTime: localTimeStr,
            nama: namaPasien,
            nik:       $('nik')       ? $('nik').value       : '',
            tgl_lahir: $('tgl_lahir') ? $('tgl_lahir').value : '',
            jk:        $('jk')        ? $('jk').value        : 'L',
            alamat:    $('alamat')    ? $('alamat').value     : ''
        };
        // FIX: Ganti fetch(APP_URL) → sb_checkAndUpsertPasien()
        const data = await sb_checkAndUpsertPasien(payload);
        if (!data || !data.pasien) throw new Error('Respons server tidak valid');

        currentPasienId = data.pasien.id;
        currentRiwayat  = data.riwayat || [];

        // Isi field alergi dari data PASIEN (bukan kunjungan) — data permanen
        if ($('alergi')) $('alergi').value = data.pasien.alergi || '';
        localStorage.setItem('rme_alergi', data.pasien.alergi || '');

        if (data.kunjunganHariIni) {
            currentKunjunganId = data.kunjunganHariIni.id;
            _isiFormDariKunjungan(data.kunjunganHariIni);
            document.querySelectorAll('[data-save="true"]').forEach(el => localStorage.setItem('rme_' + el.id, el.value));
            calculateIMT(); checkTensi(); checkLabAlert();

            // Beri tahu dengan jelas apakah ini melanjutkan atau kunjungan baru
            const sudahAdaData = data.kunjunganHariIni.keluhan || data.kunjunganHariIni.td || data.kunjunganHariIni.diag;
            if (sudahAdaData) {
                showToast(`ℹ️ ${namaPasien} sudah terdaftar hari ini — melanjutkan data pemeriksaan`, "info");
            } else {
                showToast(`✅ Siap periksa: ${namaPasien}`, "success");
            }
        } else {
            currentKunjunganId = null;
            showToast(`✅ Siap periksa: ${namaPasien}`, "success");
        }

        renderRiwayatList(currentRiwayat, 'historyListMedis');
        localStorage.setItem('cP_id',      currentPasienId);
        localStorage.setItem('cK_id',      currentKunjunganId);
        localStorage.setItem('cP_riwayat', JSON.stringify(currentRiwayat));

    } catch (e) {
        showToast("⚠️ Data belum sinkron: " + (e.message || 'Cek koneksi'), "warning");
        if ($('historyListMedis')) {
            $('historyListMedis').innerHTML =
                `<div class="empty-state"><div class="empty-icon">⚠️</div>Gagal memuat riwayat. Bisa tetap input data.</div>`;
        }
    } finally {
        // SELALU unlock tombol di finally agar tidak stuck jika error
        _lanjutBusy = false;
        if (btn) { btn.disabled = false; btn.innerHTML = 'Lanjut Periksa ›'; }
    }
}

// ── HELPER: Isi form dari data kunjungan ──
function _isiFormDariKunjungan(h) {
    let tdLama = String(h.td || '');
    if ($('sistol'))  $('sistol').value  = tdLama.includes('/') ? tdLama.split('/')[0] : tdLama;
    if ($('diastol')) $('diastol').value = tdLama.includes('/') ? tdLama.split('/')[1] : '';
    if ($('nadi'))    $('nadi').value    = h.nadi    || '';
    if ($('suhu'))    $('suhu').value    = h.suhu    || '';
    if ($('rr'))      $('rr').value      = h.rr      || '';
    if ($('bb'))      $('bb').value      = h.bb      || '';
    if ($('tb'))      $('tb').value      = h.tb      || '';
    if ($('keluhan')) $('keluhan').value = h.keluhan || '';
    if ($('fisik'))   $('fisik').value   = h.fisik   || '';
    // CATATAN: alergi diisi dari data pasien, bukan kunjungan — lihat pemanggil fungsi ini

    // FIX Bug 2: diagnosa2 kini disimpan sebagai kolom terpisah di Supabase.
    // Prioritaskan h.diagnosa2 langsung; fallback ke format lama "diag1 | diag2"
    // untuk kompatibilitas data lama.
    if ($('diagnosa'))  $('diagnosa').value  = h.diag || '';
    if ($('diagnosa2')) $('diagnosa2').value = h.diagnosa2 || '';
    if (!h.diagnosa2 && h.diag && h.diag.includes(' | ')) {
        const diagParts = h.diag.split(' | ');
        if ($('diagnosa'))  $('diagnosa').value  = diagParts[0] || '';
        if ($('diagnosa2')) $('diagnosa2').value = diagParts[1] || '';
    }
    if ($('terapi')) $('terapi').value = h.terapi || '';

    // ── Muat permintaan lab jika ada ──
    if (typeof loadReqLabFromKunjungan === 'function') {
        loadReqLabFromKunjungan(h.req_lab || null);
    }
}

// ── RESET SESI PENDAFTARAN ──
function resetSession() {
    clearSession();
    currentPasienId    = null;
    currentKunjunganId = null;
    currentRiwayat     = [];
    ['nama', 'nik', 'alamat', 'tgl_lahir'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('jk')) $('jk').value = 'L';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    const firstNav = document.querySelector('.nav-item');
    if (firstNav) firstNav.classList.add('active-nav');
    switchPage('pageDaftar', null);
    fetchByDate();
}


// ════════════════════════════════════════════════════════
//  SCAN KTP — OCR.space API
//
//  Menggunakan OCR.space untuk membaca teks dari foto KTP,
//  lalu parsing manual untuk ekstrak field yang dibutuhkan.
//
//  Cara kerja:
//  1. Foto KTP dikirim ke OCR.space (multipart/form-data)
//  2. Teks hasil OCR di-parse dengan regex KTP Indonesia
//  3. Field NIK, Nama, Tgl Lahir, JK, Alamat diisi ke form
//
//  API Key diambil dari Google Sheets Settings (field: ocr_api_key).
//  Tidak lagi hardcoded — bisa diubah dari halaman ⚙️ Settings.
//  Fallback: key kosong → tampilkan pesan ke user untuk konfigurasi.
// ════════════════════════════════════════════════════════

// ── Ambil OCR API Key dari runtime settings ──
function _getOcrApiKey() {
    // Diisi oleh loadRuntimeSettings() dari app.js ke window.OCR_API_KEY
    if (typeof window.OCR_API_KEY === 'string' && window.OCR_API_KEY.trim() !== '') {
        return window.OCR_API_KEY.trim();
    }
    return null;
}

// ── Resize gambar jika terlalu besar (hemat kuota API) ──
function resizeImageForAPI(file, maxWidth = 1200) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.onload  = () => {
            URL.revokeObjectURL(url);

            if (img.width <= maxWidth) { resolve(file); return; }

            const ratio  = maxWidth / img.width;
            const canvas = document.createElement('canvas');
            canvas.width  = maxWidth;
            canvas.height = Math.round(img.height * ratio);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                blob => resolve(blob || file),
                'image/jpeg',
                0.92
            );
        };
        img.src = url;
    });
}

// ── Kirim gambar ke OCR.space, dapatkan teks mentah ──
async function ocrSpaceRequest(file, apiKey) {
    const formData = new FormData();
    formData.append('file', file, 'ktp.jpg');
    formData.append('apikey', apiKey);
    formData.append('language', 'eng');        // 'eng' lebih stabil dari 'ind' di OCR.space
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('isTable', 'true');        // KTP berbentuk tabel, aktifkan mode ini
    formData.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('OCR.space HTTP error: ' + response.status);

    const result = await response.json();

    // ── DEBUG: Tampilkan respons lengkap di console ──
    console.log('[OCR.space] Full response:', JSON.stringify(result, null, 2));

    if (result.IsErroredOnProcessing) {
        const errMsg = Array.isArray(result.ErrorMessage)
            ? result.ErrorMessage.join(', ')
            : (result.ErrorMessage || 'Unknown error');
        throw new Error('OCR gagal: ' + errMsg);
    }

    const allText = (result.ParsedResults || [])
        .map(r => r.ParsedText || '')
        .join('\n');

    // ── DEBUG: Tampilkan teks mentah OCR ──
    console.log('[OCR.space] Teks mentah:\n' + allText);

    return allText;
}

// ── Konversi teks Title Case ──
function toTitleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Normalisasi tanggal dari berbagai format ke DD/MM/YYYY ──
function normalisasiTanggal(raw) {
    if (!raw) return null;
    raw = raw.trim();

    // Format angka: 01-01-1990 / 01/01/1990 / 01 01 1990
    const m = raw.match(/(\d{1,2})[-\/\s](\d{1,2})[-\/\s](\d{4})/);
    if (m) return m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0') + '/' + m[3];

    // Format teks: 01 Januari 1990
    const bulanMap = {
        januari:'01', februari:'02', maret:'03', april:'04',
        mei:'05', juni:'06', juli:'07', agustus:'08',
        september:'09', oktober:'10', november:'11', desember:'12',
        // Singkatan umum hasil OCR
        jan:'01', feb:'02', mar:'03', apr:'04', jun:'06',
        jul:'07', agt:'08', agu:'08', sep:'09', okt:'10', nov:'11', des:'12'
    };
    const m2 = raw.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m2 && bulanMap[m2[2]]) {
        return m2[1].padStart(2,'0') + '/' + bulanMap[m2[2]] + '/' + m2[3];
    }
    return null;
}

// ── Bersihkan label dari awal baris ──
function hapusLabel(str) {
    // Hapus pola "LABEL :" atau "LABEL:" atau "LABEL " di awal
    return str.replace(/^[A-Za-z\s\/\(\)]{1,30}[:]\s*/i, '').trim();
}

// ── Parse teks OCR menjadi data KTP terstruktur ──
function parseKtpDariTeks(teks) {
    // Normalisasi: ganti tab dengan spasi, hapus baris kosong berlebih
    const teksNorm = teks.replace(/\t/g, ' ').replace(/\r/g, '');
    const lines    = teksNorm.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const upper    = teksNorm.toUpperCase();

    const result = { nik: null, nama: null, tgl_lahir: null, jk: null, alamat: null };

    console.log('[KTP Parser] Jumlah baris:', lines.length);
    lines.forEach((l, i) => console.log(`  [${i}] ${l}`));

    // ════════════════════════════
    //  NIK — 16 digit, cari di mana saja
    // ════════════════════════════
    // Cari dari baris berlabel NIK dulu
    for (let i = 0; i < lines.length; i++) {
        if (/\bnik\b/i.test(lines[i])) {
            // Nilai bisa di baris yang sama atau baris berikutnya
            const inline = lines[i].replace(/\bnik\b\s*[:\-]?\s*/i, '').replace(/\D/g, '');
            if (inline.length >= 14) { result.nik = inline.slice(0, 16); break; }
            if (i + 1 < lines.length) {
                const next = lines[i + 1].replace(/\D/g, '');
                if (next.length >= 14) { result.nik = next.slice(0, 16); break; }
            }
        }
    }
    // Fallback: cari blok 16 digit di mana saja (toleran spasi di tengah)
    if (!result.nik) {
        const noSpace = teksNorm.replace(/\s/g, '');
        const m = noSpace.match(/\d{16}/);
        if (m) result.nik = m[0];
    }
    // Fallback lebih longgar: 14-16 digit berurutan
    if (!result.nik) {
        const m = teksNorm.match(/\b(\d{14,16})\b/);
        if (m) result.nik = m[1].padStart(16, '0').slice(0, 16);
    }

    // ════════════════════════════
    //  NAMA — cari label NAMA
    // ════════════════════════════
    for (let i = 0; i < lines.length; i++) {
        if (/^nama\b/i.test(lines[i])) {
            const inline = lines[i].replace(/^nama\s*[:\-]?\s*/i, '').trim();
            if (inline.length > 2 && /[a-zA-Z]/.test(inline)) {
                result.nama = toTitleCase(inline.replace(/[^a-zA-Z\s\.']/g, '').trim());
                break;
            }
            // Baris berikutnya
            if (i + 1 < lines.length) {
                const next = lines[i + 1].trim();
                const LABEL_PATTERN = /^(nik|tempat|tanggal|tgl|jenis|gol|agama|status|pekerjaan|kewarganegaraan|alamat|rt|rw|kel|kec|kota|kab|provinsi|berlaku)/i;
                if (!LABEL_PATTERN.test(next) && /[a-zA-Z]{2,}/.test(next)) {
                    result.nama = toTitleCase(next.replace(/[^a-zA-Z\s\.']/g, '').trim());
                    break;
                }
            }
        }
    }
    // Fallback: cari baris yang seluruhnya huruf kapital (panjang 4-40 char), bukan label umum KTP
    if (!result.nama) {
        const SKIP = /^(NAMA|NIK|TEMPAT|TANGGAL|TGL|JENIS|GOLONGAN|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|ALAMAT|RT|RW|KELURAHAN|KECAMATAN|KOTA|KABUPATEN|PROVINSI|REPUBLIK|INDONESIA|KARTU|TANDA|PENDUDUK|BERLAKU|HINGGA|DARAH)/;
        for (const line of lines) {
            // Baris yang sebagian besar huruf kapital, tidak ada angka banyak
            if (line.length >= 4 && line.length <= 45 &&
                /^[A-Z][A-Z\s\.']{3,}$/.test(line) &&
                !SKIP.test(line.trim())) {
                result.nama = toTitleCase(line.trim());
                break;
            }
        }
    }

    // ════════════════════════════
    //  TANGGAL LAHIR
    // ════════════════════════════
    // Cari baris yang mengandung pola tanggal di dekat label lahir
    for (let i = 0; i < lines.length; i++) {
        if (/lahir|ttl/i.test(lines[i])) {
            // Coba parse dari baris yang sama
            const tglRaw = lines[i].match(/(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/)?.[0];
            if (tglRaw) { result.tgl_lahir = normalisasiTanggal(tglRaw); break; }
            // Coba dari baris berikutnya
            if (i + 1 < lines.length) {
                const tglRaw2 = lines[i + 1].match(/(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/)?.[0];
                if (tglRaw2) { result.tgl_lahir = normalisasiTanggal(tglRaw2); break; }
            }
        }
    }
    // Fallback: cari pola tanggal di seluruh teks (hindari mengambil NIK)
    if (!result.tgl_lahir) {
        const matches = [...teksNorm.matchAll(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/g)];
        for (const m of matches) {
            const dd = parseInt(m[1]), mm = parseInt(m[2]), yyyy = parseInt(m[3]);
            if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 2020) {
                result.tgl_lahir = m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0') + '/' + m[3];
                break;
            }
        }
    }

    // ════════════════════════════
    //  JENIS KELAMIN
    // ════════════════════════════
    if (/LAKI.LAKI|LAKI LAKI|LELAKI/i.test(upper))  result.jk = 'L';
    else if (/PEREMPUAN|WANITA/i.test(upper))        result.jk = 'P';
    // Fallback dari NIK (digit ke-7 ≥ 4 → perempuan karena tanggal lahir +40)
    if (!result.jk && result.nik && result.nik.length === 16) {
        result.jk = parseInt(result.nik[6]) >= 4 ? 'P' : 'L';
    }

    // ════════════════════════════
    //  ALAMAT
    // ════════════════════════════
    for (let i = 0; i < lines.length; i++) {
        if (/^alamat\b/i.test(lines[i])) {
            const bagian = [];
            const inline = lines[i].replace(/^alamat\s*[:\-]?\s*/i, '').trim();
            if (inline.length > 1) bagian.push(inline);

            const STOP = /^(rt|rw|kel|kec|kota|kab|provinsi|gol|agama|status|pekerjaan|kewarganegaraan|jenis|nama|nik|tempat|tanggal|berlaku|tanda)/i;
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                if (STOP.test(lines[j])) break;
                bagian.push(lines[j]);
            }
            if (bagian.length > 0) {
                result.alamat = bagian.join(' ').trim();
                break;
            }
        }
    }

    console.log('[KTP Parser] Hasil parse:', result);
    return result;
}

// ── Fungsi utama: scan KTP dengan OCR.space ──
async function scanKtpDenganOcrSpace(file) {
    const apiKey = _getOcrApiKey();
    if (!apiKey) {
        throw new Error('belum dikonfigurasi — Buka ⚙️ Settings → Konfigurasi OCR untuk mengisi API Key OCR.space.');
    }
    const resized = await resizeImageForAPI(file, 1600); // Sedikit lebih besar untuk akurasi
    const teksOcr = await ocrSpaceRequest(resized, apiKey);

    if (!teksOcr || teksOcr.trim().length < 5) {
        throw new Error('Teks tidak terbaca dari gambar. Pastikan foto KTP jelas & tidak buram.');
    }

    return parseKtpDariTeks(teksOcr);
}

// ── INISIALISASI SCAN KTP (UTAMA) ──
function initScanKtp() {
    const camInput = $('camInput');
    if (!camInput) return;

    camInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            showToast("❌ File harus berupa gambar (JPG/PNG)", "error");
            camInput.value = '';
            return;
        }

        // Tampilkan loading state di tombol scan
        const scanBox   = document.querySelector('.scan-ktp');
        const scanLabel = document.querySelector('.scan-ktp-label');
        const scanIcon  = document.querySelector('.scan-ktp-icon');
        if (scanLabel) scanLabel.textContent = 'Membaca KTP...';
        if (scanIcon)  scanIcon.textContent  = '⏳';
        if (scanBox)   scanBox.style.opacity = '0.7';

        showToast("🔍 Membaca KTP dengan OCR.space...", "info");

        try {
            // Kirim ke OCR.space
            const ktpData = await scanKtpDenganOcrSpace(file);

            const filled = [];

            // Isi form dari data yang diekstrak
            if (ktpData.nik && $('nik')) {
                // Pastikan hanya angka, max 16 digit
                const nikClean = String(ktpData.nik).replace(/\D/g, '').slice(0, 16);
                if (nikClean.length >= 14) {
                    $('nik').value = nikClean;
                    filled.push('NIK');
                }
            }

            if (ktpData.nama && $('nama')) {
                $('nama').value = ktpData.nama.trim();
                filled.push('Nama');
            }

            if (ktpData.tgl_lahir && $('tgl_lahir')) {
                $('tgl_lahir').value = ktpData.tgl_lahir;
                filled.push('Tgl Lahir');
            }

            if (ktpData.jk && $('jk')) {
                const jkVal = String(ktpData.jk).toUpperCase().trim();
                if (jkVal === 'L' || jkVal === 'P') {
                    $('jk').value = jkVal;
                    filled.push('Jenis Kelamin');
                }
            }

            if (ktpData.alamat && $('alamat') && !$('alamat').value) {
                $('alamat').value = ktpData.alamat.trim();
                filled.push('Alamat');
            }

            // Feedback hasil
            if (filled.length > 0) {
                showToast('✅ KTP terbaca: ' + filled.join(', '), 'success');
            } else {
                showToast('⚠️ KTP tidak terbaca. Pastikan foto jelas & KTP penuh.', 'warning');
            }

        } catch (err) {
            console.error('[KTP OCR.space Error]', err);

            if (err.message.includes('belum dikonfigurasi')) {
                showToast('⚙️ OCR API Key ' + err.message, 'warning');
            } else if (err.message.includes('401') || err.message.includes('403')) {
                showToast('❌ API Key OCR.space tidak valid. Periksa di ⚙️ Settings.', 'error');
            } else if (err.message.includes('429') || err.message.includes('limit')) {
                showToast('⚠️ Kuota OCR.space habis. Coba lagi nanti atau upgrade plan.', 'warning');
            } else if (err.message.includes('tidak terbaca')) {
                showToast('⚠️ ' + err.message, 'warning');
            } else {
                showToast('❌ Gagal baca KTP. Pastikan foto jelas & coba lagi.', 'error');
            }
        } finally {
            // Kembalikan tampilan tombol scan
            if (scanLabel) scanLabel.textContent = 'Ketuk untuk Scan KTP Otomatis';
            if (scanIcon)  scanIcon.textContent  = '📷';
            if (scanBox)   scanBox.style.opacity  = '1';
            camInput.value = '';
        }
    });
}
