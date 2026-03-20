# Direct Installation (Unsupported)

!!! danger "Unsupported Installation Method"
    Running PiGallery2 natively (non-Docker) is possible but **not officially supported**. The maintainer will not answer questions or fix bugs specifically related to native installations. For the best experience and support, use the [Docker Installation](docker.md).

## Prerequisites
- **Node.js**: The app requires Node.js (check `package.json` for supported versions).
- **Build Tools**: Required for building some native modules.
  ```bash
  sudo apt-get install build-essential libkrb5-dev gcc g++
  ```

## Installation

### 1. Install Node.js
```bash
curl -sL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PiGallery2

#### From Release
```bash
wget https://github.com/bpatrik/pigallery2/releases/download/3.0.0/pigallery2-release.zip
unzip pigallery2-release.zip -d pigallery2
cd pigallery2
npm install
```

#### From Source
**Note**: Requires ~2GB of memory for building.
```bash
wget https://github.com/bpatrik/pigallery2/archive/master.zip
unzip master.zip
cd pigallery2-master
npm install
npm run build
```

## Running the App
```bash
npm start
```
Default credentials: `admin` / `admin`.

## Configuration
- Run the app once to generate `config.json`.
- Edit `config.json` manually or use the Settings UI.
- Use command-line switches for quick overrides:
  ```bash
  npm start -- --Server-port=8080
  ```
