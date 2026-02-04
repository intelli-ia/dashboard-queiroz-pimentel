const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFinancialDashboard() {
    const schemas = ['financial_dashboard', 'dashboard_new'];
    const taxId = "36.751.976/0001-43";

    for (const schema of schemas) {
        console.log(`Checking schema: ${schema}`);
        const tables = ['financial_movements', 'purchases', 'suppliers', 'fornecedores'];
        for (const table of tables) {
            try {
                const { data, error } = await supabase.schema(schema).from(table).select('*').limit(1);
                if (!error && data.length > 0) {
                    console.log(`  Table ${table} exists.`);
                    const cols = Object.keys(data[0]);
                    const taxCol = cols.find(c => c.includes('tax') || c.includes('cnpj'));
                    if (taxCol) {
                        const { data: match, error: mError } = await supabase.schema(schema).from(table).select('*').eq(taxCol, taxId).limit(1);
                        if (!mError && match.length > 0) {
                            console.log(`    FOUND match in ${schema}.${table}`);
                            console.log(`    Data:`, JSON.stringify(match[0], null, 2));
                        }
                    }
                }
            } catch (e) { }
        }
    }
}

checkFinancialDashboard();
