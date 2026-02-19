"use client"

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { normalizeCpfCnpj } from '@/lib/cpf-cnpj-utils'
import type { Client, ClientMaps } from '@/types'

interface UseClientsReturn {
  clients: Client[]
  clientMaps: ClientMaps
  loading: boolean
  error: Error | null
  getClientName: (codigoOmie?: number | null, cpfCnpj?: string | null) => string
  getClient: (codigoOmie?: number | null, cpfCnpj?: string | null) => Client | undefined
}

export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([])
  const [clientMaps, setClientMaps] = useState<ClientMaps>({
    byCodigoOmie: new Map(),
    byNormalizedCpfCnpj: new Map()
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true)

        const query = supabase
          .from('clients')
          .select('codigo_cliente_omie, cnpj_cpf, razao_social, nome_fantasia, pessoa_fisica, inativo, tags')

        const data = await fetchAll<Client>(query)

        // Build lookup maps
        const byCodigoOmie = new Map<number, Client>()
        const byNormalizedCpfCnpj = new Map<string, Client>()

        data.forEach(client => {
          // Map by codigo_cliente_omie (primary lookup)
          if (client.codigo_cliente_omie) {
            byCodigoOmie.set(client.codigo_cliente_omie, client)
          }

          // Map by normalized CPF/CNPJ (fallback lookup)
          const normalizedCpfCnpj = normalizeCpfCnpj(client.cnpj_cpf)
          if (normalizedCpfCnpj) {
            byNormalizedCpfCnpj.set(normalizedCpfCnpj, client)
          }
        })

        setClients(data)
        setClientMaps({ byCodigoOmie, byNormalizedCpfCnpj })
      } catch (err) {
        console.error('Error fetching clients:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchClients()
  }, [])

  /**
   * Get client name with fallback strategy:
   * 1. Try lookup by codigo_cliente_omie
   * 2. Try lookup by normalized CPF/CNPJ
   * 3. Return 'N/A'
   */
  const getClientName = useCallback((
    codigoOmie?: number | null,
    cpfCnpj?: string | null
  ): string => {
    // Try by codigo_omie first (most reliable)
    if (codigoOmie && clientMaps.byCodigoOmie.has(codigoOmie)) {
      const client = clientMaps.byCodigoOmie.get(codigoOmie)!
      return client.nome_fantasia || client.razao_social || 'Cliente sem nome'
    }

    // Fallback to CPF/CNPJ lookup
    if (cpfCnpj) {
      const normalized = normalizeCpfCnpj(cpfCnpj)
      if (clientMaps.byNormalizedCpfCnpj.has(normalized)) {
        const client = clientMaps.byNormalizedCpfCnpj.get(normalized)!
        return client.nome_fantasia || client.razao_social || 'Cliente sem nome'
      }
    }

    return 'N/A'
  }, [clientMaps])

  const getClient = useCallback((
    codigoOmie?: number | null,
    cpfCnpj?: string | null
  ): Client | undefined => {
    if (codigoOmie && clientMaps.byCodigoOmie.has(codigoOmie)) {
      return clientMaps.byCodigoOmie.get(codigoOmie)
    }

    if (cpfCnpj) {
      const normalized = normalizeCpfCnpj(cpfCnpj)
      return clientMaps.byNormalizedCpfCnpj.get(normalized)
    }

    return undefined
  }, [clientMaps])

  return {
    clients,
    clientMaps,
    loading,
    error,
    getClientName,
    getClient
  }
}
