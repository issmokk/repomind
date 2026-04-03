'use client'

import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

export type GraphFiltersPanelProps = {
  showCrossRepo: boolean
  onShowCrossRepoChange: (show: boolean) => void
  confidenceThreshold: number
  onConfidenceThresholdChange: (threshold: number) => void
  hasCrossRepoData: boolean
}

export function GraphFiltersPanel({
  showCrossRepo,
  onShowCrossRepoChange,
  confidenceThreshold,
  onConfidenceThresholdChange,
  hasCrossRepoData,
}: GraphFiltersPanelProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Cross-Repo</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={showCrossRepo}
            onCheckedChange={(checked) => onShowCrossRepoChange(checked === true)}
            disabled={!hasCrossRepoData}
            data-testid="cross-repo-toggle"
            aria-disabled={!hasCrossRepoData}
          />
          <span className="text-xs">Show cross-repo edges</span>
        </label>
        {!hasCrossRepoData && (
          <p className="text-[10px] text-muted-foreground mt-1 ml-6">
            Run cross-repo analysis to see connections
          </p>
        )}
      </div>

      {showCrossRepo && hasCrossRepoData && (
        <div>
          <Label className="text-xs font-medium text-muted-foreground">
            Min confidence: {Math.round(confidenceThreshold * 100)}%
          </Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={confidenceThreshold}
            onChange={(e) => onConfidenceThresholdChange(parseFloat(e.target.value))}
            className="w-full mt-1 accent-primary"
            data-testid="confidence-slider"
          />
        </div>
      )}
    </div>
  )
}
