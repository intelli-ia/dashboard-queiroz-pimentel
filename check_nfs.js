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

async function checkNFS() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('payment_type', 'NFS')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('NFS Samples:', JSON.stringify(data, null, 2));
    }
}

checkNFS();
