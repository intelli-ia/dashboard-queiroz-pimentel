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

async function checkIds() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('id')
        .limit(10);

    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('IDs found:', data.map(d => d.id));
    }
}

checkIds();
