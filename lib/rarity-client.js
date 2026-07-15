/**
 * Client-side rarity utilities (no server imports)
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

function getEstimatedTraitCounts(traits, supply) {
  const totalWeight = traits.reduce((sum, t) => sum + Number(t.rarity_weight || 1), 0);
  if (totalWeight === 0) return [];
  return traits.map(trait => {
    const weight = Number(trait.rarity_weight || 1);
    const chance = weight / totalWeight;
    return {
      id: trait.id,
      name: trait.display_name || trait.name,
      weight,
      chancePercent: Number((chance * 100).toFixed(2)),
      estimatedCount: Math.round(chance * supply),
    };
  });
}

const RARITY_TIERS = {
  Common:    { weight: 50, color: '#9ca3af' },
  Uncommon:  { weight: 25, color: '#22c55e' },
  Rare:      { weight: 10, color: '#3b82f6' },
  Epic:      { weight: 5,  color: '#a855f7' },
  Legendary: { weight: 1,  color: '#f59e0b' },
  Mythic:    { weight: 0.5, color: '#ef4444' },
};

function getRarityTier(weight) {
  if (weight >= 50) return 'Common';
  if (weight >= 25) return 'Uncommon';
  if (weight >= 10) return 'Rare';
  if (weight >= 5) return 'Epic';
  if (weight >= 1) return 'Legendary';
  return 'Mythic';
}

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
