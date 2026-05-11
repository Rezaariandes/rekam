// ════════════════════════════════════════════════════════
//  Supabase Edge Function: get-config
//  Mengembalikan anon key ke frontend secara aman.
//  Key disimpan sebagai Supabase Secret, tidak pernah
//  tertulis di kode atau file GitHub.
//
//  Deploy:
//    supabase functions deploy get-config --no-verify-jwt
//
//  Set secret:
//    supabase secrets set SUPABASE_ANON_KEY="eyJhbGci..."
// ════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
    // Izinkan CORS agar bisa di-fetch dari GitHub Pages / domain manapun
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    const anon_key = Deno.env.get('SUPABASE_ANON_KEY');

    if (!anon_key) {
        return new Response(
            JSON.stringify({ error: 'Secret SUPABASE_ANON_KEY belum di-set di Supabase Dashboard' }),
            { status: 500, headers }
        );
    }

    return new Response(
        JSON.stringify({ anon_key }),
        { status: 200, headers }
    );
});
