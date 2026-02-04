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

async function findAnySupplierInPurchases() {
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .not('supplier_legal_name', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Purchases with name:', JSON.stringify(data, null, 2));
    }
}

findAnySupplierInPurchases();
