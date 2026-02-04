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

async function checkAllNFS() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('id, supplier_tax_id, supplier_name, description')
        .eq('payment_type', 'NFS');

    if (error) {
        console.error('Error:', error);
    } else {
        const total = data.length;
        const withName = data.filter(d => d.supplier_name).length;
        const withDesc = data.filter(d => d.description).length;
        console.log(`Total NFS: ${total}`);
        console.log(`With Name: ${withName}`);
        console.log(`With Description: ${withDesc}`);

        if (withName > 0 || withDesc > 0) {
            console.log('Sample with data:', JSON.stringify(data.find(d => d.supplier_name || d.description), null, 2));
        }
    }
}

checkAllNFS();
