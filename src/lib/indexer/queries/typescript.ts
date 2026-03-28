import type { SymbolType } from '../ast-analyzer'

export const TS_SYMBOL_NODE_TYPES: Record<string, SymbolType> = {
  function_declaration: 'function',
  class_declaration: 'class',
  method_definition: 'method',
  interface_declaration: 'interface',
  type_alias_declaration: 'type_alias',
  module: 'module',
}

export const TS_ARROW_FUNCTION_PARENTS = new Set(['lexical_declaration', 'variable_declaration'])

export const TS_SCOPE_NODE_TYPES = new Set(['class_declaration', 'module'])

export function getTsSymbolName(node: {
  type: string
  children: Array<{ type: string; text: string; children?: Array<{ type: string; text: string; children?: Array<{ type: string; text: string }> }> }>
}): string | null {
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const declarator = node.children.find((c) => c.type === 'variable_declarator')
    if (!declarator) return null
    const nameNode = declarator.children?.find((c) => c.type === 'identifier')
    return nameNode?.text ?? null
  }

  const nameNode = node.children.find(
    (c) => c.type === 'identifier' || c.type === 'type_identifier' || c.type === 'property_identifier',
  )
  return nameNode?.text ?? null
}

export function isArrowFunctionAssignment(node: {
  type: string
  children: Array<{ type: string; children?: Array<{ type: string }> }>
}): boolean {
  if (!TS_ARROW_FUNCTION_PARENTS.has(node.type)) return false
  const declarator = node.children.find((c) => c.type === 'variable_declarator')
  if (!declarator?.children) return false
  return declarator.children.some((c) => c.type === 'arrow_function')
}
