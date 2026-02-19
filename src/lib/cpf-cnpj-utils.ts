/**
 * Utilitários para normalização e formatação de CPF/CNPJ
 */

/**
 * Normaliza um CPF ou CNPJ removendo todos os caracteres não numéricos.
 * Exemplos:
 * - "13.292.293/0001-70" -> "13292293000170"
 * - "123.456.789-00" -> "12345678900"
 * - "13292293000170" -> "13292293000170" (já normalizado)
 */
export function normalizeCpfCnpj(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

/**
 * Formata um CPF normalizado (11 dígitos) para exibição.
 * "12345678900" -> "123.456.789-00"
 */
export function formatCpf(cpf: string): string {
  const normalized = normalizeCpfCnpj(cpf)
  if (normalized.length !== 11) return cpf
  return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Formata um CNPJ normalizado (14 dígitos) para exibição.
 * "13292293000170" -> "13.292.293/0001-70"
 */
export function formatCnpj(cnpj: string): string {
  const normalized = normalizeCpfCnpj(cnpj)
  if (normalized.length !== 14) return cnpj
  return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

/**
 * Formata CPF ou CNPJ baseado no tamanho.
 * - 11 dígitos -> formato CPF
 * - 14 dígitos -> formato CNPJ
 * - Outro -> retorna valor original ou '-'
 */
export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return '-'
  const normalized = normalizeCpfCnpj(value)
  if (normalized.length === 11) return formatCpf(normalized)
  if (normalized.length === 14) return formatCnpj(normalized)
  return value
}
