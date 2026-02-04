const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllPossible() {
    console.log('--- Checking schemas and tables ---');

    // Try schema('dashboard_new')
    try {
        const { count, error: errorNew } = await supabase
            .schema('dashboard_new')
            .from('financial_movements')
            .select('*', { count: 'exact', head: true });

        if (errorNew) {
            console.error('dashboard_new error:', errorNew.message);
        } else {
            console.log('dashboard_new.financial_movements count:', count);
        }
    } catch (e) {
        console.error('Error with .schema():', e.message);
    }

    // Try default schema
    const { count: countPublic, error: errorPublic } = await supabase
        .from('financial_movements')
        .select('*', { count: 'exact', head: true });

    if (errorPublic) {
        console.error('public error:', errorPublic.message);
    } else {
        console.log('public.financial_movements count:', countPublic);
    }
}

checkAllPossible();
