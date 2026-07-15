const fs = require('fs');
const path = require('path');

/**
 * Validate generated metadata for OpenSea compatibility
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateMetadata(collectionName) {
  const errors = [];
  const warnings = [];
  const generatedDir = path.join(process.cwd(), 'data', 'collections', collectionName, 'generated');
  const metadataDir = path.join(generatedDir, 'metadata');
  const imagesDir = path.join(generatedDir, 'images');

  // Check directories exist
  if (!fs.existsSync(metadataDir)) {
    errors.push('metadata/ directory does not exist');
    return { valid: false, errors, warnings };
  }
  if (!fs.existsSync(imagesDir)) {
    errors.push('images/ directory does not exist');
    return { valid: false, errors, warnings };
  }

  // Load all metadata JSON files
  const metadataFiles = fs.readdirSync(metadataDir).filter(f => f.endsWith('.json'));
  const tokenIds = new Set();
  const tokenData = [];

  for (const file of metadataFiles) {
    const tokenId = file.replace('.json', '');
    tokenIds.add(tokenId);

    try {
      const content = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf-8'));
      tokenData.push({ tokenId, data: content });

      // Check required fields
      if (!content.name) errors.push(`Token ${tokenId}: missing name`);
      if (!content.description && content.description !== '') warnings.push(`Token ${tokenId}: missing description`);
      if (!content.image) errors.push(`Token ${tokenId}: missing image`);
      else if (content.image.startsWith('/') || content.image.startsWith('./')) {
        errors.push(`Token ${tokenId}: image uses relative path "${content.image}"`);
      }

      // Check attributes
      if (content.attributes && Array.isArray(content.attributes)) {
        const traitTypes = new Set();
        for (const attr of content.attributes) {
          if (!attr.trait_type) errors.push(`Token ${tokenId}: attribute missing trait_type`);
          if (attr.trait_type === 'Rarity') errors.push(`Token ${tokenId}: contains prohibited trait_type "Rarity"`);
          if (attr.trait_type === 'Rank') errors.push(`Token ${tokenId}: contains prohibited trait_type "Rank"`);
          if (attr.trait_type === 'Score') errors.push(`Token ${tokenId}: contains prohibited trait_type "Score"`);
          
          if (attr.trait_type && traitTypes.has(attr.trait_type)) {
            errors.push(`Token ${tokenId}: duplicate trait_type "${attr.trait_type}"`);
          }
          traitTypes.add(attr.trait_type);
        }
      }
    } catch (e) {
      errors.push(`Token ${tokenId}: invalid JSON - ${e.message}`);
    }
  }

  // Check for duplicate token IDs in filenames
  if (tokenIds.size !== metadataFiles.length) {
    errors.push('Duplicate token ID files found in metadata/');
  }

  // Check images exist
  const imageFiles = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));
  const imageIds = new Set(imageFiles.map(f => f.replace('.png', '')));

  for (const tokenId of tokenIds) {
    if (!imageIds.has(tokenId)) {
      errors.push(`Token ${tokenId}: missing image file ${tokenId}.png`);
    }
  }

  for (const imageId of imageIds) {
    if (!tokenIds.has(imageId)) {
      warnings.push(`Image ${imageId}.png has no corresponding metadata JSON`);
    }
  }

  // Check collection.json
  const collectionJsonPath = path.join(generatedDir, 'collection.json');
  if (fs.existsSync(collectionJsonPath)) {
    try {
      const cj = JSON.parse(fs.readFileSync(collectionJsonPath, 'utf-8'));
      if (!cj.name) errors.push('collection.json: missing name');
      if (!cj.description) warnings.push('collection.json: missing description');
    } catch (e) {
      errors.push(`collection.json: invalid JSON - ${e.message}`);
    }
  } else {
    warnings.push('collection.json not found');
  }

  // Check rarity.json
  const rarityJsonPath = path.join(generatedDir, 'rarity.json');
  if (fs.existsSync(rarityJsonPath)) {
    try {
      const rj = JSON.parse(fs.readFileSync(rarityJsonPath, 'utf-8'));
      const rarityKeys = new Set(Object.keys(rj));
      for (const tokenId of tokenIds) {
        if (!rarityKeys.has(tokenId)) {
          warnings.push(`rarity.json: missing token ${tokenId}`);
        }
      }
      for (const key of rarityKeys) {
        if (!tokenIds.has(key)) {
          warnings.push(`rarity.json: extra token ${key} not in metadata`);
        }
      }
    } catch (e) {
      errors.push(`rarity.json: invalid JSON - ${e.message}`);
    }
  } else {
    warnings.push('rarity.json not found');
  }

  // Check metadata.csv
  const csvPath = path.join(generatedDir, 'metadata.csv');
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const csvLines = csvContent.trim().split('\n');
    const csvTokenCount = csvLines.length - 1; // minus header
    if (csvTokenCount !== tokenIds.size) {
      warnings.push(`metadata.csv has ${csvTokenCount} rows but metadata has ${tokenIds.size} tokens`);
    }
  } else {
    warnings.push('metadata.csv not found');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalTokens: tokenIds.size,
      totalImages: imageFiles.length,
      metadataJsonCount: metadataFiles.length,
    }
  };
}

module.exports = {
  validateMetadata,
};
