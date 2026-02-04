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

async function findNFSInPurchases() {
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('invoice_number', '2499')
        .eq('supplier_tax_id', '36.751.976/0001-43');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Matches in purchases:', JSON.stringify(data, null, 2));
    }
}

findNFSInPurchases();
