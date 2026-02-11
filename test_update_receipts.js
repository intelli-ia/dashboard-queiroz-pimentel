const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: {
        schema: 'dashboard_new'
    }
});

async function testUpdate() {
    console.log('Testing update on receipts table...');

    // First, find a valid record - no range restriction
    const { data: records, error: fetchError } = await supabase
        .from('receipts')
        .select('codigo_lancamento, status')
        .limit(1);

    if (fetchError || !records || records.length === 0) {
        console.error('Error fetching records:', fetchError || 'No records found');
        return;
    }

    const firstRecord = records[0];
    console.log('Target record:', firstRecord);

    // Try to update it back to its current status
    const { data: updateData, error: updateError, status, statusText } = await supabase
        .from('receipts')
        .update({ status: firstRecord.status })
        .eq('codigo_lancamento', firstRecord.codigo_lancamento)
        .select();

    if (updateError) {
        console.error('Update failed!');
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        console.error('HTTP Status:', status, statusText);
    } else {
        console.log('Update successful!');
        console.log('Response data:', updateData);
    }
}

testUpdate();
