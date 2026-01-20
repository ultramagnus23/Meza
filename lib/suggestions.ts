export function generateSuggestions({
  avgOrderValue,
  topProfitItem,
}: {
  avgOrderValue: number
  topProfitItem?: string
}) {
  const suggestions: string[] = []

  if (avgOrderValue < 300) {
    suggestions.push(
      "Average order value is low. Consider bundles or add-ons."
    )
  }

  if (topProfitItem) {
    suggestions.push(
      `Promote "${topProfitItem}" more aggressively — it has the highest profit.`
    )
  }

  return suggestions
}
