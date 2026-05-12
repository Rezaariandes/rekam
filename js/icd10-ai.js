// ════════════════════════════════════════════════════════
//  KLIKPRO RME — ICD-10 + AI REKOMENDASI DIAGNOSA
//  Gabungan: icd10.js + ai-rekomendasi.js
//
//  ⚠️  API KEY diisi di index.html (tidak di-push ke GitHub)
//      Cari bagian: const AI_KEYS = { ... }
// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
//  BAGIAN 1 — DATA ICD-10
//  Sumber: Kepmenkes No. 1186 Tahun 2022 (PPK di FKTP)
//          + Diagnosa umum praktek dokter & puskesmas
// ════════════════════════════════════════════════════════

const icd10Data = [

    // ──────────────────────────────────────────
    //  A. INFEKSI & PARASIT
    // ──────────────────────────────────────────
    "A01.0 - Demam Tifoid (Typhoid Fever)",
    "A06.0 - Disentri Amuba Akut",
    "A09 - Diare dan Gastroenteritis",
    "A15 - Tuberkulosis Paru",
    "A18.4 - Tuberkulosis Kulit",
    "A27.9 - Leptospirosis",
    "A30 - Kusta (Lepra / Hansen Disease)",
    "A35 - Tetanus",
    "A46 - Erisipelas",
    "A51 - Sifilis Stadium Awal",
    "A54.9 - Gonore (Gonococcal Infection)",
    "A82.9 - Rabies",
    "A90 - Demam Dengue (Dengue Fever)",
    "A91 - Demam Berdarah Dengue (DHF)",

    // ──────────────────────────────────────────
    //  B. INFEKSI VIRUS & PARASIT LAINNYA
    // ──────────────────────────────────────────
    "B00.9 - Infeksi Herpes Simpleks",
    "B01.9 - Varicella (Cacar Air)",
    "B02.9 - Herpes Zoster",
    "B05.9 - Campak (Measles)",
    "B07 - Kutil Virus (Viral Warts)",
    "B08.1 - Moluskum Kontagiosum",
    "B15 - Hepatitis A Akut",
    "B16 - Hepatitis B Akut",
    "B26 - Gondongan (Mumps/Parotitis)",
    "B35 - Dermatofitosis (Tinea)",
    "B36.0 - Pityriasis Versikolor (Panu)",
    "B37.9 - Kandidiasis",
    "B54 - Malaria (Tidak Spesifik)",
    "B74 - Filariasis",
    "B76.9 - Infeksi Cacing Tambang",
    "B85.0 - Pedikulosis (Kutu Rambut)",
    "B86 - Skabies (Kudis)",

    // ──────────────────────────────────────────
    //  D. DARAH & ORGAN PEMBENTUK DARAH
    // ──────────────────────────────────────────
    "D50 - Anemia Defisiensi Besi",
    "D64.9 - Anemia Tidak Spesifik",

    // ──────────────────────────────────────────
    //  E. ENDOKRIN, NUTRISI & METABOLIK
    // ──────────────────────────────────────────
    "E05.9 - Tirotoksikosis / Hipertiroid",
    "E06.3 - Tiroiditis Autoimun (Hashimoto)",
    "E11 - Diabetes Mellitus Tipe 2",
    "E11.9 - Diabetes Mellitus Tipe 2 Tanpa Komplikasi",
    "E16.2 - Hipoglikemia",
    "E66.9 - Obesitas",
    "E78.5 - Hiperlipidemia (Kolesterol Tinggi)",
    "E79.0 - Hiperurisemia (Asam Urat Tinggi Tanpa Gejala)",
    "E87.6 - Hipokalemia",
    "E11.65 - Diabetes Mellitus Tipe 2 dengan Hiperglikemia",

    // ──────────────────────────────────────────
    //  F. GANGGUAN JIWA & PERILAKU
    // ──────────────────────────────────────────
    "F03 - Demensia Tidak Spesifik",
    "F10.2 - Ketergantungan Alkohol",
    "F20.9 - Skizofrenia Tidak Spesifik",
    "F32.9 - Episode Depresif",
    "F41.1 - Gangguan Ansietas (Kecemasan)",
    "F41.2 - Gangguan Campuran Ansietas dan Depresi",
    "F45 - Gangguan Somatoform",
    "F51 - Insomnia Non-Organik",

    // ──────────────────────────────────────────
    //  G. SARAF
    // ──────────────────────────────────────────
    "G40.9 - Epilepsi Tidak Spesifik",
    "G43.9 - Migrain Tidak Spesifik",
    "G44.2 - Nyeri Kepala Tipe Tegang (Tension Headache)",
    "G45.9 - Transient Ischemic Attack (TIA)",
    "G51.0 - Bell's Palsy",
    "G54.2 - Neuralgia Servikal",
    "G62.9 - Neuropati Perifer",

    // ──────────────────────────────────────────
    //  H. MATA
    // ──────────────────────────────────────────
    "H00.0 - Hordeolum (Bintitan)",
    "H01.0 - Blefaritis",
    "H02 - Entropion dan Trikiasis Kelopak Mata",
    "H04.1 - Gangguan Kelenjar Lakrimal",
    "H10.1 - Konjungtivitis Atopik Akut",
    "H10.9 - Konjungtivitis (Tidak Spesifik)",
    "H15.1 - Episkleritis",
    "H21.0 - Hifema",
    "H26.9 - Katarak Tidak Spesifik",
    "H36.0 - Retinopati Diabetik",
    "H40.2 - Glaukoma Sudut Tertutup Primer",
    "H52.0 - Hipermetropia",
    "H52.1 - Miopia",
    "H52.2 - Astigmatisma",
    "H52.4 - Presbiopia",
    "H53.6 - Rabun Senja (Night Blindness)",
    "H57.8 - Gangguan Mata Lain Spesifik",

    // ──────────────────────────────────────────
    //  H. TELINGA
    // ──────────────────────────────────────────
    "H60.9 - Otitis Eksterna",
    "H61.2 - Serumen Prop (Earwax Impacted)",
    "H65.0 - Otitis Media Serosa Akut",
    "H65.9 - Otitis Media Non-Supuratif",
    "H66.1 - Otitis Media Supuratif Kronis (OMSK)",
    "H66.4 - Otitis Media Supuratif Tidak Spesifik",
    "H72.9 - Perforasi Membran Timpani",
    "H81.0 - Penyakit Meniere",
    "H81.3 - Vertigo Perifer (BPPV)",
    "H83.3 - Gangguan Akibat Bising (Noise-Induced)",
    "H93.9 - Gangguan Telinga Lain",

    // ──────────────────────────────────────────
    //  I. KARDIOVASKULAR
    // ──────────────────────────────────────────
    "I10 - Hipertensi Esensial (Primer)",
    "I11 - Hipertensi Jantung",
    "I13 - Hipertensi Jantung dan Ginjal",
    "I20.9 - Angina Pektoris",
    "I21.9 - Infark Miokard Akut",
    "I25.9 - Penyakit Jantung Iskemik Kronik",
    "I48 - Fibrilasi dan Flutter Atrium",
    "I50.9 - Gagal Jantung",
    "I63.9 - Infark Serebral / Stroke Iskemik",
    "I64 - Stroke Tidak Spesifik",
    "I67.9 - Penyakit Serebrovaskuler",
    "I83.0 - Varises Tungkai Bawah",
    "I84 - Hemoroid",

    // ──────────────────────────────────────────
    //  J. SALURAN PERNAPASAN
    // ──────────────────────────────────────────
    "J00 - Nasofaringitis Akut (Common Cold / Pilek)",
    "J01.9 - Sinusitis Akut",
    "J02.9 - Faringitis Akut",
    "J03.9 - Tonsilitis Akut",
    "J04.0 - Laringitis Akut",
    "J06.9 - ISPA Tidak Spesifik",
    "J11 - Influenza",
    "J18.0 - Bronkopneumonia",
    "J18.9 - Pneumonia Tidak Spesifik",
    "J20.9 - Bronkitis Akut",
    "J30.0 - Rinitis Vasomotor",
    "J30.4 - Rinitis Alergi",
    "J34.0 - Abses, Furunkel Hidung",
    "J44.9 - PPOK (Penyakit Paru Obstruktif Kronik)",
    "J45.9 - Asma Tidak Spesifik",
    "J45.902 - Asma dengan Status Asmatikus",
    "J69.0 - Pneumonitis akibat Aspirasi",
    "J96.9 - Gagal Napas Tidak Spesifik",

    // ──────────────────────────────────────────
    //  K. PENCERNAAN
    // ──────────────────────────────────────────
    "K04.0 - Pulpitis (Sakit Gigi / Peradangan Pulpa)",
    "K05.6 - Penyakit Periodontal",
    "K12 - Stomatitis (Sariawan)",
    "K21.0 - GERD (Refluks Gastroesofageal dengan Esofagitis)",
    "K21.9 - GERD (Refluks Gastroesofageal Tanpa Esofagitis)",
    "K29.7 - Gastritis",
    "K30 - Dispepsia",
    "K35.9 - Apendisitis Akut",
    "K52.9 - Kolitis Tidak Spesifik",
    "K57.9 - Divertikulosis",
    "K65.9 - Peritonitis",
    "K81.9 - Kolesistitis",
    "K90.4 - Malabsorpsi Intoleransi",
    "K92.2 - Perdarahan Gastrointestinal",

    // ──────────────────────────────────────────
    //  L. KULIT & JARINGAN SUBKUTAN
    // ──────────────────────────────────────────
    "L01 - Impetigo",
    "L02 - Abses Kulit / Furunkel / Karbunkel",
    "L03.9 - Selulitis",
    "L08.1 - Eritrasma",
    "L20 - Dermatitis Atopik (Eksim)",
    "L20.8 - Dermatitis Atopik Lain",
    "L21 - Dermatitis Seboroik",
    "L22 - Dermatitis Popok",
    "L23 - Dermatitis Kontak Alergi",
    "L24 - Dermatitis Kontak Iritan",
    "L27.0 - Erupsi Kulit Akibat Obat",
    "L27.2 - Dermatitis akibat Makanan",
    "L28.0 - Liken Simpleks Kronikus",
    "L42 - Pityriasis Rosea",
    "L50 - Urtikaria (Biduran)",
    "L51.1 - Eritema Multiforme Bulosa",
    "L70.0 - Akne Vulgaris",
    "L71.0 - Dermatitis Perioral",
    "L73.2 - Hidradenitis Supurativa",
    "L74.3 - Miliaria (Biang Keringat)",

    // ──────────────────────────────────────────
    //  M. MUSKULOSKELETAL
    // ──────────────────────────────────────────
    "M06.9 - Artritis Reumatoid Tidak Spesifik",
    "M10.9 - Gout (Asam Urat / Artritis Gout)",
    "M13.9 - Artritis Tidak Spesifik",
    "M19.9 - Osteoartritis",
    "M32 - Lupus Eritematosus Sistemik (SLE)",
    "M47.9 - Spondilosis (Servikal/Lumbal)",
    "M53.3 - Polimialgia Reumatika",
    "M54.2 - Servikal (Nyeri Leher)",
    "M54.5 - Low Back Pain / Nyeri Punggung Bawah",
    "M79.1 - Mialgia (Nyeri Otot)",
    "M79.3 - Panniculitis",

    // ──────────────────────────────────────────
    //  N. SALURAN KEMIH & REPRODUKSI
    // ──────────────────────────────────────────
    "N10 - Nefritis Tubulo-Interstisial Akut (Pielonefritis)",
    "N18.9 - Penyakit Ginjal Kronis",
    "N39.0 - Infeksi Saluran Kemih (ISK)",
    "N40 - Hiperplasia Prostat Jinak (BPH)",
    "N47 - Fimosis",
    "N61 - Mastitis",
    "N76.0 - Vaginitis Akut",
    "N94.6 - Dismenorea (Nyeri Haid)",

    // ──────────────────────────────────────────
    //  O. KEHAMILAN & PERSALINAN
    // ──────────────────────────────────────────
    "O03.9 - Abortus Spontan",
    "O06.4 - Abortus Tidak Lengkap",
    "O14.9 - Pre-Eklampsia",
    "O15.9 - Eklampsia",
    "O21.0 - Hiperemesis Gravidarum Ringan",
    "O42.9 - Ketuban Pecah Dini",
    "O63.9 - Persalinan Lama",
    "O70.0 - Laserasi Perineum Derajat I",
    "O80.9 - Persalinan Normal",
    "O92.02 - Puting Susu Terbenam (Post Partum)",

    // ──────────────────────────────────────────
    //  P. KONDISI PERINATAL
    // ──────────────────────────────────────────
    "P07.3 - Bayi Prematur / Berat Lahir Rendah",
    "P38 - Omfalitis Neonatus",
    "P59.9 - Ikterus Neonatus",

    // ──────────────────────────────────────────
    //  R. GEJALA & TANDA KLINIS
    // ──────────────────────────────────────────
    "R00.0 - Takikardia",
    "R04.0 - Epistaksis (Mimisan)",
    "R05 - Batuk",
    "R06.0 - Dispnea / Sesak Napas",
    "R09.2 - Henti Napas / Kardiorespirasi",
    "R10.4 - Nyeri Perut Tidak Spesifik",
    "R11 - Mual dan Muntah",
    "R42 - Pusing / Vertigo",
    "R50.9 - Demam Tidak Spesifik",
    "R51 - Nyeri Kepala",
    "R55 - Sinkop (Pingsan)",
    "R56.0 - Kejang Demam",
    "R57.9 - Syok Tidak Spesifik",
    "R73.9 - Hiperglikemia",

    // ──────────────────────────────────────────
    //  S/T. CEDERA & KERACUNAN
    // ──────────────────────────────────────────
    "S00.9 - Cedera Superfisial Kepala",
    "S09.9 - Cedera Kepala Tidak Spesifik",
    "S61.9 - Luka Terbuka Tangan",
    "S81.9 - Luka Terbuka Tungkai Bawah",
    "T14 - Fraktur Tak Spesifik",
    "T14.1 - Luka Terbuka Tidak Spesifik",
    "T15.9 - Benda Asing di Mata",
    "T16 - Benda Asing di Telinga",
    "T17.1 - Benda Asing di Hidung",
    "T26 - Luka Bakar Mata",
    "T30 - Luka Bakar Tidak Spesifik",
    "T62.2 - Keracunan Tanaman",
    "T63.4 - Bisa Serangga / Arthropoda",
    "T78.1 - Reaksi Alergi Makanan",
    "T78.2 - Syok Anafilaktik",
    "T78.4 - Alergi Tidak Spesifik",

    // ──────────────────────────────────────────
    //  Z. FAKTOR KESEHATAN & KONTAK LAYANAN
    // ──────────────────────────────────────────
    "Z00.0 - Pemeriksaan Kesehatan Umum",
    "Z00.1 - Pemeriksaan Rutin Anak Sehat",
    "Z21 - Infeksi HIV Asimptomatik",
    "Z23 - Imunisasi / Vaksinasi",
    "Z30.0 - Konsultasi Kontrasepsi",
    "Z34 - Pengawasan Kehamilan Normal",
    "Z76.0 - Permintaan Surat Keterangan Sakit",
    "Z76.3 - Pemeriksaan Kesehatan Anak Sehat",
];

/** Mengisi datalist ICD-10 ke elemen dengan id tertentu */
function populateIcd10(datalistId) {
    const listEl = document.getElementById(datalistId);
    if (!listEl) return;
    icd10Data.forEach(diag => {
        const opt = document.createElement('option');
        opt.value = diag;
        listEl.appendChild(opt);
    });
}


// ════════════════════════════════════════════════════════
//  BAGIAN 2 — AI REKOMENDASI DIAGNOSA
//  Sistem Multi-Provider dengan Auto-Fallback
// ════════════════════════════════════════════════════════

const AI_PROVIDERS = [

    // ── GOOGLE GEMINI (Gratis, cepat) ──
    {
        nama:    'Gemini 2.0 Flash',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.gemini : []; },
        call: async (apiKey, prompt) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 400, topP: 0.8 }
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
    },

    // ── GROQ (Gratis, sangat cepat — LLaMA & Mixtral) ──
    {
        nama:    'Groq LLaMA 3.3',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.groq : []; },
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── OPENROUTER (Akses 100+ model, ada tier gratis) ──
    {
        nama:    'OpenRouter',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.openrouter : []; },
        call: async (apiKey, prompt) => {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Klikpro RME'
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3.3-70b-instruct:free',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── OPENAI (GPT-4o-mini, berbayar tapi murah) ──
    {
        nama:    'OpenAI GPT-4o-mini',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.openai : []; },
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── MISTRAL (Tier gratis tersedia) ──
    {
        nama:    'Mistral Small',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.mistral : []; },
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.choices?.[0]?.message?.content || '';
        }
    },

    // ── COHERE (Tier gratis tersedia) ──
    {
        nama:    'Cohere Command-R',
        enabled: true,
        get keys() { return (typeof AI_KEYS !== 'undefined') ? AI_KEYS.cohere : []; },
        call: async (apiKey, prompt) => {
            const res = await fetch('https://api.cohere.com/v2/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'command-r',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 400
                })
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json?.message?.content?.[0]?.text || '';
        }
    }

];

// ════════════════════════════════════════════════════════
//  ENGINE: COBA SEMUA KEY & PROVIDER SECARA BERURUTAN
// ════════════════════════════════════════════════════════

function _isRateLimitError(msg) {
    return /quota|rate.?limit|429|too many|exceeded|retry/i.test(msg);
}

function _setAILoadingLabel(txt) {
    const el = document.getElementById('btnAILabel');
    if (el) el.textContent = txt;
}

async function _callAIWithFallback(prompt) {
    const errors   = [];
    let   anyKeyTried = false;

    for (const provider of AI_PROVIDERS) {
        if (!provider.enabled) continue;

        const validKeys = (provider.keys || []).filter(k => k && k.trim() !== '');
        if (validKeys.length === 0) continue;

        for (const key of validKeys) {
            anyKeyTried = true;
            try {
                _setAILoadingLabel('Mencoba ' + provider.nama + '...');
                console.log(`[AI] Mencoba: ${provider.nama}...`);
                const teks = await provider.call(key, prompt);
                if (teks && teks.trim()) {
                    console.log(`[AI] Berhasil via: ${provider.nama}`);
                    return { teks, provider: provider.nama };
                }
                throw new Error('Respons kosong');
            } catch (e) {
                const isLimit = _isRateLimitError(e.message);
                const msg     = `${provider.nama}${isLimit ? ' [quota]' : ''}: ${e.message.substring(0, 80)}`;
                errors.push(msg);
                console.warn(`[AI] Gagal (${provider.nama}), lanjut berikutnya...`);
            }
        }
    }

    if (!anyKeyTried) {
        throw new Error(
            'Tidak ada API Key yang diisi. Buka Settings → Konfigurasi AI API Keys dan isi minimal 1 key. ' +
            'Provider gratis: Groq (console.groq.com) · Gemini (aistudio.google.com) · OpenRouter (openrouter.ai)'
        );
    }

    throw new Error('Semua provider & key sudah dicoba tapi gagal. Detail: ' + errors.slice(-4).join(' | '));
}

// ════════════════════════════════════════════════════════
//  FUNGSI HELPER
// ════════════════════════════════════════════════════════

function tutupAINotif() {
    const notif = document.getElementById('aiNotif');
    if (notif) notif.style.display = 'none';
}

function _kumpulkanDataKlinis() {
    const get = id => {
        const el = document.getElementById(id);
        if (!el) return '';
        const val = (el.value !== undefined && el.value !== null) ? el.value : el.innerText;
        return val ? String(val).trim() : '';
    };

    const umurText = get('infoPasienUmur');
    const jk       = get('jk');
    const jkLabel  = jk === 'L' ? 'Laki-laki' : jk === 'P' ? 'Perempuan' : jk;

    const sistol  = get('sistol');
    const diastol = get('diastol');
    const nadi    = get('nadi');
    const suhu    = get('suhu');
    const rr      = get('rr');
    const bb      = get('bb');
    const tb      = get('tb');
    const tdStr   = (sistol || diastol) ? `${sistol||'?'}/${diastol||'?'} mmHg` : '-';

    let imtStr = '-';
    if (bb && tb) {
        const tbM = parseFloat(tb) / 100;
        const imt = (parseFloat(bb) / (tbM * tbM)).toFixed(1);
        const kat = imt < 18.5 ? 'Underweight' : imt < 25 ? 'Normal' : imt < 30 ? 'Overweight' : 'Obesitas';
        imtStr = `${imt} (${kat})`;
    }

    const lab_gds  = get('lab_gds');
    const lab_chol = get('lab_chol');
    const lab_ua   = get('lab_ua');

    function interpretLab(val, type) {
        const n = parseFloat(val);
        if (isNaN(n) || val === '') return null;
        if (type === 'gds') {
            if (n < 70)   return { val: n, unit: 'mg/dL', status: 'RENDAH — Hipoglikemia', flag: '🔴' };
            if (n <= 99)  return { val: n, unit: 'mg/dL', status: 'Normal (70-99)', flag: '🟢' };
            if (n <= 199) return { val: n, unit: 'mg/dL', status: 'Pra-diabetes / Pre-DM', flag: '🟡' };
            return        { val: n, unit: 'mg/dL', status: 'TINGGI — Suspek DM', flag: '🔴' };
        }
        if (type === 'chol') {
            if (n < 200)  return { val: n, unit: 'mg/dL', status: 'Normal (<200)', flag: '🟢' };
            if (n <= 239) return { val: n, unit: 'mg/dL', status: 'Batas tinggi (200-239)', flag: '🟡' };
            return        { val: n, unit: 'mg/dL', status: 'TINGGI — Hiperlipidemia', flag: '🔴' };
        }
        if (type === 'ua') {
            if (n <= 6.0) return { val: n, unit: 'mg/dL', status: 'Normal wanita (≤6.0)', flag: '🟢' };
            if (n <= 7.0) return { val: n, unit: 'mg/dL', status: 'Normal pria (≤7.0)', flag: '🟢' };
            return        { val: n, unit: 'mg/dL', status: 'TINGGI — Hiperurisemia', flag: '🔴' };
        }
        return null;
    }

    const labGds  = interpretLab(lab_gds,  'gds');
    const labChol = interpretLab(lab_chol, 'chol');
    const labUa   = interpretLab(lab_ua,   'ua');
    const adaLab  = !!(labGds || labChol || labUa);

    return {
        umurText, jkLabel, tdStr,
        nadi: nadi || '-', suhu: suhu || '-',
        rr:   rr   || '-', bb:   bb   || '-',
        tb:   tb   || '-', imt:  imtStr,
        keluhan: get('keluhan') || '-',
        fisik:   get('fisik')   || '-',
        labGds, labChol, labUa, adaLab
    };
}

function _buatPrompt(data) {
    const labLines = [];
    if (data.labGds)  labLines.push('- Gula Darah Sewaktu (GDS)  : ' + data.labGds.val  + ' ' + data.labGds.unit  + ' — ' + data.labGds.flag  + ' ' + data.labGds.status);
    if (data.labChol) labLines.push('- Kolesterol Total           : ' + data.labChol.val + ' ' + data.labChol.unit + ' — ' + data.labChol.flag + ' ' + data.labChol.status);
    if (data.labUa)   labLines.push('- Asam Urat                  : ' + data.labUa.val  + ' ' + data.labUa.unit  + ' — ' + data.labUa.flag  + ' ' + data.labUa.status);

    const bagianLab = labLines.length > 0
        ? '\n\nHASIL LABORATORIUM:\n' + labLines.join('\n')
        : '';

    const instruksiLab = labLines.length > 0
        ? 'Perhatikan nilai laboratorium — jika ada nilai abnormal, pastikan tercermin dalam prioritas diagnosa.'
        : '';

    return 'Kamu adalah asisten klinis dokter yang membantu memberikan rekomendasi diagnosa berdasarkan data anamnesis, pemeriksaan fisik' + (labLines.length > 0 ? ', dan hasil laboratorium' : '') + '.\n\n' +
        'DATA PASIEN:\n' +
        '- Usia: ' + data.umurText + '\n' +
        '- Jenis Kelamin: ' + data.jkLabel + '\n\n' +
        'TANDA-TANDA VITAL:\n' +
        '- Tekanan Darah: ' + data.tdStr + '\n' +
        '- Nadi: ' + data.nadi + ' x/mnt\n' +
        '- Suhu: ' + data.suhu + ' \u00b0C\n' +
        '- Laju Napas (RR): ' + data.rr + ' x/mnt\n' +
        '- Berat Badan: ' + data.bb + ' kg | Tinggi: ' + data.tb + ' cm | IMT: ' + data.imt +
        bagianLab + '\n\n' +
        'ANAMNESIS (Keluhan Utama):\n' + data.keluhan + '\n\n' +
        'PEMERIKSAAN FISIK:\n' + data.fisik + '\n\n' +
        'TUGAS:\n' +
        'Berikan 2-3 kemungkinan diagnosa yang paling relevan berdasarkan SELURUH data di atas. ' + instruksiLab + '\n' +
        'Format jawaban HARUS seperti ini (jangan ada teks lain di luar format):\n\n' +
        'DIAGNOSA_1: [kode ICD-10 dan nama diagnosa]\n' +
        'DIAGNOSA_2: [kode ICD-10 dan nama diagnosa]\n' +
        'DIAGNOSA_3: [kode ICD-10 dan nama diagnosa, atau tulis TIDAK_ADA jika hanya ada 2]\n' +
        'ALASAN: [penjelasan singkat 1-2 kalimat yang menyebut data kunci — termasuk nilai lab jika relevan — yang mendukung diagnosa]\n\n' +
        'Catatan: ini adalah alat bantu klinis, keputusan akhir tetap pada dokter. Gunakan kode ICD-10 yang umum dipakai di Indonesia.';
}

function _parseResponAI(teks) {
    const baris = teks.split('\n').map(b => b.trim()).filter(Boolean);
    const hasil = { diagnosa: [], alasan: '' };
    baris.forEach(b => {
        const matchD = b.match(/^DIAGNOSA_\d+:\s*(.+)$/i);
        const matchA = b.match(/^ALASAN:\s*(.+)$/i);
        if (matchD && matchD[1].trim().toUpperCase() !== 'TIDAK_ADA') {
            hasil.diagnosa.push(matchD[1].trim());
        }
        if (matchA) hasil.alasan = matchA[1].trim();
    });
    return hasil;
}

function _tampilkanHasil(hasil, providerNama) {
    const notif    = document.getElementById('aiNotif');
    const notifTxt = document.getElementById('aiNotifText');
    if (!notif || !notifTxt) return;

    if (hasil.diagnosa.length === 0) {
        notifTxt.innerHTML = `<span style="color:#ef4444;">⚠️ Data klinis belum cukup untuk analisa. Lengkapi keluhan & pemeriksaan fisik.</span>`;
    } else {
        const chips = hasil.diagnosa.map((d, i) => {
            const target = i === 0 ? 'diagnosa' : 'diagnosa2';
            return `<span class="ai-chip" data-target="${target}" data-nilai="${d.replace(/"/g, '&quot;')}" title="Klik untuk mengisi kolom diagnosa">${d}</span>`;
        }).join('');

        notifTxt.innerHTML =
            `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">` +
                `<div style="font-size:10px;font-weight:800;color:#4f46e5;letter-spacing:.5px;">✨ REKOMENDASI AI</div>` +
                `<div style="font-size:9px;color:#94a3b8;font-weight:600;">via ${providerNama || 'AI'}</div>` +
            `</div>` +
            `<div style="margin-bottom:6px;">${chips}</div>` +
            (hasil.alasan ? `<div style="font-size:10.5px;color:#4338ca;opacity:.85;border-top:1px dashed rgba(99,102,241,0.2);padding-top:5px;">${hasil.alasan}</div>` : '') +
            `<div style="font-size:9.5px;color:#6366f1;opacity:.6;margin-top:4px;">💡 Klik chip diagnosa untuk mengisi kolom</div>`;
    }

    notif.style.display = 'flex';
    notif.style.animation = 'none';
    setTimeout(() => { notif.style.animation = 'aiSlideIn .3s ease'; }, 10);

    notifTxt.querySelectorAll('.ai-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            isiDiagnosa(chip.dataset.target, chip.dataset.nilai);
        });
    });
}

function isiDiagnosa(targetId, nilai) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.value = nilai;
    localStorage.setItem('rme_' + targetId, nilai);
    el.style.transition = 'background .3s';
    el.style.background = 'rgba(99,102,241,0.08)';
    setTimeout(() => { el.style.background = ''; }, 800);
    showToast(`✅ Diagnosa diisi: ${nilai.substring(0, 40)}...`, 'success');
}

// ════════════════════════════════════════════════════════
//  FUNGSI UTAMA: REKOMENDASI AI
// ════════════════════════════════════════════════════════

async function rekomendasiAI() {
    const notif    = document.getElementById('aiNotif');
    const notifTxt = document.getElementById('aiNotifText');

    const adaKey = AI_PROVIDERS.some(p =>
        p.enabled && (p.keys || []).some(k => k && k.trim() !== '')
    );

    if (!adaKey) {
        if (notif && notifTxt) {
            notifTxt.innerHTML =
                '<span style="color:#b45309;">⚙️ <b>API Key AI belum tersedia.</b><br>' +
                'Buka <b>⚙️ Settings → Konfigurasi AI API Keys</b> dan pastikan key sudah terisi.<br>' +
                '<span style="font-size:10px;opacity:.8;">Provider gratis: Groq · Gemini · OpenRouter</span></span>';
            notif.style.display = 'flex';
        }
        return;
    }

    const data = _kumpulkanDataKlinis();
    if (data.keluhan === '-' && data.fisik === '-') {
        showToast('⚠️ Isi Keluhan atau Pemeriksaan Fisik terlebih dahulu!', 'warning');
        return;
    }

    const btn      = document.getElementById('btnAI');
    const btnIcon  = document.getElementById('btnAIIcon');
    const btnLabel = document.getElementById('btnAILabel');
    if (btn)      btn.disabled         = true;
    if (btnIcon)  btnIcon.innerHTML    = '<span style="display:inline-block;animation:spin .7s linear infinite">⏳</span>';
    if (btnLabel) btnLabel.textContent = 'Menganalisa...';

    if (notif) notif.style.display = 'none';

    try {
        const prompt             = _buatPrompt(data);
        const { teks, provider } = await _callAIWithFallback(prompt);
        const hasil              = _parseResponAI(teks);
        _tampilkanHasil(hasil, provider);

    } catch (e) {
        if (notif && notifTxt) {
            notifTxt.innerHTML = '<span style="color:#ef4444;">❌ <b>Semua provider gagal.</b><br><small style="opacity:.8">' + e.message + '</small></span>';
            notif.style.display = 'flex';
        }
        showToast('❌ Semua AI provider gagal', 'error');
    } finally {
        if (btn)      btn.disabled         = false;
        if (btnIcon)  btnIcon.textContent  = '✨';
        if (btnLabel) btnLabel.textContent = 'Rekomendasi AI';
    }
}
