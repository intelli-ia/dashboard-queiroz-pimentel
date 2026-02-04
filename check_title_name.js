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

async function checkTitleName() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Sample Data (Columns):', Object.keys(data[0]));
        console.log('Sample Data (Values):', JSON.stringify(data.map(d => ({ title_name: d.title_name, supplier_name: d.supplier_name, description: d.description })), null, 2));
    }
}

checkTitleName();
