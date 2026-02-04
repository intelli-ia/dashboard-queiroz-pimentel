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

async function findAnyData() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('id, payment_type, supplier_name, description')
        .limit(100);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Total records fetched:', data.length);
        const types = [...new Set(data.map(d => d.payment_type))];
        console.log('Types:', types);
        const withSupplier = data.filter(d => d.supplier_name).length;
        const withDesc = data.filter(d => d.description).length;
        console.log(`Records with supplier_name: ${withSupplier}, with description: ${withDesc}`);

        if (data.length > 0) {
            console.log('Sample record:', JSON.stringify(data[0], null, 2));
        }
    }
}

findAnyData();
