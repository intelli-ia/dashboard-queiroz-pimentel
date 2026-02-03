const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: 'dashboard_new' } }
);

async function verify() {
    console.log('='.repeat(60));
    console.log('VERIFICAÇÃO DE INTEGRIDADE DO BANCO DE DADOS');
    console.log('='.repeat(60));

    // 1. Contagem de registros em cada tabela
    console.log('\n📊 CONTAGEM DE REGISTROS\n');

    const tables = ['projects', 'categories', 'purchases', 'purchase_items', 'financial_movements'];

    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`❌ ${table}: ERRO - ${error.message}`);
        } else {
            console.log(`✅ ${table}: ${count} registros`);
        }
    }

    // 2. Verificar correlação financial_movements → purchases via invoice_key
    console.log('\n🔗 CORRELAÇÃO: financial_movements → purchases (via invoice_key)\n');

    const { data: fmData, error: fmError } = await supabase
        .from('financial_movements')
        .select('title_id, invoice_key, invoice_number')
        .limit(1000);

    if (fmError) {
        console.log(`❌ Erro ao buscar financial_movements: ${fmError.message}`);
    } else {
        const totalFm = fmData.length;
        const withInvoiceKey = fmData.filter(f => f.invoice_key).length;
        const withoutInvoiceKey = fmData.filter(f => !f.invoice_key).length;

        console.log(`Total de títulos financeiros: ${totalFm}`);
        console.log(`Com invoice_key preenchido: ${withInvoiceKey}`);
        console.log(`Sem invoice_key: ${withoutInvoiceKey}`);

        // Verificar se os invoice_keys existem em purchases
        if (withInvoiceKey > 0) {
            const invoiceKeys = fmData.filter(f => f.invoice_key).map(f => f.invoice_key);
            const uniqueKeys = [...new Set(invoiceKeys)];

            const { data: existingInvoices, error: invError } = await supabase
                .from('purchases')
                .select('invoice_key')
                .in('invoice_key', uniqueKeys.slice(0, 100)); // Limitar a 100 para não sobrecarregar

            if (invError) {
                console.log(`❌ Erro ao verificar invoice_keys: ${invError.message}`);
            } else {
                const existingKeys = new Set(existingInvoices.map(i => i.invoice_key));
                const missingKeys = uniqueKeys.slice(0, 100).filter(k => !existingKeys.has(k));

                if (missingKeys.length === 0) {
                    console.log(`✅ Todos os invoice_keys verificados existem em purchases`);
                } else {
                    console.log(`⚠️ ${missingKeys.length} invoice_keys não encontrados em purchases`);
                    console.log(`   Exemplos: ${missingKeys.slice(0, 3).join(', ')}`);
                }
            }
        }
    }

    // 3. Verificar correlação purchase_items → purchases via invoice_key
    console.log('\n🔗 CORRELAÇÃO: purchase_items → purchases (via invoice_key)\n');

    const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_items')
        .select('item_sequence, invoice_key')
        .limit(1000);

    if (itemsError) {
        console.log(`❌ Erro ao buscar purchase_items: ${itemsError.message}`);
    } else {
        const totalItems = itemsData.length;
        const itemKeys = itemsData.map(i => i.invoice_key).filter(Boolean);
        const uniqueItemKeys = [...new Set(itemKeys)];

        console.log(`Total de itens: ${totalItems}`);
        console.log(`Invoice keys únicos referenciados: ${uniqueItemKeys.length}`);

        // Verificar se os invoice_keys existem em purchases
        const { data: existingInvoices2 } = await supabase
            .from('purchases')
            .select('invoice_key')
            .in('invoice_key', uniqueItemKeys.slice(0, 100));

        if (existingInvoices2) {
            const existingKeys2 = new Set(existingInvoices2.map(i => i.invoice_key));
            const missingKeys2 = uniqueItemKeys.slice(0, 100).filter(k => !existingKeys2.has(k));

            if (missingKeys2.length === 0) {
                console.log(`✅ Todos os invoice_keys dos itens existem em purchases`);
            } else {
                console.log(`⚠️ ${missingKeys2.length} invoice_keys de itens não encontrados`);
            }
        }
    }

    // 4. Verificar correlações com projects e categories
    console.log('\n🔗 CORRELAÇÃO: financial_movements → projects/categories\n');

    const { data: fmWithRefs } = await supabase
        .from('financial_movements')
        .select('title_id, project_id, category_id')
        .limit(1000);

    if (fmWithRefs) {
        const withProjectId = fmWithRefs.filter(f => f.project_id).length;
        const withCategoryId = fmWithRefs.filter(f => f.category_id).length;

        console.log(`Títulos com project_id: ${withProjectId}/${fmWithRefs.length}`);
        console.log(`Títulos com category_id: ${withCategoryId}/${fmWithRefs.length}`);

        // Verificar se project_ids existem
        const projectIds = [...new Set(fmWithRefs.filter(f => f.project_id).map(f => f.project_id))];
        if (projectIds.length > 0) {
            const { data: existingProjects } = await supabase
                .from('projects')
                .select('code')
                .in('code', projectIds);

            if (existingProjects) {
                const existingProjectCodes = new Set(existingProjects.map(p => p.code));
                const missingProjects = projectIds.filter(p => !existingProjectCodes.has(p));

                if (missingProjects.length === 0) {
                    console.log(`✅ Todos os project_ids existem na tabela projects`);
                } else {
                    console.log(`⚠️ ${missingProjects.length} project_ids não encontrados`);
                    console.log(`   Exemplos: ${missingProjects.slice(0, 3).join(', ')}`);
                }
            }
        }

        // Verificar se category_ids existem
        const categoryIds = [...new Set(fmWithRefs.filter(f => f.category_id).map(f => f.category_id))];
        if (categoryIds.length > 0) {
            const { data: existingCategories } = await supabase
                .from('categories')
                .select('code')
                .in('code', categoryIds);

            if (existingCategories) {
                const existingCategoryCodes = new Set(existingCategories.map(c => c.code));
                const missingCategories = categoryIds.filter(c => !existingCategoryCodes.has(c));

                if (missingCategories.length === 0) {
                    console.log(`✅ Todos os category_ids existem na tabela categories`);
                } else {
                    console.log(`⚠️ ${missingCategories.length} category_ids não encontrados`);
                    console.log(`   Exemplos: ${missingCategories.slice(0, 3).join(', ')}`);
                }
            }
        }
    }

    // 5. Verificar relação 1:N (parcelas)
    console.log('\n📋 VERIFICAÇÃO DE PARCELAS (1:N)\n');

    const { data: installments } = await supabase
        .from('financial_movements')
        .select('invoice_key, installment_label, original_amount')
        .not('invoice_key', 'is', null)
        .limit(1000);

    if (installments) {
        // Agrupar por invoice_key
        const byInvoice = {};
        installments.forEach(i => {
            if (!byInvoice[i.invoice_key]) byInvoice[i.invoice_key] = [];
            byInvoice[i.invoice_key].push(i);
        });

        const invoicesWithMultiple = Object.entries(byInvoice).filter(([_, items]) => items.length > 1);
        const invoicesWithSingle = Object.entries(byInvoice).filter(([_, items]) => items.length === 1);

        console.log(`Notas com parcela única: ${invoicesWithSingle.length}`);
        console.log(`Notas com múltiplas parcelas: ${invoicesWithMultiple.length}`);

        if (invoicesWithMultiple.length > 0) {
            console.log(`\nExemplo de nota com múltiplas parcelas:`);
            const [invoiceKey, parcelas] = invoicesWithMultiple[0];
            console.log(`  Invoice Key: ${invoiceKey}`);
            parcelas.forEach(p => {
                console.log(`    - ${p.installment_label || 'sem label'}: R$ ${p.original_amount}`);
            });
        }
    }

    // 6. Amostra de dados
    console.log('\n📝 AMOSTRA DE DADOS\n');

    const { data: sample } = await supabase
        .from('financial_movements')
        .select(`
            title_id,
            invoice_key,
            invoice_number,
            original_amount,
            installment_label,
            is_paid,
            projects (name),
            categories (description),
            purchases (supplier_legal_name)
        `)
        .limit(3);

    if (sample && sample.length > 0) {
        console.log('Amostra de financial_movements com JOINs:');
        sample.forEach((item, idx) => {
            console.log(`\n  [${idx + 1}] Title ID: ${item.title_id}`);
            console.log(`      Invoice: ${item.invoice_number} ${item.installment_label ? `(${item.installment_label})` : ''}`);
            console.log(`      Valor: R$ ${item.original_amount}`);
            console.log(`      Pago: ${item.is_paid ? 'Sim' : 'Não'}`);
            console.log(`      Projeto: ${item.projects?.name || 'N/A'}`);
            console.log(`      Categoria: ${item.categories?.description || 'N/A'}`);
            console.log(`      Fornecedor: ${item.purchases?.supplier_legal_name || 'N/A'}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('VERIFICAÇÃO CONCLUÍDA');
    console.log('='.repeat(60));
}

verify().catch(console.error);
