const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listSchemas() {
    const { data, error } = await supabase
        .rpc('get_schemas'); // Guessing RPC name

    if (error) {
        console.log('RPC Error:', error.message);

        // Try to query from a common table like pg_namespace if allowed (unlikely for anon)
        const { data: q, error: qe } = await supabase
            .from('pg_namespace')
            .select('nspname');

        if (qe) {
            console.log('pg_namespace Error:', qe.message);
        } else {
            console.log('Schemas:', q.map(n => n.nspname));
        }
    } else {
        console.log('Schemas via RPC:', data);
    }
}

listSchemas();
