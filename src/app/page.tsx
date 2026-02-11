"use client"

import { useState, useEffect } from 'react'
import Dashboard from '@/components/Dashboard'
import NFEPage from '@/components/NFEPage'
import NFSPage from '@/components/NFSPage'
import NFEDetailsPage from '@/components/NFEDetailsPage'
import Login from '@/components/Login'
import { LayoutDashboard, ReceiptText, List, ChevronLeft, ChevronRight, LogOut, ScrollText, Users, Layers, TrendingUp } from 'lucide-react'
import GenericFinancialPage from '@/components/GenericFinancialPage'
import ReceiptsPage from '@/components/ReceiptsPage'
import Image from 'next/image'

import { format, subDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { ProjectOption } from '@/types'

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'nfe' | 'nfs' | 'contracts' | 'payroll' | 'receipts' | 'misc'>('dashboard')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Shared Filter State (must be declared before any conditional returns)
  const [timeRange, setTimeRange] = useState('thisYear')
  const [customDates, setCustomDates] = useState({
    start: format(subDays(new Date(), 360), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })

  // Project Filter State
  const [selectedProject, setSelectedProject] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])

  useEffect(() => {
    checkAuth()
    fetchProjects()
  }, [])

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select('code, name')
      .order('name')
    if (data) {
      setProjects(data.map(p => ({ id: p.code, name: p.name })))
    }
  }

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth')
      const data = await response.json()
      setIsAuthenticated(data.authenticated)
    } catch {
      setIsAuthenticated(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    setIsAuthenticated(false)
  }

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background-app flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-app border-t-transparent rounded-full" />
      </div>
    )
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <main className="min-h-screen bg-background-app text-foreground-app flex">
      {/* Navigation Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-20 md:w-64'} border-r border-border-app bg-card-app/50 backdrop-blur-xl flex flex-col p-4 fixed h-full z-50 transition-all duration-300`}>
        {/* Logo Section */}
        <div className="flex items-center justify-between mb-8">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="relative w-10 h-10 shrink-0">
              <Image
                src="/logo-qp.png"
                alt="Queiroz Pimentel"
                fill
                className="object-contain"
                priority
              />
            </div>
            {!isSidebarCollapsed && (
              <div className="hidden md:block">
                <h2 className="font-bold text-sm leading-tight">Dashboard</h2>
                <p className="text-xs text-muted-foreground">Queiroz Pimentel</p>
              </div>
            )}
          </div>

          {/* Toggle Button - Only visible on desktop */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 transition-colors shrink-0"
            title={isSidebarCollapsed ? 'Expandir menu' : 'Retrair menu'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'dashboard'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Dashboard"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Dashboard</span>}
          </button>

          <button
            onClick={() => setActiveTab('nfe')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'nfe'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="NFE"
          >
            <ReceiptText className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">NFE</span>}
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'receipts'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Contas a Receber"
          >
            <TrendingUp className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Contas a Receber</span>}
          </button>

          <button
            onClick={() => setActiveTab('items')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'items'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Detalhamento NFE"
          >
            <List className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Detalhamento NFE</span>}
          </button>

          <button
            onClick={() => setActiveTab('nfs')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'nfs'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="NFS"
          >
            <ScrollText className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">NFS</span>}
          </button>


          <button
            onClick={() => setActiveTab('contracts')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'contracts'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Contratos"
          >
            <ScrollText className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Contratos</span>}
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'payroll'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Folha de Pagamento"
          >
            <Users className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Folha de Pagamento</span>}
          </button>

          <button
            onClick={() => setActiveTab('misc')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'misc'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Geral"
          >
            <Layers className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Geral</span>}
          </button>
        </nav>

        <div className="pt-4 border-t border-border-app mt-auto">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title="Sair"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <div className={`flex-1 ${isSidebarCollapsed ? 'ml-20' : 'ml-20 md:ml-64'} transition-all duration-300`}>
        {activeTab === 'dashboard' ? (
          <Dashboard
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : activeTab === 'nfe' ? (
          <NFEPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : activeTab === 'nfs' ? (
          <NFSPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : activeTab === 'items' ? (
          <NFEDetailsPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : activeTab === 'receipts' ? (
          <ReceiptsPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : activeTab === 'contracts' ? (
          <GenericFinancialPage
            title="Contratos"
            paymentTypes={['CTR', 'FAT', 'NLOC', 'NCS', 'CTE']}
            includeKeywords={['Contrato', 'Locação', 'Aluguel']}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : activeTab === 'payroll' ? (
          <GenericFinancialPage
            title="Folha de Pagamento"
            paymentTypes={['SAL', '13S', 'FER', 'FPGT', 'ADI', 'GNRE', 'DAM', 'DAJE']}
            includeKeywords={['Salário', 'Adiantamento', 'Folha', 'Encargos', 'FGTS', 'INSS', 'GRRF']}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        ) : (
          <GenericFinancialPage
            title="Geral"
            fetchAllTypes={true}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projects={projects}
          />
        )}
      </div>
    </main>
  )
}
