"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Calendar,
    Briefcase,
    Building2,
    ArrowUpRight,
    RefreshCcw
} from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import type { PageProps, AccountPayable } from '@/types'

interface MappedService {
    id: number
    transaction_date: string
    transaction_name: string
    total_value: number
    project_name: string
    category_description: string
    installment_label: string
    status_titulo: string | null
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function ServicesPage({ timeRange, setTimeRange, customDates, setCustomDates }: PageProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [services, setServices] = useState<MappedService[]>([])
    const [loading, setLoading] = useState(true)

    const fetchServices = useCallback(async () => {
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
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd')
            }

            // Fetch Services from accounts_payable with document_type = 'NFS' (Nota Fiscal de Serviço)
            const query = supabase
                .from('accounts_payable')
                .select(`
                    codigo_lancamento_omie,
                    numero_documento,
                    numero_documento_fiscal,
                    project_code,
                    category_code,
                    current_installment,
                    total_installments,
                    data_emissao,
                    data_vencimento,
                    status_titulo,
                    valor_documento,
                    document_type,
                    projects:project_code (code, name),
                    categories:category_code (code, description)
                `)
                .eq('document_type', 'NFS')
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)
                .order('data_vencimento', { ascending: false })

            const rawData = await fetchAll<AccountPayable>(query)

            if (rawData) {
                const mappedData: MappedService[] = rawData.map(item => {
                    const installmentLabel = item.total_installments > 1
                        ? `${item.current_installment}/${item.total_installments}`
                        : ''

                    return {
                        id: item.codigo_lancamento_omie,
                        transaction_date: item.data_vencimento || item.data_emissao || '',
                        transaction_name: `NFS: ${item.numero_documento || item.numero_documento_fiscal || item.codigo_lancamento_omie}`,
                        total_value: Number(item.valor_documento) || 0,
                        project_name: item.projects?.name || '-',
                        category_description: item.categories?.description || 'Serviços',
                        installment_label: installmentLabel,
                        status_titulo: item.status_titulo
                    }
                })
                setServices(mappedData)
            }
        } catch (err) {
            console.error('Error fetching services:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates])

    useEffect(() => {
        fetchServices()
    }, [fetchServices])

    const filteredServices = services.filter(service =>
        (service.transaction_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (service.project_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (service.category_description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    const totalServices = filteredServices.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0)
    const uniqueCategories = new Set(filteredServices.map(s => s.category_description)).size

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Custos de Serviços</h1>
                    <p className="text-muted-foreground">Gestão de prestadores de serviço e terceirizados</p>
                </div>
                {loading && <RefreshCcw className="w-5 h-5 animate-spin text-primary-app ml-2" />}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-primary-app">
                        <Briefcase className="w-5 h-5" />
                        <span className="font-medium">Total em Serviços</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalServices)}</div>
                    <div className="text-xs text-muted-foreground">No período selecionado</div>
                </div>
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <Building2 className="w-5 h-5" />
                        <span className="font-medium">Categorias</span>
                    </div>
                    <div className="text-2xl font-bold">{uniqueCategories}</div>
                    <div className="text-xs text-muted-foreground">Tipos de serviço contratados</div>
                </div>
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <ArrowUpRight className="w-5 h-5" />
                        <span className="font-medium">Média por Serviço</span>
                    </div>
                    <div className="text-2xl font-bold">
                        {filteredServices.length > 0
                            ? formatCurrency(totalServices / filteredServices.length)
                            : formatCurrency(0)
                        }
                    </div>
                    <div className="text-xs text-muted-foreground">Ticket médio de contratos</div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass p-6 rounded-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                    {/* Search */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Search className="w-4 h-4" /> Buscar Serviço / Projeto
                        </label>
                        <input
                            type="text"
                            placeholder="Digite para buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all"
                        />
                    </div>

                    {/* Date Presets */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Período
                        </label>
                        <div className="flex bg-card-app p-1 rounded-lg border border-border-app h-[42px]">
                            {['7', '30', '90', '360'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === range
                                        ? 'bg-primary-app text-white shadow-lg'
                                        : 'text-muted-foreground hover:text-white'
                                        }`}
                                >
                                    {range}D
                                </button>
                            ))}
                            <button
                                onClick={() => setTimeRange('lastYear')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'lastYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Ano passado
                            </button>
                            <button
                                onClick={() => setTimeRange('thisYear')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'thisYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Este ano
                            </button>
                            <button
                                onClick={() => setTimeRange('custom')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'custom'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Pers.
                            </button>
                        </div>
                    </div>
                </div>

                {/* Custom Date Picker */}
                {timeRange === 'custom' && (
                    <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">De:</label>
                            <input
                                type="date"
                                value={customDates.start}
                                onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                className="bg-muted-app border border-border-app rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-app outline-none appearance-none invert hue-rotate-180 brightness-90"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">Até:</label>
                            <input
                                type="date"
                                value={customDates.end}
                                onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                className="bg-muted-app border border-border-app rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-app outline-none appearance-none invert hue-rotate-180 brightness-90"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                            <tr>
                                <th className="px-6 py-4 font-medium">Data</th>
                                <th className="px-6 py-4 font-medium">Descrição</th>
                                <th className="px-6 py-4 font-medium">Categoria</th>
                                <th className="px-6 py-4 font-medium">Projeto</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right font-bold text-foreground-app">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {loading && filteredServices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCcw className="w-8 h-8 animate-spin text-primary-app" />
                                            <span className="text-muted-foreground">Buscando serviços...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredServices.length > 0 ? (
                                filteredServices.map((service) => (
                                    <tr key={service.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {service.transaction_date ? format(parseISO(service.transaction_date), 'dd/MM/yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            <div className="flex flex-col">
                                                <span>{service.transaction_name}</span>
                                                {service.installment_label && (
                                                    <span className="text-[10px] text-primary-app font-bold uppercase tracking-wider">
                                                        {service.installment_label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <span className="px-2 py-1 rounded bg-secondary-app text-xs uppercase tracking-wider font-semibold">
                                                {service.category_description}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm">
                                                {service.project_name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${service.status_titulo === 'LIQUIDADO'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                : service.status_titulo === 'ABERTO'
                                                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                    : service.status_titulo === 'ATRASADO'
                                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                                }`}>
                                                {service.status_titulo || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-primary-app tabular-nums">
                                            {formatCurrency(Number(service.total_value))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground font-medium">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
