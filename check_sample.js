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

async function checkSample() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('id, payment_type, supplier_name, description, net_amount')
        .limit(100);

    if (error) {
        console.error('Error:', error);
    } else {
        const withData = data.filter(d => d.supplier_name || d.description);
        console.log('Total records:', data.length);
        console.log('Records with supplier_name or description:', withData.length);
        console.log('Sample of records with data:', JSON.stringify(withData.slice(0, 5), null, 2));

        const types = [...new Set(data.map(d => d.payment_type))];
        console.log('Types found in sample:', types);
    }
}

checkSample();
