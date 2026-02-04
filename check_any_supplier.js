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

async function findAnySupplier() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('id, payment_type, supplier_name, description')
        .not('supplier_name', 'is', null)
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Records with supplier_name:', JSON.stringify(data, null, 2));
    }
}

findAnySupplier();
