"use client"

import { useState, useEffect } from 'react'
import Dashboard from '@/components/Dashboard'
import ItemsPage from '@/components/ItemsPage'
import ServicesPage from '@/components/ServicesPage'
import SalariesPage from '@/components/SalariesPage'
import Login from '@/components/Login'
import { LayoutDashboard, ReceiptText, ChevronLeft, ChevronRight, Briefcase, Banknote, LogOut } from 'lucide-react'
import Image from 'next/image'

import { format, subDays } from 'date-fns'

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'services' | 'salaries'>('dashboard')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Shared Filter State (must be declared before any conditional returns)
  const [timeRange, setTimeRange] = useState('30')
  const [customDates, setCustomDates] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => {
    checkAuth()
  }, [])

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
            onClick={() => setActiveTab('items')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'items'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Custos Diretos"
          >
            <ReceiptText className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Custos Diretos</span>}
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'services'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Custos de Serviços"
          >
            <Briefcase className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Serviços</span>}
          </button>

          <button
            onClick={() => setActiveTab('salaries')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeTab === 'salaries'
              ? 'bg-primary-app text-white shadow-lg shadow-primary-app/20'
              : 'hover:bg-white/5 text-muted-foreground hover:text-white'
              }`}
            title="Pagamentos e Salários"
          >
            <Banknote className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium hidden md:block">Pagamentos</span>}
          </button>
        </nav>

        <div className="pt-4 border-t border-border-app mt-auto space-y-2">
          <div className={`flex items-center gap-3 px-2 py-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
              QP
            </div>
            {!isSidebarCollapsed && (
              <div className="hidden md:block">
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-muted-foreground">Queiroz Pimentel</p>
              </div>
            )}
          </div>
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
          />
        ) : activeTab === 'items' ? (
          <ItemsPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
          />
        ) : activeTab === 'services' ? (
          <ServicesPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
          />
        ) : (
          <SalariesPage
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            customDates={customDates}
            setCustomDates={setCustomDates}
          />
        )}
      </div>
    </main>
  )
}
