/**
 * Generator: creates unique trait combinations respecting rarity weights.
 */

/**
 * Select a random trait from a layer based on rarity weights.
 * If optional, there's a chance of selecting "none".
 */
function selectTraitRandom(traits, allowOptionalSkip = true) {
  const optionalTraits = traits.filter(t => t.optional);
  const requiredTraits = traits.filter(t => !t.optional);

  // If all traits are optional and we allow skipping, maybe skip this layer
  if (optionalTraits.length === traits.length && allowOptionalSkip && Math.random() < 0.3) {
    return null;
  }

  // Filter out optional traits that might be skipped
  const candidates = traits.filter(t => {
    if (t.optional && Math.random() < 0.2) return false;
    return true;
  });

  if (candidates.length === 0) {
    if (requiredTraits.length > 0) {
      return selectByWeight(requiredTraits);
    }
    return null;
  }

  return selectByWeight(candidates.length > 0 ? candidates : traits);
}

/**
 * Select a trait based on rarity weights
 */
function selectByWeight(traits) {
  const totalWeight = traits.reduce((sum, t) => sum + (t.rarity_weight || 1), 0);
  let random = Math.random() * totalWeight;
  
  for (const trait of traits) {
    random -= (trait.rarity_weight || 1);
    if (random <= 0) return trait;
  }
  
  return traits[traits.length - 1];
}

/**
 * Generate a unique combination key from selected traits
 */
function combinationKey(selected) {
  return selected
    .filter(Boolean)
    .map(t => t.id)
    .sort((a, b) => a - b)
    .join('|');
}

/**
 * Generate N unique combinations
 * @param {Array} layers - [{id, name, traits: [{id, name, filename, rarity_weight, ...}]}]
 * @param {number} supply - number of NFTs to generate
 * @param {Function} onProgress - callback(current, total)
 * @returns {Array} [{tokenId, traits: [{layer_id, layer_name, ...trait}]}]
 */
function generateCombinations(layers, supply, onProgress = null) {
  const enabledLayers = layers.filter(l => l.enabled !== 0);
  
  if (enabledLayers.length === 0) {
    throw new Error('No enabled layers with traits');
  }

  // Check if we have enough unique combinations
  const maxPossible = enabledLayers.reduce((product, layer) => {
    const count = layer.traits.length;
    return product * Math.max(count, 1);
  }, 1);

  if (supply > maxPossible) {
    throw new Error(`Supply (${supply}) exceeds maximum unique combinations (${maxPossible}). Reduce supply or add more traits.`);
  }

  const seen = new Set();
  const results = [];
  let attempts = 0;
  const maxAttempts = supply * 100; // Prevent infinite loop

  while (results.length < supply && attempts < maxAttempts) {
    attempts++;
    
    const selected = enabledLayers.map(layer => {
      const trait = selectTraitRandom(layer.traits);
      return trait ? { ...trait, layer_id: layer.id, layer_name: layer.name } : null;
    });

    const key = combinationKey(selected);
    
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        tokenId: results.length + 1,
        traits: selected.filter(Boolean),
      });
      
      if (onProgress) {
        onProgress(results.length, supply);
      }
    }
  }

  if (results.length < supply) {
    throw new Error(`Could only generate ${results.length} unique combinations out of ${supply} requested. Max possible: ${maxPossible}`);
  }

  return results;
}

/**
 * Calculate rarity ranks for generated combinations
 * @param {Array} combinations - [{tokenId, traits}]
 * @returns {Object} {tokenId: rank} where 1 = rarest
 */
function calculateRarity(combinations) {
  // Calculate rarity score for each combination
  const scores = combinations.map(combo => {
    let score = 0;
    for (const trait of combo.traits) {
      // Higher rarity weight = more common = lower score contribution
      // Score = sum of (1 / rarity_weight) for each trait
      score += 1 / (trait.rarity_weight || 1);
    }
    return { tokenId: combo.tokenId, score };
  });

  // Sort by score (lower score = rarer)
  scores.sort((a, b) => a.score - b.score);

  // Assign ranks
  const ranks = {};
  scores.forEach((item, index) => {
    ranks[item.tokenId] = index + 1;
  });

  return ranks;
}

module.exports = {
  generateCombinations,
  calculateRarity,
};
