const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { getDataDir } = require('./data-path');

const CANVAS_SIZE = 512;

/**
 * Get the traits directory for a collection
 */
function getTraitsDir(collectionName) {
  return path.join(getDataDir(), 'collections', collectionName, 'traits');
}

/**
 * Get the generated images directory for a collection
 */
function getGeneratedImagesDir(collectionName) {
  const dir = path.join(getDataDir(), 'collections', collectionName, 'generated', 'images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the metadata directory for a collection
 */
function getMetadataDir(collectionName) {
  const dir = path.join(getDataDir(), 'collections', collectionName, 'generated', 'metadata');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the generated root directory for a collection
 */
function getGeneratedDir(collectionName) {
  const dir = path.join(getDataDir(), 'collections', collectionName, 'generated');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Composite trait images onto a canvas.
 * layers: [{ traits: { filename, x, y, scale, opacity } }]
 * Returns a Sharp instance of the composited image (PNG buffer).
 */
async function compositeTraits(collectionName, selectedTraits, canvasWidth = CANVAS_SIZE, canvasHeight = CANVAS_SIZE) {
  const traitsDir = getTraitsDir(collectionName);
  
  // Start with a transparent canvas
  let canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composites = [];

  for (const trait of selectedTraits) {
    const traitPath = path.join(traitsDir, trait.filename);
    if (!fs.existsSync(traitPath)) continue;

    // Get trait image metadata
    const metadata = await sharp(traitPath).metadata();
    const traitWidth = Math.round(metadata.width * (trait.scale || 1));
    const traitHeight = Math.round(metadata.height * (trait.scale || 1));

    // Resize trait to scaled dimensions, but cap at canvas size
    const cappedW = Math.min(traitWidth, canvasWidth);
    const cappedH = Math.min(traitHeight, canvasHeight);
    const resizedTrait = await sharp(traitPath)
      .resize(traitWidth, traitHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(cappedW, cappedH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Apply opacity if needed
    let finalTrait = resizedTrait;
    if (trait.opacity !== undefined && trait.opacity < 1.0) {
      finalTrait = await sharp(resizedTrait)
        .ensureAlpha(trait.opacity)
        .composite([{
          input: Buffer.from([255, 255, 255, Math.round(trait.opacity * 255)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: { width: traitWidth, height: traitHeight },
          blend: 'dest-in',
        }])
        .png()
        .toBuffer();
    }

    composites.push({
      input: finalTrait,
      left: trait.x || 0,
      top: trait.y || 0,
    });
  }

  if (composites.length > 0) {
    canvas = canvas.composite(composites);
  }

  return canvas.png().toBuffer();
}

/**
 * Composite traits to file
 */
async function compositeToFile(collectionName, selectedTraits, outputPath, canvasWidth = CANVAS_SIZE, canvasHeight = CANVAS_SIZE) {
  const buffer = await compositeTraits(collectionName, selectedTraits, canvasWidth, canvasHeight);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await sharp(buffer).toFile(outputPath);
  return outputPath;
}

/**
 * Resize canvas to target size (with transparency preserved)
 */
async function resizeCanvas(inputBuffer, width = CANVAS_SIZE, height = CANVAS_SIZE) {
  return sharp(inputBuffer)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

module.exports = {
  getTraitsDir,
  getGeneratedImagesDir,
  getMetadataDir,
  getGeneratedDir,
  compositeTraits,
  compositeToFile,
  resizeCanvas,
};
