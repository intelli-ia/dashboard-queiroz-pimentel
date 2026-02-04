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
        .ilike('purchase_category', '%serviço%')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Purchases with "serviço":', JSON.stringify(data, null, 2));
    }
}

findNFSInPurchases();
