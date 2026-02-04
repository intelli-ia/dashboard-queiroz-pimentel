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

async function findSupplierName() {
    const taxId = "36.751.976/0001-43";

    // Check in purchases (broad search)
    const { data: pData, error: pError } = await supabase
        .from('purchases')
        .select('supplier_legal_name, supplier_tax_id')
        .eq('supplier_tax_id', taxId)
        .limit(1);

    if (pData && pData.length > 0) {
        console.log('Found in purchases:', pData[0].supplier_legal_name);
        return;
    }

    // If not found, search in all records to see if there's any name for this taxId
    const { data: allP, error: errorP } = await supabase
        .from('purchases')
        .select('supplier_legal_name, supplier_tax_id')
        .not('supplier_legal_name', 'is', null)
        .limit(100);

    const entries = allP || [];
    const match = entries.find(e => e.supplier_tax_id === taxId);
    if (match) {
        console.log('Match in purchases sample:', match.supplier_legal_name);
    } else {
        console.log('Tax ID not found in purchases sample.');
    }
}

findSupplierName();
