const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
        schema: 'public'
    }
});

async function checkPublicTables() {
    const taxId = "36.751.976/0001-43";

    // List all tables in public schema if possible
    const { data: tables, error: tError } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');

    // If we can't list, let's guess
    const targets = ['suppliers', 'entities', 'people', 'companies', 'contacts', 'fornecedores'];

    for (const table of targets) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (!error) {
                console.log(`Table ${table} exists in public.`);
                // Search for taxId in this table
                // We'll need to know column names, so let's just log the first record
                console.log(`Sample from ${table}:`, JSON.stringify(data, null, 2));
            }
        } catch (e) { }
    }
}

checkPublicTables();
