import { rubySymbolQuery, rubyImportQuery, rubyInheritanceQuery, rubyCallQuery } from './ruby'
import { tsSymbolQuery, tsImportQuery, tsInheritanceQuery, tsCallQuery } from './typescript'

type QueryType = 'symbol' | 'import' | 'inheritance' | 'call'

const QUERY_MAP: Record<string, Record<QueryType, string>> = {
  ruby: {
    symbol: rubySymbolQuery,
    import: rubyImportQuery,
    inheritance: rubyInheritanceQuery,
    call: rubyCallQuery,
  },
  typescript: {
    symbol: tsSymbolQuery,
    import: tsImportQuery,
    inheritance: tsInheritanceQuery,
    call: tsCallQuery,
  },
  javascript: {
    symbol: tsSymbolQuery,
    import: tsImportQuery,
    inheritance: tsInheritanceQuery,
    call: tsCallQuery,
  },
}

export function getSymbolQuery(language: string): string | null {
  return QUERY_MAP[language]?.symbol ?? null
}

export function getImportQuery(language: string): string | null {
  return QUERY_MAP[language]?.import ?? null
}

export function getInheritanceQuery(language: string): string | null {
  return QUERY_MAP[language]?.inheritance ?? null
}

export function getCallQuery(language: string): string | null {
  return QUERY_MAP[language]?.call ?? null
}
