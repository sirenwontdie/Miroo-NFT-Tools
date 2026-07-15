/**
 * Central data directory resolver.
 * In Electron production: uses app.getPath('userData') via NFT_DATA_DIR env var
 * In dev: falls back to process.cwd()/data/
 */

import path from 'path';

export function getDataDir() {
  return process.env.NFT_DATA_DIR || path.join(process.cwd(), 'data');
}

export function getCollectionsDir() {
  return path.join(getDataDir(), 'collections');
}

export function getCollectionDir(collectionName) {
  return path.join(getCollectionsDir(), collectionName);
}

export function getTraitsDir(collectionName) {
  return path.join(getCollectionDir(collectionName), 'traits');
}

export function getGeneratedDir(collectionName) {
  return path.join(getCollectionDir(collectionName), 'generated');
}

export function getGeneratedImagesDir(collectionName) {
  const dir = path.join(getGeneratedDir(collectionName), 'images');
  return dir;
}

export function getMetadataDir(collectionName) {
  return path.join(getGeneratedDir(collectionName), 'metadata');
}
