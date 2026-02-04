const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchData() {
    const schemas = ['public', 'dashboard_new', 'dashboard', 'financial', 'financeiro'];

    for (const schema of schemas) {
        try {
            const { count, error } = await supabase
                .schema(schema)
                .from('financial_movements')
                .select('*', { count: 'exact', head: true });

            if (!error) {
                console.log(`Schema ${schema} financial_movements Count: ${count}`);
            } else {
                // If it's just "table not found", skip
                if (!error.message.includes('not find')) {
                    console.log(`Schema ${schema} Error: ${error.message}`);
                }
            }
        } catch (e) {
            // Likely schema not supported by this version or other error
        }
    }
}

searchData();
