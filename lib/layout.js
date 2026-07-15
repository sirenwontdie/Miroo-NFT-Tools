const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data-path');

/**
 * Layout system: fixed positions per layer
 * Each layer has: z_index, x, y, scale, opacity, anchor, lock_position, lock_trait
 * Layout is stored in trait_layout.json per collection
 */

function getLayoutPath(collectionName) {
  const dir = path.join(getDataDir(), 'collections', collectionName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'trait_layout.json');
}

function getLayout(collectionName) {
  const layoutPath = getLayoutPath(collectionName);
  if (!fs.existsSync(layoutPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
  } catch { return {}; }
}

function saveLayout(collectionName, layout) {
  const layoutPath = getLayoutPath(collectionName);
  fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2));
}

/**
 * Initialize layout from existing layer/trait data
 * Called once when layout doesn't exist yet
 * Uses first trait's position as layer master position
 */
function initLayoutFromLayers(collectionName, layers) {
  const existing = getLayout(collectionName);
  const layout = { ...existing };
  
  for (const layer of layers) {
    if (layout[layer.name]) continue; // don't overwrite existing
    
    // Use first trait's position as default
    const firstTrait = layer.traits && layer.traits.length > 0 ? layer.traits[0] : null;
    
    layout[layer.name] = {
      z_index: layer.sort_order ?? 0,
      x: firstTrait ? (firstTrait.x || 0) : 0,
      y: firstTrait ? (firstTrait.y || 0) : 0,
      scale: firstTrait ? (firstTrait.scale || 1) : 1,
      opacity: firstTrait ? (firstTrait.opacity ?? 1) : 1,
      anchor: 'topleft',
      lock_position: true,
      lock_trait: false,
    };
  }
  
  saveLayout(collectionName, layout);
  return layout;
}

/**
 * Get layer position from layout (with fallback to first trait)
 */
function getLayerPosition(layout, layerName, layer) {
  if (layout[layerName]) {
    const l = layout[layerName];
    return { x: l.x || 0, y: l.y || 0, scale: l.scale || 1, opacity: l.opacity ?? 1 };
  }
  // Fallback: first trait position
  const firstTrait = layer.traits && layer.traits.length > 0 ? layer.traits[0] : null;
  return {
    x: firstTrait ? (firstTrait.x || 0) : 0,
    y: firstTrait ? (firstTrait.y || 0) : 0,
    scale: firstTrait ? (firstTrait.scale || 1) : 1,
    opacity: firstTrait ? (firstTrait.opacity ?? 1) : 1,
  };
}

/**
 * Update a layer's position in layout
 */
function updateLayerPosition(collectionName, layerName, position) {
  const layout = getLayout(collectionName);
  if (!layout[layerName]) {
    layout[layerName] = { z_index: 0, anchor: 'topleft', lock_position: true, lock_trait: false };
  }
  Object.assign(layout[layerName], position);
  saveLayout(collectionName, layout);
  return layout[layerName];
}

/**
 * Update lock status for a layer
 */
function updateLayerLock(collectionName, layerName, lockType, value) {
  const layout = getLayout(collectionName);
  if (!layout[layerName]) {
    layout[layerName] = { z_index: 0, x: 0, y: 0, scale: 1, opacity: 1, anchor: 'topleft', lock_position: true, lock_trait: false };
  }
  layout[layerName][lockType] = value;
  saveLayout(collectionName, layout);
  return layout[layerName];
}

module.exports = {
  getLayoutPath,
  getLayout,
  saveLayout,
  initLayoutFromLayers,
  getLayerPosition,
  updateLayerPosition,
  updateLayerLock,
};
