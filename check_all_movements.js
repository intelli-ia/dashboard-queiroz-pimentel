const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
        schema: 'dashboard_new'
    }
});

async function checkMovements() {
    const { count, error: countError } = await supabase
        .from('financial_movements')
        .select('*', { count: 'exact', head: true });

    console.log('Total movements count:', count);

    const { data, error } = await supabase
        .from('financial_movements')
        .select('*')
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Movements Sample:', JSON.stringify(data, null, 2));
    }
}

checkMovements();
