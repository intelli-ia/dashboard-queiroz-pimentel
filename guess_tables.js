const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
    // Since I can't use RPC or info_schema easily, I'll try to join with some common names
    const potentialTables = [
        'service_invoices', 'services', 'service_items', 'nfs',
        'purchases_services', 'commercial_services', 'projects', 'categories'
    ];

    for (const table of potentialTables) {
        const { count, error } = await supabase
            .schema('dashboard_new')
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (!error) {
            console.log(`Table ${table} exists with count: ${count}`);
        }
    }
}

listAllTables();
