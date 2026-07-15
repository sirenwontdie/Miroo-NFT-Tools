/**
 * Central data directory resolver.
 * In Electron production: uses app.getPath('userData') via NFT_DATA_DIR env var
 * In dev: falls back to process.cwd()/data/
 */

const path = require('path');

function getDataDir() {
  return process.env.NFT_DATA_DIR || path.join(process.cwd(), 'data');
}

function getCollectionsDir() {
  return path.join(getDataDir(), 'collections');
}

function getCollectionDir(collectionName) {
  return path.join(getCollectionsDir(), collectionName);
}

function getTraitsDir(collectionName) {
  return path.join(getCollectionDir(collectionName), 'traits');
}

function getGeneratedDir(collectionName) {
  return path.join(getCollectionDir(collectionName), 'generated');
}

function getGeneratedImagesDir(collectionName) {
  const dir = path.join(getGeneratedDir(collectionName), 'images');
  return dir;
}

function getMetadataDir(collectionName) {
  return path.join(getGeneratedDir(collectionName), 'metadata');
}

module.exports = {
  getDataDir,
  getCollectionsDir,
  getCollectionDir,
  getTraitsDir,
  getGeneratedDir,
  getGeneratedImagesDir,
  getMetadataDir,
};
