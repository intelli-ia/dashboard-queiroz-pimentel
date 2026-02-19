"use client"

import { createContext, useContext, ReactNode } from 'react'
import { useClients } from '@/lib/useClients'
import type { Client, ClientMaps } from '@/types'

interface ClientContextValue {
  clients: Client[]
  clientMaps: ClientMaps
  loading: boolean
  getClientName: (codigoOmie?: number | null, cpfCnpj?: string | null) => string
  getClient: (codigoOmie?: number | null, cpfCnpj?: string | null) => Client | undefined
}

const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const clientsData = useClients()

  return (
    <ClientContext.Provider value={clientsData}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClientContext() {
  const context = useContext(ClientContext)
  if (!context) {
    throw new Error('useClientContext must be used within a ClientProvider')
  }
  return context
}
