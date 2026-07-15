/**
 * Rarity / weighted random utilities
 */

/**
 * Weighted random pick — higher weight = more chance
 * @param {Array} traits - array of { id, name, rarity_weight, ... }
 * @returns picked trait
 */
function weightedRandomPick(traits) {
  const validTraits = traits.filter(t => Number(t.rarity_weight || 1) > 0);
  if (validTraits.length === 0) return traits[0] || null;

  const totalWeight = validTraits.reduce((sum, t) => sum + Number(t.rarity_weight || 1), 0);
  let random = Math.random() * totalWeight;

  for (const trait of validTraits) {
    random -= Number(trait.rarity_weight || 1);
    if (random <= 0) return trait;
  }
  return validTraits[validTraits.length - 1];
}

/**
 * Calculate estimated trait counts for a layer given a supply
 */
function getEstimatedTraitCounts(traits, supply) {
  const totalWeight = traits.reduce((sum, t) => sum + Number(t.rarity_weight || 1), 0);
  if (totalWeight === 0) return [];

  return traits.map(trait => {
    const weight = Number(trait.rarity_weight || 1);
    const chance = weight / totalWeight;
    const estimatedCount = Math.round(chance * supply);
    return {
      id: trait.id,
      name: trait.name || trait.display_name,
      weight,
      chancePercent: Number((chance * 100).toFixed(2)),
      estimatedCount,
    };
  });
}

/**
 * Rarity tier labels and default weights
 */
const RARITY_TIERS = {
  Common:    { weight: 50, color: '#9ca3af' },
  Uncommon:  { weight: 25, color: '#22c55e' },
  Rare:      { weight: 10, color: '#3b82f6' },
  Epic:      { weight: 5,  color: '#a855f7' },
  Legendary: { weight: 1,  color: '#f59e0b' },
  Mythic:    { weight: 0.5, color: '#ef4444' },
};

/**
 * Get rarity tier from weight
 */
function getRarityTier(weight) {
  for (const [tier, info] of Object.entries(RARITY_TIERS)) {
    if (Math.abs(weight - info.weight) < 0.01) return tier;
  }
  if (weight >= 50) return 'Common';
  if (weight >= 25) return 'Uncommon';
  if (weight >= 10) return 'Rare';
  if (weight >= 5) return 'Epic';
  if (weight >= 1) return 'Legendary';
  return 'Mythic';
}

/**
 * Get tier color for UI
 */
function getRarityColor(weight) {
  const tier = getRarityTier(weight);
  return RARITY_TIERS[tier]?.color || '#9ca3af';
}

module.exports = {
  weightedRandomPick,
  getEstimatedTraitCounts,
  RARITY_TIERS,
  getRarityTier,
  getRarityColor,
};
