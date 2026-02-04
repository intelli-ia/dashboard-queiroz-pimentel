const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchEverywhere() {
    const schemas = ['public', 'dashboard_new', 'dashboard', 'financeiro', 'finance'];
    const taxId = "36.751.976/0001-43";

    for (const schema of schemas) {
        console.log(`Checking schema: ${schema}`);
        // Try to find any table with 'cnpj' or 'tax' in its columns
        // Since we can't do that easily, let's try common tables in each schema
        const commonTables = ['financial_movements', 'purchases', 'suppliers', 'contacts', 'entities'];
        for (const table of commonTables) {
            try {
                const { data, error } = await supabase.schema(schema).from(table).select('*').limit(1);
                if (!error && data.length > 0) {
                    console.log(`  - Table ${table} exists and has data.`);
                    // Check if it has a match for taxId (we'll try common column names)
                    const cols = Object.keys(data[0]);
                    const taxCol = cols.find(c => c.includes('tax') || c.includes('cnpj') || c.includes('document'));
                    if (taxCol) {
                        const { data: match, error: mError } = await supabase.schema(schema).from(table).select('*').eq(taxCol, taxId).limit(1);
                        if (!mError && match.length > 0) {
                            console.log(`    !!! FOUND MATCH in ${schema}.${table} !!!`);
                            console.log(`    Data:`, JSON.stringify(match[0], null, 2));
                        }
                    }
                }
            } catch (e) { }
        }
    }
}

searchEverywhere();
