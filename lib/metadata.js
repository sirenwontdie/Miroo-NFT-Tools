const { stringify } = require('csv-stringify/sync');
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data-path');

/**
 * Generate token metadata JSON
 */
function generateTokenMetadata(tokenId, traits, collectionSettings) {
  const name = `${collectionSettings.name} #${tokenId}`;
  const description = collectionSettings.description || '';
  const image = collectionSettings.image_base_url 
    ? `${collectionSettings.image_base_url.replace(/\/$/, '')}/${tokenId}.png`
    : `https://example.com/${tokenId}.png`;
  const external_url = collectionSettings.external_url || '';

  const attributes = traits
    .filter(t => t !== null)
    .map(t => ({
      trait_type: t.category_name || t.layer_name || 'Unknown',
      value: t.display_name || t.name,
    }));

  return {
    name,
    description,
    image,
    external_url,
    attributes,
  };
}

/**
 * Generate collection.json
 */
function generateCollectionJson(settings) {
  return {
    name: settings.name,
    description: settings.description || '',
    image: settings.logo_url || '',
    external_link: settings.external_url || '',
    seller_fee_basis_points: settings.royalty_fee_basis_points || 0,
    fee_recipient: settings.royalty_wallet || '',
  };
}

/**
 * Generate rarity.json
 * Format: { "tokenId": rank }
 */
function generateRarityJson(rarityRanks) {
  const result = {};
  for (const [tokenId, rank] of Object.entries(rarityRanks)) {
    result[String(tokenId)] = rank;
  }
  return result;
}

/**
 * Generate metadata.csv
 */
function generateMetadataCsv(combinations, collectionSettings) {
  // Collect all unique trait categories
  const allCategories = new Set();
  for (const combo of combinations) {
    for (const trait of combo.traits) {
      if (trait) {
        allCategories.add(trait.category_name || trait.layer_name || 'Unknown');
      }
    }
  }

  const categories = [...allCategories].sort();

  // Build header — OpenSea valid columns: file_name, tokenID, name, description, external_url, attributes[TraitName]
  const headers = ['file_name', 'tokenID', 'name', 'description', 'external_url'];
  for (const cat of categories) {
    headers.push(`attributes[${cat}]`);
  }

  // Build rows
  const rows = [];
  for (const combo of combinations) {
    const metadata = generateTokenMetadata(combo.tokenId, combo.traits, collectionSettings);
    const row = [
      `${combo.tokenId}.png`,
      combo.tokenId,
      metadata.name,
      metadata.description,
      metadata.external_url,
    ];

    // Fill trait columns
    for (const cat of categories) {
      const trait = combo.traits.find(t => (t.category_name || t.layer_name) === cat);
      row.push(trait ? (trait.display_name || trait.name) : '');
    }

    rows.push(row);
  }

  return stringify([headers, ...rows]);
}

/**
 * Generate README.md for the collection
 */
function generateReadme(settings, traitsByCategory, supplyCount) {
  const categories = Object.keys(traitsByCategory).sort();
  
  let readme = `# ${settings.name}\n\n`;
  readme += `${settings.description || 'A unique NFT collection.'}\n\n`;
  readme += `## About\n\n`;
  readme += `A collection of ${supplyCount.toLocaleString()} unique NFTs`;
  if (settings.external_url) {
    readme += ` on Ethereum`;
  }
  readme += `. Each NFT is randomly generated with multiple trait categories.\n\n`;
  
  readme += `## Traits\n\n`;
  for (const cat of categories) {
    const count = traitsByCategory[cat].length;
    readme += `* **${cat}** (${count} traits)\n`;
  }
  
  readme += `\n## Links\n\n`;
  if (settings.external_url) readme += `* Website: ${settings.external_url}\n`;
  readme += `* Twitter/X: https://x.com/yourhandle\n`;
  readme += `* Discord: https://discord.gg/yourserver\n\n`;
  
  readme += `## Supply\n\n`;
  readme += `${supplyCount.toLocaleString()} unique NFTs\n`;
  
  return readme;
}

/**
 * Save metadata files to disk
 */
function saveMetadataFiles(collectionName, combinations, rarityRanks, collectionSettings) {
  const metadataDir = path.join(getDataDir(), 'collections', collectionName, 'generated', 'metadata');
  if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });

  const generatedDir = path.join(getDataDir(), 'collections', collectionName, 'generated');

  // Save individual metadata JSON files
  for (const combo of combinations) {
    const metadata = generateTokenMetadata(combo.tokenId, combo.traits, collectionSettings);
    const filePath = path.join(metadataDir, `${combo.tokenId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
  }

  // Save collection.json
  const collectionJson = generateCollectionJson(collectionSettings);
  fs.writeFileSync(path.join(generatedDir, 'collection.json'), JSON.stringify(collectionJson, null, 2));

  // Save rarity.json
  const rarityJson = generateRarityJson(rarityRanks);
  fs.writeFileSync(path.join(generatedDir, 'rarity.json'), JSON.stringify(rarityJson, null, 2));

  // Save metadata.csv
  const csv = generateMetadataCsv(combinations, collectionSettings);
  fs.writeFileSync(path.join(generatedDir, 'metadata.csv'), csv);

  // Save README.md
  const traitsByCategory = {};
  for (const combo of combinations) {
    for (const trait of combo.traits) {
      if (trait) {
        const cat = trait.category_name || trait.layer_name;
        if (!traitsByCategory[cat]) traitsByCategory[cat] = [];
        if (!traitsByCategory[cat].find(t => t.name === trait.name)) {
          traitsByCategory[cat].push(trait);
        }
      }
    }
  }
  const readme = generateReadme(collectionSettings, traitsByCategory, combinations.length);
  fs.writeFileSync(path.join(generatedDir, 'README.md'), readme);
}

module.exports = {
  generateTokenMetadata,
  generateCollectionJson,
  generateRarityJson,
  generateMetadataCsv,
  generateReadme,
  saveMetadataFiles,
};
