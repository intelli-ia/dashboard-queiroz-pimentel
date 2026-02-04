const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase
        .rpc('get_tables_by_schema', { schema_name: 'dashboard_new' }); // This might fail if RPC doesn't exist

    if (error) {
        console.log('RPC Error:', error.message);

        // Fallback: try to guess or use information_schema if allowed
        const { data: cols, error: colsError } = await supabase
            .from('information_schema.columns')
            .select('table_name, column_name')
            .eq('table_schema', 'dashboard_new');

        if (colsError) {
            console.log('info_schema Error:', colsError.message);
        } else {
            const tables = {};
            cols.forEach(c => {
                tables[c.table_name] = (tables[c.table_name] || 0) + 1;
            });
            console.log('Tables found via info_schema:', tables);
        }
    } else {
        console.log('Tables via RPC:', data);
    }
}

listTables();
