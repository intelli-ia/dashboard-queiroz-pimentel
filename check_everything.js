const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEverything() {
    const tables = ['financial_movements', 'purchases', 'projects', 'categories', 'purchase_items'];

    for (const table of tables) {
        const { count, error } = await supabase
            .schema('dashboard_new')
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`Table ${table} Error: ${error.message}`);
        } else {
            console.log(`Table ${table} Count: ${count}`);
        }
    }
}

checkEverything();
