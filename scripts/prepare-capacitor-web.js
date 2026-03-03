const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const webDir = path.join(projectRoot, 'www');

const rootFilesToCopy = [
  'index.html',
  'game.js',
  'game_patched.js',
];

const optionalDirsToCopy = [
  'assets',
  'static',
  'public',
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

function copyFileIfExists(fileName) {
  const sourcePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(sourcePath)) return;
  const targetPath = path.join(webDir, fileName);
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirIfExists(dirName) {
  const sourceDir = path.join(projectRoot, dirName);
  if (!fs.existsSync(sourceDir)) return;
  const targetDir = path.join(webDir, dirName);
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

ensureDir(webDir);
cleanDir(webDir);

rootFilesToCopy.forEach(copyFileIfExists);
optionalDirsToCopy.forEach(copyDirIfExists);

if (!fs.existsSync(path.join(webDir, 'index.html'))) {
  throw new Error('index.html introuvable: impossible de preparer le build Android.');
}

console.log('www prepare pour Capacitor.');
