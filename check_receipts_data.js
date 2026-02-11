const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: {
        schema: 'dashboard_new'
    }
});

async function checkReceipts() {
    console.log('Checking receipts table...');
    const { count, error } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error fetching receipts:', error);
    } else {
        console.log(`Total receipts found: ${count}`);
    }

    // Also get a sample to check dates
    const { data, error: dataError } = await supabase
        .from('receipts')
        .select('data_vencimento')
        .limit(5);

    if (data) {
        console.log('Sample dates:', data);
    }
}

checkReceipts();
