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
import type { PageProps, FinancialTransaction } from '@/types'

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
    const [services, setServices] = useState<FinancialTransaction[]>([])
    const [loading, setLoading] = useState(true)

    const fetchServices = useCallback(async () => {
        setLoading(true)
        try {
            let startDate: string
            let endDate: string = format(new Date(), 'yyyy-MM-dd')

            if (timeRange === 'custom') {
                startDate = customDates.start
                endDate = customDates.end
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd')
            }

            // Fetch Services (Category Type = SRV)
            const query = supabase
                .schema('financial_dashboard')
                .from('financial_transactions')
                .select(`
                    *,
                    departments (name),
                    categories!inner (category_code, category_description, category_type)
                `)
                .eq('categories.category_type', 'SRV')
                .gte('transaction_date', startDate)
                .lte('transaction_date', endDate)

            const data = await fetchAll<FinancialTransaction>(query.order('transaction_date', { ascending: false }))
            if (data) setServices(data)
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
        (service.departments?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    const totalServices = filteredServices.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0)

    // Extract unique providers (using transaction name as proxy for provider since we don't have a specific column)
    const uniqueProviders = new Set(filteredServices.map(s => s.transaction_name)).size

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
                        <span className="font-medium">Serviços Distintos</span>
                    </div>
                    <div className="text-2xl font-bold">{uniqueProviders}</div>
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
                            <Search className="w-4 h-4" /> Buscar Serviço / Depto
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
                                <th className="px-6 py-4 font-medium">Departamento</th>
                                <th className="px-6 py-4 font-medium text-right font-bold text-foreground-app">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {loading && filteredServices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
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
                                            {format(parseISO(service.transaction_date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {service.transaction_name}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <span className="px-2 py-1 rounded bg-secondary-app text-xs uppercase tracking-wider font-semibold">
                                                {service.categories?.category_description || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm">
                                                {service.departments?.name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-primary-app tabular-nums">
                                            {formatCurrency(Number(service.total_value))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground font-medium">
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
