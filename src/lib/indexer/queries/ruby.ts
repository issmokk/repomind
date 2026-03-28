import type { SymbolType } from '../ast-analyzer'

export const RUBY_SYMBOL_NODE_TYPES: Record<string, SymbolType> = {
  class: 'class',
  module: 'module',
  method: 'method',
  singleton_method: 'method',
}

export const RUBY_SCOPE_NODE_TYPES = new Set(['class', 'module'])

export function getRubySymbolName(node: { type: string; children: Array<{ type: string; text: string }> }): string | null {
  if (node.type === 'singleton_method') {
    const nameNode = node.children.find((c) => c.type === 'identifier')
    return nameNode ? `self.${nameNode.text}` : null
  }
  const nameNode = node.children.find(
    (c) => c.type === 'constant' || c.type === 'identifier' || c.type === 'scope_resolution',
  )
  return nameNode?.text ?? null
}
