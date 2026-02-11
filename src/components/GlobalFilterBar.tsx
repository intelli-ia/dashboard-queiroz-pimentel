"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, RefreshCcw } from 'lucide-react'
import type { ProjectOption } from '@/types'

interface GlobalFilterBarProps {
  timeRange: string
  setTimeRange: (range: string) => void
  customDates: { start: string; end: string }
  setCustomDates: (dates: { start: string; end: string }) => void
  selectedProject: string
  setSelectedProject: (projectId: string) => void
  projects: ProjectOption[]
  title?: string
  subtitle?: string
  showProjectFilter?: boolean
  loading?: boolean
}

export default function GlobalFilterBar({
  timeRange,
  setTimeRange,
  customDates,
  setCustomDates,
  selectedProject,
  setSelectedProject,
  projects,
  title,
  subtitle,
  showProjectFilter = true,
  loading = false
}: GlobalFilterBarProps) {
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || 'Geral (Todas Obras)'

  return (
    <div className="sticky top-0 z-40 bg-background-app/80 backdrop-blur-xl border-b border-border-app">
      <div className="px-4 md:px-8 py-4 space-y-4">
        {/* Title Row */}
        {(title || subtitle) && (
          <div className="flex items-center gap-4">
            <div>
              {title && <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {loading && (
              <RefreshCcw className="w-5 h-5 animate-spin text-primary-app/50" />
            )}
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left side: Project Filter */}
          {showProjectFilter && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex items-center justify-between bg-card-app border border-border-app rounded-lg px-3 py-2 text-[13px] text-muted-foreground w-full md:w-[220px] transition-all hover:border-primary-app/50"
              >
                <span className="truncate pr-2 text-foreground-app">
                  {selectedProjectName}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProjectDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      setSelectedProject('')
                      setIsProjectDropdownOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 ${!selectedProject ? 'bg-primary-app/10 text-primary-app' : 'text-muted-foreground'}`}
                  >
                    Geral (Todas Obras)
                  </button>
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        setSelectedProject(project.id)
                        setIsProjectDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 last:border-0 ${selectedProject === project.id ? 'bg-primary-app/10 text-primary-app' : 'text-muted-foreground'}`}
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right side: Date Range Filters */}
          <div className="flex items-center gap-3">
            <div className="flex bg-card-app p-1 rounded-lg border border-border-app overflow-x-auto scrollbar-hide">
              {['7', '30', '90'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`min-w-[45px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === range
                      ? 'bg-primary-app text-white shadow-lg'
                      : 'text-muted-foreground hover:text-white'
                    }`}
                >
                  {range}D
                </button>
              ))}
              <button
                onClick={() => setTimeRange('thisYear')}
                className={`min-w-[85px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'thisYear'
                    ? 'bg-primary-app text-white shadow-lg'
                    : 'text-muted-foreground hover:text-white'
                  }`}
              >
                Este ano
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`min-w-[75px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'all'
                    ? 'bg-primary-app text-white shadow-lg'
                    : 'text-muted-foreground hover:text-white'
                  }`}
              >
                Todas
              </button>
              <button
                onClick={() => setTimeRange('custom')}
                className={`min-w-[80px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'custom'
                    ? 'bg-primary-app text-white shadow-lg'
                    : 'text-muted-foreground hover:text-white'
                  }`}
              >
                Período
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Picker (conditional) */}
        {timeRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-4 pt-2 animate-in slide-in-from-top-2 duration-300">
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
    </div>
  )
}
