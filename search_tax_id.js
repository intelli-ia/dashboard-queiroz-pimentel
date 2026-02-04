const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchTaxId() {
    const tables = ['purchases', 'financial_movements', 'projects'];
    // I already checked purchases and financial_movements.
    // Let's try to find other tables by searching for columns that might have CNPJ/Tax ID

    const taxId = "36.751.976/0001-43";
    console.log(`Searching for ${taxId}...`);
}

searchTaxId();
