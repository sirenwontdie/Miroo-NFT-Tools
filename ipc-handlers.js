const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Import all lib modules
const db = require('./lib/db');
const imageUtils = require('./lib/image-utils');
const generator = require('./lib/generator');
const metadata = require('./lib/metadata');
const rarity = require('./lib/rarity');
const layout = require('./lib/layout');
const exportLib = require('./lib/export');
const upload = require('./lib/upload');

/**
 * Register all IPC handlers for API routes
 * This replaces Next.js API routes with Electron IPC
 */
function registerHandlers(dataDir) {
  // Set data directory for all lib modules
  process.env.NFT_DATA_DIR = dataDir;

  // ==================== COLLECTIONS ====================
  
  // GET /api/collections - List all collections
  ipcMain.handle('api:collections:list', async () => {
    try {
      const collections = await db.getCollections();
      return { success: true, data: collections };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // POST /api/collections - Create new collection
  ipcMain.handle('api:collections:create', async (event, data) => {
    try {
      const collection = await db.createCollection(data);
      return { success: true, data: collection };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // GET /api/collections/:id - Get single collection
  ipcMain.handle('api:collections:get', async (event, id) => {
    try {
      const collection = await db.getCollection(id);
      if (!collection) {
        return { success: false, error: 'Collection not found' };
      }
      return { success: true, data: collection };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // PATCH /api/collections/:id - Update collection
  ipcMain.handle('api:collections:update', async (event, id, data) => {
    try {
      const collection = await db.updateCollection(id, data);
      return { success: true, data: collection };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // DELETE /api/collections/:id - Delete collection
  ipcMain.handle('api:collections:delete', async (event, id) => {
    try {
      await db.deleteCollection(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== LAYERS ====================

  // GET /api/collections/:id/layers - Get all layers
  ipcMain.handle('api:layers:list', async (event, collectionId) => {
    try {
      const layers = await db.getLayers(collectionId);
      return { success: true, data: layers };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // POST /api/collections/:id/layers - Create layer
  ipcMain.handle('api:layers:create', async (event, collectionId, data) => {
    try {
      const layer = await db.createLayer(collectionId, data);
      return { success: true, data: layer };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // PATCH /api/collections/:id/layers/:layerId - Update layer
  ipcMain.handle('api:layers:update', async (event, collectionId, layerId, data) => {
    try {
      const layer = await db.updateLayer(layerId, data);
      return { success: true, data: layer };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // DELETE /api/collections/:id/layers/:layerId - Delete layer
  ipcMain.handle('api:layers:delete', async (event, collectionId, layerId) => {
    try {
      await db.deleteLayer(layerId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== TRAITS ====================

  // GET /api/collections/:id/layers/:layerId/traits - Get all traits
  ipcMain.handle('api:traits:list', async (event, collectionId, layerId) => {
    try {
      const traits = await db.getTraits(layerId);
      return { success: true, data: traits };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // POST /api/collections/:id/layers/:layerId/traits - Create trait
  ipcMain.handle('api:traits:create', async (event, collectionId, layerId, data) => {
    try {
      const trait = await db.createTrait(layerId, data);
      return { success: true, data: trait };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // PATCH /api/collections/:id/layers/:layerId/traits/:traitId - Update trait
  ipcMain.handle('api:traits:update', async (event, collectionId, layerId, traitId, data) => {
    try {
      const trait = await db.updateTrait(traitId, data);
      return { success: true, data: trait };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // DELETE /api/collections/:id/layers/:layerId/traits/:traitId - Delete trait
  ipcMain.handle('api:traits:delete', async (event, collectionId, layerId, traitId) => {
    try {
      await db.deleteTrait(traitId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // GET /api/collections/:id/traits/:filename - Get trait image
  ipcMain.handle('api:traits:image', async (event, collectionId, filename) => {
    try {
      const imagePath = path.join(dataDir, 'uploads', collectionId.toString(), filename);
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/webp';
      return { success: true, data: `data:${mimeType};base64,${base64}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== UPLOAD ====================

  // POST /api/collections/:id/upload - Upload trait images
  ipcMain.handle('api:upload:traits', async (event, collectionId, files) => {
    try {
      // files = [{name, buffer}]
      const uploadDir = path.join(dataDir, 'uploads', collectionId.toString());
      await fs.mkdir(uploadDir, { recursive: true });

      const uploaded = [];
      for (const file of files) {
        const filename = file.name;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, Buffer.from(file.buffer));
        uploaded.push({ filename, path: filePath });
      }

      return { success: true, data: uploaded };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== LAYOUT ====================

  // GET /api/collections/:id/layout - Get layout config
  ipcMain.handle('api:layout:get', async (event, collectionId) => {
    try {
      const layoutConfig = await layout.getLayout(collectionId);
      return { success: true, data: layoutConfig };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // POST /api/collections/:id/layout - Save layout config
  ipcMain.handle('api:layout:save', async (event, collectionId, config) => {
    try {
      await layout.saveLayout(collectionId, config);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== PREVIEW ====================

  // POST /api/collections/:id/preview - Generate preview image
  ipcMain.handle('api:preview:generate', async (event, collectionId, traitIds) => {
    try {
      const imageBuffer = await imageUtils.compositeTraits(collectionId, traitIds);
      const base64 = imageBuffer.toString('base64');
      return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== VALIDATE ====================

  // POST /api/collections/:id/validate - Validate collection before generate
  ipcMain.handle('api:validate:collection', async (event, collectionId) => {
    try {
      const errors = [];
      const warnings = [];

      const collection = await db.getCollection(collectionId);
      if (!collection) {
        errors.push('Collection not found');
        return { success: false, data: { valid: false, errors, warnings } };
      }

      const layers = await db.getLayers(collectionId);
      if (layers.length === 0) {
        errors.push('No layers defined');
      }

      for (const layer of layers) {
        const traits = await db.getTraits(layer.id);
        if (traits.length === 0) {
          warnings.push(`Layer "${layer.name}" has no traits`);
        }
      }

      const valid = errors.length === 0;
      return { success: true, data: { valid, errors, warnings } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== GENERATE ====================

  // POST /api/collections/:id/generate - Generate NFTs
  ipcMain.handle('api:generate:start', async (event, collectionId, count) => {
    try {
      const results = await generator.generate(collectionId, count);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== GENERATED ====================

  // GET /api/collections/:id/generated - List generated NFTs
  ipcMain.handle('api:generated:list', async (event, collectionId) => {
    try {
      const generated = await db.getGeneratedNFTs(collectionId);
      return { success: true, data: generated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // GET /api/collections/:id/generated/:tokenId - Get single generated NFT
  ipcMain.handle('api:generated:get', async (event, collectionId, tokenId) => {
    try {
      const nft = await db.getGeneratedNFT(collectionId, tokenId);
      if (!nft) {
        return { success: false, error: 'NFT not found' };
      }
      return { success: true, data: nft };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== EXPORT ====================

  // POST /api/collections/:id/export - Export collection (ZIP)
  ipcMain.handle('api:export:zip', async (event, collectionId) => {
    try {
      const zipPath = await exportLib.exportCollection(collectionId);
      const zipBuffer = await fs.readFile(zipPath);
      const base64 = zipBuffer.toString('base64');
      return { success: true, data: { path: zipPath, buffer: base64 } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== UPLOAD TO IPFS ====================

  // POST /api/collections/:id/upload-ipfs - Upload to Pinata
  ipcMain.handle('api:upload:ipfs', async (event, collectionId) => {
    try {
      const results = await upload.uploadToPinata(collectionId);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerHandlers };
