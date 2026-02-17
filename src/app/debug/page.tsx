"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugPage() {
    const [logs, setLogs] = useState<string[]>([])
    const [tables, setTables] = useState<any>({})

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1]} - ${msg}`])

    useEffect(() => {
        runChecks()
    }, [])

    async function runChecks() {
        addLog('Starting checks...')

        // Check 1: Projects Table
        addLog('Checking table: projects...')
        const { data: projects, error: projectsError } = await supabase.from('projects').select('*').limit(5)
        if (projectsError) {
            addLog(`❌ Error fetching projects: ${projectsError.message} (${projectsError.code})`)
        } else {
            addLog(`✅ Projects fetch success. Count: ${projects?.length}`)
            setTables((prev: any) => ({ ...prev, projects }))
        }

        // Check 2: Categories Table
        addLog('Checking table: categories...')
        const { data: categories, error: catError } = await supabase.from('categories').select('*').limit(5)
        if (catError) {
            addLog(`❌ Error fetching categories: ${catError.message} (${catError.code})`)
        } else {
            addLog(`✅ Categories fetch success. Count: ${categories?.length}`)
            setTables((prev: any) => ({ ...prev, categories }))
        }

        // Check 3: Accounts Payable
        addLog('Checking table: accounts_payable...')
        const { data: ap, error: apError } = await supabase.from('accounts_payable').select('*').limit(5)
        if (apError) {
            addLog(`❌ Error fetching accounts_payable: ${apError.message} (${apError.code})`)
        } else {
            addLog(`✅ accounts_payable fetch success. Count: ${ap?.length}`)
            setTables((prev: any) => ({ ...prev, accounts_payable: ap }))
        }

        // Check 4: Accounts Receivable
        addLog('Checking table: accounts_receivable...')
        const { data: ar, error: arError } = await supabase.from('accounts_receivable').select('*').limit(5)
        if (arError) {
            addLog(`❌ Error fetching accounts_receivable: ${arError.message} (${arError.code})`)
        } else {
            addLog(`✅ accounts_receivable fetch success. Count: ${ar?.length}`)
            setTables((prev: any) => ({ ...prev, accounts_receivable: ar }))
        }
    }

    return (
        <div className="p-8 bg-slate-900 min-h-screen text-slate-200 font-mono text-sm">
            <h1 className="text-2xl font-bold mb-4 text-white">Database Debugger</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <h2 className="text-xl font-bold mb-2 text-blue-400">Logs</h2>
                    <div className="flex flex-col gap-1">
                        {logs.map((log, i) => (
                            <div key={i} className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-slate-300'}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 overflow-auto">
                    <h2 className="text-xl font-bold mb-2 text-purple-400">Raw Data Samples</h2>
                    {Object.entries(tables).map(([tableName, data]: [string, any]) => (
                        <div key={tableName} className="mb-6">
                            <h3 className="font-bold text-yellow-500 mb-2 border-b border-slate-600 pb-1">{tableName}</h3>
                            <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
