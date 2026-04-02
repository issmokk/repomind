import { describe, it, expect } from 'vitest'
import { getCrossRepoEdgeStyle, getCrossRepoNodeLabel, isCrossRepoEdge } from './cross-repo-edges'

describe('cross-repo-edges', () => {
  it('cross-repo edges render with dashed line style', () => {
    const style = getCrossRepoEdgeStyle('gem_dependency')
    expect(style.lineStyle).toBe('dashed')
  })

  it('edge colors match relationship type (orange=gem, green=npm, purple=event)', () => {
    expect(getCrossRepoEdgeStyle('gem_dependency').color).toBe('#f97316')
    expect(getCrossRepoEdgeStyle('npm_dependency').color).toBe('#22c55e')
    expect(getCrossRepoEdgeStyle('event_publish').color).toBe('#a855f7')
    expect(getCrossRepoEdgeStyle('event_subscribe').color).toBe('#a855f7')
  })

  it('cross-repo node labels include repo prefix', () => {
    const label = getCrossRepoNodeLabel('ProcessPaymentAction', 'wt_payment')
    expect(label).toBe('wt_payment:ProcessPaymentAction')
  })

  it('isCrossRepoEdge returns true when targetRepoId differs from repoId', () => {
    expect(isCrossRepoEdge({ repoId: 'a', targetRepoId: 'b' })).toBe(true)
    expect(isCrossRepoEdge({ repoId: 'a', targetRepoId: null })).toBe(false)
    expect(isCrossRepoEdge({ repoId: 'a', targetRepoId: 'a' })).toBe(false)
  })

  it('returns default style for unknown relationship types', () => {
    const style = getCrossRepoEdgeStyle('unknown_type')
    expect(style.lineStyle).toBe('dashed')
    expect(style.color).toBe('#94a3b8')
  })
})
