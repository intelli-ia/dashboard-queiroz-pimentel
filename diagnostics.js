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

async function runDiagnostics() {
    console.log('--- Table: financial_movements ---');
    const { data: movements, error: movementsError } = await supabase
        .from('financial_movements')
        .select('payment_type, supplier_name, description, net_amount')
        .limit(20);

    if (movementsError) {
        console.error('Movements Error:', movementsError.message);
    } else {
        console.log(`Fetched ${movements.length} movements.`);
        movements.forEach((m, i) => {
            console.log(`${i}: Type=${m.payment_type}, Supplier=${m.supplier_name}, Desc=${m.description}, Amt=${m.net_amount}`);
        });
    }

    console.log('\n--- Counts by Type ---');
    const { data: allTypes, error: typesError } = await supabase
        .from('financial_movements')
        .select('payment_type');

    if (typesError) {
        console.error('Types Error:', typesError.message);
    } else {
        const counts = {};
        allTypes.forEach(t => {
            const type = t.payment_type || 'NULL';
            counts[type] = (counts[type] || 0) + 1;
        });
        console.log('Counts:', counts);
    }
}

runDiagnostics();
