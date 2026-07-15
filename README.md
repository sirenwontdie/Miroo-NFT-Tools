# Miroo NFT Tools

Desktop application for generating NFT collections with trait-based layering system.

## Features

- **Trait-based NFT Generator** — Layer system with rarity weights
- **Visual Editor** — Drag-and-drop trait positioning
- **Bulk Generation** — Generate 1-10,000 unique NFTs
- **Metadata Export** — OpenSea-compatible JSON + CSV
- **IPFS Upload** — Pinata, Cloudflare R2, or custom endpoint
- **Rarity Analysis** — Built-in rarity scoring and distribution

## Download

Get the latest installer from [Releases](https://github.com/sirenwontdie/Miroo-NFT-Tools/releases)

**Windows 10/11 64-bit**
- Download `Miroo NFT Tools Setup 1.0.x.exe`
- Run installer (Windows SmartScreen: click "More info" → "Run anyway")
- Data saved to `%APPDATA%\Miroo NFT Tools`

## Tech Stack

- **Electron** — Desktop wrapper
- **Next.js** — UI framework (standalone server mode)
- **SQLite** — Local database (better-sqlite3)
- **Sharp** — Image processing
- **React** — Frontend

## Development

This repo contains the Electron wrapper. The Next.js app lives in [sirenwontdie/Bagus-Mau-Beraksi](https://github.com/sirenwontdie/Bagus-Mau-Beraksi).

```bash
# Clone both repos
git clone https://github.com/sirenwontdie/Miroo-NFT-Tools.git
cd Miroo-NFT-Tools
git clone https://github.com/sirenwontdie/Bagus-Mau-Beraksi.git next-app

# Build Next.js standalone
cd next-app
npm install
npm run build
cd ..

# Run Electron
npm install
npm start
```

## Build Installer

GitHub Actions automatically builds on every push to `main`. Manual build:

```bash
npm install
npm run build:win
# Output: dist/Miroo NFT Tools Setup 1.0.0.exe
```

## License

MIT
