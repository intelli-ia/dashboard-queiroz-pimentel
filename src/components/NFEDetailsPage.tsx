"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps, NFEItem } from '@/types'

type SortField = 'display_date' | 'cpf_cnpj' | 'razao_social' | 'category_description' | 'numero_nfe' | 'project_name' | 'descricao_produto' | 'valor_total'
type SortDirection = 'asc' | 'desc' | null

interface MappedItem {
    id: string
    descricao_produto: string | null
    valor_total: number
    quantidade: number | null
    numero_nfe: string | null
    cpf_cnpj: string | null
    razao_social: string | null
    project_name: string
    category_description: string
    data_emissao: string | null
    display_date: string
}

export default function NFEDetailsPage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [items, setItems] = useState<MappedItem[]>([])
    const [loading, setLoading] = useState(true)

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        cpf_cnpj: '',
        razao_social: '',
        category_description: '',
        numero_nfe: '',
        project_name: '',
        descricao_produto: '',
        valor_total: ''
    })

    const fetchItems = useCallback(async () => {
        setLoading(true)
        try {
            let startDate: string
            let endDate: string = format(new Date(), 'yyyy-MM-dd')
            const currentYear = new Date().getFullYear()

            if (timeRange === 'custom') {
                startDate = customDates.start
                endDate = customDates.end
            } else if (timeRange === 'lastYear') {
                startDate = `${currentYear - 1}-01-01`
                endDate = `${currentYear - 1}-12-31`
            } else if (timeRange === 'thisYear') {
                startDate = `${currentYear}-01-01`
                endDate = `${currentYear}-12-31`
            } else if (timeRange === 'all') {
                startDate = '2000-01-01'
                endDate = '2099-12-31'
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd')
            }

            console.log('Fetching NFE items from', startDate, 'to', endDate)

            // Query nfe_items with join to nfe_headers
            let query = supabase
                .from('nfe_items')
                .select(`
                    id_item,
                    id_recebimento,
                    descricao_produto,
                    valor_total,
                    quantidade,
                    sequencia,
                    category_code,
                    nfe_headers!inner (
                        id_recebimento,
                        cpf_cnpj,
                        nome_fantasia,
                        razao_social,
                        numero_nfe,
                        data_emissao,
                        valor_nfe,
                        project_code,
                        projects:project_code (code, name)
                    ),
                    categories:category_code (code, description)
                `)
                .gte('nfe_headers.data_emissao', startDate)
                .lte('nfe_headers.data_emissao', endDate)

            if (selectedProject) {
                query = query.eq('nfe_headers.project_code', selectedProject)
            }

            query = query.order('id_item', { ascending: false })

            const rawItems = await fetchAll<NFEItem>(query)
            console.log('NFE items fetched:', rawItems?.length || 0, 'records')

            // Map data for display
            const mappedData: MappedItem[] = rawItems?.map(item => {
                const header = item.nfe_headers as unknown as {
                    id_recebimento: number
                    cpf_cnpj: string | null
                    nome_fantasia: string | null
                    razao_social: string | null
                    numero_nfe: string | null
                    data_emissao: string | null
                    valor_nfe: number | null
                    project_code: string | null
                    projects: { code: string; name: string } | null
                }

                return {
                    id: `${item.id_recebimento}-${item.id_item}`,
                    descricao_produto: item.descricao_produto,
                    valor_total: Number(item.valor_total) || 0,
                    quantidade: item.quantidade,
                    numero_nfe: header?.numero_nfe,
                    cpf_cnpj: header?.cpf_cnpj,
                    razao_social: header?.razao_social || header?.nome_fantasia,
                    project_name: header?.projects?.name || 'N/A',
                    category_description: item.categories?.description || 'N/A',
                    data_emissao: header?.data_emissao,
                    display_date: header?.data_emissao || ''
                }
            }) || []

            setItems(mappedData)
        } catch (err) {
            console.error('Error fetching NFE items:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else if (sortDirection === 'desc') {
                setSortDirection(null)
                setSortField(null)
            }
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    // Handle filter change
    const handleFilterChange = (field: string, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }))
    }

    // Clear filter
    const clearFilter = (field: string) => {
        setFilters(prev => ({ ...prev, [field]: '' }))
    }

    // Apply filters and sorting
    const filteredAndSortedItems = useMemo(() => {
        let result = [...items]

        // Apply filters
        Object.entries(filters).forEach(([field, value]) => {
            if (value) {
                result = result.filter(item => {
                    let fieldValue = ''

                    if (field === 'display_date') {
                        fieldValue = item.display_date ? format(parseISO(item.display_date), 'dd/MM/yyyy') : ''
                    } else {
                        fieldValue = String((item as Record<string, unknown>)[field] || '')
                    }

                    return fieldValue.toLowerCase().includes(value.toLowerCase())
                })
            }
        })

        // Apply sorting
        if (sortField && sortDirection) {
            result.sort((a, b) => {
                let aValue: string | number = (a as Record<string, unknown>)[sortField] as string | number
                let bValue: string | number = (b as Record<string, unknown>)[sortField] as string | number

                // Handle numeric sorting
                if (sortField === 'valor_total') {
                    aValue = Number(aValue) || 0
                    bValue = Number(bValue) || 0
                }

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
        }

        return result
    }, [items, filters, sortField, sortDirection])

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-4 h-4 opacity-50" />
        }
        return sortDirection === 'asc' ?
            <ArrowUp className="w-4 h-4 text-primary-app" /> :
            <ArrowDown className="w-4 h-4 text-primary-app" />
    }

    return (
        <div className="space-y-6">
            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Detalhamento NFE"
                subtitle="Visualização detalhada dos itens das notas fiscais"
                loading={loading}
            />

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-app" />
                </div>
            ) : (
                <div className="glass rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted-app/50 border-b border-border-app">
                                <tr>
                                    {/* Data */}
                                    <th className="px-4 py-3 text-left w-32">
                                        <button onClick={() => handleSort('display_date')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Data <SortIcon field="display_date" />
                                        </button>
                                    </th>
                                    {/* CNPJ/CPF */}
                                    <th className="px-4 py-3 text-left w-40">
                                        <button onClick={() => handleSort('cpf_cnpj')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            CNPJ/CPF <SortIcon field="cpf_cnpj" />
                                        </button>
                                    </th>
                                    {/* Razão Social */}
                                    <th className="px-4 py-3 text-left w-48">
                                        <button onClick={() => handleSort('razao_social')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Razão Social <SortIcon field="razao_social" />
                                        </button>
                                    </th>
                                    {/* Categoria */}
                                    <th className="px-4 py-3 text-left w-40">
                                        <button onClick={() => handleSort('category_description')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Categoria <SortIcon field="category_description" />
                                        </button>
                                    </th>
                                    {/* Número da Nota */}
                                    <th className="px-4 py-3 text-left w-24">
                                        <button onClick={() => handleSort('numero_nfe')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Nº Nota <SortIcon field="numero_nfe" />
                                        </button>
                                    </th>
                                    {/* Projeto */}
                                    <th className="px-4 py-3 text-left w-40">
                                        <button onClick={() => handleSort('project_name')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Projeto <SortIcon field="project_name" />
                                        </button>
                                    </th>
                                    {/* Descrição do Item */}
                                    <th className="px-4 py-3 text-left min-w-[200px]">
                                        <button onClick={() => handleSort('descricao_produto')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Descrição do Item <SortIcon field="descricao_produto" />
                                        </button>
                                    </th>
                                    {/* Valor */}
                                    <th className="px-4 py-3 text-right w-32">
                                        <button onClick={() => handleSort('valor_total')} className="flex items-center gap-2 ml-auto text-sm font-semibold hover:text-primary-app transition-colors">
                                            Valor <SortIcon field="valor_total" />
                                        </button>
                                    </th>
                                </tr>

                                {/* Filter Row */}
                                <tr className="bg-muted-app/30">
                                    {[
                                        'display_date',
                                        'cpf_cnpj',
                                        'razao_social',
                                        'category_description',
                                        'numero_nfe',
                                        'project_name',
                                        'descricao_produto',
                                        'valor_total'
                                    ].map((field) => (
                                        <th key={field} className="px-4 py-2">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar..."
                                                    value={filters[field]}
                                                    onChange={(e) => handleFilterChange(field, e.target.value)}
                                                    className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                                />
                                                {filters[field] && (
                                                    <button
                                                        onClick={() => clearFilter(field)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2"
                                                    >
                                                        <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                            {items.length === 0
                                                ? 'Nenhum item encontrado no período selecionado'
                                                : 'Nenhum resultado encontrado com os filtros aplicados'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedItems.map((item, idx) => (
                                        <tr
                                            key={`${item.id}-${idx}`}
                                            className="border-b border-border-app/50 hover:bg-muted-app/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-sm">
                                                {item.display_date ? format(parseISO(item.display_date), 'dd/MM/yyyy') : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono truncate max-w-[150px]" title={item.cpf_cnpj || ''}>
                                                {item.cpf_cnpj || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[200px]" title={item.razao_social || ''}>
                                                {item.razao_social || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[150px]" title={item.category_description}>
                                                {item.category_description || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                {item.numero_nfe || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[150px]" title={item.project_name}>
                                                {item.project_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[300px]" title={item.descricao_produto || ''}>
                                                {item.descricao_produto || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold">
                                                {new Intl.NumberFormat('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL'
                                                }).format(item.valor_total || 0)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredAndSortedItems.length > 0 && (
                        <div className="px-4 py-3 bg-muted-app/30 border-t border-border-app text-sm text-muted-foreground flex justify-between items-center">
                            <span>
                                Exibindo {filteredAndSortedItems.length} de {items.length} itens
                            </span>
                            <span className="font-semibold">
                                Total: {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(filteredAndSortedItems.reduce((sum, item) => sum + (item.valor_total || 0), 0))}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
