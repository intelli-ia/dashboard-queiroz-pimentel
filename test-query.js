const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: 'dashboard_new' } }
);

async function test() {
    console.log('Testing NFE Details query...\n');

    const { data, error } = await supabase
        .from('purchase_items')
        .select(`
        item_sequence,
        product_description,
        total_item_value,
        invoice_key,
        purchases!inner (
            invoice_number,
            supplier_tax_id,
            supplier_legal_name,
            issue_date
        )
    `)
        .limit(1); // Fetch just 1 to verify structure

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! Sample item with invoice:', JSON.stringify(data?.[0], null, 2));
    }
}

test();
