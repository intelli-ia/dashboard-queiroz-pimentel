const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
    // Try to get all tables names from information_schema.columns (often accessible)
    const { data, error } = await supabase
        .schema('dashboard_new')
        .from('information_schema.columns')
        .select('table_name')
        .limit(1);

    if (error) {
        console.log('Cannot access information_schema via query.');
    } else {
        console.log('Can access information_schema.');
    }

    const potentialTables = [
        'financial_movements', 'purchases', 'projects', 'categories',
        'suppliers', 'providers', 'entities', 'companies', 'nfs_headers', 'service_invoices'
    ];

    for (const table of potentialTables) {
        const { data: sample, error: sError } = await supabase.schema('dashboard_new').from(table).select('*').limit(1);
        if (!sError) {
            console.log(`Table ${table} exists.`);
        }
    }
}

listAllTables();
