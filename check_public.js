const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPublic() {
    const { data, error } = await supabase
        .from('financial_movements')
        .select('count', { count: 'exact' });

    if (error) {
        console.error('Public Error:', error.message);
    } else {
        console.log('Public financial_movements count:', data);
    }
}

checkPublic();
