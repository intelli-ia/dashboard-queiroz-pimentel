const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPublicTables() {
    const tables = ['financial_accounts_payable', 'purchase_invoice_items', 'financial_movements'];
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`Public.${table} Error: ${error.message}`);
        } else {
            console.log(`Public.${table} Count: ${count}`);
        }
    }
}

checkPublicTables();
