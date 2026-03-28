import type { SymbolType } from '../ast-analyzer'

export interface LanguageConfig {
  symbolNodeTypes: Record<string, SymbolType>
  scopeNodeTypes: Set<string>
  getSymbolName: (node: unknown) => string | null
  isArrowFunction?: (node: unknown) => boolean
}

import { RUBY_SYMBOL_NODE_TYPES, RUBY_SCOPE_NODE_TYPES, getRubySymbolName } from './ruby'
import { TS_SYMBOL_NODE_TYPES, TS_SCOPE_NODE_TYPES, getTsSymbolName, isArrowFunctionAssignment } from './typescript'

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  ruby: {
    symbolNodeTypes: RUBY_SYMBOL_NODE_TYPES,
    scopeNodeTypes: RUBY_SCOPE_NODE_TYPES,
    getSymbolName: getRubySymbolName as (node: unknown) => string | null,
  },
  typescript: {
    symbolNodeTypes: TS_SYMBOL_NODE_TYPES,
    scopeNodeTypes: TS_SCOPE_NODE_TYPES,
    getSymbolName: getTsSymbolName as (node: unknown) => string | null,
    isArrowFunction: isArrowFunctionAssignment as (node: unknown) => boolean,
  },
  javascript: {
    symbolNodeTypes: TS_SYMBOL_NODE_TYPES,
    scopeNodeTypes: TS_SCOPE_NODE_TYPES,
    getSymbolName: getTsSymbolName as (node: unknown) => string | null,
    isArrowFunction: isArrowFunctionAssignment as (node: unknown) => boolean,
  },
}

export function getLanguageConfig(language: string): LanguageConfig | null {
  return LANGUAGE_CONFIGS[language] ?? null
}
