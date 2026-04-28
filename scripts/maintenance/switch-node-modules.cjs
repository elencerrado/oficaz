const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const activeDir = path.join(rootDir, 'node_modules');
const backups = {
  mac: path.join(rootDir, 'node_modules.mac'),
  windows: path.join(rootDir, 'node_modules.windows'),
};
const platformMarkers = {
  mac: [
    path.join('@esbuild', 'darwin-arm64'),
    path.join('@esbuild', 'darwin-x64'),
    path.join('@img', 'sharp-darwin-arm64'),
    path.join('@img', 'sharp-darwin-x64'),
    'lightningcss-darwin-arm64',
    'lightningcss-darwin-x64',
  ],
  windows: [
    path.join('@esbuild', 'win32-arm64'),
    path.join('@esbuild', 'win32-ia32'),
    path.join('@esbuild', 'win32-x64'),
    path.join('@img', 'sharp-win32-arm64'),
    path.join('@img', 'sharp-win32-x64'),
    'lightningcss-win32-x64-msvc',
  ],
};

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function describeDirectory(targetPath) {
  if (!exists(targetPath)) {
    return 'missing';
  }

  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory()) {
    return 'not a directory';
  }

  return 'present';
}

function detectCurrentPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'windows';
    default:
      return null;
  }
}

function detectInstalledPlatform(targetDir) {
  if (!exists(targetDir)) {
    return null;
  }

  for (const [platform, markers] of Object.entries(platformMarkers)) {
    if (markers.some((marker) => exists(path.join(targetDir, marker)))) {
      return platform;
    }
  }

  return null;
}

function printStatus() {
  const currentPlatform = detectCurrentPlatform();
  console.log(`platform: ${process.platform}${currentPlatform ? ` (${currentPlatform})` : ''}`);
  console.log(`node_modules: ${describeDirectory(activeDir)}`);
  const installedPlatform = detectInstalledPlatform(activeDir);
  if (installedPlatform) {
    console.log(`active installation looks like: ${installedPlatform}`);
  }
  console.log(`node_modules.mac: ${describeDirectory(backups.mac)}`);
  console.log(`node_modules.windows: ${describeDirectory(backups.windows)}`);
}

function renameIfExists(fromPath, toPath) {
  if (!exists(fromPath)) {
    return;
  }

  if (exists(toPath)) {
    throw new Error(`Destination already exists: ${path.basename(toPath)}`);
  }

  fs.renameSync(fromPath, toPath);
}

function runNpmInstall() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['install'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm install failed with exit code ${result.status}`);
  }
}

function switchModules(target) {
  const targetBackup = backups[target];
  if (!targetBackup) {
    throw new Error(`Unsupported target: ${target}`);
  }

  const activePlatform = detectInstalledPlatform(activeDir);

  if (!exists(activeDir) && exists(targetBackup)) {
    console.log(`Restoring ${path.basename(targetBackup)} to node_modules...`);
    renameIfExists(targetBackup, activeDir);
    return;
  }

  if (exists(activeDir) && activePlatform === target) {
    console.log(`node_modules already matches ${target}. No changes were applied.`);
    return;
  }

  if (exists(activeDir) && activePlatform && activePlatform !== target) {
    const activeBackup = backups[activePlatform];
    if (!exists(activeBackup)) {
      console.log(`Saving current node_modules to ${path.basename(activeBackup)}...`);
      renameIfExists(activeDir, activeBackup);
    } else {
      throw new Error(`Cannot archive current node_modules because ${path.basename(activeBackup)} already exists.`);
    }
  }

  if (!exists(activeDir) && exists(targetBackup)) {
    console.log(`Restoring ${path.basename(targetBackup)} to node_modules...`);
    renameIfExists(targetBackup, activeDir);
    return;
  }

  if (!exists(activeDir)) {
    console.log(`No ${path.basename(targetBackup)} found. Installing fresh dependencies for ${target}...`);
    runNpmInstall();
    return;
  }

  throw new Error('Existing node_modules could not be identified. Move it manually or extend platform markers before switching.');
}

function main() {
  const action = process.argv[2] || 'status';

  if (action === 'status') {
    printStatus();
    return;
  }

  if (action !== 'mac' && action !== 'windows') {
    console.error('Usage: node scripts/maintenance/switch-node-modules.cjs [status|mac|windows]');
    process.exit(1);
  }

  switchModules(action);
  printStatus();
}

main();