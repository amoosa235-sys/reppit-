export const UNLOCK_COST_BY_TIER: Record<string, number> = {
  entry: 1,
  verified: 2,
  premium: 3,
};

export function unlockCostForTier(tier: string): number {
  return UNLOCK_COST_BY_TIER[tier] ?? 1;
}
