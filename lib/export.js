import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { getDataDir } from '@/lib/data-path';

/**
 * Create ZIP export for a collection
 * Contains: images/, metadata/, metadata.csv, collection.json, rarity.json, README.md
 */
export function createExportZip(collectionName) {
  const generatedDir = path.join(getDataDir(), 'collections', collectionName, 'generated');
  const zip = new JSZip();

  if (!fs.existsSync(generatedDir)) {
    throw new Error('Generated directory not found. Run batch generation first.');
  }

  // Add images/
  const imagesDir = path.join(generatedDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const images = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));
    for (const img of images) {
      const data = fs.readFileSync(path.join(imagesDir, img));
      zip.file(`images/${img}`, data);
    }
  }

  // Add metadata/
  const metadataDir = path.join(generatedDir, 'metadata');
  if (fs.existsSync(metadataDir)) {
    const metaFiles = fs.readdirSync(metadataDir).filter(f => f.endsWith('.json'));
    for (const file of metaFiles) {
      const data = fs.readFileSync(path.join(metadataDir, file), 'utf-8');
      zip.file(`metadata/${file}`, data);
    }
  }

  // Add metadata.csv
  const csvPath = path.join(generatedDir, 'metadata.csv');
  if (fs.existsSync(csvPath)) {
    zip.file('metadata.csv', fs.readFileSync(csvPath, 'utf-8'));
  }

  // Add collection.json
  const cjPath = path.join(generatedDir, 'collection.json');
  if (fs.existsSync(cjPath)) {
    zip.file('collection.json', fs.readFileSync(cjPath, 'utf-8'));
  }

  // Add rarity.json
  const rjPath = path.join(generatedDir, 'rarity.json');
  if (fs.existsSync(rjPath)) {
    zip.file('rarity.json', fs.readFileSync(rjPath, 'utf-8'));
  }

  // Add rarity_report.json
  const rrPath = path.join(generatedDir, 'rarity_report.json');
  if (fs.existsSync(rrPath)) {
    zip.file('rarity_report.json', fs.readFileSync(rrPath, 'utf-8'));
  }

  // Add README.md
  const readmePath = path.join(generatedDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    zip.file('README.md', fs.readFileSync(readmePath, 'utf-8'));
  }

  // Add final-report.txt (generated after upload)
  const reportPath = path.join(generatedDir, 'final-report.txt');
  if (fs.existsSync(reportPath)) {
    zip.file('final-report.txt', fs.readFileSync(reportPath, 'utf-8'));
  }

  // Save ZIP to disk
  const zipPath = path.join(generatedDir, 'export.zip');
  return zip.generateAsync({ type: 'nodebuffer' }).then(buffer => {
    fs.writeFileSync(zipPath, buffer);
    return zipPath;
  });
}

/**
 * Get ZIP file path for download
 */
export function getExportZipPath(collectionName) {
  return path.join(getDataDir(), 'collections', collectionName, 'generated', 'export.zip');
}
