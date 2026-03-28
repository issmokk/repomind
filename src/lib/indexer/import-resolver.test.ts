// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveImport } from './import-resolver'

describe('resolveImport', () => {
  const repoFiles = [
    'src/services/utils.ts',
    'src/components/index.ts',
    'src/utils/format.ts',
    'lib/services/payment.rb',
    'lib/models/user.rb',
  ]

  it('resolves relative TypeScript import to file path', () => {
    const result = resolveImport('./utils', 'src/services/payment.ts', repoFiles, 'typescript')
    expect(result.resolvedPath).toBe('src/services/utils.ts')
    expect(result.isExternal).toBe(false)
  })

  it('resolves relative import with index file', () => {
    const result = resolveImport('./components', 'src/app.ts', repoFiles, 'typescript')
    expect(result.resolvedPath).toBe('src/components/index.ts')
  })

  it('resolves Ruby require_relative with .rb extension', () => {
    const result = resolveImport('../models/user', 'lib/services/payment.rb', repoFiles, 'ruby')
    expect(result.resolvedPath).toBe('lib/models/user.rb')
  })

  it('identifies npm package as external', () => {
    const result = resolveImport('lodash', 'src/app.ts', repoFiles, 'typescript')
    expect(result.isExternal).toBe(true)
    expect(result.packageName).toBe('lodash')
    expect(result.resolvedPath).toBeNull()
  })

  it('identifies scoped npm package as external', () => {
    const result = resolveImport('@wetravel-mfe/common', 'src/app.ts', repoFiles, 'typescript')
    expect(result.isExternal).toBe(true)
    expect(result.packageName).toBe('@wetravel-mfe/common')
  })

  it('resolves Ruby require with lib/ prefix', () => {
    const result = resolveImport('services/payment', 'app.rb', repoFiles, 'ruby')
    expect(result.resolvedPath).toBe('lib/services/payment.rb')
  })
})
