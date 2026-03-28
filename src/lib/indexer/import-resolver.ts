import path from 'path'

export interface ResolvedImport {
  originalSource: string
  resolvedPath: string | null
  isExternal: boolean
  packageName: string | null
}

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const TS_INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx']

export function resolveImport(
  source: string,
  currentFilePath: string,
  repoFilePaths: string[],
  language: string,
  fileSet?: Set<string>,
): ResolvedImport {
  const files = fileSet ?? new Set(repoFilePaths)

  if (language === 'typescript' || language === 'javascript') {
    if (source.startsWith('.')) {
      const dir = path.dirname(currentFilePath)
      const resolved = path.normalize(path.join(dir, source)).replace(/\\/g, '/')

      if (files.has(resolved)) return { originalSource: source, resolvedPath: resolved, isExternal: false, packageName: null }
      for (const ext of TS_EXTENSIONS) {
        const candidate = resolved + ext
        if (files.has(candidate)) return { originalSource: source, resolvedPath: candidate, isExternal: false, packageName: null }
      }
      for (const indexFile of TS_INDEX_FILES) {
        const candidate = resolved + '/' + indexFile
        if (files.has(candidate)) return { originalSource: source, resolvedPath: candidate, isExternal: false, packageName: null }
      }
      return { originalSource: source, resolvedPath: null, isExternal: false, packageName: null }
    }

    const packageName = source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0]
    return { originalSource: source, resolvedPath: null, isExternal: true, packageName }
  }

  if (language === 'ruby') {
    if (source.startsWith('./') || source.startsWith('../')) {
      const dir = path.dirname(currentFilePath)
      const resolved = path.normalize(path.join(dir, source)).replace(/\\/g, '/')
      const withRb = resolved.endsWith('.rb') ? resolved : resolved + '.rb'
      if (files.has(withRb)) return { originalSource: source, resolvedPath: withRb, isExternal: false, packageName: null }
      return { originalSource: source, resolvedPath: null, isExternal: false, packageName: null }
    }

    const prefixes = ['lib/', 'app/', '']
    for (const prefix of prefixes) {
      const candidate = prefix + source + '.rb'
      if (files.has(candidate)) return { originalSource: source, resolvedPath: candidate, isExternal: false, packageName: null }
    }

    return { originalSource: source, resolvedPath: null, isExternal: true, packageName: source }
  }

  return { originalSource: source, resolvedPath: null, isExternal: true, packageName: source }
}
