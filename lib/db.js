import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getDataDir } from '@/lib/data-path';

const DATA_DIR = getDataDir();
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'nft_generator.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    external_url TEXT DEFAULT '',
    image_base_url TEXT DEFAULT '',
    royalty_wallet TEXT DEFAULT '',
    royalty_fee_basis_points INTEGER DEFAULT 0,
    canvas_width INTEGER DEFAULT 512,
    canvas_height INTEGER DEFAULT 512,
    logo_filename TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS layers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE(collection_id, name)
  );

  CREATE TABLE IF NOT EXISTS traits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    rarity_weight INTEGER NOT NULL DEFAULT 1,
    x INTEGER NOT NULL DEFAULT 0,
    y INTEGER NOT NULL DEFAULT 0,
    scale REAL NOT NULL DEFAULT 1.0,
    opacity REAL NOT NULL DEFAULT 1.0,
    optional INTEGER NOT NULL DEFAULT 0,
    position_locked INTEGER NOT NULL DEFAULT 0,
    display_name TEXT DEFAULT '',
    category_name TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (layer_id) REFERENCES layers(id) ON DELETE CASCADE
  );
`);

// Migration: add canvas_width/canvas_height to existing collections (from old schema)
const columns = db.prepare("PRAGMA table_info(collections)").all().map(c => c.name);
if (!columns.includes('canvas_width')) {
  db.exec(`ALTER TABLE collections ADD COLUMN canvas_width INTEGER DEFAULT 512`);
}
if (!columns.includes('canvas_height')) {
  db.exec(`ALTER TABLE collections ADD COLUMN canvas_height INTEGER DEFAULT 512`);
}

// Migration: add position_locked to existing traits (from old schema)
const traitColumns = db.prepare("PRAGMA table_info(traits)").all().map(c => c.name);
if (!traitColumns.includes('position_locked')) {
  db.exec(`ALTER TABLE traits ADD COLUMN position_locked INTEGER DEFAULT 0`);
}

export default db;

// ── Collection queries ──
export const collectionQueries = {
  getAll: () => db.prepare('SELECT * FROM collections ORDER BY created_at DESC').all(),
  getById: (id) => db.prepare('SELECT * FROM collections WHERE id = ?').get(id),
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO collections (name, description, external_url, image_base_url, royalty_wallet, royalty_fee_basis_points, canvas_width, canvas_height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(data.name, data.description || '', data.external_url || '', data.image_base_url || '', data.royalty_wallet || '', data.royalty_fee_basis_points || 0, data.canvas_width || 512, data.canvas_height || 512);
    return { id: result.lastInsertRowid, ...data };
  },
  update: (id, data) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    values.push(id);
    db.prepare(`UPDATE collections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return collectionQueries.getById(id);
  },
  delete: (id) => {
    // Get collection name for folder cleanup
    const col = collectionQueries.getById(id);
    db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    return col;
  },
};

// ── Layer queries ──
export const layerQueries = {
  getByCollection: (collectionId) => 
    db.prepare('SELECT * FROM layers WHERE collection_id = ? ORDER BY sort_order').all(collectionId),
  getById: (id) => db.prepare('SELECT * FROM layers WHERE id = ?').get(id),
  create: (collectionId, name, sortOrder) => {
    const stmt = db.prepare('INSERT INTO layers (collection_id, name, sort_order) VALUES (?, ?, ?)');
    const result = stmt.run(collectionId, name, sortOrder);
    return { id: result.lastInsertRowid, collection_id: collectionId, name, sort_order: sortOrder, enabled: 1 };
  },
  update: (id, data) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    values.push(id);
    db.prepare(`UPDATE layers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return layerQueries.getById(id);
  },
  reorder: (layers) => {
    const stmt = db.prepare('UPDATE layers SET sort_order = ? WHERE id = ?');
    const tx = db.transaction((items) => {
      for (const item of items) {
        stmt.run(item.sort_order, item.id);
      }
    });
    tx(layers);
  },
  delete: (id) => {
    db.prepare('DELETE FROM layers WHERE id = ?').run(id);
  },
};

// ── Trait queries ──
export const traitQueries = {
  getByLayer: (layerId) => 
    db.prepare('SELECT * FROM traits WHERE layer_id = ? ORDER BY created_at').all(layerId),
  getById: (id) => db.prepare('SELECT * FROM traits WHERE id = ?').get(id),
  getByCollection: (collectionId) => 
    db.prepare(`
      SELECT t.*, l.name as layer_name, l.sort_order 
      FROM traits t 
      JOIN layers l ON t.layer_id = l.id 
      WHERE l.collection_id = ? 
      ORDER BY l.sort_order, t.created_at
    `).all(collectionId),
  create: (layerId, data) => {
    const stmt = db.prepare(`
      INSERT INTO traits (layer_id, name, filename, rarity_weight, x, y, scale, opacity, optional, display_name, category_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      layerId, data.name, data.filename, data.rarity_weight || 1,
      data.x || 0, data.y || 0, data.scale || 1.0, data.opacity || 1.0,
      data.optional ? 1 : 0, data.display_name || '', data.category_name || ''
    );
    return { id: result.lastInsertRowid, layer_id: layerId, ...data };
  },
  update: (id, data) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'layer_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    values.push(id);
    db.prepare(`UPDATE traits SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return traitQueries.getById(id);
  },
  delete: (id) => {
    const trait = traitQueries.getById(id);
    db.prepare('DELETE FROM traits WHERE id = ?').run(id);
    return trait;
  },
  deleteByLayer: (layerId) => {
    db.prepare('DELETE FROM traits WHERE layer_id = ?').run(layerId);
  },
};
