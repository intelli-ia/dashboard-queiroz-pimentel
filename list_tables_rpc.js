const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // Try to get tables list via a common RPC or just guess common ones
    const { data, error } = await supabase.rpc('get_tables');

    if (error) {
        console.error('RPC Error:', error.message);
    } else {
        console.log('Tables:', data);
    }
}

listTables();
