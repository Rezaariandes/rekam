// ════════════════════════════════════════════════════════
//  KLIKPRO RME — DATA ICD-10
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
