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

async function findNFSWithSupplier() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('id, supplier_tax_id, supplier_name, description, installment_label')
        .eq('payment_type', 'NFS')
        .not('supplier_name', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('NFS with supplier_name:', JSON.stringify(data, null, 2));
    }
}

findNFSWithSupplier();
