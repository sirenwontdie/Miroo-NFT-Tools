const fs = require('fs');
const path = require('path');

/**
 * Upload system — supports Pinata IPFS, Cloudflare R2, and custom HTTP
 * All upload functions accept optional onProgress(uploaded, total) callback
 * Uses native Node.js FormData + fetch (Node 18+) — no form-data npm package needed
 */

// ── Pinata IPFS (HTTP API, no SDK needed) ──
async function uploadToPinata(dirPath, options = {}, onProgress) {
  const { apiKey, secretKey } = options;
  if (!apiKey || !secretKey) throw new Error('Pinata API key + secret required');

  const files = fs.readdirSync(dirPath).filter(f => fs.existsSync(path.join(dirPath, f)));
  if (files.length === 0) throw new Error('No files to upload');

  const uploaded = [];
  const failed = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(dirPath, file);
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(file).toLowerCase();
    const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json' };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Use native FormData (Node 18+) with Blob — compatible with native fetch
    const form = new FormData();
    form.append('file', new Blob([fileBuffer], { type: contentType }), file);
    form.append('pinataMetadata', JSON.stringify({ name: file }));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    try {
      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: apiKey,
          pinata_secret_api_key: secretKey,
          // Do NOT set Content-Type manually — native fetch auto-sets boundary
        },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      uploaded.push({ filename: file, cid: data.IpfsHash });
    } catch (err) {
      failed.push({ filename: file, error: err.message });
    }

    if (onProgress) onProgress(i + 1, files.length);
  }

  if (uploaded.length === 0) throw new Error('All uploads failed: ' + failed.map(f => f.error).join('; '));

  const baseUrl = `ipfs://${uploaded[0].cid}`;
  return { baseUrl, uploaded, failed, folderCid: uploaded[0].cid };
}

// ── Cloudflare R2 / S3-compatible ──
async function uploadToR2(dirPath, options = {}, onProgress) {
  const { accountId, accessKeyId, secretAccessKey, bucket, baseUrl } = options;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 credentials required: accountId, accessKeyId, secretAccessKey, bucket');
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const files = fs.readdirSync(dirPath).filter(f => fs.existsSync(path.join(dirPath, f)));
  const uploaded = [];
  const failed = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(dirPath, file);
    const body = fs.readFileSync(filePath);
    const contentType = file.endsWith('.png') ? 'image/png' : file.endsWith('.json') ? 'application/json' : 'application/octet-stream';

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: file,
        Body: body,
        ContentType: contentType,
      }));
      uploaded.push({ filename: file, url: `${baseUrl}/${file}` });
    } catch (err) {
      failed.push({ filename: file, error: err.message });
    }

    if (onProgress) onProgress(i + 1, files.length);
  }

  return { baseUrl, uploaded, failed };
}

// ── Custom HTTP server (ftp, scp, rsync via curl) ──
async function uploadToCustomServer(dirPath, options = {}, onProgress) {
  const { serverUrl, uploadCommand, username, password } = options;
  if (!serverUrl) throw new Error('Server URL required');

  const files = fs.readdirSync(dirPath).filter(f => fs.existsSync(path.join(dirPath, f)));
  const uploaded = [];
  const failed = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(dirPath, file);
    try {
      if (uploadCommand) {
        const cmd = uploadCommand.replace('{file}', filePath).replace('{filename}', file);
        const { execSync } = await import('child_process');
        execSync(cmd, { timeout: 60000 });
      } else {
        const { execSync } = await import('child_process');
        execSync(`curl -T "${filePath}" "${serverUrl}/${file}"`, { timeout: 60000 });
      }
      uploaded.push({ filename: file, url: `${serverUrl}/${file}` });
    } catch (err) {
      failed.push({ filename: file, error: err.message });
    }

    if (onProgress) onProgress(i + 1, files.length);
  }

  return { baseUrl: serverUrl, uploaded, failed };
}

// ── Main upload dispatcher ──
async function uploadFiles(dirPath, storageConfig) {
  const { type } = storageConfig;

  switch (type) {
    case 'pinata':
      return uploadToPinata(dirPath, storageConfig);
    case 'r2':
      return uploadToR2(dirPath, storageConfig);
    case 'custom':
      return uploadToCustomServer(dirPath, storageConfig);
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

/**
 * Generate metadata files with proper image URLs
 * Updates both JSON metadata AND metadata.csv with the correct image base URL
 * cidMap: { "1.png": "QmXXX", "2.png": "QmYYY" } — individual CIDs per file
 */
function generateMetadataWithUrls(project, imageBaseUrl, outputDir, cidMap = {}) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const count = project.supply || 0;
  
  // Update individual metadata JSON files
  for (let i = 1; i <= count; i++) {
    const metaPath = path.join(outputDir, `${i}.json`);
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    // Use individual CID if available, otherwise fallback to base URL
    const filename = `${i}.png`;
    if (cidMap[filename]) {
      meta.image = `ipfs://${cidMap[filename]}`;
    } else {
      meta.image = `${imageBaseUrl}/${i}.png`;
    }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  // CSV no longer needs image_url update — OpenSea uses file_name to find images
}

/**
 * Save upload report
 */
function saveUploadReport(outputDir, report) {
  const reportPath = path.join(outputDir, 'upload-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

/**
 * Generate human-readable final-report.txt with IPFS URLs + stats
 * Called after upload completes — saved alongside upload-report.json
 */
function generateFinalReport(outputDir, report, cidMap = {}) {
  const lines = [];
  const sep = '═'.repeat(50);
  const thin = '─'.repeat(50);

  lines.push(sep);
  lines.push('          NFT COLLECTION — FINAL UPLOAD REPORT');
  lines.push(sep);
  lines.push('');
  lines.push(`Collection:    ${report.collectionName || 'Unknown'}`);
  lines.push(`Storage:       ${report.storageType || 'N/A'}`);
  lines.push(`Timestamp:     ${report.timestamp || new Date().toISOString()}`);
  lines.push('');
  lines.push(thin);
  lines.push('  SUMMARY');
  lines.push(thin);
  lines.push(`  Total Images:     ${report.totalImages || 0}`);
  lines.push(`  Total Metadata:   ${report.totalMetadata || 0}`);
  lines.push(`  Failed Images:    ${report.failedImages || 0}`);
  lines.push(`  Failed Metadata:  ${report.failedMetadata || 0}`);
  lines.push('');

  // IPFS URLs
  if (report.imageBaseUrl) {
    lines.push(thin);
    lines.push('  IPFS URLs');
    lines.push(thin);
    lines.push(`  Image Base URL:    ${report.imageBaseUrl}`);
    if (report.metadataBaseUri) {
      lines.push(`  Metadata Base URI: ${report.metadataBaseUri}`);
    }
    lines.push('');
  }

  // Per-token CID mapping
  // Per-token URL/CID mapping (works for IPFS, R2, and Custom HTTP)
  if (cidMap && Object.keys(cidMap).length > 0) {
    lines.push(thin);
    lines.push('  PER-TOKEN URLs');
    lines.push(thin);
    const sorted = Object.entries(cidMap).sort((a, b) => {
      const na = parseInt(a[0]);
      const nb = parseInt(b[0]);
      return isNaN(na) || isNaN(nb) ? a[0].localeCompare(b[0]) : na - nb;
    });
    for (const [filename, cid] of sorted) {
      // Pinata: cid is "QmXXX" → display as ipfs://QmXXX
      // R2/Custom: cid is already full URL "https://..."
      const displayUrl = cid.startsWith('http') || cid.startsWith('ipfs://') ? cid : `ipfs://${cid}`;
      lines.push(`  ${filename.padEnd(12)} → ${displayUrl}`);
    }
    lines.push('');
  }

  // Trait summary (if available)
  if (report.traits) {
    lines.push(thin);
    lines.push('  TRAIT BREAKDOWN');
    lines.push(thin);
    for (const [layer, traits] of Object.entries(report.traits)) {
      lines.push(`  ${layer}: ${traits.length} traits`);
    }
    lines.push('');
  }

  lines.push(sep);
  lines.push('  Generated by Bagus-Mau-Beraksi');
  lines.push(sep);
  lines.push('');

  const reportPath = path.join(outputDir, 'final-report.txt');
  fs.writeFileSync(reportPath, lines.join('\n'));
  return reportPath;
}

module.exports = {
  uploadToPinata,
  uploadToR2,
  uploadToCustomServer,
  uploadFiles,
  generateMetadataWithUrls,
  saveUploadReport,
  generateFinalReport,
};
