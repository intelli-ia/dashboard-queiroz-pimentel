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

async function checkPaymentTypes() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('payment_type');

    if (error) {
        console.error('Error:', error);
    } else {
        const types = [...new Set(data.map(d => d.payment_type))];
        console.log('Unique Payment Types:', types);
    }
}

checkPaymentTypes();
