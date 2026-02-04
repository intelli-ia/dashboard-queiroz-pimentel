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

async function findNFSProviders() {
    const { data: nfsMovements, error: nfsError } = await supabase
        .from('financial_movements')
        .select('supplier_tax_id')
        .eq('payment_type', 'NFS');

    if (nfsError) {
        console.error('NFS Error:', nfsError);
        return;
    }

    const nfsTaxIds = Array.from(new Set(nfsMovements.map(m => m.supplier_tax_id).filter(Boolean)));
    console.log('NFS Tax IDs found:', nfsTaxIds);

    if (nfsTaxIds.length === 0) {
        console.log('No Tax IDs found for NFS.');
        return;
    }

    const { data: purchases, error: pError } = await supabase
        .from('purchases')
        .select('supplier_tax_id, supplier_legal_name')
        .in('supplier_tax_id', nfsTaxIds);

    if (pError) {
        console.error('Purchases Error:', pError);
    } else {
        console.log('Purchases with matching Tax IDs:', JSON.stringify(purchases, null, 2));
    }
}

findNFSProviders();
